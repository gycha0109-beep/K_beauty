function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCategory(value) {
  return normalizeText(value).toLowerCase() || null;
}

function getProductId(product) {
  return normalizeText(product?.id || product?.productId || product?.product_id) || null;
}

function unwrapProduct(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return item.product && typeof item.product === "object" ? item.product : item;
}

function normalizeLegacyItem(item, source, rank) {
  const product = unwrapProduct(item);
  const productId = getProductId(product);

  if (!productId) {
    return null;
  }

  return {
    productId,
    category: normalizeCategory(product?.category || item?.category),
    rank,
    source
  };
}

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function increment(map, key) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function collectOrderedIds(groups) {
  const ids = [];

  groups.flat().forEach((item) => pushUnique(ids, item?.productId));
  return ids;
}

function buildSourceById(groups) {
  return groups.flat().reduce((lookup, item) => {
    if (!item?.productId) {
      return lookup;
    }

    if (!lookup[item.productId]) {
      lookup[item.productId] = [];
    }

    lookup[item.productId].push({
      source: item.source,
      rank: item.rank,
      category: item.category
    });
    return lookup;
  }, {});
}

function buildCategoryDistribution(groups) {
  return groups.flat().reduce((distribution, item) => {
    increment(distribution, item?.category);
    return distribution;
  }, {});
}

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

export function buildExistingRecommendationSnapshot(existingResult = {}) {
  const notes = [];
  const topPick = normalizeLegacyItem(existingResult?.topPick, "top_pick", 1);
  const supportingSource =
    existingResult?.premiumReport?.supportingProducts ||
    existingResult?.supportingProducts ||
    [];
  const budgetSource =
    existingResult?.premiumReport?.budgetAlternatives ||
    existingResult?.budgetAlternatives ||
    [];
  const supportingProducts = normalizeList(supportingSource)
    .map((item, index) => normalizeLegacyItem(item, "supporting", index + 1))
    .filter(Boolean);
  const budgetAlternatives = normalizeList(budgetSource)
    .map((item, index) => normalizeLegacyItem(item, "budget", index + 1))
    .filter(Boolean);

  if (existingResult?.topPick && !topPick) {
    notes.push("top_pick_missing_product_id");
  }

  if (normalizeList(supportingSource).length > supportingProducts.length) {
    notes.push("supporting_products_missing_product_id");
  }

  if (normalizeList(budgetSource).length > budgetAlternatives.length) {
    notes.push("budget_alternatives_missing_product_id");
  }

  const groups = [[topPick].filter(Boolean), supportingProducts, budgetAlternatives];
  const orderedProductIds = collectOrderedIds(groups);

  if (!orderedProductIds.length) {
    notes.push("no_comparable_product_ids");
  }

  const candidateSourceCoverage =
    existingResult?.candidateSourceCoverage ||
    existingResult?.shadowCandidateSourceCoverage ||
    "final_result_only";

  if (candidateSourceCoverage === "final_result_only") {
    notes.push("candidate_source_incomplete_final_results_only");
  }

  return {
    topPick,
    supportingProducts,
    budgetAlternatives,
    orderedProductIds,
    uniqueProductIds: [...orderedProductIds],
    productSourceById: buildSourceById(groups),
    categoryDistribution: buildCategoryDistribution(groups),
    candidateSourceCoverage,
    notes
  };
}

function normalizeCandidateSource(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (Array.isArray(input?.products)) {
    return input.products;
  }

  if (Array.isArray(input?.scoredProducts)) {
    return input.scoredProducts;
  }

  if (Array.isArray(input?.candidates)) {
    return input.candidates;
  }

  return [];
}

function productFromSnapshotItem(item) {
  if (!item?.productId) {
    return null;
  }

  return {
    id: item.productId,
    category: item.category || ""
  };
}

export function resolveShadowAuditCandidateSource({
  existingCandidateSource,
  existingRecommendationSnapshot,
  options = {}
} = {}) {
  const notes = [];
  const sourceProducts = normalizeCandidateSource(existingCandidateSource);
  const products = [];
  let sourceType = "empty";
  let excludedCount = 0;

  if (sourceProducts.length) {
    sourceType = "provided_candidate_source";
    sourceProducts.forEach((item) => {
      const product = unwrapProduct(item);

      if (product && typeof product === "object") {
        products.push(product);
      } else {
        excludedCount += 1;
      }
    });
  } else {
    sourceType = "selected_result_snapshot";
    notes.push("candidate_source_incomplete_final_results_only");
    [
      existingRecommendationSnapshot?.topPick,
      ...(existingRecommendationSnapshot?.supportingProducts || []),
      ...(existingRecommendationSnapshot?.budgetAlternatives || [])
    ].forEach((item) => {
      const product = productFromSnapshotItem(item);

      if (product) {
        products.push(product);
      } else {
        excludedCount += 1;
      }
    });
  }

  if (!products.length) {
    notes.push("no_candidate_source_products");
  }

  if (options?.note) {
    notes.push(String(options.note));
  }

  return {
    products,
    sourceType,
    sourceCount: products.length,
    excludedCount,
    notes
  };
}
