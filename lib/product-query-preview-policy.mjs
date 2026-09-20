export const PRODUCT_QUERY_PREVIEW_POLICY_VERSION = "product-query-preview-policy-v1";

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function evaluateProductQueryPreviewPolicy(envLike = {}) {
  const requested = normalized(envLike.BEJEWELY_PRODUCT_QUERY_PREVIEW_ENABLED) === "true";
  const vercelEnv = normalized(envLike.VERCEL_ENV);
  const allowed = requested && vercelEnv === "preview";

  return Object.freeze({
    policyVersion: PRODUCT_QUERY_PREVIEW_POLICY_VERSION,
    allowed,
    requested,
    vercelEnv,
    productionAllowed: false
  });
}

export const PRODUCT_QUERY_PREVIEW_POLICY_LIMITS = Object.freeze({
  defaultEnabled: false,
  previewEnvironmentOnly: true,
  productionActivation: false,
  browserControlledActivation: false,
  requestControlledActivation: false
});
