import { getRecommendationProducts } from "@/lib/product-source";

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

const SCORE_WEIGHTS = {
  skinTypeMatch: 3,
  concernMatch: 5,
  preferredTexture: 2,
  nearTexture: 1,
  finishMatch: 1,
  sensitivitySafe: 2,
  barrierSupport: 2,
  environmentMatch: 1,
  dislikedFeelPenalty: -3,
  useTimeMatch: 1
};

const CATEGORY_PRIORITY_BY_CONCERN = {
  oiliness: { serum: 5, cleanser: 4, toner_essence: 3, moisturizer: 2, sunscreen: 1 },
  pores: { serum: 5, cleanser: 4, toner_essence: 3, moisturizer: 2, sunscreen: 1 },
  dehydration: { moisturizer: 5, toner_essence: 4, serum: 3, cleanser: 2, sunscreen: 1 },
  acne: { serum: 5, cleanser: 4, toner_essence: 3, moisturizer: 2, sunscreen: 1 },
  uneven_tone: { serum: 5, toner_essence: 4, sunscreen: 3, moisturizer: 2, cleanser: 1 },
  redness: { serum: 4, moisturizer: 4, toner_essence: 3, cleanser: 2, sunscreen: 1 },
  barrier: { moisturizer: 5, serum: 4, toner_essence: 3, cleanser: 2, sunscreen: 1 }
};

const TEXTURE_NEIGHBORS = {
  watery: ["gel"],
  gel: ["watery", "lotion"],
  lotion: ["gel", "cream"],
  cream: ["lotion"]
};

function includesValue(list, value) {
  return Array.isArray(list) && list.includes(value);
}

