import { resolveProductFunctionalProfile } from "./product-functional-profile.js";

const SCORE_WEIGHTS = {
  functionalFit: 30,
  skinFit: 20,
  safetyFit: 20,
  preferenceFit: 10,
  routineFit: 10,
  evidenceQuality: 5,
  reviewSignal: 5
};

const STRENGTH_SCORE = {
  none: 0,
  low: 0.35,
  medium: 0.7,
  high: 1
};

const CONFIDENCE_SCORE = {
  none: 0,
  low: 0.45,
  medium: 0.75,
  high: 1
};

const GOAL_TO_FUNCTIONAL_AXES = {
  dehydration: ["hydration", "moisture_lock"],
  pores: ["exfoliation"],
  oiliness: ["acne_care", "exfoliation"],
  acne: ["acne_care"],
  redness: ["soothing", "barrier_support"],
  barrier: ["barrier_support", "soothing"],
  uneven_tone: ["tone_care"],
  uv: ["sunscreen_protection"]
};

const ACTIVE_FUNCTIONAL_AXES = new Set(["exfoliation", "acne_care", "tone_care", "wrinkle_care"]);
const STABILIZE_SAFE_AXES = new Set(["hydration", "moisture_lock", "barrier_support", "soothing"]);

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function hasValue(value) {
  return value != null && String(value).trim() !== "";
}

function getProductId(product) {
  return String(product?.id || product?.productId || product?.product_id || "").trim() || null;
}

function getProductCategory(product) {
  return normalizeText(product?.category);
}

function makeBucket(max) {
  return { score: 0, max, reasons: [] };
}

function createBreakdown() {
  return {
    functionalFit: makeBucket(SCORE_WEIGHTS.functionalFit),
    skinFit: makeBucket(SCORE_WEIGHTS.skinFit),
    safetyFit: makeBucket(SCORE_WEIGHTS.safetyFit),
    preferenceFit: makeBucket(SCORE_WEIGHTS.preferenceFit),
    routineFit: makeBucket(SCORE_WEIGHTS.routineFit),
    evidenceQuality: makeBucket(SCORE_WEIGHTS.evidenceQuality),
    reviewSignal: makeBucket(SCORE_WEIGHTS.reviewSignal),
    penalties: { score: 0, reasons: [] },
    totalBeforePenalty: 0,
    totalAfterPenalty: 0
  };
}

function addReason(list, reason) {
  if (reason && !list.includes(reason)) {
    list.push(reason);
  }
}

function getGoalAxes(goal) {
  return GOAL_TO_FUNCTIONAL_AXES[goal] || [];
}

function getFunctionalAxis(profile, axisName) {
  return normalizeList(profile?.functionalAxes).find((axis) => axis?.axis === axisName) || null;
}

function getMatchingGoalAxes(profile, rankingGoal) {
  const goalAxes = getGoalAxes(rankingGoal);
  return goalAxes
    .map((axisName) => getFunctionalAxis(profile, axisName))
    .filter(Boolean);
}

function axisScore(axis) {
  return (STRENGTH_SCORE[axis?.strength] || 0) * (CONFIDENCE_SCORE[axis?.confidence] || 0);
}

function hasActiveFunctionalAxis(profile) {
  return normalizeList(profile?.functionalAxes).some((axis) => ACTIVE_FUNCTIONAL_AXES.has(axis?.axis));
}

function hasStabilizingFunctionalAxis(profile) {
  return normalizeList(profile?.functionalAxes).some((axis) => STABILIZE_SAFE_AXES.has(axis?.axis));
}

function buildInsufficientResult({ product, productProfile, goalPolicy }) {
  const breakdown = createBreakdown();

  return {
    productId: getProductId(product),
    eligible: false,
    hardFilterStatus: "insufficient_data",
    hardFilterReasons: [
      "Structured product data is not sufficient to evaluate this as a recommendation candidate."
    ],
    totalScore: null,
    scoreBreakdown: breakdown,
    reasons: [],
    penalties: [],
    confidence: "low",
    rankingContext: buildRankingContext({ product, productProfile, goalPolicy, currentRoutineRelation: "unknown" })
  };
}

