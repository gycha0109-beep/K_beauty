const DEFAULT_OPTIONS = {
  includedConfidence: ["high"],
  includeProductIdentity: false,
  includeInternalTraceIds: true,
  maxCases: 50
};

const ALLOWED_REVIEW_OUTCOMES = [
  "guard_appears_appropriate",
  "possible_overblocking",
  "insufficient_product_metadata",
  "goal_function_difference",
  "insufficient_sample",
  "needs_domain_review"
];

function list(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeOptions(options = {}) {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    includedConfidence: Array.isArray(options.includedConfidence) && options.includedConfidence.length
      ? options.includedConfidence
      : DEFAULT_OPTIONS.includedConfidence,
    maxCases: Number.isFinite(Number(options.maxCases))
      ? Math.max(0, Math.floor(Number(options.maxCases)))
      : DEFAULT_OPTIONS.maxCases,
    includeInternalTraceIds: options.includeInternalTraceIds !== false,
    includeProductIdentity: Boolean(options.includeProductIdentity)
  };
}

function increment(map, key) {
  const normalized = key || "unknown";
  map[normalized] = (map[normalized] || 0) + 1;
}

function reasonKey(reason) {
  const text = String(reason || "").toLowerCase();

  if (text.includes("high sensitivity")) return "high_sensitivity";
  if (text.includes("recent instability")) return "recent_instability";
  if (text.includes("eye")) return "eye_sensitivity";
  if (text.includes("white-cast")) return "white_cast";
  if (text.includes("pilling")) return "pilling";
  if (text.includes("irritation")) return "irritation_risk";

  return text
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96) || "unknown_reason";
}

function getConfidence(result) {
  return result?.comparison?.comparisonSummary?.comparisonConfidence || "low";
}

function getSafetyContext(result, productId) {
  return result?.safetyReviewContextByProductId?.[productId] || {};
}

function summarizeScoreBreakdown(summary = null) {
  if (!summary || typeof summary !== "object") {
    return {
      functionalFit: { score: 0, max: 0 },
      skinFit: { score: 0, max: 0 },
      safetyFit: { score: 0, max: 0 },
      preferenceFit: { score: 0, max: 0 },
      routineFit: { score: 0, max: 0 },
      evidenceQuality: { score: 0, max: 0 },
      reviewSignal: { score: 0, max: 0 },
      penalties: { score: 0 }
    };
  }

  return summary;
}

function buildReviewQuestions(caseBase) {
  const category = caseBase.category || "this category";
  const reasons = caseBase.filterDecision.hardFilterReasons.join("; ") || "the hard filter";

  return [
    `Is a ${category} product with these functional signals inherently high-risk in the current safety context?`,
    `Do high sensitivity or recent instability justify a full block for this case rather than a lower rank or warning?`,
    "Is the hard filter relying on product-level metadata, or mostly on a broad category/axis rule?",
    "Which metadata field is decisive here: sensitivitySafe, irritationRisk, cautionTags, or functionalAxes?",
    "Is the available product metadata sufficient to support the block decision without guessing?",
    `Which manual outcome best fits this case given the recorded hard filter reason: ${reasons}?`,
    "What additional high-confidence samples are needed for this rankingGoal/safetyGoal/category combination?"
  ];
}

function makeCaseId(caseBase, index) {
  return [
    "safety",
    reasonKey(caseBase.filterDecision.hardFilterReasons[0]),
    caseBase.category || "unknown",
    caseBase.captureId || "capture",
    caseBase.productId || `case-${index + 1}`
  ].join(":");
}