function normalizeTexture(value) {
  if (value === "essence") {
    return "watery";
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

function getCategoryPriority(category, mainConcern) {
  return CATEGORY_PRIORITY_BY_CONCERN[mainConcern]?.[category] ?? 0;
}

function getTopPickPriorityLevels(mainConcern) {
  const priorities = Object.values(CATEGORY_PRIORITY_BY_CONCERN[mainConcern] || {});
  return [...new Set(priorities)].sort((a, b) => b - a);
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

  if (dislikedFeel === "sticky") {
    return normalizedFinish === "dewy" || ["lotion", "cream"].includes(normalizedTexture);
  }

  if (dislikedFeel === "greasy") {
    return normalizedFinish === "dewy" || normalizedTexture === "cream";
  }

  if (dislikedFeel === "heavy") {
    return normalizedTexture === "cream";
  }

  return false;
}

function getEnvironmentScore(product, answers) {
  const matched = (answers.environmentExposure || []).filter((item) =>
    includesValue(product.climate_fit, item)
  );

  return Math.min(2, matched.length) * SCORE_WEIGHTS.environmentMatch;
}

function scoreProduct(product, answers) {
  let score = 0;
  const preferredFinishes = getPreferredFinishes(answers);
  const normalizedTexture = normalizeTexture(product.texture);
  const normalizedPreferredTexture = normalizeTexture(answers.preferredTexture);
  const normalizedFinish = normalizeFinish(product.finish);

  const breakdown = {
    skinTypeMatch: 0,
    concernMatch: 0,
    textureMatch: 0,
    finishMatch: 0,
    sensitivitySafe: 0,
    barrierSupport: 0,
    environmentMatch: 0,
    dislikedFeelPenalty: 0,
    useTimeMatch: 0
  };

  if (answers.skinType === "not_sure" || includesValue(product.skin_types, answers.skinType)) {
    score += SCORE_WEIGHTS.skinTypeMatch;
    breakdown.skinTypeMatch = SCORE_WEIGHTS.skinTypeMatch;
  }

  if (includesValue(product.concerns, answers.mainConcern)) {
    score += SCORE_WEIGHTS.concernMatch;
    breakdown.concernMatch = SCORE_WEIGHTS.concernMatch;
  }

  if (normalizedTexture === normalizedPreferredTexture) {
    score += SCORE_WEIGHTS.preferredTexture;
    breakdown.textureMatch = SCORE_WEIGHTS.preferredTexture;
  } else if (isNearTextureMatch(product.texture, answers.preferredTexture)) {
    score += SCORE_WEIGHTS.nearTexture;
    breakdown.textureMatch = SCORE_WEIGHTS.nearTexture;
  }

  if (preferredFinishes.includes(normalizedFinish)) {
    score += SCORE_WEIGHTS.finishMatch;
    breakdown.finishMatch = SCORE_WEIGHTS.finishMatch;
  }

  if (answers.sensitivity !== "high" || product.irritation_risk === "low") {
    score += SCORE_WEIGHTS.sensitivitySafe;
    breakdown.sensitivitySafe = SCORE_WEIGHTS.sensitivitySafe;
  }

  if (
    (answers.mainConcern === "barrier" || answers.mainConcern === "redness" || answers.postWashFeeling === "tight") &&
    product.barrier_support === "high"
  ) {
    score += SCORE_WEIGHTS.barrierSupport;
    breakdown.barrierSupport = SCORE_WEIGHTS.barrierSupport;
  }

  const environmentScore = getEnvironmentScore(product, answers);
  score += environmentScore;
  breakdown.environmentMatch = environmentScore;

  if (conflictsWithDislikedFeel(product, answers.mostDislikedFeel)) {
    score += SCORE_WEIGHTS.dislikedFeelPenalty;
    breakdown.dislikedFeelPenalty = SCORE_WEIGHTS.dislikedFeelPenalty;
  }

  if (product.use_time === "both" || answers.mainConcern !== "uneven_tone") {
    score += SCORE_WEIGHTS.useTimeMatch;
    breakdown.useTimeMatch = SCORE_WEIGHTS.useTimeMatch;
  }

  return {
    ...product,
    score,
    breakdown
  };
}

function buildCategoryPool(category, answers, productDb) {
  const categoryProducts = productDb.filter(
    (product) => product.is_kbeauty && product.category === category
  );

  if (!categoryProducts.length) {
    return [];
  }

  const strictPool = categoryProducts.filter((product) => {
    const matches = [
      answers.skinType === "not_sure" || includesValue(product.skin_types, answers.skinType),
      includesValue(product.concerns, answers.mainConcern),
      normalizeTexture(product.texture) === normalizeTexture(answers.preferredTexture) ||
        isNearTextureMatch(product.texture, answers.preferredTexture)
    ].filter(Boolean).length;

    if (answers.sensitivity === "high" && product.irritation_risk !== "low") {
      return false;
    }

    return matches >= 2;
  });

  return strictPool.length ? strictPool : categoryProducts;
}

function compareRank(a, b) {
  if (b.score !== a.score) {
    return b.score - a.score;
  }

  return a.name.localeCompare(b.name);
}

function buildLabels(product, answers, isTopPick) {
  const labels = [];

  if (includesValue(product.concerns, answers.mainConcern)) {
    labels.push("Concern Match");
  }

  if (answers.skinType === "not_sure" || includesValue(product.skin_types, answers.skinType)) {
    labels.push("Skin Match");
  }

  if (
    normalizeTexture(product.texture) === normalizeTexture(answers.preferredTexture) ||
    isNearTextureMatch(product.texture, answers.preferredTexture)
  ) {
    labels.push("Texture Match");
  }

  if (product.barrier_support === "high") {
    labels.push("Barrier Friendly");
  }

  return labels.slice(0, isTopPick ? 3 : 2);
}

function buildReason(product, answers) {
  const concernText = {
    oiliness: "오후 유분 흐름",
    dehydration: "건조감",
    acne: "트러블 부담",
    uneven_tone: "칙칙한 톤 흐름",
    pores: "모공과 번들감",
    redness: "붉은 기운",
    barrier: "장벽 부담"
  };

  const textureText = {
    watery: "가볍게 퍼지고",
    gel: "산뜻하게 흡수되고",
    lotion: "부드럽게 이어지고",
    cream: "보습감 있게 감싸주고"
  };

  return `${textureText[normalizeTexture(product.texture)] || "부담 없이 이어지고"} ${concernText[answers.mainConcern] || "현재 고민"} 쪽 체감이 덜 무겁게 남도록 맞춘 제품입니다.`;
}

function buildComparisonReason(product, runnerUp, answers) {
  if (!runnerUp) {
    return `${product.brand}의 사용감이 현재 피부 조건에서 더 일관된 체감으로 남습니다.`;
  }

  if (normalizeTexture(product.texture) !== normalizeTexture(runnerUp.texture)) {
    return `${normalizeTexture(product.texture)} 제형이 ${answers.preferredTexture} 선호와 더 가까워 겉도는 느낌이 덜 남습니다.`;
  }

  if (product.irritation_risk !== runnerUp.irritation_risk) {
    return `자극 반응이 덜 올라와 민감도가 있는 날에도 더 편하게 이어집니다.`;
  }

  return `${product.finish} 마무리가 현재 피부 흐름에서 더 부담 없이 이어집니다.`;
}

function decorateProduct(product, answers, runnerUp, isTopPick = false) {
  return {
    ...product,
    step: CATEGORY_LABELS[product.category] || product.category,
    labels: buildLabels(product, answers, isTopPick),
    reason: buildReason(product, answers),
    comparison_reason: buildComparisonReason(product, runnerUp, answers),
    explanation_context: {
      concern: answers.mainConcern,
      preferredTexture: answers.preferredTexture,
      skinType: answers.skinType
    },
    score_breakdown: product.breakdown
  };
}

export function buildRecommendationBundleFromProducts(answers, productDb, options = {}) {
  const categoryRankings = [];

  for (const category of CATEGORY_ORDER) {
    const pool = buildCategoryPool(category, answers, productDb);
    const ranked = pool.map((product) => scoreProduct(product, answers)).sort(compareRank);

    if (!ranked.length) {
      continue;
    }

    categoryRankings.push({ category, ranked });
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

  if (!topPickSource && categoryLeaders.length) {
    topPickSource = categoryLeaders.sort(compareRank)[0];
  }

  const topPick = topPickSource
    ? decorateProduct(topPickSource, answers, null, true)
    : null;

  const categoryPicks = categoryRankings
    .map(({ ranked }) => {
      const selectedIndex = ranked.findIndex((product) => product.id !== topPick?.id);
      const winnerIndex = selectedIndex === -1 ? 0 : selectedIndex;
      const winner = ranked[winnerIndex];
      const runnerUp = ranked.find((product) => product.id !== winner.id) || null;

      return decorateProduct(winner, answers, runnerUp, false);
    })
    .filter(Boolean)
    .sort(compareRank);

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
      .sort((a, b) => compareRank(a.product, b.product))[0] || null;

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

export async function buildRecommendationBundle(answers, options = {}) {
  const productDb = await getRecommendationProducts();
  return buildRecommendationBundleFromProducts(answers, productDb, options);
}

export async function recommendProducts(answers, options = {}) {
  return (await buildRecommendationBundle(answers, options)).products;
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
