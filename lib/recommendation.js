import { PRODUCT_DB } from "@/lib/product-db";

const CATEGORY_ORDER = [
  "cleanser",
  "toner_essence",
  "serum",
  "moisturizer",
  "sunscreen"
];

const CATEGORY_LABELS = {
  cleanser: "Cleanser",
  toner_essence: "Toner / Essence",
  serum: "Serum",
  moisturizer: "Moisturizer",
  sunscreen: "Sunscreen"
};

const TEXTURE_NEIGHBORS = {
  watery: ["gel"],
  gel: ["watery", "lotion"],
  lotion: ["gel", "cream"],
  cream: ["lotion"]
};

const BARRIER_RANK = {
  low: 0,
  medium: 1,
  high: 2
};

const IRRITATION_RANK = {
  low: 0,
  medium: 1,
  high: 2
};

export const SCORE_WEIGHTS = {
  skinTypeMatch: 2,
  concernMatch: 3,
  directConcernFocusStrong: 5,
  directConcernFocusMedium: 3,
  textureExactMatch: 2,
  textureNearMatch: 1,
  finishMatch: 1,
  sebumControlHigh: 3,
  sebumControlMedium: 2,
  hydrationLevelHigh: 3,
  hydrationLevelMedium: 2,
  useTimeMatch: 2,
  useTimeSoftMatch: 1,
  useTimeMismatch: -1,
  dislikedFeelPenalty: -3,
  postWashMatch: 2,
  afternoonMatch: 2,
  environmentMatch: 1,
  maxEnvironmentScore: 2,
  irritationPenaltyHighSensitivity: -4,
  irritationPenaltyMediumSensitivity: -2,
  comedogenicPenaltyHigh: -3,
  comedogenicPenaltyMedium: -1
};

const CATEGORY_PRIORITY_BY_CONCERN = {
  oiliness: {
    serum: 5,
    cleanser: 4,
    toner_essence: 3,
    moisturizer: 1,
    sunscreen: 0
  },
  pores: {
    serum: 5,
    cleanser: 4,
    toner_essence: 3,
    moisturizer: 1,
    sunscreen: 0
  },
  dehydration: {
    moisturizer: 5,
    serum: 4,
    toner_essence: 3,
    cleanser: 1,
    sunscreen: 0
  },
  barrier: {
    moisturizer: 5,
    serum: 4,
    toner_essence: 3,
    cleanser: 1,
    sunscreen: 0
  },
  redness: {
    serum: 4,
    moisturizer: 4,
    toner_essence: 3,
    cleanser: 2,
    sunscreen: 0
  },
  acne: {
    serum: 5,
    cleanser: 4,
    toner_essence: 3,
    moisturizer: 2,
    sunscreen: 0
  },
  uneven_tone: {
    serum: 5,
    toner_essence: 3,
    moisturizer: 2,
    cleanser: 1,
    sunscreen: 0
  }
};

function getCategoryPriority(category, mainConcern) {
  return CATEGORY_PRIORITY_BY_CONCERN[mainConcern]?.[category] ?? 0;
}

function getTopPickPriorityLevels(mainConcern) {
  const priorities = Object.values(CATEGORY_PRIORITY_BY_CONCERN[mainConcern] || {});
  return [...new Set(priorities)].sort((a, b) => b - a);
}

