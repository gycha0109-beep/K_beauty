import {
  normalizeBrandName,
  normalizeCanonicalBrandName,
  normalizeCanonicalProductName,
} from "./normalize.js";

export type ServiceCategory =
  | "cleanser"
  | "toner_essence"
  | "serum"
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
  | "pad_like_name"
  | "remover_like_name"
  | "peeling_like_name"
  | "powder_wash_like_name"
  | "cleansing_serum_like_name"
  | "generic_name"
  | "body_item";

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
}

const CATEGORY_PATH_MAP: Record<string, ServiceCategory> = {
  "skincare/toner": "toner_essence",
  "skincare/serum": "serum",
  "skincare/cream": "moisturizer",
  "skincare/suncare": "sunscreen",
  "cleansing/cleansing": "cleanser",
};

const NEEDS_REVIEW_RULES: Array<{ flag: ReviewFlag; regex: RegExp }> = [
  { flag: "pad_like_name", regex: /\b(?:toner\s+)?pads?\b/i },
  { flag: "remover_like_name", regex: /\b(?:lip\s*&?\s*eye|eye|makeup)\s+remover\b/i },
  { flag: "peeling_like_name", regex: /\bpeeling\s+gel\b/i },
  { flag: "powder_wash_like_name", regex: /\bpowder\s+wash\b/i },
  { flag: "cleansing_serum_like_name", regex: /\bcleansing\s+serum\b/i },
];

