import { getRecommendationProducts } from "@/lib/product-source";
import { buildCurrentProductsReport } from "@/lib/current-products";
import { buildCurrentProductVerdicts } from "@/lib/current-product-verdicts";
import { buildExistingRecommendationCandidateSource } from "@/lib/existing-recommendation-candidate-source";
import { buildPremiumFunctionalDecisions } from "@/lib/premium-functional-decisions";
import { buildPremiumConditionResponses } from "@/lib/premium-condition-responses";
import {
  getProductCategorySlot,
  isProductEligibleForGenderPreference,
  normalizeCanonicalFinish,
  normalizeCanonicalTexture,
  normalizeRecommendationAnswers,
  scoreCanonicalProduct,
  scoreSunscreenProduct
} from "@/lib/recommendation-scoring";
import {
  appendReviewEvidenceSentence,
  buildReviewEvidenceSentence,
  computeReviewSignalScore
} from "@/lib/review-signals";

const CONCERN_AXES = [
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
];

const PRIORITY_TIEBREAKER = [
  "uv",
  "barrier",
  "redness",
  "dehydration",
  "acne",
  "pores",
  "oiliness",
  "uneven_tone"
];

const CATEGORY_SLOT_LABELS = {
  cleanser: { ko: "클렌저", en: "Cleanser" },
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
  moisturizer: { ko: "보습제", en: "Moisturizer" },
  sunscreen: { ko: "선크림", en: "Sunscreen" }
};

const PRIORITY_LABELS = {
  barrier: { ko: "장벽", en: "Barrier" },
  dehydration: { ko: "건조", en: "Dehydration" },
  oiliness: { ko: "유분", en: "Oiliness" },
  redness: { ko: "붉은기", en: "Redness" },
  acne: { ko: "트러블", en: "Breakouts" },
  pores: { ko: "모공", en: "Pores" },
  uneven_tone: { ko: "톤 불균일", en: "Uneven tone" },
  uv: { ko: "자외선", en: "UV" }
};

const STEP_LABELS = {
  cleanser: { ko: "클렌저", en: "Cleanser" },
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
  moisturizer: { ko: "보습제", en: "Moisturizer" },
  sunscreen: { ko: "선크림", en: "Sunscreen" }
};

/*
Object.assign(CATEGORY_SLOT_LABELS, {
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
});

Object.assign(STEP_LABELS, {
  toner_essence: { ko: "Toner / Essence", en: "Toner / Essence" },
  serum: { ko: "Serum / Ampoule", en: "Serum / Ampoule" },
});

*/
Object.assign(CATEGORY_SLOT_LABELS, {
  toner_essence: { ko: "토너 / 에센스", en: "Toner / Essence" },
  serum: { ko: "세럼 · 앰플", en: "Serum / Ampoule" },
});

Object.assign(STEP_LABELS, {
  toner_essence: { ko: "토너 / 에센스", en: "Toner / Essence" },
  serum: { ko: "세럼 / 앰플", en: "Serum / Ampoule" },
});

function getLocale(locale = "ko") {
  return locale === "en" ? "en" : "ko";
}

function evaluatorBoundaryPolicyRuntimeRequested() {
  return process.env.ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1" ||
    process.env.DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1";
}

function getLabel(map, key, locale = "ko") {
  return map[key]?.[getLocale(locale)] || key;
}

function createScoreCard() {
  return CONCERN_AXES.reduce((accumulator, axis) => {
    accumulator[axis] = {
      total: 0,
      survey: 0,
      photo: 0,
      environment: 0
    };
    return accumulator;
  }, {});
}

function addScore(scoreCard, axis, bucket, value) {
  if (!scoreCard[axis] || !value) {
    return;
  }

  scoreCard[axis].total += value;
  scoreCard[axis][bucket] += value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function parseFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function parseCountNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string" && value.trim()) {
    const digitsOnly = value.replace(/[^\d.]/g, "");
    const parsed = Number.parseFloat(digitsOnly);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  return 0;
}

function normalizeLower(value) {
  return String(value || "").trim().toLowerCase();
}

function includesNormalized(haystack, needle) {
  return normalizeLower(haystack).includes(normalizeLower(needle));
}

function getProductSlot(productOrSlot) {
  if (productOrSlot && typeof productOrSlot === "object") {
    return getProductCategorySlot(productOrSlot);
  }

  return String(productOrSlot || "").trim();
}

export function resolveDecisionProductSlot(product) {
  return getProductSlot(product);
}

function hasConcern(product, axis) {
  return Array.isArray(product?.concerns) && product.concerns.includes(axis);
}

function isLowIrritation(product) {
  return product?.irritation_risk === "low" || Boolean(product?.sensitivity_safe);
}

function isCalmingSerum(product) {
  return (
    getProductSlot(product) === "serum" &&
    isLowIrritation(product) &&
    (hasConcern(product, "redness") || hasConcern(product, "barrier") || hasConcern(product, "acne"))
  );
}

function isDeepCleanser(product) {
  const combined = [
    product?.id,
    product?.name,
    product?.notes,
    product?.standout_reason
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    getProductSlot(product) === "cleanser" &&
    (combined.includes("deep clean") ||
      combined.includes("pore deep") ||
      combined.includes("clarified finish") ||
      combined.includes("perfect whip"))
  );
}

function isHeroNamedCleanser(product) {
  const combined = [product?.brand, product?.name, product?.id]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return combined.includes("senka") && combined.includes("perfect whip");
}

function hasAnswerConcern(answers, axis) {
  const mainConcerns = Array.isArray(answers?.mainConcerns) ? answers.mainConcerns : [];
  return answers?.mainConcern === axis || mainConcerns.includes(axis);
}

function getConcernTotal(scoreCard, axis) {
  return Number(scoreCard?.[axis]?.total || 0);
}

function getFunctionalEntries(functional) {
  if (Array.isArray(functional)) {
    return functional;
  }

  if (functional && typeof functional === "object") {
    return Object.entries(functional).map(([label, count]) => ({
      label,
      count
    }));
  }

  return [];
}

function buildFunctionalLabelLookup(functional) {
  return getFunctionalEntries(functional).reduce((lookup, entry) => {
    const label = normalizeLower(entry?.label);

    if (!label) {
      return lookup;
    }

    lookup[label] = parseCountNumber(entry?.count);
    return lookup;
  }, {});
}

function getFunctionalSummaryCount(functionalSummary, axis) {
  if (!functionalSummary || typeof functionalSummary !== "object") {
    return 0;
  }

  return parseCountNumber(functionalSummary?.[axis]);
}

function getIngredientAxisSupport(ingredientSignals, axis, labelLookup = {}) {
  const summaryCount = getFunctionalSummaryCount(ingredientSignals?.functional_summary, axis);

  switch (axis) {
    case "dehydration":
      return Math.max(summaryCount, parseCountNumber(labelLookup["skin hydration"]));
    case "barrier":
      return Math.max(
        summaryCount,
        parseCountNumber(labelLookup["skin protection"]) +
          parseCountNumber(labelLookup["moisture evaporation blocking"])
      );
    case "redness":
      return Math.max(summaryCount, parseCountNumber(labelLookup["soothing/astringent"]));
    case "pores":
      return Math.max(summaryCount, parseCountNumber(labelLookup["exfoliation"]));
    case "oiliness":
      return Math.max(summaryCount, parseCountNumber(labelLookup["exfoliation"]));
    case "acne":
      return Math.max(summaryCount, parseCountNumber(labelLookup["acne relief"]));
    case "uneven_tone":
      return Math.max(summaryCount, parseCountNumber(labelLookup["whitening"]));
    case "uv":
      return Math.max(summaryCount, parseCountNumber(labelLookup["uv protection"]));
    default:
      return summaryCount;
  }
}

function getTieredIngredientBonus(count, one, few, many) {
  if (count >= 10) {
    return many;
  }

  if (count >= 5) {
    return few;
  }

  if (count >= 1) {
    return one;
  }

  return 0;
}

function scoreSkinTypeBucket(bucket, positiveValue = 0.4, negativeValue = -0.4) {
  const positive = parseCountNumber(bucket?.positive);
  const negative = parseCountNumber(bucket?.negative);

  if (positive > negative && positive > 0) {
    return positiveValue;
  }

  if (negative > positive) {
    return negativeValue;
  }

  return 0;
}

function computeIngredientSignalScore(product, answers, scoreCard) {
  const ingredientSignals = product?.ingredient_signals;

  if (!ingredientSignals || typeof ingredientSignals !== "object") {
    return {
      total: 0,
      reasons: []
    };
  }

  const functionalLookup = buildFunctionalLabelLookup(ingredientSignals.functional);
  const reasons = [];
  let total = 0;

  const dryProfile =
    answers?.skinType === "dry" ||
    hasAnswerConcern(answers, "dehydration") ||
    hasAnswerConcern(answers, "barrier") ||
    answers?.postWashFeeling === "tight" ||
    answers?.afternoonSkinChange === "more_dry" ||
    getConcernTotal(scoreCard, "dehydration") >= 18;
  const barrierFocused =
    hasAnswerConcern(answers, "barrier") || getConcernTotal(scoreCard, "barrier") >= 18;
  const sensitiveFocused =
    answers?.sensitivity === "high" ||
    Boolean(answers?.verySensitivePeriod) ||
    hasAnswerConcern(answers, "redness") ||
    hasAnswerConcern(answers, "barrier") ||
    getConcernTotal(scoreCard, "redness") >= 18 ||
    getConcernTotal(scoreCard, "barrier") >= 18;
  const poresOrOilFocused =
    answers?.skinType === "oily" ||
    hasAnswerConcern(answers, "pores") ||
    hasAnswerConcern(answers, "oiliness") ||
    getConcernTotal(scoreCard, "pores") >= 18 ||
    getConcernTotal(scoreCard, "oiliness") >= 18;
  const acneFocused =
    hasAnswerConcern(answers, "acne") || getConcernTotal(scoreCard, "acne") >= 18;
  const unevenToneFocused =
    hasAnswerConcern(answers, "uneven_tone") || getConcernTotal(scoreCard, "uneven_tone") >= 18;
  const uvFocused =
    hasAnswerConcern(answers, "uv") ||
    Boolean(answers?.outdoorExposure) ||
    getConcernTotal(scoreCard, "uv") >= 18;

  if (dryProfile) {
    const hydrationSupport = getIngredientAxisSupport(ingredientSignals, "dehydration", functionalLookup);
    const bonus = getTieredIngredientBonus(hydrationSupport, 0.4, 0.9, 1.4);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-hydration");
    }
  }

  if (barrierFocused) {
    const barrierSupport = getIngredientAxisSupport(ingredientSignals, "barrier", functionalLookup);
    const bonus = getTieredIngredientBonus(barrierSupport, 0.4, 0.9, 1.4);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-barrier");
    }
  }

  if (sensitiveFocused) {
    const soothingSupport = getIngredientAxisSupport(ingredientSignals, "redness", functionalLookup);
    const bonus = getTieredIngredientBonus(soothingSupport, 0.3, 0.5, 0.7);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-soothing");
    }
  }

  if (poresOrOilFocused) {
    const poreSupport = getIngredientAxisSupport(ingredientSignals, "pores", functionalLookup);
    const bonus = getTieredIngredientBonus(poreSupport, 0.3, 0.5, 0.7);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-exfoliation");
    }
  }

  if (acneFocused) {
    const acneSupport = getIngredientAxisSupport(ingredientSignals, "acne", functionalLookup);
    const bonus = getTieredIngredientBonus(acneSupport, 0.2, 0.4, 0.6);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-acne");
    }
  }

  if (unevenToneFocused) {
    const toneSupport = getIngredientAxisSupport(ingredientSignals, "uneven_tone", functionalLookup);
    const bonus = getTieredIngredientBonus(toneSupport, 0.2, 0.4, 0.6);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-whitening");
    }
  }

  if (uvFocused) {
    const uvSupport = getIngredientAxisSupport(ingredientSignals, "uv", functionalLookup);
    const bonus = getTieredIngredientBonus(uvSupport, 0.2, 0.4, 0.6);

    if (bonus > 0) {
      total += bonus;
      reasons.push("functional-uv");
    }
  }

  const skinType = ingredientSignals?.skin_type;

  if (skinType && typeof skinType === "object") {
    if (answers?.skinType === "dry") {
      const skinBonus = scoreSkinTypeBucket(skinType.dry, 0.4, -0.4);

      if (skinBonus !== 0) {
        total += skinBonus;
        reasons.push(skinBonus > 0 ? "skin-type-dry-positive" : "skin-type-dry-negative");
      }
    } else if (answers?.skinType === "oily") {
      const skinBonus = scoreSkinTypeBucket(skinType.oily, 0.4, -0.4);

      if (skinBonus !== 0) {
        total += skinBonus;
        reasons.push(skinBonus > 0 ? "skin-type-oily-positive" : "skin-type-oily-negative");
      }
    } else if (answers?.skinType === "combination") {
      const dryScore = scoreSkinTypeBucket(skinType.dry, 0.4, -0.4);
      const oilyScore = scoreSkinTypeBucket(skinType.oily, 0.4, -0.4);
      const combinedScore = roundToTenth((dryScore + oilyScore) / 2);

      if (combinedScore !== 0) {
        total += combinedScore;
        reasons.push(combinedScore > 0 ? "skin-type-combination-positive" : "skin-type-combination-negative");
      }
    }

    if (sensitiveFocused) {
      const sensitiveScore = scoreSkinTypeBucket(skinType.sensitive, 0.3, -0.3);

      if (sensitiveScore !== 0) {
        total += sensitiveScore;
        reasons.push(sensitiveScore > 0 ? "skin-type-sensitive-positive" : "skin-type-sensitive-negative");
      }
    }
  }

  const totalIngredients = parseFiniteNumber(ingredientSignals?.total_ingredients);
  const risk = ingredientSignals?.risk;
  const hasRiskData =
    totalIngredients != null &&
    totalIngredients > 0 &&
    risk &&
    typeof risk === "object" &&
    (parseFiniteNumber(risk?.high) != null || parseFiniteNumber(risk?.medium) != null);

  if (hasRiskData && sensitiveFocused) {
    const highRisk = parseCountNumber(risk?.high);
    const mediumRisk = parseCountNumber(risk?.medium);
    const riskMultiplier = answers?.sensitivity === "high" || answers?.verySensitivePeriod ? 1.2 : 1;

    if (highRisk >= 1) {
      total -= 3.5 * riskMultiplier;
      reasons.push("risk-high");
    }

    if (mediumRisk >= 3) {
      total -= 1.5 * riskMultiplier;
      reasons.push("risk-medium");
    }
  }

  return {
    total: clamp(roundToTenth(total), -8, 6),
    reasons
  };
}

function computeMarketConfidenceScore(product) {
  const marketSignals = product?.market_signals;

  if (!marketSignals || typeof marketSignals !== "object") {
    return {
      total: 0,
      reasons: []
    };
  }

  const reviewCount = parseCountNumber(marketSignals?.review_count);
  const rating = parseFiniteNumber(marketSignals?.rating);
  const reasons = [];
  let total = 0;

  if (reviewCount >= 50000) {
    total += 2;
    reasons.push("review-count-50000");
  } else if (reviewCount >= 10000) {
    total += 1;
    reasons.push("review-count-10000");
  } else if (reviewCount >= 1000) {
    total += 0.5;
    reasons.push("review-count-1000");
  }

  if (rating != null) {
    if (rating >= 4.6) {
      total += 1;
      reasons.push("rating-460");
    } else if (rating >= 4.3) {
      total += 0.5;
      reasons.push("rating-430");
    } else if (rating < 3.7) {
      total -= 2;
      reasons.push("rating-below-370");
    } else if (rating < 4.0) {
      total -= 1;
      reasons.push("rating-below-400");
    }
  }

  if (rating != null && rating < 4.0 && reviewCount >= 10000) {
    total = Math.min(total, 0.5);
  }

  return {
    total: clamp(roundToTenth(total), -2, 3),
    reasons
  };
}

