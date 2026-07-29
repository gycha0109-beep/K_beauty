export const EVALUATOR_BOUNDARY_POLICY_RUNTIME_TELEMETRY_VERSION = "2026-07-29.candidate-goal-v1";

const SAFETY_KEYS = Object.freeze([
  "highRiskCollapsed",
  "sensitivityUnsafeAccepted",
  "metadataIncompleteAccepted",
  "strongCautionAccepted",
  "activeOnlyViolation",
  "sunscreenProtectionFailOpen",
  "stabilizationActiveExpansionFailOpen",
  "canonicalSafetyContextMissing",
  "canonicalGoalContextMissing",
  "canonicalGoalContextInvalid"
]);

const SAFETY_BLOCK_REASONS = Object.freeze([
  "sunscreen_protection_metadata_incomplete",
  "stabilization_active_expansion_blocked",
  "canonical_safety_context_missing"
]);

const TELEMETRY_KEYS = new Set([
  "evidenceType",
  "schemaVersion",
  "canaryScope",
  "runtimeEnabled",
  "runtimeExecuted",
  "runtimeConnected",
  "inputCandidateCount",
  "visibleCandidateCount",
  "unexpectedReceiverExposureCount",
  "safetyViolationCounts",
  "safetyBlockedCandidateCount",
  "safetyBlockReasonCounts",
  "safetyContextVersion",
  "safetyPolicyVersion",
  "goalContextVersion",
  "requestedGoalPresent",
  "detectedPriorityPresent",
  "goalTension",
  "rankingGoalSource",
  "legacyFallbackUsed",
  "alignmentStopReason",
  "runtimeExecutionCount",
  "runtimeErrorCount",
  "runtimeLatencyMsTotal",
  "runtimeLatencyMsMax",
  "killSwitchRequested",
  "killSwitchSuppressedExecution",
  "scopeValidationFailed",
  "disabledExecutionViolationCount",
  "stopRequired",
  "stopReasons"
]);

const STOP_REASONS = new Set([
  "runtime_error",
  "unexpected_receiver_exposure",
  "high_risk_collapsed",
  "sensitivity_unsafe_accepted",
  "metadata_incomplete_accepted",
  "strong_caution_accepted",
  "active_only_violation",
  "sunscreen_protection_fail_open",
  "stabilization_active_expansion_fail_open",
  "canonical_safety_context_missing",
  "canonical_goal_context_missing",
  "canonical_goal_context_invalid",
  "response_schema_changed",
  "unexpected_recommendation_delta",
  "unexpected_db_delta",
  "unexpected_storage_delta",
  "forbidden_telemetry_field",
  "baseline_slo_exceeded",
  "production_canary_scope_missing",
  "disable_runtime_execution_violation"
]);

const FORBIDDEN_FIELD_NAMES = new Set([
  "productid",
  "productids",
  "productname",
  "name",
  "brand",
  "userinput",
  "survey",
  "image",
  "imagedata",
  "url",
  "token",
  "apikey",
  "key",
  "secret",
  "rawrequest",
  "rawresponse",
  "requestbody",
  "responsebody",
  "recommendation"
]);

const PROBE_RESULT_KEYS = new Set([
  "fixtureContractId",
  "requestCount",
  "errorCount",
  "p95LatencyMs",
  "responseSchemaSignature",
  "recommendationSignature",
  "databaseMutationCount",
  "storageMutationCount",
  "runtimeTelemetry"
]);

const FIXTURE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;
const SIGNATURE_PATTERN = /^[a-f0-9]{64}$/;

function nonNegativeInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function safetyCounts(value = {}) {
  return Object.fromEntries(SAFETY_KEYS.map((key) => [key, nonNegativeInteger(value?.[key])]));
}

function safetyBlockCounts(value = {}) {
  return Object.fromEntries(
    SAFETY_BLOCK_REASONS.map((key) => [key, nonNegativeInteger(value?.[key])])
  );
}

function containsForbiddenField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenField);
  return Object.entries(value).some(([key, nested]) => {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return FORBIDDEN_FIELD_NAMES.has(normalized) || containsForbiddenField(nested);
  });
}

