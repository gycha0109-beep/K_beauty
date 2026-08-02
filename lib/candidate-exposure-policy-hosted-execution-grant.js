import {
  PRODUCT_RUNTIME_SHA,
  deepFreeze,
  exactKeys,
  hasForbiddenKey,
  sha256,
  stable,
  unique,
  validIso,
  validateApproval,
  validateDeploymentRefs
} from "./candidate-exposure-policy-hosted-execution-contract.js";

export const EXECUTION_GRANT_SCHEMA =
  "candidate-exposure-policy-hosted-execution-grant-v2";
export const EXECUTION_GRANT_OPERATIONS = Object.freeze([
  "approved_deployment_metadata_read",
  "approved_preview_probe",
  "memory_only_access_material_use",
  "mandatory_local_cleanup"
]);

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;
const IDENTITY = /^[A-Za-z0-9_-]{3,160}$/;
const GRANT_KEYS = Object.freeze([
  "schemaVersion",
  "approvalIdHash",
  "provisioningReceiptDigest",
  "issuedAt",
  "expiresAt",
  "approvedSourceSha",
  "approvedProjectId",
  "approvedTeamId",
  "productRuntimeAuthoritySha",
  "controlDeploymentId",
  "canaryDeploymentId",
  "allowedOperations",
  "maxDeploymentMetadataReads",
  "maxAnalyzeRequests",
  "runtimeLogReadsAllowed",
  "productionAllowed"
]);

function exactArray(value, expected) {
  return Array.isArray(value) &&
    value.length === expected.length &&
    value.every((entry, index) => entry === expected[index]);
}

function parseNow(value) {
  if (value instanceof Date) return value.getTime();
  return Date.parse(value);
}

export function validateExecutionGrant(grant, { now = new Date() } = {}) {
  const errors = [];

  if (!exactKeys(grant, GRANT_KEYS)) errors.push("field_set");
  if (grant?.schemaVersion !== EXECUTION_GRANT_SCHEMA) errors.push("schema");
  if (!SHA256.test(String(grant?.approvalIdHash || ""))) errors.push("approval_hash");
  if (!SHA256.test(String(grant?.provisioningReceiptDigest || ""))) errors.push("receipt_digest");
  if (!validIso(grant?.issuedAt) || !validIso(grant?.expiresAt)) errors.push("timestamp");
  if (!SHA40.test(String(grant?.approvedSourceSha || ""))) errors.push("source_sha");
  if (!IDENTITY.test(String(grant?.approvedProjectId || ""))) errors.push("project_identity");
  if (grant?.approvedTeamId !== null &&
      !IDENTITY.test(String(grant?.approvedTeamId || ""))) errors.push("team_identity");
  if (grant?.productRuntimeAuthoritySha !== PRODUCT_RUNTIME_SHA) errors.push("runtime_sha");
  if (!DEPLOYMENT_ID.test(String(grant?.controlDeploymentId || "")) ||
      !DEPLOYMENT_ID.test(String(grant?.canaryDeploymentId || ""))) {
    errors.push("deployment_id");
  }
  if (grant?.controlDeploymentId === grant?.canaryDeploymentId) errors.push("same_deployment");
  if (!exactArray(grant?.allowedOperations, EXECUTION_GRANT_OPERATIONS)) errors.push("operations");
  if (grant?.maxDeploymentMetadataReads !== 2 || grant?.maxAnalyzeRequests !== 16) {
    errors.push("budget");
  }
  if (grant?.runtimeLogReadsAllowed !== false) errors.push("runtime_logs");
  if (grant?.productionAllowed !== false) errors.push("production");
  if (hasForbiddenKey(grant)) errors.push("forbidden_key");

  const issuedAt = Date.parse(grant?.issuedAt);
  const expiresAt = Date.parse(grant?.expiresAt);
  const nowMs = parseNow(now);
  if (Number.isFinite(issuedAt) && Number.isFinite(expiresAt)) {
    if (expiresAt <= issuedAt || expiresAt - issuedAt > 3_600_000) errors.push("window");
    if (Number.isFinite(nowMs) && (nowMs < issuedAt || nowMs >= expiresAt)) {
      errors.push("expired");
    }
  }

  return deepFreeze({
    valid: errors.length === 0,
    errors: unique(errors),
    grantDigest: grant ? sha256(stable(grant)) : null
  });
}

export function deriveExecutionGrant({
  receipt,
  deploymentRefs,
  issuedAt,
  expiresAt,
  approvedProjectId,
  approvedTeamId = null,
  now = issuedAt
} = {}) {
  const approval = validateApproval(receipt, { now });
  const refs = validateDeploymentRefs(deploymentRefs, receipt);
  if (!approval.valid || !refs.valid) {
    return deepFreeze({
      valid: false,
      errors: unique([
        ...(approval.valid ? [] : approval.errors.map((error) => `approval:${error}`)),
        ...(refs.valid ? [] : refs.errors.map((error) => `refs:${error}`))
      ]),
      grant: null,
      grantDigest: null
    });
  }

  const authorityErrors = [];
  const receiptApprovedAt = Date.parse(receipt?.approvedAt);
  const receiptExpiresAt = Date.parse(receipt?.expiresAt);
  const grantIssuedAt = Date.parse(issuedAt);
  const grantExpiresAt = Date.parse(expiresAt);
  if (!IDENTITY.test(String(approvedProjectId || ""))) authorityErrors.push("project_identity");
  if (approvedTeamId !== null &&
      !IDENTITY.test(String(approvedTeamId || ""))) authorityErrors.push("team_identity");
  if (Number.isFinite(receiptApprovedAt) && Number.isFinite(grantIssuedAt) &&
      grantIssuedAt < receiptApprovedAt) authorityErrors.push("issued_before_approval");
  if (Number.isFinite(receiptExpiresAt) && Number.isFinite(grantExpiresAt) &&
      grantExpiresAt > receiptExpiresAt) authorityErrors.push("extends_approval_window");
  if (authorityErrors.length) {
    return deepFreeze({
      valid: false,
      errors: unique(authorityErrors),
      grant: null,
      grantDigest: null
    });
  }

  const grant = {
    schemaVersion: EXECUTION_GRANT_SCHEMA,
    approvalIdHash: approval.approvalIdHash,
    provisioningReceiptDigest: approval.receiptDigest,
    issuedAt,
    expiresAt,
    approvedSourceSha: receipt.approvedSourceSha,
    approvedProjectId,
    approvedTeamId,
    productRuntimeAuthoritySha: PRODUCT_RUNTIME_SHA,
    controlDeploymentId: deploymentRefs.controlDeploymentId,
    canaryDeploymentId: deploymentRefs.canaryDeploymentId,
    allowedOperations: [...EXECUTION_GRANT_OPERATIONS],
    maxDeploymentMetadataReads: 2,
    maxAnalyzeRequests: 16,
    runtimeLogReadsAllowed: false,
    productionAllowed: false
  };
  const review = validateExecutionGrant(grant, { now });

  return deepFreeze({
    valid: review.valid,
    errors: review.errors,
    grant: review.valid ? deepFreeze(grant) : null,
    grantDigest: review.grantDigest
  });
}