function applySurveyWeights(scoreCard, answers) {
  const mainConcerns = Array.isArray(answers.mainConcerns) && answers.mainConcerns.length
    ? answers.mainConcerns
    : answers.mainConcern
      ? [answers.mainConcern]
      : [];

  mainConcerns.forEach((axis, index) => {
    addScore(scoreCard, axis, "survey", index === 0 ? 22 : 10);
  });

  switch (answers.skinType) {
    case "dry":
      addScore(scoreCard, "dehydration", "survey", 8);
      addScore(scoreCard, "barrier", "survey", 5);
      break;
    case "oily":
      addScore(scoreCard, "oiliness", "survey", 8);
      addScore(scoreCard, "pores", "survey", 5);
      addScore(scoreCard, "acne", "survey", 3);
      break;
    case "combination":
      addScore(scoreCard, "oiliness", "survey", 4);
      addScore(scoreCard, "dehydration", "survey", 3);
      addScore(scoreCard, "pores", "survey", 3);
      break;
    default:
      break;
  }

  if (answers.sensitivity === "high") {
    addScore(scoreCard, "barrier", "survey", 8);
    addScore(scoreCard, "redness", "survey", 7);
  } else if (answers.sensitivity === "medium") {
    addScore(scoreCard, "barrier", "survey", 4);
    addScore(scoreCard, "redness", "survey", 3);
  }

  if (answers.postWashFeeling === "tight") {
    addScore(scoreCard, "dehydration", "survey", 8);
    addScore(scoreCard, "barrier", "survey", 5);
    addScore(scoreCard, "redness", "survey", 2);
  }

  if (answers.postWashFeeling === "still_oily") {
    addScore(scoreCard, "oiliness", "survey", 8);
    addScore(scoreCard, "pores", "survey", 5);
    addScore(scoreCard, "acne", "survey", 3);
  }

  if (answers.afternoonSkinChange === "more_oily") {
    addScore(scoreCard, "oiliness", "survey", 7);
    addScore(scoreCard, "pores", "survey", 4);
    addScore(scoreCard, "acne", "survey", 2);
  }

  if (answers.afternoonSkinChange === "more_dry") {
    addScore(scoreCard, "dehydration", "survey", 7);
    addScore(scoreCard, "barrier", "survey", 4);
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    addScore(scoreCard, "redness", "survey", 8);
    addScore(scoreCard, "barrier", "survey", 5);
  }

  if (answers.cleansingFrequency === "3_plus") {
    addScore(scoreCard, "barrier", "survey", 3);
    addScore(scoreCard, "dehydration", "survey", 2);
  }

  if (answers.whiteCastHate) {
    addScore(scoreCard, "uv", "survey", 3);
  }

  if (answers.toneUpWanted) {
    addScore(scoreCard, "uv", "survey", 2);
    addScore(scoreCard, "uneven_tone", "survey", 1);
  }

  if (answers.makeupUse) {
    addScore(scoreCard, "pores", "survey", 2);
    addScore(scoreCard, "uv", "survey", 1);
  }

  if (answers.eyeSensitive) {
    addScore(scoreCard, "redness", "survey", 2);
    addScore(scoreCard, "barrier", "survey", 1);
    addScore(scoreCard, "uv", "survey", 1);
  }

  if (answers.outdoorExposure) {
    addScore(scoreCard, "uv", "survey", 10);
  }

  if (answers.verySensitivePeriod) {
    addScore(scoreCard, "barrier", "survey", 7);
    addScore(scoreCard, "redness", "survey", 6);
  }
}

function applyEnvironmentWeights(scoreCard, answers) {
  const exposureList = Array.isArray(answers.environmentExposure)
    ? answers.environmentExposure
    : [];

  exposureList.forEach((exposure) => {
    switch (exposure) {
      case "heat":
        addScore(scoreCard, "oiliness", "environment", 4);
        addScore(scoreCard, "redness", "environment", 2);
        addScore(scoreCard, "uv", "environment", 2);
        break;
      case "humidity":
        addScore(scoreCard, "oiliness", "environment", 4);
        addScore(scoreCard, "pores", "environment", 2);
        addScore(scoreCard, "acne", "environment", 2);
        break;
      case "mask":
        addScore(scoreCard, "redness", "environment", 4);
        addScore(scoreCard, "acne", "environment", 4);
        addScore(scoreCard, "barrier", "environment", 2);
        break;
      case "kitchen":
        addScore(scoreCard, "redness", "environment", 3);
        addScore(scoreCard, "oiliness", "environment", 3);
        addScore(scoreCard, "uv", "environment", 1);
        break;
      case "outdoor":
        addScore(scoreCard, "uv", "environment", 8);
        addScore(scoreCard, "redness", "environment", 2);
        addScore(scoreCard, "oiliness", "environment", 1);
        break;
      case "aircon":
        addScore(scoreCard, "dehydration", "environment", 4);
        addScore(scoreCard, "barrier", "environment", 2);
        addScore(scoreCard, "redness", "environment", 1);
        break;
      default:
        break;
    }
  });
}

function applyPhotoWeights(scoreCard, photoAnalysis) {
  const signals = photoAnalysis?.signals || {};

  CONCERN_AXES.forEach((axis) => {
    const rawValue = Number(signals[axis] || 0);
    const scaled = clamp(rawValue, 0, 5) * (axis === "uv" ? 3 : 4);
    addScore(scoreCard, axis, "photo", scaled);
  });
}

function sortConcernScores(items = []) {
  return [...items].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return PRIORITY_TIEBREAKER.indexOf(left.axis) - PRIORITY_TIEBREAKER.indexOf(right.axis);
  });
}

function getPriority(scoreCard, answers = {}) {
  const ranked = sortConcernScores(
    CONCERN_AXES.map((axis) => ({
      axis,
      score: scoreCard[axis].total
    }))
  );
  const top = ranked[0];

  if (!top || top.axis !== "oiliness") {
    return top;
  }

  const skinType = answers?.skinType;
  const isDrySkin = skinType === "dry";
  const isOilEligibleSkin = skinType === "oily" || skinType === "combination";
  const barrierScore = Number(scoreCard?.barrier?.total || 0);
  const rednessScore = Number(scoreCard?.redness?.total || 0);
  const dehydrationScore = Number(scoreCard?.dehydration?.total || 0);
  const oilinessScore = Number(scoreCard?.oiliness?.total || 0);
  const sensitiveOverride =
    answers?.sensitivity === "high" ||
    Boolean(answers?.verySensitivePeriod) ||
    barrierScore >= 18 ||
    rednessScore >= 18;
  const dehydrationOverride = dehydrationScore >= 18;
  const barrierOrRednessCandidate = sortConcernScores([
    { axis: "barrier", score: barrierScore },
    { axis: "redness", score: rednessScore }
  ])[0];
  const hydrationFamilyCandidate = sortConcernScores([
    { axis: "barrier", score: barrierScore },
    { axis: "redness", score: rednessScore },
    { axis: "dehydration", score: dehydrationScore }
  ])[0];

  if (sensitiveOverride && barrierOrRednessCandidate?.score > 0) {
    return barrierOrRednessCandidate;
  }

  if (isDrySkin && oilinessScore > 0) {
    if (hydrationFamilyCandidate?.score > 0) {
      return hydrationFamilyCandidate;
    }
  }

  if (!isOilEligibleSkin) {
    if (hydrationFamilyCandidate?.score > 0) {
      return hydrationFamilyCandidate;
    }
  }

  if ((dehydrationOverride || barrierScore >= 16 || rednessScore >= 16) && hydrationFamilyCandidate?.score > 0) {
    return hydrationFamilyCandidate;
  }

  return top;
}

function getConcernRanking(scoreCard) {
  return sortConcernScores(
    CONCERN_AXES.map((axis) => ({
      axis,
      score: scoreCard[axis].total
    }))
  );
}

const SUPPORTING_PRODUCT_ROLES = {
  same_concern_alternative: {
    ko: "같은 고민 대체",
    en: "Same-concern swap"
  },
  support_concern_booster: {
    ko: "보조 고민 보완",
    en: "Supporting concern booster"
  },
  low_irritation_option: {
    ko: "자극 낮춘 선택지",
    en: "Lower-irritation option"
  }
};

function uniqueConcernAxes(items = []) {
  const seen = new Set();
  return items
    .filter((axis) => CONCERN_AXES.includes(axis))
    .filter((axis) => {
      if (seen.has(axis)) {
        return false;
      }

      seen.add(axis);
      return true;
    });
}

function buildSupportingConcerns(scoreCard, answers = {}, priorityAxis) {
  const selectedConcerns = uniqueConcernAxes([
    ...(Array.isArray(answers.mainConcerns) ? answers.mainConcerns : []),
    answers.secondaryConcern
  ]).filter((axis) => axis !== priorityAxis);
  const rankedAxes = getConcernRanking(scoreCard).filter((item) => item.axis !== priorityAxis);
  const selectedRanked = rankedAxes
    .filter((item) => selectedConcerns.includes(item.axis) && item.score >= 6)
    .map((item) => item.axis);
  const scoreRanked = rankedAxes
    .filter((item) => item.score >= 12)
    .map((item) => item.axis);

  return uniqueConcernAxes([...selectedRanked, ...scoreRanked]).slice(0, 3);
}

function formatConcernList(axes = [], locale = "ko") {
  const labels = axes.map((axis) => getLabel(PRIORITY_LABELS, axis, locale)).filter(Boolean);

  if (!labels.length) {
    return "";
  }

  if (locale === "en") {
    return labels.length === 1 ? labels[0].toLowerCase() : labels.map((item) => item.toLowerCase()).join(" + ");
  }

  return labels.join("·");
}

function buildSupportingConcernLine(priorityAxis, supportingConcerns = [], locale = "ko") {
  if (!supportingConcerns.length) {
    return "";
  }

  const priorityLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const supportLabel = formatConcernList(supportingConcerns, locale);

  if (locale === "en") {
    return `${priorityLabel} stays first, but ${supportLabel} is also visible, so the routine should not solve one concern by making the others worse.`;
  }

  const hasHydrationSupport = supportingConcerns.some((axis) => ["dehydration", "barrier", "redness"].includes(axis));
  const hasFreshSupport = supportingConcerns.some((axis) => ["oiliness", "pores", "acne"].includes(axis));

  if (hasHydrationSupport && ["oiliness", "pores", "acne", "uv"].includes(priorityAxis)) {
    return `${priorityLabel}을 먼저 보되, ${supportLabel}도 함께 잡혀 있어 과하게 말리는 루틴은 피하는 편이 좋습니다.`;
  }

  if (hasFreshSupport && ["dehydration", "barrier", "redness"].includes(priorityAxis)) {
    return `${priorityLabel}을 먼저 보되, ${supportLabel}도 함께 보여 무겁게 덮는 루틴은 피하는 편이 좋습니다.`;
  }

  return `${priorityLabel}이 1순위지만 ${supportLabel}도 같이 보여, 한 축만 밀기보다 보조 고민까지 함께 고려하는 편이 좋습니다.`;
}

function getConcernPreferredSlots(axis) {
  switch (axis) {
    case "dehydration":
    case "barrier":
      return ["moisturizer", "serum", "toner_essence"];
    case "redness":
      return ["serum", "moisturizer", "toner_essence"];
    case "oiliness":
      return ["cleanser", "toner_essence", "sunscreen"];
    case "pores":
    case "uneven_tone":
      return ["toner_essence", "serum", "sunscreen"];
    case "acne":
      return ["cleanser", "serum", "toner_essence"];
    case "uv":
      return ["sunscreen"];
    default:
      return [];
  }
}

function productMatchesConcern(product, axis) {
  const slot = getProductSlot(product);
  return hasConcern(product, axis) || getConcernPreferredSlots(axis).includes(slot);
}

function isLowIrritationProduct(product) {
  const risk = String(product?.irritation_risk || "").toLowerCase();
  const skinTypes = Array.isArray(product?.skin_types) ? product.skin_types : [];

  return (
    product?.sensitivity_safe === true ||
    risk === "low" ||
    skinTypes.includes("sensitive") ||
    hasConcern(product, "barrier") ||
    hasConcern(product, "redness")
  );
}

function makeSupportingProductRole(role, product, { topPick, priorityAxis, supportingConcern, locale = "ko" } = {}) {
  if (!product) {
    return null;
  }

  const label = getLabel(SUPPORTING_PRODUCT_ROLES, role, locale);
  const priorityLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const supportLabel = supportingConcern
    ? getLabel(PRIORITY_LABELS, supportingConcern, locale)
    : formatConcernList([...(topPick?.concerns || []), priorityAxis].filter(Boolean), locale);

  if (locale === "en") {
    if (role === "support_concern_booster") {
      return {
        role,
        label,
        product,
        reason: `${supportLabel} also appears in the result, so this works as a support lane rather than another main hero.`,
        usage: `Use it on days when ${supportLabel.toLowerCase()} feels more noticeable, without stacking too many active roles together.`,
        relationToTopPick: `The Top Pick keeps ${priorityLabel.toLowerCase()} first; this fills the supporting gap.`
      };
    }

    if (role === "low_irritation_option") {
      return {
        role,
        label,
        product,
        reason: "This is the calmer option to keep the routine usable when the skin feels reactive.",
        usage: "Switch to it on days with stinging, redness, or unusual tightness.",
        relationToTopPick: "It leans less into performance and more into keeping the routine steady."
      };
    }

    return {
      role,
      label,
      product,
      reason: `This stays in the same ${priorityLabel.toLowerCase()} lane when the Top Pick feel is not right.`,
      usage: "Swap it in instead of the Top Pick when you want the same role with a different finish or texture.",
      relationToTopPick: "It keeps the same concern direction but changes the wear profile."
    };
  }

  if (role === "support_concern_booster") {
    return {
      role,
      label,
      product,
      reason: `${supportLabel}도 같이 잡혀 있어, 1순위 고민만 밀기보다 빈틈을 보완하는 역할입니다.`,
      usage: `${supportLabel}이 더 도드라지는 날에는 Top Pick을 무리하게 겹치기보다 필요한 단계로만 더하세요.`,
      relationToTopPick: `Top Pick이 ${priorityLabel}을 먼저 잡는다면, 이 제품은 ${supportLabel} 쪽 부족한 축을 보완합니다.`
    };
  }

  if (role === "low_irritation_option") {
    return {
      role,
      label,
      product,
      reason: "예민한 날에는 같은 목표라도 자극 부담을 낮춘 선택지가 필요합니다.",
      usage: "따가움, 붉은기, 과한 당김이 있는 날에는 이 제품으로 먼저 반응을 보세요.",
      relationToTopPick: "Top Pick보다 기능을 더 밀기보다 안정감과 반응 관찰에 초점을 둡니다."
    };
  }

  return {
    role,
    label,
    product,
    reason: `Top Pick이 맞지 않을 때 같은 ${priorityLabel} 축에서 바꿔 볼 수 있는 선택입니다.`,
    usage: "Top Pick 사용감이 부담스럽거나 같은 역할 안에서 다른 마무리를 보고 싶을 때 교체해서 쓰세요.",
    relationToTopPick: "Top Pick과 같은 고민을 보지만 제형, 마무리, 단계 부담을 다르게 가져갑니다."
  };
}

