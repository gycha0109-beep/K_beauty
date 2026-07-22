import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  fetchPremiumSessionRows,
  fetchSavedReportById,
  countDuplicateSourceTuples,
  hashIdentifier,
  requireCondition
} from "./premium-browser-journey-core.mjs";
import {
  HOSTED_FAILURE_CATEGORIES,
  loadDeploymentAttestation,
  loadHostedManifest,
  parseHostedConfig,
  validateSupabasePublicConfig
} from "./premium-hosted-preview-core-v2.mjs";
import {
  assertPathInside,
  hashFileSha256,
  secureWriteJson
} from "./premium-hosted-preview-security.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const attestation = await loadDeploymentAttestation(config, manifest);
const supabaseUrl = String(process.env.PREMIUM_HOSTED_SUPABASE_URL || "").trim();
validateSupabasePublicConfig(supabaseUrl, manifest);
const anonKey = String(process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY || "").trim();
const accessToken = String(process.env.PREMIUM_HOSTED_ACCESS_TOKEN || "").trim();
requireCondition(accessToken && anonKey, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "supabase_reader_config_missing");

const browserPersistenceInput = String(process.env.PREMIUM_HOSTED_BROWSER_PERSISTENCE_PATH || "").trim();
requireCondition(browserPersistenceInput, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "browser_persistence_path_missing");
const browserPersistencePath = assertPathInside(
  config.securePaths.credentialsDir,
  browserPersistenceInput,
  "browser_persistence_outside_secure_root"
);
const browserPersistence = JSON.parse(await readFile(browserPersistencePath, "utf8"));
const browserSavedIds = Array.isArray(browserPersistence?.createdSavedReportIds)
  ? browserPersistence.createdSavedReportIds.map((value) => String(value || "").trim()).filter(Boolean)
  : [];
const recordIds = Array.isArray(browserPersistence?.records)
  ? browserPersistence.records.map((row) => String(row?.savedReportId || "").trim()).filter(Boolean)
  : [];
requireCondition(
  browserPersistence?.cleanupRequired === true &&
    browserPersistence?.duplicateSourceTupleCount === 0 &&
    browserSavedIds.length === 4 &&
    new Set(browserSavedIds).size === browserSavedIds.length,
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "db-evidence",
  "browser_persistence_contract_invalid"
);
requireCondition(
  recordIds.length === browserSavedIds.length &&
    recordIds.every((id) => browserSavedIds.includes(id)) &&
    browserSavedIds.every((id) => recordIds.includes(id)),
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "db-evidence",
  "browser_persistence_record_mismatch"
);
requireCondition(
  browserSavedIds.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "db-evidence",
  "browser_persistence_saved_report_id_invalid"
);
const browserPersistenceHash = await hashFileSha256(browserPersistencePath);

const expectedUiLanes = new Set([
  "ko-normal",
  "en-normal",
  "selected-product",
  "not-in-db",
  "selected-plus-not-in-db",
  "duplicate-axis",
  "photo-fallback"
]);
const uiCreatedIdsDirInput = String(
  process.env.PREMIUM_HOSTED_UI_CREATED_IDS_DIR || resolve(config.securePaths.credentialsDir, "ui-created-ids")
).trim();
const uiCreatedIdsDir = assertPathInside(
  config.securePaths.credentialsDir,
  uiCreatedIdsDirInput,
  "ui_created_ids_directory_outside_secure_root"
);
const uiCreatedIdsReal = await realpath(uiCreatedIdsDir).catch(() => null);
requireCondition(uiCreatedIdsReal, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "ui_created_ids_directory_missing");
const fileNames = (await readdir(uiCreatedIdsReal)).filter((name) => name.endsWith(".json")).sort();
requireCondition(fileNames.length === expectedUiLanes.size, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "ui_created_ids_file_count_invalid");
const uiSavedIds = [];
const uiLanes = [];
const uiFileHashes = [];
for (const fileName of fileNames) {
  const filePath = await realpath(resolve(uiCreatedIdsReal, fileName)).catch(() => null);
  requireCondition(filePath, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "ui_created_id_file_missing");
  const rel = relative(uiCreatedIdsReal, filePath);
  requireCondition(rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "ui_created_id_file_outside_directory");
  const document = JSON.parse(await readFile(filePath, "utf8"));
  const savedReportId = String(document?.savedReportId || "").trim();
  requireCondition(
    document?.schemaVersion === "premium-hosted-ui-created-report-v1" &&
      document?.runId === config.runId &&
      document?.prNumber === config.prNumber &&
      document?.deploymentId === attestation.vercelDeploymentId &&
      document?.deploymentSha === attestation.prHeadSha &&
      document?.ownerUserIdHash === manifest.accountA.expectedUserIdHash &&
      expectedUiLanes.has(document?.laneName) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(savedReportId),
    HOSTED_FAILURE_CATEGORIES.PRECONDITION,
    "db-evidence",
    "ui_created_report_evidence_invalid"
  );
  uiSavedIds.push(savedReportId);
  uiLanes.push(document.laneName);
  uiFileHashes.push(await hashFileSha256(filePath));
}
requireCondition(
  new Set(uiLanes).size === expectedUiLanes.size && [...expectedUiLanes].every((lane) => uiLanes.includes(lane)),
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "db-evidence",
  "ui_created_report_lane_mismatch"
);
const uiEvidenceHash = createHash("sha256").update(uiFileHashes.sort().join(":"), "utf8").digest("hex");
const savedIds = [...browserSavedIds, ...uiSavedIds];
requireCondition(
  savedIds.length === 11 && new Set(savedIds).size === savedIds.length,
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "db-evidence",
  "combined_saved_report_scope_invalid"
);

