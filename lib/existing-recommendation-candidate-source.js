const VALID_COMPLETENESS = new Set(["complete", "partial", "final_results_only", "unavailable"]);
const VALID_SOURCE_STAGES = new Set([
  "pre_rank_candidate_pool",
  "post_filter_candidate_pool",
  "post_score_candidate_pool",
  "final_results_only",
  "unavailable"
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStage(value, fallback = "unavailable") {
  const normalized = normalizeText(value);
  return VALID_SOURCE_STAGES.has(normalized) ? normalized : fallback;
}

function normalizeCompleteness(value, fallback = "unavailable") {
  const normalized = normalizeText(value);
  return VALID_COMPLETENESS.has(normalized) ? normalized : fallback;
}

function normalizeNotes(notes) {
  const list = Array.isArray(notes) ? notes : notes ? [notes] : [];

  return Array.from(
    new Set(
      list
        .map((note) => normalizeText(note))
        .filter(Boolean)
    )
  ).sort();
}

function unwrapProduct(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return item.product && typeof item.product === "object" ? item.product : item;
}

function getProductId(product) {
  return normalizeText(product?.id || product?.productId || product?.product_id) || null;
}

function hasProductRowFields(product) {
  return Boolean(
    product &&
      typeof product === "object" &&
      getProductId(product) &&
      (product.category || product.product_form || product.productForm || product.concerns || product.skin_types)
  );
}

function resolveIdentityMode(products) {
  if (!products.length) {
    return "unavailable";
  }

  const rowCount = products.filter(hasProductRowFields).length;
  const idOnlyCount = products.filter((product) => getProductId(product) && !hasProductRowFields(product)).length;

  if (rowCount === products.length) {
    return "product_row";
  }

  if (idOnlyCount === products.length) {
    return "product_id_only";
  }

  return "mixed";
}

function uniqueProducts(products) {
  const seen = new Set();
  const output = [];

  (Array.isArray(products) ? products : []).forEach((item) => {
    const product = unwrapProduct(item);
    const id = getProductId(product);

    if (!id || seen.has(id)) {
      return;
    }

    seen.add(id);
    output.push(product);
  });

  return output;
}

function inferCompleteness({ products, sourceStage, requestedCompleteness, candidateIdentityMode }) {
  if (!products.length) {
    return "unavailable";
  }

  if (requestedCompleteness) {
    return normalizeCompleteness(requestedCompleteness);
  }

  if (sourceStage === "final_results_only") {
    return "final_results_only";
  }

  if (candidateIdentityMode === "product_id_only") {
    return "partial";
  }

  if (sourceStage === "post_score_candidate_pool" || sourceStage === "pre_rank_candidate_pool") {
    return "complete";
  }

  if (sourceStage === "post_filter_candidate_pool") {
    return "partial";
  }

  return "partial";
}

export function buildExistingRecommendationCandidateSource({
  products,
  sourceStage,
  sourceNotes,
  completeness,
  candidateIdentityMode
} = {}) {
  const normalizedProducts = uniqueProducts(products);
  const resolvedStage = normalizedProducts.length
    ? normalizeStage(sourceStage, "post_score_candidate_pool")
    : normalizeStage(sourceStage, "unavailable");
  const resolvedIdentityMode = candidateIdentityMode || resolveIdentityMode(normalizedProducts);
  const resolvedCompleteness = inferCompleteness({
    products: normalizedProducts,
    sourceStage: resolvedStage,
    requestedCompleteness: completeness,
    candidateIdentityMode: resolvedIdentityMode
  });
  const notes = normalizeNotes(sourceNotes);

  if (resolvedCompleteness === "complete") {
    notes.push("existing_candidate_pool_reused");
  }

  if (resolvedStage === "post_score_candidate_pool") {
    notes.push("candidate_source_after_existing_score_sort");
  }

  if (resolvedStage === "post_filter_candidate_pool") {
    notes.push("candidate_source_filtered_before_capture");
  }

  if (resolvedCompleteness === "final_results_only") {
    notes.push("legacy_result_only");
  }

  if (resolvedCompleteness === "unavailable") {
    notes.push("candidate_rows_not_available_in_route");
  }

  return {
    products: normalizedProducts,
    completeness: resolvedCompleteness,
    sourceStage: resolvedCompleteness === "unavailable" ? "unavailable" : resolvedStage,
    sourceCount: normalizedProducts.length,
    sourceNotes: normalizeNotes(notes),
    candidateIdentityMode: resolvedIdentityMode
  };
}

export function buildFinalResultsOnlyCandidateSource(products = []) {
  return buildExistingRecommendationCandidateSource({
    products,
    completeness: products?.length ? "final_results_only" : "unavailable",
    sourceStage: products?.length ? "final_results_only" : "unavailable",
    sourceNotes: products?.length ? ["legacy_result_only"] : ["candidate_rows_not_available_in_route"]
  });
}
