import { createHash } from "node:crypto";


export const VERSION = "candidate-exposure-policy-hosted-execution-v1";
export const PRODUCT_RUNTIME_SHA = "1bc119347a2f8d3387a935163e24849ceebe349d";
export const APPROVAL_SCHEMA = "candidate-exposure-policy-hosted-approval-v1";
export const REFS_SCHEMA = "candidate-exposure-policy-hosted-deployment-refs-v1";
export const FIXTURE_SCHEMA = "candidate-exposure-policy-isolated-canary-fixture-manifest-v1";
export const TELEMETRY_SCHEMA = "candidate-exposure-policy-hosted-aggregate-v1";
export const EVIDENCE_SCHEMA = "candidate-exposure-policy-hosted-execution-evidence-v1";
export const OPERATIONS = Object.freeze([
  "manual_preview_provisioning",
  "approved_preview_probe",
  "temporary_protection_bypass",
  "mandatory_cleanup"
]);
export const LOCALES = Object.freeze(["ko", "en"]);
export const SCENARIOS = Object.freeze([
  "standard_goal_alignment",
  "stabilization_active_block",
  "current_product_semantics",
  "metadata_incomplete"
]);
export const MODES = Object.freeze(["control", "canary"]);
export const EXPOSURES = Object.freeze(["primary", "contextual", "collapsed", "hidden", "insufficient_evidence"]);
export const LANES = Object.freeze(["topPick", "supporting", "budget", "routine", "treatment"]);
export const DIVERGENCES = Object.freeze([
  "equivalent",
  "expected_canonical_evaluator_rebuild",
  "expected_canonical_goal_alignment",
  "expected_current_product_semantics",
  "expected_exposure_state_expansion",
  "expected_invalid_context_hardening",
  "unexpected_divergence"
]);
export const STOP_CONDITIONS = Object.freeze([
  "runtimeShaMismatch",
  "defaultOffShadowExecution",
  "unexpectedDivergence",
  "unclassifiedDivergence",
  "shadowException",
  "fallback",
  "invalidContext",
  "responseFingerprintMismatch",
  "snapshotFingerprintMismatch",
  "candidateOrderMismatch",
  "candidateLevelTelemetryDetected",
  "productionOrProjectConfigurationChange",
  "approvalMissing",
  "approvalExpired",
  "approvalTargetMismatch",
  "unapprovedOperation",
  "controlDeploymentMismatch",
  "canaryDeploymentMismatch",
  "requestBudgetExceeded",
  "timeBudgetExceeded",
  "protectionCleanupFailure",
  "evidenceSerializationFailure"
]);
export const DESIGN_REVIEW_RESOLUTIONS = Object.freeze({
  approvedSourceShaSeparatedFromProductRuntimeAuthority: true,
  approvalReceiptIsProcessAttestation: true,
  approvalWindowMinutes: 60,
  executionBudgetMinutes: 30,
  automaticPreviewDeployment: false,
  deploymentMutationInsideRunner: false,
  automaticRetry: false,
  githubActionsRequired: false
});

export const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]{8,128}$/;
const APPROVAL_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/;
const BRANCH_NAME = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._/-]{1,200}$/;
export const FORBIDDEN_ADAPTER_KEYS = new Set(["deploy", "redeploy", "promote", "createDeployment", "updateProjectEnvironment", "updateBranchEnvironment", "setProductionAlias"]);
const FORBIDDEN_KEYS = new Set(["candidateref", "candidateid", "productid", "productname", "brand", "producturl", "userid", "accountid", "email", "sessionid", "reportid", "cookie", "token", "secret", "approvalreceipt", "deploymenturl", "rawrequest", "rawresponse", "providerprompt", "provideroutput", "orderedexposurevector", "reasoncodecounts"]);
export const TELEMETRY_FIELDS = Object.freeze([
  "schemaVersion", "planVersion", "approvalIdHash", "runtimeImplementationShaMatch",
  "fixtureScenario", "fixtureSemanticFingerprint", "locale", "mode", "executionStatus",
  "candidateCount", "exposureCounts", "laneEligibilityCounts", "divergenceCategoryCounts",
  "responseFingerprintMatch", "snapshotFingerprintMatch", "candidateOrderMatch",
  "projectionFingerprintPresent", "unexpectedDivergenceCount", "unclassifiedDivergenceCount",
  "shadowExceptionCount", "fallbackCount", "invalidContextCount", "stopCondition"
]);

