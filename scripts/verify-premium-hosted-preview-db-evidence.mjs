import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
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

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const attestation = await loadDeploymentAttestation(config, manifest);
const supabaseUrl = String(process.env.PREMIUM_HOSTED_SUPABASE_URL || "").trim();
validateSupabasePublicConfig(supabaseUrl, manifest);
const anonKey = String(process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY || "").trim();
const accessToken = String(process.env.PREMIUM_HOSTED_ACCESS_TOKEN || "").trim();
const savedIds = String(process.env.PREMIUM_HOSTED_SAVED_REPORT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
requireCondition(accessToken && anonKey, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "supabase_reader_config_missing");
requireCondition(savedIds.length >= 2 && savedIds.length <= 20, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "saved_report_ids_incomplete");
requireCondition(new Set(savedIds).size === savedIds.length, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "db-evidence", "saved_report_ids_duplicate");

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
    savedReportId: row.id,
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

console.log(JSON.stringify({
  status: "passed",
  deploymentId: attestation.vercelDeploymentId,
  deploymentSha: attestation.prHeadSha,
  rows,
  duplicateTupleCount
}, null, 2));
