import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TOP_PICK_SCORING_WEIGHTS,
  compareRankedProducts,
  normalizeRecommendationAnswers,
  scoreCanonicalProduct,
  type CanonicalRecommendationProduct,
  type RankedRecommendationProduct,
  type RecommendationAnswers,
} from "@/lib/recommendation-scoring";

type RecommendationBundleOptions = {
  includeAlternative?: boolean;
};

type DecoratedRecommendationProduct = RankedRecommendationProduct & {
  step: string;
  labels: string[];
  reason: string;
  comparison_reason: string;
  explanation_context: {
    concern: string | null;
    preferredTexture: string | null;
    skinType: string | null;
  };
};

function buildLabels(product: RankedRecommendationProduct, featured: boolean): string[] {
  const labels: string[] = [];

  if (product.matched_signals.matched_concerns.length > 0) {
    labels.push("고민 일치");
  }

  if (product.matched_signals.matched_skin_type) {
    labels.push("피부 타입 일치");
  }

  if (product.matched_signals.texture_match === "exact") {
    labels.push("사용감 일치");
  } else if (product.matched_signals.texture_match === "near") {
    labels.push("사용감 근접");
  }

  if (product.matched_signals.sensitivity_safe) {
    labels.push("민감 피부 우호");
  } else if (product.matched_signals.irritation_risk === "low") {
    labels.push("저자극 축");
  }

  if (product.matched_signals.finish_match) {
    labels.push("마무리감 일치");
  }

  return labels.slice(0, featured ? 3 : 2);
}

function buildReason(product: RankedRecommendationProduct): string {
  if (product.why_picked.length > 0) {
    return product.why_picked.slice(0, 2).join(" ");
  }

  return `${product.brand} ${product.name}이 현재 입력 기준에서 전체 점수 균형이 가장 안정적입니다.`;
}

function buildComparisonReason(
  product: RankedRecommendationProduct,
  runnerUp: RankedRecommendationProduct | null,
): string {
  if (!runnerUp) {
    return "현재 입력 기준에서 전체 점수 균형이 가장 안정적입니다.";
  }

  if (product.matched_signals.matched_concerns.length > runnerUp.matched_signals.matched_concerns.length) {
    return "주요 고민에 더 직접적으로 맞닿아 있어서 체감 차이가 먼저 오기 좋습니다.";
  }

  if (product.score_breakdown.texture_match > runnerUp.score_breakdown.texture_match) {
    return "선호 사용감에 더 가까워서 레이어링 부담이 덜합니다.";
  }

  if (product.score_breakdown.irritation_penalty > runnerUp.score_breakdown.irritation_penalty) {
    return "자극 리스크가 더 낮아 예민한 날에도 루틴을 이어가기 쉽습니다.";
  }

  if (Number(product.matched_signals.sensitivity_safe) > Number(runnerUp.matched_signals.sensitivity_safe)) {
    return "민감 피부 우호성이 더 높아서 꾸준히 쓰기 편한 쪽입니다.";
  }

  if (Number(product.matched_signals.finish_match) > Number(runnerUp.matched_signals.finish_match)) {
    return "일상 선호 마무리감에 더 가까워 잔여감 충돌이 적습니다.";
  }

  return "같은 카테고리 안에서도 현재 입력 기준 점수 균형이 더 안정적입니다.";
}

function decorateProduct(
  product: RankedRecommendationProduct,
  answers: RecommendationAnswers,
  runnerUp: RankedRecommendationProduct | null,
  featured = false,
): DecoratedRecommendationProduct {
  const normalizedAnswers = normalizeRecommendationAnswers(answers);

  return {
    ...product,
    step: CATEGORY_LABELS[product.category] || product.category,
    labels: buildLabels(product, featured),
    reason: buildReason(product),
    comparison_reason: buildComparisonReason(product, runnerUp),
    explanation_context: {
      concern: normalizedAnswers.mainConcern || null,
      preferredTexture: normalizedAnswers.preferredTexture || null,
      skinType: normalizedAnswers.skinType || null,
    },
  };
}

function buildRankedProducts(
  answers: RecommendationAnswers,
  products: CanonicalRecommendationProduct[],
): RankedRecommendationProduct[] {
  return products
    .filter((product) => product?.id && product?.name && product?.brand)
    .filter((product) => product.is_kbeauty !== false)
    .map((product) => scoreCanonicalProduct(product, answers))
    .sort(compareRankedProducts);
}

function getCategoryRunnerUp(
  rankedProducts: RankedRecommendationProduct[],
  category: string,
  winnerId: string,
  topPickId: string | null,
): RankedRecommendationProduct | null {
  return (
    rankedProducts.find(
      (product) =>
        product.category === category &&
        product.id !== winnerId &&
        product.id !== topPickId,
    ) || null
  );
}

export function buildTopPickBundleFromProducts(
  answers: RecommendationAnswers,
  products: CanonicalRecommendationProduct[],
  options: RecommendationBundleOptions = {},
) {
  const rankedProducts = buildRankedProducts(answers, products);
  const topPickSource = rankedProducts[0] || null;
  const topPickRunnerUp = topPickSource ? rankedProducts.find((product) => product.id !== topPickSource.id) || null : null;
  const topPick = topPickSource ? decorateProduct(topPickSource, answers, topPickRunnerUp, true) : null;

  const excludedIds = new Set<string>(topPick ? [topPick.id] : []);
  const categoryPicks = CATEGORY_ORDER
    .map((category) => {
      const winner = rankedProducts.find(
        (product) => product.category === category && !excludedIds.has(product.id),
      );

      if (!winner) {
        return null;
      }

      excludedIds.add(winner.id);
      const runnerUp = getCategoryRunnerUp(rankedProducts, category, winner.id, topPick?.id || null);
      return decorateProduct(winner, answers, runnerUp, false);
    })
    .filter(Boolean) as DecoratedRecommendationProduct[];

  const alternativeSource =
    options.includeAlternative
      ? rankedProducts.find((product) => !excludedIds.has(product.id)) || null
      : null;
  const alternativeRunnerUp = alternativeSource
    ? rankedProducts.find((product) => product.id !== alternativeSource.id && !excludedIds.has(product.id)) || null
    : null;
  const alternative = alternativeSource ? decorateProduct(alternativeSource, answers, alternativeRunnerUp, false) : null;

  return {
    topPick,
    categoryPicks,
    alternative,
    products: [
      ...(topPick ? [topPick] : []),
      ...categoryPicks,
      ...(alternative ? [alternative] : []),
    ],
    scoring: {
      version: "top-pick-v1",
      deterministic: true,
      weights: TOP_PICK_SCORING_WEIGHTS,
    },
  };
}
