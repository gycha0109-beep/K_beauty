import { createHash } from "node:crypto";

export const HOSTED_CANONICAL_SCHEMA_VERSION = "premium-hosted-canonical-v1";
export const HOSTED_SEMANTIC_FINGERPRINT_VERSION = "premium-hosted-semantic-v1";
export const HOSTED_EVIDENCE_STATE_VERSION = "premium-hosted-evidence-state-v1";
export const HOSTED_UI_FIXTURE_VERSION = "premium-hosted-ui-case-v2";
export const HOSTED_ATTESTATION_VERSION = "premium-hosted-attestation-v1";

export class HostedContractError extends Error {
  constructor(code, detail = null) {
    super(code);
    this.name = "HostedContractError";
    this.code = code;
    this.detail = detail;
  }
}

function fail(code, detail = null) {
  throw new HostedContractError(code, detail);
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireRecord(value, code) {
  if (!isRecord(value)) fail(code);
  return value;
}

function requireString(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value.trim();
}

function requireEnum(value, allowed, code) {
  const normalized = requireString(value, code);
  if (!allowed.has(normalized)) fail(code, normalized);
  return normalized;
}

function scalarIdentifier(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export function normalizeReasonCodes(value, fieldName) {
  if (!Array.isArray(value)) fail("canonical_reason_codes_not_array", fieldName);
  const normalized = value.map((item) => {
    if (typeof item !== "string" || !item.trim()) fail("canonical_reason_code_invalid", fieldName);
    return item.trim();
  });
  if (new Set(normalized).size !== normalized.length) fail("canonical_reason_code_duplicate", fieldName);
  return [...normalized].sort();
}

function normalizeProductActions(value) {
  if (!Array.isArray(value)) fail("canonical_product_actions_not_array");
  const normalized = value.map((item, index) => {
    const row = requireRecord(item, "canonical_product_action_invalid");
    const productId = row.productId == null ? null : scalarIdentifier(row.productId);
    if (row.productId != null && productId == null) fail("canonical_product_action_product_id_invalid", index);
    const slotKey = row.slotKey == null ? null : requireString(String(row.slotKey), "canonical_product_action_slot_invalid");
    const sourceState = requireString(row.sourceState, "canonical_product_action_source_state_missing");
    const action = requireString(row.action, "canonical_product_action_action_missing");
    const reasonCodes = normalizeReasonCodes(row.reasonCodes || [], `productActions[${index}].reasonCodes`);
    return { productId, slotKey, sourceState, action, reasonCodes };
  });
  return normalized.sort((left, right) => stableStringify(left).localeCompare(stableStringify(right)));
}

export function resolveTopPickIdentity(freeResult) {
  const topPick = isRecord(freeResult) ? freeResult.topPick : null;
  if (topPick == null) return { topPickPresence: "absent", topPickProductId: null };
  if (!isRecord(topPick)) fail("canonical_top_pick_invalid");
  const values = [topPick.id, topPick.productId, topPick.product_id]
    .map(scalarIdentifier)
    .filter(Boolean);
  if (!values.length) fail("canonical_top_pick_id_missing");
  const unique = [...new Set(values)];
  if (unique.length !== 1) fail("canonical_top_pick_id_conflict");
  return { topPickPresence: "present", topPickProductId: unique[0] };
}

export function deriveEvidenceStateV1(canonical) {
  const statuses = [canonical.functionalStatus, canonical.routineStatus, canonical.conditionStatus];
  if (canonical.consistencyVerdict === "insufficient_context" || statuses.includes("insufficient_context")) {
    return "insufficient_context";
  }
  const confidences = [canonical.routineConfidence, canonical.conditionConfidence, canonical.consistencyConfidence];
  const partialProduct = canonical.productActions.some((item) =>
    ["not_in_db", "unanswered"].includes(item.sourceState) || item.action === "check_needed"
  );
  if (statuses.includes("partial") || confidences.some((value) => value !== "high") || partialProduct) {
    return "partial";
  }
  return "complete";
}

function stableNormalize(value) {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableNormalize(value[key])])
  );
}

export function stableStringify(value) {
  return JSON.stringify(stableNormalize(value));
}

