const DEFAULT_OPTIONS = {
  includedConfidence: ["high"],
  minimumComparableCases: 5,
  minimumRepeatCount: 2,
  minimumRepeatRate: 0.2,
  immediateSafetyReviewCount: 1,
  categoryMinimumCount: 3,
  includeMediumSeparately: true
};

const COMPARISON_LIMIT_TYPES = new Set([
  "candidate_source_incomplete",
  "no_comparable_product_ids",
  "existing_selected_but_insufficient_data"
]);

const SAFETY_REASON_KEYS = [
  ["high sensitivity", "high_sensitivity"],
  ["recent instability", "recent_instability"],
  ["eye sensitivity", "eye_sensitivity"],
  ["eye-sting", "eye_sting"],
  ["white-cast", "white_cast"],
  ["pilling", "pilling"],
  ["irritation", "irritation_risk"],
  ["non-sensitive-safe", "non_sensitive_safe"]
];

function normalizeOptions(options = {}) {
  const includedConfidence = Array.isArray(options.includedConfidence) && options.includedConfidence.length
    ? options.includedConfidence
    : DEFAULT_OPTIONS.includedConfidence;

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    includedConfidence: includedConfidence.map((item) => String(item || "").trim()).filter(Boolean),
    minimumComparableCases: Number.isFinite(Number(options.minimumComparableCases))
      ? Math.max(0, Number(options.minimumComparableCases))
      : DEFAULT_OPTIONS.minimumComparableCases,
    minimumRepeatCount: Number.isFinite(Number(options.minimumRepeatCount))
      ? Math.max(1, Number(options.minimumRepeatCount))
      : DEFAULT_OPTIONS.minimumRepeatCount,
    minimumRepeatRate: Number.isFinite(Number(options.minimumRepeatRate))
      ? Math.max(0, Number(options.minimumRepeatRate))
      : DEFAULT_OPTIONS.minimumRepeatRate,
    immediateSafetyReviewCount: Number.isFinite(Number(options.immediateSafetyReviewCount))
      ? Math.max(1, Number(options.immediateSafetyReviewCount))
      : DEFAULT_OPTIONS.immediateSafetyReviewCount,
    categoryMinimumCount: Number.isFinite(Number(options.categoryMinimumCount))
      ? Math.max(1, Number(options.categoryMinimumCount))
      : DEFAULT_OPTIONS.categoryMinimumCount,
    includeMediumSeparately: options.includeMediumSeparately !== false
  };
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function confidenceOf(result) {
  return result?.comparison?.comparisonSummary?.comparisonConfidence || "low";
}

function rankingContextOf(result = {}) {
  return {
    rankingGoal: result?.rankingContext?.rankingGoal || null,
    safetyGoal: result?.rankingContext?.safetyGoal || null,
    recommendationGuard: result?.rankingContext?.recommendationGuard || null,
    hasTension: Boolean(result?.rankingContext?.hasTension)
  };
}

function stableKey(value) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown";
}

function reasonKey(reason) {
  const normalized = String(reason || "").toLowerCase();
  const matched = SAFETY_REASON_KEYS.find(([needle]) => normalized.includes(needle));

  if (matched) {
    return matched[1];
  }

  return stableKey(reason).slice(0, 96);
}

function increment(map, key, amount = 1) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + amount;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function makeEmptyDistribution() {
  return { high: 0, medium: 0, low: 0 };
}

function buildConfidenceDistribution(results) {
  const distribution = makeEmptyDistribution();

  results.forEach((result) => increment(distribution, confidenceOf(result)));
  return distribution;
}

function sortByKey(items, keyFn) {
  return items.slice().sort((left, right) => String(keyFn(left)).localeCompare(String(keyFn(right))));
}

function collectDivergenceRecords(results) {
  const records = [];

  results.forEach((result, resultIndex) => {
    const context = rankingContextOf(result);
    const comparison = result?.comparison || {};
    const confidence = comparison?.comparisonSummary?.comparisonConfidence || confidenceOf(result);

    list(comparison.divergences).forEach((divergence, divergenceIndex) => {
      records.push({
        captureId: result?.captureId || null,
        fileName: result?.fileName || null,
        resultIndex,
        divergenceIndex,
        type: divergence?.type || "unknown",
        productId: divergence?.productId || null,
        category: divergence?.category || null,
        existingSource: divergence?.existingSource || null,
        functionalStatus: divergence?.functionalStatus || null,
        functionalRank: divergence?.functionalRank ?? null,
        functionalScore: divergence?.functionalScore ?? null,
        functionalConfidence: divergence?.functionalConfidence || null,
        hardFilterReasons: list(divergence?.reasons),
        confidence,
        sourceCompleteness: result?.candidateSourceCompleteness || "unknown",
        sourceStage: result?.candidateSourceStage || "unknown",
        candidateIdentityMode: result?.candidateIdentityMode || "unknown",
        ...context
      });
    });
  });

  return records.sort((left, right) =>
    String(left.captureId || "").localeCompare(String(right.captureId || "")) ||
    String(left.type || "").localeCompare(String(right.type || "")) ||
    String(left.productId || "").localeCompare(String(right.productId || "")) ||
    left.divergenceIndex - right.divergenceIndex
  );
}

