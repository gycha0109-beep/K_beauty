export const RECOMMENDATION_PRODUCT_ENUMERATION_VERSION =
  "recommendation-product-enumeration-v1";
export const RECOMMENDATION_PRODUCT_PAGE_SIZE = 200;
export const RECOMMENDATION_PRODUCT_MAX_PAGES = 1000;

export class RecommendationProductEnumerationError extends Error {
  constructor(reason, options = {}) {
    super("Recommendation product enumeration failed closed.");
    this.name = "RecommendationProductEnumerationError";
    this.code = "RECOMMENDATION_PRODUCT_ENUMERATION_FAILED";
    this.reason = String(reason || "ENUMERATION_FAILED");
    this.cause = options.cause;
  }
}

function compareIdentity(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export async function enumerateRecommendationProductsDeterministically({
  fetchPage,
  pageSize = RECOMMENDATION_PRODUCT_PAGE_SIZE,
  maxPages = RECOMMENDATION_PRODUCT_MAX_PAGES,
} = {}) {
  if (typeof fetchPage !== "function") {
    throw new RecommendationProductEnumerationError("FETCH_PAGE_REQUIRED");
  }
  if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > 1000) {
    throw new RecommendationProductEnumerationError("INVALID_PAGE_SIZE");
  }
  if (!Number.isInteger(maxPages) || maxPages <= 0) {
    throw new RecommendationProductEnumerationError("INVALID_MAX_PAGES");
  }

  const rows = [];
  const seen = new Set();
  let afterId = null;

  for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
    let page;
    try {
      page = await fetchPage({ afterId, limit: pageSize, pageNumber });
    } catch (error) {
      throw new RecommendationProductEnumerationError("PAGE_QUERY_FAILED", { cause: error });
    }

    if (!Array.isArray(page)) {
      throw new RecommendationProductEnumerationError("MALFORMED_PAGE_RESPONSE");
    }
    if (page.length > pageSize) {
      throw new RecommendationProductEnumerationError("PAGE_SIZE_CONTRACT_VIOLATION");
    }
    if (page.length === 0) {
      return Object.freeze({
        version: RECOMMENDATION_PRODUCT_ENUMERATION_VERSION,
        rows: Object.freeze(rows.map((row) => Object.freeze({ ...row }))),
        enumeratedCount: rows.length,
        pageCount: pageNumber,
      });
    }

    let previousId = afterId;
    for (const row of page) {
      const id = typeof row?.id === "string" ? row.id : "";
      if (!id) {
        throw new RecommendationProductEnumerationError("PRODUCT_ID_MISSING");
      }
      if (seen.has(id)) {
        throw new RecommendationProductEnumerationError("DUPLICATE_PRODUCT_ID");
      }
      if (previousId !== null && compareIdentity(id, previousId) <= 0) {
        throw new RecommendationProductEnumerationError("NON_MONOTONIC_PRODUCT_ID_ORDER");
      }
      seen.add(id);
      rows.push(row);
      previousId = id;
    }

    afterId = previousId;
    if (page.length < pageSize) {
      return Object.freeze({
        version: RECOMMENDATION_PRODUCT_ENUMERATION_VERSION,
        rows: Object.freeze(rows.map((row) => Object.freeze({ ...row }))),
        enumeratedCount: rows.length,
        pageCount: pageNumber,
      });
    }
  }

  throw new RecommendationProductEnumerationError("ENUMERATION_SCALE_CEILING_EXCEEDED");
}
