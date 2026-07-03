const DIVERGENCE_ORDER = [
  "no_comparable_product_ids",
  "candidate_source_incomplete",
  "top_pick_mismatch",
  "existing_selected_but_blocked",
  "existing_selected_but_insufficient_data",
  "existing_selected_ranked_lower",
  "functional_top_candidate_missing_from_existing"
];

function normalizeList(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeId(value) {
  return String(value || "").trim();
}

function roundRate(value) {
  return Math.round(value * 1000) / 1000;
}

function unique(values) {
  return Array.from(new Set(values.map(normalizeId).filter(Boolean)));
}

function getExistingEntries(snapshot = {}) {
  return [
    snapshot.topPick,
    ...normalizeList(snapshot.supportingProducts),
    ...normalizeList(snapshot.budgetAlternatives)
  ].filter((item) => item?.productId);
}

function mapByProductId(items = []) {
  return normalizeList(items).reduce((lookup, item) => {
    const productId = normalizeId(item?.productId || item?.product?.id || item?.evaluation?.productId);

    if (productId) {
      lookup[productId] = item;
    }

    return lookup;
  }, {});
}

function increment(map, key) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function buildOverlap(existingIds, functionalRankedIds) {
  const functionalSet = new Set(functionalRankedIds);
  const existingSet = new Set(existingIds);
  const sharedProductIds = existingIds.filter((id) => functionalSet.has(id)).sort();
  const existingOnlyProductIds = existingIds.filter((id) => !functionalSet.has(id)).sort();
  const functionalOnlyProductIds = functionalRankedIds.filter((id) => !existingSet.has(id)).sort();

  return {
    sharedProductIds,
    existingOnlyProductIds,
    functionalOnlyProductIds
  };
}

function getComparisonConfidence({ existingSnapshot, existingIds, functionalAudit }) {
  const coverage = existingSnapshot?.candidateSourceCoverage || "final_result_only";
  const identityMode = existingSnapshot?.candidateIdentityMode ||
    (coverage === "final_result_only" ? null : "product_row");
  const notes = normalizeList(existingSnapshot?.notes);
  const comparableFunctionalCount =
    Number(functionalAudit?.summary?.rankedCount || 0) +
    Number(functionalAudit?.summary?.blockedCount || 0) +
    Number(functionalAudit?.summary?.insufficientDataCount || 0);

  if (!existingIds.length) {
    return "low";
  }

  if (identityMode === "product_id_only" || identityMode === "unavailable") {
    return "low";
  }

  if (coverage === "complete" && identityMode === "product_row" && comparableFunctionalCount >= existingIds.length) {
    return "high";
  }

  if (coverage === "partial" || (coverage === "complete" && identityMode === "mixed") || !notes.includes("candidate_source_incomplete_final_results_only")) {
    return "medium";
  }

  return "low";
}

function buildCategoryOverlap(existingEntries, rankedCandidates) {
  const existingById = mapByProductId(existingEntries);
  const overlapByCategory = {};

  rankedCandidates.forEach((candidate) => {
    const productId = normalizeId(candidate?.product?.id);
    const existing = existingById[productId];

    if (existing) {
      increment(overlapByCategory, existing.category || candidate?.product?.category);
    }
  });

  return overlapByCategory;
}

function statusForProduct(productId, maps) {
  if (maps.ranked[productId]) {
    return {
      status: "ranked",
      item: maps.ranked[productId]
    };
  }

  if (maps.blocked[productId]) {
    return {
      status: "blocked",
      item: maps.blocked[productId]
    };
  }

  if (maps.insufficient[productId]) {
    return {
      status: "insufficient_data",
      item: maps.insufficient[productId]
    };
  }

  return {
    status: "not_in_functional_audit",
    item: null
  };
}

function divergence(type, data = {}) {
  return {
    type,
    productId: data.productId || null,
    existingSource: data.existingSource || null,
    functionalStatus: data.functionalStatus || null,
    functionalRank: data.functionalRank ?? null,
    functionalScore: data.functionalScore ?? null,
    functionalConfidence: data.functionalConfidence || null,
    reasons: data.reasons || []
  };
}

function sortDivergences(items) {
  return items.slice().sort((left, right) => {
    const typeDelta =
      DIVERGENCE_ORDER.indexOf(left.type) - DIVERGENCE_ORDER.indexOf(right.type);

    if (typeDelta !== 0) {
      return typeDelta;
    }

    return String(left.productId || "").localeCompare(String(right.productId || ""));
  });
}

export function compareFunctionalShadowResults({
  existingSnapshot = {},
  functionalAudit = {}
} = {}) {
  const existingEntries = getExistingEntries(existingSnapshot);
  const existingIds = unique(existingSnapshot.uniqueProductIds || existingEntries.map((item) => item.productId));
  const rankedCandidates = normalizeList(functionalAudit.rankedCandidates);
  const blockedCandidates = normalizeList(functionalAudit.blockedCandidates);
  const insufficientCandidates = normalizeList(functionalAudit.insufficientDataCandidates);
  const functionalRankedIds = unique(rankedCandidates.map((item) => item?.product?.id));
  const rankedMap = mapByProductId(rankedCandidates);
  const blockedMap = mapByProductId(blockedCandidates);
  const insufficientMap = mapByProductId(insufficientCandidates);
  const maps = {
    ranked: rankedMap,
    blocked: blockedMap,
    insufficient: insufficientMap
  };
  const overlap = buildOverlap(existingIds, functionalRankedIds);
  const divergences = [];
  const existingSelectedButBlocked = [];
  const existingSelectedButInsufficientData = [];
  const existingSelectedRanked = [];
  const functionalTopCandidatesNotInExisting = [];

  existingEntries.forEach((entry) => {
    const productId = entry.productId;
    const status = statusForProduct(productId, maps);

    if (status.status === "blocked") {
      const item = status.item;
      existingSelectedButBlocked.push(productId);
      divergences.push(divergence("existing_selected_but_blocked", {
        productId,
        existingSource: entry.source,
        functionalStatus: "blocked",
        functionalConfidence: item.confidence,
        reasons: item.hardFilterReasons || []
      }));
    } else if (status.status === "insufficient_data") {
      const item = status.item;
      existingSelectedButInsufficientData.push(productId);
      divergences.push(divergence("existing_selected_but_insufficient_data", {
        productId,
        existingSource: entry.source,
        functionalStatus: "insufficient_data",
        functionalConfidence: item.confidence,
        reasons: item.hardFilterReasons || []
      }));
    } else if (status.status === "ranked") {
      const item = status.item;
      existingSelectedRanked.push(productId);

      if (Number(item.rank || 0) > Number(entry.rank || 0) + 2) {
        divergences.push(divergence("existing_selected_ranked_lower", {
          productId,
          existingSource: entry.source,
          functionalStatus: "ranked",
          functionalRank: item.rank,
          functionalScore: item.evaluation?.totalScore,
          functionalConfidence: item.evaluation?.confidence,
          reasons: ["Existing selected product ranks meaningfully lower in functional audit."]
        }));
      }
    }
  });

  const existingSet = new Set(existingIds);
  rankedCandidates.slice(0, 3).forEach((candidate) => {
    const productId = normalizeId(candidate?.product?.id);

    if (productId && !existingSet.has(productId)) {
      functionalTopCandidatesNotInExisting.push(productId);
      divergences.push(divergence("functional_top_candidate_missing_from_existing", {
        productId,
        functionalStatus: "ranked",
        functionalRank: candidate.rank,
        functionalScore: candidate.evaluation?.totalScore,
        functionalConfidence: candidate.evaluation?.confidence,
        reasons: ["Functional audit top candidate is absent from the existing result snapshot."]
      }));
    }
  });

  const existingTopPickId = existingSnapshot?.topPick?.productId || null;
  const functionalTopPickId = rankedCandidates[0]?.product?.id || null;
  const topPickMatches = Boolean(existingTopPickId && functionalTopPickId && existingTopPickId === functionalTopPickId);
  const existingTopPickStatus = existingTopPickId ? statusForProduct(existingTopPickId, maps) : { status: "missing", item: null };
  const functionalTopPickInExistingResult = Boolean(functionalTopPickId && existingSet.has(functionalTopPickId));

  if (existingTopPickId && functionalTopPickId && !topPickMatches) {
    divergences.push(divergence("top_pick_mismatch", {
      productId: existingTopPickId,
      existingSource: "top_pick",
      functionalStatus: existingTopPickStatus.status,
      functionalRank: existingTopPickStatus.item?.rank,
      functionalScore: existingTopPickStatus.item?.evaluation?.totalScore,
      functionalConfidence: existingTopPickStatus.item?.evaluation?.confidence,
      reasons: [`Functional audit rank 1 is ${functionalTopPickId}.`]
    }));
  }

  if (!existingIds.length) {
    divergences.push(divergence("no_comparable_product_ids", {
      reasons: ["Existing result snapshot has no product IDs for comparison."]
    }));
  }

  if (normalizeList(existingSnapshot.notes).includes("candidate_source_incomplete_final_results_only")) {
    divergences.push(divergence("candidate_source_incomplete", {
      reasons: ["Existing snapshot appears to contain final selected products only, not the full original candidate source."]
    }));
  }

  const overlapRate = existingIds.length
    ? roundRate(overlap.sharedProductIds.length / existingIds.length)
    : 0;
  const comparisonConfidence = getComparisonConfidence({
    existingSnapshot,
    existingIds,
    functionalAudit
  });

  return {
    comparisonSummary: {
      existingUniqueCount: existingIds.length,
      functionalRankedCount: Number(functionalAudit?.summary?.rankedCount || rankedCandidates.length),
      functionalBlockedCount: Number(functionalAudit?.summary?.blockedCount || blockedCandidates.length),
      functionalInsufficientDataCount: Number(functionalAudit?.summary?.insufficientDataCount || insufficientCandidates.length),
      overlapCount: overlap.sharedProductIds.length,
      overlapRate,
      existingOnlyCount: overlap.existingOnlyProductIds.length,
      functionalOnlyCount: overlap.functionalOnlyProductIds.length,
      topPickMatch: topPickMatches,
      comparisonConfidence
    },
    overlap,
    divergences: sortDivergences(divergences),
    categoryComparison: {
      existing: existingSnapshot.categoryDistribution || {},
      functionalRanked: functionalAudit?.summary?.categoryDistribution?.ranked || {},
      functionalBlocked: functionalAudit?.summary?.categoryDistribution?.blocked || {},
      functionalInsufficientData: functionalAudit?.summary?.categoryDistribution?.insufficientData || {},
      overlapByCategory: buildCategoryOverlap(existingEntries, rankedCandidates)
    },
    topPickComparison: {
      existingTopPickId,
      functionalTopPickId,
      matches: topPickMatches,
      existingTopPickFunctionalStatus: existingTopPickStatus.status,
      existingTopPickFunctionalRank: existingTopPickStatus.item?.rank || null,
      existingTopPickFunctionalScore: existingTopPickStatus.item?.evaluation?.totalScore ?? null,
      functionalTopPickInExistingResult,
      notes: [
        ...(existingTopPickId ? [] : ["existing_top_pick_missing"]),
        ...(functionalTopPickId ? [] : ["functional_top_pick_missing"])
      ]
    },
    candidateStatusComparison: {
      existingSelectedButBlocked,
      existingSelectedButInsufficientData,
      existingSelectedRanked,
      functionalTopCandidatesNotInExisting
    },
    policyNotes: [
      "Shadow comparison is audit-only and does not replace existing recommendation results.",
      "Divergence is not an error; it records where the two ranking policies behave differently.",
      "Comparison confidence describes source comparability, not recommendation quality."
    ]
  };
}
