import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES,
  CANDIDATE_EXPOSURE_POLICY_VERSION,
  CANDIDATE_EXPOSURE_REASON_CODES
} from "./candidate-exposure-policy-contract.js";
import { mapLegacyEvaluatorExposure } from "./candidate-exposure-policy-evaluator-adapter.js";

export const CANDIDATE_EXPOSURE_POLICY_SHADOW_TELEMETRY_VERSION =
  "candidate-exposure-policy-shadow-aggregate-v1";

export const CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES = Object.freeze([
  "equivalent",
  "expected_canonical_evaluator_rebuild",
  "expected_canonical_goal_alignment",
  "expected_current_product_semantics",
  "expected_exposure_state_expansion",
  "expected_invalid_context_hardening",
  "unexpected_divergence"
]);

const EXECUTION_STATUSES = new Set(["disabled", "executed", "execution_failed"]);
const ERROR_CATEGORIES = new Set([
  "none",
  "invalid_canonical_input",
  "adapter_execution_failed",
  "comparison_failed",
  "observability_serialization_failed"
]);
const MODES = new Set(["disabled", "kill_switched", "shadow_only"]);
const CURRENT_FINDINGS_STATES = new Set([
  "missing",
  "invalid",
  "partial_unknown",
  "not_in_db",
  "unanswered",
  "not_using",
  "populated",
  "valid_empty"
]);
const ALLOWED_KEYS = new Set([
  "schemaVersion",
  "policyVersion",
  "contextVersion",
  "mode",
  "candidateCount",
  "exposureCounts",
  "laneEligibilityCounts",
  "reasonCodeCounts",
  "currentFindingsState",
  "divergenceCategoryCounts",
  "invalidContextCount",
  "fallbackCount",
  "executionStatus",
  "errorCategory",
  "responseFingerprintMatch",
  "snapshotFingerprintMatch",
  "candidateOrderMatch",
  "shadowExceptionCount"
]);
const FORBIDDEN_KEY = /(email|user|account|product|brand|url|survey|cookie|jwt|session|report|token|secret|payload|candidateRef|candidateId)/i;
const INVALID_CONTEXT_REASONS = new Set([
  "invalid_context",
  "current_findings_invalid",
  "current_findings_missing"
]);
const CURRENT_PRODUCT_REASONS = new Set([
  "already_using",
  "replacement_intent_unknown",
  "duplicate_axis",
  "missing_step",
  "usage_unknown",
  "partial_context",
  "product_not_evaluable"
]);
const STRICT_SAFETY_REASONS = new Map([
  ["irritation_risk", "hidden"],
  ["stabilization_active_block", "hidden"],
  ["expansion_prohibited", "hidden"],
  ["metadata_incomplete", "insufficient_evidence"],
  ["protection_evidence_incomplete", "insufficient_evidence"]
]);

function countBy(values, allowedValues = null) {
  const counts = {};
  for (const value of values) {
    const key = allowedValues?.includes(value) ? value : String(value || "unknown");
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "en")));
}

function currentFindingsState(value) {
  if (value == null) return "missing";
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.findings)) {
    return "invalid";
  }
  const unknown = value.findings.filter((finding) =>
    ["unanswered", "not_in_db"].includes(finding?.sourceState) ||
    finding?.relationToPlan === "not_evaluable"
  ).length;
  if (unknown && unknown < value.findings.length) return "partial_unknown";
  if (value.findings.some((finding) => finding?.sourceState === "not_in_db")) return "not_in_db";
  if (value.findings.some((finding) => finding?.sourceState === "unanswered")) return "unanswered";
  if (value.findings.some((finding) => finding?.sourceState === "not_using")) return "not_using";
  return value.findings.length ? "populated" : "valid_empty";
}

function hasReason(decision, reasonSet) {
  return decision.reasonCodes.some((reason) => reasonSet.has(reason));
}

function currentProductTransitionIsExpected(decision) {
  if (decision.reasonCodes.includes("already_using")) return decision.exposure === "hidden";
  if (decision.reasonCodes.some((reason) => [
    "usage_unknown",
    "product_not_evaluable"
  ].includes(reason))) return decision.exposure === "insufficient_evidence";
  if (decision.reasonCodes.some((reason) => [
    "replacement_intent_unknown",
    "duplicate_axis",
    "partial_context"
  ].includes(reason))) {
    return ["contextual", "collapsed", "hidden", "insufficient_evidence"].includes(decision.exposure);
  }
  if (decision.reasonCodes.includes("missing_step")) {
    return ["primary", "contextual", "collapsed"].includes(decision.exposure);
  }
  return false;
}

function canonicalEvaluatorRebuildIsExpected(decision, legacyExposure) {
  return legacyExposure === "primary" &&
    decision.exposure === "hidden" &&
    decision.provenance?.adapterExposure === "hidden" &&
    decision.currentProductRelation === "none" &&
    decision.evidenceState === "complete" &&
    decision.reasonCodes.length === 1 &&
    decision.reasonCodes[0] === "canonical_goal_match";
}

