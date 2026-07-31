import { rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES,
  PRODUCTION_CONFIRMATION,
  deletePremiumReportSessionById,
  deleteSavedReportById,
  fetchAuthUser,
  fetchPremiumReportSessionById,
  fetchSavedReportById,
  hashIdentifier,
  loadJsonFile,
  normalizeBaseUrl,
  requireCondition,
  validateEnvironmentGuard
} from "./premium-browser-journey-core.mjs";

const artifactDirValue = String(process.env.PREMIUM_E2E_ARTIFACT_DIR || "").trim();
const accessToken = String(process.env.PREMIUM_E2E_ACCESS_TOKEN || "").trim();
const supabaseUrl = String(process.env.PREMIUM_E2E_SUPABASE_URL || "").trim();
const anonKey = String(process.env.PREMIUM_E2E_SUPABASE_ANON_KEY || "").trim();
const serviceRoleKey = String(process.env.PREMIUM_E2E_SERVICE_ROLE_KEY || "").trim();
const baseUrl = normalizeBaseUrl(process.env.PREMIUM_E2E_BASE_URL);
const environment = String(process.env.PREMIUM_E2E_ENVIRONMENT || "").trim();
const expectedHost = String(process.env.PREMIUM_E2E_EXPECTED_HOST || "").trim();
const expectedSha = String(process.env.PREMIUM_E2E_EXPECTED_SHA || "").trim();

