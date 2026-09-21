import {
  PRODUCT_QUERY_POST_CANARY_READINESS
} from "./product-query-post-canary-readiness-contract.mjs";

export const PRODUCT_QUERY_AUTHENTICATED_LIMITED_BETA_DESIGN_CONTRACT_VERSION =
  "product-query-authenticated-limited-beta-design-v1";

export const PRODUCT_QUERY_AUTHENTICATED_LIMITED_BETA_DESIGN = Object.freeze({
  contractVersion:
    PRODUCT_QUERY_AUTHENTICATED_LIMITED_BETA_DESIGN_CONTRACT_VERSION,
  phase: "DATA-AI17",
  scope: "authenticated_limited_beta_design_only",
  betaState: "designed_not_implemented",
  activationDecision: "not_authorized",
  prerequisite: Object.freeze({
    phase: PRODUCT_QUERY_POST_CANARY_READINESS.phase,
    readinessState: PRODUCT_QUERY_POST_CANARY_READINESS.readinessState,
    productionCanaryAccepted:
      PRODUCT_QUERY_POST_CANARY_READINESS.productionCanaryAccepted,
    productionActivation:
      PRODUCT_QUERY_POST_CANARY_READINESS.activationBoundary.productionActivation,
    effectiveSampleBps:
      PRODUCT_QUERY_POST_CANARY_READINESS.activationBoundary.effectiveSampleBps
  }),
  intendedFlow: Object.freeze([
    "authenticated_product_search_ux",
    "natural_language_query",
    "provider_intent_parsing_only",
    "query_only_execution_plan",
    "existing_deterministic_filtering_and_ranking",
    "bounded_product_results"
  ]),
  accessBoundary: Object.freeze({
    authenticatedOnly: true,
    explicitServerSideBetaEligibilityRequired: true,
    anonymousTraffic: false,
    automaticTrafficSampling: false,
    publicAnonymousRoute: false,
    browserControlledActivation: false,
    requestControlledActivation: false
  }),
  authorityBoundary: Object.freeze({
    providerRole: "intent_parsing_only",
    providerProductSelection: false,
    providerRankingAuthority: false,
    deterministicFilteringAuthority: "product_query_execution_contract",
    deterministicRankingAuthority: "existing_recommendation_engine",
    queryProvenance: "query_only",
    profileMerge: false,
    savedProfileRead: false,
    historyRead: false,
    productFactDirectRead: false,
    taxonomyRuntimeAuthority: false
  }),
  dataBoundary: Object.freeze({
    persistence: "none",
    rawQueryPersistence: false,
    recommendationLogWrite: false,
    productionWrite: false,
    accessTokenPersistence: false,
    rawAccountIdPersistence: false
  }),
  integrationBoundary: Object.freeze({
    betaRouteImplemented: false,
    userFacingUiConnected: false,
    publicSearchCutover: false,
    productionEnvironmentMutation: false,
    activationManifestPresent: false,
    releaseGateImplemented: false
  }),
  failureBehavior: Object.freeze({
    failClosedOnMissingAuthentication: true,
    failClosedOnMissingBetaEligibility: true,
    failClosedOnProviderUnavailable: true,
    failClosedOnProviderProtocolError: true,
    providerFailureMaySelectProducts: false,
    fallbackMode: "existing_non_beta_path"
  }),
  nextRequiredPhase:
    "data_ai18_authenticated_limited_beta_runtime_implementation_default_off",
  userFacingProductionActivationRequiresSeparateExplicitPhase: true
});