function buildRoleBasedSupportingProducts({
  scoredProducts = [],
  supportingCandidates = [],
  topPick,
  targetSlot,
  priorityAxis,
  supportingConcerns = [],
  locale = "ko"
} = {}) {
  const used = new Set(topPick?.id ? [topPick.id] : []);
  const pool = [...supportingCandidates, ...scoredProducts]
    .filter((product) => product?.id && !used.has(product.id))
    .filter((product, index, products) => products.findIndex((item) => item.id === product.id) === index);
  const picked = [];
  const pickProduct = (predicate) => {
    const product = pool.find((item) => !used.has(item.id) && predicate(item));

    if (product) {
      used.add(product.id);
    }

    return product || null;
  };
  const addRole = (role, product, supportingConcern = null) => {
    if (!product || picked.some((item) => item.role === role || item.product?.id === product.id)) {
      return;
    }

    const item = makeSupportingProductRole(role, product, {
      topPick,
      priorityAxis,
      supportingConcern,
      locale
    });

    if (item) {
      picked.push(item);
    }
  };
  const sameConcernProduct =
    pickProduct((product) => getProductSlot(product) === targetSlot && productMatchesConcern(product, priorityAxis)) ||
    pickProduct((product) => getProductSlot(product) === targetSlot) ||
    pickProduct((product) => productMatchesConcern(product, priorityAxis));

  addRole("same_concern_alternative", sameConcernProduct);

  const supportConcern = supportingConcerns.find((axis) =>
    pool.some((product) => !used.has(product.id) && productMatchesConcern(product, axis))
  ) || supportingConcerns[0] || null;
  const supportPreferredSlots = supportConcern ? getConcernPreferredSlots(supportConcern) : [];
  const supportProduct = supportConcern
    ? pickProduct((product) => {
        const slot = getProductSlot(product);
        return slot !== targetSlot && productMatchesConcern(product, supportConcern) && supportPreferredSlots.includes(slot);
      }) ||
      pickProduct((product) => {
        const slot = getProductSlot(product);
        return slot !== targetSlot && productMatchesConcern(product, supportConcern);
      }) ||
      pickProduct((product) => productMatchesConcern(product, supportConcern))
    : pickProduct((product) => getProductSlot(product) !== targetSlot);

  addRole("support_concern_booster", supportProduct, supportConcern);

  const lowIrritationProduct =
    pickProduct((product) => getProductSlot(product) !== targetSlot && isLowIrritationProduct(product)) ||
    pickProduct(isLowIrritationProduct);

  addRole("low_irritation_option", lowIrritationProduct);

  if (picked.length < 2) {
    const fallbackRoles = ["support_concern_booster", "low_irritation_option", "same_concern_alternative"]
      .filter((role) => !picked.some((item) => item.role === role));

    for (const role of fallbackRoles) {
      const fallbackProduct =
        pickProduct((product) => getProductSlot(product) !== targetSlot) ||
        pickProduct(() => true);
      addRole(role, fallbackProduct, supportConcern);

      if (picked.length >= 2) {
        break;
      }
    }
  }

  return picked.slice(0, 3);
}

const ROUTINE_MODE_COPY = {
  ko: {
    protective: "보호 집중형",
    fresh_control: "산뜻 컨트롤형",
    hydration_hold: "수분 유지형",
    low_irritation_protect: "저자극 보호형",
    minimal_barrier: "미니멀 장벽형",
    recovery: "회복 중심형",
    reset: "리셋 정리형",
    acne_care: "트러블 케어형",
    pore_texture_care: "모공·결 케어형",
    calming_repair: "진정 회복형",
    barrier_repair: "장벽 회복형"
  },
  en: {
    protective: "Protective",
    fresh_control: "Fresh control",
    hydration_hold: "Hydration hold",
    low_irritation_protect: "Low-irritation protect",
    minimal_barrier: "Minimal barrier",
    recovery: "Recovery",
    reset: "Reset",
    acne_care: "Acne care",
    pore_texture_care: "Pore + texture care",
    calming_repair: "Calming repair",
    barrier_repair: "Barrier repair"
  }
};

function getRoutineModeLabel(mode, locale = "ko") {
  const copy = ROUTINE_MODE_COPY[locale] || ROUTINE_MODE_COPY.ko;
  return copy[mode] || mode;
}

function getRoutineModes(priorityAxis) {
  switch (priorityAxis) {
    case "uv":
      return { am: "protective", pm: "recovery" };
    case "oiliness":
      return { am: "fresh_control", pm: "reset" };
    case "dehydration":
      return { am: "hydration_hold", pm: "recovery" };
    case "barrier":
      return { am: "minimal_barrier", pm: "barrier_repair" };
    case "redness":
      return { am: "low_irritation_protect", pm: "calming_repair" };
    case "acne":
      return { am: "fresh_control", pm: "acne_care" };
    case "pores":
      return { am: "fresh_control", pm: "pore_texture_care" };
    case "uneven_tone":
      return { am: "protective", pm: "pore_texture_care" };
    default:
      return { am: "hydration_hold", pm: "recovery" };
  }
}

function buildRoutineStructure(priorityAxis, targetSlot, scoreCard, amFocus, pmFocus, locale = "ko") {
  const ranking = getConcernRanking(scoreCard);
  const lead = ranking[0] || { axis: priorityAxis, score: 0 };
  const runnerUp = ranking[1] || { axis: null, score: 0 };
  const gap = lead.score - runnerUp.score;
  const modes = getRoutineModes(priorityAxis);
  const modeCards = [
    {
      key: "morning",
      label: locale === "en" ? `AM · ${getRoutineModeLabel(modes.am, locale)}` : `AM · ${getRoutineModeLabel(modes.am, locale)}`,
      body: amFocus,
      mode: modes.am
    },
    {
      key: "night",
      label: locale === "en" ? `PM · ${getRoutineModeLabel(modes.pm, locale)}` : `PM · ${getRoutineModeLabel(modes.pm, locale)}`,
      body: pmFocus,
      mode: modes.pm
    }
  ].filter((item) => item.body);

  return {
    type: "mode_split",
    label: locale === "en" ? "AM / PM strategy" : "AM / PM 전략",
    title: locale === "en" ? "AM / PM Usage Strategy" : "AM / PM 사용 전략",
    body:
      locale === "en"
        ? "The same Top Pick stays fixed, but the way you use the routine should change between daytime control and evening correction."
        : "Top Pick은 유지하되, 낮에는 버티는 방식과 밤에는 정리하는 방식이 달라져야 실제 체감이 좋아집니다.",
    cards: modeCards,
    am: {
      mode: modes.am,
      label: getRoutineModeLabel(modes.am, locale),
      strategyLine: amFocus
    },
    pm: {
      mode: modes.pm,
      label: getRoutineModeLabel(modes.pm, locale),
      strategyLine: pmFocus
    },
    meta: {
      primaryAxis: lead.axis,
      secondaryAxis: runnerUp.axis,
      gap,
      topCategory: targetSlot
    }
  };
}

function buildPublicRoutineLists(routineStructure) {
  const morning = routineStructure?.am?.strategyLine ? [routineStructure.am.strategyLine] : [];
  const night = routineStructure?.pm?.strategyLine ? [routineStructure.pm.strategyLine] : [];

  return { morning, night };
}

function getTopCategorySlot(priorityAxis, answers, scoreCard) {
  switch (priorityAxis) {
    case "uv":
      return "sunscreen";
    case "pores":
      return "toner_essence";
    case "barrier":
    case "dehydration":
      return "moisturizer";
    case "redness":
      return "serum";
    case "acne":
      return answers.sensitivity === "high" ? "serum" : "cleanser";
    case "oiliness":
      return answers.outdoorExposure ? "sunscreen" : "cleanser";
    case "uneven_tone":
      return scoreCard.uv.total >= 12 ? "sunscreen" : "serum";
    default:
      return "serum";
  }
}

function getEnvironmentAdjustment(product, answers, scoreCard) {
  let total = 0;
  const reasons = [];
  const slot = getProductSlot(product);
  const exposures = Array.isArray(answers.environmentExposure)
    ? answers.environmentExposure
    : [];

  if ((answers.outdoorExposure || exposures.includes("outdoor")) && slot === "sunscreen") {
    total += 8;
    reasons.push("outdoor-support");
  }

  if ((exposures.includes("heat") || exposures.includes("humidity")) && slot === "sunscreen") {
    total += 4;
    reasons.push("hot-weather-spf");
  }

  if (exposures.includes("aircon") && slot === "moisturizer") {
    total += 4;
    reasons.push("aircon-barrier");
  }

  if (exposures.includes("mask") && (slot === "serum" || slot === "moisturizer") && isLowIrritation(product)) {
    total += 4;
    reasons.push("mask-calming");
  }

  if (exposures.includes("humidity") && slot === "toner_essence" && scoreCard.pores.total >= 12) {
    total += 4;
    reasons.push("humid-pore-control");
  }

  if ((exposures.includes("heat") || exposures.includes("kitchen")) && slot === "cleanser" && scoreCard.oiliness.total >= 12) {
    total += 2;
    reasons.push("heat-cleanse-reset");
  }

  return { total, reasons };
}

function getHeroBoost(product, answers, scoreCard, targetSlot) {
  let total = 0;
  const reasons = [];
  const slot = getProductSlot(product);
  const acneHigh = scoreCard.acne.total >= 18;
  const oilHigh = scoreCard.oiliness.total >= 18;
  const poresHigh = scoreCard.pores.total >= 18;
  const barrierHigh = scoreCard.barrier.total >= 18;
  const dehydrationHigh = scoreCard.dehydration.total >= 18;
  const rednessHigh = scoreCard.redness.total >= 18;

  if (slot === targetSlot) {
    total += 16;
    reasons.push("priority-slot");
  }

  if (answers.outdoorExposure && slot === "sunscreen") {
    total += 10;
    reasons.push("outdoor-hero");
  }

  if (acneHigh && oilHigh && answers.sensitivity === "low") {
    if (isHeroNamedCleanser(product)) {
      total += 14;
      reasons.push("hero-perfect-whip");
    } else if (slot === "cleanser") {
      total += 6;
      reasons.push("hero-cleanser");
    }
  }

  if (poresHigh && oilHigh && answers.sensitivity === "low" && slot === "toner_essence") {
    total += 12;
    reasons.push("hero-toner-pad");
  }

  if ((barrierHigh || dehydrationHigh) && slot === "moisturizer") {
    total += 10;
    reasons.push("hero-moisturizer");
  }

  if ((rednessHigh || acneHigh) && isCalmingSerum(product)) {
    total += 10;
    reasons.push("hero-calming-serum");
  }

  return { total, reasons };
}

function getHardPenalty(product, answers, scoreCard) {
  let total = 0;
  const reasons = [];
  const slot = getProductSlot(product);
  const finish = normalizeCanonicalFinish(product.finish);

  if (answers.sensitivity === "high" && product.irritation_risk === "high") {
    total -= 22;
    reasons.push("high-sensitivity-irritation");
  }

  if (scoreCard.barrier.total >= 18 && slot === "toner_essence" && !isLowIrritation(product)) {
    total -= 16;
    reasons.push("weak-barrier-toner-pad");
  }

  if (scoreCard.dehydration.total >= 18 && finish === "soft_matte") {
    total -= 14;
    reasons.push("dehydration-soft-matte");
  }

  if (scoreCard.redness.total >= 18 && isDeepCleanser(product)) {
    total -= 18;
    reasons.push("redness-deep-clean");
  }

  return { total, reasons };
}

function buildAvoidancePhrase(product, answers, penalties, locale = "ko") {
  if (penalties.includes("high-sensitivity-irritation")) {
    return locale === "en" ? "high-irritation options" : "자극이 강한 옵션";
  }

  if (penalties.includes("dehydration-soft-matte")) {
    return locale === "en" ? "a matte, drying finish" : "건조하게 마르는 매트한 마무리";
  }

  if (answers.mostDislikedFeel === "sticky") {
    return locale === "en" ? "sticky residue" : "끈적한 잔여감";
  }

  if (answers.mostDislikedFeel === "greasy") {
    return locale === "en" ? "greasy shine" : "번들거리는 막감";
  }

  if (answers.mostDislikedFeel === "heavy") {
    return locale === "en" ? "a heavy layer" : "무거운 레이어감";
  }

  return locale === "en" ? "unnecessary routine drag" : "불필요한 루틴 부담";
}

function buildSkinStatePhrase(answers, scoreCard, locale = "ko") {
  const parts = [];

  if (answers.skinType && answers.skinType !== "not_sure") {
    const map = {
      ko: {
        oily: "유분이 빠르게 올라오는 피부",
        dry: "쉽게 당기는 피부",
        combination: "유분과 건조가 같이 움직이는 피부"
      },
      en: {
        oily: "skin that gets shiny quickly",
        dry: "skin that tightens easily",
        combination: "skin balancing shine and dryness"
      }
    };
    parts.push(map[getLocale(locale)][answers.skinType] || "");
  }

  if (scoreCard.barrier.total >= 18) {
    parts.push(locale === "en" ? "with a shaky barrier" : "장벽이 흔들리기 쉬운 상태");
  } else if (scoreCard.redness.total >= 18) {
    parts.push(locale === "en" ? "with easily visible flushing" : "붉은기가 쉽게 올라오는 상태");
  }

  return parts.filter(Boolean).slice(0, 2).join(locale === "en" ? " " : " / ");
}

function hasBatchim(value) {
  const text = String(value || "").trim();

  if (!text) {
    return false;
  }

  const lastChar = Array.from(text).pop();
  const code = lastChar ? lastChar.charCodeAt(0) : 0;

  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }

  return (code - 0xac00) % 28 !== 0;
}

function withTopicParticle(value) {
  const text = String(value || "").trim();
  return text ? `${text}${hasBatchim(text) ? "은" : "는"}` : text;
}

function getKoreanCategoryName(product) {
  switch (product?.category) {
    case "toner_pad":
      return "토너 패드";
    case "ampoule":
      return "앰플";
    default: {
      switch (getProductSlot(product)) {
        case "cleanser":
          return "클렌저";
        case "toner_essence":
          return "토너/에센스";
        case "serum":
          return "세럼";
        case "moisturizer":
          return "보습제";
        case "sunscreen":
          return "선크림";
        default:
          return "이 제품";
      }
    }
  }
}

function getKoreanTextureLabel(product) {
  switch (normalizeCanonicalTexture(product?.texture || "")) {
    case "watery":
      return "워터리한 사용감";
    case "gel":
      return "가벼운 젤 사용감";
    case "lotion":
      return "로션처럼 부드러운 사용감";
    case "cream":
      return "쿠션감 있는 크림 사용감";
    default:
      return "가벼운 사용감";
  }
}

function getKoreanFinishLabel(product) {
  switch (normalizeCanonicalFinish(product?.finish || "natural")) {
    case "fresh":
      return "산뜻한 마무리";
    case "dewy":
      return "촉촉한 마무리";
    case "soft_matte":
      return "보송한 마무리";
    default:
      return "무난한 마무리";
  }
}

function getPhotoSignalAxes(photoEvidence = []) {
  return new Set(
    (Array.isArray(photoEvidence) ? photoEvidence : [])
      .map((item) => item?.axis)
      .filter(Boolean)
  );
}