function countCasesWithType(results, type) {
  return results.filter((result) => list(result?.comparison?.divergences).some((item) => item?.type === type)).length;
}

function passesRepeatThreshold({ caseCount, comparableCases, options }) {
  const repeatRate = comparableCases ? caseCount / comparableCases : 0;
  return (
    comparableCases >= options.minimumComparableCases &&
    caseCount >= options.minimumRepeatCount &&
    repeatRate >= options.minimumRepeatRate
  );
}

function buildDivergenceReviews({ includedResults, records, options }) {
  const comparableCases = includedResults.length;
  const byType = {};

  records.forEach((record) => {
    if (!byType[record.type]) {
      byType[record.type] = {
        type: record.type,
        occurrenceCount: 0,
        caseCount: 0,
        repeatRate: 0,
        reviewStatus: "observation_only",
        reasons: [],
        grouping: {
          byRankingGoal: {},
          bySafetyGoal: {},
          byRecommendationGuard: {},
          byCategory: {},
          byFunctionalStatus: {},
          bySourceCompleteness: {},
          bySourceStage: {},
          byHardFilterReason: {}
        }
      };
    }

    const review = byType[record.type];
    review.occurrenceCount += 1;
    increment(review.grouping.byRankingGoal, record.rankingGoal);
    increment(review.grouping.bySafetyGoal, record.safetyGoal);
    increment(review.grouping.byRecommendationGuard, record.recommendationGuard);
    increment(review.grouping.byCategory, record.category);
    increment(review.grouping.byFunctionalStatus, record.functionalStatus);
    increment(review.grouping.bySourceCompleteness, record.sourceCompleteness);
    increment(review.grouping.bySourceStage, record.sourceStage);
    if (record.type === "existing_selected_but_blocked") {
      record.hardFilterReasons.forEach((reason) =>
        increment(review.grouping.byHardFilterReason, reasonKey(reason))
      );
    }
  });

  Object.values(byType).forEach((review) => {
    review.caseCount = countCasesWithType(includedResults, review.type);
    review.repeatRate = comparableCases ? round(review.caseCount / comparableCases) : 0;

    if (review.type === "existing_selected_but_blocked" && review.caseCount >= options.immediateSafetyReviewCount) {
      review.reviewStatus = "safety_review_required";
      review.reasons.push("Existing selected product collided with functional safety hard filters in high-confidence comparison.");
    } else if (COMPARISON_LIMIT_TYPES.has(review.type)) {
      review.reviewStatus = "comparison_limit";
      review.reasons.push("This divergence is primarily evidence or source/data coverage limited.");
    } else if (
      ["top_pick_mismatch", "existing_selected_ranked_lower", "functional_top_candidate_missing_from_existing"].includes(review.type) &&
      passesRepeatThreshold({ caseCount: review.caseCount, comparableCases, options })
    ) {
      review.reviewStatus = "policy_review_candidate";
      review.reasons.push("Repeated in high-confidence comparisons above threshold; requires manual policy review, not automatic change.");
    } else {
      review.reviewStatus = "observation_only";
      review.reasons.push("Not enough structured evidence for policy review escalation.");
    }
  });

  return Object.values(byType).sort((left, right) => left.type.localeCompare(right.type));
}