function runtimeStopReasons({ runtimeErrorCount, unexpectedReceiverExposureCount, counts, disabledExecutionViolationCount, scopeValidationFailed }) {
  const reasons = [];
  if (runtimeErrorCount > 0) reasons.push("runtime_error");
  if (unexpectedReceiverExposureCount > 0) reasons.push("unexpected_receiver_exposure");
  if (counts.highRiskCollapsed > 0) reasons.push("high_risk_collapsed");
  if (counts.sensitivityUnsafeAccepted > 0) reasons.push("sensitivity_unsafe_accepted");
  if (counts.metadataIncompleteAccepted > 0) reasons.push("metadata_incomplete_accepted");
  if (counts.strongCautionAccepted > 0) reasons.push("strong_caution_accepted");
  if (counts.activeOnlyViolation > 0) reasons.push("active_only_violation");
  if (counts.sunscreenProtectionFailOpen > 0) reasons.push("sunscreen_protection_fail_open");
  if (counts.stabilizationActiveExpansionFailOpen > 0) reasons.push("stabilization_active_expansion_fail_open");
  if (counts.canonicalSafetyContextMissing > 0) reasons.push("canonical_safety_context_missing");
  if (counts.canonicalGoalContextMissing > 0) reasons.push("canonical_goal_context_missing");
  if (counts.canonicalGoalContextInvalid > 0) reasons.push("canonical_goal_context_invalid");
  if (scopeValidationFailed) reasons.push("production_canary_scope_missing");
  if (disabledExecutionViolationCount > 0) reasons.push("disable_runtime_execution_violation");
  return reasons;
}

export function resolveEvaluatorBoundaryPolicyRuntimeControl(envLike = {}) {
  const enableRequested = envLike.ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1";
  const disableRequested = envLike.DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1";
  const production = envLike.NODE_ENV === "production";
  const productionCanaryDeployment =
    envLike.EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE === "deployment_canary" &&
    envLike.EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT === "1";
  const canaryScope = production
    ? (productionCanaryDeployment ? "deployment_canary" : "unscoped_production")
    : "local_synthetic_probe";

  return {
    enableRequested,
    disableRequested,
    canaryScope,
    runtimeEnabled: enableRequested && !disableRequested && (!production || productionCanaryDeployment),
    killSwitchSuppressedExecution: enableRequested && disableRequested,
    scopeValidationFailed: production && enableRequested && !productionCanaryDeployment
  };
}

export function buildEvaluatorBoundaryPolicyRuntimeTelemetry({
  control,
  runtimeResult = null,
  runtimeError = false,
  latencyMs = 0
} = {}) {
  const runtimeExecuted = Boolean(runtimeResult) || runtimeError === true;
  const runtimeConnected = runtimeResult?.runtimeConnected === true;
  const counts = safetyCounts(runtimeResult?.violationCounts);
  const blockCounts = safetyBlockCounts(runtimeResult?.safetyBlockReasonCounts);
  const runtimeErrorCount = runtimeError === true ? 1 : 0;
  const unexpectedReceiverExposureCount = nonNegativeInteger(runtimeResult?.unexpectedReceiverCount);
  const disabledExecutionViolationCount = control?.disableRequested && runtimeExecuted ? 1 : 0;
  const scopeValidationFailed = control?.scopeValidationFailed === true;
  const stopReasons = runtimeStopReasons({
    runtimeErrorCount,
    unexpectedReceiverExposureCount,
    counts,
    disabledExecutionViolationCount,
    scopeValidationFailed
  });

  return {
    evidenceType: "candidate_policy_runtime_aggregate",
    schemaVersion: EVALUATOR_BOUNDARY_POLICY_RUNTIME_TELEMETRY_VERSION,
    canaryScope: control?.canaryScope || "unknown",
    runtimeEnabled: control?.runtimeEnabled === true,
    runtimeExecuted,
    runtimeConnected,
    inputCandidateCount: nonNegativeInteger(runtimeResult?.candidateCounts?.before),
    visibleCandidateCount: nonNegativeInteger(runtimeResult?.candidateCounts?.after),
    unexpectedReceiverExposureCount,
    safetyViolationCounts: counts,
    safetyBlockedCandidateCount: nonNegativeInteger(runtimeResult?.safetyBlockedCandidateCount),
    safetyBlockReasonCounts: blockCounts,
    safetyContextVersion: runtimeResult?.safetyContextVersion || null,
    safetyPolicyVersion: runtimeResult?.safetyPolicyVersion || null,
    goalContextVersion: runtimeResult?.goalContextVersion || null,
    requestedGoalPresent: runtimeResult?.requestedGoalPresent === true,
    detectedPriorityPresent: runtimeResult?.detectedPriorityPresent === true,
    goalTension: runtimeResult?.goalTension === true,
    rankingGoalSource: runtimeResult?.rankingGoalSource || "unavailable",
    legacyFallbackUsed: runtimeResult?.legacyFallbackUsed === true,
    alignmentStopReason: runtimeResult?.alignmentStopReason || null,
    runtimeExecutionCount: runtimeExecuted ? 1 : 0,
    runtimeErrorCount,
    runtimeLatencyMsTotal: nonNegativeInteger(latencyMs),
    runtimeLatencyMsMax: nonNegativeInteger(latencyMs),
    killSwitchRequested: control?.disableRequested === true,
    killSwitchSuppressedExecution: control?.killSwitchSuppressedExecution === true && !runtimeExecuted,
    scopeValidationFailed,
    disabledExecutionViolationCount,
    stopRequired: stopReasons.length > 0,
    stopReasons
  };
}

