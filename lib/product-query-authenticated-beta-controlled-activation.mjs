import {
  parseApprovedProductQueryBetaAccountHashes
} from "./product-query-authenticated-beta-runtime.mjs";

export const PRODUCT_QUERY_AUTHENTICATED_BETA_CONTROLLED_ACTIVATION_VERSION =
  "product-query-authenticated-beta-controlled-activation-v1";

export const DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED = true;
export const DATA_AI20_MAX_APPROVED_ACCOUNTS = 3;

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function evaluateProductQueryAuthenticatedBetaControlledActivation(
  envLike = {}
) {
  const approvedHashes = parseApprovedProductQueryBetaAccountHashes(
    envLike.BEJEWELY_PRODUCT_QUERY_BETA_APPROVED_ACCOUNT_HASHES
  );
  const approvedAccountCount = Array.isArray(approvedHashes)
    ? approvedHashes.length
    : 0;

  const checks = Object.freeze({
    productionEnvironment: normalized(envLike.VERCEL_ENV) === "production",
    betaEnabled:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_ENABLED) === "true",
    runtimeAuthorized:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED) ===
      "true",
    emergencyDisableClear:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_EMERGENCY_DISABLE) ===
      "false",
    approvedAccountCohort:
      approvedAccountCount > 0 &&
      approvedAccountCount <= DATA_AI20_MAX_APPROVED_ACCOUNTS,
    automaticTrafficSamplingDisabled:
      normalized(
        envLike.BEJEWELY_PRODUCT_QUERY_BETA_AUTOMATIC_TRAFFIC_SAMPLING
      ) === "false",
    publicSearchCutoverDisabled:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_PUBLIC_SEARCH_CUTOVER) ===
      "false",
    persistenceNone:
      normalized(envLike.BEJEWELY_PRODUCT_QUERY_BETA_PERSISTENCE) === "none"
  });

  const allowed =
    DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED === true &&
    Object.values(checks).every(Boolean);

  return Object.freeze({
    activationVersion:
      PRODUCT_QUERY_AUTHENTICATED_BETA_CONTROLLED_ACTIVATION_VERSION,
    phase: "DATA-AI20",
    allowed,
    phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED,
    approvedAccountCount,
    maxApprovedAccounts: DATA_AI20_MAX_APPROVED_ACCOUNTS,
    checks,
    authenticatedOnly: true,
    automaticTrafficSampling: false,
    publicSearchCutover: false,
    persistence: "none"
  });
}

export const PRODUCT_QUERY_AUTHENTICATED_BETA_CONTROLLED_ACTIVATION =
  Object.freeze({
    phase: "DATA-AI20",
    scope: "authenticated_limited_beta_controlled_activation",
    activationAuthorized: true,
    explicitUserApprovalRecorded: true,
    initialCohortStrategy: "one_account_then_expand_to_max_three",
    accessBoundary: Object.freeze({
      authenticatedOnly: true,
      explicitServerSideBetaEligibilityRequired: true,
      approvedAccountHashAlgorithm: "sha256",
      maxApprovedAccounts: DATA_AI20_MAX_APPROVED_ACCOUNTS,
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
    rollbackBoundary: Object.freeze({
      emergencyDisableRequired: true,
      failClosedOnEmergencyDisable: true,
      rollbackTarget: "authenticated_beta_route_404",
      steps: Object.freeze([
        "set_emergency_disable_true",
        "remove_activation_manifest",
        "remove_data_ai20_route_authorization",
        "verify_exact_production_deployment_404"
      ])
    }),
    nextRequiredPhase: "data_ai21_limited_beta_evidence_closure"
  });