const { buildPremiumReportSnapshot } = await import(
  pathToFileURL(resolve(process.cwd(), "lib/premium-report-snapshot.js")).href
);
const dbConfig = { accessToken, supabaseUrl, anonKey };
const rows = [];
for (const id of savedIds) {
  const row = await fetchSavedReportById(dbConfig, id);
  requireCondition(row?.id === id, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "saved_report_not_readable");
  requireCondition(
    row.report_type === "premium" && row.source_type === "premium_report_session",
    HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
    "db-evidence",
    "saved_report_source_invalid"
  );
  const snapshot = buildPremiumReportSnapshot(row.premium_report);
  requireCondition(snapshot?.fingerprint, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "snapshot_fingerprint_missing");
  requireCondition(row.report_version === snapshot.reportVersion, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "report_version_mismatch");
  requireCondition(
    snapshot.version && snapshot.reportVersion && snapshot.decisionBundleVersion &&
      new Set([snapshot.version, snapshot.reportVersion, snapshot.decisionBundleVersion]).size === 3,
    HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
    "db-evidence",
    "version_contract_not_separated"
  );
  requireCondition(row.source_session_id, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "source_session_missing");
  rows.push({
    savedReportIdHash: hashIdentifier(row.id),
    ownerMatches: hashIdentifier(row.user_id) === manifest.accountA.expectedUserIdHash,
    reportType: row.report_type,
    reportVersion: row.report_version,
    snapshotVersion: snapshot.version,
    decisionBundleVersion: snapshot.decisionBundleVersion,
    fingerprint: snapshot.fingerprint,
    sourceType: row.source_type,
    sourceSessionHash: hashIdentifier(row.source_session_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}
requireCondition(rows.every((row) => row.ownerMatches), HOSTED_FAILURE_CATEGORIES.AUTH, "db-evidence", "saved_report_owner_mismatch");
requireCondition(
  new Set(rows.map((row) => row.sourceSessionHash)).size === rows.length,
  HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
  "db-evidence",
  "source_session_not_independent"
);
const allSessionRows = await fetchPremiumSessionRows(dbConfig);
const duplicateTupleCount = countDuplicateSourceTuples(allSessionRows);
requireCondition(duplicateTupleCount === 0, HOSTED_FAILURE_CATEGORIES.PERSISTENCE, "db-evidence", "duplicate_source_tuple_detected");

const cleanupManifestPath = assertPathInside(
  config.securePaths.credentialsDir,
  process.env.PREMIUM_HOSTED_CLEANUP_MANIFEST_OUTPUT || resolve(config.securePaths.credentialsDir, "cleanup-manifest.json"),
  "cleanup_manifest_output_outside_secure_root"
);
const createdAt = Date.now();
const cleanupManifest = {
  schemaVersion: "premium-hosted-cleanup-manifest-v1",
  runId: config.runId,
  prNumber: config.prNumber,
  deploymentId: attestation.vercelDeploymentId,
  deploymentSha: attestation.prHeadSha,
  ownerUserIdHash: manifest.accountA.expectedUserIdHash,
  browserPersistenceHash,
  uiEvidenceHash,
  savedReportIds: [...savedIds],
  createdAt: new Date(createdAt).toISOString(),
  expiresAt: new Date(createdAt + 60 * 60 * 1000).toISOString()
};
await secureWriteJson(cleanupManifestPath, cleanupManifest);
const cleanupManifestHash = await hashFileSha256(cleanupManifestPath);

console.log(JSON.stringify({
  status: "passed",
  runId: config.runId,
  prNumber: config.prNumber,
  deploymentId: attestation.vercelDeploymentId,
  deploymentSha: attestation.prHeadSha,
  immutableHost: attestation.immutableHost,
  rows,
  duplicateTupleCount,
  browserPersistenceHash,
  uiEvidenceHash,
  cleanupManifestCreated: true,
  cleanupManifestHash
}, null, 2));
