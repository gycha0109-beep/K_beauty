export const D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION =
  "data-ai29c-d5d-spf-runtime-activation-v1";

export const D5D_SPF_RUNTIME_ACTIVATION_SCOPE =
  "authenticated_product_query_beta";

export function normalizeD5dSpfRuntimeActivation(payload) {
  const failClosed = (reason) =>
    Object.freeze({
      contractVersion:
        D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION,
      scope: D5D_SPF_RUNTIME_ACTIVATION_SCOPE,
      enabled: false,
      authorizedPhase: "DATA-AI29C-D5D",
      updatedAt: null,
      reason,
    });

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return failClosed("D5D_ACTIVATION_PAYLOAD_INVALID");
  }

  if (
    payload.contract_version !==
      D5D_SPF_RUNTIME_ACTIVATION_CONTRACT_VERSION ||
    payload.scope !== D5D_SPF_RUNTIME_ACTIVATION_SCOPE ||
    payload.authorized_phase !== "DATA-AI29C-D5D"
  ) {
    return failClosed("D5D_ACTIVATION_CONTRACT_MISMATCH");
  }

  if (typeof payload.enabled !== "boolean") {
    return failClosed("D5D_ACTIVATION_ENABLED_INVALID");
  }

  const payloadReason =
    typeof payload.reason === "string" && payload.reason
      ? payload.reason
      : null;

  return Object.freeze({
    contractVersion: payload.contract_version,
    scope: payload.scope,
    enabled: payload.enabled === true,
    authorizedPhase: payload.authorized_phase,
    updatedAt:
      typeof payload.updated_at === "string"
        ? payload.updated_at
        : null,
    reason: payloadReason,
  });
}