export function validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry) {
  const errors = [];
  if (!telemetry || typeof telemetry !== "object" || Array.isArray(telemetry)) return { valid: false, errors: ["telemetry_not_object"] };
  const unknownKeys = Object.keys(telemetry).filter((key) => !TELEMETRY_KEYS.has(key));
  if (unknownKeys.length > 0) errors.push("unknown_telemetry_field");
  if (containsForbiddenField(telemetry)) errors.push("forbidden_telemetry_field");
  if (telemetry.evidenceType !== "candidate_policy_runtime_aggregate") errors.push("invalid_evidence_type");
  if (telemetry.schemaVersion !== EVALUATOR_BOUNDARY_POLICY_RUNTIME_TELEMETRY_VERSION) errors.push("invalid_schema_version");
  if (!["local_synthetic_probe", "deployment_canary", "unscoped_production", "unknown"].includes(telemetry.canaryScope)) errors.push("invalid_canary_scope");
  for (const key of ["runtimeEnabled", "runtimeExecuted", "runtimeConnected", "requestedGoalPresent", "detectedPriorityPresent", "goalTension", "legacyFallbackUsed", "killSwitchRequested", "killSwitchSuppressedExecution", "scopeValidationFailed", "stopRequired"]) {
    if (typeof telemetry[key] !== "boolean") errors.push(`invalid_${key}`);
  }
  for (const key of ["inputCandidateCount", "visibleCandidateCount", "unexpectedReceiverExposureCount", "safetyBlockedCandidateCount", "runtimeExecutionCount", "runtimeErrorCount", "runtimeLatencyMsTotal", "runtimeLatencyMsMax", "disabledExecutionViolationCount"]) {
    if (!Number.isInteger(telemetry[key]) || telemetry[key] < 0) errors.push(`invalid_${key}`);
  }
  if (!telemetry.safetyViolationCounts || SAFETY_KEYS.some((key) => !Number.isInteger(telemetry.safetyViolationCounts[key]) || telemetry.safetyViolationCounts[key] < 0)) errors.push("invalid_safety_violation_counts");
  if (!telemetry.safetyBlockReasonCounts ||
      SAFETY_BLOCK_REASONS.some((key) =>
        !Number.isInteger(telemetry.safetyBlockReasonCounts[key]) ||
        telemetry.safetyBlockReasonCounts[key] < 0
      )) errors.push("invalid_safety_block_reason_counts");
  if (telemetry.safetyContextVersion !== null && typeof telemetry.safetyContextVersion !== "string") errors.push("invalid_safety_context_version");
  if (telemetry.safetyPolicyVersion !== null && typeof telemetry.safetyPolicyVersion !== "string") errors.push("invalid_safety_policy_version");
  if (telemetry.goalContextVersion !== null && typeof telemetry.goalContextVersion !== "string") errors.push("invalid_goal_context_version");
  if (!["canonical_functional_policy_priority_axis", "unavailable"].includes(telemetry.rankingGoalSource)) errors.push("invalid_ranking_goal_source");
  if (telemetry.alignmentStopReason !== null &&
      !["canonical_goal_context_missing", "canonical_goal_context_invalid"].includes(telemetry.alignmentStopReason)) {
    errors.push("invalid_alignment_stop_reason");
  }
  if (!Array.isArray(telemetry.stopReasons) || telemetry.stopReasons.some((reason) => !STOP_REASONS.has(reason))) errors.push("invalid_stop_reasons");
  if (telemetry.stopRequired !== (Array.isArray(telemetry.stopReasons) && telemetry.stopReasons.length > 0)) errors.push("stop_state_mismatch");
  if (telemetry.runtimeExecuted && !telemetry.runtimeEnabled) errors.push("disabled_runtime_executed");
  if (telemetry.runtimeConnected && !telemetry.runtimeExecuted) errors.push("runtime_connection_without_execution");
  if (telemetry.killSwitchRequested && telemetry.runtimeExecuted) errors.push("disable_runtime_execution_violation");
  return { valid: errors.length === 0, errors };
}

