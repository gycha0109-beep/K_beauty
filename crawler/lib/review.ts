import { findBestProductMatch } from "./match.js";
import {
  normalizeBrandName,
  normalizeCanonicalBrandName,
  normalizeCanonicalProductName,
  tokenizeNormalizedText,
} from "./normalize.js";

export type ServiceCategory =
  | "cleanser"
  | "toner_essence"
  | "toner_pad"
  | "essence"
  | "serum"
  | "ampoule"
  | "moisturizer"
  | "sunscreen";

export type ReviewStatus =
  | "new"
  | "auto_matched"
  | "needs_review"
  | "approved"
  | "promoted"
  | "rejected";

export type ReviewFlag =
  | "ambiguous_category"
  | "missing_canonical_name"
  | "missing_canonical_brand"
  | "remover_like_name"
  | "peeling_like_name"
  | "powder_wash_like_name"
  | "cleansing_serum_like_name"
  | "generic_name"
  | "short_name"
  | "misc_item"
  | "body_item"
  | "near_duplicate_match";

export interface MatchableProductRecord {
  id: string;
  name: string;
  brand: string;
  normalized_name: string;
  normalized_brand: string;
  category?: string | null;
  skin_types?: string[] | string | null;
  concerns?: string[] | string | null;
  texture?: string | null;
  finish?: string | null;
  irritation_risk?: string | number | null;
  sensitivity_safe?: boolean | null;
  price_min?: number | null;
  price_max?: number | null;
  buy_link?: string | null;
  image_url?: string | null;
}

export interface CandidateForReview {
  id: string;
  source_name: string;
  category_path: string;
  product_name_raw: string;
  brand_name_raw: string;
  normalized_name: string;
  normalized_brand: string;
}

export interface PreparedCandidateReview {
  serviceCategory: ServiceCategory | null;
  canonicalName: string | null;
  canonicalBrand: string | null;
  matchedProductId: string | null;
  duplicateOfProductId: string | null;
  reviewStatus: Extract<ReviewStatus, "auto_matched" | "needs_review" | "rejected">;
  reviewNotes: string | null;
  promotionPayload: Record<string, unknown>;
  matchMethod: string | null;
  matchConfidence: number | null;
  reviewFlags: ReviewFlag[];
  promotionVersion: string;
  inferredConcerns: string[];
  inferredTexture: string | null;
  inferredFinish: string | null;
}

type InferredPromotionProduct = {
  skin_types: string[];
  concerns: string[];
  texture: string;
  finish: string;
  irritation_risk: string;
  sensitivity_safe: boolean;
  price_min: number | null;
  price_max: number | null;
  buy_link: string | null;
  image_url: string | null;
};

const CATEGORY_PATH_MAP: Record<string, ServiceCategory> = {
  "skincare/toner": "toner_essence",
  "skincare/serum": "serum",
  "skincare/cream": "moisturizer",
  "skincare/suncare": "sunscreen",
  "cleansing/cleansing": "cleanser",
};

const CATEGORY_NAME_HINTS: Array<{ category: ServiceCategory; regex: RegExp }> = [
  {
    category: "sunscreen",
    regex: /\b(?:sunscreen|sun\s*cream|sun\s*screen|sunblock|uv|sun\s*essence|sun\s*stick|sun\s*pact|sun\s*cushion|tone[\s-]*up\s+sun)\b/i,
  },
  { category: "toner_pad", regex: /\b(?:toner\s+)?pads?\b/i },
  { category: "ampoule", regex: /\bampoule\b/i },
  { category: "serum", regex: /\bserum\b/i },
  { category: "essence", regex: /\bessence\b/i },
  { category: "moisturizer", regex: /\b(?:cream|lotion|gel\s+cream)\b/i },
  { category: "toner_essence", regex: /\b(?:toner|skin)\b/i },
  { category: "cleanser", regex: /\b(?:cleanser|cleansing|foam|wash)\b/i },
];