requireCondition(artifactDirValue, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "artifact_dir_missing");
requireCondition(accessToken && supabaseUrl && anonKey, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_credentials_missing");
requireCondition(
  process.env.PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION === DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "dedicated_test_account_not_confirmed"
);

const artifactDir = resolve(artifactDirValue);
const [manifest, persistence, cleanupScope] = await Promise.all([
  loadJsonFile(resolve(artifactDir, "run-manifest.json"), "run_manifest"),
  loadJsonFile(resolve(artifactDir, "persistence-evidence.json"), "persistence_evidence"),
  loadJsonFile(resolve(artifactDir, "cleanup-scope.json"), "cleanup_scope")
]);
requireCondition(manifest.targetHost === baseUrl.hostname, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_target_host_mismatch");
requireCondition(manifest.environment === environment, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_environment_mismatch");
validateEnvironmentGuard({
  baseUrl,
  environment,
  expectedHost,
  expectedSha,
  deploymentSha: String(manifest.targetGitSha || ""),
  productionConfirmation: process.env.PREMIUM_E2E_ALLOW_PRODUCTION
});
requireCondition(
  process.env.PREMIUM_E2E_CLEANUP_CONFIRM === `DELETE_TEST_REPORTS_${manifest.runId}`,
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_confirmation_missing"
);

const config = { supabaseUrl, anonKey, accessToken };
const user = await fetchAuthUser(config);
const accountHash = hashIdentifier(user.id);
requireCondition(accountHash === manifest.accountHash, FAILURE_CATEGORIES.AUTH, "cleanup", "cleanup_account_mismatch");

const ids = Array.isArray(persistence.createdSavedReportIds)
  ? [...new Set(persistence.createdSavedReportIds)]
  : [];
requireCondition(
  cleanupScope?.schemaVersion === "premium-run-cleanup-scope-v1" &&
    cleanupScope?.runId === manifest.runId,
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_scope_binding_invalid"
);
const premiumSessionIds = Array.isArray(cleanupScope.premiumSessionIds)
  ? [...new Set(cleanupScope.premiumSessionIds)]
  : [];
requireCondition(
  ids.length > 0 || premiumSessionIds.length > 0,
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "no_cleanup_ids"
);
requireCondition(
  premiumSessionIds.length === 0 || serviceRoleKey,
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "premium_session_cleanup_credentials_missing"
);
requireCondition(
  JSON.stringify(cleanupScope.createdSavedReportIds || []) ===
    JSON.stringify(ids),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "saved_report_cleanup_scope_mismatch"
);
requireCondition(
  premiumSessionIds.every((id) => /^[A-Za-z0-9_-]{16,64}$/.test(id)),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "invalid_premium_session_cleanup_id"
);
requireCondition(
  persistence.knownPremiumSessionCount === premiumSessionIds.length &&
    JSON.stringify(persistence.knownPremiumSessionHashes) ===
      JSON.stringify(premiumSessionIds.map(hashIdentifier)),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "premium_session_cleanup_scope_mismatch"
);
requireCondition(
  ids.every((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)),
  FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "invalid_cleanup_id"
);

const records = Array.isArray(persistence.records) ? persistence.records : [];
const recordById = new Map(
  records
    .filter((record) => record && typeof record.savedReportId === "string")
    .map((record) => [record.savedReportId, record])
);
if (persistence.evidenceQuarantined !== true) {
  requireCondition(
    recordById.size === ids.length && ids.every((id) => recordById.has(id)),
    FAILURE_CATEGORIES.PRECONDITION,
    "cleanup",
    "cleanup_artifact_record_mismatch"
  );
}

const deleted = [];
for (const id of ids) {
  const existing = await fetchSavedReportById(config, id);
  requireCondition(existing?.user_id === user.id, FAILURE_CATEGORIES.AUTH, "cleanup", "cleanup_row_owner_mismatch");
  requireCondition(
    existing?.report_type === "premium" && existing?.source_type === "premium_report_session",
    FAILURE_CATEGORIES.PRECONDITION,
    "cleanup",
    "cleanup_row_not_test_premium_session"
  );
  const record = recordById.get(id) || null;
  if (record) {
    requireCondition(record.sourceType === existing.source_type, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_source_type_mismatch");
    requireCondition(
      record.sourceSessionHash === hashIdentifier(existing.source_session_id),
      FAILURE_CATEGORIES.PRECONDITION,
      "cleanup",
      "cleanup_source_session_mismatch"
    );
    requireCondition(record.createdAt === existing.created_at, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_created_at_mismatch");
    requireCondition(record.updatedAt === existing.updated_at, FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_updated_at_mismatch");
  }
  const removedIds = await deleteSavedReportById(config, id);
  requireCondition(removedIds.includes(id), FAILURE_CATEGORIES.PERSISTENCE, "cleanup", "cleanup_delete_failed");
  requireCondition(await fetchSavedReportById(config, id) === null, FAILURE_CATEGORIES.PERSISTENCE, "cleanup", "cleanup_delete_not_observed");
  deleted.push(id);
}

const serviceConfig = { supabaseUrl, serviceRoleKey };
const deletedPremiumSessionIds = [];
for (const sessionId of premiumSessionIds) {
  const existing = await fetchPremiumReportSessionById(serviceConfig, sessionId);
  requireCondition(
    existing?.session_id === sessionId,
    FAILURE_CATEGORIES.PERSISTENCE,
    "session-cleanup",
    "premium_session_not_found"
  );
  const removedIds = await deletePremiumReportSessionById(serviceConfig, sessionId);
  requireCondition(
    removedIds.length === 1 && removedIds[0] === sessionId,
    FAILURE_CATEGORIES.PERSISTENCE,
    "session-cleanup",
    "premium_session_cleanup_delete_failed"
  );
  requireCondition(
    await fetchPremiumReportSessionById(serviceConfig, sessionId) === null,
    FAILURE_CATEGORIES.PERSISTENCE,
    "session-cleanup",
    "premium_session_cleanup_residue"
  );
  deletedPremiumSessionIds.push(sessionId);
}

const result = {
  runId: manifest.runId,
  targetHost: manifest.targetHost,
  accountHash,
  deletedSavedReportHashes: deleted.map(hashIdentifier),
  deletedSavedReportCount: deleted.length,
  deletedPremiumSessionHashes: deletedPremiumSessionIds.map(hashIdentifier),
  deletedPremiumSessionCount: deletedPremiumSessionIds.length,
  savedReportResidue: 0,
  premiumSessionResidue: 0,
  completedAt: new Date().toISOString()
};
await writeFile(resolve(artifactDir, "cleanup-result.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
await rm(resolve(artifactDir, "cleanup-scope.json"), { force: true });
console.log(
  JSON.stringify(
    {
      ok: true,
      runId: manifest.runId,
      deletedSavedReportCount: deleted.length,
      deletedPremiumSessionCount: deletedPremiumSessionIds.length,
      savedReportResidue: 0,
      premiumSessionResidue: 0
    },
    null,
    2
  )
);