function buildCategoryReviews({ includedResults, records, options }) {
  const categories = {};

  includedResults.forEach((result) => {
    const categoryComparison = result?.comparison?.categoryComparison || {};
    const categoryNames = new Set([
      ...Object.keys(categoryComparison.existing || {}),
      ...Object.keys(categoryComparison.functionalRanked || {}),
      ...Object.keys(categoryComparison.functionalBlocked || {}),
      ...Object.keys(categoryComparison.functionalInsufficientData || {})
    ]);

    categoryNames.forEach((category) => {
      if (!categories[category]) {
        categories[category] = {
          category,
          comparableCount: 0,
          rankedCount: 0,
          blockedCount: 0,
          insufficientDataCount: 0,
          topPickMismatchCount: 0,
          existingSelectedLowerRankCount: 0,
          existingSelectedBlockedCount: 0,
          functionalTopMissingCount: 0,
          reviewStatus: "stable",
          reasons: []
        };
      }

      categories[category].comparableCount += Number(categoryComparison.existing?.[category] || 0);
      categories[category].rankedCount += Number(categoryComparison.functionalRanked?.[category] || 0);
      categories[category].blockedCount += Number(categoryComparison.functionalBlocked?.[category] || 0);
      categories[category].insufficientDataCount += Number(categoryComparison.functionalInsufficientData?.[category] || 0);
    });
  });

  records.forEach((record) => {
    const category = record.category;

    if (!category) {
      return;
    }

    if (!categories[category]) {
      categories[category] = {
        category,
        comparableCount: 0,
        rankedCount: 0,
        blockedCount: 0,
        insufficientDataCount: 0,
        topPickMismatchCount: 0,
        existingSelectedLowerRankCount: 0,
        existingSelectedBlockedCount: 0,
        functionalTopMissingCount: 0,
        reviewStatus: "observation_only",
        reasons: []
      };
    }

    if (record.type === "top_pick_mismatch") categories[category].topPickMismatchCount += 1;
    if (record.type === "existing_selected_ranked_lower") categories[category].existingSelectedLowerRankCount += 1;
    if (record.type === "existing_selected_but_blocked") categories[category].existingSelectedBlockedCount += 1;
    if (record.type === "functional_top_candidate_missing_from_existing") categories[category].functionalTopMissingCount += 1;
  });

  Object.values(categories).forEach((review) => {
    if (review.comparableCount < options.categoryMinimumCount) {
      review.reviewStatus = "observation_only";
      review.reasons.push("Category sample is below minimum count.");
      return;
    }

    if (review.insufficientDataCount >= options.categoryMinimumCount) {
      review.reviewStatus = "comparison_limit";
      review.reasons.push("Category repeatedly falls into insufficient-data comparison limits.");
      return;
    }

    if (review.existingSelectedBlockedCount >= options.immediateSafetyReviewCount) {
      review.reviewStatus = "policy_review_candidate";
      review.reasons.push("Category has high-confidence selected-but-blocked safety collisions.");
      return;
    }

    if (
      review.topPickMismatchCount >= options.minimumRepeatCount ||
      review.existingSelectedLowerRankCount >= options.minimumRepeatCount ||
      review.functionalTopMissingCount >= options.minimumRepeatCount
    ) {
      review.reviewStatus = "policy_review_candidate";
      review.reasons.push("Category has repeated high-confidence ranking divergence.");
      return;
    }

    review.reviewStatus = "stable";
    review.reasons.push("No repeated high-confidence divergence above threshold.");
  });

  return Object.values(categories).sort((left, right) => left.category.localeCompare(right.category));
}

function buildSafetyReviews({ records, options }) {
  const safetyRecords = records.filter((record) => record.type === "existing_selected_but_blocked");
  const byReason = {};
  const byRankingGoal = {};
  const bySafetyGoal = {};
  const byCategory = {};
  const cases = safetyRecords.map((record) => {
    record.hardFilterReasons.forEach((reason) => increment(byReason, reasonKey(reason)));
    increment(byRankingGoal, record.rankingGoal);
    increment(bySafetyGoal, record.safetyGoal);
    increment(byCategory, record.category);

    return {
      captureId: record.captureId,
      productId: record.productId,
      category: record.category,
      rankingGoal: record.rankingGoal,
      safetyGoal: record.safetyGoal,
      recommendationGuard: record.recommendationGuard,
      hardFilterReasons: record.hardFilterReasons,
      confidence: record.confidence
    };
  });
  const repeatedReason = Object.values(byReason).some((count) => count >= options.minimumRepeatCount);

  return {
    totalSafetyConflicts: safetyRecords.length,
    byReason,
    byRankingGoal,
    bySafetyGoal,
    byCategory,
    cases: sortByKey(cases, (item) => `${item.captureId}:${item.productId}`),
    reviewStatus: safetyRecords.length >= options.immediateSafetyReviewCount
      ? "safety_review_required"
      : "observation_only",
    notes: [
      ...(safetyRecords.length
        ? ["Existing selected products collided with functional safety hard filters; this requires human review before any policy change."]
        : ["No high-confidence selected-but-blocked safety divergence found."]),
      ...(repeatedReason
        ? ["A hard-filter reason repeated enough to be considered for policy review framing."]
        : [])
    ]
  };
}

