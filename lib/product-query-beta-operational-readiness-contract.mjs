export const PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION =
  "product-query-beta-operational-readiness-v1";

export const DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS = 30;
export const DATA_AI25_MIN_RUNTIME_SUCCESS_RATE = 0.95;
export const DATA_AI25_MAX_FALLBACK_RATE = 0.05;
export const DATA_AI25_EXPECTED_PROVIDER = "openai";
export const DATA_AI25_EXPECTED_MODEL = "gpt-5.6-luna";

export const PRODUCT_QUERY_BETA_OPERATIONAL_READINESS = Object.freeze({
  phase: "DATA-AI25",
  contractVersion: PRODUCT_QUERY_BETA_OPERATIONAL_READINESS_CONTRACT_VERSION,
  scope: "limited_beta_operational_baseline_and_manual_expansion_readiness",
  states: Object.freeze([
    "insufficient_evidence",
    "hold",
    "ready_for_manual_expansion_review"
  ]),
  hardGates: Object.freeze({
    minimumValidRuntimeObservations: DATA_AI25_MIN_VALID_RUNTIME_OBSERVATIONS,
    minimumRuntimeSuccessRate: DATA_AI25_MIN_RUNTIME_SUCCESS_RATE,
    maximumFallbackRate: DATA_AI25_MAX_FALLBACK_RATE,
    providerModelDriftCount: 0,
    securityRegressionCount: 0,
    persistenceLeakageCount: 0,
    telemetryContractViolationCount: 0
  }),
  baselineOnlyMetrics: Object.freeze([
    "zero_result_rate",
    "partial_rate",
    "low_confidence_rate",
    "insufficient_intent_rate",
    "latency_bucket_distribution",
    "provider_latency_bucket_distribution",
    "recommendation_latency_bucket_distribution",
    "result_count_bucket_distribution",
    "unresolved_count_bucket_distribution"
  ]),
  semanticAuthority: Object.freeze({
    sourcePhase: "DATA-AI22",
    inferSemanticAccuracyFromProductionTraffic: false
  }),
  observabilityAuthority: Object.freeze({
    sourcePhase: "DATA-AI24",
    acceptedDiagnosticVersion: "product-query-beta-observability-v1",
    productionOnly: true,
    rawRuntimeLogPersistence: false,
    syntheticFixturesMaySatisfyProductionEvidence: false,
    productionEvidenceRequiresRealObservations: true
  }),
  privacyBoundary: Object.freeze({
    rawQuery: false,
    normalizedQuery: false,
    userIdentity: false,
    accountHash: false,
    email: false,
    ipAddress: false,
    userAgent: false,
    fingerprint: false,
    sessionIdentity: false,
    skinOrPreferenceValues: false,
    providerPayload: false,
    recommendationResultIdentity: false,
    profileOrHistorySnapshot: false,
    crossRequestCorrelationIdentity: false
  }),
  authorityBoundary: Object.freeze({
    automaticCohortExpansion: false,
    environmentMutation: false,
    publicCutover: false,
    anonymousTraffic: false,
    rankingAuthorityChange: false,
    scoringChange: false,
    providerChange: false,
    modelChange: false,
    persistence: "none",
    currentMaxApprovedAccountsMustRemain: 3
  }),
  nextRequiredPhase:
    "data_ai26_controlled_cohort_expansion_after_manual_approval"
});