function canonicalTransitionIsExpected(decision, legacyExposure) {
  const allowed = new Set([
    "hidden>primary",
    "hidden>contextual",
    "hidden>collapsed",
    "insufficient_evidence>primary",
    "insufficient_evidence>contextual",
    "insufficient_evidence>collapsed",
    "collapsed>primary",
    "collapsed>contextual",
    "primary>contextual",
    "primary>collapsed"
  ]);
  return allowed.has(`${legacyExposure}>${decision.exposure}`);
}

export function classifyCandidateExposureDivergence(decision, legacyExposure) {
  if (!decision || typeof decision !== "object" || !CANDIDATE_EXPOSURES.includes(decision.exposure)) {
    return "unexpected_divergence";
  }
  const normalizedLegacyExposure = CANDIDATE_EXPOSURES.includes(legacyExposure)
    ? legacyExposure
    : "insufficient_evidence";
  if (decision.exposure === normalizedLegacyExposure) return "equivalent";

  if (hasReason(decision, INVALID_CONTEXT_REASONS)) {
    return decision.exposure === "insufficient_evidence"
      ? "expected_invalid_context_hardening"
      : "unexpected_divergence";
  }

  if (hasReason(decision, CURRENT_PRODUCT_REASONS)) {
    return currentProductTransitionIsExpected(decision)
      ? "expected_current_product_semantics"
      : "unexpected_divergence";
  }

  for (const [reason, requiredExposure] of STRICT_SAFETY_REASONS) {
    if (decision.reasonCodes.includes(reason)) {
      return decision.exposure === requiredExposure
        ? "expected_exposure_state_expansion"
        : "unexpected_divergence";
    }
  }

  if (canonicalEvaluatorRebuildIsExpected(decision, normalizedLegacyExposure)) {
    return "expected_canonical_evaluator_rebuild";
  }

  if (
    decision.reasonCodes.some((reason) => ["canonical_goal_match", "protection_maintained"].includes(reason)) &&
    canonicalTransitionIsExpected(decision, normalizedLegacyExposure)
  ) {
    return "expected_canonical_goal_alignment";
  }

  return "unexpected_divergence";
}

export function compareCandidateExposurePolicyWithLegacy({
  decisions,
  legacyExecution
} = {}) {
  const legacyByRef = new Map(
    (legacyExecution?.receivers || []).map((receiver) => [String(receiver?.productId || ""), receiver])
  );
  const categories = (Array.isArray(decisions) ? decisions : []).map((decision) =>
    classifyCandidateExposureDivergence(
      decision,
      mapLegacyEvaluatorExposure(legacyByRef.get(decision.candidateRef))
    )
  );
  return {
    categoryCounts: countBy(categories, CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES),
    unexpectedDivergenceCount: categories.filter((category) => category === "unexpected_divergence").length,
    unclassifiedDivergenceCount: categories.filter(
      (category) => !CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES.includes(category)
    ).length
  };
}

function containsForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_KEY.test(key) || containsForbiddenKey(nested)
  );
}