export function buildSemanticFingerprintV1(canonical) {
  const payload = {
    version: HOSTED_SEMANTIC_FINGERPRINT_VERSION,
    bundleVersion: canonical.bundleVersion,
    functionalStatus: canonical.functionalStatus,
    functionalReasonCodes: canonical.functionalReasonCodes,
    routineStatus: canonical.routineStatus,
    routineReasonCodes: canonical.routineReasonCodes,
    routineConfidence: canonical.routineConfidence,
    conditionStatus: canonical.conditionStatus,
    conditionReasonCodes: canonical.conditionReasonCodes,
    conditionConfidence: canonical.conditionConfidence,
    consistencyVerdict: canonical.consistencyVerdict,
    consistencyReasonCodes: canonical.consistencyReasonCodes,
    consistencyConfidence: canonical.consistencyConfidence,
    effectivePolicySource: canonical.effectivePolicySource,
    productActions: canonical.productActions,
    topPickPresence: canonical.topPickPresence,
    topPickProductId: canonical.topPickProductId,
    evidenceState: canonical.evidenceState,
    catalogHash: canonical.catalogHash ?? null
  };
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function projectHostedCanonicalEvidence(body, options = {}) {
  const report = requireRecord(body, "canonical_report_invalid");
  const bundle = requireRecord(report.decisionBundle, "canonical_decision_bundle_missing");
  const functional = requireRecord(bundle.functionalPolicy, "canonical_functional_policy_missing");
  const routine = requireRecord(bundle.routinePolicy, "canonical_routine_policy_missing");
  const condition = requireRecord(bundle.conditionPolicy, "canonical_condition_policy_missing");
  const consistency = requireRecord(bundle.consistency, "canonical_consistency_missing");
  const canonical = {
    schemaVersion: HOSTED_CANONICAL_SCHEMA_VERSION,
    bundleVersion: requireString(bundle.version, "canonical_bundle_version_missing"),
    functionalStatus: requireString(functional.status, "canonical_functional_status_missing"),
    functionalReasonCodes: normalizeReasonCodes(functional.reasonCodes, "functionalReasonCodes"),
    routineStatus: requireString(routine.status, "canonical_routine_status_missing"),
    routineReasonCodes: normalizeReasonCodes(routine.reasonCodes, "routineReasonCodes"),
    routineConfidence: requireEnum(routine.confidence, new Set(["low", "medium", "high"]), "canonical_routine_confidence_invalid"),
    conditionStatus: requireString(condition.status, "canonical_condition_status_missing"),
    conditionReasonCodes: normalizeReasonCodes(condition.reasonCodes, "conditionReasonCodes"),
    conditionConfidence: requireEnum(condition.confidence, new Set(["low", "medium", "high"]), "canonical_condition_confidence_invalid"),
    consistencyVerdict: requireString(consistency.verdict, "canonical_consistency_verdict_missing"),
    consistencyReasonCodes: normalizeReasonCodes(consistency.reasonCodes, "consistencyReasonCodes"),
    consistencyConfidence: requireEnum(consistency.confidence, new Set(["low", "medium", "high"]), "canonical_consistency_confidence_invalid"),
    effectivePolicySource: requireString(bundle.effectivePolicySource, "canonical_effective_policy_source_missing"),
    productActions: normalizeProductActions(routine.productActions),
    locale: requireEnum(bundle.locale, new Set(["ko", "en"]), "canonical_locale_invalid"),
    immutableFingerprint: requireString(options.immutableFingerprint ?? report.meta?.snapshot?.fingerprint, "canonical_immutable_fingerprint_missing"),
    catalogHash: options.catalogHash ?? null,
    ...resolveTopPickIdentity(report.freeResult)
  };
  if (!/^[0-9a-f]{64}$/i.test(canonical.immutableFingerprint)) fail("canonical_immutable_fingerprint_invalid");
  if (canonical.catalogHash != null && !/^[0-9a-f]{64}$/i.test(String(canonical.catalogHash))) fail("canonical_catalog_hash_invalid");
  canonical.evidenceStateVersion = HOSTED_EVIDENCE_STATE_VERSION;
  canonical.evidenceState = deriveEvidenceStateV1(canonical);
  canonical.semanticFingerprintVersion = HOSTED_SEMANTIC_FINGERPRINT_VERSION;
  canonical.semanticFingerprint = buildSemanticFingerprintV1(canonical);
  return canonical;
}

const SEMANTIC_KEYS = Object.freeze([
  "bundleVersion",
  "functionalStatus",
  "functionalReasonCodes",
  "routineStatus",
  "routineReasonCodes",
  "routineConfidence",
  "conditionStatus",
  "conditionReasonCodes",
  "conditionConfidence",
  "consistencyVerdict",
  "consistencyReasonCodes",
  "consistencyConfidence",
  "effectivePolicySource",
  "productActions",
  "topPickPresence",
  "topPickProductId",
  "evidenceState",
  "catalogHash"
]);

export function compareHostedLocaleSemantics(ko, en) {
  const mismatches = SEMANTIC_KEYS.filter((key) => stableStringify(ko?.[key] ?? null) !== stableStringify(en?.[key] ?? null));
  const fingerprintMismatch = ko?.semanticFingerprint !== en?.semanticFingerprint;
  if (fingerprintMismatch && !mismatches.includes("semanticFingerprint")) mismatches.push("semanticFingerprint");
  return { passed: mismatches.length === 0, mismatches };
}

function validateRelativePath(value) {
  const path = requireString(value, "fixture_start_path_missing");
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    fail("fixture_start_path_invalid_encoding");
  }
  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("://")) fail("fixture_start_path_external");
  if (decoded.split("/").includes("..")) fail("fixture_start_path_traversal");
  return decoded;
}

function rejectUnknownKeys(value, allowed, code) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(code, key);
  }
}