function buildCase({ result, divergence, options, index }) {
  const context = getSafetyContext(result, divergence.productId);
  const userContext = context.userContext || result.rankingContext || {};
  const productContext = context.productContext || {};
  const filterDecision = context.filterDecision || {};
  const existingRecommendationContext = context.existingRecommendationContext || {};
  const caseBase = {
    caseId: null,
    captureId: options.includeInternalTraceIds ? result.captureId || null : null,
    productId: options.includeInternalTraceIds ? divergence.productId || null : null,
    category: divergence.category || productContext.category || null,
    outcome: null,
    divergence: {
      type: "existing_selected_but_blocked",
      existingSource: divergence.existingSource || null,
      existingRank: null,
      functionalStatus: divergence.functionalStatus || "blocked",
      functionalRank: divergence.functionalRank ?? null,
      functionalScore: divergence.functionalScore ?? null,
      functionalConfidence: divergence.functionalConfidence || null
    },
    userContext: {
      rankingGoal: userContext.rankingGoal || null,
      safetyGoal: userContext.safetyGoal || null,
      recommendationGuard: userContext.recommendationGuard || null,
      hasTension: Boolean(userContext.hasTension),
      sensitivityRisk: userContext.sensitivityRisk || null,
      drynessRisk: userContext.drynessRisk || null,
      rednessRisk: userContext.rednessRisk || null,
      recentSkinChange: userContext.recentSkinChange || null,
      recentlyChangedProduct: userContext.recentlyChangedProduct || null,
      sunscreenSourceCompleteness: userContext.sunscreenSourceCompleteness || null
    },
    productContext: {
      categoryRole: productContext.categoryRole || "unknown",
      functionalAxes: list(productContext.functionalAxes).map((axis) => ({
        axis: axis.axis || null,
        strength: axis.strength || null,
        confidence: axis.confidence || null
      })),
      cautionTags: list(productContext.cautionTags),
      irritationRisk: productContext.irritationRisk ?? null,
      sensitivitySafe: typeof productContext.sensitivitySafe === "boolean" ? productContext.sensitivitySafe : null,
      texture: productContext.texture || null,
      finish: productContext.finish || null,
      evidenceQuality: productContext.evidenceQuality || null,
      profileEvaluable: Boolean(productContext.profileEvaluable)
    },
    filterDecision: {
      hardFilterReasons: list(filterDecision.hardFilterReasons).length
        ? list(filterDecision.hardFilterReasons)
        : list(divergence.reasons),
      evaluatorReasons: list(filterDecision.evaluatorReasons),
      evaluatorPenalties: list(filterDecision.evaluatorPenalties),
      scoreBreakdownSummary: summarizeScoreBreakdown(filterDecision.scoreBreakdownSummary)
    },
    existingRecommendationContext: {
      source: existingRecommendationContext.source || divergence.existingSource || null,
      existingResultMembership: list(existingRecommendationContext.existingResultMembership),
      existingTopPick: Boolean(existingRecommendationContext.existingTopPick),
      existingSupporting: Boolean(existingRecommendationContext.existingSupporting),
      existingBudgetAlternative: Boolean(existingRecommendationContext.existingBudgetAlternative)
    },
    reviewQuestions: [],
    allowedReviewOutcomes: ALLOWED_REVIEW_OUTCOMES
  };

  caseBase.caseId = makeCaseId(caseBase, index);
  caseBase.reviewQuestions = buildReviewQuestions(caseBase);
  return caseBase;
}

function collectCases(replaySummary, options) {
  const included = new Set(options.includedConfidence);
  const cases = [];

  list(replaySummary?.results).forEach((result) => {
    if (!included.has(getConfidence(result))) {
      return;
    }

    list(result?.comparison?.divergences)
      .filter((divergence) => divergence?.type === "existing_selected_but_blocked")
      .filter((divergence) => list(divergence?.reasons).length > 0)
      .forEach((divergence) => {
        cases.push(buildCase({ result, divergence, options, index: cases.length }));
      });
  });

  return cases
    .sort((left, right) =>
      reasonKey(left.filterDecision.hardFilterReasons[0]).localeCompare(reasonKey(right.filterDecision.hardFilterReasons[0])) ||
      String(left.category || "").localeCompare(String(right.category || "")) ||
      String(left.captureId || "").localeCompare(String(right.captureId || "")) ||
      String(left.productId || "").localeCompare(String(right.productId || ""))
    )
    .slice(0, options.maxCases);
}

function buildMetadataCoverageSummary(cases) {
  const summary = {
    totalCases: cases.length,
    missingIrritationRisk: 0,
    missingSensitivitySafe: 0,
    missingFunctionalAxes: 0,
    missingCautionTags: 0,
    profileNotEvaluable: 0
  };

  cases.forEach((item) => {
    if (!item.productContext.irritationRisk) summary.missingIrritationRisk += 1;
    if (typeof item.productContext.sensitivitySafe !== "boolean") summary.missingSensitivitySafe += 1;
    if (!item.productContext.functionalAxes.length) summary.missingFunctionalAxes += 1;
    if (!item.productContext.cautionTags.length) summary.missingCautionTags += 1;
    if (!item.productContext.profileEvaluable) summary.profileNotEvaluable += 1;
  });

  return summary;
}

function buildReviewReadiness(cases, metadataCoverageSummary) {
  const blockers = [];

  if (metadataCoverageSummary.missingIrritationRisk > 0) {
    blockers.push(`Missing irritation risk metadata in ${metadataCoverageSummary.missingIrritationRisk} cases.`);
  }

  if (metadataCoverageSummary.missingSensitivitySafe > 0) {
    blockers.push(`Missing sensitivity-safe metadata in ${metadataCoverageSummary.missingSensitivitySafe} cases.`);
  }

  if (metadataCoverageSummary.missingFunctionalAxes > 0) {
    blockers.push(`Missing functional axes in ${metadataCoverageSummary.missingFunctionalAxes} cases.`);
  }

  return {
    ready: cases.length > 0 && blockers.length === 0,
    blockers,
    notes: cases.length
      ? ["All included cases are high-confidence existing-selected-but-blocked divergences."]
      : ["No eligible safety divergence cases were found."]
  };
}