export function emitEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry, sink = console.info) {
  const validation = validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry);
  if (!validation.valid) return { emitted: false, reasonCode: "telemetry_validation_failed" };
  try {
    sink("[candidate-policy-runtime]", telemetry);
    return { emitted: true, reasonCode: "aggregate_telemetry_emitted" };
  } catch {
    return { emitted: false, reasonCode: "telemetry_sink_failed" };
  }
}

export function evaluateEvaluatorBoundaryPolicyCanaryGate({ telemetry, comparison = {}, slo = {} } = {}) {
  const telemetryValidation = validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry);
  const reasons = telemetryValidation.valid ? [...telemetry.stopReasons] : ["forbidden_telemetry_field"];
  if (comparison.responseSchemaChanged === true) reasons.push("response_schema_changed");
  if (comparison.unexpectedRecommendationDelta === true) reasons.push("unexpected_recommendation_delta");
  if (comparison.unexpectedDbMutationDelta === true || Number(comparison.shadowAddedDbMutationDelta || 0) !== 0) reasons.push("unexpected_db_delta");
  if (comparison.unexpectedStorageMutationDelta === true || Number(comparison.shadowAddedStorageMutationDelta || 0) !== 0) reasons.push("unexpected_storage_delta");
  if (comparison.forbiddenTelemetryFieldDetected === true) reasons.push("forbidden_telemetry_field");
  const errorRateExceeded = Number(slo.canaryErrorRate || 0) > Number(slo.baselineErrorRate || 0) + Number(slo.maxErrorRateIncrease || 0);
  const latencyExceeded = Number(slo.canaryP95LatencyMs || 0) > Number(slo.baselineP95LatencyMs || 0) + Number(slo.maxP95LatencyIncreaseMs || 0);
  if (errorRateExceeded || latencyExceeded) reasons.push("baseline_slo_exceeded");
  const stopReasons = Array.from(new Set(reasons));
  return {
    evidenceType: "candidate_policy_runtime_canary_gate",
    canaryScope: telemetry?.canaryScope || "unknown",
    stopRequired: stopReasons.length > 0,
    stopReasons
  };
}

export function validateEvaluatorBoundaryPolicySyntheticProbeResult(result) {
  const errors = [];
  if (!result || typeof result !== "object" || Array.isArray(result)) return { valid: false, errors: ["probe_result_not_object"] };
  if (Object.keys(result).some((key) => !PROBE_RESULT_KEYS.has(key))) errors.push("unknown_probe_result_field");
  if (containsForbiddenField(result)) errors.push("forbidden_probe_field");
  if (!FIXTURE_ID_PATTERN.test(String(result.fixtureContractId || ""))) errors.push("invalid_fixture_contract_id");
  for (const key of ["requestCount", "errorCount", "p95LatencyMs", "databaseMutationCount", "storageMutationCount"]) {
    if (!Number.isInteger(result[key]) || result[key] < 0) errors.push(`invalid_${key}`);
  }
  if (!SIGNATURE_PATTERN.test(String(result.responseSchemaSignature || ""))) errors.push("invalid_response_schema_signature");
  if (!SIGNATURE_PATTERN.test(String(result.recommendationSignature || ""))) errors.push("invalid_recommendation_signature");
  if (!validateEvaluatorBoundaryPolicyRuntimeTelemetry(result.runtimeTelemetry).valid) errors.push("invalid_runtime_telemetry");
  return { valid: errors.length === 0, errors };
}