export const sortObject = (value) => Array.isArray(value)
  ? value.map(sortObject)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]))
    : value;
export const stable = (value) => JSON.stringify(sortObject(value));
export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const nonNegative = (value) => Number.isInteger(value) && value >= 0;
const exactArray = (value, expected) => Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
export const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
export const validCountMap = (value, keys) => exactKeys(value, keys) && Object.values(value).every(nonNegative);
export const sum = (value) => Object.values(value || {}).reduce((total, count) => total + count, 0);
const normalizedKey = (key) => String(key || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
export const hasForbiddenKey = (value) => value && typeof value === "object" && Object.entries(value).some(([key, nested]) => FORBIDDEN_KEYS.has(normalizedKey(key)) || hasForbiddenKey(nested));
export const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};
export const validIso = (value) => {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const offset = match[8] === "Z"
    ? 0
    : (match[8][0] === "+" ? 1 : -1) * (Number(match[8].slice(1, 3)) * 60 + Number(match[8].slice(4, 6)));
  if (Math.abs(offset) > 14 * 60) return false;
  const local = new Date(parsed + offset * 60_000);
  return local.getUTCFullYear() === Number(match[1]) &&
    local.getUTCMonth() + 1 === Number(match[2]) &&
    local.getUTCDate() === Number(match[3]) &&
    local.getUTCHours() === Number(match[4]) &&
    local.getUTCMinutes() === Number(match[5]) &&
    local.getUTCSeconds() === Number(match[6]) &&
    local.getUTCMilliseconds() === Number(match[7] || 0);
};
export const unique = (values) => [...new Set(values)].sort();
export const stopMap = () => Object.fromEntries(STOP_CONDITIONS.map((key) => [key, true]));

export function validateStopConditions(value) {
  return exactKeys(value, STOP_CONDITIONS) && STOP_CONDITIONS.every((key) => value[key] === true);
}

export function validateApproval(receipt, { now = new Date() } = {}) {
  const errors = [];
  const keys = ["schemaVersion", "approvalId", "approvedAt", "expiresAt", "targetBranch", "approvedSourceSha", "productRuntimeAuthoritySha", "allowedOperations", "maxPreviewDeployments", "maxAnalyzeRequests", "productionAllowed"];
  if (!exactKeys(receipt, keys)) errors.push("field_set");
  if (receipt?.schemaVersion !== APPROVAL_SCHEMA) errors.push("schema");
  if (!APPROVAL_ID.test(String(receipt?.approvalId || ""))) errors.push("approval_id");
  if (!validIso(receipt?.approvedAt) || !validIso(receipt?.expiresAt)) errors.push("timestamp");
  if (receipt?.targetBranch !== null && !BRANCH_NAME.test(String(receipt?.targetBranch || ""))) errors.push("target_branch");
  if (!SHA40.test(String(receipt?.approvedSourceSha || ""))) errors.push("source_sha");
  if (receipt?.productRuntimeAuthoritySha !== PRODUCT_RUNTIME_SHA) errors.push("runtime_sha");
  if (!exactArray(receipt?.allowedOperations, OPERATIONS)) errors.push("operations");
  if (receipt?.maxPreviewDeployments !== 2 || receipt?.maxAnalyzeRequests !== 16) errors.push("budget");
  if (receipt?.productionAllowed !== false) errors.push("production");
  const approvedAt = Date.parse(receipt?.approvedAt);
  const expiresAt = Date.parse(receipt?.expiresAt);
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  if (Number.isFinite(approvedAt) && Number.isFinite(expiresAt)) {
    if (expiresAt <= approvedAt || expiresAt - approvedAt > 3_600_000) errors.push("window");
    if (Number.isFinite(nowMs) && (nowMs < approvedAt || nowMs >= expiresAt)) errors.push("expired");
  }
  if (hasForbiddenKey(receipt)) errors.push("forbidden_key");
  return deepFreeze({ valid: errors.length === 0, errors: unique(errors), approvalIdHash: receipt?.approvalId ? sha256(receipt.approvalId) : null, receiptDigest: receipt ? sha256(stable(receipt)) : null });
}

