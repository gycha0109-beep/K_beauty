export const CATEGORY_ORDER = [
  "cleanser",
  "toner_essence",
  "serum",
  "moisturizer",
  "sunscreen",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  cleanser: "클렌저",
  toner_essence: "토너 / 에센스",
  serum: "세럼",
  moisturizer: "보습제",
  sunscreen: "선크림",
};

Object.assign(CATEGORY_LABELS, {
  toner_pad: "토너 패드",
  ampoule: "앰플",
  essence: "에센스",
});

export const TOP_PICK_SCORING_WEIGHTS = {
  skinTypeMatch: 4,
  primaryConcernMatch: 12,
  secondaryConcernMatch: 8,
  categoryPriorityUnit: 2,
  tier2Penalty: -2,
  highSensitivityLowRiskBonus: 14,
  highSensitivityMediumRiskPenalty: -2,
  highSensitivityHighRiskPenalty: -14,
  mediumSensitivityLowRiskBonus: 4,
  mediumSensitivityMediumRiskPenalty: 0,
  mediumSensitivityHighRiskPenalty: -6,
  lowSensitivityLowRiskBonus: 2,
  lowSensitivityMediumRiskPenalty: 0,
  lowSensitivityHighRiskPenalty: -3,
  sensitivitySafeBonus: 2,
  sensitivitySafeHighBonus: 3,
  exactTextureMatch: 10,
  nearTextureMatch: 5,
  oppositeTexturePenalty: -6,
  finishMatch: 1,
  dislikedFeelStrongPenalty: -8,
  dislikedFeelMediumPenalty: -6,
  postCleanseAdjustment: 5,
  afternoonStateAdjustment: 4,
  outdoorSunscreenBonus: 3,
  verySensitiveLowIrritationBonus: 4,
  verySensitiveHighRiskPenalty: -4,
  verySensitiveConcernBonus: 2,
  verySensitiveSafeBonus: 2,
  femaleMensPenalty: -3,
  maleMensBonus: 1,
} as const;

