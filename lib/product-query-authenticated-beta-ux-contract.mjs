export const PRODUCT_QUERY_AUTHENTICATED_BETA_UX_CONTRACT_VERSION =
  "product-query-authenticated-beta-ux-v1";

export const PRODUCT_QUERY_AUTHENTICATED_BETA_UX = Object.freeze({
  contractVersion: PRODUCT_QUERY_AUTHENTICATED_BETA_UX_CONTRACT_VERSION,
  phase: "DATA-AI23",
  scope: "authenticated_cohort_gated_beta_ux",
  activationState: "existing_limited_beta_only",
  accessBoundary: Object.freeze({
    authenticatedOnly: true,
    explicitServerSideBetaEligibilityRequired: true,
    clientMayChooseEligibility: false,
    anonymousTraffic: false,
    automaticTrafficSampling: false,
    publicSearchCutover: false
  }),
  authorityBoundary: Object.freeze({
    providerRole: "intent_parsing_only",
    providerProductSelection: false,
    providerRankingAuthority: false,
    deterministicRankingAuthority: "existing_recommendation_engine",
    queryProvenance: "query_only",
    profileMerge: false,
    savedProfileRead: false,
    historyRead: false,
    taxonomyRuntimeAuthority: false
  }),
  dataBoundary: Object.freeze({
    persistence: "none",
    rawQueryPersistence: false,
    recommendationLogWrite: false,
    productionWrite: false,
    accessTokenPersistence: false,
    rawAccountIdPersistence: false,
    accountHashPersistence: false,
    telemetryPersistence: false
  }),
  uxBoundary: Object.freeze({
    entrySurface: "my_dashboard",
    hiddenWhenIneligible: true,
    boundedResultContract: "product-query-preview-v1",
    maxQueryLength: 500,
    maxResultCount: 5,
    betaFailureIsolatedFromDashboard: true,
    existingPostRouteReused: true,
    newEligibilityRouteAdded: false
  }),
  rolloutBoundary: Object.freeze({
    cohortExpansion: false,
    generalAvailability: false,
    publicActivation: false
  }),
  nextRequiredPhase:
    "data_ai24_privacy_safe_operational_observability"
});