const AUTO_REJECT_RULES: Array<{ flag: ReviewFlag; regex: RegExp }> = [
  { flag: "body_item", regex: /\bbody\s+wash\b/i },
  { flag: "body_item", regex: /\btop\s+to\s+toe\s+wash\b/i },
  { flag: "body_item", regex: /\bbody\s+cleanser\b/i },
  { flag: "remover_like_name", regex: /\blip(?:\s+and)?\s+eye\s+remover\b/i },
  { flag: "remover_like_name", regex: /\beye\s+remover\b/i },
  { flag: "remover_like_name", regex: /\bmakeup\s+remover\b/i },
];

const NEEDS_REVIEW_RULES: Array<{ flag: ReviewFlag; regex: RegExp }> = [
  { flag: "peeling_like_name", regex: /\bpeeling\s+gel\b/i },
  { flag: "powder_wash_like_name", regex: /\bpowder\s+wash\b/i },
  { flag: "cleansing_serum_like_name", regex: /\bcleansing\s+serum\b/i },
  { flag: "misc_item", regex: /\b(?:mist|balm|mask|pack|patch|soap|bar|all\s+in\s+one)\b/i },
];

const TOKEN_CONCERN_RULES: Array<{ regex: RegExp; concerns: string[] }> = [
  { regex: /\b(?:cica|calming|soothing)\b/i, concerns: ["redness", "barrier"] },
  { regex: /\b(?:ceramide|bifida|barrier)\b/i, concerns: ["barrier", "dehydration"] },
  { regex: /\b(?:pore|sebum)\b/i, concerns: ["pores", "oiliness"] },
  { regex: /\b(?:acne|trouble)\b/i, concerns: ["acne"] },
  { regex: /\b(?:moisture|hydrating|hyaluronic)\b/i, concerns: ["dehydration"] },
  { regex: /\b(?:brightening|tone)\b/i, concerns: ["uneven_tone"] },
  { regex: /\b(?:atobarrier|ato)\b/i, concerns: ["barrier", "dehydration"] },
  { regex: /\brelief\b/i, concerns: ["redness", "barrier"] },
  { regex: /\bblemish\b/i, concerns: ["acne", "redness"] },
  { regex: /\bmild\b/i, concerns: ["redness"] },
  { regex: /\b(?:azulene|artemisia)\b/i, concerns: ["redness", "barrier"] },
];

const ALLOWED_SKIN_TYPES = new Set(["oily", "dry", "combination", "sensitive"]);
const ALLOWED_CONCERNS = new Set([
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier",
]);
const DEFAULT_SKIN_TYPES = ["oily", "combination", "sensitive"];
const GENERIC_NAME_SET = new Set([
  "cleanser",
  "cleansing foam",
  "cleansing gel",
  "foam cleanser",
  "toner",
  "essence",
  "serum",
  "ampoule",
  "cream",
  "lotion",
  "sunscreen",
  "sun cream",
]);
const GENERIC_NAME_TOKENS = new Set([
  "cleanser",
  "cleansing",
  "foam",
  "gel",
  "toner",
  "essence",
  "serum",
  "ampoule",
  "cream",
  "lotion",
  "sunscreen",
  "sun",
  "wash",
]);

const FALLBACK_PRODUCT_DEFAULTS = {
  texture: "gel",
  finish: "natural",
  concerns: ["dehydration", "redness"],
};