function buildKoreanCategoryAwareReason(
  product,
  answers,
  scoreCard,
  priorityAxis,
  penalties,
  photoEvidence = []
) {
  const slot = getProductSlot(product);
  const categoryName = getKoreanCategoryName(product);
  const textureLabel = getKoreanTextureLabel(product);
  const finishLabel = getKoreanFinishLabel(product);
  const photoAxes = getPhotoSignalAxes(photoEvidence);
  const exposures = Array.isArray(answers.environmentExposure) ? answers.environmentExposure : [];
  const hasOutdoor = Boolean(answers.outdoorExposure || exposures.includes("outdoor"));
  const highOil =
    scoreCard.oiliness.total >= 18 ||
    answers.skinType === "oily" ||
    answers.afternoonSkinChange === "more_oily" ||
    photoAxes.has("oiliness");
  const highPores = scoreCard.pores.total >= 16 || photoAxes.has("pores");
  const highDry =
    scoreCard.dehydration.total >= 18 ||
    answers.skinType === "dry" ||
    answers.postWashFeeling === "tight";
  const sensitiveState =
    answers.sensitivity === "high" ||
    scoreCard.barrier.total >= 18 ||
    scoreCard.redness.total >= 18 ||
    photoAxes.has("redness") ||
    photoAxes.has("barrier");
  const acneState = scoreCard.acne.total >= 16 || priorityAxis === "acne";
  const hatesHeavy = answers.mostDislikedFeel === "heavy" || answers.mostDislikedFeel === "greasy";

  if (slot === "sunscreen") {
    const leadSentence = hasOutdoor || priorityAxis === "uv"
      ? "야외 노출이나 자외선 비중이 높은 날에는, 선크림 단계에서 보호를 안정적으로 가져가면서도 마무리 부담을 줄이는 쪽이 먼저입니다."
      : highOil
        ? "유분이 빠르게 올라오는 피부라면, 선크림도 보호력만 보지 말고 번들거림을 늦추는 쪽으로 고르는 편이 좋습니다."
        : highDry
          ? "건조감이 올라오는 피부라면, 선크림도 지나치게 뽀송하게 마르기보다 편안하게 남는 쪽이 먼저입니다."
          : sensitiveState
            ? "예민함이 잡힌 상태라면, 선크림도 보호와 함께 자극 부담을 낮추는 쪽을 먼저 챙기는 편이 안전합니다."
            : "낮 루틴에서는 선크림이 보호 단계이면서도 끝마무리 사용감을 결정하므로, 편하게 이어갈 수 있는 쪽이 먼저입니다.";
    const fitSentence = highOil
      ? `이 제품은 ${finishLabel} 쪽이라 번들거림이 빨리 올라오는 날에도 비교적 가볍게 가기 좋고, 아침 루틴 끝에 충분히 바른 뒤 답답하면 앞단 보습을 줄여 쓰기 좋습니다.`
      : highDry
        ? "이 제품은 지나치게 매트하게 마르지 않는 쪽이라 당김이 있는 날에도 비교적 쓰기 편하고, 보습을 얇게 깐 뒤 마무리 단계로 두기 좋습니다."
        : sensitiveState
          ? "이 제품은 자극 부담이 낮은 편이라 예민한 날에도 비교적 무리가 덜하고, 외출이 길면 덧바르기 중심으로 가져가기 좋습니다."
          : `이 제품은 ${textureLabel}과 ${finishLabel} 쪽이라 데일리로 이어가기 편하고, 아침 루틴 마지막 단계에서 넉넉히 바르기 좋습니다.`;

    return `${leadSentence} ${fitSentence}`.trim();
  }

  if (slot === "cleanser") {
    const leadSentence = sensitiveState
      ? "세안 뒤 당김이나 예민함이 같이 올라오는 피부라면, 세정력만 강한 쪽보다 부담을 덜 남기는 클렌저부터 맞추는 편이 좋습니다."
      : highOil || highPores || acneState
        ? "유분과 막힘 신호가 같이 보이는 피부라면, 세안 단계에서 잔여감과 번들거림을 먼저 정리하는 쪽이 맞습니다."
        : highDry
          ? "세안 뒤 당김이 남는 피부라면, 과하게 벗겨내지 않는 클렌저부터 맞추는 편이 좋습니다."
          : `${withTopicParticle(categoryName)} 현재 고민을 정리하는 첫 단계로 두기 좋은 편입니다.`;
    const fitSentence = sensitiveState
      ? "이 제품은 비교적 순한 세정감이라 필요한 정리감은 주되 과하게 뽀드득해지지 않게 가기 좋고, 저녁에도 문지르는 시간을 길게 끌지 않는 쪽이 좋습니다."
      : highOil || acneState
        ? "이 제품은 잔여감이 무겁지 않은 쪽이라 번들거림과 막힘 부담을 줄이기 좋고, 선크림을 쓴 날 저녁에 우선 맞추기 좋습니다."
        : highDry
          ? "이 제품은 세안 뒤 건조감을 덜 남기는 쪽이라 데일리로 이어가기 편하고, 필요 이상으로 여러 번 씻지 않는 흐름에 잘 맞습니다."
          : `이 제품은 ${textureLabel} 쪽이라 첫 단계 부담을 크게 남기지 않고, 세안 강도를 세게 올리지 않아도 되는 흐름에 맞습니다.`;

    return `${leadSentence} ${fitSentence}`.trim();
  }

  if (slot === "toner_essence") {
    const leadSentence = highPores || priorityAxis === "pores" || priorityAxis === "uneven_tone"
      ? "모공이나 결이 고르지 않게 보일 때는, 여러 기능을 겹치기보다 토너 단계에서 표면을 가볍게 정돈하는 쪽이 먼저입니다."
      : sensitiveState
        ? "예민한 피부라면 토너 단계도 강하게 밀기보다, 필요한 정돈만 주고 자극은 남기지 않는 쪽이 중요합니다."
        : `${withTopicParticle(categoryName)} 현재 루틴에 가볍게 붙여 표면 흐름을 정리하기 좋은 보조 단계입니다.`;
    const fitSentence = sensitiveState
      ? "이 제품은 표면 결을 정리하는 역할에는 맞지만, 예민한 날에는 매일보다는 간격을 두고 얇게 쓰는 편이 안전합니다."
      : "이 제품은 토너·패드 단계에서 모공·결 케어를 시작하기 좋은 역할이라, 매일 강하게 쓰기보다 주 2~3회 또는 얇은 레이어부터 시작하는 편이 좋습니다.";

    return `${leadSentence} ${fitSentence}`.trim();
  }

  if (slot === "serum") {
    const leadSentence = sensitiveState
      ? "예민함이나 붉은기가 같이 잡힌 피부라면, 세럼 단계에서 진정과 컨디션 회복을 먼저 챙기는 편이 맞습니다."
      : acneState || priorityAxis === "redness"
        ? "트러블이나 붉은기가 주요 고민이라면, 세럼 단계에서는 여러 기능을 겹치기보다 자극 부담을 낮춘 보조를 먼저 두는 편이 좋습니다."
        : highDry
          ? "건조감이 잡혀 있다면, 세럼 단계에서도 수분과 편안함을 먼저 이어주는 편이 좋습니다."
          : `${withTopicParticle(categoryName)} 현재 고민을 한 축으로 모아 다루기 좋은 중심 단계입니다.`;
    const fitSentence = sensitiveState || acneState || priorityAxis === "redness"
      ? "이 제품은 진정 쪽에 무게가 실려 있어 과하게 자극적으로 밀지 않고 붙이기 좋고, 토너 다음에 소량만 두고 다른 활성 단계는 겹치지 않는 편이 좋습니다."
      : highDry
        ? "이 제품은 수분감을 얇게 보태는 쪽이라 건조감이 올라오는 날에도 무겁지 않게 이어가기 좋고, 보습 전 단계에서 한 번만 두기 좋습니다."
        : `이 제품은 ${textureLabel} 쪽이라 메인 고민을 건드리면서도 루틴이 무겁게 흐르지 않게 잡아주고, 한 단계만 고정해 반응을 보기 좋습니다.`;

    return `${leadSentence} ${fitSentence}`.trim();
  }

  if (slot === "moisturizer") {
    const leadSentence = sensitiveState || priorityAxis === "barrier"
      ? "장벽과 예민함이 함께 잡힌 피부라면, 보습 단계에서는 기능을 더 얹기보다 편안함이 오래 남는 쪽을 먼저 보는 편이 맞습니다."
      : highDry || priorityAxis === "dehydration"
        ? "세안 뒤 당김이 이어지는 피부라면, 보습 단계에서 수분이 쉽게 끊기지 않게 붙잡아 주는 쪽이 중요합니다."
        : hatesHeavy
          ? "보습은 필요하지만 무거운 마무리는 피하고 싶다면, 답답하지 않게 남는 보습제를 먼저 보는 편이 맞습니다."
          : `${withTopicParticle(categoryName)} 루틴 마무리를 흔들리지 않게 잡아주는 단계입니다.`;
    const fitSentence = sensitiveState
      ? "이 제품은 과하게 답답하지 않으면서 편안함을 유지하기 좋아 현재 조건에 무리가 덜하고, 저녁에는 기능성 단계를 늘리기보다 이 단계로 마무리하기 좋습니다."
      : highDry
        ? "이 제품은 수분감을 붙들어 주는 쪽이라 건조감이 올라오는 날에도 마무리가 급하게 마르지 않고, 세안 뒤 얇게 여러 번보다 한 번 안정적으로 두기 좋습니다."
        : hatesHeavy || highOil
          ? "이 제품은 무겁게 눌러앉는 편은 아니라 보습이 필요해도 마무리 부담을 크게 남기지 않고, 아침에는 소량만 두고 끝내기 좋습니다."
          : `이 제품은 ${finishLabel} 쪽이라 마무리 단계를 안정적으로 이어가기 좋고, 회복용 보습 축으로 고정해 두기 편합니다.`;

    return `${leadSentence} ${fitSentence}`.trim();
  }

  return `${withTopicParticle(categoryName)} 현재 고민을 먼저 풀어야 할 단계로 두기 좋습니다. 이 제품은 ${textureLabel}과 ${finishLabel} 쪽이라 지금 조건에서 부담을 크게 남기지 않고, 한 단계만 고정해 반응을 보기 좋습니다.`;
}

function buildDefaultReason(product, answers, scoreCard, priorityAxis, penalties, locale = "ko") {
  const concernLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const slotLabel = getLabel(CATEGORY_SLOT_LABELS, getProductSlot(product), locale);
  const texture = product.texture || (locale === "en" ? "light" : "가벼운");
  const finish = normalizeCanonicalFinish(product.finish || "natural");
  const avoidance = buildAvoidancePhrase(product, answers, penalties, locale);
  const skinState = buildSkinStatePhrase(answers, scoreCard, locale);

  if (locale === "en") {
    return `${slotLabel} stays closer to ${skinState || "your current skin state"} when ${concernLabel.toLowerCase()} is driving the decision. The ${texture} texture with a ${finish.replace(/_/g, " ")} finish helps without leaning into ${avoidance}.`;
  }

  return buildKoreanCategoryAwareReason(product, answers, scoreCard, priorityAxis, penalties, []);
}

function buildDefaultComparisonReason(product, runnerUp, priorityAxis, locale = "ko") {
  if (!runnerUp) {
    return locale === "en"
      ? "This product stays more directly aligned with the current priority."
      : "지금 우선순위에 가장 곧게 맞는 제품입니다.";
  }

  const winnerSlot = getLabel(CATEGORY_SLOT_LABELS, getProductSlot(product), locale);
  const concernLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);

  if (locale === "en") {
    return `${winnerSlot} keeps the ${concernLabel.toLowerCase()} decision more practical than ${runnerUp.name} for this input mix.`;
  }

  switch (getProductSlot(product)) {
    case "sunscreen":
      return `같은 조건에서 ${product.name} 쪽이 자외선 차단과 사용감 균형을 ${runnerUp.name}보다 더 안정적으로 맞춥니다.`;
    case "cleanser":
      return `같은 조건에서 ${product.name} 쪽이 세정감과 부담 균형을 ${runnerUp.name}보다 더 무난하게 맞춥니다.`;
    case "toner_essence":
      return `같은 조건에서 ${product.name} 쪽이 결 정돈과 자극 부담 균형을 ${runnerUp.name}보다 더 실용적으로 맞춥니다.`;
    case "serum":
      return `같은 조건에서 ${product.name} 쪽이 현재 고민을 ${runnerUp.name}보다 더 직접적으로 다루기 좋습니다.`;
    case "moisturizer":
      return `같은 조건에서 ${product.name} 쪽이 보습과 마무리 부담 균형을 ${runnerUp.name}보다 더 안정적으로 맞춥니다.`;
    default:
      return `${winnerSlot} 쪽이 ${concernLabel} 기준에서 ${runnerUp.name}보다 지금 조건에 더 무난하게 맞습니다.`;
  }
}

function getEvidenceLead(evidence = []) {
  if (!Array.isArray(evidence)) {
    return "";
  }

  return evidence.find((item) => item?.detail)?.detail || "";
}

function buildEvidenceGroundedReason(
  product,
  answers,
  scoreCard,
  priorityAxis,
  penalties,
  photoEvidence,
  surveyEvidence,
  locale = "ko"
) {
  const concernLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const slotLabel = getLabel(CATEGORY_SLOT_LABELS, getProductSlot(product), locale);
  const texture = product.texture || (locale === "en" ? "light" : "가벼운");
  const finish = normalizeCanonicalFinish(product.finish || "natural").replace(/_/g, " ");
  const avoidance = buildAvoidancePhrase(product, answers, penalties, locale);
  const skinState = buildSkinStatePhrase(answers, scoreCard, locale);
  const photoLead = getEvidenceLead(photoEvidence);
  const surveyLead = getEvidenceLead(surveyEvidence);
  const evidenceLead = photoLead || surveyLead;

  if (locale === "en") {
    const evidenceClause = evidenceLead
      ? ` ${evidenceLead}`
      : " The survey and visible cues both pointed to the same priority.";

    return `${slotLabel} fits ${skinState || "your current skin state"} while ${concernLabel.toLowerCase()} stays in front.${evidenceClause} The ${texture} texture with a ${finish} finish keeps the match away from ${avoidance}.`;
  }

  return buildKoreanCategoryAwareReason(product, answers, scoreCard, priorityAxis, penalties, photoEvidence);
}

function buildPremiumTopPickReason(
  topPick,
  answers,
  scoreCard,
  priorityAxis,
  warnings,
  photoEvidence,
  surveyEvidence,
  locale = "ko"
) {
  if (!topPick) {
    return "";
  }

  const summaryReason = buildEvidenceGroundedReason(
    topPick,
    answers,
    scoreCard,
    priorityAxis,
    topPick?.decision_meta?.penalty_reasons || [],
    photoEvidence,
    surveyEvidence,
    locale
  );
  const surveyLead = getEvidenceLead(surveyEvidence);
  const photoLead = getEvidenceLead(photoEvidence);
  const lines = [summaryReason];
  const supportingLine = buildSupportingConcernLine(
    priorityAxis,
    buildSupportingConcerns(scoreCard, answers, priorityAxis),
    locale
  );

  if (supportingLine) {
    lines.push(supportingLine);
  }

  if (surveyLead) {
    lines.push(
      locale === "en"
        ? `Survey signal: ${surveyLead}`
        : `설문 근거: ${surveyLead}`
    );
  }

  if (photoLead) {
    lines.push(
      locale === "en"
        ? `Photo signal: ${photoLead}`
        : `사진 근거: ${photoLead}`
    );
  }

  if (warnings?.[0]) {
    lines.push(
      locale === "en"
        ? `Constraint to respect: ${warnings[0]}`
        : `함께 지킬 제약: ${warnings[0]}`
    );
  }

  const reviewEvidence = buildReviewEvidenceSentence(topPick?.review_signals, locale);

  if (reviewEvidence) {
    lines.push(reviewEvidence);
  }

  return lines.filter(Boolean).join(" ");
}

