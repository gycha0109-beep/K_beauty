export const CATEGORY_ORDER = [
  "cleanser",
  "toner_essence",
  "serum",
  "moisturizer",
  "sunscreen",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  cleanser: "Cleanser",
  toner_essence: "Toner / Essence",
  serum: "Serum",
  moisturizer: "Moisturizer",
  sunscreen: "Sunscreen",
};

export const TOP_PICK_SCORING_WEIGHTS = {
  skinTypeMatch: 4,
  concernOverlap: 6,
  categoryPriorityUnit: 2,
  lowIrritationBonus: 1,
  sensitivitySafeBonus: 2,
  sensitivitySafeHighBonus: 3,
  exactTextureMatch: 3,
  nearTextureMatch: 1,
  finishMatch: 1,
} as const;

const CATEGORY_PRIORITY_BY_CONCERN: Record<string, Record<string, number>> = {
  oiliness: { serum: 4, cleanser: 3, toner_essence: 2, moisturizer: 1, sunscreen: 1 },
  pores: { serum: 4, cleanser: 3, toner_essence: 2, moisturizer: 1, sunscreen: 1 },
  dehydration: { moisturizer: 4, toner_essence: 3, serum: 2, cleanser: 1, sunscreen: 1 },
  acne: { serum: 4, cleanser: 3, toner_essence: 2, moisturizer: 1, sunscreen: 1 },
  uneven_tone: { serum: 4, sunscreen: 3, toner_essence: 2, moisturizer: 1, cleanser: 1 },
  redness: { serum: 3, moisturizer: 3, toner_essence: 2, cleanser: 2, sunscreen: 1 },
  barrier: { moisturizer: 4, serum: 3, toner_essence: 3, cleanser: 2, sunscreen: 1 },
};

const TEXTURE_NEIGHBORS: Record<string, string[]> = {
  watery: ["gel"],
  gel: ["watery", "lotion"],
  lotion: ["gel", "cream"],
  cream: ["lotion"],
};

const IRRITATION_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export type RecommendationAnswers = {
  skinType?: string | null;
  sensitivity?: string | null;
  mainConcern?: string | null;
  preferredTexture?: string | null;
  postWashFeeling?: string | null;
  afternoonSkinChange?: string | null;
  mostDislikedFeel?: string | null;
  environmentExposure?: string[] | null;
  cleansingFrequency?: string | null;
};

export type CanonicalRecommendationProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  skin_types?: string[] | null;
  concerns?: string[] | null;
  texture?: string | null;
  finish?: string | null;
  irritation_risk?: string | null;
  sensitivity_safe?: boolean | null;
  is_kbeauty?: boolean | null;
  [key: string]: unknown;
};

export type MatchedSignals = {
  matched_skin_type: string | null;
  matched_concerns: string[];
  category_priority: number;
  irritation_risk: string;
  irritation_penalty: number;
  sensitivity_safe: boolean;
  texture_match: "exact" | "near" | "none";
  finish_match: boolean;
  preferred_finishes: string[];
};

export type ScoreBreakdown = {
  skin_type_match: number;
  concerns_overlap: number;
  category_priority: number;
  irritation_penalty: number;
  sensitivity_safe_bonus: number;
  texture_match: number;
  finish_match: number;
  total: number;
};

export type RankedRecommendationProduct = CanonicalRecommendationProduct & {
  score: number;
  why_picked: string[];
  matched_signals: MatchedSignals;
  score_breakdown: ScoreBreakdown;
};

function includesValue(list: unknown, value: string | null | undefined): boolean {
  return Array.isArray(list) && Boolean(value) && list.includes(value);
}

export function normalizeCanonicalTexture(value: string | null | undefined): string {
  if (value === "essence") {
    return "watery";
  }

  return value || "watery";
}

export function normalizeCanonicalFinish(value: string | null | undefined): string {
  if (value === "soft-matte" || value === "soft_matte" || value === "matte") {
    return "soft_matte";
  }

  if (value === "clean" || value === "calm") {
    return "natural";
  }

  return value || "natural";
}

export function getCategoryPriority(category: string, mainConcern: string | null | undefined): number {
  if (!mainConcern) {
    return 0;
  }

  return CATEGORY_PRIORITY_BY_CONCERN[mainConcern]?.[category] ?? 0;
}

function getPreferredFinishes(answers: RecommendationAnswers): string[] {
  const finishes = new Set<string>();
  const preferredTexture = normalizeCanonicalTexture(answers.preferredTexture || undefined);

  if (preferredTexture === "watery" || preferredTexture === "gel") {
    finishes.add("fresh");
    finishes.add("natural");
  }

  if (preferredTexture === "lotion") {
    finishes.add("natural");
    finishes.add("dewy");
  }

  if (preferredTexture === "cream") {
    finishes.add("dewy");
    finishes.add("natural");
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
    finishes.add("fresh");
    finishes.add("soft_matte");
  }

  if (finishes.size === 0) {
    finishes.add("natural");
  }

  return Array.from(finishes);
}