const SERVICE_CATEGORY_DEFAULTS: Record<ServiceCategory, { texture: string; finish: string; concerns: string[] }> = {
  cleanser: {
    texture: "gel",
    finish: "fresh",
    concerns: ["oiliness", "pores"],
  },
  toner_essence: {
    texture: "watery",
    finish: "natural",
    concerns: ["dehydration", "redness"],
  },
  toner_pad: {
    texture: "watery",
    finish: "fresh",
    concerns: ["pores", "oiliness", "acne"],
  },
  essence: {
    texture: "watery",
    finish: "natural",
    concerns: ["dehydration", "uneven_tone"],
  },
  serum: {
    texture: "gel",
    finish: "natural",
    concerns: ["acne", "pores"],
  },
  ampoule: {
    texture: "gel",
    finish: "natural",
    concerns: ["acne", "pores"],
  },
  moisturizer: {
    texture: "cream",
    finish: "dewy",
    concerns: ["barrier", "dehydration"],
  },
  sunscreen: {
    texture: "lotion",
    finish: "soft_matte",
    concerns: ["oiliness", "redness"],
  },
};

function toStringArray(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeAllowedArray(
  value: string[] | string | null | undefined,
  allowedValues: Set<string>,
): string[] {
  return uniqueStrings(
    toStringArray(value)
      .map((item) => item.trim().toLowerCase())
      .filter((item) => allowedValues.has(item)),
  );
}

function mapCategoryFromPath(value: string | null | undefined): ServiceCategory | null {
  if (!value) {
    return null;
  }

  return CATEGORY_PATH_MAP[value] ?? null;
}

function mapProductCategory(value: string | null | undefined): ServiceCategory | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "toner") {
    return "toner_essence";
  }

  if (normalized === "toner_pad") {
    return "toner_pad";
  }

  if (normalized === "essence") {
    return "essence";
  }

  if (normalized === "cream") {
    return "moisturizer";
  }

  if (normalized === "sun") {
    return "sunscreen";
  }

  if (
    ["cleanser", "toner_essence", "toner_pad", "essence", "serum", "ampoule", "moisturizer", "sunscreen"].includes(
      normalized,
    )
  ) {
    return normalized as ServiceCategory;
  }

  return null;
}

function inferCategoryFromName(canonicalName: string): ServiceCategory | null {
  if (
    /\b(?:sunscreen|sun\s*cream|sun\s*screen|sunblock|uv|sun\s*essence|sun\s*stick|sun\s*pact|sun\s*cushion|tone[\s-]*up\s+sun)\b/i.test(
      canonicalName,
    )
  ) {
    return "sunscreen";
  }

  const matchedCategories = CATEGORY_NAME_HINTS
    .filter((rule) => rule.regex.test(canonicalName))
    .map((rule) => rule.category);

  const uniqueMatches = Array.from(new Set(matchedCategories));
  return uniqueMatches.length === 1 ? uniqueMatches[0] : null;
}

function getServiceCategorySlot(category: ServiceCategory | null | undefined): ServiceCategory | null {
  if (!category) {
    return null;
  }

  if (["serum", "ampoule"].includes(category)) {
    return "serum";
  }

  if (category === "toner_pad" || category === "essence") {
    return "toner_essence";
  }

  return category;
}

function isCompatibleServiceCategory(
  left: ServiceCategory | null | undefined,
  right: ServiceCategory | null | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return getServiceCategorySlot(left) === getServiceCategorySlot(right);
}

function resolveInitialServiceCategory(
  pathCategory: ServiceCategory | null,
  inferredNameCategory: ServiceCategory | null,
): ServiceCategory | null {
  if (pathCategory && inferredNameCategory && isCompatibleServiceCategory(pathCategory, inferredNameCategory)) {
    return inferredNameCategory;
  }

  return pathCategory ?? inferredNameCategory;
}

function mapTexture(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "essence") {
    return "watery";
  }

  if (["watery", "gel", "lotion", "cream"].includes(normalized)) {
    return normalized;
  }

  return null;
}

function mapFinish(value: string | null | undefined): string | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "clean" || normalized === "calm") {
    return "natural";
  }

  if (normalized === "moist") {
    return "dewy";
  }

  if (normalized === "soft-matte") {
    return "soft_matte";
  }

  if (["fresh", "natural", "dewy", "soft_matte"].includes(normalized)) {
    return normalized;
  }

  return null;
}