function formatEvidenceItem(axis, label, detail) {
  return {
    axis,
    label: String(label || "").trim(),
    detail: String(detail || "").trim()
  };
}

function buildSurveyEvidence(answers, scoreCard, locale = "ko") {
  const items = [];
  const concernLabel = getLabel(PRIORITY_LABELS, answers.mainConcern || answers.mainConcerns?.[0], locale);

  if (concernLabel) {
    items.push(
      formatEvidenceItem(
        answers.mainConcern || answers.mainConcerns?.[0],
        locale === "en" ? "Survey priority" : "설문 우선 고민",
        locale === "en"
          ? `${concernLabel} was selected as the lead concern.`
          : `${concernLabel}을(를) 주요 고민으로 선택했습니다.`
      )
    );
  }

  if (answers.postWashFeeling === "tight") {
    items.push(
      formatEvidenceItem(
        "dehydration",
        locale === "en" ? "After-cleansing feel" : "세안 후 느낌",
        locale === "en"
          ? "Tightness after cleansing pushed dehydration and barrier support higher."
          : "세안 후 당김이 있어 건조와 장벽 점수를 올렸습니다."
      )
    );
  }

  if (answers.afternoonSkinChange === "more_oily") {
    items.push(
      formatEvidenceItem(
        "oiliness",
        locale === "en" ? "Afternoon change" : "오후 피부 변화",
        locale === "en"
          ? "Midday oil rise pushed oiliness and pores higher."
          : "오후 유분 증가가 유분과 모공 점수를 끌어올렸습니다."
      )
    );
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    items.push(
      formatEvidenceItem(
        "redness",
        locale === "en" ? "Afternoon change" : "오후 피부 변화",
        locale === "en"
          ? "Afternoon irritation pushed redness and barrier higher."
          : "오후 예민함이 붉은기와 장벽 점수를 올렸습니다."
      )
    );
  }

  if (answers.outdoorExposure || (Array.isArray(answers.environmentExposure) && answers.environmentExposure.includes("outdoor"))) {
    items.push(
      formatEvidenceItem(
        "uv",
        locale === "en" ? "Outdoor exposure" : "야외 노출",
        locale === "en"
          ? "Outdoor exposure kept UV protection in the top tier."
          : "야외 노출이 있어 자외선 축을 상단 우선순위로 유지했습니다."
      )
    );
  }

  if (answers.sensitivity === "high" || scoreCard.barrier.total >= 18) {
    items.push(
      formatEvidenceItem(
        "barrier",
        locale === "en" ? "Sensitivity guardrail" : "민감도 가드레일",
        locale === "en"
          ? "Higher sensitivity increased barrier-first weighting."
          : "민감도가 높아 장벽 우선 가중치를 더했습니다."
      )
    );
  }

  return items.slice(0, 4);
}

function buildWarnings(answers, scoreCard, priorityAxis, locale = "ko") {
  const warnings = [];
  const pushWarning = (message) => {
    if (message && !warnings.includes(message)) {
      warnings.push(message);
    }
  };
  const sensitiveState =
    answers.sensitivity === "high" ||
    scoreCard.redness.total >= 18 ||
    scoreCard.barrier.total >= 18;
  const dehydrationState = scoreCard.dehydration.total >= 18;
  const oilinessState = scoreCard.oiliness.total >= 16;
  const acneState = priorityAxis === "acne" || scoreCard.acne.total >= 16;
  const overCleansingRisk =
    answers.cleansingFrequency === "3_plus" ||
    answers.postWashFeeling === "tight" ||
    answers.afternoonSkinChange === "more_oily";
  const productStackingRisk =
    acneState ||
    priorityAxis === "pores" ||
    priorityAxis === "uneven_tone";

  if (priorityAxis === "barrier") {
    pushWarning(
      locale === "en"
        ? "Do not stack exfoliating pads, strong cleansing, and new actives in the same short window while the barrier is unsettled."
        : "장벽이 흔들릴 때는 각질 패드, 강한 세안, 새 기능성 제품을 한 루틴 안에 겹치지 않는 편이 안전합니다."
    );
  }

  if (priorityAxis === "redness" || (sensitiveState && priorityAxis !== "barrier")) {
    pushWarning(
      locale === "en"
        ? "Do not use heat, strong rubbing, or harsh cleansing on days when redness is already climbing."
        : "붉은기가 올라오는 날에는 뜨거운 물, 강한 마찰, 강한 세안을 같이 쓰지 않는 편이 좋습니다."
    );
  }

  if (priorityAxis === "dehydration" || (dehydrationState && !sensitiveState)) {
    pushWarning(
      locale === "en"
        ? "Do not increase exfoliation or stripping steps when the skin is already drying out faster than it can hold water."
        : "건조가 올라오는 시기에는 각질 제거와 강한 세안을 같이 늘리지 않는 편이 좋습니다."
    );
  }

  if (priorityAxis === "oiliness") {
    pushWarning(
      locale === "en"
        ? "Do not answer shine by washing repeatedly or pushing the routine into a squeaky-clean finish."
        : "유분이 신경 쓰여도 세안을 반복하거나 뽀드득한 마무리로 몰아가지 않는 편이 좋습니다."
    );
  }

  if (priorityAxis === "acne") {
    pushWarning(
      locale === "en"
        ? "Do not stack multiple active treatments on the same night just because breakouts feel urgent."
        : "트러블이 올라와도 같은 날 여러 활성 제품을 한꺼번에 겹치지 않는 편이 좋습니다."
    );
  }

  if (priorityAxis === "pores" || priorityAxis === "uneven_tone") {
    pushWarning(
      locale === "en"
        ? "Do not turn pore or texture care into a daily high-frequency step before the skin proves it can hold the pace."
        : "모공·결 케어를 바로 매일 강하게 돌리기보다 피부 반응을 보면서 빈도를 나누는 편이 좋습니다."
    );
  }

  if (priorityAxis === "uv" || scoreCard.uv.total >= 16) {
    pushWarning(
      locale === "en"
        ? "Do not skip sunscreen or rely on heavier base layers when UV pressure is one of the main drivers here."
        : "자외선 비중이 높은 날에는 선케어를 빼거나 베이스를 두껍게 올리는 방식으로 대신하지 않는 편이 좋습니다."
    );
  }

  if (overCleansingRisk && priorityAxis !== "oiliness" && priorityAxis !== "redness" && priorityAxis !== "barrier") {
    pushWarning(
      locale === "en"
        ? "Do not solve every change in skin condition by cleansing harder or more often."
        : "피부 컨디션이 흔들릴수록 세안을 더 세게 하거나 더 자주 하는 쪽으로 몰지 않는 편이 좋습니다."
    );
  }

  if (productStackingRisk && priorityAxis !== "acne" && priorityAxis !== "pores" && priorityAxis !== "uneven_tone") {
    pushWarning(
      locale === "en"
        ? "Do not widen the routine by stacking too many correction products in the same night."
        : "보정 제품을 한날한시에 여러 개 겹쳐 루틴을 넓히지 않는 편이 좋습니다."
    );
  }

  return warnings.slice(0, 2);
}

function buildSummary(priorityAxis, topCategory, scoreCard, photoEvidence, surveyEvidence, locale = "ko") {
  const priorityLabel = getLabel(PRIORITY_LABELS, priorityAxis, locale);
  const categoryLabel = getLabel(CATEGORY_SLOT_LABELS, topCategory, locale);
  const surveyLead = surveyEvidence[0]?.detail || "";
  const photoLead = photoEvidence[0]?.detail || "";

  if (locale === "en") {
    return [
      `${priorityLabel} is leading the decision, so ${categoryLabel.toLowerCase()} moved to the front.`,
      photoLead || surveyLead || "Survey and photo evidence both pushed the same priority higher."
    ].join("\n");
  }

  return [
    `${priorityLabel} 축이 먼저 올라와 ${categoryLabel}를 맨 앞으로 세웠습니다.`,
    photoLead || surveyLead || "설문과 사진 근거가 같은 우선순위로 모였습니다."
  ].join("\n");
}

function buildAmFocus(priorityAxis, topCategory, scoreCard, locale = "ko") {
  const topCategoryLabel = getLabel(CATEGORY_SLOT_LABELS, topCategory, locale).toLowerCase();

  if (locale === "en") {
    if (priorityAxis === "uv") {
      return "Keep the morning routine protective: do a light cleanse, keep moisturizer thin, and leave enough room to wear sunscreen fully without drag.";
    }

    if (priorityAxis === "oiliness") {
      return "Use the morning routine to cut surface oil early, then keep hydration and sunscreen light so midday shine comes up later.";
    }

    if (priorityAxis === "pores") {
      return "Use the morning routine to keep shine controlled without roughening the surface, and save stronger texture correction for a few nights a week.";
    }

    if (priorityAxis === "dehydration") {
      return "Lower cleansing intensity in the morning and use a thin hydration layer so the skin does not feel empty again before noon.";
    }

    if (priorityAxis === "barrier") {
      return "Keep the morning routine minimal and barrier-safe, using fewer steps instead of adding extra corrective products before the skin settles.";
    }

    if (priorityAxis === "redness") {
      return "Keep the morning routine low-irritation and steady, and choose protection that does not add extra heat, friction, or sting.";
    }

    if (priorityAxis === "acne") {
      return "Keep the morning routine fresh and breathable, using lighter hydration so breakout-prone skin does not feel sealed in by midday.";
    }

    if (priorityAxis === "uneven_tone") {
      return "Protect tone balance first in the morning, and avoid making the base heavier just to force early correction.";
    }

    return `Keep the morning routine centered on ${topCategoryLabel} with less drag and more daytime stability.`;
  }

  if (priorityAxis === "uv") {
    return "아침에는 가볍게 세안한 뒤 보습을 얇게 두고, 선크림을 충분히 바르고도 밀리지 않게 만드는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "oiliness") {
    return "아침에는 표면 유분만 먼저 정리하고, 무겁게 덮기보다 산뜻한 보습과 선케어로 오후 번들거림을 늦추는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "pores") {
    return "아침에는 강한 결 케어를 넣기보다 가볍게 정돈하고, 번들 흐름이 늦게 올라오게 만드는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "dehydration") {
    return "아침에는 세안 강도를 낮추고, 가벼운 보습을 얇게 깔아 수분이 중간에 끊기지 않게 만드는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "barrier") {
    return "아침에는 기능성 단계를 늘리기보다, 장벽을 덜 흔드는 최소 단계 보호 흐름으로 가는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "redness") {
    return "아침에는 마찰과 열감을 줄이는 보호 흐름으로 가서, 낮 동안 붉은기가 더 올라오지 않게 하는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "acne") {
    return "아침에는 물세안 또는 약한 세안 후, 답답하지 않은 보습과 가벼운 마무리로 막히는 느낌을 줄이는 쪽이 핵심입니다.";
  }

  if (priorityAxis === "uneven_tone") {
    return "아침에는 톤 교정보다 보호를 먼저 두고, 베이스를 무겁게 쌓지 않으면서 피부가 지저분해 보이지 않게 가져가는 쪽이 핵심입니다.";
  }

  return `아침에는 ${topCategoryLabel} 중심으로 맞추되 레이어 부담은 늘리지 않는 쪽이 핵심입니다.`;
}

function buildPmFocus(priorityAxis, locale = "ko") {
  if (locale === "en") {
    if (priorityAxis === "uv" || priorityAxis === "dehydration") {
      return "Use the evening routine to recover what daytime exposure pulled out, then finish with steady hydration instead of forcing a heavier last step.";
    }

    if (priorityAxis === "oiliness") {
      return "Use the evening routine to reset residue and shine cleanly, but stop before the skin feels stripped or squeaky.";
    }

    if (priorityAxis === "barrier") {
      return "Use the evening routine to repair the barrier, keeping the finish simple and comfort-first instead of adding extra actives.";
    }

    if (priorityAxis === "redness") {
      return "Use the evening routine to calm reactivity and lower friction, and treat stronger correction as the step to skip first.";
    }

    if (priorityAxis === "acne") {
      return "Use the evening routine to treat breakout pressure in one lane, and avoid layering multiple irritating steps on the same night.";
    }

    if (priorityAxis === "pores" || priorityAxis === "uneven_tone") {
      return "Use the evening routine as the correction window for texture and tone, but start with only a few nights a week and finish with calming hydration.";
    }

    return "Use the evening routine to correct the main concern without stacking more steps than the skin can hold.";
  }

  if (priorityAxis === "uv" || priorityAxis === "dehydration") {
    return "저녁에는 낮 동안 빠진 수분과 편안함을 다시 채우되, 무겁게 덮기보다 회복 보습으로 안정적으로 마무리하는 편이 좋습니다.";
  }

  if (priorityAxis === "oiliness") {
    return "저녁에는 잔여감과 번들막을 정리하되, 뽀드득해질 때까지 벗겨내지 않는 리셋 흐름으로 가져가는 편이 좋습니다.";
  }

  if (priorityAxis === "barrier") {
    return "저녁에는 기능성 제품을 늘리기보다, 진정·보습 위주로 단순하게 마무리해서 다음 날까지 편안함이 남게 하는 게 좋습니다.";
  }

  if (priorityAxis === "redness") {
    return "저녁에는 강하게 리셋하기보다 마찰과 자극을 낮추고, 예민한 날일수록 진정 보습만 남기는 쪽으로 가져가는 게 좋습니다.";
  }

  if (priorityAxis === "acne") {
    return "저녁에는 트러블 케어를 한 축으로만 좁혀 쓰고, 같은 날 다른 자극 단계는 겹치지 않는 편이 좋습니다.";
  }

  if (priorityAxis === "pores" || priorityAxis === "uneven_tone") {
    return "저녁에는 패드·결 케어를 매일 쓰기보다 주 2~3회로 두고, 사용한 날에는 진정 보습으로 마무리하는 쪽이 좋습니다.";
  }

  return "저녁에는 메인 고민만 바로잡고 피부가 버거워할 만큼 단계를 늘리지 않는 쪽이 좋습니다.";
}

function buildDecisionProduct(product, answers, scoreCard, priorityAxis, targetSlot, locale = "ko") {
  const scored =
    getProductSlot(product) === "sunscreen"
      ? scoreSunscreenProduct(product, answers)
      : scoreCanonicalProduct(product, answers);
  const environmentAdjustment = getEnvironmentAdjustment(product, answers, scoreCard);
  const heroBoost = getHeroBoost(product, answers, scoreCard, targetSlot);
  const reviewSignal = computeReviewSignalScore(product.review_signals, answers, product);
  const ingredientSignal = computeIngredientSignalScore(product, answers, scoreCard);
  const marketConfidence = computeMarketConfidenceScore(product);
  const hardPenalty = getHardPenalty(product, answers, scoreCard);
  const finalScore = roundToTenth(
    scored.score +
      environmentAdjustment.total +
      heroBoost.total +
      reviewSignal.total +
      ingredientSignal.total +
      marketConfidence.total +
      hardPenalty.total
  );

  return {
    ...scored,
    score_breakdown: {
      ...(scored.score_breakdown || {}),
      baseScore: scored.score,
      environmentAdjustment: environmentAdjustment.total,
      heroBoost: heroBoost.total,
      reviewSignalScore: reviewSignal.total,
      ingredientSignalScore: ingredientSignal.total,
      marketConfidenceScore: marketConfidence.total,
      hardPenalty: hardPenalty.total,
      engineScore: finalScore,
      base_score: scored.score,
      environment_adjustment: environmentAdjustment.total,
      hero_boost: heroBoost.total,
      review_signal_score: reviewSignal.total,
      ingredient_signal_score: ingredientSignal.total,
      market_confidence_score: marketConfidence.total,
      hard_penalty: hardPenalty.total,
      engine_score: finalScore
    },
    step: getLabel(STEP_LABELS, getProductSlot(product), locale),
    reason: appendReviewEvidenceSentence(
      buildDefaultReason(product, answers, scoreCard, priorityAxis, hardPenalty.reasons, locale),
      product.review_signals,
      locale
    ),
    comparison_reason: "",
    decision_meta: {
      baseScore: scored.score,
      environmentAdjustment: environmentAdjustment.total,
      heroBoost: heroBoost.total,
      reviewSignalScore: reviewSignal.total,
      ingredientSignalScore: ingredientSignal.total,
      marketConfidenceScore: marketConfidence.total,
      hardPenalty: hardPenalty.total,
      engineScore: finalScore,
      base_score: scored.score,
      environment_adjustment: environmentAdjustment.total,
      hero_boost: heroBoost.total,
      review_signal_score: reviewSignal.total,
      ingredient_signal_score: ingredientSignal.total,
      market_confidence_score: marketConfidence.total,
      hard_penalty: hardPenalty.total,
      final_score: finalScore,
      slot: getProductSlot(product),
      environment_reasons: environmentAdjustment.reasons,
      hero_reasons: heroBoost.reasons,
      ingredient_signal_reasons: ingredientSignal.reasons,
      market_confidence_reasons: marketConfidence.reasons,
      penalty_reasons: hardPenalty.reasons
    },
    engine_score: finalScore
  };
}

