import { CANDIDATE_EXPOSURES } from "./candidate-exposure-policy-contract.js";
import { mapLegacyEvaluatorExposure } from "./candidate-exposure-policy-evaluator-adapter.js";

export const CANDIDATE_EXPOSURE_POLICY_SHADOW_TELEMETRY_VERSION =
  "candidate-exposure-policy-shadow-aggregate-v1";

export const CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES = Object.freeze([
  "equivalent",
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

function classifyDivergence(decision, legacyExposure) {
  if (decision.exposure === legacyExposure) return "equivalent";
  if (decision.reasonCodes.includes("invalid_context") ||
      decision.reasonCodes.includes("current_findings_invalid") ||
      decision.reasonCodes.includes("current_findings_missing")) {
    return "expected_invalid_context_hardening";
  }
  if (decision.reasonCodes.some((reason) => [
    "already_using",
    "replacement_intent_unknown",
    "duplicate_axis",
    "missing_step",
    "usage_unknown",
    "partial_context",
    "product_not_evaluable"
  ].includes(reason))) {
    return "expected_current_product_semantics";
  }
  if (
    ["contextual", "collapsed", "hidden", "insufficient_evidence"].includes(decision.exposure) &&
    ["primary", "collapsed", "hidden", "insufficient_evidence"].includes(legacyExposure)
  ) {
    return "expected_exposure_state_expansion";
  }
  if (decision.reasonCodes.includes("canonical_goal_match")) {
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
    classifyDivergence(decision, mapLegacyEvaluatorExposure(legacyByRef.get(decision.candidateRef)))
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

export function buildCandidateExposurePolicyShadowTelemetry({
  control,
  policyResult,
  comparison,
  fingerprints,
  errorCategory = "none"
} = {}) {
  const decisions = policyResult?.decisions || [];
  const laneNames = ["topPick", "supporting", "budget", "routine", "treatment"];
  const executionFailed = errorCategory !== "none";
  return {
    schemaVersion: CANDIDATE_EXPOSURE_POLICY_SHADOW_TELEMETRY_VERSION,
    policyVersion: policyResult?.policyVersion || "candidate-exposure-policy-v1",
    contextVersion: String(policyResult?.contextVersion || "unknown"),
    mode: control?.mode || "disabled",
    candidateCount: decisions.length,
    exposureCounts: countBy(decisions.map((decision) => decision.exposure), CANDIDATE_EXPOSURES),
    laneEligibilityCounts: Object.fromEntries(laneNames.map((lane) => [
      lane,
      decisions.filter((decision) => decision.laneEligibility?.[lane] === true).length
    ])),
    reasonCodeCounts: countBy(decisions.flatMap((decision) => decision.reasonCodes || [])),
    currentFindingsState: policyResult?.currentFindingsState || "missing",
    divergenceCategoryCounts: comparison?.categoryCounts || {},
    invalidContextCount: decisions.filter((decision) =>
      decision.reasonCodes?.some((reason) =>
        ["invalid_context", "current_findings_invalid", "current_findings_missing"].includes(reason)
      )
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
  if (!EXECUTION_STATUSES.has(telemetry.executionStatus)) errors.push("invalid_execution_status");
  if (!ERROR_CATEGORIES.has(telemetry.errorCategory)) errors.push("invalid_error_category");
  for (const key of ["candidateCount", "invalidContextCount", "fallbackCount", "shadowExceptionCount"]) {
    if (!Number.isInteger(telemetry[key]) || telemetry[key] < 0) errors.push(`invalid_${key}`);
  }
  for (const key of ["responseFingerprintMatch", "snapshotFingerprintMatch", "candidateOrderMatch"]) {
    if (typeof telemetry[key] !== "boolean") errors.push(`invalid_${key}`);
  }
  if (
    Object.values(telemetry.divergenceCategoryCounts || {}).some((value) =>
      !Number.isInteger(value) || value < 0
    )
  ) errors.push("invalid_divergence_counts");
  return { valid: errors.length === 0, errors };
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
