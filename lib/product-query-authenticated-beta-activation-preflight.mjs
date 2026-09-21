import {
  DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED,
  PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_LIMITS,
  parseApprovedProductQueryBetaAccountHashes
} from "./product-query-authenticated-beta-runtime.mjs";

export const PRODUCT_QUERY_AUTHENTICATED_BETA_ACTIVATION_PREFLIGHT_VERSION =
  "product-query-authenticated-beta-activation-preflight-v1";

export const DATA_AI19_BETA_ACTIVATION_AUTHORIZED = false;
export const DATA_AI19_INITIAL_BETA_MAX_APPROVED_ACCOUNTS = 5;

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function evaluateProductQueryAuthenticatedBetaActivationPreflight(
  envLike = {},
  { explicitActivationApproval = false } = {}
) {
  const approvedHashes = parseApprovedProductQueryBetaAccountHashes(
    envLike.BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES
  );
  const approvedAccountCount = Array.isArray(approvedHashes)
    ? approvedHashes.length
    : 0;

  const checks = Object.freeze({
    productionEnvironment: normalized(envLike.VERCEL_ENV) === "production",
    betaRequested:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_ENABLED) === "true",
    runtimeRequested:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED) === "true",
    emergencyDisableClear:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE) === "false",
    approvedAccountCohort:
      approvedAccountCount > 0 &&
      approvedAccountCount <= DATA_AI19_INITIAL_BETA_MAX_APPROVED_ACCOUNTS,
    automaticTrafficSamplingDisabled:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING) ===
      "false",
    publicSearchCutoverDisabled:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER) ===
      "false",
    persistenceNone:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE) === "none",
    explicitActivationApproval: explicitActivationApproval === true
  });

  const preflightReady = Object.values(checks).every(Boolean);

  return Object.freeze({
    preflightVersion:
      PRODUCT_QUERY_AUTHENTICATED_BETA_ACTIVATION_PREFLIGHT_VERSION,
    phase: "DATA-AI19",
    preflightReady,
    activationAuthorized: DATA_AI19_BETA_ACTIVATION_AUTHORIZED,
    currentRuntimePhaseAuthorized: DATA_AI18_BETA_RUNTIME_PHASE_AUTHORIZED,
    approvedAccountCount,
    checks,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persistence: "none"
  });
}

export const PRODUCT_QUERY_AUTHENTICATED_BETA_ACTIVATION_SAFETY = Object.freeze({
  phase: "DATA-AI19",
  scope: "authenticated_limited_beta_activation_preflight_only",
  activationAuthorized: false,
  actualProductionActivationInScope: false,
  prerequisite: Object.freeze({
    runtimePhase: PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_LIMITS.phase,
    runtimeDefaultEnabled:
      PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_LIMITS.defaultEnabled,
    runtimePhaseAuthorized:
      PRODUCT_QUERY_AUTHENTICATED_BETA_RUNTIME_LIMITS.phaseRuntimeAuthorized
  }),
  accessBoundary: Object.freeze({
    authenticatedOnly: true,
    explicitServerSideBetaEligibilityRequired: true,
    approvedAccountHashAlgorithm: "sha256",
    maxInitialApprovedAccounts:
      DATA_AI19_INITIAL_BETA_MAX_APPROVED_ACCOUNTS,
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
  safetyBoundary: Object.freeze({
    explicitSeparateActivationApprovalRequired: true,
    emergencyDisableRequired: true,
    failClosedOnMissingApproval: true,
    failClosedOnInvalidAllowlist: true,
    failClosedOnEmergencyDisable: true,
    rollbackProcedure: Object.freeze([
      "set_emergency_disable_true",
      "remove_beta_activation_environment_manifest",
      "restore_code_phase_authorization_false",
      "verify_deployed_beta_route_404"
    ])
  }),
  nextRequiredPhase:
    "data_ai20_authenticated_limited_beta_controlled_activation",
  nextPhaseRequiresExplicitUserApproval: true
});