function getTextureMatch(
  productTexture: string | null | undefined,
  preferredTexture: string | null | undefined,
): "exact" | "near" | "none" {
  const normalizedProductTexture = normalizeCanonicalTexture(productTexture);
  const normalizedPreferredTexture = normalizeCanonicalTexture(preferredTexture);

  if (normalizedProductTexture === normalizedPreferredTexture) {
    return "exact";
  }

  if ((TEXTURE_NEIGHBORS[normalizedPreferredTexture] || []).includes(normalizedProductTexture)) {
    return "near";
  }

  return "none";
}

function getIrritationPenalty(answers: RecommendationAnswers, irritationRisk: string): number {
  const sensitivity = answers.sensitivity || "medium";

  if (sensitivity === "high") {
    if (irritationRisk === "high") {
      return -8;
    }

    if (irritationRisk === "medium") {
      return -4;
    }

    return TOP_PICK_SCORING_WEIGHTS.lowIrritationBonus;
  }

  if (sensitivity === "medium") {
    if (irritationRisk === "high") {
      return -5;
    }

    if (irritationRisk === "medium") {
      return -2;
    }

    return TOP_PICK_SCORING_WEIGHTS.lowIrritationBonus;
  }

  if (irritationRisk === "high") {
    return -3;
  }

  if (irritationRisk === "medium") {
    return -1;
  }

  return 0;
}

function getSensitivitySafeBonus(answers: RecommendationAnswers, sensitivitySafe: boolean): number {
  if (!sensitivitySafe) {
    return 0;
  }

  return answers.sensitivity === "high"
    ? TOP_PICK_SCORING_WEIGHTS.sensitivitySafeHighBonus
    : TOP_PICK_SCORING_WEIGHTS.sensitivitySafeBonus;
}

function buildWhyPicked(
  product: CanonicalRecommendationProduct,
  answers: RecommendationAnswers,
  signals: MatchedSignals,
): string[] {
  const reasons: string[] = [];

  if (signals.matched_concerns.length > 0) {
    reasons.push(`${product.category} is directly aligned with the current ${answers.mainConcern} priority.`);
  }

  if (signals.matched_skin_type) {
    reasons.push(`It stays compatible with ${signals.matched_skin_type} skin needs.`);
  }

  if (signals.texture_match === "exact") {
    reasons.push(`${normalizeCanonicalTexture(product.texture as string)} texture matches the preferred feel exactly.`);
  } else if (signals.texture_match === "near") {
    reasons.push(`${normalizeCanonicalTexture(product.texture as string)} texture stays close to the preferred feel.`);
  }

  if (signals.finish_match) {
    reasons.push(`${normalizeCanonicalFinish(product.finish as string)} finish is less likely to fight the current skin rhythm.`);
  }

  if (signals.sensitivity_safe) {
    reasons.push("Its sensitivity-safe profile lowers the barrier to repeat use.");
  } else if (signals.irritation_risk === "low") {
    reasons.push("Low irritation risk makes it easier to slot into the routine.");
  }

  if (signals.category_priority >= 3) {
    reasons.push(`This category is one of the fastest places to create visible change for ${answers.mainConcern}.`);
  }

  return reasons.slice(0, 4);
}

