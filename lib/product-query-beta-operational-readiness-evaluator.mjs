import {
  DATA_AI25_MAX_FALLBACK_RATE,
  DATA_AI25_MIN_RUNTIME_SUCCESS_RATE,
  DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS,
  PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION
} from "./product-query-beta-operational-readiness-contract.mjs";

const STATES = Object.freeze({
  INSUFFICIENT: "insufficient_evidence",
  HOLD: "hold",
  READY: "ready_for_manual_expansion_review"
});

function finiteRate(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function evaluateProductQueryOperationalReadiness(
  baseline,
  controls = {}
) {
  if (!baseline || typeof baseline !== "object") {
    throw new TypeError("DATA-AI25 baseline is required");
  }

  const securityRegressionCount = Number.isInteger(
    controls.securityRegressionCount
  )
    ? controls.securityRegressionCount
    : 1;
  const persistenceLeakageCount = Number.isInteger(
    controls.persistenceLeakageCount
  )
    ? controls.persistenceLeakageCount
    : 1;
  const semanticQualityAccepted = controls.semanticQualityAccepted === true;
  const observabilityPrivacyAccepted =
    controls.observabilityPrivacyAccepted === true;
  const currentMaxApprovedAccounts =
    Number.isInteger(controls.currentMaxApprovedAccounts)
      ? controls.currentMaxApprovedAccounts
      : null;

  const launchBoundaryEstablished =
    baseline.launchBoundaryEstablished === true &&
    typeof baseline.operationalBaselineStartAt === "string" &&
    baseline.operationalBaselineStartAt.length > 0;
  const enoughEvidence =
    launchBoundaryEstablished &&
    baseline.validRuntimeObservationCount >=
      DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS;

  const gates = Object.freeze({
    operationalBaselineBoundary: launchBoundaryEstablished,
    minimumEvidence: enoughEvidence,
    runtimeSuccess:
      finiteRate(baseline.runtimeSuccessRate) &&
      baseline.runtimeSuccessRate >= DATA_AI25_MIN_RUNTIME_SUCCESS_RATE,
    fallback:
      finiteRate(baseline.fallbackRate) &&
      baseline.fallbackRate <= DATA_AI25_MAX_FALLBACK_RATE,
    providerModelDrift: baseline.providerModelDriftCount === 0,
    telemetryContract:
      baseline.telemetryContractViolationCount === 0,
    security: securityRegressionCount === 0,
    persistence: persistenceLeakageCount === 0,
    semanticQualityAuthority: semanticQualityAccepted,
    observabilityPrivacyAuthority: observabilityPrivacyAccepted,
    cohortCapPreserved: currentMaxApprovedAccounts === 3
  });

  const reasons = [];
  let state = STATES.READY;

  if (!launchBoundaryEstablished) {
    state = STATES.INSUFFICIENT;
    reasons.push("operational_baseline_not_started");
  } else if (!enoughEvidence) {
    state = STATES.INSUFFICIENT;
    reasons.push("minimum_operational_evidence_not_met");
  } else {
    if (!gates.runtimeSuccess) reasons.push("runtime_success_below_gate");
    if (!gates.fallback) reasons.push("fallback_rate_above_gate");
    if (!gates.providerModelDrift) reasons.push("provider_model_contract_drift");
    if (!gates.telemetryContract) reasons.push("telemetry_contract_violation");
    if (!gates.security) reasons.push("security_regression");
    if (!gates.persistence) reasons.push("persistence_leakage");
    if (!gates.semanticQualityAuthority) reasons.push("semantic_quality_authority_missing");
    if (!gates.observabilityPrivacyAuthority) reasons.push("observability_privacy_authority_missing");
    if (!gates.cohortCapPreserved) reasons.push("cohort_cap_changed");

    if (reasons.length > 0) state = STATES.HOLD;
  }

  return Object.freeze({
    readinessVersion: PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION,
    phase: "DATA-AI25",
    state,
    reasons: Object.freeze(reasons),
    evidence: Object.freeze({
      operationalBaselineStartAt: baseline.operationalBaselineStartAt || null,
      launchBoundaryEstablished,
      preBaselineObservationCount: Number(
        baseline.preBaselineObservationCount || 0
      ),
      unscopedObservationCount: Number(
        baseline.unscopedObservationCount || 0
      ),
      validRuntimeObservationCount: baseline.validRuntimeObservationCount,
      minimumRequired: DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS,
      runtimeSuccessRate: baseline.runtimeSuccessRate,
      minimumRuntimeSuccessRate: DATA_AI25_MIN_RUNTIME_SUCCESS_RATE,
      fallbackRate: baseline.fallbackRate,
      maximumFallbackRate: DATA_AI25_MAX_FALLBACK_RATE,
      providerModelDriftCount: baseline.providerModelDriftCount,
      telemetryContractViolationCount:
        baseline.telemetryContractViolationCount,
      securityRegressionCount,
      persistenceLeakageCount
    }),
    gates,
    baselineOnlyMetrics: baseline.baselineRates,
    deploymentShas: baseline.deploymentShas,
    cohortExpansionAuthorized: false,
    environmentMutationAuthorized: false,
    publicCutoverAuthorized: false
  });
}
