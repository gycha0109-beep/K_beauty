export const PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE_CONTRACT_VERSION =
  "product-query-prelaunch-acceptance-v1";

export const PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE = Object.freeze({
  phase: "DATA-AI-PRELAUNCH-01",
  contractVersion: PRODUCT_QUERY_PRELAUNCH_ACCEPTANCE_CONTRACT_VERSION,
  scope: "product_query_release_candidate_e2e_acceptance",
  states: Object.freeze([
    "prelaunch_not_verified",
    "prelaunch_hold",
    "prelaunch_accepted"
  ]),
  targetState: "prelaunch_accepted",
  executionBoundary: Object.freeze({
    exactProductionDeploymentRequired: true,
    exactDeploymentShaRequired: true,
    dedicatedQaAccountsRequired: true,
    approvedAccountRequired: true,
    authenticatedNonCohortAccountRequired: true,
    anonymousBoundaryRequired: true,
    desktopBrowserRequired: true,
    mobileBrowserRequired: true,
    automaticProductionExecution: false,
    manualHostedAcceptanceRequired: true
  }),
  journeyBoundary: Object.freeze({
    entrySurface: "my_dashboard",
    eligibleCardVisible: true,
    ineligibleCardHidden: true,
    existingPostRouteReused: true,
    resultContract: "product-query-preview-v1",
    maxResultCount: 5,
    koreanHappyPathRequired: true,
    englishHappyPathRequired: true,
    conflictFailClosedRequired: true,
    unsupportedFailClosedRequired: true
  }),
  authorityBoundary: Object.freeze({
    providerRole: "intent_parsing_only",
    providerProductSelection: false,
    providerRankingAuthority: false,
    deterministicRankingAuthority: "existing_recommendation_engine",
    profileMerge: false,
    savedProfileRead: false,
    historyRead: false,
    automaticCohortExpansion: false,
    environmentMutation: false,
    publicCutover: false,
    anonymousTraffic: false,
    scoringChange: false,
    providerChange: false,
    modelChange: false,
    currentMaxApprovedAccountsMustRemain: 3
  }),
  persistenceBoundary: Object.freeze({
    persistence: "none",
    rawQueryPersistence: false,
    recommendationLogWrite: false,
    productionWrite: false,
    compareAfterDashboardLoad: true,
    comparedTables: Object.freeze([
      "skin_profiles",
      "saved_reports",
      "daily_checkins",
      "routine_logs"
    ])
  }),
  privacyBoundary: Object.freeze({
    rawAccountIdInEvidence: false,
    accountHashInEvidence: false,
    accessTokenInEvidence: false,
    cookieInEvidence: false,
    authorizationHeaderInEvidence: false,
    providerKeyInEvidence: false,
    rawProviderPayloadInEvidence: false,
    rawQueryInPermanentEvidence: false,
    artifactSecretScanRequired: true
  }),
  failureBoundary: Object.freeze({
    productionProviderSabotage: false,
    providerUnavailableHttpStatus: 503,
    providerProtocolHttpStatus: 502,
    controlledFailureVerificationOnly: true,
    betaFailureMustNotBreakDashboard: true
  }),
  operationalEvidenceBoundary: Object.freeze({
    dataAi25IsPostLaunchOnly: true,
    operationalBaselineStartAtRequired: true,
    prelaunchQaMaySatisfyDataAi25: false,
    syntheticTrafficMaySatisfyDataAi25: false,
    preBaselineObservationsExcluded: true
  }),
  authoritySources: Object.freeze({
    semanticQuality: "DATA-AI22",
    operationalObservability: "DATA-AI24",
    postLaunchReadiness: "DATA-AI25"
  }),
  completionBoundary: Object.freeze({
    freezeAfterAcceptance: true,
    acceptedStateLabel: "PRE-LAUNCH READY",
    nextAction: "real_service_launch",
    postLaunchAction: "resume_DATA-AI25_after_operational_baseline_start"
  })
});
