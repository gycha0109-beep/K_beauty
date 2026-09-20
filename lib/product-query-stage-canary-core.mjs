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

function buildParity(first, second) {
  const firstIds = productIds(first);
  const secondIds = productIds(second);

  return Object.freeze({
    status: first?.status === second?.status,
    effectiveCategory: first?.effectiveCategory === second?.effectiveCategory,
    constraintStatus: first?.constraintStatus === second?.constraintStatus,
    unresolvedTerms: sameArray(first?.unresolvedTerms, second?.unresolvedTerms),
    resultOrder: sameArray(firstIds, secondIds)
  });
}

export async function executeProductQueryStageCanaryCore(
  query,
  { executePreview }
) {
  if (typeof executePreview !== "function") {
    throw new TypeError("executePreview must be a function");
  }

  const first = await executePreview(query);
  const second = await executePreview(query);
  const parity = buildParity(first, second);

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