const ACTION_SCHEMAS = Object.freeze({
  fillByLabel: new Set(["type", "label", "value"]),
  clickByRole: new Set(["type", "role", "name"]),
  checkByLabel: new Set(["type", "label"]),
  selectByLabel: new Set(["type", "label", "value"]),
  uploadByLabel: new Set(["type", "label", "path"]),
  waitForVisibleText: new Set(["type", "text"]),
  expectHeading: new Set(["type", "name"])
});

export function validateHostedUiCaseFixture(value) {
  const fixture = requireRecord(value, "fixture_invalid");
  rejectUnknownKeys(
    fixture,
    new Set(["schemaVersion", "startPath", "actions", "resultMarker", "timeoutMs", "catalogHash"]),
    "fixture_unknown_field"
  );
  if (fixture.schemaVersion !== HOSTED_UI_FIXTURE_VERSION) fail("fixture_schema_version_invalid");
  const startPath = validateRelativePath(fixture.startPath);
  if (!Array.isArray(fixture.actions) || !fixture.actions.length) fail("fixture_actions_missing");
  const actions = fixture.actions.map((action, index) => {
    const row = requireRecord(action, "fixture_action_invalid");
    const allowed = ACTION_SCHEMAS[row.type];
    if (!allowed) fail("fixture_action_type_invalid", row.type);
    rejectUnknownKeys(row, allowed, "fixture_action_unknown_field");
    if (["fillByLabel", "checkByLabel", "selectByLabel", "uploadByLabel"].includes(row.type)) requireString(row.label, `fixture_action_label_missing_${index}`);
    if (row.type === "clickByRole") {
      requireString(row.role, `fixture_action_role_missing_${index}`);
      requireString(row.name, `fixture_action_name_missing_${index}`);
    }
    if (["waitForVisibleText"].includes(row.type)) requireString(row.text, `fixture_action_text_missing_${index}`);
    if (row.type === "expectHeading") requireString(row.name, `fixture_action_heading_missing_${index}`);
    if (row.type === "uploadByLabel") {
      const uploadPath = requireString(row.path, `fixture_action_upload_path_missing_${index}`);
      if (uploadPath.includes("..") || uploadPath.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(uploadPath)) fail("fixture_upload_path_unsafe", index);
    }
    return { ...row };
  });
  const marker = requireRecord(fixture.resultMarker, "fixture_result_marker_missing");
  rejectUnknownKeys(marker, new Set(["kind", "name", "role"]), "fixture_result_marker_unknown_field");
  if (!new Set(["heading", "text", "role"]).has(marker.kind)) fail("fixture_result_marker_kind_invalid");
  requireString(marker.name, "fixture_result_marker_name_missing");
  if (marker.kind === "role") requireString(marker.role, "fixture_result_marker_role_missing");
  const timeoutMs = fixture.timeoutMs == null ? 120000 : Number(fixture.timeoutMs);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) fail("fixture_timeout_invalid");
  if (fixture.catalogHash != null && !/^[0-9a-f]{64}$/i.test(String(fixture.catalogHash))) fail("fixture_catalog_hash_invalid");
  return { schemaVersion: fixture.schemaVersion, startPath, actions, resultMarker: { ...marker }, timeoutMs, catalogHash: fixture.catalogHash ?? null };
}

export function validateHostedDeploymentAttestation(value, expected = {}) {
  const attestation = requireRecord(value, "attestation_invalid");
  if (attestation.schemaVersion !== HOSTED_ATTESTATION_VERSION) fail("attestation_schema_version_invalid");
  const required = [
    "repository",
    "prNumber",
    "prState",
    "prDraft",
    "prMerged",
    "prHeadSha",
    "githubDeploymentSha",
    "githubEnvironment",
    "vercelProjectId",
    "vercelDeploymentId",
    "vercelTarget",
    "vercelState",
    "vercelSourceCommitSha",
    "immutableUrl"
  ];
  for (const key of required) if (!(key in attestation)) fail("attestation_field_missing", key);
  if (attestation.repository !== expected.repository) fail("attestation_repository_mismatch");
  if (Number(attestation.prNumber) !== Number(expected.prNumber)) fail("attestation_pr_mismatch");
  if (attestation.prState !== "open" || attestation.prDraft !== true || attestation.prMerged !== false) fail("attestation_pr_state_invalid");
  const sha = requireString(attestation.prHeadSha, "attestation_head_sha_missing");
  if (![attestation.githubDeploymentSha, attestation.vercelSourceCommitSha, expected.headSha].every((item) => item === sha)) fail("attestation_sha_mismatch");
  if (String(attestation.githubEnvironment).toLowerCase() !== "preview") fail("attestation_github_environment_invalid");
  if (attestation.vercelProjectId !== expected.vercelProjectId) fail("attestation_project_mismatch");
  if (String(attestation.vercelTarget).toLowerCase() !== "preview") fail("attestation_target_invalid");
  if (String(attestation.vercelState).toUpperCase() !== "READY") fail("attestation_state_invalid");
  let url;
  try {
    url = new URL(attestation.immutableUrl);
  } catch {
    fail("attestation_immutable_url_invalid");
  }
  if (url.protocol !== "https:") fail("attestation_immutable_url_invalid");
  return { ...attestation, immutableHost: url.hostname };
}
