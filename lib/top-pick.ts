import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TOP_PICK_SCORING_WEIGHTS,
  buildSampleScoringInput,
  compareRankedProducts,
  normalizeCanonicalFinish,
  normalizeCanonicalTexture,
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
    labels.push("Concern Match");
  }

  if (product.matched_signals.matched_skin_type) {
    labels.push("Skin Match");
  }

  if (product.matched_signals.texture_match === "exact") {
    labels.push("Texture Match");
  } else if (product.matched_signals.texture_match === "near") {
    labels.push("Texture Near Match");
  }

  if (product.matched_signals.sensitivity_safe) {
    labels.push("Sensitive Safe");
  } else if (product.matched_signals.irritation_risk === "low") {
    labels.push("Low Irritation");
  }

  if (product.matched_signals.finish_match) {
    labels.push("Finish Match");
  }

  return labels.slice(0, featured ? 3 : 2);
}

function buildReason(product: RankedRecommendationProduct): string {
  if (product.why_picked.length > 0) {
    return product.why_picked.slice(0, 2).join(" ");
  }

  return `${product.brand} ${product.name} has the steadiest overall score profile for the current inputs.`;
}

function buildComparisonReason(
  product: RankedRecommendationProduct,
  runnerUp: RankedRecommendationProduct | null,
): string {
  if (!runnerUp) {
    return "It has the steadiest overall score balance for the current inputs.";
  }

  if (product.matched_signals.matched_concerns.length > runnerUp.matched_signals.matched_concerns.length) {
    return "It targets the main concern more directly, so the first visible difference should arrive sooner.";
  }

  if (product.score_breakdown.texture_match > runnerUp.score_breakdown.texture_match) {
    return "Its texture sits closer to the preferred feel, so layering should stay easier.";
  }

  if (product.score_breakdown.irritation_penalty > runnerUp.score_breakdown.irritation_penalty) {
    return "Its lower irritation risk makes the routine easier to keep using on reactive days.";
  }

  if (Number(product.matched_signals.sensitivity_safe) > Number(runnerUp.matched_signals.sensitivity_safe)) {
    return "Its sensitivity-safe profile lowers the risk of routine drop-off with repeat use.";
  }

  if (Number(product.matched_signals.finish_match) > Number(runnerUp.matched_signals.finish_match)) {
    return "Its finish sits closer to the preferred daily feel, so residue conflict should stay lower.";
  }

  return "Within the same category, its total score profile is still more stable for the current inputs.";
}

function decorateProduct(
  product: RankedRecommendationProduct,
  answers: RecommendationAnswers,
  runnerUp: RankedRecommendationProduct | null,
  featured = false,
): DecoratedRecommendationProduct {
  return {
    ...product,
    step: CATEGORY_LABELS[product.category] || product.category,
    labels: buildLabels(product, featured),
    reason: buildReason(product),
    comparison_reason: buildComparisonReason(product, runnerUp),
    explanation_context: {
      concern: answers.mainConcern || null,
      preferredTexture: answers.preferredTexture || null,
      skinType: answers.skinType || null,
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

export function buildSampleTopPickSelection() {
  const { answers, products } = buildSampleScoringInput();
  return buildTopPickBundleFromProducts(answers, products, {
    includeAlternative: true,
  });
}

export {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  normalizeCanonicalFinish,
  normalizeCanonicalTexture,
};
