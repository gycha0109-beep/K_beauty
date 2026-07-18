import { readFile, rm } from "node:fs/promises";
import {
  deleteSavedReportById,
  fetchAuthUser,
  fetchSavedReportById,
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
  hashFileSha256
} from "./premium-hosted-preview-security.mjs";

const config = parseHostedConfig();
const manifest = await loadHostedManifest(config.manifestPath);
const attestation = await loadDeploymentAttestation(config, manifest);
const confirmation = String(process.env.PREMIUM_HOSTED_CLEANUP_CONFIRMATION || "").trim();
requireCondition(
  confirmation === `DELETE_HOSTED_TEST_ROWS:${config.runId}`,
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_not_confirmed"
);

const manifestPathInput = String(process.env.PREMIUM_HOSTED_CLEANUP_MANIFEST_PATH || "").trim();
const expectedManifestHash = String(process.env.PREMIUM_HOSTED_CLEANUP_MANIFEST_SHA256 || "").trim().toLowerCase();
requireCondition(manifestPathInput, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_manifest_missing");
requireCondition(/^[0-9a-f]{64}$/.test(expectedManifestHash), HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_manifest_hash_missing_or_invalid");
const cleanupManifestPath = assertPathInside(
  config.securePaths.credentialsDir,
  manifestPathInput,
  "cleanup_manifest_outside_secure_root"
);
const actualManifestHash = await hashFileSha256(cleanupManifestPath);
requireCondition(actualManifestHash === expectedManifestHash, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_manifest_hash_mismatch");
const cleanupManifest = JSON.parse(await readFile(cleanupManifestPath, "utf8"));

const now = Date.now();
const createdAt = Date.parse(cleanupManifest?.createdAt || "");
const expiresAt = Date.parse(cleanupManifest?.expiresAt || "");
requireCondition(
  cleanupManifest?.schemaVersion === "premium-hosted-cleanup-manifest-v1" &&
    cleanupManifest?.runId === config.runId &&
    cleanupManifest?.prNumber === config.prNumber &&
    cleanupManifest?.deploymentId === attestation.vercelDeploymentId &&
    cleanupManifest?.deploymentSha === attestation.prHeadSha &&
    cleanupManifest?.ownerUserIdHash === manifest.accountA.expectedUserIdHash,
  HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION,
  "cleanup",
  "cleanup_manifest_binding_mismatch"
);
requireCondition(
  Number.isFinite(createdAt) &&
    Number.isFinite(expiresAt) &&
    createdAt <= now + 60_000 &&
    expiresAt > now &&
    expiresAt > createdAt &&
    expiresAt - createdAt <= 60 * 60 * 1000,
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_manifest_expired_or_invalid"
);

const ids = Array.isArray(cleanupManifest.savedReportIds)
  ? cleanupManifest.savedReportIds.map((value) => String(value || "").trim()).filter(Boolean)
  : [];
requireCondition(
  ids.length > 0 && ids.length <= 20 && new Set(ids).size === ids.length,
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_scope_invalid"
);
requireCondition(
  ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_saved_report_id_invalid"
);

const supabaseUrl = String(process.env.PREMIUM_HOSTED_SUPABASE_URL || "").trim();
validateSupabasePublicConfig(supabaseUrl, manifest);
const accessToken = String(process.env.PREMIUM_HOSTED_ACCESS_TOKEN || "").trim();
const anonKey = String(process.env.PREMIUM_HOSTED_SUPABASE_ANON_KEY || "").trim();
requireCondition(accessToken && anonKey, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_supabase_config_missing");
const dbConfig = { accessToken, supabaseUrl, anonKey };
const user = await fetchAuthUser(dbConfig);
requireCondition(
  user.is_anonymous === false && hashIdentifier(user.id) === manifest.accountA.expectedUserIdHash,
  HOSTED_FAILURE_CATEGORIES.AUTH,
  "cleanup",
  "cleanup_account_mismatch"
);

for (const id of ids) {
  const row = await fetchSavedReportById(dbConfig, id);
  requireCondition(
    row?.id === id &&
      hashIdentifier(row.user_id) === manifest.accountA.expectedUserIdHash &&
      row.report_type === "premium" &&
      row.source_type === "premium_report_session",
    HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
    "cleanup",
    "cleanup_row_binding_invalid"
  );
}

let deletedCount = 0;
for (const id of ids) {
  const result = await deleteSavedReportById(dbConfig, id);
  requireCondition(
    result.length === 1 && result[0] === id,
    HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
    "cleanup",
    "cleanup_delete_failed"
  );
  deletedCount += 1;
}
await rm(config.securePaths.credentialsDir, { recursive: true, force: true });
console.log(JSON.stringify({
  status: "passed",
  deploymentId: attestation.vercelDeploymentId,
  deletedCount,
  cleanupManifestHash: actualManifestHash,
  credentialsRemoved: true
}, null, 2));