export function compareEvaluatorBoundaryPolicySyntheticProbes({ baseline, canary } = {}) {
  const baselineValidation = validateEvaluatorBoundaryPolicySyntheticProbeResult(baseline);
  const canaryValidation = validateEvaluatorBoundaryPolicySyntheticProbeResult(canary);
  if (!baselineValidation.valid || !canaryValidation.valid || baseline.fixtureContractId !== canary.fixtureContractId) {
    return { valid: false, reasonCode: "synthetic_probe_contract_invalid" };
  }
  const databaseMutationDelta = canary.databaseMutationCount - baseline.databaseMutationCount;
  const storageMutationDelta = canary.storageMutationCount - baseline.storageMutationCount;
  return {
    valid: true,
    sameSyntheticFixture: true,
    responseSchemaChanged: baseline.responseSchemaSignature !== canary.responseSchemaSignature,
    unexpectedRecommendationDelta: baseline.recommendationSignature !== canary.recommendationSignature,
    shadowAddedDbMutationDelta: databaseMutationDelta,
    shadowAddedStorageMutationDelta: storageMutationDelta,
    unexpectedDbMutationDelta: databaseMutationDelta !== 0,
    unexpectedStorageMutationDelta: storageMutationDelta !== 0,
    baselineErrorRate: baseline.requestCount > 0 ? baseline.errorCount / baseline.requestCount : 1,
    canaryErrorRate: canary.requestCount > 0 ? canary.errorCount / canary.requestCount : 1,
    baselineP95LatencyMs: baseline.p95LatencyMs,
    canaryP95LatencyMs: canary.p95LatencyMs
  };
}

export function evaluateEvaluatorBoundaryPolicyKillSwitchPropagation({ observations = [], timeoutMs } = {}) {
  const boundedTimeoutMs = Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : 0;
  const normalized = observations
    .filter((observation) => observation && Number.isInteger(observation.elapsedMs) && observation.elapsedMs >= 0)
    .map((observation) => ({
      elapsedMs: observation.elapsedMs,
      runtimeEnabled: observation.runtimeEnabled === true,
      runtimeExecuted: observation.runtimeExecuted === true,
      runtimeConnected: observation.runtimeConnected === true
    }))
    .sort((left, right) => left.elapsedMs - right.elapsedMs);
  const propagatedObservation = normalized.find((observation) =>
    observation.elapsedMs <= boundedTimeoutMs &&
    observation.runtimeEnabled === false &&
    observation.runtimeExecuted === false &&
    observation.runtimeConnected === false
  );
  const observedBeyondTimeout = normalized.some((observation) => observation.elapsedMs >= boundedTimeoutMs);
  const propagated = Boolean(propagatedObservation);
  const observationWindowComplete = propagated || observedBeyondTimeout;
  return {
    evidenceType: "candidate_policy_kill_switch_propagation",
    propagationTimeoutMs: boundedTimeoutMs,
    observationCount: normalized.length,
    observations: normalized,
    observationWindowComplete,
    propagated,
    propagatedAfterMs: propagatedObservation?.elapsedMs ?? null,
    timedOut: !propagated && observedBeyondTimeout,
    runtimeStillActiveAfterTimeout: !propagated && normalized.some((observation) =>
      observation.elapsedMs >= boundedTimeoutMs &&
      (observation.runtimeEnabled || observation.runtimeExecuted || observation.runtimeConnected)
    ),
    stopReason: propagated
      ? null
      : observationWindowComplete
        ? "disable_runtime_execution_violation"
        : "kill_switch_propagation_evidence_incomplete"
  };
}