function buildRankingContext({ product, productProfile, goalPolicy, currentRoutineRelation }) {
  return {
    rankingGoal: goalPolicy?.rankingGoal || null,
    safetyGoal: goalPolicy?.safetyGoal || null,
    recommendationGuard: goalPolicy?.recommendationGuard || "normal",
    hasTension: Boolean(goalPolicy?.hasTension),
    productCategory: getProductCategory(product) || null,
    categoryRole: productProfile?.categoryRole || "unknown",
    evaluable: Boolean(productProfile?.evaluable),
    currentRoutineRelation: currentRoutineRelation || "unknown"
  };
}

function getCurrentFindings(input) {
  if (Array.isArray(input)) {
    return input;
  }

  if (Array.isArray(input?.findings)) {
    return input.findings;
  }

  return [];
}

function resolveCurrentRoutineRelation(product, currentProductFindings) {
  const productId = getProductId(product);
  const findings = getCurrentFindings(currentProductFindings);

  if (productId && findings.some((finding) => finding?.productId === productId)) {
    return "same_product_already_selected";
  }

  if (findings.some((finding) => finding?.relationToPlan === "duplicate_axis")) {
    return "duplicate_axis";
  }

  if (findings.some((finding) => finding?.relationToPlan === "supports_goal")) {
    return "supports_goal_existing";
  }

  if (findings.some((finding) => finding?.relationToPlan === "empty_slot")) {
    return "empty_slot";
  }

  if (findings.some((finding) => finding?.sourceState === "not_in_db")) {
    return "not_evaluable_current_product";
  }

  return findings.length ? "different_or_unknown_current_product" : "no_current_product_context";
}

function pushPenalty(scoreBreakdown, penalties, reason, score) {
  scoreBreakdown.penalties.score += score;
  addReason(scoreBreakdown.penalties.reasons, reason);
  addReason(penalties, reason);
}

function getHardFilter({ product, surveyContract, goalPolicy, productProfile }) {
  const reasons = [];
  const safety = surveyContract?.safety || {};
  const rankingGoal = goalPolicy?.rankingGoal;
  const irritationRisk = normalizeText(product?.irritation_risk);
  const category = getProductCategory(product);
  const sunscreenAnswered = surveyContract?.sunscreen?.sourceCompleteness === "answered";
  const isHighSensitivity = safety.sensitivityRisk === "high";
  const recentInstability =
    safety.recentSkinChange === "yes" || safety.recentlyChangedProduct === "yes";
  const highBarrierLikeRisk =
    safety.drynessRisk === "high" || safety.rednessRisk === "high" || isHighSensitivity;
  const activeAxis = hasActiveFunctionalAxis(productProfile);

  if (!product || typeof product !== "object") {
    return { status: "insufficient_data", reasons: ["Product snapshot is missing."] };
  }

  if (!getProductId(product) || !category) {
    return {
      status: "insufficient_data",
      reasons: ["Product id or category is missing, so candidate eligibility is uncertain."]
    };
  }

  if (!productProfile?.evaluable && !product?.concerns?.length && !product?.skin_types?.length) {
    return {
      status: "insufficient_data",
      reasons: ["Functional, skin-type, and safety data are too sparse for a recommendation judgment."]
    };
  }

  if (isHighSensitivity && irritationRisk === "high") {
    reasons.push("High sensitivity and high product irritation risk should not be treated as a normal candidate.");
  }

  if (
    isHighSensitivity &&
    product?.sensitivity_safe === false &&
    irritationRisk === "high"
  ) {
    reasons.push("High sensitivity conflicts with explicit non-sensitive-safe product data.");
  }

  if (
    goalPolicy?.recommendationGuard === "stabilize_first" &&
    activeAxis &&
    !hasStabilizingFunctionalAxis(productProfile)
  ) {
    reasons.push("Stabilize-first policy limits new active-direction candidates.");
  }

  if (
    highBarrierLikeRisk &&
    recentInstability &&
    activeAxis &&
    ["acne", "pores", "uneven_tone"].includes(rankingGoal)
  ) {
    reasons.push("Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking.");
  }

  if (category === "sunscreen" && sunscreenAnswered) {
    if (surveyContract?.sunscreen?.eyeSensitive && product?.eye_sting === "high") {
      reasons.push("Eye sensitivity conflicts with high eye-sting sunscreen data.");
    }

    if (surveyContract?.sunscreen?.whiteCastHate && product?.white_cast === "high") {
      reasons.push("White-cast avoidance conflicts with high white-cast sunscreen data.");
    }

    if (surveyContract?.sunscreen?.makeupUse && product?.pilling_risk === "high") {
      reasons.push("Makeup use conflicts with high pilling-risk sunscreen data.");
    }
  }

  return reasons.length
    ? { status: "blocked", reasons }
    : { status: "pass", reasons: ["No hard filter blocked this candidate."] };
}

