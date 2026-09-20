import "server-only";

import { runNaturalLanguageProductQueryShadow } from "@/lib/server/product-query-shadow-service";

export const PRODUCT_QUERY_PREVIEW_CONTRACT_VERSION = "product-query-preview-v1";

const MAX_QUERY_LENGTH = 500;
const RESULT_LIMIT = 5;

function createError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeQuery(query) {
  if (typeof query !== "string") throw createError("PRODUCT_QUERY_PREVIEW_INPUT_INVALID");
  const normalized = query.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > MAX_QUERY_LENGTH) {
    throw createError("PRODUCT_QUERY_PREVIEW_INPUT_INVALID");
  }
  return normalized;
}

function projectProduct(product) {
  return Object.freeze({
    id: product?.id || null,
    brand: product?.brand || null,
    name: product?.name || null,
    category: product?.category || null,
    whyPicked: Object.freeze(Array.isArray(product?.whyPicked) ? [...product.whyPicked] : []),
    cautionNote: product?.cautionNote || null
  });
}

export async function executeProductQueryPreview(query) {
  const normalizedQuery = normalizeQuery(query);
  const shadow = await runNaturalLanguageProductQueryShadow(normalizedQuery, {
    limit: RESULT_LIMIT
  });
  const execution = shadow.execution || {};

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_PREVIEW_CONTRACT_VERSION,
    status: execution.status || "no_candidates",
    effectiveCategory: execution.effectiveCategory || null,
    constraintStatus: execution.constraintStatus || "resolved",
    unresolvedTerms: Object.freeze(
      Array.isArray(execution.unresolvedTerms) ? [...execution.unresolvedTerms] : []
    ),
    results: Object.freeze(
      Array.isArray(execution.results) ? execution.results.map(projectProduct) : []
    ),
    persisted: false
  });
}

export const PRODUCT_QUERY_PREVIEW_LIMITS = Object.freeze({
  maxQueryLength: MAX_QUERY_LENGTH,
  resultLimit: RESULT_LIMIT,
  authenticatedOnly: true,
  profileRead: false,
  historyRead: false,
  persistence: "none",
  productionWrite: false,
  recommendationLogWrite: false,
  directProductFactRead: false,
  taxonomyRuntimeAuthority: false,
  providerProductSelection: false,
  providerRankingAuthority: false,
  publicProductionActivation: false
});