const CATEGORY_PRIORITY_BY_CONCERN: Record<string, Record<string, number>> = {
  oiliness: { serum: 4, cleanser: 3, toner_essence: 2, moisturizer: 1, sunscreen: 1 },
  pores: { serum: 4, cleanser: 2, toner_essence: 2, moisturizer: 1, sunscreen: 1 },
  dehydration: { moisturizer: 4, toner_essence: 3, serum: 2, cleanser: 1, sunscreen: 1 },
  acne: { serum: 4, cleanser: 2, toner_essence: 2, moisturizer: 1, sunscreen: 1 },
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

const TEXTURE_OPPOSITES: Record<string, string[]> = {
  watery: ["cream"],
  gel: ["cream"],
  lotion: [],
  cream: ["watery", "gel"],
};

const IRRITATION_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

const TONER_FAMILY_CATEGORIES = new Set(["toner_essence", "toner_pad", "essence"]);
const SERUM_FAMILY_CATEGORIES = new Set(["serum", "ampoule"]);

const VERY_SENSITIVE_CONCERNS = new Set(["redness", "barrier", "dehydration"]);
const SUNSCREEN_INTENT_CONCERNS = new Set(["oiliness", "redness"]);

const CONCERN_LABELS: Record<string, string> = {
  oiliness: "유분",
  pores: "모공",
  dehydration: "수분 부족",
  acne: "트러블",
  uneven_tone: "톤 균일도",
  redness: "붉은기",
  barrier: "장벽",
};

const TEXTURE_LABELS: Record<string, string> = {
  watery: "워터리한 사용감",
  gel: "젤 타입 사용감",
  lotion: "로션 타입 사용감",
  cream: "크림 타입 사용감",
};

const FINISH_LABELS: Record<string, string> = {
  fresh: "산뜻한 마무리",
  natural: "내추럴한 마무리",
  dewy: "촉촉한 마무리",
  soft_matte: "보송한 마무리",
};

const SKIN_TYPE_LABELS: Record<string, string> = {
  oily: "지성 피부",
  dry: "건성 피부",
  combination: "복합성 피부",
  sensitive: "민감 피부",
  not_sure: "현재 피부",
};

export type RecommendationAnswers = {
  skinType?: string | null;
  sensitivity?: string | null;
  sensitivityLevel?: string | null;
  genderPreference?: "female" | "male" | "unspecified" | string | null;
  mainConcern?: string | null;
  mainConcerns?: string[] | null;
  concerns?: string[] | null;
  preferredTexture?: string | null;
  texturePreference?: string | null;
  postWashFeeling?: string | null;
  postCleanseFeel?: string | null;
  afternoonSkinChange?: string | null;
  afternoonState?: string | null;
  mostDislikedFeel?: string | null;
  dislikedFeel?: string | null;
  environmentExposure?: string[] | null;
  outdoorExposure?: boolean | null;
  cleansingFrequency?: string | null;
  sunscreenIntent?: boolean | null;
  explicitCategoryIntent?: string | null;
  verySensitivePeriod?: boolean | null;
  whiteCastHate?: boolean | null;
  toneUpWanted?: boolean | null;
  makeupUse?: boolean | null;
  eyeSensitive?: boolean | null;
};

export type NormalizedRecommendationAnswers = {
  skinType: string | null;
  sensitivity: string | null;
  genderPreference: "female" | "male" | "unspecified";
  mainConcern: string | null;
  mainConcerns: string[];
  preferredTexture: string | null;
  postWashFeeling: string | null;
  afternoonSkinChange: string | null;
  mostDislikedFeel: string | null;
  environmentExposure: string[];
  outdoorExposure: boolean;
  cleansingFrequency: string | null;
  sunscreenIntent: boolean;
  explicitCategoryIntent: string | null;
  verySensitivePeriod: boolean;
  whiteCastHate: boolean;
  toneUpWanted: boolean;
  makeupUse: boolean;
  eyeSensitive: boolean;
};

export type CanonicalRecommendationProduct = {
  id: string;
  name: string;
  brand: string;
  category: string;
  recommendation_tier?: string | null;
  is_mens?: boolean | null;
  skin_types?: string[] | null;
  concerns?: string[] | null;
  texture?: string | null;
  finish?: string | null;
  irritation_risk?: string | null;
  sensitivity_safe?: boolean | null;
  uv_filter_type?: "mineral" | "organic" | "hybrid" | null;
  tone_up?: boolean | null;
  white_cast?: "none" | "low" | "medium" | "high" | null;
  eye_sting?: "low" | "medium" | "high" | null;
  pilling_risk?: "low" | "medium" | "high" | null;
  review_signals?: Record<string, unknown> | null;
  is_kbeauty?: boolean | null;
  [key: string]: unknown;
};

export type MatchedSignals = {
  matched_skin_type: string | null;
  matched_concerns: string[];
  primary_concern: string | null;
  secondary_concern: string | null;
  matched_primary_concern: boolean;
  matched_secondary_concern: boolean;
  category_priority: number;
  irritation_risk: string;
  irritation_penalty: number;
  sensitivity_safe: boolean;
  texture_match: "exact" | "near" | "opposite" | "none";
  finish_match: boolean;
  preferred_finishes: string[];
  disliked_feel_conflict: boolean;
  outdoor_sunscreen_bonus: number;
  very_sensitive_period_bonus: number;
  gender_preference_adjustment: number;
};

export type ScoreBreakdown = {
  skin_type_match: number;
  primary_concern_match: number;
  secondary_concern_match: number;
  concerns_overlap: number;
  category_priority: number;
  recommendation_tier_penalty: number;
  gender_preference_adjustment: number;
  irritation_penalty: number;
  sensitivity_safe_bonus: number;
  texture_match: number;
  finish_match: number;
  disliked_feel_penalty: number;
  post_cleanse_adjustment: number;
  afternoon_state_adjustment: number;
  outdoor_sunscreen_bonus: number;
  very_sensitive_period_bonus: number;
  review_signal_score: number;
  total: number;
};

export type RankedRecommendationProduct = CanonicalRecommendationProduct & {
  score: number;
  why_picked: string[];
  matched_signals: MatchedSignals;
  score_breakdown: ScoreBreakdown;
  caution_note: string | null;
};

export type SunscreenExplanationContext = {
  matchedSkinType: boolean;
  matchedConcerns: string[];
  finishMatch: boolean;
  filterTypeMatch: boolean;
  toneUpFit: boolean | null;
  whiteCastFit: boolean | null;
  eyeStingFit: boolean | null;
  pillingFit: boolean | null;
  hardRejectReasons: string[];
  strongPenaltyReasons: string[];
};

export type SunscreenSelectionMeta = {
  fallbackMode: "strict" | "penalty_only" | "general";
  altPickSummary: {
    id: string;
    name: string;
    brand: string;
    uv_filter_type: string | null;
    scoreGap: number;
  } | null;
};

export type SunscreenRankedProduct = RankedRecommendationProduct & {
  sunscreen_debug?: {
    hardRejectReasons: string[];
    strongPenaltyReasons: string[];
    evaluationMode: "strict" | "penalty_only" | "general";
  };
  sunscreen_selection_meta?: SunscreenSelectionMeta | null;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const unique = new Set<string>();

  for (const value of values) {
    const normalized = normalizeString(value);

    if (normalized) {
      unique.add(normalized);
    }
  }

  return Array.from(unique);
}

function includesValue(list: unknown, value: string | null | undefined): boolean {
  return Array.isArray(list) && Boolean(value) && list.includes(value);
}

function getConcernList(answers: RecommendationAnswers): string[] {
  const mainConcerns = normalizeStringArray(answers.mainConcerns);

  if (mainConcerns.length > 0) {
    return mainConcerns.slice(0, 2);
  }

  const fallbackConcerns = normalizeStringArray(answers.concerns);

  if (fallbackConcerns.length > 0) {
    return fallbackConcerns.slice(0, 2);
  }

  const mainConcern = normalizeString(answers.mainConcern);
  return mainConcern ? [mainConcern] : [];
}

function getCategoryLabel(category: string | null | undefined): string {
  return CATEGORY_LABELS[category || ""] || category || "이 제품";
}

function getConcernLabel(concern: string | null | undefined): string {
  return CONCERN_LABELS[concern || ""] || concern || "피부 고민";
}

function getTextureLabel(texture: string | null | undefined): string {
  return TEXTURE_LABELS[normalizeCanonicalTexture(texture)] || "사용감";
}

function getFinishLabel(finish: string | null | undefined): string {
  return FINISH_LABELS[normalizeCanonicalFinish(finish)] || "마무리감";
}

function getSkinTypeLabel(skinType: string | null | undefined): string {
  return SKIN_TYPE_LABELS[skinType || ""] || skinType || "현재 피부";
}

function normalizeGenderPreference(
  value: RecommendationAnswers["genderPreference"],
): "female" | "male" | "unspecified" {
  if (value === "female" || value === "male") {
    return value;
  }

  return "unspecified";
}

export function normalizeRecommendationAnswers(
  answers: RecommendationAnswers,
): NormalizedRecommendationAnswers {
  const mainConcerns = getConcernList(answers);
  const environmentExposure = normalizeStringArray(answers.environmentExposure);
  const outdoorExposure =
    typeof answers.outdoorExposure === "boolean"
      ? answers.outdoorExposure
      : environmentExposure.includes("outdoor");

  return {
    skinType: normalizeString(answers.skinType),
    sensitivity: normalizeString(answers.sensitivityLevel || answers.sensitivity) || "medium",
    genderPreference: normalizeGenderPreference(answers.genderPreference),
    mainConcern: mainConcerns[0] || null,
    mainConcerns,
    preferredTexture:
      normalizeString(answers.texturePreference || answers.preferredTexture),
    postWashFeeling:
      normalizeString(answers.postCleanseFeel || answers.postWashFeeling),
    afternoonSkinChange:
      normalizeString(answers.afternoonState || answers.afternoonSkinChange),
    mostDislikedFeel:
      normalizeString(answers.dislikedFeel || answers.mostDislikedFeel),
    environmentExposure,
    outdoorExposure,
    cleansingFrequency: normalizeString(answers.cleansingFrequency),
    sunscreenIntent: Boolean(answers.sunscreenIntent),
    explicitCategoryIntent: normalizeString(answers.explicitCategoryIntent),
    verySensitivePeriod: Boolean(answers.verySensitivePeriod),
    whiteCastHate: Boolean(answers.whiteCastHate),
    toneUpWanted: Boolean(answers.toneUpWanted),
    makeupUse: Boolean(answers.makeupUse),
    eyeSensitive: Boolean(answers.eyeSensitive),
  };
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

export function getCategoryPriority(
  category: string,
  mainConcern: string | null | undefined,
): number {
  if (!mainConcern) {
    return 0;
  }

  return CATEGORY_PRIORITY_BY_CONCERN[mainConcern]?.[getCategorySlot(category)] ?? 0;
}

export function getCategorySlot(category: string | null | undefined): string {
  if (!category) {
    return "";
  }

  if (TONER_FAMILY_CATEGORIES.has(category)) {
    return "toner_essence";
  }

  return SERUM_FAMILY_CATEGORIES.has(category) ? "serum" : category;
}

export function matchesRecommendationCategorySlot(
  slot: string,
  category: string | null | undefined,
): boolean {
  return getCategorySlot(category) === slot;
}

function getPreferredFinishes(answers: NormalizedRecommendationAnswers): string[] {
  const finishes = new Set<string>();
  const preferredTexture = answers.preferredTexture
    ? normalizeCanonicalTexture(answers.preferredTexture)
    : null;

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

  if (answers.mostDislikedFeel === "drying") {
    finishes.add("natural");
    finishes.add("dewy");
  }

  if (finishes.size === 0) {
    finishes.add("natural");
  }

  return Array.from(finishes);
}

function getTextureMatch(
  productTexture: string | null | undefined,
  preferredTexture: string | null | undefined,
): "exact" | "near" | "opposite" | "none" {
  if (!preferredTexture) {
    return "none";
  }

  const normalizedProductTexture = normalizeCanonicalTexture(productTexture);
  const normalizedPreferredTexture = normalizeCanonicalTexture(preferredTexture);

  if (normalizedProductTexture === normalizedPreferredTexture) {
    return "exact";
  }

  if ((TEXTURE_NEIGHBORS[normalizedPreferredTexture] || []).includes(normalizedProductTexture)) {
    return "near";
  }

  if ((TEXTURE_OPPOSITES[normalizedPreferredTexture] || []).includes(normalizedProductTexture)) {
    return "opposite";
  }

  return "none";
}

function getTextureScore(textureMatch: MatchedSignals["texture_match"]): number {
  if (textureMatch === "exact") {
    return TOP_PICK_SCORING_WEIGHTS.exactTextureMatch;
  }

  if (textureMatch === "near") {
    return TOP_PICK_SCORING_WEIGHTS.nearTextureMatch;
  }

  if (textureMatch === "opposite") {
    return TOP_PICK_SCORING_WEIGHTS.oppositeTexturePenalty;
  }

  return 0;
}

function getIrritationPenalty(
  answers: NormalizedRecommendationAnswers,
  irritationRisk: string,
): number {
  const sensitivity = answers.sensitivity || "medium";

  if (sensitivity === "high") {
    if (irritationRisk === "low") {
      return TOP_PICK_SCORING_WEIGHTS.highSensitivityLowRiskBonus;
    }

    if (irritationRisk === "medium") {
      return TOP_PICK_SCORING_WEIGHTS.highSensitivityMediumRiskPenalty;
    }

    return TOP_PICK_SCORING_WEIGHTS.highSensitivityHighRiskPenalty;
  }

  if (sensitivity === "medium") {
    if (irritationRisk === "low") {
      return TOP_PICK_SCORING_WEIGHTS.mediumSensitivityLowRiskBonus;
    }

    if (irritationRisk === "medium") {
      return TOP_PICK_SCORING_WEIGHTS.mediumSensitivityMediumRiskPenalty;
    }

    return TOP_PICK_SCORING_WEIGHTS.mediumSensitivityHighRiskPenalty;
  }

  if (irritationRisk === "low") {
    return TOP_PICK_SCORING_WEIGHTS.lowSensitivityLowRiskBonus;
  }

  if (irritationRisk === "medium") {
    return TOP_PICK_SCORING_WEIGHTS.lowSensitivityMediumRiskPenalty;
  }

  return TOP_PICK_SCORING_WEIGHTS.lowSensitivityHighRiskPenalty;
}

function getSensitivitySafeBonus(
  answers: NormalizedRecommendationAnswers,
  sensitivitySafe: boolean,
): number {
  if (!sensitivitySafe) {
    return 0;
  }

  return answers.sensitivity === "high"
    ? TOP_PICK_SCORING_WEIGHTS.sensitivitySafeHighBonus
    : TOP_PICK_SCORING_WEIGHTS.sensitivitySafeBonus;
}

function getRecommendationTierPenalty(product: CanonicalRecommendationProduct): number {
  return product.recommendation_tier === "Tier2"
    ? TOP_PICK_SCORING_WEIGHTS.tier2Penalty
    : 0;
}

function getGenderPreferenceAdjustment(
  answers: NormalizedRecommendationAnswers,
  product: CanonicalRecommendationProduct,
): number {
  if (product.is_mens !== true) {
    return 0;
  }

  if (answers.genderPreference === "female") {
    return TOP_PICK_SCORING_WEIGHTS.femaleMensPenalty;
  }

  if (answers.genderPreference === "male") {
    return TOP_PICK_SCORING_WEIGHTS.maleMensBonus;
  }

  return 0;
}

function hasExplicitSunscreenIntent(answers: NormalizedRecommendationAnswers): boolean {
  return answers.sunscreenIntent || answers.explicitCategoryIntent === "sunscreen";
}

function getOutdoorSunscreenBonus(
  answers: NormalizedRecommendationAnswers,
  product: CanonicalRecommendationProduct,
): number {
  if (product.category !== "sunscreen" || !answers.outdoorExposure) {
    return 0;
  }

  const sunscreenIntentByConcern = answers.mainConcerns.some((concern) =>
    SUNSCREEN_INTENT_CONCERNS.has(concern),
  );

  if (!sunscreenIntentByConcern && !hasExplicitSunscreenIntent(answers)) {
    return 0;
  }

  return TOP_PICK_SCORING_WEIGHTS.outdoorSunscreenBonus;
}

function getDislikedFeelPenalty(
  product: CanonicalRecommendationProduct,
  dislikedFeel: string | null,
): number {
  if (!dislikedFeel) {
    return 0;
  }

  const texture = normalizeCanonicalTexture(product.texture as string);
  const finish = normalizeCanonicalFinish(product.finish as string);

  if (dislikedFeel === "sticky") {
    return finish === "dewy" || texture === "cream"
      ? TOP_PICK_SCORING_WEIGHTS.dislikedFeelStrongPenalty
      : 0;
  }

  if (dislikedFeel === "greasy") {
    return finish === "dewy" || texture === "cream"
      ? TOP_PICK_SCORING_WEIGHTS.dislikedFeelStrongPenalty
      : 0;
  }

  if (dislikedFeel === "heavy") {
    return texture === "cream"
      ? TOP_PICK_SCORING_WEIGHTS.dislikedFeelMediumPenalty
      : 0;
  }

  if (dislikedFeel === "drying") {
    return finish === "fresh" || finish === "soft_matte"
      ? TOP_PICK_SCORING_WEIGHTS.dislikedFeelMediumPenalty
      : 0;
  }

  return 0;
}

function getConcernMatchScore(
  productConcerns: string[],
  answers: NormalizedRecommendationAnswers,
): {
  matchedConcerns: string[];
  primaryConcernMatch: number;
  secondaryConcernMatch: number;
  matchedPrimaryConcern: boolean;
  matchedSecondaryConcern: boolean;
} {
  const primaryConcern = answers.mainConcerns[0] || null;
  const secondaryConcern = answers.mainConcerns[1] || null;
  const matchedConcerns: string[] = [];

  let primaryConcernMatch = 0;
  let secondaryConcernMatch = 0;

  if (primaryConcern && productConcerns.includes(primaryConcern)) {
    matchedConcerns.push(primaryConcern);
    primaryConcernMatch = TOP_PICK_SCORING_WEIGHTS.primaryConcernMatch;
  }

  if (
    secondaryConcern &&
    secondaryConcern !== primaryConcern &&
    productConcerns.includes(secondaryConcern)
  ) {
    matchedConcerns.push(secondaryConcern);
    secondaryConcernMatch = TOP_PICK_SCORING_WEIGHTS.secondaryConcernMatch;
  }

  return {
    matchedConcerns,
    primaryConcernMatch,
    secondaryConcernMatch,
    matchedPrimaryConcern: primaryConcernMatch > 0,
    matchedSecondaryConcern: secondaryConcernMatch > 0,
  };
}

function getPostCleanseAdjustment(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
): number {
  const concerns = Array.isArray(product.concerns) ? product.concerns : [];

  if (
    answers.postWashFeeling === "tight" &&
    (concerns.includes("dehydration") || concerns.includes("barrier"))
  ) {
    return TOP_PICK_SCORING_WEIGHTS.postCleanseAdjustment;
  }

  if (
    answers.postWashFeeling === "still_oily" &&
    (concerns.includes("oiliness") || concerns.includes("pores"))
  ) {
    return TOP_PICK_SCORING_WEIGHTS.postCleanseAdjustment;
  }

  return 0;
}

function getAfternoonStateAdjustment(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  irritationRisk: string,
  sensitivitySafe: boolean,
): number {
  const concerns = Array.isArray(product.concerns) ? product.concerns : [];

  if (
    answers.afternoonSkinChange === "more_oily" &&
    (concerns.includes("oiliness") || concerns.includes("pores"))
  ) {
    return TOP_PICK_SCORING_WEIGHTS.afternoonStateAdjustment;
  }

  if (
    answers.afternoonSkinChange === "more_dry" &&
    (concerns.includes("dehydration") || concerns.includes("barrier"))
  ) {
    return TOP_PICK_SCORING_WEIGHTS.afternoonStateAdjustment;
  }

  if (answers.afternoonSkinChange === "red_or_irritated") {
    if (concerns.includes("redness") || concerns.includes("barrier")) {
      return TOP_PICK_SCORING_WEIGHTS.afternoonStateAdjustment;
    }

    if (sensitivitySafe || irritationRisk === "low") {
      return Math.max(2, TOP_PICK_SCORING_WEIGHTS.afternoonStateAdjustment - 1);
    }
  }

  return 0;
}

function getVerySensitivePeriodBonus(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  irritationRisk: string,
  sensitivitySafe: boolean,
): number {
  if (!answers.verySensitivePeriod) {
    return 0;
  }

  const concerns = Array.isArray(product.concerns) ? product.concerns : [];
  let score = 0;

  if (irritationRisk === "low") {
    score += TOP_PICK_SCORING_WEIGHTS.verySensitiveLowIrritationBonus;
  } else if (irritationRisk === "high") {
    score += TOP_PICK_SCORING_WEIGHTS.verySensitiveHighRiskPenalty;
  }

  if (sensitivitySafe) {
    score += TOP_PICK_SCORING_WEIGHTS.verySensitiveSafeBonus;
  }

  if (concerns.some((concern) => VERY_SENSITIVE_CONCERNS.has(concern))) {
    score += TOP_PICK_SCORING_WEIGHTS.verySensitiveConcernBonus;
  }

  return score;
}

function buildWhyPicked(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  signals: MatchedSignals,
  breakdown: ScoreBreakdown,
): string[] {
  const reasons: string[] = [];
  const primaryConcern = answers.mainConcerns[0] || answers.mainConcern;
  const secondaryConcern = answers.mainConcerns[1] || null;
  const categoryLabel = getCategoryLabel(product.category);

  if (signals.matched_primary_concern && signals.matched_secondary_concern && primaryConcern && secondaryConcern) {
    reasons.push(
      `이 ${categoryLabel}은 ${getConcernLabel(primaryConcern)}을 우선으로 보면서 ${getConcernLabel(secondaryConcern)}까지 함께 챙기기 좋습니다.`,
    );
  } else if (signals.matched_primary_concern && primaryConcern) {
    reasons.push(`이 ${categoryLabel}은 ${getConcernLabel(primaryConcern)} 고민에 가장 먼저 손이 가기 좋은 축입니다.`);
  } else if (signals.matched_secondary_concern && secondaryConcern) {
    reasons.push(`${getConcernLabel(secondaryConcern)} 고민도 루틴 흐름을 해치지 않고 함께 보완해 줍니다.`);
  }

  if (signals.matched_skin_type) {
    reasons.push(`${getSkinTypeLabel(signals.matched_skin_type)} 쪽에 무리 없이 맞춰가기 좋습니다.`);
  }

  if (signals.texture_match === "exact") {
    reasons.push(`${getTextureLabel(product.texture as string)}이 선호 사용감과 정확히 맞습니다.`);
  } else if (signals.texture_match === "near") {
    reasons.push(`${getTextureLabel(product.texture as string)}이 선호 사용감과 꽤 가깝습니다.`);
  }

  if (breakdown.post_cleanse_adjustment > 0 && answers.postWashFeeling === "tight") {
    reasons.push("세안 직후 당김이 올라오는 패턴에 맞춰, 루틴이 너무 무겁게 가지 않게 잡아줍니다.");
  } else if (breakdown.post_cleanse_adjustment > 0 && answers.postWashFeeling === "still_oily") {
    reasons.push("세안 후에도 유분감이 남는 패턴에서 답답함을 더하지 않는 쪽입니다.");
  }

  if (breakdown.afternoon_state_adjustment > 0 && answers.afternoonSkinChange === "more_oily") {
    reasons.push("오후에 유분이 다시 올라오는 흐름을 더 깔끔하게 받쳐줍니다.");
  } else if (breakdown.afternoon_state_adjustment > 0 && answers.afternoonSkinChange === "more_dry") {
    reasons.push("시간이 갈수록 건조해지는 흐름을 루틴이 비기 전에 미리 받쳐줍니다.");
  } else if (breakdown.afternoon_state_adjustment > 0 && answers.afternoonSkinChange === "red_or_irritated") {
    reasons.push("오후에 예민해지는 날에도 비교적 무리 없이 이어가기 쉽습니다.");
  }

  if (signals.outdoor_sunscreen_bonus > 0) {
    reasons.push("야외 노출이 있는 패턴이라 낮 시간 보호가 더 중요하게 반영됐습니다.");
  }

  if (answers.verySensitivePeriod && signals.very_sensitive_period_bonus > 0) {
    reasons.push("유독 예민한 시기에도 상대적으로 꾸준히 쓰기 쉬운 안전축을 가졌습니다.");
  } else if (signals.sensitivity_safe) {
    reasons.push("민감 피부 쪽에서도 반복 사용 허들이 비교적 낮습니다.");
  } else if (signals.irritation_risk === "low" && answers.sensitivity === "high") {
    reasons.push("지금은 민감도가 높아서 저자극 축이 평소보다 더 중요하게 작동합니다.");
  } else if (signals.irritation_risk === "low") {
    reasons.push("자극 리스크가 낮아 현재 루틴에 넣기 수월합니다.");
  }

  if (signals.finish_match) {
    reasons.push(`${getFinishLabel(product.finish as string)}이 지금 피부 리듬과 크게 부딪히지 않습니다.`);
  }

  return reasons.slice(0, 4);
}

function buildCautionNote(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  signals: MatchedSignals,
): string | null {
  const texture = normalizeCanonicalTexture(product.texture as string);
  const finish = normalizeCanonicalFinish(product.finish as string);

  if (signals.disliked_feel_conflict && answers.mostDislikedFeel === "sticky") {
    return "끈적이는 잔여감이 특히 싫다면 약간 부담스럽게 느껴질 수 있습니다.";
  }

  if (signals.disliked_feel_conflict && answers.mostDislikedFeel === "greasy") {
    return "번들거리는 마무리가 가장 거슬리는 편이면 조금 무겁게 느껴질 수 있습니다.";
  }

  if (signals.disliked_feel_conflict && answers.mostDislikedFeel === "heavy") {
    return "반복 사용 시 선호보다 조금 무겁게 느껴질 수 있습니다.";
  }

  if (signals.disliked_feel_conflict && answers.mostDislikedFeel === "drying") {
    return "이미 쉽게 건조해지는 편이라면 마무리가 다소 산뜻하게 느껴질 수 있습니다.";
  }

  if (signals.texture_match === "opposite") {
    return `${getTextureLabel(texture)}이 점수상 인상보다 체감 선호와는 더 멀 수 있습니다.`;
  }

  if (
    (answers.sensitivity === "high" || answers.verySensitivePeriod) &&
    signals.irritation_risk === "medium"
  ) {
    return "지금도 사용은 가능하지만, 현재 컨디션에서는 더 저자극인 선택지가 반복 사용에는 더 편할 수 있습니다.";
  }

  if (
    (answers.sensitivity === "high" || answers.verySensitivePeriod) &&
    signals.irritation_risk === "high"
  ) {
    return `예민한 날에는 ${getFinishLabel(finish)}보다 자극 리스크를 더 우선해서 보는 편이 안전합니다.`;
  }

  return null;
}

export function scoreCanonicalProduct(
  product: CanonicalRecommendationProduct,
  rawAnswers: RecommendationAnswers,
): RankedRecommendationProduct {
  const answers = normalizeRecommendationAnswers(rawAnswers);
  const productConcerns = Array.isArray(product.concerns) ? product.concerns : [];
  const concernMatch = getConcernMatchScore(productConcerns, answers);
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
  const dislikedFeelPenalty = getDislikedFeelPenalty(product, answers.mostDislikedFeel);
  const recommendationTierPenalty = getRecommendationTierPenalty(product);
  const genderPreferenceAdjustment = getGenderPreferenceAdjustment(answers, product);
  const postCleanseAdjustment = getPostCleanseAdjustment(product, answers);
  const afternoonStateAdjustment = getAfternoonStateAdjustment(
    product,
    answers,
    irritationRisk,
    sensitivitySafe,
  );
  const outdoorSunscreenBonus = getOutdoorSunscreenBonus(answers, product);
  const verySensitivePeriodBonus = getVerySensitivePeriodBonus(
    product,
    answers,
    irritationRisk,
    sensitivitySafe,
  );

  const breakdown: ScoreBreakdown = {
    skin_type_match: matchedSkinType ? TOP_PICK_SCORING_WEIGHTS.skinTypeMatch : 0,
    primary_concern_match: concernMatch.primaryConcernMatch,
    secondary_concern_match: concernMatch.secondaryConcernMatch,
    concerns_overlap:
      concernMatch.primaryConcernMatch + concernMatch.secondaryConcernMatch,
    category_priority: categoryPriority * TOP_PICK_SCORING_WEIGHTS.categoryPriorityUnit,
    recommendation_tier_penalty: recommendationTierPenalty,
    gender_preference_adjustment: genderPreferenceAdjustment,
    irritation_penalty: getIrritationPenalty(answers, irritationRisk),
    sensitivity_safe_bonus: getSensitivitySafeBonus(answers, sensitivitySafe),
    texture_match: getTextureScore(textureMatch),
    finish_match: finishMatch ? TOP_PICK_SCORING_WEIGHTS.finishMatch : 0,
    disliked_feel_penalty: dislikedFeelPenalty,
    post_cleanse_adjustment: postCleanseAdjustment,
    afternoon_state_adjustment: afternoonStateAdjustment,
    outdoor_sunscreen_bonus: outdoorSunscreenBonus,
    very_sensitive_period_bonus: verySensitivePeriodBonus,
    review_signal_score: 0,
    total: 0,
  };

  breakdown.total =
    breakdown.skin_type_match +
    breakdown.concerns_overlap +
    breakdown.category_priority +
    breakdown.recommendation_tier_penalty +
    breakdown.gender_preference_adjustment +
    breakdown.irritation_penalty +
    breakdown.sensitivity_safe_bonus +
    breakdown.texture_match +
    breakdown.finish_match +
    breakdown.disliked_feel_penalty +
    breakdown.post_cleanse_adjustment +
    breakdown.afternoon_state_adjustment +
    breakdown.outdoor_sunscreen_bonus +
    breakdown.very_sensitive_period_bonus;

  const matchedSignals: MatchedSignals = {
    matched_skin_type: matchedSkinType,
    matched_concerns: concernMatch.matchedConcerns,
    primary_concern: answers.mainConcerns[0] || null,
    secondary_concern: answers.mainConcerns[1] || null,
    matched_primary_concern: concernMatch.matchedPrimaryConcern,
    matched_secondary_concern: concernMatch.matchedSecondaryConcern,
    category_priority: categoryPriority,
    irritation_risk: irritationRisk,
    irritation_penalty: breakdown.irritation_penalty,
    sensitivity_safe: sensitivitySafe,
    texture_match: textureMatch,
    finish_match: finishMatch,
    preferred_finishes: preferredFinishes,
    disliked_feel_conflict: dislikedFeelPenalty < 0,
    outdoor_sunscreen_bonus: outdoorSunscreenBonus,
    very_sensitive_period_bonus: verySensitivePeriodBonus,
    gender_preference_adjustment: genderPreferenceAdjustment,
  };

  return {
    ...product,
    score: breakdown.total,
    why_picked: buildWhyPicked(product, answers, matchedSignals, breakdown),
    matched_signals: matchedSignals,
    score_breakdown: breakdown,
    caution_note: buildCautionNote(product, answers, matchedSignals),
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

  if (right.score_breakdown.texture_match !== left.score_breakdown.texture_match) {
    return right.score_breakdown.texture_match - left.score_breakdown.texture_match;
  }

  if (right.score_breakdown.disliked_feel_penalty !== left.score_breakdown.disliked_feel_penalty) {
    return right.score_breakdown.disliked_feel_penalty - left.score_breakdown.disliked_feel_penalty;
  }

  if (right.matched_signals.category_priority !== left.matched_signals.category_priority) {
    return right.matched_signals.category_priority - left.matched_signals.category_priority;
  }

  if (Boolean(right.matched_signals.matched_skin_type) !== Boolean(left.matched_signals.matched_skin_type)) {
    return Number(Boolean(right.matched_signals.matched_skin_type)) - Number(Boolean(left.matched_signals.matched_skin_type));
  }

  if (Boolean(right.matched_signals.finish_match) !== Boolean(left.matched_signals.finish_match)) {
    return Number(Boolean(right.matched_signals.finish_match)) - Number(Boolean(left.matched_signals.finish_match));
  }

  if (Boolean(right.matched_signals.sensitivity_safe) !== Boolean(left.matched_signals.sensitivity_safe)) {
    return Number(Boolean(right.matched_signals.sensitivity_safe)) - Number(Boolean(left.matched_signals.sensitivity_safe));
  }

  if (right.matched_signals.very_sensitive_period_bonus !== left.matched_signals.very_sensitive_period_bonus) {
    return right.matched_signals.very_sensitive_period_bonus - left.matched_signals.very_sensitive_period_bonus;
  }

  if (IRRITATION_RANK[right.matched_signals.irritation_risk] !== IRRITATION_RANK[left.matched_signals.irritation_risk]) {
    return IRRITATION_RANK[left.matched_signals.irritation_risk] - IRRITATION_RANK[right.matched_signals.irritation_risk];
  }

  return left.name.localeCompare(right.name);
}

type FilterableSunscreenProduct = CanonicalRecommendationProduct & {
  sunscreen_debug?: SunscreenRankedProduct["sunscreen_debug"];
};

function normalizeSunscreenAnswers(
  user: RecommendationAnswers | NormalizedRecommendationAnswers,
): NormalizedRecommendationAnswers {
  return normalizeRecommendationAnswers(user as RecommendationAnswers);
}

function getPrimaryConcern(answers: NormalizedRecommendationAnswers): string | null {
  return answers.mainConcerns[0] || answers.mainConcern || null;
}

function getSecondaryConcern(answers: NormalizedRecommendationAnswers): string | null {
  return answers.mainConcerns[1] || null;
}

function isSensitiveSunscreenUser(answers: NormalizedRecommendationAnswers): boolean {
  return (
    answers.sensitivity === "high" ||
    answers.skinType === "sensitive" ||
    answers.verySensitivePeriod ||
    answers.mainConcern === "redness" ||
    answers.mainConcern === "barrier"
  );
}

function getExpectedSunscreenFinish(
  answers: NormalizedRecommendationAnswers,
): "fresh" | "dewy" | "natural" | null {
  const primaryConcern = getPrimaryConcern(answers);
  const preferredFinishes = getPreferredFinishes(answers);

  if (answers.skinType === "oily" && primaryConcern !== "dehydration") {
    return "fresh";
  }

  if (
    answers.skinType === "dry" ||
    answers.postWashFeeling === "tight" ||
    answers.afternoonSkinChange === "more_dry"
  ) {
    return "dewy";
  }

  if (preferredFinishes.includes("fresh")) {
    return "fresh";
  }

  if (preferredFinishes.includes("dewy")) {
    return "dewy";
  }

  if (preferredFinishes.includes("natural")) {
    return "natural";
  }

  return null;
}

function getExpectedSunscreenFilterType(
  answers: NormalizedRecommendationAnswers,
): CanonicalRecommendationProduct["uv_filter_type"] {
  if (answers.whiteCastHate && !answers.toneUpWanted) {
    return "organic";
  }

  if (answers.toneUpWanted) {
    return isSensitiveSunscreenUser(answers) ? "hybrid" : "mineral";
  }

  if (isSensitiveSunscreenUser(answers) || answers.eyeSensitive) {
    return "hybrid";
  }

  return null;
}

function getSunscreenHardRejectReasons(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  evaluationMode: "strict" | "penalty_only" = "strict",
): string[] {
  const reasons: string[] = [];
  const primaryConcern = getPrimaryConcern(answers);

  if (isSensitiveSunscreenUser(answers) && product.irritation_risk === "high") {
    reasons.push("sensitive_high_irritation");
  }

  if (answers.eyeSensitive && product.eye_sting === "high") {
    reasons.push("eye_sensitive_high_eye_sting");
  }

  if (evaluationMode === "strict") {
    if (!answers.toneUpWanted && answers.whiteCastHate && product.white_cast === "high") {
      reasons.push("white_cast_high");
    }

    if (answers.makeupUse && product.pilling_risk === "high") {
      reasons.push("makeup_high_pilling");
    }

    if (
      answers.skinType === "dry" &&
      primaryConcern !== "oiliness" &&
      normalizeCanonicalFinish(product.finish as string) === "soft_matte"
    ) {
      reasons.push("dry_soft_matte_conflict");
    }
  }

  return reasons;
}

function getSunscreenStrongPenaltyReasons(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  evaluationMode: "strict" | "penalty_only" = "strict",
): string[] {
  const reasons: string[] = [];
  const primaryConcern = getPrimaryConcern(answers);
  const finish = normalizeCanonicalFinish(product.finish as string);

  if (answers.skinType === "oily" && primaryConcern !== "dehydration" && finish === "dewy") {
    reasons.push("oily_dewy_conflict");
  }

  if (!answers.toneUpWanted && product.tone_up === true) {
    reasons.push("tone_up_mismatch");
  }

  if (answers.whiteCastHate && product.white_cast === "medium") {
    reasons.push("white_cast_medium");
  }

  if (answers.eyeSensitive && product.eye_sting === "medium") {
    reasons.push("eye_sting_medium");
  }

  if (answers.makeupUse && product.pilling_risk === "medium") {
    reasons.push("pilling_medium");
  }

  if (evaluationMode === "penalty_only") {
    if (!answers.toneUpWanted && answers.whiteCastHate && product.white_cast === "high") {
      reasons.push("white_cast_high");
    }

    if (answers.makeupUse && product.pilling_risk === "high") {
      reasons.push("makeup_high_pilling");
    }

    if (
      answers.skinType === "dry" &&
      primaryConcern !== "oiliness" &&
      finish === "soft_matte"
    ) {
      reasons.push("dry_soft_matte_conflict");
    }
  }

  return Array.from(new Set(reasons));
}

function getSunscreenStrongPenaltyScore(reasons: string[]): number {
  return reasons.reduce((total, reason) => {
    if (reason === "oily_dewy_conflict") {
      return total - 10;
    }

    if (reason === "dry_soft_matte_conflict") {
      return total - 12;
    }

    return total;
  }, 0);
}

function getSunscreenWhiteCastScore(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
): number {
  if (!answers.whiteCastHate) {
    return 0;
  }

  if (product.white_cast === "none") {
    return 10;
  }

  if (product.white_cast === "low") {
    return 4;
  }

  if (product.white_cast === "medium") {
    return -8;
  }

  if (product.white_cast === "high") {
    return -20;
  }

  return 0;
}

function getSunscreenEyeStingScore(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
): number {
  if (!answers.eyeSensitive) {
    return 0;
  }

  if (product.eye_sting === "low") {
    return 8;
  }

  if (product.eye_sting === "medium") {
    return -6;
  }

  if (product.eye_sting === "high") {
    return -20;
  }

  return 0;
}

function getSunscreenPillingScore(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
): number {
  if (!answers.makeupUse) {
    return 0;
  }

  if (product.pilling_risk === "low") {
    return 8;
  }

  if (product.pilling_risk === "medium") {
    return -4;
  }

  if (product.pilling_risk === "high") {
    return -16;
  }

  return 0;
}

function buildSunscreenWhyPicked(
  product: CanonicalRecommendationProduct,
  answers: NormalizedRecommendationAnswers,
  context: SunscreenExplanationContext,
): string[] {
  const reasons: string[] = [];

  if (context.matchedSkinType) {
    reasons.push("Texture and finish stay closer to this skin type's daily sunscreen comfort range.");
  }

  if (context.matchedConcerns.length > 0) {
    reasons.push(
      `Matches the current sunscreen priority around ${context.matchedConcerns.slice(0, 2).join(" and ")}.`,
    );
  }

  if (context.finishMatch) {
    reasons.push(
      `The ${normalizeCanonicalFinish(product.finish as string)} finish stays closer to the current wear preference.`,
    );
  }

  if (answers.whiteCastHate && context.whiteCastFit === true) {
    reasons.push("White cast stays lower, so it is easier to repeat during the day.");
  } else if (answers.eyeSensitive && context.eyeStingFit === true) {
    reasons.push("Eye-area sting risk stays lower for repeatable daytime wear.");
  } else if (answers.makeupUse && context.pillingFit === true) {
    reasons.push("Layering risk stays lower when sunscreen needs to sit under makeup.");
  } else if (answers.toneUpWanted && context.toneUpFit === true) {
    reasons.push("Tone-up effect is present without pushing the finish too far off daily wear.");
  }

  return reasons.slice(0, 4);
}

export function filterSunscreenCandidates(
  products: CanonicalRecommendationProduct[],
  user: RecommendationAnswers | NormalizedRecommendationAnswers,
): {
  strictCandidates: FilterableSunscreenProduct[];
  penaltyOnlyCandidates: FilterableSunscreenProduct[];
  rejected: FilterableSunscreenProduct[];
} {
  const answers = normalizeSunscreenAnswers(user);
  const strictCandidates: FilterableSunscreenProduct[] = [];
  const penaltyOnlyCandidates: FilterableSunscreenProduct[] = [];
  const rejected: FilterableSunscreenProduct[] = [];

  for (const product of products.filter((item) => item.category === "sunscreen")) {
    const strictHardRejectReasons = getSunscreenHardRejectReasons(product, answers, "strict");
    const strictStrongPenaltyReasons = getSunscreenStrongPenaltyReasons(product, answers, "strict");
    const penaltyOnlyHardRejectReasons = getSunscreenHardRejectReasons(product, answers, "penalty_only");
    const penaltyOnlyStrongPenaltyReasons = getSunscreenStrongPenaltyReasons(product, answers, "penalty_only");

    if (strictHardRejectReasons.length === 0) {
      strictCandidates.push({
        ...product,
        sunscreen_debug: {
          hardRejectReasons: [],
          strongPenaltyReasons: strictStrongPenaltyReasons,
          evaluationMode: "strict",
        },
      });
    } else {
      rejected.push({
        ...product,
        sunscreen_debug: {
          hardRejectReasons: strictHardRejectReasons,
          strongPenaltyReasons: strictStrongPenaltyReasons,
          evaluationMode: "strict",
        },
      });
    }

    if (penaltyOnlyHardRejectReasons.length === 0) {
      penaltyOnlyCandidates.push({
        ...product,
        sunscreen_debug: {
          hardRejectReasons: [],
          strongPenaltyReasons: penaltyOnlyStrongPenaltyReasons,
          evaluationMode: "penalty_only",
        },
      });
    }
  }

  return {
    strictCandidates,
    penaltyOnlyCandidates,
    rejected,
  };
}

export function buildSunscreenExplanationContext(
  product: CanonicalRecommendationProduct,
  user: RecommendationAnswers | NormalizedRecommendationAnswers,
): SunscreenExplanationContext {
  const answers = normalizeSunscreenAnswers(user);
  const debugInfo = (product as SunscreenRankedProduct).sunscreen_debug;
  const strictHardRejectReasons = getSunscreenHardRejectReasons(product, answers, "strict");
  const strictStrongPenaltyReasons = getSunscreenStrongPenaltyReasons(
    product,
    answers,
    debugInfo?.evaluationMode === "penalty_only" ? "penalty_only" : "strict",
  );
  const preferredFilterType = getExpectedSunscreenFilterType(answers);
  const preferredFinish = getExpectedSunscreenFinish(answers);
  const matchedConcerns = (Array.isArray(product.concerns) ? product.concerns : []).filter((concern) =>
    answers.mainConcerns.includes(concern),
  );

  return {
    matchedSkinType: includesValue(product.skin_types, answers.skinType),
    matchedConcerns,
    finishMatch: Boolean(preferredFinish) && normalizeCanonicalFinish(product.finish as string) === preferredFinish,
    filterTypeMatch: Boolean(preferredFilterType) && product.uv_filter_type === preferredFilterType,
    toneUpFit:
      product.tone_up == null
        ? null
        : answers.toneUpWanted
          ? product.tone_up === true
          : product.tone_up === false,
    whiteCastFit:
      !answers.whiteCastHate
        ? null
        : product.white_cast == null
          ? null
          : product.white_cast === "none" || product.white_cast === "low",
    eyeStingFit:
      !answers.eyeSensitive
        ? null
        : product.eye_sting == null
          ? null
          : product.eye_sting === "low",
    pillingFit:
      !answers.makeupUse
        ? null
        : product.pilling_risk == null
          ? null
          : product.pilling_risk === "low",
    hardRejectReasons: debugInfo?.hardRejectReasons ?? strictHardRejectReasons,
    strongPenaltyReasons: debugInfo?.strongPenaltyReasons ?? strictStrongPenaltyReasons,
  };
}

export function scoreSunscreenProduct(
  product: CanonicalRecommendationProduct,
  user: RecommendationAnswers | NormalizedRecommendationAnswers,
): SunscreenRankedProduct {
  const answers = normalizeSunscreenAnswers(user);
  const baseRanked = scoreCanonicalProduct(product, answers);
  const context = buildSunscreenExplanationContext(product, answers);
  const primaryConcern = getPrimaryConcern(answers);
  const secondaryConcern = getSecondaryConcern(answers);
  const preferredFinish = getExpectedSunscreenFinish(answers);
  const preferredFilterType = getExpectedSunscreenFilterType(answers);
  const productConcerns = Array.isArray(product.concerns) ? product.concerns : [];
  const isSensitiveUser = isSensitiveSunscreenUser(answers);
  const strongPenaltyReasons =
    (product as SunscreenRankedProduct).sunscreen_debug?.strongPenaltyReasons ??
    context.strongPenaltyReasons;

  const sunscreenScore =
    (includesValue(product.skin_types, answers.skinType) ? 24 : 0) +
    (primaryConcern && productConcerns.includes(primaryConcern) ? 20 : 0) +
    (secondaryConcern && productConcerns.includes(secondaryConcern) ? 10 : 0) +
    (preferredFinish && normalizeCanonicalFinish(product.finish as string) === preferredFinish ? 12 : 0) +
    (preferredFilterType && product.uv_filter_type === preferredFilterType ? 12 : 0) +
    (isSensitiveUser
      ? product.sensitivity_safe === true
        ? 16
        : product.sensitivity_safe === false
          ? -16
          : 0
      : 0) +
    (answers.toneUpWanted
      ? product.tone_up === true
        ? 10
        : 0
      : product.tone_up === true
        ? -8
        : 0) +
    getSunscreenWhiteCastScore(product, answers) +
    getSunscreenEyeStingScore(product, answers) +
    getSunscreenPillingScore(product, answers) +
    getSunscreenStrongPenaltyScore(strongPenaltyReasons);

  return {
    ...baseRanked,
    score: sunscreenScore,
    why_picked: buildSunscreenWhyPicked(product, answers, context),
    sunscreen_debug: (product as SunscreenRankedProduct).sunscreen_debug ?? {
      hardRejectReasons: context.hardRejectReasons,
      strongPenaltyReasons,
      evaluationMode: "strict",
    },
  };
}

export function pickTopSunscreen(
  scoredCandidates: SunscreenRankedProduct[],
): {
  topPick: SunscreenRankedProduct | null;
  altPick: SunscreenRankedProduct | null;
  meta: SunscreenSelectionMeta | null;
} {
  const sorted = scoredCandidates
    .slice()
    .sort((left, right) => compareRankedProducts(left, right));
  const topPick = sorted[0] || null;
  const top2 = sorted[1] || null;
  const useTop2AsAlternative =
    Boolean(topPick) &&
    Boolean(top2) &&
    topPick !== null &&
    top2 !== null &&
    topPick.score - top2.score <= 6 &&
    Boolean(topPick.uv_filter_type) &&
    Boolean(top2.uv_filter_type) &&
    topPick.uv_filter_type !== top2.uv_filter_type;
  const altPick = useTop2AsAlternative ? top2 : null;
  const meta = topPick
    ? {
        fallbackMode: topPick.sunscreen_debug?.evaluationMode || "strict",
        altPickSummary: altPick
          ? {
              id: altPick.id,
              name: altPick.name,
              brand: altPick.brand,
              uv_filter_type: altPick.uv_filter_type || null,
              scoreGap: topPick.score - altPick.score,
            }
          : null,
      }
    : null;

  return {
    topPick,
    altPick,
    meta,
  };
}
