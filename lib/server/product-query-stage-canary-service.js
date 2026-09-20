import "server-only";

import { executeProductQueryPreview } from "@/lib/server/product-query-preview-service";

export const PRODUCT_QUERY_STAGE_CANARY_CONTRACT_VERSION =
  "product-query-stage-canary-v1";

function sameArray(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function productIds(preview) {
  return Array.isArray(preview?.results)
    ? preview.results.map((product) => product?.id || null)
    : [];
}

export async function executeProductQueryStageCanary(query) {
  const first = await executeProductQueryPreview(query);
  const second = await executeProductQueryPreview(query);

  const firstIds = productIds(first);
  const secondIds = productIds(second);
  const parity = Object.freeze({
    status: first.status === second.status,
    effectiveCategory: first.effectiveCategory === second.effectiveCategory,
    constraintStatus: first.constraintStatus === second.constraintStatus,
    unresolvedTerms: sameArray(first.unresolvedTerms, second.unresolvedTerms),
    resultOrder: sameArray(firstIds, secondIds)
  });

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_STAGE_CANARY_CONTRACT_VERSION,
    preview: first,
    parity,
    allParity: Object.values(parity).every(Boolean),
    repetitions: 2,
    evidenceRetention: "request_local_only",
    persisted: false
  });
}

export const PRODUCT_QUERY_STAGE_CANARY_LIMITS = Object.freeze({
  manualOnly: true,
  effectiveSampleBps: 0,
  repetitions: 2,
  authenticatedOnly: true,
  profileRead: false,
  historyRead: false,
  persistence: "none",
  productionActivation: false,
  productionShadow: false,
  automaticTrafficSampling: false,
  publicSearchCutover: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerProductSelection: false,
  providerRankingAuthority: false,
  releaseGateImplemented: false
});