export function validateDeploymentRefs(refs, receipt) {
  const errors = [];
  const keys = ["schemaVersion", "approvedSourceSha", "productRuntimeAuthoritySha", "controlDeploymentId", "canaryDeploymentId"];
  if (!exactKeys(refs, keys)) errors.push("field_set");
  if (refs?.schemaVersion !== REFS_SCHEMA) errors.push("schema");
  if (refs?.approvedSourceSha !== receipt?.approvedSourceSha || !SHA40.test(String(refs?.approvedSourceSha || ""))) errors.push("source_sha");
  if (refs?.productRuntimeAuthoritySha !== PRODUCT_RUNTIME_SHA || refs?.productRuntimeAuthoritySha !== receipt?.productRuntimeAuthoritySha) errors.push("runtime_sha");
  if (!DEPLOYMENT_ID.test(String(refs?.controlDeploymentId || "")) || !DEPLOYMENT_ID.test(String(refs?.canaryDeploymentId || ""))) errors.push("deployment_id");
  if (refs?.controlDeploymentId === refs?.canaryDeploymentId) errors.push("same_deployment");
  if (hasForbiddenKey(refs)) errors.push("forbidden_key");
  return deepFreeze({ valid: errors.length === 0, errors: unique(errors) });
}

export function validateRuntimeAttestation(value) {
  return exactKeys(value, ["schemaVersion", "productRuntimeAuthoritySha", "closureFileCount", "changedRuntimeFileCount", "match"]) &&
    value.schemaVersion === "candidate-exposure-policy-runtime-closure-attestation-v1" &&
    value.productRuntimeAuthoritySha === PRODUCT_RUNTIME_SHA && value.closureFileCount === 16 &&
    value.changedRuntimeFileCount === 0 && value.match === true;
}

export function validateFixtureManifest(manifest) {
  const errors = [];
  if (!exactKeys(manifest, ["schemaVersion", "runtimeImplementationSha", "actualUserData", "scenarios"])) errors.push("field_set");
  if (manifest?.schemaVersion !== FIXTURE_SCHEMA || manifest?.runtimeImplementationSha !== PRODUCT_RUNTIME_SHA || manifest?.actualUserData !== false) errors.push("authority");
  const names = Array.isArray(manifest?.scenarios) ? manifest.scenarios.map((entry) => entry?.scenario) : [];
  if (!exactArray(names, SCENARIOS)) errors.push("scenario_order");
  const fingerprints = {};
  for (const entry of Array.isArray(manifest?.scenarios) ? manifest.scenarios : []) {
    if (!exactKeys(entry, ["scenario", "semanticVersion", "expectedReasonCodes", "canonicalState", "candidates"])) errors.push(`shape:${entry?.scenario || "unknown"}`);
    if (!SCENARIOS.includes(entry?.scenario) || typeof entry?.semanticVersion !== "string" || !entry.semanticVersion || !Array.isArray(entry?.expectedReasonCodes) || !entry?.canonicalState || !Array.isArray(entry?.candidates) || entry.candidates.length < 1) errors.push(`payload:${entry?.scenario || "unknown"}`);
    if (entry?.scenario) fingerprints[entry.scenario] = sha256(stable(entry));
  }
  return deepFreeze({ valid: errors.length === 0, errors: unique(errors), fingerprints });
}
