import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TOP_PICK_SCORING_WEIGHTS,
  buildSunscreenExplanationContext,
  compareRankedProducts,
  filterSunscreenCandidates,
  normalizeRecommendationAnswers,
  pickTopSunscreen,
  scoreSunscreenProduct,
  scoreCanonicalProduct,
  type CanonicalRecommendationProduct,
  type RankedRecommendationProduct,
  type RecommendationAnswers,
  type SunscreenExplanationContext,
  type SunscreenRankedProduct,
  type SunscreenSelectionMeta,
} from "@/lib/recommendation-scoring";
import { resolveProductCategorySemantics } from "@/lib/product-category-normalizer";

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
    sunscreen?: SunscreenExplanationContext & {
      selection_meta?: SunscreenSelectionMeta | null;
    };
  };
};

function getStrictTopPickSlot(product: CanonicalRecommendationProduct | null | undefined): string {
  const semantics = resolveProductCategorySemantics({
    category: product?.category,
    product_form: product?.product_form ?? product?.productForm,
  });

  if (!semantics.authorizesRecommendationCategory) {
    return "";
  }

  return semantics.productFamily === "serum_ampoule"
    ? "serum"
    : semantics.productFamily || "";
}

export function matchesStrictTopPickCategory(
  category: string,
  product: CanonicalRecommendationProduct | null | undefined,
): boolean {
  return getStrictTopPickSlot(product) === category;
}

function isStrictTopPickEligibleProduct(product: CanonicalRecommendationProduct | null | undefined): boolean {
  return Boolean(product?.id && product?.name && product?.brand && getStrictTopPickSlot(product));
}

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
  sunscreenSelectionMeta: SunscreenSelectionMeta | null = null,
): DecoratedRecommendationProduct {
  const normalizedAnswers = normalizeRecommendationAnswers(answers);
  const {
    sunscreen_debug: _sunscreenDebug,
    sunscreen_selection_meta: productSelectionMeta,
    ...safeProduct
  } = product as SunscreenRankedProduct;
  const resolvedSunscreenSelectionMeta = sunscreenSelectionMeta || productSelectionMeta || null;
  const sunscreenContext =
    product.category === "sunscreen"
      ? buildSunscreenExplanationContext(product, normalizedAnswers)
      : null;

  return {
    ...safeProduct,
    step: CATEGORY_LABELS[product.category] || product.category,
    labels: buildLabels(product, featured),
    reason: buildReason(product),
    comparison_reason: buildComparisonReason(product, runnerUp),
    explanation_context: {
      concern: normalizedAnswers.mainConcern || null,
      preferredTexture: normalizedAnswers.preferredTexture || null,
      skinType: normalizedAnswers.skinType || null,
      ...(sunscreenContext
        ? {
            sunscreen: {
              ...sunscreenContext,
              selection_meta: resolvedSunscreenSelectionMeta,
            },
          }
        : {}),
    },
  };
}

function buildRankedProducts(
  answers: RecommendationAnswers,
  products: CanonicalRecommendationProduct[],
): RankedRecommendationProduct[] {
  return products
    .filter(isStrictTopPickEligibleProduct)
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
        matchesStrictTopPickCategory(category, product) &&
        product.id !== winnerId &&
        product.id !== topPickId,
    ) || null
  );
}

function buildAltPickSummary(
  topPick: RankedRecommendationProduct,
  altPick: RankedRecommendationProduct | null,
): SunscreenSelectionMeta["altPickSummary"] {
  if (!altPick) {
    return null;
  }

  return {
    id: altPick.id,
    name: altPick.name,
    brand: altPick.brand,
    uv_filter_type: altPick.uv_filter_type || null,
    scoreGap: topPick.score - altPick.score,
  };
}

