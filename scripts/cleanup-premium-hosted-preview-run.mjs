import { readFile, rm } from "node:fs/promises";
import {
  deleteSavedReportById,
  fetchAuthUser,
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
import { assertPathInside } from "./premium-hosted-preview-security.mjs";

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

const evidencePathInput = String(process.env.PREMIUM_HOSTED_CLEANUP_EVIDENCE_PATH || "").trim();
requireCondition(evidencePathInput, HOSTED_FAILURE_CATEGORIES.PRECONDITION, "cleanup", "cleanup_evidence_missing");
const evidencePath = assertPathInside(config.securePaths.artifactsDir, evidencePathInput, "cleanup_evidence_outside_artifact_root");
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
requireCondition(
  evidence.status === "passed" &&
    evidence.deploymentId === attestation.vercelDeploymentId &&
    evidence.deploymentSha === attestation.prHeadSha,
  HOSTED_FAILURE_CATEGORIES.PREVIEW_ATTESTATION,
  "cleanup",
  "cleanup_evidence_deployment_mismatch"
);
const rows = Array.isArray(evidence.rows) ? evidence.rows : [];
const ids = rows.map((row) => row?.savedReportId).filter(Boolean);
requireCondition(
  ids.length > 0 && ids.length <= 20 && new Set(ids).size === ids.length,
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_scope_invalid"
);
requireCondition(
  rows.every((row) => row.ownerMatches === true && row.sourceType === "premium_report_session" && row.sourceSessionHash),
  HOSTED_FAILURE_CATEGORIES.PRECONDITION,
  "cleanup",
  "cleanup_evidence_row_invalid"
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

const deleted = [];
for (const id of ids) {
  const result = await deleteSavedReportById(dbConfig, id);
  requireCondition(
    result.length === 1 && result[0] === id,
    HOSTED_FAILURE_CATEGORIES.PERSISTENCE,
    "cleanup",
    "cleanup_delete_failed"
  );
  deleted.push(id);
}
await rm(config.securePaths.credentialsDir, { recursive: true, force: true });
console.log(JSON.stringify({
  status: "passed",
  deploymentId: attestation.vercelDeploymentId,
  deletedCount: deleted.length,
  credentialsRemoved: true
}, null, 2));