function buildAggregate(cases) {
  const aggregate = {
    totalEligibleSafetyCases: cases.length,
    casesByHardFilterReason: {},
    casesByCategory: {},
    casesByRankingGoal: {},
    casesBySafetyGoal: {},
    casesByRecommendationGuard: {},
    casesWithHighSensitivity: 0,
    casesWithRecentInstability: 0,
    metadataCoverageSummary: null,
    reviewReadiness: null
  };

  cases.forEach((item) => {
    item.filterDecision.hardFilterReasons.forEach((reason) =>
      increment(aggregate.casesByHardFilterReason, reasonKey(reason))
    );
    increment(aggregate.casesByCategory, item.category);
    increment(aggregate.casesByRankingGoal, item.userContext.rankingGoal);
    increment(aggregate.casesBySafetyGoal, item.userContext.safetyGoal);
    increment(aggregate.casesByRecommendationGuard, item.userContext.recommendationGuard);

    if (item.userContext.sensitivityRisk === "high") aggregate.casesWithHighSensitivity += 1;
    if (item.userContext.recentSkinChange === "yes" || item.userContext.recentlyChangedProduct === "yes") {
      aggregate.casesWithRecentInstability += 1;
    }
  });

  aggregate.metadataCoverageSummary = buildMetadataCoverageSummary(cases);
  aggregate.reviewReadiness = buildReviewReadiness(cases, aggregate.metadataCoverageSummary);
  return aggregate;
}

function buildDecisionFramework() {
  return {
    guard_appears_appropriate: [
      "The comparison is high-confidence.",
      "Product-level risk metadata exists.",
      "The safety context directly connects to the product risk.",
      "The block is not only a broad category generalization."
    ],
    possible_overblocking: [
      "The block appears to rely on a broad category or axis rule.",
      "Product-level low-risk or sensitivity-safe metadata exists but the product is still fully blocked.",
      "Different safety profiles are blocked the same way under the same context."
    ],
    insufficient_product_metadata: [
      "Core fields such as irritation_risk, sensitivity_safe, functionalAxes, or cautionTags are missing.",
      "The block appears to treat data absence as risk."
    ],
    goal_function_difference: [
      "The main issue is the rankingGoal or legacy objective difference, not a direct safety conflict.",
      "Existing selection rationale cannot be inferred from this packet alone."
    ],
    insufficient_sample: [
      "There are not enough matching high-confidence cases for this reason/category/goal combination."
    ],
    needs_domain_review: [
      "The risk is dermatological or clinical enough that metadata-only automation should not decide it."
    ]
  };
}

function buildPacketQuestions() {
  return [
    "Are these hard-filter collisions appropriate safety guards or signs of overblocking?",
    "Which cases need product metadata correction before policy can be judged?",
    "Do any cases indicate objective mismatch rather than safety risk?",
    "Which rankingGoal/safetyGoal/category combinations need more high-confidence samples?"
  ];
}

function buildLimitations({ replaySummary, cases }) {
  return [
    "This packet is for manual review only and does not change policy.",
    "The current sample size is small.",
    "Captures are development fixtures and may not represent real user distribution.",
    "The current captures use a fixed test image.",
    "Identifying product copy, purchase links, unsanitized survey payloads, uploaded media, long-form user content, and PII are intentionally excluded.",
    "Existing engine selection reasons must not be inferred beyond recorded membership/source fields.",
    ...(cases.length ? [] : ["No eligible high-confidence safety divergence cases were available."]),
    ...list(replaySummary?.limitations)
  ].filter((item, index, all) => item && all.indexOf(item) === index);
}

export function buildFunctionalSafetyReviewPacket({
  replaySummary = {},
  divergencePolicyReview = {},
  options: inputOptions = {}
} = {}) {
  const options = normalizeOptions(inputOptions);
  const cases = collectCases(replaySummary, options);
  const aggregate = buildAggregate(cases);

  return {
    reviewScope: {
      totalReplayResults: Number(replaySummary?.replayedCount || list(replaySummary?.results).length),
      includedConfidence: options.includedConfidence,
      eligibleDivergenceType: "existing_selected_but_blocked",
      eligibleSafetyCases: cases.length,
      policyReviewSafetyConflictCount: Number(divergencePolicyReview?.safetyReviews?.totalSafetyConflicts || 0),
      maxCases: options.maxCases
    },
    cases,
    aggregate,
    reviewQuestions: buildPacketQuestions(),
    decisionFramework: buildDecisionFramework(),
    allowedReviewOutcomes: ALLOWED_REVIEW_OUTCOMES,
    limitations: buildLimitations({ replaySummary, cases })
  };
}

export const FUNCTIONAL_SAFETY_REVIEW_ALLOWED_OUTCOMES = ALLOWED_REVIEW_OUTCOMES;