const REJECT_RULES: Array<{ flag: ReviewFlag; regex: RegExp }> = [
  { flag: "body_item", regex: /\bbody\s+wash\b/i },
  { flag: "body_item", regex: /\btop\s+to\s+toe\s+wash\b/i },
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
const FALLBACK_PRODUCT_DEFAULTS = {
  texture: "gel",
  finish: "natural",
  concerns: ["dehydration", "redness"],
};
const SERVICE_CATEGORY_DEFAULTS: Record<
  ServiceCategory,
  { texture: string; finish: string; concerns: string[] }
> = {
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
  serum: {
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

function normalizeAllowedArray(
  value: string[] | string | null | undefined,
  allowedValues: Set<string>,
): string[] {
  return Array.from(
    new Set(
      toStringArray(value)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => allowedValues.has(item)),
    ),
  );
}

function mapCategory(value: string | null | undefined): ServiceCategory | null {
  if (!value) {
    return null;
  }

  return CATEGORY_PATH_MAP[value] ?? null;
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

function buildPromotionProduct(
  serviceCategory: ServiceCategory | null,
  match: MatchableProductRecord | null,
): Record<string, unknown> {
  const defaults = getProductDefaults(serviceCategory);
  const skinTypes = normalizeAllowedArray(match?.skin_types, ALLOWED_SKIN_TYPES);
  const existingConcerns = normalizeAllowedArray(match?.concerns, ALLOWED_CONCERNS);
  const concerns = Array.from(new Set([...existingConcerns, ...defaults.concerns])).slice(
    0,
    Math.max(existingConcerns.length, 2),
  );

  return {
    skin_types: skinTypes.length > 0 ? skinTypes : DEFAULT_SKIN_TYPES,
    concerns,
    texture: mapTexture(match?.texture) ?? defaults.texture,
    finish: mapFinish(match?.finish) ?? defaults.finish,
    irritation_risk: mapIrritationRisk(match?.irritation_risk) ?? "low",
    sensitivity_safe:
      typeof match?.sensitivity_safe === "boolean" ? match.sensitivity_safe : true,
    price_min: match?.price_min ?? null,
    price_max: match?.price_max ?? null,
    buy_link: match?.buy_link ?? null,
    image_url: match?.image_url ?? null,
  };
}

function hasGenericName(normalizedName: string): boolean {
  if (!normalizedName) {
    return true;
  }

  const genericNames = new Set([
    "cleanser",
    "foam cleanser",
    "cleansing foam",
    "toner",
    "serum",
    "cream",
    "sunscreen",
  ]);

  return genericNames.has(normalizedName);
}

function collectReviewFlags(serviceCategory: ServiceCategory | null, canonicalName: string, canonicalBrand: string): ReviewFlag[] {
  const flags = new Set<ReviewFlag>();

  if (!serviceCategory) {
    flags.add("ambiguous_category");
  }

  if (!canonicalName) {
    flags.add("missing_canonical_name");
  }

  if (!canonicalBrand) {
    flags.add("missing_canonical_brand");
  }

  for (const rule of REJECT_RULES) {
    if (rule.regex.test(canonicalName)) {
      flags.add(rule.flag);
    }
  }

  for (const rule of NEEDS_REVIEW_RULES) {
    if (rule.regex.test(canonicalName)) {
      flags.add(rule.flag);
    }
  }

  if (hasGenericName(canonicalName)) {
    flags.add("generic_name");
  }

  return Array.from(flags);
}

function findExactMatch(
  products: MatchableProductRecord[],
  canonicalBrand: string,
  canonicalName: string,
): MatchableProductRecord | null {
  const key = `${canonicalBrand}::${canonicalName}`;

  return (
    products.find(
      (product) => `${product.normalized_brand}::${product.normalized_name}` === key,
    ) ?? null
  );
}

function buildPromotionPayload(
  candidate: CandidateForReview,
  serviceCategory: ServiceCategory | null,
  match: MatchableProductRecord | null,
  reviewFlags: ReviewFlag[],
  matchMethod: string | null,
  matchConfidence: number | null,
): Record<string, unknown> {
  return {
    metadata: {
      version: "v1",
      prepared_at: new Date().toISOString(),
      match_method: matchMethod,
      match_confidence: matchConfidence,
      review_flags: reviewFlags,
    },
    product: buildPromotionProduct(serviceCategory, match),
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
): string | null {
  if (reviewStatus === "rejected") {
    return `Auto-rejected by review prep: ${reviewFlags.join(", ")}`;
  }

  if (reviewStatus === "auto_matched" && match) {
    return `Tentative exact match to product ${match.id}. Human approval is still required before promotion.`;
  }

  if (reviewFlags.length > 0) {
    return `Needs review: ${reviewFlags.join(", ")}`;
  }

  return "Needs metadata review before approval.";
}

export function prepareCandidateReview(
  candidate: CandidateForReview,
  products: MatchableProductRecord[],
): PreparedCandidateReview {
  const serviceCategory = mapCategory(candidate.category_path);
  const canonicalName = normalizeCanonicalProductName(candidate.product_name_raw);
  const canonicalBrand = normalizeCanonicalBrandName(candidate.brand_name_raw);
  const reviewFlags = collectReviewFlags(serviceCategory, canonicalName, canonicalBrand);
  const rejectFlags = new Set<ReviewFlag>(["body_item"]);
  const rawNormalizedBrand = normalizeBrandName(candidate.brand_name_raw);
  const match =
    canonicalName && canonicalBrand ? findExactMatch(products, canonicalBrand, canonicalName) : null;

  let reviewStatus: PreparedCandidateReview["reviewStatus"] = "needs_review";
  let matchMethod: string | null = null;
  let matchConfidence: number | null = null;

  if (reviewFlags.some((flag) => rejectFlags.has(flag))) {
    reviewStatus = "rejected";
  } else if (reviewFlags.length === 0 && match) {
    reviewStatus = "auto_matched";
    matchMethod = rawNormalizedBrand !== canonicalBrand ? "brand_alias_exact" : "exact_normalized";
    matchConfidence = matchMethod === "brand_alias_exact" ? 0.98 : 1;
  }

  return {
    serviceCategory,
    canonicalName: canonicalName || null,
    canonicalBrand: canonicalBrand || null,
    matchedProductId: match?.id ?? null,
    duplicateOfProductId: null,
    reviewStatus,
    reviewNotes: buildReviewNotes(reviewStatus, reviewFlags, match),
    promotionPayload: buildPromotionPayload(
      candidate,
      serviceCategory,
      match,
      reviewFlags,
      matchMethod,
      matchConfidence,
    ),
    matchMethod,
    matchConfidence,
    reviewFlags,
    promotionVersion: "v1",
  };
}