function buildPolicyCandidates({ divergenceReviews, safetyReviews, includedResults, options }) {
  const comparableCases = includedResults.length;
  const candidates = [];
  const pushCandidate = (candidate) => {
    candidates.push({
      ...candidate,
      status: "policy_review_candidate",
      changeRecommendation: candidate.changeRecommendation || null
    });
  };

  divergenceReviews.forEach((review) => {
    if (
      review.reviewStatus === "policy_review_candidate" &&
      passesRepeatThreshold({ caseCount: review.caseCount, comparableCases, options })
    ) {
      pushCandidate({
        type: `${review.type}_review`,
        reviewQuestion: review.type === "top_pick_mismatch"
          ? "When complete candidate sources are available, why does the functional rank-1 product diverge from the existing top pick repeatedly?"
          : review.type === "existing_selected_ranked_lower"
            ? "Are existing selected supporting/budget products repeatedly lower because the functional engine prioritizes the explicit goal differently?"
            : "Why are functional top candidates repeatedly absent from the existing final result despite being in the candidate source?",
        evidence: {
          comparableCases,
          repeatCount: review.caseCount,
          repeatRate: review.repeatRate,
          confidence: "high",
          divergenceTypes: [review.type],
          categories: Object.keys(review.grouping.byCategory).sort()
        }
      });
    }
  });

  Object.entries(safetyReviews.byReason || {})
    .filter(([, count]) => count >= options.minimumRepeatCount)
    .forEach(([reason, count]) => {
      const repeatRate = comparableCases ? round(count / comparableCases) : 0;

      if (comparableCases >= options.minimumComparableCases && repeatRate >= options.minimumRepeatRate) {
        pushCandidate({
          type: "hard_filter_review",
          reviewQuestion: "Does the repeated selected-but-blocked safety collision indicate a hard-filter policy boundary that needs manual review?",
          evidence: {
            comparableCases,
            repeatCount: count,
            repeatRate,
            confidence: "high",
            divergenceTypes: ["existing_selected_but_blocked"],
            hardFilterReason: reason,
            categories: Object.keys(safetyReviews.byCategory || {}).sort()
          },
          changeRecommendation: "manual_review_required"
        });
      }
    });

  return candidates.sort((left, right) => left.type.localeCompare(right.type));
}

function buildObservationOnly({ divergenceReviews, excludedLowConfidenceCount, mediumCount, includedResults, options }) {
  const observations = [];

  divergenceReviews
    .filter((review) => review.reviewStatus === "observation_only")
    .forEach((review) => {
      observations.push({
        type: review.type,
        reason: "This divergence did not meet repeat/count/rate thresholds for policy review.",
        neededEvidence: "More high-confidence captures with matching goal/safety/category context."
      });
    });

  if (excludedLowConfidenceCount > 0) {
    observations.push({
      type: "low_confidence_reference_only",
      count: excludedLowConfidenceCount,
      reason: "Low-confidence final-results-only or incomplete-source comparisons are excluded from policy escalation.",
      neededEvidence: "Complete or partial product-row candidate source captures."
    });
  }

  if (options.includeMediumSeparately && mediumCount > 0) {
    observations.push({
      type: "medium_confidence_separate_reference",
      count: mediumCount,
      reason: "Medium-confidence comparisons are tracked separately and not merged into high-confidence policy evidence.",
      neededEvidence: "More complete product-row captures for high-confidence analysis."
    });
  }

  if (includedResults.length < options.minimumComparableCases) {
    observations.push({
      type: "insufficient_comparable_cases",
      count: includedResults.length,
      reason: "Included comparison count is below the minimum comparable case threshold.",
      neededEvidence: `At least ${options.minimumComparableCases} high-confidence comparisons.`
    });
  }

  return observations.sort((left, right) => left.type.localeCompare(right.type));
}

function buildLimitations({ replaySummary, includedResults, excludedLowConfidenceCount }) {
  return [
    "Sample count is limited and should not drive automatic policy changes.",
    "Development fixtures do not represent the real user population.",
    "The existing ranking objective and the functional ranking objective are intentionally different.",
    "Shadow comparison shows differences; it does not determine which engine is correct.",
    "Product data and functional profile coverage may be incomplete.",
    "Current routine context is limited in the current replay summaries.",
    "Photo and vision signals may affect the existing result differently than the functional ranking audit.",
    "Complete source currently means the existing post-score candidate pool, not the full product database.",
    "Current captures use a fixed test image, so vision-input diversity is limited.",
    ...(excludedLowConfidenceCount > 0
      ? ["Low-confidence final-results-only captures are excluded from policy candidate promotion."]
      : []),
    ...list(replaySummary?.limitations)
  ].filter((item, index, all) => item && all.indexOf(item) === index);
}

