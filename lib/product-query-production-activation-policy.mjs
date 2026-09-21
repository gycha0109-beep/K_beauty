import {
  PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE
} from "./product-query-hosted-preview-acceptance-evidence.mjs";

export const PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_VERSION =
  "product-query-production-activation-policy-v1";

export const PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS = 100;

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseSampleBps(value) {
  const raw = String(value ?? "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) return null;
  if (parsed < 1 || parsed > PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS) {
    return null;
  }
  return parsed;
}

export function evaluateProductQueryProductionActivationPolicy(envLike = {}) {
  const vercelEnv = normalized(envLike.VERCEL_ENV);
  const productionEnvironment = vercelEnv === "production";
  const activationRequested =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_ACTIVATION_ENABLED) === "true";
  const canaryModeRequested =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_CANARY_MODE) === "true";
  const killSwitchExplicitlyDisarmed =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_KILL_SWITCH) === "false";
  const killSwitchEngaged = !killSwitchExplicitlyDisarmed;
  const cohort =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_COHORT);
  const authenticatedBoundedCohort = cohort === "authenticated_bounded";
  const configuredSampleBps =
    parseSampleBps(envLike.BEJEWELY_PRODUCT_QUERY_PRODUCTION_SAMPLE_BPS);
  const sampleConfigurationValid = configuredSampleBps !== null;
  const hostedAcceptanceSatisfied =
    PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE.authenticatedPreviewAccepted === true &&
    PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE.stageCanaryAccepted === true &&
    PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE.stageCanaryAllParity === true &&
    PRODUCT_QUERY_HOSTED_PREVIEW_ACCEPTANCE_EVIDENCE.productionEnvironment === false;

  const configurationEligible =
    productionEnvironment &&
    activationRequested &&
    canaryModeRequested &&
    !killSwitchEngaged &&
    authenticatedBoundedCohort &&
    sampleConfigurationValid &&
    hostedAcceptanceSatisfied;

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_VERSION,
    productionEnvironment,
    activationRequested,
    canaryModeRequested,
    killSwitchEngaged,
    authenticatedBoundedCohort,
    configuredSampleBps: configuredSampleBps ?? 0,
    maximumSampleBps: PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS,
    sampleConfigurationValid,
    hostedAcceptanceSatisfied,
    configurationEligible,
    activationAllowed: false,
    effectiveSampleBps: 0,
    activationDecision: "not_authorized"
  });
}

export const PRODUCT_QUERY_PRODUCTION_ACTIVATION_POLICY_LIMITS = Object.freeze({
  phase: "DATA-AI11",
  designOnly: true,
  defaultEnabled: false,
  productionEnvironmentOnly: true,
  explicitActivationFlagRequired: true,
  explicitCanaryModeRequired: true,
  explicitKillSwitchDisarmRequired: true,
  authenticatedBoundedCohortOnly: true,
  maximumSampleBps: PRODUCT_QUERY_PRODUCTION_ACTIVATION_MAX_SAMPLE_BPS,
  effectiveSampleBps: 0,
  productionActivation: false,
  productionShadow: false,
  automaticTrafficSampling: false,
  publicSearchCutover: false,
  anonymousTraffic: false,
  browserControlledActivation: false,
  requestControlledActivation: false,
  persistence: "none",
  rawQueryPersistence: false,
  accessTokenPersistence: false,
  savedProfileRead: false,
  historyRead: false,
  productFactDirectRead: false,
  taxonomyRuntimeAuthority: false,
  providerProductSelection: false,
  providerRankingAuthority: false,
  deterministicRankingAuthorityPreserved: true,
  productionEnvironmentMutation: false,
  releaseGateImplemented: false,
  fallbackMode: "existing_path",
  futureRuntimeActivationRequiresSeparateExplicitPhase: true
});