export function scoreCanonicalProduct(
  product: CanonicalRecommendationProduct,
  answers: RecommendationAnswers,
): RankedRecommendationProduct {
  const matchedConcerns = Array.isArray(product.concerns)
    ? product.concerns.filter((concern) => concern === answers.mainConcern)
    : [];
  const matchedSkinType =
    answers.skinType === "not_sure" || includesValue(product.skin_types, answers.skinType)
      ? String(answers.skinType || "combination")
      : null;
  const categoryPriority = getCategoryPriority(product.category, answers.mainConcern);
  const irritationRisk = String(product.irritation_risk || "medium");
  const sensitivitySafe = Boolean(product.sensitivity_safe);
  const preferredFinishes = getPreferredFinishes(answers);
  const textureMatch = getTextureMatch(product.texture as string, answers.preferredTexture);
  const finishMatch = preferredFinishes.includes(normalizeCanonicalFinish(product.finish as string));

  const breakdown: ScoreBreakdown = {
    skin_type_match: matchedSkinType ? TOP_PICK_SCORING_WEIGHTS.skinTypeMatch : 0,
    concerns_overlap: matchedConcerns.length * TOP_PICK_SCORING_WEIGHTS.concernOverlap,
    category_priority: categoryPriority * TOP_PICK_SCORING_WEIGHTS.categoryPriorityUnit,
    irritation_penalty: getIrritationPenalty(answers, irritationRisk),
    sensitivity_safe_bonus: getSensitivitySafeBonus(answers, sensitivitySafe),
    texture_match:
      textureMatch === "exact"
        ? TOP_PICK_SCORING_WEIGHTS.exactTextureMatch
        : textureMatch === "near"
          ? TOP_PICK_SCORING_WEIGHTS.nearTextureMatch
          : 0,
    finish_match: finishMatch ? TOP_PICK_SCORING_WEIGHTS.finishMatch : 0,
    total: 0,
  };

  breakdown.total =
    breakdown.skin_type_match +
    breakdown.concerns_overlap +
    breakdown.category_priority +
    breakdown.irritation_penalty +
    breakdown.sensitivity_safe_bonus +
    breakdown.texture_match +
    breakdown.finish_match;

  const matchedSignals: MatchedSignals = {
    matched_skin_type: matchedSkinType,
    matched_concerns: matchedConcerns,
    category_priority: categoryPriority,
    irritation_risk: irritationRisk,
    irritation_penalty: breakdown.irritation_penalty,
    sensitivity_safe: sensitivitySafe,
    texture_match: textureMatch,
    finish_match: finishMatch,
    preferred_finishes: preferredFinishes,
  };

  return {
    ...product,
    score: breakdown.total,
    why_picked: buildWhyPicked(product, answers, matchedSignals),
    matched_signals: matchedSignals,
    score_breakdown: breakdown,
  };
}

export function compareRankedProducts(
  left: RankedRecommendationProduct,
  right: RankedRecommendationProduct,
): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.matched_signals.matched_concerns.length !== left.matched_signals.matched_concerns.length) {
    return right.matched_signals.matched_concerns.length - left.matched_signals.matched_concerns.length;
  }

  if (right.matched_signals.category_priority !== left.matched_signals.category_priority) {
    return right.matched_signals.category_priority - left.matched_signals.category_priority;
  }

  if (Boolean(right.matched_signals.matched_skin_type) !== Boolean(left.matched_signals.matched_skin_type)) {
    return Number(Boolean(right.matched_signals.matched_skin_type)) - Number(Boolean(left.matched_signals.matched_skin_type));
  }

  if (right.score_breakdown.texture_match !== left.score_breakdown.texture_match) {
    return right.score_breakdown.texture_match - left.score_breakdown.texture_match;
  }

  if (Boolean(right.matched_signals.finish_match) !== Boolean(left.matched_signals.finish_match)) {
    return Number(Boolean(right.matched_signals.finish_match)) - Number(Boolean(left.matched_signals.finish_match));
  }

  if (Boolean(right.matched_signals.sensitivity_safe) !== Boolean(left.matched_signals.sensitivity_safe)) {
    return Number(Boolean(right.matched_signals.sensitivity_safe)) - Number(Boolean(left.matched_signals.sensitivity_safe));
  }

  if (IRRITATION_RANK[right.matched_signals.irritation_risk] !== IRRITATION_RANK[left.matched_signals.irritation_risk]) {
    return IRRITATION_RANK[left.matched_signals.irritation_risk] - IRRITATION_RANK[right.matched_signals.irritation_risk];
  }

  return left.name.localeCompare(right.name);
}

export function buildSampleScoringInput(): {
  answers: RecommendationAnswers;
  products: CanonicalRecommendationProduct[];
} {
  return {
    answers: {
      skinType: "combination",
      sensitivity: "high",
      mainConcern: "redness",
      preferredTexture: "gel",
      postWashFeeling: "tight",
      afternoonSkinChange: "red_or_irritated",
      mostDislikedFeel: "sticky",
      environmentExposure: ["mask"],
      cleansingFrequency: "2",
    },
    products: [
      {
        id: "sample-toner",
        name: "Calming Balance Toner",
        brand: "Sample Lab",
        category: "toner_essence",
        skin_types: ["combination", "sensitive"],
        concerns: ["redness", "barrier"],
        texture: "gel",
        finish: "natural",
        irritation_risk: "low",
        sensitivity_safe: true,
        is_kbeauty: true,
      },
      {
        id: "sample-serum",
        name: "Daily Trouble Serum",
        brand: "Sample Lab",
        category: "serum",
        skin_types: ["oily", "combination"],
        concerns: ["acne", "redness"],
        texture: "watery",
        finish: "fresh",
        irritation_risk: "medium",
        sensitivity_safe: false,
        is_kbeauty: true,
      },
    ],
  };
}