function isPlainCountMap(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateCountMap(errors, key, value, allowedKeys, { exactKeys = false } = {}) {
  if (!isPlainCountMap(value)) {
    errors.push(`invalid_${key}`);
    return;
  }
  const keys = Object.keys(value);
  if (
    keys.some((entry) => !allowedKeys.includes(entry)) ||
    Object.values(value).some((count) => !Number.isInteger(count) || count < 0)
  ) {
    errors.push(`invalid_${key}`);
  }
  if (exactKeys && (
    keys.length !== allowedKeys.length ||
    allowedKeys.some((entry) => !Object.hasOwn(value, entry))
  )) {
    errors.push(`invalid_${key}_keys`);
  }
}

function sumCounts(value) {
  return Object.values(value || {}).reduce((sum, count) => sum + count, 0);
}

export function buildCandidateExposurePolicyShadowTelemetry({
  control,
  policyResult,
  comparison,
  fingerprints,
  errorCategory = "none"
} = {}) {
  const decisions = policyResult?.decisions || [];
  const executionFailed = errorCategory !== "none";
  return {
    schemaVersion: CANDIDATE_EXPOSURE_POLICY_SHADOW_TELEMETRY_VERSION,
    policyVersion: policyResult?.policyVersion || CANDIDATE_EXPOSURE_POLICY_VERSION,
    contextVersion: String(policyResult?.contextVersion || "unknown"),
    mode: control?.mode || "disabled",
    candidateCount: decisions.length,
    exposureCounts: countBy(decisions.map((decision) => decision.exposure), CANDIDATE_EXPOSURES),
    laneEligibilityCounts: Object.fromEntries(CANDIDATE_EXPOSURE_LANES.map((lane) => [
      lane,
      decisions.filter((decision) => decision.laneEligibility?.[lane] === true).length
    ])),
    reasonCodeCounts: countBy(decisions.flatMap((decision) => decision.reasonCodes || [])),
    currentFindingsState: policyResult?.currentFindingsState || "missing",
    divergenceCategoryCounts: comparison?.categoryCounts || {},
    invalidContextCount: decisions.filter((decision) =>
      decision.reasonCodes?.some((reason) => INVALID_CONTEXT_REASONS.has(reason))
    ).length,
    fallbackCount: executionFailed ? 1 : 0,
    executionStatus: executionFailed ? "execution_failed" : control?.enabled ? "executed" : "disabled",
    errorCategory,
    responseFingerprintMatch: fingerprints?.responseMatch === true,
    snapshotFingerprintMatch: fingerprints?.snapshotMatch === true,
    candidateOrderMatch: fingerprints?.candidateOrderMatch === true,
    shadowExceptionCount: executionFailed ? 1 : 0
  };
}

export function validateCandidateExposurePolicyShadowTelemetry(telemetry) {
  const errors = [];
  if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry)) {
    return { valid: false, errors: ["telemetry_not_object"] };
  }
  if (Object.keys(telemetry).some((key) => !ALLOWED_KEYS.has(key))) errors.push("unknown_field");
  if (containsForbiddenKey(telemetry)) errors.push("forbidden_identifier_field");
  if (telemetry.schemaVersion !== CANDIDATE_EXPOSURE_POLICY_SHADOW_TELEMETRY_VERSION) {
    errors.push("invalid_schema_version");
  }
  if (telemetry.policyVersion !== CANDIDATE_EXPOSURE_POLICY_VERSION) {
    errors.push("invalid_policy_version");
  }
  if (
    typeof telemetry.contextVersion !== "string" ||
    telemetry.contextVersion.length < 1 ||
    telemetry.contextVersion.length > 128
  ) errors.push("invalid_context_version");
  if (!MODES.has(telemetry.mode)) errors.push("invalid_mode");
  if (!CURRENT_FINDINGS_STATES.has(telemetry.currentFindingsState)) {
    errors.push("invalid_current_findings_state");
  }
  if (!EXECUTION_STATUSES.has(telemetry.executionStatus)) errors.push("invalid_execution_status");
  if (!ERROR_CATEGORIES.has(telemetry.errorCategory)) errors.push("invalid_error_category");

  for (const key of ["candidateCount", "invalidContextCount", "fallbackCount", "shadowExceptionCount"]) {
    if (!Number.isInteger(telemetry[key]) || telemetry[key] < 0) errors.push(`invalid_${key}`);
  }
  for (const key of ["responseFingerprintMatch", "snapshotFingerprintMatch", "candidateOrderMatch"]) {
    if (typeof telemetry[key] !== "boolean") errors.push(`invalid_${key}`);
  }

  validateCountMap(errors, "exposure_counts", telemetry.exposureCounts, CANDIDATE_EXPOSURES);
  validateCountMap(
    errors,
    "lane_eligibility_counts",
    telemetry.laneEligibilityCounts,
    CANDIDATE_EXPOSURE_LANES,
    { exactKeys: true }
  );
  validateCountMap(errors, "reason_code_counts", telemetry.reasonCodeCounts, CANDIDATE_EXPOSURE_REASON_CODES);
  validateCountMap(
    errors,
    "divergence_category_counts",
    telemetry.divergenceCategoryCounts,
    CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES
  );

  if (Number.isInteger(telemetry.candidateCount)) {
    if (sumCounts(telemetry.exposureCounts) !== telemetry.candidateCount) {
      errors.push("exposure_count_total_mismatch");
    }
    if (sumCounts(telemetry.divergenceCategoryCounts) !== telemetry.candidateCount) {
      errors.push("divergence_count_total_mismatch");
    }
    if (Number.isInteger(telemetry.invalidContextCount) && telemetry.invalidContextCount > telemetry.candidateCount) {
      errors.push("invalid_context_count_exceeds_candidates");
    }
    if (
      isPlainCountMap(telemetry.laneEligibilityCounts) &&
      Object.values(telemetry.laneEligibilityCounts).some((count) => count > telemetry.candidateCount)
    ) errors.push("lane_count_exceeds_candidates");
  }

  if (telemetry.executionStatus === "executed") {
    if (telemetry.mode !== "shadow_only") errors.push("executed_without_shadow_mode");
    if (telemetry.errorCategory !== "none") errors.push("executed_with_error");
    if (telemetry.fallbackCount !== 0 || telemetry.shadowExceptionCount !== 0) {
      errors.push("executed_with_fallback");
    }
  }
  if (telemetry.executionStatus === "execution_failed") {
    if (telemetry.errorCategory === "none") errors.push("failure_without_error");
    if (telemetry.fallbackCount !== 1 || telemetry.shadowExceptionCount !== 1) {
      errors.push("failure_count_mismatch");
    }
  }

  return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export function emitCandidateExposurePolicyShadowTelemetry(telemetry, sink = console.info) {
  const validation = validateCandidateExposurePolicyShadowTelemetry(telemetry);
  if (!validation.valid) return { emitted: false, reasonCode: "telemetry_validation_failed" };
  try {
    sink("[candidate-exposure-policy-shadow]", telemetry);
    return { emitted: true, reasonCode: "aggregate_telemetry_emitted" };
  } catch {
    return { emitted: false, reasonCode: "telemetry_sink_failed" };
  }
}

export function resolveCurrentFindingsTelemetryState(value) {
  return currentFindingsState(value);
}
