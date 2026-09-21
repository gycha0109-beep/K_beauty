import {
  PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE
} from "./product-query-production-canary-acceptance-evidence.mjs";

export const PRODUCT_QUERY_POST_CANARY_READINESS_CONTRACT_VERSION =
  "product-query-post-canary-readiness-v1";

export const PRODUCT_QUERY_POST_CANARY_READINESS = Object.freeze({
  contractVersion: PRODUCT_QUERY_POST_CANARY_READINESS_CONTRACT_VERSION,
  phase: "DATA-AI16",
  scope: "production_canary_closure",
  readinessState: "production_canary_accepted_returning_default_off",
  canaryEvidenceVersion:
    PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE.evidenceVersion,
  productionCanaryAccepted:
    PRODUCT_QUERY_PRODUCTION_CANARY_ACCEPTANCE_EVIDENCE.accepted,
  activationBoundary: Object.freeze({
    productionActivation: false,
    effectiveSampleBps: 0,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persistence: "none",
    savedProfileRead: false,
    historyRead: false,
    providerProductSelection: false,
    providerRankingAuthority: false,
    deterministicRankingAuthorityPreserved: true
  }),
  nextRequiredPhase: "data_ai17_authenticated_limited_beta_design",
  futureUserFacingActivationRequiresSeparateExplicitPhase: true
});