function buildAltPicks(sortedProducts, topPick, targetSlot, priorityAxis, locale = "ko") {
  const picks = [];
  const usedIds = new Set(topPick ? [topPick.id] : []);
  const usedSlots = new Set();

  const sameSlotRunnerUp = sortedProducts.find(
    (product) => product.id !== topPick?.id && product.decision_meta?.slot === targetSlot
  );

  if (sameSlotRunnerUp) {
    usedIds.add(sameSlotRunnerUp.id);
    usedSlots.add(sameSlotRunnerUp.decision_meta.slot);
    picks.push(sameSlotRunnerUp);
  }

  for (const product of sortedProducts) {
    if (picks.length >= 5 || usedIds.has(product.id)) {
      continue;
    }

    if (usedSlots.has(product.decision_meta?.slot)) {
      continue;
    }

    usedIds.add(product.id);
    usedSlots.add(product.decision_meta?.slot);
    picks.push(product);
  }

  if (!picks.length && sortedProducts[1]) {
    picks.push(sortedProducts[1]);
  }

  const runnerById = new Map(
    sortedProducts.map((product, index) => {
      const runnerUp = sortedProducts[index + 1] || null;
      return [
        product.id,
        buildDefaultComparisonReason(product, runnerUp, priorityAxis, locale)
      ];
    })
  );

  return picks
    .filter(Boolean)
    .map((product) => ({
      ...product,
      comparison_reason: runnerById.get(product.id) || product.comparison_reason
    }));
}

function normalizePhotoEvidence(photoAnalysis) {
  return Array.isArray(photoAnalysis?.evidence)
    ? photoAnalysis.evidence
        .map((item) => formatEvidenceItem(item.axis, item.label, item.detail))
        .filter((item) => item.label || item.detail)
        .slice(0, 3)
    : [];
}

function buildRoutineStepsForMode(mode, { topPick, locale = "ko" } = {}) {
  const en = locale === "en";

  switch (mode) {
    case "protective":
      return [
        en ? "Keep the prep light so the daytime routine does not become harder to finish." : "앞단을 가볍게 정리해서 낮 루틴이 무거워지지 않게 합니다.",
        en ? "Do not layer moisturizer too heavily before sunscreen unless the skin already feels tight." : "이미 당김이 심한 날이 아니면 보습제를 무겁게 겹치지 않습니다.",
        en ? "Finish with a sunscreen you can actually wear in a full amount." : "충분한 양을 바를 수 있는 선크림으로 마무리합니다.",
        en ? "Reapply when outdoor exposure is long instead of trying to solve UV with thicker base layers." : "야외 노출이 길면 앞단을 두껍게 올리기보다 선케어를 덧바르는 쪽으로 대응합니다.",
        en ? "Avoid sticky or high-white-cast finishes when that makes reapplication less realistic." : "덧바르기 어려운 끈적임이나 강한 백탁은 피합니다."
      ];
    case "fresh_control":
      return [
        en ? "Start by removing only the oil you actually need to remove." : "필요한 유분만 먼저 정리하고 과하게 벗겨내지 않습니다.",
        en ? "Keep the middle layers thin so shine does not rebound faster by noon." : "중간 레이어를 얇게 두어 점심 전부터 번들거림이 튀지 않게 합니다.",
        en ? "Choose breathable hydration rather than trying to look matte through dryness." : "건조한 매트감보다 숨쉬는 보습 쪽으로 가져갑니다.",
        en ? "Keep sunscreen or makeup finish clean instead of adding extra slip underneath." : "선크림이나 메이크업 전에는 미끌거리는 보조층을 늘리지 않습니다.",
        en ? "If the skin still feels blocked, cut one layer before changing the whole routine." : "답답함이 남으면 제품을 바꾸기 전에 한 단계를 먼저 줄여 봅니다."
      ];
    case "hydration_hold":
      return [
        en ? "Connect hydration early so the skin does not empty out again before midday." : "초반 수분 연결을 먼저 잡아 점심 전부터 다시 비지 않게 합니다.",
        en ? "Layer in thinner passes instead of one heavy finish." : "한 번에 무겁게 마무리하기보다 얇게 나눠 올립니다.",
        en ? "Seal only enough to keep the skin comfortable through the day." : "낮 동안 편안함이 끊기지 않을 정도로만 마무리합니다.",
        en ? "If the skin starts feeling heavy, reduce the middle layer before changing the main product." : "답답함이 생기면 메인 제품을 바꾸기보다 중간 레이어를 먼저 줄입니다.",
        en ? "If the office air is dry, add comfort through reapplication or misting instead of stacking thicker morning cream." : "실내가 건조하면 아침 크림을 두껍게 올리기보다 중간 보충 쪽으로 대응합니다."
      ];
    case "low_irritation_protect":
      return [
        en ? "Keep the routine short and low-friction from the first step." : "첫 단계부터 마찰이 적고 짧은 흐름으로 가져갑니다.",
        en ? "Skip overlapping active or exfoliating steps in the same morning window." : "같은 아침 루틴 안에서 각질·활성 단계를 겹치지 않습니다.",
        en ? "Use protection that does not make the skin feel hotter or more occluded." : "열감이나 답답함을 키우지 않는 보호 단계로 마무리합니다.",
        en ? "Use less amount first, then add more only if the skin stays comfortable." : "처음부터 많이 바르지 말고, 편안하게 남을 때만 양을 조금 늘립니다.",
        en ? "When the skin looks reactive already, reduce quantity and number of layers before changing every product." : "이미 예민함이 올라온 날에는 제품 교체보다 양과 단계 수를 먼저 줄입니다."
      ];
    case "minimal_barrier":
      return [
        en ? "Reduce the routine to the least number of stable steps." : "안정적인 최소 단계만 남겨 장벽 부담을 줄입니다.",
        en ? "Do not add a correction step just because the skin looks uneven that morning." : "아침에 피부가 흔들려 보여도 보정 단계를 즉시 추가하지 않습니다.",
        en ? "Keep cleansing, hydration, and protection predictable." : "세안, 보습, 보호 단계를 예측 가능하게 고정합니다.",
        en ? "Keep the same simple order for several days before testing another role." : "다른 역할 제품을 시험하기 전에 며칠간 같은 단순 순서를 유지합니다.",
        en ? "If stinging starts, simplify first before searching for more performance." : "따가움이 시작되면 성능을 더 찾기보다 먼저 단순화합니다."
      ];
    case "recovery":
      return [
        en ? "Use the evening to put back comfort that daytime exposure pulled out." : "저녁에는 낮 동안 빠진 편안함을 다시 채우는 데 집중합니다.",
        en ? "Keep cleansing complete but not harsh." : "세안은 남김 없이 하되 거칠게 몰지 않습니다.",
        en ? "Choose hydration and barrier support before adding any extra correction step." : "추가 보정보다 수분과 장벽 회복을 먼저 둡니다.",
        en ? "If one support step already feels enough, stop there instead of adding a second hero step." : "보조 단계 하나로 충분히 편안하면 두 번째 핵심 제품을 더하지 않고 멈춥니다.",
        en ? "If the skin already feels calm, stop earlier instead of layering until it feels rich." : "이미 편안해졌다면 리치해질 때까지 쌓지 말고 먼저 멈춥니다."
      ];
    case "reset":
      return [
        en ? "Clean off sunscreen, makeup, and surface residue thoroughly on reset nights." : "리셋이 필요한 날은 선크림, 메이크업, 표면 잔여감을 먼저 정확히 지웁니다.",
        en ? "Do not confuse strong squeakiness with a better reset." : "뽀드득한 세정감을 리셋 성공으로 보지 않습니다.",
        en ? "Bring the routine back to a simple finish after cleansing." : "세안 뒤에는 다시 단순한 보습 마무리로 되돌립니다.",
        en ? "When the reset step is stronger, keep the following treatment quieter." : "리셋 단계가 강한 날에는 뒤쪽 케어를 더 조용하게 둡니다.",
        en ? "If the skin feels stripped, reduce cleansing intensity before changing the later steps." : "건조하게 벗겨지는 느낌이 들면 뒤 단계를 바꾸기보다 세정 강도부터 낮춥니다."
      ];
    case "acne_care":
      return [
        en ? "Treat breakout care as one narrow lane instead of stacking several active steps." : "트러블 케어는 여러 활성 단계를 겹치기보다 한 축으로 좁혀서 씁니다.",
        en ? "On active-care nights, avoid piling on scrubby or high-friction steps." : "케어를 하는 날에는 문지르는 단계나 마찰 큰 단계를 겹치지 않습니다.",
        en ? "If you use a pad or active serum, start from two to three nights a week, not every day." : "패드나 케어 세럼은 매일보다 주 2~3회부터 시작합니다.",
        en ? "Keep the final layer calming and breathable." : "마무리는 진정·보습 쪽으로 가볍게 가져갑니다.",
        en ? "On non-active nights, do not compensate by adding another correction product." : "케어하지 않는 날에는 다른 보정 제품으로 빈자리를 메우지 않습니다."
      ];
    case "pore_texture_care":
      return [
        en ? "Use the evening as the main texture-correction window, not the morning." : "모공·결 보정은 아침보다 저녁 창구로 쓰는 편이 낫습니다.",
        en ? "Start pore or texture care from two to three nights a week." : "모공·결 케어는 매일보다 주 2~3회부터 시작합니다.",
        en ? "Do not overlap multiple resurfacing steps on the same night." : "같은 날 여러 보정 단계를 겹치지 않습니다.",
        en ? "On pad nights, keep the rest of the routine shorter and calmer." : "패드를 쓴 날은 나머지 루틴을 더 짧고 차분하게 둡니다.",
        en ? "On off nights, keep only cleansing and recovery so the skin can reset." : "쉬는 날에는 세안과 회복만 남겨 피부가 다시 안정되게 둡니다."
      ];
    case "calming_repair":
      return [
        en ? "Lower friction first instead of trying to force a visible reset." : "눈에 띄는 리셋보다 마찰을 낮추는 것을 먼저 둡니다.",
        en ? "Keep the temperature, rubbing, and layering pressure down." : "온도, 문지름, 레이어 압박을 모두 낮춥니다.",
        en ? "Use one calming lane and stop there for that night." : "진정 축을 하나만 쓰고 그날은 거기서 멈춥니다.",
        en ? "If redness is already visible, treat exfoliation and brightening as optional skips." : "붉은기가 보이면 각질·미백 단계는 쉬어도 되는 선택지로 둡니다.",
        en ? "If the skin is already flushed, skip optional actives even if they usually work." : "이미 붉은기가 오른 날에는 평소 괜찮던 활성 단계도 쉬는 편이 좋습니다."
      ];
    case "barrier_repair":
      return [
        en ? "Keep the evening routine quiet and repetitive enough for the barrier to settle." : "장벽이 진정될 수 있게 저녁 루틴을 조용하고 반복 가능하게 둡니다.",
        en ? "Do not chase quick texture gains on a barrier-repair night." : "장벽 회복 밤에는 빠른 결 개선을 같이 노리지 않습니다.",
        en ? "Layer barrier support before any optional correction." : "선택 보정보다 장벽 보강을 먼저 둡니다.",
        en ? "Keep the finish comfortable, not richer than the skin can hold." : "마무리는 피부가 버틸 수 있는 편안함까지만 남깁니다.",
        en ? "If the skin starts stinging, shorten the routine before swapping everything." : "따가움이 돌면 전체 교체보다 단계 축소를 먼저 합니다."
      ];
    default:
      return [
        en ? "Keep the routine simple." : "루틴을 단순하게 유지합니다.",
        en ? "Correct one thing at a time." : "한 번에 한 축만 보정합니다.",
        en ? "Add a new role only after the current order feels stable." : "현재 순서가 안정된 뒤에만 새 역할 제품을 더합니다."
      ];
  }
}

