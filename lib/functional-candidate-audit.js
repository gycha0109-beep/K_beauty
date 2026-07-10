import { evaluateFunctionalRankingCandidate } from "./functional-ranking-contract.js";
import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

const DEFAULT_OPTIONS = {
  maxRankedCandidates: 20,
  includeBlocked: false,
  includeInsufficientData: true,
  categoryAllowlist: null,
  categoryDenylist: null,
  debug: false
};

const CONFIDENCE_RANK = {
  high: 3,
  medium: 2,
  low: 1
};

const SCORE_BUCKETS = [
  ["90_100", 90, 100],
  ["80_89", 80, 89.999],
  ["70_79", 70, 79.999],
  ["60_69", 60, 69.999],
  ["below_60", Number.NEGATIVE_INFINITY, 59.999]
];

function normalizeOptions(options = {}) {
  const maxRankedCandidates = Number.isFinite(Number(options.maxRankedCandidates))
    ? Math.max(0, Math.floor(Number(options.maxRankedCandidates)))
    : DEFAULT_OPTIONS.maxRankedCandidates;

  return {
    ...DEFAULT_OPTIONS,
    ...options,
    maxRankedCandidates,
    categoryAllowlist: Array.isArray(options.categoryAllowlist)
      ? new Set(options.categoryAllowlist.map(normalizeText).filter(Boolean))
      : null,
    categoryDenylist: Array.isArray(options.categoryDenylist)
      ? new Set(options.categoryDenylist.map(normalizeText).filter(Boolean))
      : null,
    debug: Boolean(options.debug)
  };
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getProductId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

function getCategory(product) {
  return normalizeText(product?.category);
}

function productAuditIdentity(product) {
  return {
    id: getProductId(product),
    category: getCategory(product) || null,
    product_form: product?.product_form || product?.productForm || null
  };
}

function createDistribution() {
  return {
    "90_100": 0,
    "80_89": 0,
    "70_79": 0,
    "60_69": 0,
    below_60: 0,
    unscored: 0
  };
}

function createCategoryDistribution() {
  return {
    ranked: {},
    blocked: {},
    insufficientData: {},
    skipped: {}
  };
}

function increment(map, key) {
  const normalizedKey = key || "unknown";
  map[normalizedKey] = (map[normalizedKey] || 0) + 1;
}

function incrementScoreDistribution(distribution, score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    distribution.unscored += 1;
    return;
  }

  const bucket = SCORE_BUCKETS.find(([, min, max]) => score >= min && score <= max)?.[0] || "unscored";
  distribution[bucket] += 1;
}

function reasonToKey(reason) {
  const normalized = normalizeText(reason);

  if (normalized.includes("high sensitivity") && normalized.includes("irritation")) {
    return "sensitivity_high_irritation_conflict";
  }

  if (normalized.includes("stabilize-first")) {
    return "stabilize_first_active_limited";
  }

  if (normalized.includes("recent instability")) {
    return "recent_instability_active_limited";
  }

  if (normalized.includes("eye sensitivity")) {
    return "sunscreen_eye_sting_conflict";
  }

  if (normalized.includes("white-cast")) {
    return "sunscreen_white_cast_conflict";
  }

  if (normalized.includes("makeup use")) {
    return "sunscreen_pilling_conflict";
  }

  if (normalized.includes("missing")) {
    return "product_required_field_missing";
  }

  if (normalized.includes("too sparse") || normalized.includes("not sufficient")) {
    return "structured_data_insufficient";
  }

  return normalized
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown_reason";
}

function getRankingContext(goalPolicy = {}) {
  return {
    rankingGoal: goalPolicy?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard || "normal",
    hasTension: Boolean(goalPolicy?.hasTension)
  };
}

function shouldSkipForCategory(product, options) {
  const category = getCategory(product);

  if (!category) {
    return null;
  }

  if (options.categoryDenylist?.has(category)) {
    return "category_denylist";
  }

  if (options.categoryAllowlist && !options.categoryAllowlist.has(category)) {
    return "category_allowlist";
  }

  return null;
}

function compareCandidates(left, right) {
  const leftEvaluation = left.evaluation;
  const rightEvaluation = right.evaluation;
  const scoreDelta = rightEvaluation.totalScore - leftEvaluation.totalScore;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  const confidenceDelta =
    (CONFIDENCE_RANK[rightEvaluation.confidence] || 0) -
    (CONFIDENCE_RANK[leftEvaluation.confidence] || 0);

  if (confidenceDelta !== 0) {
    return confidenceDelta;
  }

  const functionalDelta =
    rightEvaluation.scoreBreakdown.functionalFit.score -
    leftEvaluation.scoreBreakdown.functionalFit.score;

  if (functionalDelta !== 0) {
    return functionalDelta;
  }

  const safetyDelta =
    rightEvaluation.scoreBreakdown.safetyFit.score -
    leftEvaluation.scoreBreakdown.safetyFit.score;

  if (safetyDelta !== 0) {
    return safetyDelta;
  }

  const evidenceDelta =
    rightEvaluation.scoreBreakdown.evidenceQuality.score -
    leftEvaluation.scoreBreakdown.evidenceQuality.score;

  if (evidenceDelta !== 0) {
    return evidenceDelta;
  }

  const reviewDelta =
    rightEvaluation.scoreBreakdown.reviewSignal.score -
    leftEvaluation.scoreBreakdown.reviewSignal.score;

  if (reviewDelta !== 0) {
    return reviewDelta;
  }

  return String(left.product.id || "").localeCompare(String(right.product.id || ""));
}

