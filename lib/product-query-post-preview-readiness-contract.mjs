import {
  PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE
} from "./product-query-hosted-preview-acceptance-evidence.mjs";

export const PRODUCT_QUERY_POST_PREVIEW_READINESS_CONTRACT_VERSION =
  "product-query-post-preview-readiness-v1";

export const PRODUCT_QUERY_POST_PREVIEW_READINESS = Object.freeze({
  contractVersion: PRODUCT_QUERY_POST_PREVIEW_READINESS_CONTRACT_VERSION,
  phase: "DATA-AI10",
  scope: "evidence_closure_only",
  readinessState: "hosted_authenticated_preview_accepted",
  hostedPreviewEvidenceVersion:
    PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE.evidenceVersion,
  activationDecision: "not_authorized",
  unresolvedRuntimeEvidence: Object.freeze([]),
  nextRequiredPhase: "separate_explicit_production_activation_design",
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