function mapIrritationRisk(value: string | number | null | undefined): string | null {
  if (typeof value === "number") {
    if (value <= 1) {
      return "low";
    }

    return value >= 3 ? "high" : "medium";
  }

  const normalized = String(value ?? "").trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (["low", "medium", "high"].includes(normalized)) {
    return normalized;
  }

  const parsedNumber = Number.parseInt(normalized, 10);

  if (Number.isFinite(parsedNumber)) {
    if (parsedNumber <= 1) {
      return "low";
    }

    return parsedNumber >= 3 ? "high" : "medium";
  }

  return null;
}

function getProductDefaults(serviceCategory: ServiceCategory | null): {
  texture: string;
  finish: string;
  concerns: string[];
} {
  if (!serviceCategory) {
    return FALLBACK_PRODUCT_DEFAULTS;
  }

  return SERVICE_CATEGORY_DEFAULTS[serviceCategory];
}

function inferConcernsFromTokens(canonicalName: string, serviceCategory: ServiceCategory | null): string[] {
  const defaults = getProductDefaults(serviceCategory).concerns;
  const inferredConcerns = TOKEN_CONCERN_RULES
    .filter((rule) => rule.regex.test(canonicalName))
    .flatMap((rule) => rule.concerns)
    .filter((concern) => ALLOWED_CONCERNS.has(concern));

  return uniqueStrings([...defaults, ...inferredConcerns]);
}

function hasShortName(normalizedName: string): boolean {
  const tokens = tokenizeNormalizedText(normalizedName);
  const compactName = normalizedName.replace(/\s+/g, "");

  return tokens.length < 2 || compactName.length < 6;
}

function hasGenericName(normalizedName: string): boolean {
  if (!normalizedName) {
    return true;
  }

  if (GENERIC_NAME_SET.has(normalizedName)) {
    return true;
  }

  const tokens = tokenizeNormalizedText(normalizedName);
  return tokens.length > 0 && tokens.length <= 2 && tokens.every((token) => GENERIC_NAME_TOKENS.has(token));
}

function collectScopeFlags(canonicalName: string): {
  rejectFlags: ReviewFlag[];
  needsReviewFlags: ReviewFlag[];
} {
  const rejectFlags = uniqueStrings(
    AUTO_REJECT_RULES.filter((rule) => rule.regex.test(canonicalName)).map((rule) => rule.flag),
  ) as ReviewFlag[];
  const needsReviewFlags = uniqueStrings(
    NEEDS_REVIEW_RULES.filter((rule) => rule.regex.test(canonicalName)).map((rule) => rule.flag),
  ) as ReviewFlag[];

  return {
    rejectFlags,
    needsReviewFlags,
  };
}

function buildPromotionProduct(
  candidate: CandidateForReview,
  serviceCategory: ServiceCategory | null,
  canonicalName: string,
  match: MatchableProductRecord | null,
): InferredPromotionProduct {
  const defaults = getProductDefaults(serviceCategory);
  const inferredConcerns = inferConcernsFromTokens(canonicalName, serviceCategory);
  const existingSkinTypes = normalizeAllowedArray(match?.skin_types, ALLOWED_SKIN_TYPES);
  const existingConcerns = normalizeAllowedArray(match?.concerns, ALLOWED_CONCERNS);
  const concerns = existingConcerns.length > 0 ? existingConcerns : inferredConcerns;
  let texture = mapTexture(match?.texture) ?? defaults.texture;
  let finish = mapFinish(match?.finish) ?? defaults.finish;
  const irritationRisk = mapIrritationRisk(match?.irritation_risk) ?? "low";
  const sensitivitySafe =
    typeof match?.sensitivity_safe === "boolean" ? match.sensitivity_safe : irritationRisk === "low";

  if (!match) {
    if (serviceCategory === "cleanser" && /\bcleansing\s+milk\b/i.test(canonicalName)) {
      texture = "lotion";
      finish = "natural";
    } else if (serviceCategory === "cleanser" && /\bcleansing\s+oil\b/i.test(canonicalName)) {
      texture = "lotion";
      finish = "natural";
    } else if (
      serviceCategory === "sunscreen" &&
      /\b(?:sun\s+essence|aqua|water)\b/i.test(canonicalName)
    ) {
      texture = "watery";
      finish = "natural";
    }
  }

  return {
    skin_types: existingSkinTypes.length > 0 ? existingSkinTypes : DEFAULT_SKIN_TYPES,
    concerns,
    texture,
    finish,
    irritation_risk: irritationRisk,
    sensitivity_safe: sensitivitySafe,
    price_min: match?.price_min ?? null,
    price_max: match?.price_max ?? null,
    buy_link: match?.buy_link ?? null,
    image_url: match?.image_url ?? null,
  };
}