function determineNextAction({ policyCandidates, safetyReviews, reviewScope }) {
  if (safetyReviews.totalSafetyConflicts > 0) {
    return "manual_safety_review_required_before_policy_change";
  }

  if (policyCandidates.length > 0) {
    return "define_manual_policy_review_questions_for_repeated_high_confidence_divergence";
  }

  if (reviewScope.includedComparisonCount < reviewScope.minimumComparableCases) {
    return "collect_more_high_confidence_shadow_captures";
  }

  return "continue_observation_without_policy_change";
}

export function reviewFunctionalDivergencePolicy({
  replaySummary = {},
  options: inputOptions = {}
} = {}) {
  const options = normalizeOptions(inputOptions);
  const results = list(replaySummary?.results);
  const includedSet = new Set(options.includedConfidence);
  const includedResults = results.filter((result) => includedSet.has(confidenceOf(result)));
  const mediumResults = results.filter((result) => confidenceOf(result) === "medium");
  const lowResults = results.filter((result) => confidenceOf(result) === "low");
  const records = collectDivergenceRecords(includedResults).filter((record) =>
    !["candidate_source_incomplete", "no_comparable_product_ids"].includes(record.type)
  );
  const allIncludedRecords = collectDivergenceRecords(includedResults);
  const divergenceReviews = buildDivergenceReviews({ includedResults, records, options });
  const categoryReviews = buildCategoryReviews({ includedResults, records, options });
  const safetyReviews = buildSafetyReviews({ records, options });
  const policyCandidates = includedResults.length >= options.minimumComparableCases
    ? buildPolicyCandidates({ divergenceReviews, safetyReviews, includedResults, options })
    : [];
  const includedConfidenceDistribution = buildConfidenceDistribution(includedResults);
  const reviewScope = {
    totalCaptures: Number(replaySummary?.totalCaptureCount || results.length),
    totalReplayResults: Number(replaySummary?.replayedCount || results.length),
    includedComparisonCount: includedResults.length,
    excludedLowConfidenceCount: lowResults.length,
    mediumComparisonCount: mediumResults.length,
    includedConfidenceDistribution,
    minimumComparableCases: options.minimumComparableCases,
    minimumRepeatCount: options.minimumRepeatCount,
    minimumRepeatRate: options.minimumRepeatRate
  };
  const aggregate = {
    divergenceTypeDistribution: divergenceReviews.reduce((map, review) => {
      map[review.type] = review.occurrenceCount;
      return map;
    }, {}),
    caseDistributionByType: divergenceReviews.reduce((map, review) => {
      map[review.type] = review.caseCount;
      return map;
    }, {}),
    topPickMismatchCount: divergenceReviews.find((review) => review.type === "top_pick_mismatch")?.caseCount || 0,
    topPickMismatchRate: includedResults.length
      ? round((divergenceReviews.find((review) => review.type === "top_pick_mismatch")?.caseCount || 0) / includedResults.length)
      : 0,
    existingSelectedBlockedCount: safetyReviews.totalSafetyConflicts,
    existingSelectedRankedLowerCount: divergenceReviews.find((review) => review.type === "existing_selected_ranked_lower")?.occurrenceCount || 0,
    functionalTopMissingCount: divergenceReviews.find((review) => review.type === "functional_top_candidate_missing_from_existing")?.occurrenceCount || 0,
    excludedComparisonLimitRecords: allIncludedRecords.filter((record) =>
      ["candidate_source_incomplete", "no_comparable_product_ids"].includes(record.type)
    ).length
  };
  const observationOnly = buildObservationOnly({
    divergenceReviews,
    excludedLowConfidenceCount: lowResults.length,
    mediumCount: mediumResults.length,
    includedResults,
    options
  });
  const limitations = buildLimitations({ replaySummary, includedResults, excludedLowConfidenceCount: lowResults.length });

  return {
    reviewScope,
    aggregate,
    divergenceReviews,
    categoryReviews,
    safetyReviews,
    policyCandidates,
    observationOnly,
    limitations,
    nextActionRecommendation: determineNextAction({ policyCandidates, safetyReviews, reviewScope })
  };
}
