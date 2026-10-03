export const TRUST_SUBJECT_REPROCESS_RPC =
  "process_catalog_trust_product_v3";
export const TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION =
  "product-fact-registry-cross-category-v1";
export const TRUST_SUBJECT_REPROCESS_ORCHESTRATOR_VERSION =
  "v21-8g1-identity-authority-preserving-v1";

export async function runTrustSubjectRegistryPinnedReprocess(
  client,
  productId
) {
  return client.rpc(TRUST_SUBJECT_REPROCESS_RPC, {
    p_product_id: productId,
    p_registry_version: TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION
  });
}

export function isTrustSubjectRegistryPinnedReprocessResult(
  value,
  productId
) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.status === "processed" &&
      value.product_id === productId &&
      value.registry_version === TRUST_SUBJECT_REPROCESS_REGISTRY_VERSION &&
      value.registry_selection === "explicit" &&
      value.orchestrator_version ===
        TRUST_SUBJECT_REPROCESS_ORCHESTRATOR_VERSION
  );
}