function buildAlternativeReason(product, topPick, answers, scoreCard, priorityAxis, locale = "ko") {
  if (!product) {
    return "";
  }

  const productSlot = getProductSlot(product);
  const topPickSlot = getProductSlot(topPick);
  const sameSlot = productSlot && topPickSlot && productSlot === topPickSlot;
  const sensitiveState =
    answers?.sensitivity === "high" ||
    Boolean(answers?.verySensitivePeriod) ||
    getConcernTotal(scoreCard, "barrier") >= 18 ||
    getConcernTotal(scoreCard, "redness") >= 18;
  const highOil =
    answers?.skinType === "oily" ||
    answers?.afternoonSkinChange === "more_oily" ||
    getConcernTotal(scoreCard, "oiliness") >= 18;
  const dryState =
    answers?.skinType === "dry" ||
    answers?.postWashFeeling === "tight" ||
    getConcernTotal(scoreCard, "dehydration") >= 18;

  if (locale === "en") {
    if (sameSlot) {
      return `This works as an alternative for the same concern, but it leans a little more toward a different feel than the Top Pick. It is easier to split in on sensitive days, lighter-routine days, or as a swap instead of using the main product every time.`;
    }

    return `This is an alternative because it handles the same priority from a different step than the Top Pick. Use it when you want a lighter reset, a calmer day, or a replacement lane instead of stacking both roles together.`;
  }

  switch (productSlot) {
    case "serum":
      return sameSlot
        ? "이 제품은 같은 고민을 보되 Top Pick보다 진정 쪽이나 사용감 차이로 나누기 좋은 대안입니다. 메인 세럼 대신 교체하거나 예민한 날에만 소량으로 두는 방식으로 나누는 것도 좋습니다."
        : "이 제품은 메인 제품과 다른 단계에서 같은 고민을 받쳐 주는 대안입니다. 진정이나 수분 보조가 더 필요한 날에만 토너 다음에 소량으로 두고, 다른 활성 단계는 겹치지 않는 편이 좋습니다.";
    case "toner_essence":
      return sameSlot
        ? "이 제품은 같은 모공·결 축을 보되 Top Pick보다 더 가볍게 시작하거나 빈도를 나누기 좋은 대안입니다. 매일 강하게 쓰기보다 주 2~3회만 쓰거나 예민한 날에는 쉬는 방식으로 가져가도 좋습니다."
        : "이 제품은 메인 제품보다 앞단에서 표면을 정리하는 쪽에 가까운 대안입니다. 루틴을 가볍게 가져가고 싶은 날이나 결 케어를 따로 나눠 보고 싶은 날에만 얇게 쓰는 방식이 좋습니다.";
    case "moisturizer":
      return sameSlot
        ? "이 제품은 같은 보습 축을 보지만 Top Pick보다 마무리감이나 부담을 다르게 가져가고 싶을 때 쓰기 좋은 대안입니다. 아침에는 소량만 두고, 저녁에는 회복용 보습으로 교체해 보는 식으로 나눌 수 있습니다."
        : "이 제품은 메인 제품보다 회복과 보습 유지 쪽에 가까운 대안입니다. 피부가 쉽게 당기거나 예민한 날에는 기능성 단계를 줄이고 이 단계로 마무리하는 방식이 더 잘 맞을 수 있습니다.";
    case "cleanser":
      return sameSlot
        ? "이 제품은 같은 세안 역할을 보되 Top Pick보다 세정감이나 부담 차이로 나누기 좋은 대안입니다. 선크림을 진하게 쓴 날에만 교체하거나, 예민한 날에는 문지르는 시간을 줄여 쓰는 방식이 좋습니다."
        : "이 제품은 메인 제품보다 세안 부담을 조절하는 쪽에 가까운 대안입니다. 유분이나 잔여감이 특히 신경 쓰이는 날 저녁에만 교체해서 쓰고, 다른 날에는 루틴을 더 단순하게 두는 편이 좋습니다.";
    case "sunscreen":
      return sameSlot
        ? "이 제품은 같은 선케어 축을 보되 Top Pick보다 마무리감이나 덧바름 편의성으로 나누기 좋은 대안입니다. 야외 일정이 길거나 메이크업 전 밀림이 걱정되는 날에만 바꿔 쓰는 식으로 나눌 수 있습니다."
        : "이 제품은 메인 제품과 다른 단계 대신 낮 보호를 더 가볍게 가져가고 싶을 때 보는 대안입니다. 외출 위주인 날에만 마지막 단계로 교체하고, 답답하면 앞단 보습을 한 단계 줄이는 방식이 좋습니다.";
    default:
      if (sensitiveState) {
        return "이 제품은 Top Pick보다 자극 부담을 나눠 보기 위한 대안에 가깝습니다. 예민한 날이나 루틴을 짧게 가져가야 하는 날에만 교체해서 반응을 보는 방식이 좋습니다.";
      }

      if (highOil) {
        return "이 제품은 Top Pick보다 더 가볍게 루틴을 가져가고 싶을 때 보는 대안입니다. 번들거림이 빨리 올라오는 날에만 교체해서 쓰거나, 단계 수를 줄이는 방향으로 같이 조절하는 편이 좋습니다.";
      }

      if (dryState) {
        return "이 제품은 Top Pick보다 회복이나 보습 유지 쪽으로 기울어진 대안입니다. 당김이 심한 날이나 저녁 루틴을 단순하게 끝내고 싶은 날에만 대신 쓰는 방식이 좋습니다.";
      }

      return "이 제품은 같은 우선 고민을 다른 결로 풀어 보는 대안입니다. 매일 같이 쓰기보다 루틴을 더 가볍게 하거나 특정 컨디션의 날에만 교체해서 보는 방식이 좋습니다.";
  }
}

function buildRoutineVariants(answers, routineStructure, locale = "ko") {
  const variants = [];
  const add = (key, label, items) => {
    const cleaned = items.filter(Boolean).slice(0, 3);
    if (cleaned.length) {
      variants.push({ key, label, items: cleaned });
    }
  };

  add(
    "outdoor_day",
    locale === "en" ? "Outdoor day" : "야외 노출이 긴 날",
    [
      locale === "en" ? "When you will be outside for more than a short commute, treat sunscreen reapplication as part of the routine." : "짧은 이동보다 야외 시간이 긴 날에는 선크림 덧바름까지 루틴에 포함해 둡니다.",
      locale === "en" ? "Change the routine by reducing one prep layer so sunscreen can be worn and reapplied in a full amount." : "앞단 보습이나 보조층을 하나 줄여 선크림을 충분한 양으로 바르고 덧바를 수 있게 바꿉니다.",
      locale === "en" ? "Do not make the morning base heavier to compensate for UV exposure." : "자외선 노출을 보완하겠다고 아침 베이스를 더 두껍게 만들지 않습니다."
    ]
  );

  add(
    "sensitive_day",
    locale === "en" ? "Sensitive day" : "예민한 날",
    [
      locale === "en" ? "When the skin stings, flushes, or feels unusually hot, treat that day as a sensitive day." : "따가움, 붉어짐, 열감이 평소보다 올라오면 그날은 예민한 날로 봅니다.",
      locale === "en" ? "Change the routine by cutting optional actives first, then lowering the amount of each layer." : "선택 기능성 단계를 먼저 빼고, 남기는 제품도 양을 줄이는 방식으로 바꿉니다.",
      locale === "en" ? "Do not test a new pad, serum, or strong cleanser on that day." : "그날은 새 패드, 새 세럼, 강한 세안제를 시험하지 않습니다."
    ]
  );

  add(
    "breakout_day",
    locale === "en" ? "Breakout day" : "트러블이 올라온 날",
    [
      locale === "en" ? "When new bumps appear or a spot feels irritated, avoid treating the whole face like it needs stronger correction." : "새 트러블이 올라오거나 부위가 자극돼 있으면 얼굴 전체를 강하게 보정할 필요는 없습니다.",
      locale === "en" ? "Change the routine by keeping only one breakout-care lane and making the final layer light." : "트러블 케어는 한 축만 남기고, 마무리는 답답하지 않은 진정·보습으로 바꿉니다.",
      locale === "en" ? "Do not stack exfoliation, spot care, and a strong active serum on the same night." : "각질 케어, 스팟 케어, 강한 기능성 세럼을 같은 밤에 겹치지 않습니다."
    ]
  );

  add(
    "makeup_day",
    locale === "en" ? "Makeup day" : "메이크업 하는 날",
    [
      locale === "en" ? "When base makeup pills, separates, or looks heavy fast, treat the skincare underneath as the first thing to adjust." : "베이스가 밀리거나 빨리 두꺼워 보이면 메이크업보다 아래 스킨케어를 먼저 조정합니다.",
      locale === "en" ? "Change the routine by cutting one slippery layer and letting sunscreen settle before base makeup." : "미끌거리는 보조층을 하나 줄이고 선크림이 자리 잡은 뒤 베이스를 올리는 방식으로 바꿉니다.",
      locale === "en" ? "Do not add extra glow or correction skincare just because the base looks empty at first." : "처음에 베이스가 허전해 보여도 광이나 보정용 스킨케어를 즉시 더하지 않습니다."
    ]
  );

  return variants.slice(0, 4);
}

function unwrapRoutineProduct(item) {
  return item?.product || item || null;
}

function buildRoutineProductPool(topPick, supportingProducts = [], scoredProducts = []) {
  const seen = new Set();
  return [topPick, ...supportingProducts.map(unwrapRoutineProduct), ...scoredProducts]
    .filter((product) => product?.id)
    .filter((product) => {
      if (seen.has(product.id)) {
        return false;
      }

      seen.add(product.id);
      return true;
    });
}

function pickRoutineProduct(slots = [], { topPick, pool = [], usedIds = new Set() } = {}) {
  const normalizedSlots = slots.map((slot) => getProductSlot(slot) || slot);
  const topPickSlot = getProductSlot(topPick);

  if (topPick?.id && !usedIds.has(topPick.id) && normalizedSlots.includes(topPickSlot)) {
    usedIds.add(topPick.id);
    return topPick;
  }

  const product = pool.find((item) => {
    if (!item?.id || usedIds.has(item.id)) {
      return false;
    }

    return normalizedSlots.includes(getProductSlot(item));
  });

  if (product?.id) {
    usedIds.add(product.id);
  }

  return product || null;
}

function getRoutineStepDefinitionText(key, locale = "ko") {
  const en = locale === "en";
  const copy = {
    morning_cleanse: {
      stepName: en ? "Light cleanse" : "가벼운 세안",
      instruction: en
        ? "Clear only the oil and residue that built up overnight."
        : "밤사이 올라온 유분과 잔여감만 가볍게 정리합니다.",
      frequency: en ? "Every morning" : "매일 아침",
      caution: en
        ? "If tightness appears, lower the cleansing strength first."
        : "당김이 있으면 세안 강도부터 낮추세요."
    },
    morning_hydration: {
      stepName: en ? "Hydration support" : "수분 보완",
      instruction: en
        ? "Add a thin layer only where the skin feels empty or tight."
        : "건조감이 있으면 얇게 깔아 수분을 먼저 보완합니다.",
      frequency: en ? "As needed" : "필요 시",
      caution: en
        ? "Do not stack several slippery layers before sunscreen."
        : "선크림 전 미끌거리는 층을 여러 겹 쌓지 마세요."
    },
    morning_suncare: {
      stepName: en ? "Sun care" : "선케어",
      instruction: en
        ? "Finish with sunscreen in an amount you can wear comfortably."
        : "부담 없이 충분히 바를 수 있는 선크림으로 마무리합니다.",
      frequency: en ? "Every morning" : "매일 아침",
      caution: en
        ? "On outdoor-heavy days, plan to reapply instead of making the base heavier."
        : "야외 활동이 길면 베이스를 두껍게 하기보다 덧바름을 고려하세요."
    },
    night_cleanse: {
      stepName: en ? "Cleanse" : "세안",
      instruction: en
        ? "Remove sunscreen, sebum, and residue without stripping the skin."
        : "선크림과 피지, 잔여감을 남김 없이 부드럽게 정리합니다.",
      frequency: en ? "Every night" : "매일 저녁",
      caution: en
        ? "Avoid chasing a squeaky-clean finish."
        : "뽀득하게 벗겨내는 세안은 피하세요."
    },
    night_treatment: {
      stepName: en ? "Texture or concern care" : "모공·결 케어",
      instruction: en
        ? "Use the focused care step on selected nights, not as a heavy daily stack."
        : "패드나 고민 케어는 매일보다 필요한 날 위주로 시작합니다.",
      frequency: en ? "2-3 nights a week" : "주 2~3회",
      caution: en
        ? "Skip it when the skin feels reactive."
        : "예민한 날은 쉬세요."
    },
    night_finish: {
      stepName: en ? "Calming finish" : "진정·보습 마무리",
      instruction: en
        ? "Finish simply so the skin can stay calm after the active step."
        : "케어를 한 날에는 진정과 보습으로 단순하게 마무리합니다.",
      frequency: en ? "Every night" : "매일 저녁",
      caution: en
        ? "Do not overlap another irritating product in the same night."
        : "같은 밤 다른 자극 제품을 겹치지 마세요."
    }
  };

  return copy[key] || copy.morning_hydration;
}

function buildRoutineStep(order, definition, context) {
  const product = pickRoutineProduct(definition.slots, context);
  const copy = getRoutineStepDefinitionText(definition.key, context.locale);
  const productRole = product ? getProductSlot(product) : definition.slots[0];

  return {
    order,
    stepName: copy.stepName,
    productRole,
    product: product || null,
    instruction: copy.instruction,
    frequency: copy.frequency,
    caution: copy.caution
  };
}

function buildFullRoutineSteps({
  topPick,
  supportingProducts = [],
  scoredProducts = [],
  locale = "ko"
} = {}) {
  const pool = buildRoutineProductPool(topPick, supportingProducts, scoredProducts);
  const morningContext = {
    topPick,
    pool,
    usedIds: new Set(),
    locale
  };
  const nightContext = {
    topPick,
    pool,
    usedIds: new Set(),
    locale
  };
  const morningDefinitions = [
    { key: "morning_cleanse", slots: ["cleanser"] },
    { key: "morning_hydration", slots: ["moisturizer", "serum", "toner_essence"] },
    { key: "morning_suncare", slots: ["sunscreen"] }
  ];
  const nightDefinitions = [
    { key: "night_cleanse", slots: ["cleanser"] },
    { key: "night_treatment", slots: ["toner_essence", "serum"] },
    { key: "night_finish", slots: ["moisturizer", "serum"] }
  ];

  return {
    morningSteps: morningDefinitions.map((definition, index) =>
      buildRoutineStep(index + 1, definition, morningContext)
    ),
    nightSteps: nightDefinitions.map((definition, index) =>
      buildRoutineStep(index + 1, definition, nightContext)
    )
  };
}

function buildPremiumRoutine(topPick, supportingProducts, routineStructure, locale = "ko", answers = {}, options = {}) {
  const morningMode = routineStructure?.am?.mode || "hydration_hold";
  const nightMode = routineStructure?.pm?.mode || "recovery";
  const fullRoutineSteps = buildFullRoutineSteps({
    topPick,
    supportingProducts,
    scoredProducts: options.scoredProducts || [],
    locale
  });

  return {
    morning: buildRoutineStepsForMode(morningMode, { topPick, supportingProducts, locale }).slice(0, 5),
    night: buildRoutineStepsForMode(nightMode, { topPick, supportingProducts, locale }).slice(0, 5),
    morningSteps: fullRoutineSteps.morningSteps,
    nightSteps: fullRoutineSteps.nightSteps,
    variants: buildRoutineVariants(answers, routineStructure, locale)
  };
}

function buildAvoidCombinations(answers, warnings, locale = "ko") {
  const items = [];
  const add = (item) => {
    if (item && !items.includes(item)) {
      items.push(item);
    }
  };

  if (answers.sensitivity === "high") {
    add(
      locale === "en"
        ? "Do not stack a harsh cleanser and a friction-heavy pad in the same short routine window."
        : "강한 클렌저와 마찰이 큰 패드를 같은 짧은 루틴 안에 겹치지 않는 편이 좋습니다."
    );
  }

  if (answers.postWashFeeling === "tight") {
    add(
      locale === "en"
        ? "Do not pair a drying cleanse with a matte finish when tightness is already visible."
        : "이미 당김이 보일 때는 건조한 세정감과 매트한 마무리를 같은 흐름으로 묶지 않는 편이 좋습니다."
    );
  }

  if (answers.afternoonSkinChange === "more_oily" || answers.skinType === "oily") {
    add(
      locale === "en"
        ? "Do not combine repeated cleansing, a stripping toner, and a matte finish just to control shine."
        : "번들거림을 잡겠다고 세안 반복, 벗겨내는 토너, 매트한 마무리를 한 번에 묶지 않는 편이 좋습니다."
    );
  }

  if (answers.makeupUse) {
    add(
      locale === "en"
        ? "Do not layer a slippery serum, rich moisturizer, sunscreen, and base makeup without giving the layers time to settle."
        : "미끌거리는 세럼, 리치한 보습제, 선크림, 베이스 메이크업을 쉬는 시간 없이 바로 겹치지 않는 편이 좋습니다."
    );
  }

  if (answers.outdoorExposure) {
    add(
      locale === "en"
        ? "Do not replace sunscreen reapplication with a thicker morning moisturizer or heavier base makeup."
        : "선크림 덧바름을 두꺼운 아침 보습이나 무거운 베이스 메이크업으로 대신하지 않는 편이 좋습니다."
    );
  }

  add(
    locale === "en"
      ? "Do not use an exfoliating pad, active serum, and strong spot treatment on the same night."
      : "각질 패드, 기능성 세럼, 강한 스팟 케어를 같은 밤에 한꺼번에 겹치지 않는 편이 좋습니다."
  );

  add(
    locale === "en"
      ? "Do not test a new cleanser and a new leave-on treatment in the same routine."
      : "새 클렌저와 새로 바르는 케어 제품을 같은 루틴에서 동시에 시험하지 않는 편이 좋습니다."
  );

  warnings.forEach(add);

  return items.filter(Boolean).slice(0, 3);
}