function buildPromotionPayload(
  candidate: CandidateForReview,
  serviceCategory: ServiceCategory | null,
  match: MatchableProductRecord | null,
  reviewFlags: ReviewFlag[],
  matchMethod: string | null,
  matchConfidence: number | null,
  promotionProduct: InferredPromotionProduct,
): Record<string, unknown> {
  return {
    metadata: {
      version: "v1",
      prepared_at: new Date().toISOString(),
      service_category: serviceCategory,
      match_method: matchMethod,
      match_confidence: matchConfidence,
      review_flags: reviewFlags,
      inferred_concerns: promotionProduct.concerns,
      inferred_texture: promotionProduct.texture,
      inferred_finish: promotionProduct.finish,
    },
    product: promotionProduct,
    evidence: {
      source_name: candidate.source_name,
      category_path: candidate.category_path,
      raw_product_name: candidate.product_name_raw,
      raw_brand_name: candidate.brand_name_raw,
    },
  };
}

function buildReviewNotes(
  reviewStatus: PreparedCandidateReview["reviewStatus"],
  reviewFlags: ReviewFlag[],
  match: MatchableProductRecord | null,
  matchMethod: string | null,
  matchConfidence: number | null,
): string | null {
  const formattedConfidence =
    typeof matchConfidence === "number" ? matchConfidence.toFixed(2) : null;

  if (reviewStatus === "rejected") {
    return `Auto-rejected by review prep: ${reviewFlags.join(", ")}`;
  }

  if (reviewStatus === "auto_matched" && match) {
    return `Exact duplicate candidate matched product ${match.id} via ${matchMethod} (${formattedConfidence}). Manual approval is still required before promotion.`;
  }

  if (match && matchMethod && formattedConfidence) {
    return `Needs review: ${reviewFlags.join(", ") || "manual verification"}; tentative match ${match.id} via ${matchMethod} (${formattedConfidence}).`;
  }

  if (reviewFlags.length > 0) {
    return `Needs review: ${reviewFlags.join(", ")}`;
  }

  return "Needs metadata review before approval.";
}

function determineMatchMethod(
  rawNormalizedBrand: string,
  canonicalBrand: string,
  matchKind: "exact" | "same_brand_near_name" | "none",
): string | null {
  if (matchKind === "exact") {
    return rawNormalizedBrand !== canonicalBrand ? "brand_alias_exact" : "exact_normalized";
  }

  if (matchKind === "same_brand_near_name") {
    return rawNormalizedBrand !== canonicalBrand ? "brand_alias_near_name" : "same_brand_near_name";
  }

  return null;
}

function determineMatchConfidence(
  matchMethod: string | null,
  baseConfidence: number | null,
): number | null {
  if (typeof baseConfidence !== "number") {
    return null;
  }

  if (matchMethod === "brand_alias_exact") {
    return 0.99;
  }

  if (matchMethod === "brand_alias_near_name") {
    return Math.min(baseConfidence, 0.88);
  }

  return baseConfidence;
}