function includesValue(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function normalizeTexture(value) {
  if (value === "heavy") {
    return "cream";
  }
  return value;
}

function normalizeFinish(value) {
  if (value === "fresh") {
    return "light";
  }
  if (value === "soft-matte") {
    return "matte";
  }
  if (value === "dewy") {
    return "dewy";
  }
  return "natural";
}

function getPreferredFinishes(answers) {
  const finishes = new Set();

  if (answers.preferredTexture === "watery" || answers.preferredTexture === "gel") {
    finishes.add("light");
  }

  if (answers.preferredTexture === "lotion") {
    finishes.add("natural");
  }

  if (answers.preferredTexture === "cream") {
    finishes.add("dewy");
  }

  if (answers.postWashFeeling === "tight" || answers.afternoonSkinChange === "more_dry") {
    finishes.add("dewy");
    finishes.add("natural");
  }

  if (
    answers.afternoonSkinChange === "more_oily" ||
    answers.mostDislikedFeel === "sticky" ||
    answers.mostDislikedFeel === "greasy"
  ) {
    finishes.add("light");
    finishes.add("matte");
  }

  if (
    answers.afternoonSkinChange === "red_or_irritated" ||
    answers.sensitivity === "high"
  ) {
    finishes.add("natural");
    finishes.add("light");
  }

  if (!finishes.size) {
    finishes.add("natural");
  }

  return Array.from(finishes);
}

function isNearTextureMatch(productTexture, preferredTexture) {
  const normalizedProductTexture = normalizeTexture(productTexture);
  const normalizedPreferredTexture = normalizeTexture(preferredTexture);

  return (
    normalizedProductTexture !== normalizedPreferredTexture &&
    (TEXTURE_NEIGHBORS[normalizedPreferredTexture] || []).includes(normalizedProductTexture)
  );
}

function conflictsWithDislikedFeel(product, dislikedFeel) {
  const normalizedTexture = normalizeTexture(product.texture);
  const normalizedFinish = normalizeFinish(product.finish);
  const notes = (product.notes || "").toLowerCase();

  if (dislikedFeel === "sticky") {
    return normalizedFinish === "dewy" || ["lotion", "cream"].includes(normalizedTexture);
  }

  if (dislikedFeel === "greasy") {
    return normalizedFinish === "dewy" || normalizedTexture === "cream";
  }

  if (dislikedFeel === "heavy") {
    return normalizedTexture === "cream" || normalizedFinish === "dewy";
  }

  if (dislikedFeel === "fragranced") {
    return notes.includes("fragrance") || notes.includes("perfume") || notes.includes("scent");
  }

  if (dislikedFeel === "pilling") {
    return notes.includes("pilling") || notes.includes("under makeup");
  }

  return false;
}

function getBaseMatchMetrics(product, answers) {
  const normalizedProductTexture = normalizeTexture(product.texture);
  const normalizedPreferredTexture = normalizeTexture(answers.preferredTexture);

  return {
    skinTypeMatch:
      answers.skinType === "not_sure" || includesValue(product.skin_types, answers.skinType),
    concernMatch: includesValue(product.concerns, answers.mainConcern),
    textureExactMatch:
      normalizedProductTexture === normalizedPreferredTexture ||
      product.texture === answers.preferredTexture,
    textureNearMatch: isNearTextureMatch(product.texture, answers.preferredTexture),
    sensitivitySafe:
      answers.sensitivity !== "high" || product.irritation_risk === "low"
  };
}

function buildCategoryPool(category, answers) {
  const categoryProducts = PRODUCT_DB.filter(
    (product) => product.is_kbeauty && product.category === category
  );

  const strictPool = categoryProducts.filter((product) => {
    const metrics = getBaseMatchMetrics(product, answers);
    const matchCount = [
      metrics.skinTypeMatch,
      metrics.concernMatch,
      metrics.textureExactMatch || metrics.textureNearMatch
    ].filter(Boolean).length;

    return metrics.sensitivitySafe && matchCount >= 2;
  });

  if (strictPool.length) {
    return strictPool;
  }

  const relaxedPool = categoryProducts.filter((product) => {
    const metrics = getBaseMatchMetrics(product, answers);
    const matchCount = [
      metrics.skinTypeMatch,
      metrics.concernMatch,
      metrics.textureExactMatch || metrics.textureNearMatch
    ].filter(Boolean).length;

    if (answers.sensitivity === "high" && product.irritation_risk !== "low") {
      return false;
    }

    return matchCount >= 1;
  });

  return relaxedPool.length ? relaxedPool : categoryProducts;
}

function getPostWashScore(product, answers) {
  const normalizedTexture = normalizeTexture(product.texture);
  const normalizedFinish = normalizeFinish(product.finish);

  if (answers.postWashFeeling === "tight") {
    if (
      product.barrier_support === "high" ||
      ["lotion", "cream"].includes(normalizedTexture) ||
      ["dewy", "natural"].includes(normalizedFinish)
    ) {
      return SCORE_WEIGHTS.postWashMatch;
    }
    return 0;
  }

  if (answers.postWashFeeling === "still_oily") {
    if (
      ["watery", "gel"].includes(normalizedTexture) ||
      ["light", "matte"].includes(normalizedFinish)
    ) {
      return SCORE_WEIGHTS.postWashMatch;
    }
    return 0;
  }

  if (normalizedFinish === "natural" || normalizedFinish === "light") {
    return 1;
  }

  return 0;
}

function getAfternoonScore(product, answers) {
  const normalizedTexture = normalizeTexture(product.texture);
  const normalizedFinish = normalizeFinish(product.finish);

  if (answers.afternoonSkinChange === "more_oily") {
    if (
      ["watery", "gel"].includes(normalizedTexture) ||
      ["light", "matte"].includes(normalizedFinish)
    ) {
      return SCORE_WEIGHTS.afternoonMatch;
    }
    return 0;
  }

  if (answers.afternoonSkinChange === "more_dry") {
    if (
      product.barrier_support === "high" ||
      ["natural", "dewy"].includes(normalizedFinish)
    ) {
      return SCORE_WEIGHTS.afternoonMatch;
    }
    return 0;
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    if (
      product.irritation_risk === "low" ||
      product.barrier_support === "high"
    ) {
      return SCORE_WEIGHTS.afternoonMatch;
    }
    return 0;
  }

  if (normalizedFinish === "natural") {
    return 1;
  }

  return 0;
}

function getEnvironmentScore(product, answers) {
  const matches = (answers.environmentExposure || []).filter((item) =>
    includesValue(product.climate_fit, item)
  );

  return {
    score: Math.min(matches.length * SCORE_WEIGHTS.environmentMatch, SCORE_WEIGHTS.maxEnvironmentScore),
    matches
  };
}

function getIrritationPenalty(product, answers) {
  if (product.irritation_risk !== "medium") {
    return 0;
  }

  if (answers.sensitivity === "high") {
    return SCORE_WEIGHTS.irritationPenaltyHighSensitivity;
  }

  if (answers.sensitivity === "medium") {
    return SCORE_WEIGHTS.irritationPenaltyMediumSensitivity;
  }

  return 0;
}

function scoreSebumControl(product, answers) {
  let priority = 0;

  if (answers.skinType === "oily") {
    priority += 1;
  }

  if (answers.mainConcern === "oiliness" || answers.mainConcern === "pores") {
    priority += 2;
  }

  if (answers.postWashFeeling === "still_oily") {
    priority += 1;
  }

  if (answers.afternoonSkinChange === "more_oily") {
    priority += 1;
  }

  if (priority >= 4) {
    if (product.sebum_control >= 5) {
      return SCORE_WEIGHTS.sebumControlHigh;
    }
    if (product.sebum_control >= 4) {
      return SCORE_WEIGHTS.sebumControlMedium;
    }
    return 0;
  }

  if (priority >= 2) {
    if (product.sebum_control >= 4) {
      return SCORE_WEIGHTS.sebumControlMedium;
    }
    if (product.sebum_control >= 3) {
      return 1;
    }
  }

  return 0;
}

function scoreHydrationLevel(product, answers) {
  let priority = 0;

  if (answers.skinType === "dry") {
    priority += 1;
  }

  if (answers.mainConcern === "dehydration" || answers.mainConcern === "barrier") {
    priority += 2;
  }

  if (answers.postWashFeeling === "tight") {
    priority += 1;
  }

  if (answers.afternoonSkinChange === "more_dry") {
    priority += 1;
  }

  if (priority >= 4) {
    if (product.hydration_level >= 5) {
      return SCORE_WEIGHTS.hydrationLevelHigh;
    }
    if (product.hydration_level >= 4) {
      return SCORE_WEIGHTS.hydrationLevelMedium;
    }
    return 0;
  }

  if (priority >= 2) {
    if (product.hydration_level >= 4) {
      return SCORE_WEIGHTS.hydrationLevelMedium;
    }
    if (product.hydration_level >= 3) {
      return 1;
    }
  }

  return 0;
}

function getComedogenicPenalty(product, answers) {
  const acneOrSensitive =
    answers.mainConcern === "acne" ||
    answers.sensitivity === "high" ||
    answers.sensitivity === "medium";

  if (!acneOrSensitive) {
    return 0;
  }

  if (product.comedogenic_risk === "high") {
    return SCORE_WEIGHTS.comedogenicPenaltyHigh;
  }

  if (product.comedogenic_risk === "medium") {
    return SCORE_WEIGHTS.comedogenicPenaltyMedium;
  }

  return 0;
}

function getPreferredUseTime(category, answers) {
  if (category === "sunscreen") {
    return "day";
  }

  if (category === "cleanser" || category === "toner_essence") {
    return "both";
  }

  if (category === "serum") {
    if (
      ["acne", "uneven_tone", "pores"].includes(answers.mainConcern) &&
      answers.sensitivity !== "high"
    ) {
      return "night";
    }
    return "both";
  }

  if (category === "moisturizer") {
    if (
      answers.skinType === "dry" ||
      answers.postWashFeeling === "tight" ||
      answers.afternoonSkinChange === "more_dry"
    ) {
      return "night";
    }
    return "both";
  }

  return "both";
}

function getUseTimeScore(product, answers) {
  const preferredUseTime = getPreferredUseTime(product.category, answers);

  if (product.use_time === preferredUseTime) {
    return {
      preferredUseTime,
      score: SCORE_WEIGHTS.useTimeMatch
    };
  }

  if (product.use_time === "both") {
    return {
      preferredUseTime,
      score: SCORE_WEIGHTS.useTimeSoftMatch
    };
  }

  if (preferredUseTime === "both") {
    return {
      preferredUseTime,
      score: 0
    };
  }

  return {
    preferredUseTime,
    score: SCORE_WEIGHTS.useTimeMismatch
  };
}

function getDirectConcernBonus(product, answers, metrics) {
  if (!metrics.concernMatch) {
    return 0;
  }

  const categoryPriority = getCategoryPriority(product.category, answers.mainConcern);

  if (answers.mainConcern === "dehydration" || answers.mainConcern === "barrier") {
    if (categoryPriority >= 4 && product.hydration_level >= 4) {
      return SCORE_WEIGHTS.directConcernFocusStrong;
    }
    if (categoryPriority >= 3 && product.hydration_level >= 3) {
      return SCORE_WEIGHTS.directConcernFocusMedium;
    }
  }

  if (answers.mainConcern === "oiliness" || answers.mainConcern === "pores") {
    if (categoryPriority >= 4 && product.sebum_control >= 4) {
      return SCORE_WEIGHTS.directConcernFocusStrong;
    }
    if (categoryPriority >= 3 && product.sebum_control >= 3) {
      return SCORE_WEIGHTS.directConcernFocusMedium;
    }
  }

  if (answers.mainConcern === "acne" || answers.mainConcern === "redness") {
    if (categoryPriority >= 4 && product.comedogenic_risk === "low") {
      return SCORE_WEIGHTS.directConcernFocusStrong;
    }
    if (categoryPriority >= 3 && product.irritation_risk === "low") {
      return SCORE_WEIGHTS.directConcernFocusMedium;
    }
  }

  if (answers.mainConcern === "uneven_tone") {
    if (categoryPriority >= 4) {
      return SCORE_WEIGHTS.directConcernFocusStrong;
    }
    if (categoryPriority >= 3) {
      return SCORE_WEIGHTS.directConcernFocusMedium;
    }
  }

  if (categoryPriority >= 4) {
    return SCORE_WEIGHTS.directConcernFocusMedium;
  }

  return 0;
}

function buildSkinTypeReason(product, answers, breakdown) {
  if (answers.skinType === "not_sure") {
    return "피부 타입 추정보다 실제 사용 패턴과 생활 조건 쪽에서 점수를 만든 제품입니다.";
  }

  if (!breakdown.skinTypeMatch) {
    return null;
  }

  if (answers.skinType === "oily") {
    return `흡수 속도가 ${product.absorption} 쪽이고 마무리가 ${normalizeFinish(product.finish)}에 가까워 유분이 많은 피부에서도 겉도는 느낌이 덜합니다.`;
  }

  if (answers.skinType === "dry") {
    return `건성 피부에서 필요한 보습감과 장벽 보완을 함께 보며, barrier support가 ${product.barrier_support} 쪽으로 잡혀 있습니다.`;
  }

  if (answers.skinType === "combination") {
    return "복합성처럼 번들거림과 건조가 같이 오는 패턴에서도 한쪽으로 과하게 치우치지 않는 쪽입니다.";
  }

  if (answers.skinType === "sensitive") {
    return "민감 피부 루틴에서 자극 리스크를 낮게 가져가도록 짜인 제품입니다.";
  }

  return null;
}

function buildConcernReason(product, answers, breakdown) {
  if (!breakdown.concernMatch) {
    return null;
  }

  if (answers.mainConcern === "oiliness") {
    return "유분 관리가 핵심일 때 피지 흐름을 눌러 주는 방향이 분명합니다.";
  }

  if (answers.mainConcern === "dehydration") {
    return "수분 보충이 필요한 상태에서 가볍기만 한 제품보다 보습 유지력이 더 또렷합니다.";
  }

  if (answers.mainConcern === "acne") {
    return "트러블 관리 기준에서 잔여감이 덜하고 코메도제닉 리스크를 낮게 보는 쪽입니다.";
  }

  if (answers.mainConcern === "uneven_tone") {
    return "톤 정리가 필요할 때 과한 잔여감 없이 꾸준히 얹기 쉬운 쪽입니다.";
  }

  if (answers.mainConcern === "pores") {
    return "모공과 번들거림을 함께 볼 때 표면에 남는 무게감이 덜합니다.";
  }

  if (answers.mainConcern === "redness") {
    return "붉은기가 올라오기 쉬운 날에 자극 리스크를 낮추는 방향으로 맞춰져 있습니다.";
  }

  if (answers.mainConcern === "barrier") {
    return `barrier support가 ${product.barrier_support} 쪽이라 회복 중심 루틴과 직접적으로 맞닿아 있습니다.`;
  }

  return null;
}

function buildTextureFinishReason(product, answers, breakdown) {
  const normalizedTexture = normalizeTexture(product.texture);
  const normalizedFinish = normalizeFinish(product.finish);

  if (breakdown.textureExactMatch && breakdown.finishMatch) {
    return `${answers.preferredTexture} 선호 제형과 ${normalizedFinish} 마무리가 함께 맞아 매일 이어 쓰기 쉽습니다.`;
  }

  if (breakdown.textureExactMatch) {
    return `${answers.preferredTexture} 선호 제형과 정확히 맞아 사용감 거부감이 적습니다.`;
  }

  if (breakdown.textureNearMatch && breakdown.finishMatch) {
    return `선호 제형과 가깝고 ${normalizedFinish} 마무리까지 과하게 어긋나지 않습니다.`;
  }

  return `${normalizedTexture} 제형과 ${normalizedFinish} 마무리가 루틴 전체에서 튀지 않게 이어집니다.`;
}

function buildEnvironmentReason(product, answers, breakdown) {
  if (breakdown.environmentMatches.length) {
    return `${breakdown.environmentMatches.join(", ")} 같은 생활 환경에서 사용감 변화가 비교적 덜한 편입니다.`;
  }

  if (answers.postWashFeeling === "tight" && product.barrier_support === "high") {
    return "세안 후 당김이 남는 패턴에서 더 메마르게 이어지지 않게 받쳐 줍니다.";
  }

  if (
    answers.afternoonSkinChange === "more_oily" &&
    ["light", "matte"].includes(normalizeFinish(product.finish))
  ) {
    return "오후에 유분이 올라오는 패턴에서도 마무리가 비교적 가볍게 남습니다.";
  }

  if (
    answers.afternoonSkinChange === "red_or_irritated" &&
    product.irritation_risk === "low"
  ) {
    return "오후에 자극이나 붉은기가 올라올 때도 루틴을 끊지 않게 이어가기 쉽습니다.";
  }

  return `${product.standout_reason}`;
}

function formatTextureLabel(texture) {
  const normalizedTexture = normalizeTexture(texture);
  const textureMap = {
    watery: "워터리 타입",
    gel: "gel 타입",
    lotion: "로션 타입",
    cream: "크림 타입",
    heavy: "리치 타입"
  };

  return textureMap[normalizedTexture] || normalizedTexture;
}

function buildSpecificCategoryType(product, answers) {
  const textureLabel = formatTextureLabel(product.texture);
  const concernSet = new Set(product.concerns || []);

  if (product.category === "cleanser") {
    if (concernSet.has("oiliness") || concernSet.has("pores") || product.sebum_control >= 4) {
      return `${textureLabel} 피지 조절 클렌저`;
    }

    if (concernSet.has("redness") || concernSet.has("acne") || product.irritation_risk === "low") {
      return `${textureLabel} 진정 클렌저`;
    }

    if (
      concernSet.has("dehydration") ||
      concernSet.has("barrier") ||
      answers.postWashFeeling === "tight" ||
      product.hydration_level >= 4
    ) {
      return `${textureLabel} 보습 클렌저`;
    }

    return `${textureLabel} 클렌저`;
  }

  if (product.category === "toner_essence") {
    if (concernSet.has("dehydration")) {
      return "수분 토너";
    }

    if (concernSet.has("redness") || concernSet.has("barrier")) {
      return "진정 에센스";
    }

    if (concernSet.has("oiliness") || concernSet.has("pores")) {
      return "피지 밸런싱 토너";
    }

    return "데일리 에센스 토너";
  }

  if (product.category === "serum") {
    if (concernSet.has("dehydration")) {
      return "수분 세럼";
    }

    if (concernSet.has("redness") || concernSet.has("barrier")) {
      return "진정 세럼";
    }

    if (concernSet.has("acne") || concernSet.has("oiliness") || concernSet.has("pores")) {
      return "피지 조절 세럼";
    }

    if (concernSet.has("uneven_tone")) {
      return "톤 케어 세럼";
    }

    return "기능성 세럼";
  }

  if (product.category === "moisturizer") {
    if (concernSet.has("barrier") || product.barrier_support === "high") {
      return `${textureLabel} 장벽 보습제`;
    }

    if (concernSet.has("dehydration") || product.hydration_level >= 4) {
      return `${textureLabel} 보습제`;
    }

    return `${textureLabel} 데일리 보습제`;
  }

  if (product.category === "sunscreen") {
    if (product.sebum_control >= 4 || ["light", "matte"].includes(normalizeFinish(product.finish))) {
      return "보송형 선크림";
    }

    if (product.hydration_level >= 4 || normalizeFinish(product.finish) === "dewy") {
      return "보습형 선크림";
    }

    if (product.irritation_risk === "low") {
      return "저자극 선크림";
    }

    return "데일리 선크림";
  }

  return CATEGORY_LABELS[product.category]?.toLowerCase() || product.category;
}

function buildComparisonTarget(product, answers) {
  return `같은 ${buildSpecificCategoryType(product, answers)}`;
}

function pickVariant(seed, items) {
  return items[seed % items.length];
}

function buildDifferenceAndOutcome(primary, runnerUp, answers) {
  const seed = getSentenceVariantKey(primary);

  if (
    (answers.mainConcern === "oiliness" ||
      answers.mainConcern === "pores" ||
      answers.afternoonSkinChange === "more_oily") &&
    (!runnerUp || primary.sebum_control >= (runnerUp.sebum_control || 0))
  ) {
    return {
      difference: pickVariant(seed, [
        "번들 막이 늦게 올라오고",
        "유분 막이 급하게 뜨지 않고",
        "겉도는 번들감이 덜 남고",
        "피지가 다시 올라오는 흐름이 더 완만하고"
      ]),
      outcome: pickVariant(seed + 1, [
        "오후 번들거림이 늦게 올라옵니다.",
        "겉도는 느낌이 줄어듭니다.",
        "유분이 몰리는 속도가 완만해집니다.",
        "표면이 더 빨리 정리됩니다."
      ])
    };
  }

  if (
    (answers.mainConcern === "dehydration" ||
      answers.mainConcern === "barrier" ||
      answers.postWashFeeling === "tight") &&
    (!runnerUp || primary.hydration_level >= (runnerUp.hydration_level || 0))
  ) {
    return {
      difference: pickVariant(seed, [
        "세안 후 당김이 더 천천히 올라오고",
        "수분막이 빨리 끊기지 않고",
        "마른 막감이 덜 남고",
        "건조하게 들뜨는 흐름이 덜하고"
      ]),
      outcome: pickVariant(seed + 1, [
        "레이어링 부담 없이 이어집니다.",
        "건조감이 급하게 치고 올라오지 않습니다.",
        "다음 단계가 덜 끊깁니다.",
        "당김이 더 천천히 올라옵니다."
      ])
    };
  }

  if (
    (answers.skinType === "sensitive" ||
      answers.mainConcern === "redness" ||
      answers.mainConcern === "acne" ||
      answers.afternoonSkinChange === "red_or_irritated" ||
      (answers.environmentExposure || []).includes("mask")) &&
    (!runnerUp ||
      (primary.irritation_risk === "low" && runnerUp.irritation_risk !== "low"))
  ) {
    return {
      difference: pickVariant(seed, [
        "마찰 뒤 자극 반응이 덜 올라오고",
        "열감 뒤 붉은기가 빨리 번지지 않고",
        "예민해진 날에도 자극 신호가 덜 올라오고",
        "마스크 마찰 뒤 답답함이 덜 남고"
      ]),
      outcome: pickVariant(seed + 1, [
        "붉은 기운이 더 빨리 가라앉습니다.",
        "답답함이 덜 남습니다.",
        "자극감이 오래 끌지 않습니다.",
        "민감한 날에도 루틴이 끊기지 않습니다."
      ])
    };
  }

  if (!runnerUp || primary.absorption !== runnerUp.absorption) {
    if (primary.absorption === "fast") {
      return {
        difference: pickVariant(seed, [
          "흡수 흐름이 더 빠르고",
          "겉도는 시간이 더 짧고",
          "펴 바른 뒤 밀림이 적고",
          "흡수 흐름이 끊기지 않고"
        ]),
        outcome: pickVariant(seed + 1, [
          "겉도는 시간이 줄어듭니다.",
          "다음 단계가 덜 밀립니다.",
          "표면이 더 빨리 정리됩니다.",
          "레이어링 흐름이 매끈하게 이어집니다."
        ])
      };
    }

    if (primary.absorption === "medium") {
      return {
        difference: pickVariant(seed, [
          "맞물리는 잔여감이 과하지 않고",
          "펴 바른 뒤 밀림이 적고",
          "표면에 뜨는 잔여감이 덜하고",
          "흡수 흐름이 끊기지 않고"
        ]),
        outcome: pickVariant(seed + 1, [
          "겉도는 시간이 줄어듭니다.",
          "레이어링이 더 수월합니다.",
          "마무리가 더 정돈돼 보입니다.",
          "다음 단계가 더 잘 맞물립니다."
        ])
      };
    }
  }

  if (!runnerUp || primary.breakdown.textureExactMatch > runnerUp.breakdown.textureExactMatch) {
    return {
      difference: pickVariant(seed, [
        "질감이 더 가볍게 맞물리고",
        "레이어링 무게감이 덜하고",
        "펴 바른 뒤 밀림이 적고",
        "텍스처 흐름이 더 매끈하고"
      ]),
      outcome: pickVariant(seed + 1, [
        "레이어링 부담이 줄어듭니다.",
        "바르기가 더 쉽습니다.",
        "표면이 더 고르게 남습니다.",
        "사용감이 덜 튑니다."
      ])
    };
  }

  if (!runnerUp || primary.breakdown.finishMatch > runnerUp.breakdown.finishMatch) {
    return {
      difference: pickVariant(seed, [
        "마무리 막감이 덜 두껍고",
        "보송함이 더 늦게 무너지고",
        "유분막이 덜 답답하게 남고",
        "표면 잔여감이 더 가볍고"
      ]),
      outcome: pickVariant(seed + 1, [
        "마무리가 더 가볍게 남습니다.",
        "겉번들 흐름이 늦어집니다.",
        "표면 답답함이 줄어듭니다.",
        "피부결이 덜 밀려 보입니다."
      ])
    };
  }

  if (!runnerUp || primary.comedogenic_risk === "low") {
    return {
      difference: pickVariant(seed, [
        "잔여감이 오래 눌러앉지 않고",
        "답답한 막감이 덜 쌓이고",
        "피부 위에 남는 무게감이 가볍고",
        "겉도는 막이 덜 남고"
      ]),
      outcome: pickVariant(seed + 1, [
        "답답함이 덜 남습니다.",
        "트러블 부담이 덜 쌓입니다.",
        "표면 잔여감이 줄어듭니다.",
        "무거운 막감이 오래 남지 않습니다."
      ])
    };
  }

  return {
    difference: pickVariant(seed, [
      "잔여감이 더 가볍고",
      "바른 뒤 막감이 덜 답답하고",
      "펴 발렸을 때 거리감이 적고",
      "표면에 뜨는 막이 덜 남고"
    ]),
    outcome: pickVariant(seed + 1, [
      "사용감이 더 가볍습니다.",
      "겉도는 시간이 줄어듭니다.",
      "레이어링 흐름이 덜 끊깁니다.",
      "마무리가 더 정돈됩니다."
    ])
  };
}

function buildUserConditionPhrase(answers) {
  if (answers.skinType === "oily" || answers.afternoonSkinChange === "more_oily") {
    return "오후 번들거림이 빠른 지성 피부";
  }

  if (answers.skinType === "dry" || answers.postWashFeeling === "tight") {
    return "세안 후 당김이 남는 건성 피부";
  }

  if (
    answers.skinType === "sensitive" &&
    (answers.environmentExposure || []).includes("mask")
  ) {
    return "마스크 마찰에 예민한 민감 피부";
  }

  if (answers.afternoonSkinChange === "red_or_irritated" || answers.mainConcern === "redness") {
    return "오후 붉은기가 올라오는 민감 피부";
  }

  if (answers.mainConcern === "acne") {
    return "잔여감에 예민한 트러블 피부";
  }

  if (
    answers.mainConcern === "pores" ||
    (answers.environmentExposure || []).includes("humidity")
  ) {
    return "습도와 유분 때문에 모공이 도드라지는 피부";
  }

  if (
    answers.mainConcern === "dehydration" ||
    answers.mainConcern === "barrier" ||
    (answers.environmentExposure || []).includes("aircon")
  ) {
    return "속건조가 올라오는 피부";
  }

  if ((answers.environmentExposure || []).includes("outdoor")) {
    return "실외 노출이 잦은 피부";
  }

  return "사용감 변화에 민감한 피부";
}

function getSentenceVariantKey(product) {
  return Array.from(product.id || "").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildComparisonReason(primary, runnerUp, answers) {
  const target = buildComparisonTarget(primary, answers);
  const { difference, outcome } = buildDifferenceAndOutcome(primary, runnerUp, answers);
  const userCondition = buildUserConditionPhrase(answers);
  const seed = getSentenceVariantKey(primary);
  const templates = [
    `${target} 대비 ${difference} ${userCondition}에서 ${outcome}`,
    `${target} 기준으로 보면 ${difference} ${userCondition}에서 ${outcome}`,
    `${target}보다 ${difference} ${userCondition}에서 ${outcome}`,
    `${target} 흐름에서는 ${difference} ${userCondition}에서 ${outcome}`,
    `${target}와 비교하면 ${difference} ${userCondition}에서 ${outcome}`
  ];

  return templates[seed % templates.length];
}

function buildExplanationContext(product, answers, runnerUp, comparisonReason) {
  return {
    skinType: answers.skinType,
    mainConcern: answers.mainConcern,
    preferredTexture: answers.preferredTexture,
    postWashFeeling: answers.postWashFeeling,
    afternoonSkinChange: answers.afternoonSkinChange,
    environmentExposure: answers.environmentExposure || [],
    mostDislikedFeel: answers.mostDislikedFeel,
    matchedSignals: {
      skinType: product.breakdown.skinTypeMatch,
      concern: product.breakdown.concernMatch,
      textureExact: product.breakdown.textureExactMatch,
      textureNear: product.breakdown.textureNearMatch,
      finish: product.breakdown.finishMatch,
      environment: product.breakdown.environmentMatches,
      postWashScore: product.breakdown.postWashScore,
      afternoonScore: product.breakdown.afternoonScore
    },
    productTraits: {
      texture: product.texture,
      finish: product.finish,
      absorption: product.absorption,
      barrierSupport: product.barrier_support,
      irritationRisk: product.irritation_risk,
      climateFit: product.climate_fit,
      standoutReason: product.standout_reason
    },
    scoreBreakdown: product.score_breakdown,
    runnerUp: runnerUp
      ? {
          name: runnerUp.name,
          brand: runnerUp.brand,
          texture: runnerUp.texture,
          finish: runnerUp.finish,
          irritationRisk: runnerUp.irritation_risk,
          barrierSupport: runnerUp.barrier_support,
          score: runnerUp.score
        }
      : null,
    comparisonReason
  };
}

function buildLabels(product, breakdown, isTopPick) {
  const labels = [];

  if (isTopPick) {
    labels.push("Best Match");
  }

  if (
    ["watery", "gel"].includes(normalizeTexture(product.texture)) ||
    normalizeFinish(product.finish) === "light"
  ) {
    labels.push("Lightweight Option");
  }

  if (product.barrier_support === "high") {
    labels.push("Barrier-Friendly");
  }

  if (product.irritation_risk === "low" || breakdown.irritationPenalty === 0) {
    labels.push("Low irritation");
  }

  return labels.slice(0, isTopPick ? 3 : 2);
}

function decorateProduct(product, answers, runnerUp, isTopPick = false) {
  const comparisonReason = buildComparisonReason(product, runnerUp, answers);
  const reasonParts = [
    buildSkinTypeReason(product, answers, product.breakdown),
    buildConcernReason(product, answers, product.breakdown),
    buildTextureFinishReason(product, answers, product.breakdown),
    buildEnvironmentReason(product, answers, product.breakdown)
  ].filter(Boolean);
  const leadReason = reasonParts.slice(0, 2).join(" ");

  return {
    ...product,
    step: CATEGORY_LABELS[product.category],
    labels: buildLabels(product, product.breakdown, isTopPick),
    comparison_reason: comparisonReason,
    reason: leadReason ? `${comparisonReason} ${leadReason}` : comparisonReason,
    explanation_context: buildExplanationContext(product, answers, runnerUp, comparisonReason)
  };
}

export function scoreProduct(product, answers) {
  const metrics = getBaseMatchMetrics(product, answers);
  const preferredFinishes = getPreferredFinishes(answers);
  const normalizedFinish = normalizeFinish(product.finish);
  const environment = getEnvironmentScore(product, answers);
  const postWashScore = getPostWashScore(product, answers);
  const afternoonScore = getAfternoonScore(product, answers);
  const irritationPenalty = getIrritationPenalty(product, answers);
  const sebumControlScore = scoreSebumControl(product, answers);
  const hydrationLevelScore = scoreHydrationLevel(product, answers);
  const comedogenicPenalty = getComedogenicPenalty(product, answers);
  const useTime = getUseTimeScore(product, answers);
  const directConcernBonus = getDirectConcernBonus(product, answers, metrics);
  const dislikedPenalty = conflictsWithDislikedFeel(product, answers.mostDislikedFeel);

  let score = 0;

  if (metrics.skinTypeMatch && answers.skinType !== "not_sure") {
    score += SCORE_WEIGHTS.skinTypeMatch;
  }

  if (metrics.concernMatch) {
    score += SCORE_WEIGHTS.concernMatch;
  }

  score += directConcernBonus;

  if (metrics.textureExactMatch) {
    score += SCORE_WEIGHTS.textureExactMatch;
  } else if (metrics.textureNearMatch) {
    score += SCORE_WEIGHTS.textureNearMatch;
  }

  if (preferredFinishes.includes(normalizedFinish)) {
    score += SCORE_WEIGHTS.finishMatch;
  }

  score += sebumControlScore;
  score += hydrationLevelScore;
  score += useTime.score;

  if (dislikedPenalty) {
    score += SCORE_WEIGHTS.dislikedFeelPenalty;
  }

  score += postWashScore;
  score += afternoonScore;
  score += environment.score;
  score += irritationPenalty;
  score += comedogenicPenalty;

  return {
    ...product,
    score,
    breakdown: {
      skinTypeMatch: metrics.skinTypeMatch,
      concernMatch: metrics.concernMatch,
      textureExactMatch: metrics.textureExactMatch,
      textureNearMatch: metrics.textureNearMatch,
      finishMatch: preferredFinishes.includes(normalizedFinish),
      directConcernBonus,
      sebumControlScore,
      hydrationLevelScore,
      useTimeScore: useTime.score,
      preferredUseTime: useTime.preferredUseTime,
      dislikedFeelPenalty: dislikedPenalty,
      postWashScore,
      afternoonScore,
      environmentScore: environment.score,
      environmentMatches: environment.matches,
      irritationPenalty,
      comedogenicPenalty,
      preferredFinishes
    },
    score_breakdown: {
      skinTypeMatch:
        metrics.skinTypeMatch && answers.skinType !== "not_sure"
          ? SCORE_WEIGHTS.skinTypeMatch
          : 0,
      concernMatch: metrics.concernMatch ? SCORE_WEIGHTS.concernMatch : 0,
      directConcernFocus: directConcernBonus,
      textureMatch: metrics.textureExactMatch
        ? SCORE_WEIGHTS.textureExactMatch
        : metrics.textureNearMatch
          ? SCORE_WEIGHTS.textureNearMatch
          : 0,
      finishMatch: preferredFinishes.includes(normalizedFinish)
        ? SCORE_WEIGHTS.finishMatch
        : 0,
      sebumControl: sebumControlScore,
      hydrationLevel: hydrationLevelScore,
      useTimeMatch: useTime.score,
      dislikedFeelPenalty: dislikedPenalty ? SCORE_WEIGHTS.dislikedFeelPenalty : 0,
      postWashFeeling: postWashScore,
      afternoonSkinChange: afternoonScore,
      environmentExposure: environment.score,
      irritationRiskPenalty: irritationPenalty,
      comedogenicRiskPenalty: comedogenicPenalty
    }
  };
}

function compareRank(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  if (a.breakdown.irritationPenalty !== b.breakdown.irritationPenalty) {
    return b.breakdown.irritationPenalty - a.breakdown.irritationPenalty;
  }

  if (BARRIER_RANK[b.barrier_support] !== BARRIER_RANK[a.barrier_support]) {
    return BARRIER_RANK[b.barrier_support] - BARRIER_RANK[a.barrier_support];
  }

  if (IRRITATION_RANK[a.irritation_risk] !== IRRITATION_RANK[b.irritation_risk]) {
    return IRRITATION_RANK[a.irritation_risk] - IRRITATION_RANK[b.irritation_risk];
  }

  return a.name.localeCompare(b.name);
}

export function buildRecommendationBundle(answers, options = {}) {
  const categoryRankings = [];

  for (const category of CATEGORY_ORDER) {
    const pool = buildCategoryPool(category, answers);
    const ranked = pool.map((product) => scoreProduct(product, answers)).sort(compareRank);

    if (!ranked.length) {
      continue;
    }

    categoryRankings.push({
      category,
      ranked
    });
  }

  const categoryLeaders = categoryRankings
    .map((entry) => entry.ranked[0])
    .filter(Boolean);

  let topPickSource = null;

  for (const priority of getTopPickPriorityLevels(answers.mainConcern)) {
    const candidates = categoryLeaders.filter(
      (product) => getCategoryPriority(product.category, answers.mainConcern) === priority
    );

    if (candidates.length) {
      topPickSource = candidates.sort(compareRank)[0];
      break;
    }
  }

  const topPick = topPickSource
    ? decorateProduct(topPickSource, answers, null, true)
    : null;

  const categoryPicks = categoryRankings
    .map(({ category, ranked }) => {
      const selectedIndex = ranked.findIndex((product) => product.id !== topPick?.id);
      const winnerIndex = selectedIndex === -1 ? 0 : selectedIndex;
      const winner = ranked[winnerIndex];
      const runnerUp = ranked.find((product) => product.id !== winner.id) || null;

      return {
        category,
        winner: decorateProduct(winner, answers, runnerUp, false),
        ranked
      };
    })
    .sort((a, b) => compareRank(a.winner, b.winner))
    .map((entry) => entry.winner);

  const selectedIds = new Set([
    ...(topPick ? [topPick.id] : []),
    ...categoryPicks.map((product) => product.id)
  ]);

  const alternativeSource =
    categoryRankings
      .flatMap(({ category, ranked }) =>
        ranked
          .filter((product) => !selectedIds.has(product.id))
          .map((product) => ({ category, product }))
      )
      .sort((a, b) => compareRank(a.product, b.product))
      .find(({ category, product }) => {
        const categoryWinner = categoryPicks.find((item) => item.category === category);
        return categoryWinner && categoryWinner.score - product.score <= 2;
      }) || null;

  const alternative = options.includeAlternative && alternativeSource
    ? decorateProduct(
        alternativeSource.product,
        answers,
        categoryRankings
          .find((entry) => entry.category === alternativeSource.category)
          ?.ranked.find((candidate) => candidate.id !== alternativeSource.product.id) || null,
        false
      )
    : null;

  return {
    topPick,
    categoryPicks,
    alternative,
    products: topPick
      ? [topPick, ...categoryPicks, ...(alternative ? [alternative] : [])]
      : [...categoryPicks, ...(alternative ? [alternative] : [])],
    scoring: SCORE_WEIGHTS
  };
}

export function recommendProducts(answers, options = {}) {
  return buildRecommendationBundle(answers, options).products;
}

export function buildOptionalSkinNote(answers) {
  if (answers.afternoonSkinChange === "more_oily") {
    return {
      title: "Optional Skin Note",
      description:
        "When oil builds up later in the day, lighter layers usually stay easier to repeat than richer comfort textures."
    };
  }

  if (answers.afternoonSkinChange === "more_dry") {
    return {
      title: "Optional Skin Note",
      description:
        "If your skin dries out by afternoon, the routine often improves more from holding water in than from adding stronger actives."
    };
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    return {
      title: "Optional Skin Note",
      description:
        "When heat or friction shows up later in the day, lower-irritation layering usually matters more than adding extra steps."
    };
  }

  return {
    title: "Optional Skin Note",
    description:
      "This MVP is strongest when it narrows the routine to the products you are most likely to keep using consistently."
  };
}