function buildBudgetAlternatives(scoredProducts, topPick, locale = "ko") {
  const topPriceMin = Number(topPick?.price_min || 0) || Number.MAX_SAFE_INTEGER;
  const topSlot = topPick?.decision_meta?.slot;

  return scoredProducts
    .filter((product) => product.id !== topPick?.id)
    .filter((product) => product.decision_meta?.slot === topSlot)
    .map((product) => {
      const priceMin = Number(product.price_min || 0) || 0;
      const isCheaper = topPriceMin !== Number.MAX_SAFE_INTEGER && priceMin > 0 && priceMin < topPriceMin;
      return {
        product,
        isCheaper
      };
    })
    .sort((left, right) => {
      if (left.isCheaper !== right.isCheaper) {
        return left.isCheaper ? -1 : 1;
      }

      return Number(right.product.engine_score || right.product.score || 0) - Number(left.product.engine_score || left.product.score || 0);
    })
    .slice(0, 3)
      .map(({ product, isCheaper }) => ({
        id: product.id,
        name: product.name,
        brand: product.brand,
        category: product.category || "",
        step: product.step,
        texture: product.texture || "",
        finish: product.finish || "",
        use_time: product.use_time || "",
        price_range: product.price_range || "",
        price_min: product.price_min || null,
        price_max: product.price_max || null,
        buy_link: product.buy_link || "",
        image_url: product.image_url || "",
        summary:
          locale === "en"
            ? isCheaper
            ? `${product.step} keeps the same role with a lighter price burden; switch when you want the same routine lane without paying for the Top Pick every time.`
            : `${product.step} stays in the same role as the Top Pick; switch when the Top Pick feel or finish is not matching that day.`
          : isCheaper
            ? `${product.step} 역할은 유지하면서 가격 부담을 덜어낸 선택지입니다. Top Pick을 매번 쓰기 부담스러운 날 같은 루틴 축으로 바꿔 쓰기 좋습니다.`
            : `${product.step} 역할은 Top Pick과 같은 축에 두는 대안입니다. 그날 사용감이나 마무리가 Top Pick과 맞지 않을 때 교체해서 보기 좋습니다.`
    }));
}

async function buildCanonicalCandidatePolicyContexts({
  answers,
  scoreCard,
  priority,
  currentProductsReport,
  locale
}) {
  const [
    premiumDecisionModule,
    surveyContractModule,
    candidateSafetyModule,
    candidateGoalModule,
    legacyGoalPolicyModule
  ] =
    await Promise.all([
      import("@/lib/premium-decision-state"),
      import("@/lib/survey-input-contract"),
      import("@/lib/candidate-policy-runtime-safety"),
      import("@/lib/candidate-policy-goal-context"),
      import("@/lib/functional-goal-policy")
    ]);
  const canonicalReport = {
    freeResult: {
      priority: {
        axis: priority.axis,
        score: priority.score
      },
      scoring: {
        concernScores: scoreCard
      },
      answers
    },
    currentProducts: currentProductsReport
  };
  const canonicalDecisionState = premiumDecisionModule.buildPremiumDecisionState(
    canonicalReport,
    {
      locale,
      source: "skin_match_candidate_policy_canonical_context"
    }
  );
  const sharedContext = canonicalDecisionState.decisionBundle.context;
  const surveyContract = surveyContractModule.buildSurveyInputContract(answers, {
    source: "skin_match_candidate_policy_goal_context"
  });
  const candidateSafetyContext =
    candidateSafetyModule.buildCandidatePolicyRuntimeSafetyContext({
      sharedContext,
      functionalPolicy: canonicalDecisionState.rawPolicies.functional,
      effectivePolicySource: "raw"
    });
  const candidateGoalContext =
    candidateGoalModule.buildCandidatePolicyGoalContext({
      surveyContract,
      sharedContext,
      functionalPolicy: canonicalDecisionState.functionalPolicy,
      effectivePolicySource: canonicalDecisionState.effectivePolicySource
    });
  const legacyGoalPolicy =
    legacyGoalPolicyModule.resolveFunctionalGoalPolicy({
      surveyContract,
      freeResultPriority: { axis: priority.axis },
      safety: surveyContract.safety
    });
  const goalResolution = candidateGoalModule.resolveCandidatePolicyGoalPolicy({
    candidateGoalContext,
    candidateSafetyContext,
    legacyGoalPolicy
  });
  if (!goalResolution.valid) {
    throw new Error(`Candidate goal context unavailable: ${goalResolution.stopReason}`);
  }
  return {
    surveyContract,
    goalPolicy: goalResolution.goalPolicy,
    candidateGoalContext,
    candidateSafetyContext
  };
}

export async function buildSkinMatchDecisionBundle(input, options = {}) {
  const locale = getLocale(options.locale);
  const products = Array.isArray(options.products) && options.products.length
    ? options.products
    : await getRecommendationProducts();
  const currentProductsReport = buildCurrentProductsReport(options.currentProducts || [], {
    productSnapshots: options.currentProductSnapshots || [],
    locale
  });
  const answers = normalizeRecommendationAnswers(input);
  const scoreCard = createScoreCard();
  const photoAnalysis = options.photoAnalysis || { signals: {}, evidence: [] };

  applySurveyWeights(scoreCard, answers);
  applyEnvironmentWeights(scoreCard, answers);
  applyPhotoWeights(scoreCard, photoAnalysis);

  const priority = getPriority(scoreCard, answers);
  const targetSlot = getTopCategorySlot(priority.axis, answers, scoreCard);
  const photoEvidence = normalizePhotoEvidence(photoAnalysis);
  const photoObservations = photoAnalysis?.photoObservations || null;
  const surveyEvidence = buildSurveyEvidence(answers, scoreCard, locale);

  const eligibleProducts = products.filter((product) =>
    isProductEligibleForGenderPreference(product, answers)
  );

  const scoredProducts = eligibleProducts
    .filter((product) => product?.id && product?.name && product?.brand)
    .map((product) => buildDecisionProduct(product, answers, scoreCard, priority.axis, targetSlot, locale))
    .sort((left, right) => {
      if (right.engine_score !== left.engine_score) {
        return right.engine_score - left.engine_score;
      }

      return right.score - left.score;
    });

  let candidatePolicyContextsPromise = null;
  const resolveCandidatePolicyContexts = () => {
    if (!candidatePolicyContextsPromise) {
      candidatePolicyContextsPromise = buildCanonicalCandidatePolicyContexts({
        answers,
        scoreCard,
        priority,
        currentProductsReport,
        locale
      });
    }
    return candidatePolicyContextsPromise;
  };
  let exposureProducts = scoredProducts;
  let evaluatorBoundaryPolicyRuntime = null;
  if (evaluatorBoundaryPolicyRuntimeRequested()) {
    let observabilityModule = null;
    try {
      observabilityModule = await import("@/lib/evaluator-boundary-policy-runtime-observability");
    } catch {
      observabilityModule = null;
    }
    const runtimeControl = observabilityModule?.resolveEvaluatorBoundaryPolicyRuntimeControl(process.env) || {
      runtimeEnabled: false,
      disableRequested: process.env.DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1",
      canaryScope: "unknown"
    };

    if (runtimeControl.runtimeEnabled) {
      const runtimeStartedAt = Date.now();
      let runtimeError = false;
      try {
        const [
          policyRuntimeModule,
          candidatePolicyContexts
        ] = await Promise.all([
          import("@/lib/evaluator-boundary-policy-runtime"),
          resolveCandidatePolicyContexts()
        ]);
        evaluatorBoundaryPolicyRuntime = policyRuntimeModule.buildEvaluatorBoundaryPolicyRuntime({
          products: scoredProducts,
          surveyContract: candidatePolicyContexts.surveyContract,
          goalPolicy: candidatePolicyContexts.goalPolicy,
          candidateGoalContext: candidatePolicyContexts.candidateGoalContext,
          candidateSafetyContext: candidatePolicyContexts.candidateSafetyContext
        });
        const visibleCandidateIds = new Set(evaluatorBoundaryPolicyRuntime.visibleCandidateIds);
        exposureProducts = scoredProducts.filter((product) => visibleCandidateIds.has(String(product.id)));
      } catch (error) {
        runtimeError = true;
        throw error;
      } finally {
        const telemetry = observabilityModule?.buildEvaluatorBoundaryPolicyRuntimeTelemetry({
          control: runtimeControl,
          runtimeResult: evaluatorBoundaryPolicyRuntime,
          runtimeError,
          latencyMs: Date.now() - runtimeStartedAt
        });
        if (telemetry) observabilityModule.emitEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry);
      }
    } else if (observabilityModule) {
      const telemetry = observabilityModule.buildEvaluatorBoundaryPolicyRuntimeTelemetry({
        control: runtimeControl
      });
      observabilityModule.emitEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry);
    }
  }

  const topPick =
    exposureProducts.find((product) => product.decision_meta?.slot === targetSlot) ||
    exposureProducts[0] ||
    null;
  const allAltPicks = buildAltPicks(exposureProducts, topPick, targetSlot, priority.axis, locale);
  const topPickRunnerUp = allAltPicks[0] || exposureProducts.find((product) => product.id !== topPick?.id) || null;
  const resolvedTopPick = topPick
    ? {
        ...topPick,
        reason: buildEvidenceGroundedReason(
          topPick,
          answers,
          scoreCard,
          priority.axis,
          topPick?.decision_meta?.penalty_reasons || [],
          photoEvidence,
          surveyEvidence,
          locale
        ),
        comparison_reason: buildDefaultComparisonReason(topPick, topPickRunnerUp, priority.axis, locale)
      }
    : null;
  const resolvedAltPicks = allAltPicks.map((product) => ({
    ...product,
    reason: buildAlternativeReason(product, resolvedTopPick, answers, scoreCard, priority.axis, locale)
  }));
  const freeAltPick = resolvedAltPicks[0] || null;
  const supportingProductCandidates = resolvedAltPicks.slice(0, 5);
  const supportingConcerns = buildSupportingConcerns(scoreCard, answers, priority.axis);
  const roleBasedSupportingProducts = buildRoleBasedSupportingProducts({
    scoredProducts: exposureProducts,
    supportingCandidates: supportingProductCandidates,
    topPick: resolvedTopPick,
    targetSlot,
    priorityAxis: priority.axis,
    supportingConcerns,
    locale
  });
  const allWarnings = buildWarnings(answers, scoreCard, priority.axis, locale);
  const warnings = allWarnings.slice(0, 1);
  const summary = buildSummary(priority.axis, targetSlot, scoreCard, photoEvidence, surveyEvidence, locale);
  const amFocus = buildAmFocus(priority.axis, targetSlot, scoreCard, locale);
  const pmFocus = buildPmFocus(priority.axis, locale);
  const routineStructure = buildRoutineStructure(priority.axis, targetSlot, scoreCard, amFocus, pmFocus, locale);
  const publicRoutine = buildPublicRoutineLists(routineStructure);
  const premiumRoutine = buildPremiumRoutine(
    resolvedTopPick,
    roleBasedSupportingProducts.map((item) => item.product).filter(Boolean),
    routineStructure,
    locale,
    answers,
    {
      scoredProducts: exposureProducts,
      targetSlot,
      priorityAxis: priority.axis,
      supportingConcerns
    }
  );
  const currentProductVerdicts = buildCurrentProductVerdicts(currentProductsReport, {
    locale,
    answers,
    priorityAxis: priority.axis,
    routineStructure
  });
  const functionalDecisions = buildPremiumFunctionalDecisions({
    locale,
    answers,
    priority,
    priorityAxis: priority.axis,
    scoreCard,
    routineStructure,
    currentProductVerdicts
  });
  const conditionResponses = buildPremiumConditionResponses({
    locale,
    answers,
    priority,
    priorityAxis: priority.axis,
    scoreCard,
    routineStructure,
    currentProductVerdicts,
    functionalDecisions
  });
  const premiumReport = {
    topPickDetailedReason: buildPremiumTopPickReason(
      resolvedTopPick,
      answers,
      scoreCard,
      priority.axis,
      allWarnings,
      photoEvidence,
      surveyEvidence,
      locale
    ),
    supportingConcerns,
    supportingProducts: roleBasedSupportingProducts,
    routineStructure,
    photoObservations,
    fullRoutine: premiumRoutine,
    currentProducts: currentProductsReport,
    currentProductVerdicts,
    functionalDecisions,
    conditionResponses,
    avoidCombinations: buildAvoidCombinations(answers, allWarnings, locale),
    budgetAlternatives: buildBudgetAlternatives(exposureProducts, resolvedTopPick, locale)
  };
  let evaluatorBoundaryPolicyShadow = null;
  if (options.includeEvaluatorBoundaryPolicyShadow) {
    const [
      policyShadowModule,
      candidatePolicyContexts
    ] = await Promise.all([
      import("@/lib/evaluator-boundary-policy-shadow"),
      resolveCandidatePolicyContexts()
    ]);
    evaluatorBoundaryPolicyShadow = policyShadowModule.buildEvaluatorBoundaryPolicyShadow({
      products: scoredProducts,
      surveyContract: candidatePolicyContexts.surveyContract,
      goalPolicy: candidatePolicyContexts.goalPolicy,
      candidateGoalContext: candidatePolicyContexts.candidateGoalContext,
      candidateSafetyContext: candidatePolicyContexts.candidateSafetyContext
    });
  }
  const candidateSourceDiagnostics = options.includeCandidateSourceDiagnostics || evaluatorBoundaryPolicyShadow || evaluatorBoundaryPolicyRuntime
    ? {
        candidateSource: buildExistingRecommendationCandidateSource({
          products: scoredProducts,
          sourceStage: "post_score_candidate_pool",
          sourceNotes: [
            "existing_scored_products_reused",
            "gender_and_required_product_fields_filter_applied_before_capture"
          ],
          completeness: "complete",
          candidateIdentityMode: "product_row"
        }),
        ...(evaluatorBoundaryPolicyShadow ? { evaluatorBoundaryPolicyShadow } : {}),
        ...(evaluatorBoundaryPolicyRuntime ? { evaluatorBoundaryPolicyRuntime } : {})
      }
    : null;

  return {
    summary,
    priority: {
      axis: priority.axis,
      label: getLabel(PRIORITY_LABELS, priority.axis, locale),
      score: priority.score,
      topCategory: targetSlot,
      topCategoryLabel: getLabel(CATEGORY_SLOT_LABELS, targetSlot, locale)
    },
    topPick: resolvedTopPick,
    altPicks: freeAltPick ? [freeAltPick] : [],
    amFocus,
    pmFocus,
    routineStructure,
    warnings,
    photoEvidence,
    photoObservations,
    surveyEvidence,
    alternative: freeAltPick,
    categoryPicks: freeAltPick ? [freeAltPick] : [],
    products: [resolvedTopPick, freeAltPick].filter(Boolean),
    supportingConcerns,
    explanationProducts: [resolvedTopPick, ...supportingProductCandidates].filter(Boolean),
    premiumReport,
    morning: publicRoutine.morning,
    night: publicRoutine.night,
    avoid: warnings,
    scoring: {
      version: "skin-match-v2",
      deterministic: true,
      concernScores: Object.fromEntries(
        CONCERN_AXES.map((axis) => [
          axis,
          {
            total: scoreCard[axis].total,
            survey: scoreCard[axis].survey,
            photo: scoreCard[axis].photo,
            environment: scoreCard[axis].environment
          }
        ])
      )
    },
    ...(candidateSourceDiagnostics ? { diagnostics: candidateSourceDiagnostics } : {})
  };
}