export function prepareCandidateReview(
  candidate: CandidateForReview,
  products: MatchableProductRecord[],
): PreparedCandidateReview {
  const canonicalName = normalizeCanonicalProductName(candidate.product_name_raw);
  const canonicalBrand = normalizeCanonicalBrandName(candidate.brand_name_raw);
  const rawNormalizedBrand = normalizeBrandName(candidate.brand_name_raw);
  const pathCategory = mapCategoryFromPath(candidate.category_path);
  const inferredNameCategory = inferCategoryFromName(canonicalName);
  const initialServiceCategory = resolveInitialServiceCategory(pathCategory, inferredNameCategory);
  const matchResult =
    canonicalName && canonicalBrand
      ? findBestProductMatch(products, {
          canonicalBrand,
          canonicalName,
        })
      : {
          kind: "none" as const,
          product: null,
          confidence: null,
        };
  const exactMatchedCategory = matchResult.kind === "exact" ? mapProductCategory(matchResult.product?.category) : null;
  const serviceCategory = exactMatchedCategory ?? initialServiceCategory;
  const { rejectFlags, needsReviewFlags } = collectScopeFlags(canonicalName);
  const reviewFlagSet = new Set<ReviewFlag>([...rejectFlags, ...needsReviewFlags]);

  if (!serviceCategory) {
    reviewFlagSet.add("ambiguous_category");
  }

  if (
    pathCategory &&
    inferredNameCategory &&
    !isCompatibleServiceCategory(pathCategory, inferredNameCategory) &&
    matchResult.kind !== "exact"
  ) {
    reviewFlagSet.add("ambiguous_category");
  }

  if (!canonicalName) {
    reviewFlagSet.add("missing_canonical_name");
  }

  if (!canonicalBrand) {
    reviewFlagSet.add("missing_canonical_brand");
  }

  if (canonicalName && hasShortName(canonicalName)) {
    reviewFlagSet.add("short_name");
  }

  if (canonicalName && hasGenericName(canonicalName)) {
    reviewFlagSet.add("generic_name");
  }

  if (matchResult.kind === "same_brand_near_name") {
    reviewFlagSet.add("near_duplicate_match");
  }

  const reviewFlags = Array.from(reviewFlagSet);
  const matchMethod = determineMatchMethod(rawNormalizedBrand, canonicalBrand, matchResult.kind);
  const matchConfidence = determineMatchConfidence(matchMethod, matchResult.confidence);
  const matchedProductId =
    matchResult.kind === "exact" || matchResult.kind === "same_brand_near_name"
      ? matchResult.product?.id ?? null
      : null;
  const promotionProduct = buildPromotionProduct(
    candidate,
    serviceCategory,
    canonicalName,
    matchResult.product,
  );

  let reviewStatus: PreparedCandidateReview["reviewStatus"] = "needs_review";

  if (rejectFlags.length > 0) {
    reviewStatus = "rejected";
  } else if (matchResult.kind === "exact" && reviewFlags.length === 0) {
    reviewStatus = "auto_matched";
  }

  return {
    serviceCategory,
    canonicalName: canonicalName || null,
    canonicalBrand: canonicalBrand || null,
    matchedProductId,
    duplicateOfProductId: null,
    reviewStatus,
    reviewNotes: buildReviewNotes(
      reviewStatus,
      reviewFlags,
      matchResult.product,
      matchMethod,
      matchConfidence,
    ),
    promotionPayload: buildPromotionPayload(
      candidate,
      serviceCategory,
      matchResult.product,
      reviewFlags,
      matchMethod,
      matchConfidence,
      promotionProduct,
    ),
    matchMethod,
    matchConfidence,
    reviewFlags,
    promotionVersion: "v1",
    inferredConcerns: promotionProduct.concerns,
    inferredTexture: promotionProduct.texture,
    inferredFinish: promotionProduct.finish,
  };
}
