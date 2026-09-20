export const PRODUCT_QUERY_STAGE_CANARY_POLICY_VERSION =
  "product-query-stage-canary-policy-v1";

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function evaluateProductQueryStageCanaryPolicy(envLike = {}) {
  const requested =
    normalized(envLike.BEJEWELY_PRODUCT_QUERY_STAGE_CANARY_ENABLED) === "true";
  const vercelEnv = normalized(envLike.VERCEL_ENV);
  const nodeEnv = normalized(envLike.NODE_ENV);
  const stageEquivalent = vercelEnv === "preview" || nodeEnv === "test";
  const allowed = requested && stageEquivalent && vercelEnv !== "production";

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_STAGE_CANARY_POLICY_VERSION,
    allowed,
    requested,
    stageEquivalent,
    vercelEnv,
    nodeEnv,
    effectiveSampleBps: 0,
    productionAllowed: false
  });
}

export const PRODUCT_QUERY_STAGE_CANARY_POLICY_LIMITS = Object.freeze({
  defaultEnabled: false,
  manualOnly: true,
  effectiveSampleBps: 0,
  productionActivation: false,
  productionShadow: false,
  automaticTrafficSampling: false,
  publicSearchCutover: false,
  persistence: "none",
  releaseGateImplemented: false
});