function scoreFunctionalFit(bucket, { product, productProfile, rankingGoal }) {
  const matchingAxes = getMatchingGoalAxes(productProfile, rankingGoal);
  const bestAxis = matchingAxes
    .map((axis) => ({ axis, value: axisScore(axis) }))
    .sort((left, right) => right.value - left.value)[0];
  const productConcerns = normalizeArray(product?.concerns);

  if (bestAxis?.value > 0) {
    bucket.score += bestAxis.value * 24;
    addReason(bucket.reasons, "Functional evidence connects this product to the selected goal.");
  }

  if (productConcerns.includes(rankingGoal)) {
    bucket.score += bestAxis ? 3 : 5;
    addReason(bucket.reasons, "Structured product concerns support the selected goal as secondary evidence.");
  }

  if (productProfile?.categoryRole === "functional_leave_on" && bestAxis?.value >= 0.7) {
    bucket.score += 3;
    addReason(bucket.reasons, "Leave-on category role supports a focused functional step.");
  }

  if (productProfile?.cautionTags?.includes("rinse_off_limit")) {
    bucket.score = Math.min(bucket.score, 12);
    addReason(bucket.reasons, "Rinse-off products are capped for active functional fit.");
  }

  if (rankingGoal === "uv" && productProfile?.categoryRole !== "protection") {
    bucket.score = Math.min(bucket.score, 10);
    addReason(bucket.reasons, "Sun-protection goals require sunscreen-specific product context.");
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function scoreSkinFit(bucket, { product, surveyContract, productProfile }) {
  const skinType = surveyContract?.skinState?.skinType;
  const postWashFeeling = surveyContract?.skinState?.postWashFeeling;
  const afternoonSkinChange = surveyContract?.skinState?.afternoonSkinChange;
  const productSkinTypes = normalizeArray(product?.skin_types);
  const productTexture = normalizeText(product?.texture);
  const productFinish = normalizeText(product?.finish);

  if (skinType && skinType !== "unknown" && skinType !== "not_sure" && productSkinTypes.includes(skinType)) {
    bucket.score += 7;
    addReason(bucket.reasons, "Product skin-type metadata matches the current skin state.");
  } else if (skinType === "unknown" || skinType === "not_sure") {
    bucket.score += 4;
    addReason(bucket.reasons, "Skin type is uncertain, so skin fit is treated neutrally.");
  }

  if (
    (skinType === "dry" || postWashFeeling === "tight" || afternoonSkinChange === "more_dry") &&
    getMatchingGoalAxes(productProfile, "dehydration").length
  ) {
    bucket.score += 7;
    addReason(bucket.reasons, "Hydration-oriented signals fit the dryness pattern.");
  }

  if (
    (skinType === "oily" || afternoonSkinChange === "more_oily") &&
    (["watery", "gel"].includes(productTexture) || ["fresh", "soft_matte"].includes(productFinish))
  ) {
    bucket.score += 5;
    addReason(bucket.reasons, "Lighter texture or finish fits oil-prone daily comfort.");
  }

  if (skinType === "combination") {
    bucket.score += 4;
    addReason(bucket.reasons, "Combination skin is scored conservatively without extreme fit assumptions.");
  }

  if ((skinType === "oily" || afternoonSkinChange === "more_oily") && productFinish === "dewy") {
    bucket.score -= 3;
    addReason(bucket.reasons, "Dewy finish is scored cautiously for oil-prone afternoons.");
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function scoreSafetyFit(bucket, { product, surveyContract, productProfile, penalties, scoreBreakdown }) {
  const safety = surveyContract?.safety || {};
  const irritationRisk = normalizeText(product?.irritation_risk);

  bucket.score = 12;

  if (product?.sensitivity_safe === true) {
    bucket.score += safety.sensitivityRisk === "high" ? 5 : 3;
    addReason(bucket.reasons, "Structured sensitive-skin safety data supports cautious use.");
  }

  if (irritationRisk === "low") {
    bucket.score += 4;
    addReason(bucket.reasons, "Low irritation-risk metadata supports safety fit.");
  } else if (irritationRisk === "medium") {
    bucket.score -= safety.sensitivityRisk === "high" ? 5 : 2;
    pushPenalty(
      scoreBreakdown,
      penalties,
      "Sensitivity and irritation-risk data reduce this candidate's priority.",
      safety.sensitivityRisk === "high" ? -5 : -2
    );
  } else if (irritationRisk === "high") {
    bucket.score -= 8;
    pushPenalty(
      scoreBreakdown,
      penalties,
      "High irritation-risk metadata is treated conservatively.",
      -8
    );
  }

  if (
    (safety.rednessRisk === "high" || safety.recentSkinChange === "yes") &&
    productProfile?.cautionTags?.includes("exfoliation_overlap_watch")
  ) {
    bucket.score -= 5;
    pushPenalty(
      scoreBreakdown,
      penalties,
      "Redness or recent instability makes exfoliation overlap less suitable right now.",
      -5
    );
  }

  if (safety.recentlyChangedProduct === "yes" && hasActiveFunctionalAxis(productProfile)) {
    bucket.score -= 3;
    pushPenalty(
      scoreBreakdown,
      penalties,
      "Recent routine changes lower confidence in adding another active step.",
      -3
    );
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function scorePreferenceFit(bucket, { product, surveyContract, penalties, scoreBreakdown }) {
  const preferredTexture = surveyContract?.preferences?.preferredTexture;
  const dislikedFeel = surveyContract?.preferences?.mostDislikedFeel;
  const texture = normalizeText(product?.texture);
  const finish = normalizeText(product?.finish);
  const sunscreen = surveyContract?.sunscreen || {};
  const category = getProductCategory(product);

  if (preferredTexture && preferredTexture !== "unknown" && texture === preferredTexture) {
    bucket.score += 4;
    addReason(bucket.reasons, "Product texture matches the stated preference.");
  } else if (preferredTexture && preferredTexture !== "unknown" && texture) {
    bucket.score += 2;
    addReason(bucket.reasons, "Product texture data is available for preference matching.");
  }

  if (
    (dislikedFeel === "heavy" && texture === "cream") ||
    (dislikedFeel === "greasy" && finish === "dewy") ||
    (dislikedFeel === "sticky" && ["dewy", "glowy"].includes(finish))
  ) {
    pushPenalty(
      scoreBreakdown,
      penalties,
      "Disliked feel signals lower expected daily comfort.",
      -4
    );
  } else if (dislikedFeel && dislikedFeel !== "unknown") {
    bucket.score += 2;
  }

  if (category === "sunscreen" && sunscreen.sourceCompleteness === "answered") {
    if (sunscreen.whiteCastHate && ["none", "low"].includes(product?.white_cast)) {
      bucket.score += 2;
      addReason(bucket.reasons, "Sunscreen white-cast metadata fits the stated preference.");
    }

    if (sunscreen.eyeSensitive && product?.eye_sting === "low") {
      bucket.score += 2;
      addReason(bucket.reasons, "Eye-sting metadata fits the stated sunscreen concern.");
    }

    if (sunscreen.makeupUse && product?.pilling_risk === "low") {
      bucket.score += 2;
      addReason(bucket.reasons, "Pilling-risk metadata supports makeup layering.");
    }

    if (sunscreen.toneUpWanted === false && product?.tone_up === true) {
      pushPenalty(scoreBreakdown, penalties, "Tone-up finish is not a hard block, but it lowers preference fit.", -3);
    }
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function scoreRoutineFit(bucket, { currentRoutineRelation, penalties, scoreBreakdown }) {
  bucket.score = 6;

  if (currentRoutineRelation === "empty_slot") {
    bucket.score += 2;
    addReason(bucket.reasons, "A relevant routine slot appears open, so add-step fit is slightly higher.");
  }

  if (currentRoutineRelation === "same_product_already_selected") {
    bucket.score -= 5;
    pushPenalty(
      scoreBreakdown,
      penalties,
      "This product already appears in current products, so it is not boosted as a new recommendation.",
      -5
    );
  }

  if (currentRoutineRelation === "duplicate_axis" || currentRoutineRelation === "supports_goal_existing") {
    bucket.score -= 4;
    pushPenalty(
      scoreBreakdown,
      penalties,
      "Current routine already has a similar purpose, so new-product priority is lower.",
      -4
    );
  }

  if (currentRoutineRelation === "not_evaluable_current_product") {
    addReason(bucket.reasons, "Current product context is not evaluable, so routine fit stays neutral.");
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function scoreEvidenceQuality(bucket, { product, productProfile }) {
  if (productProfile?.evaluable) {
    bucket.score += 2;
    addReason(bucket.reasons, "Functional evidence is structured enough for scoring.");
  }

  if (getProductCategory(product)) {
    bucket.score += 1;
  }

  if (hasValue(product?.irritation_risk) || typeof product?.sensitivity_safe === "boolean") {
    bucket.score += 1;
    addReason(bucket.reasons, "Core safety metadata is present.");
  }

  if (product?.ingredient_signals?.functional) {
    bucket.score += 1;
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function parseNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreReviewSignal(bucket, { product, penalties, scoreBreakdown }) {
  const marketSignals = product?.market_signals && typeof product.market_signals === "object"
    ? product.market_signals
    : null;

  if (!marketSignals) {
    addReason(bucket.reasons, "Review signal is unavailable, so this axis stays neutral.");
    return;
  }

  const reviewCount = parseNumber(marketSignals.review_count);
  const rating = parseNumber(marketSignals.rating);

  if (reviewCount != null && reviewCount >= 1000) {
    bucket.score += reviewCount >= 10000 ? 2 : 1;
    addReason(bucket.reasons, "Market signal volume is sufficient for a small confidence lift.");
  }

  if (rating != null) {
    if (rating >= 4.3) {
      bucket.score += rating >= 4.6 ? 3 : 2;
      addReason(bucket.reasons, "Structured rating signal supports user-experience confidence.");
    } else if (rating < 4) {
      pushPenalty(scoreBreakdown, penalties, "Lower structured rating signal reduces confidence.", -2);
    }
  }

  bucket.score = round(clamp(bucket.score, 0, bucket.max));
}

function deriveConfidence({ product, productProfile }) {
  let score = 0;

  if (productProfile?.evaluable) score += 2;
  if (normalizeList(productProfile?.functionalAxes).length >= 2) score += 1;
  if (hasValue(product?.irritation_risk) || typeof product?.sensitivity_safe === "boolean") score += 1;
  if (getProductCategory(product)) score += 1;
  if (product?.ingredient_signals?.functional) score += 1;

  if (score >= 5) return "high";
  if (score >= 3) return "medium";
  return "low";
}

function collectPositiveReasons(scoreBreakdown) {
  return [
    ...scoreBreakdown.functionalFit.reasons,
    ...scoreBreakdown.skinFit.reasons,
    ...scoreBreakdown.safetyFit.reasons,
    ...scoreBreakdown.preferenceFit.reasons,
    ...scoreBreakdown.routineFit.reasons,
    ...scoreBreakdown.evidenceQuality.reasons,
    ...scoreBreakdown.reviewSignal.reasons
  ].filter(Boolean);
}

function finalizeBreakdown(scoreBreakdown) {
  const positiveTotal =
    scoreBreakdown.functionalFit.score +
    scoreBreakdown.skinFit.score +
    scoreBreakdown.safetyFit.score +
    scoreBreakdown.preferenceFit.score +
    scoreBreakdown.routineFit.score +
    scoreBreakdown.evidenceQuality.score +
    scoreBreakdown.reviewSignal.score;
  const afterPenalty = clamp(positiveTotal + scoreBreakdown.penalties.score, 0, 100);

  scoreBreakdown.totalBeforePenalty = round(positiveTotal);
  scoreBreakdown.totalAfterPenalty = round(afterPenalty);
}

export function evaluateFunctionalRankingCandidate({
  product,
  surveyContract = {},
  goalPolicy = {},
  productProfile: suppliedProductProfile,
  currentProductFindings
} = {}) {
  const productProfile = suppliedProductProfile || resolveProductFunctionalProfile(product || {});
  const hardFilter = getHardFilter({ product, surveyContract, goalPolicy, productProfile });
  const currentRoutineRelation = resolveCurrentRoutineRelation(product, currentProductFindings);
  const rankingContext = buildRankingContext({
    product,
    productProfile,
    goalPolicy,
    currentRoutineRelation
  });

  if (hardFilter.status === "insufficient_data") {
    return buildInsufficientResult({ product, productProfile, goalPolicy });
  }

  const scoreBreakdown = createBreakdown();
  const penalties = [];

  if (hardFilter.status === "blocked") {
    return {
      productId: getProductId(product),
      eligible: false,
      hardFilterStatus: "blocked",
      hardFilterReasons: hardFilter.reasons,
      totalScore: null,
      scoreBreakdown,
      reasons: [],
      penalties,
      confidence: deriveConfidence({ product, productProfile }),
      rankingContext
    };
  }

  scoreFunctionalFit(scoreBreakdown.functionalFit, {
    product,
    productProfile,
    rankingGoal: goalPolicy?.rankingGoal
  });
  scoreSkinFit(scoreBreakdown.skinFit, { product, surveyContract, productProfile });
  scoreSafetyFit(scoreBreakdown.safetyFit, {
    product,
    surveyContract,
    productProfile,
    penalties,
    scoreBreakdown
  });
  scorePreferenceFit(scoreBreakdown.preferenceFit, {
    product,
    surveyContract,
    penalties,
    scoreBreakdown
  });
  scoreRoutineFit(scoreBreakdown.routineFit, {
    currentRoutineRelation,
    penalties,
    scoreBreakdown
  });
  scoreEvidenceQuality(scoreBreakdown.evidenceQuality, { product, productProfile });
  scoreReviewSignal(scoreBreakdown.reviewSignal, { product, penalties, scoreBreakdown });
  finalizeBreakdown(scoreBreakdown);

  return {
    productId: getProductId(product),
    eligible: true,
    hardFilterStatus: "pass",
    hardFilterReasons: hardFilter.reasons,
    totalScore: scoreBreakdown.totalAfterPenalty,
    scoreBreakdown,
    reasons: collectPositiveReasons(scoreBreakdown),
    penalties,
    confidence: deriveConfidence({ product, productProfile }),
    rankingContext
  };
}

export const FUNCTIONAL_RANKING_SCORE_WEIGHTS = SCORE_WEIGHTS;
export const FUNCTIONAL_RANKING_GOAL_AXES = GOAL_TO_FUNCTIONAL_AXES;