function buildSunscreenCategoryWinner(
  answers: RecommendationAnswers,
  products: CanonicalRecommendationProduct[],
  rankedProducts: RankedRecommendationProduct[],
  excludedIds: Set<string>,
  topPickId: string | null,
): {
  winner: RankedRecommendationProduct;
  runnerUp: RankedRecommendationProduct | null;
  selectionMeta: SunscreenSelectionMeta | null;
} | null {
  const availableProducts = products.filter(
    (product) => matchesStrictTopPickCategory("sunscreen", product) && !excludedIds.has(product.id),
  );

  if (availableProducts.length === 0) {
    return null;
  }

  const normalizedAnswers = normalizeRecommendationAnswers(answers);
  const filteredCandidates = filterSunscreenCandidates(availableProducts, normalizedAnswers);

  if (filteredCandidates.strictCandidates.length > 0) {
    const strictPick = pickTopSunscreen(
      filteredCandidates.strictCandidates.map((product) =>
        scoreSunscreenProduct(product, normalizedAnswers),
      ),
    );

    if (strictPick.topPick) {
      return {
        winner: strictPick.topPick,
        runnerUp:
          strictPick.altPick ||
          getCategoryRunnerUp(rankedProducts, "sunscreen", strictPick.topPick.id, topPickId),
        selectionMeta: strictPick.meta,
      };
    }
  }

  if (filteredCandidates.penaltyOnlyCandidates.length > 0) {
    const penaltyOnlyPick = pickTopSunscreen(
      filteredCandidates.penaltyOnlyCandidates.map((product) =>
        scoreSunscreenProduct(product, normalizedAnswers),
      ),
    );

    if (penaltyOnlyPick.topPick) {
      return {
        winner: penaltyOnlyPick.topPick,
        runnerUp:
          penaltyOnlyPick.altPick ||
          getCategoryRunnerUp(rankedProducts, "sunscreen", penaltyOnlyPick.topPick.id, topPickId),
        selectionMeta: penaltyOnlyPick.meta,
      };
    }
  }

  const safetyRejectedIds = new Set(
    filteredCandidates.rejected
      .filter((product) =>
        (product.sunscreen_debug?.hardRejectReasons || []).some((reason) =>
          reason === "sensitive_high_irritation" || reason === "eye_sensitive_high_eye_sting",
        ),
      )
      .map((product) => product.id),
  );

  const generalCandidates = rankedProducts.filter(
    (product) =>
      matchesStrictTopPickCategory("sunscreen", product) &&
      !excludedIds.has(product.id) &&
      !safetyRejectedIds.has(product.id),
  );
  const generalTopPick = generalCandidates[0] || null;

  if (!generalTopPick) {
    return null;
  }

  const generalAltPick =
    generalCandidates[1] &&
    generalTopPick.score - generalCandidates[1].score <= 6 &&
    Boolean(generalTopPick.uv_filter_type) &&
    Boolean(generalCandidates[1].uv_filter_type) &&
    generalTopPick.uv_filter_type !== generalCandidates[1].uv_filter_type
      ? generalCandidates[1]
      : null;

  return {
    winner: generalTopPick,
    runnerUp:
      generalAltPick ||
      getCategoryRunnerUp(rankedProducts, "sunscreen", generalTopPick.id, topPickId),
    selectionMeta: {
      fallbackMode: "general",
      altPickSummary: buildAltPickSummary(generalTopPick, generalAltPick),
    },
  };
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
      if (category === "sunscreen") {
        const sunscreenSelection = buildSunscreenCategoryWinner(
          answers,
          products,
          rankedProducts,
          excludedIds,
          topPick?.id || null,
        );

        if (!sunscreenSelection) {
          return null;
        }

        excludedIds.add(sunscreenSelection.winner.id);
        return decorateProduct(
          sunscreenSelection.winner,
          answers,
          sunscreenSelection.runnerUp,
          false,
          sunscreenSelection.selectionMeta,
        );
      }

      const winner = rankedProducts.find(
        (product) => matchesStrictTopPickCategory(category, product) && !excludedIds.has(product.id),
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
