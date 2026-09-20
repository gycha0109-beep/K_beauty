export const PRODUCT_QUERY_RELEASE_READINESS_CONTRACT_VERSION =
  "product-query-release-readiness-v1";

export const PRODUCT_QUERY_RELEASE_READINESS = Object.freeze({
  contractVersion: PRODUCT_QUERY_RELEASE_READINESS_CONTRACT_VERSION,
  phase: "DATA-AI8",
  scope: "evidence_only",
  readinessState: "hosted_authenticated_preview_pending",
  activationDecision: "not_authorized",
  prerequisiteEvidenceClasses: Object.freeze([
    "data-ai3-real-corpus-shadow",
    "data-ai4-provider-backed-shadow",
    "data-ai5-activation-readiness-shadow",
    "data-ai6-controlled-authenticated-preview-contract",
    "data-ai7-test-stage-repeatability-runtime",
    "data-ai7-production-fail-closed-deployed-probe"
  ]),
  unresolvedRuntimeEvidence: Object.freeze([
    "hosted_authenticated_preview_acceptance"
  ]),
  nextRequiredEvidence: "hosted_authenticated_preview_acceptance",
  activationBoundary: Object.freeze({
    productionActivation: false,
    productionShadow: false,
    publicSearchCutover: false,
    automaticTrafficSampling: false,
    effectiveSampleBps: 0,
    persistence: "none",
    savedProfileRead: false,
    historyRead: false,
    productFactDirectRead: false,
    taxonomyRuntimeAuthority: false,
    providerProductSelection: false,
    providerRankingAuthority: false,
    releaseGateImplemented: false,
    productionEnvironmentMutation: false
  }),
  futureActivationRequiresSeparateExplicitPhase: true
});