function makeSortKey(evaluation, productId) {
  return {
    totalScore: evaluation.totalScore,
    confidence: evaluation.confidence,
    functionalFit: evaluation.scoreBreakdown.functionalFit.score,
    safetyFit: evaluation.scoreBreakdown.safetyFit.score,
    evidenceQuality: evaluation.scoreBreakdown.evidenceQuality.score,
    reviewSignal: evaluation.scoreBreakdown.reviewSignal.score,
    productId
  };
}

function buildSummary({
  products,
  evaluatedCount,
  rankedAll,
  returnedRanked,
  blockedAll,
  insufficientAll,
  skippedCount,
  skippedReasonDistribution,
  scoreDistribution,
  confidenceDistribution,
  categoryDistribution,
  hardFilterReasonDistribution,
  goalPolicy,
  options
}) {
  return {
    totalInputCount: Array.isArray(products) ? products.length : 0,
    evaluatedCount,
    rankedCount: rankedAll.length,
    returnedRankedCount: returnedRanked.length,
    truncatedRankedCount: Math.max(0, rankedAll.length - returnedRanked.length),
    blockedCount: blockedAll.length,
    insufficientDataCount: insufficientAll.length,
    skippedCount,
    skippedReasonDistribution,
    scoreDistribution,
    confidenceDistribution,
    categoryDistribution,
    hardFilterReasonDistribution,
    rankingContext: getRankingContext(goalPolicy),
    policyNotes: [
      "This result is audit-only and does not replace existing recommendation results.",
      "Blocked means currently unsuitable to expose under the present conditions, not lower product quality.",
      "Insufficient data means evidence is not enough for this audit, not product unsuitability."
    ],
    options: {
      maxRankedCandidates: options.maxRankedCandidates,
      includeBlocked: options.includeBlocked,
      includeInsufficientData: options.includeInsufficientData,
      categoryAllowlist: options.categoryAllowlist ? Array.from(options.categoryAllowlist) : null,
      categoryDenylist: options.categoryDenylist ? Array.from(options.categoryDenylist) : null,
      debug: options.debug
    }
  };
}

export function buildFunctionalCandidateAudit({
  products,
  surveyContract = {},
  goalPolicy = {},
  currentProductFindings = null,
  options: inputOptions = {}
} = {}) {
  const options = normalizeOptions(inputOptions);
  const rankedAll = [];
  const blockedAll = [];
  const insufficientAll = [];
  const scoreDistribution = createDistribution();
  const confidenceDistribution = { high: 0, medium: 0, low: 0 };
  const categoryDistribution = createCategoryDistribution();
  const hardFilterReasonDistribution = {};
  const skippedReasonDistribution = {};
  let evaluatedCount = 0;
  let skippedCount = 0;

  for (const item of Array.isArray(products) ? products : []) {
    if (!item || typeof item !== "object") {
      skippedCount += 1;
      increment(skippedReasonDistribution, "malformed_product");
      increment(categoryDistribution.skipped, "unknown");
      continue;
    }

    const categorySkipReason = shouldSkipForCategory(item, options);

    if (categorySkipReason) {
      skippedCount += 1;
      increment(skippedReasonDistribution, categorySkipReason);
      increment(categoryDistribution.skipped, getCategory(item));
      continue;
    }

    const productProfile = resolveProductFunctionalProfile(item);
    const evaluation = evaluateFunctionalRankingCandidate({
      product: item,
      surveyContract,
      goalPolicy,
      productProfile,
      currentProductFindings
    });
    const category = getCategory(item) || evaluation.rankingContext?.productCategory || "unknown";
    const confidence = evaluation.confidence || "low";

    evaluatedCount += 1;
    increment(confidenceDistribution, confidence);
    incrementScoreDistribution(scoreDistribution, evaluation.totalScore);

    if (
      evaluation.eligible === true &&
      evaluation.hardFilterStatus === "pass" &&
      typeof evaluation.totalScore === "number" &&
      Number.isFinite(evaluation.totalScore)
    ) {
      rankedAll.push({
        product: productAuditIdentity(item),
        evaluation,
        rank: null,
        sortKey: makeSortKey(evaluation, getProductId(item))
      });
      increment(categoryDistribution.ranked, category);
      continue;
    }

    evaluation.hardFilterReasons.forEach((reason) => {
      increment(hardFilterReasonDistribution, reasonToKey(reason));
    });

    if (evaluation.hardFilterStatus === "blocked") {
      blockedAll.push({
        productId: evaluation.productId,
        category,
        hardFilterReasons: evaluation.hardFilterReasons,
        rankingContext: evaluation.rankingContext,
        confidence
      });
      increment(categoryDistribution.blocked, category);
      continue;
    }

    insufficientAll.push({
      productId: evaluation.productId,
      category,
      hardFilterReasons: evaluation.hardFilterReasons,
      rankingContext: evaluation.rankingContext,
      confidence
    });
    increment(categoryDistribution.insufficientData, category);
  }

  rankedAll.sort(compareCandidates);
  rankedAll.forEach((candidate, index) => {
    candidate.rank = index + 1;
  });

  const returnedRanked = rankedAll.slice(0, options.maxRankedCandidates);

  return {
    rankedCandidates: returnedRanked,
    blockedCandidates: options.includeBlocked ? blockedAll : [],
    insufficientDataCandidates: options.includeInsufficientData ? insufficientAll : [],
    summary: buildSummary({
      products,
      evaluatedCount,
      rankedAll,
      returnedRanked,
      blockedAll,
      insufficientAll,
      skippedCount,
      skippedReasonDistribution,
      scoreDistribution,
      confidenceDistribution,
      categoryDistribution,
      hardFilterReasonDistribution,
      goalPolicy,
      options
    })
  };
}
