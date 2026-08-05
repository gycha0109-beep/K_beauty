export const RECOMMENDATION_METADATA_TRANSPORT_VERSION =
  "recommendation-metadata-transport-v1";
export const PRODUCT_METADATA_VERSION = "product-metadata-v1";

export const ADMIN_V1_UNSUPPORTED_METADATA_FIELDS = Object.freeze([
  "cleansing_profile",
  "balm_functional_tags",
  "balm_usage_scope",
  "balm_type",
  "is_primary_moisturizer",
  "balm_caution_tags",
  "balm_research_confidence",
  "spf_value",
  "uva_label",
  "water_resistant_minutes",
  "uv_filter_type",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk"
]);

const TRANSPORT_SYMBOL = Symbol.for(
  "bejewely.recommendationMetadataTransport.v1"
);
const metadataRegistry = new Map();

const ALLOWED_CLEANSING_PROFILES = new Set([
  "low_ph",
  "balanced",
  "deep_clean"
]);
const ALLOWED_BALM_USAGE_SCOPES = new Set([
  "eye_lip",
  "full_face",
  "local_area",
  "multi_area",
  "body_possible"
]);
const ALLOWED_BALM_TYPES = new Set([
  "barrier",
  "eye_lip",
  "post_care",
  "cica_repair",
  "multi_stick",
  "rich_nutrition",
  "atopy_sensitive",
  "wrinkle_firming"
]);
const ALLOWED_RESEARCH_CONFIDENCE = new Set(["low", "medium", "high"]);
const ALLOWED_UV_FILTER_TYPES = new Set(["mineral", "organic", "hybrid"]);
const ALLOWED_WHITE_CAST = new Set(["none", "low", "medium", "high"]);
const ALLOWED_RISK_LEVELS = new Set(["low", "medium", "high"]);
const ALLOWED_SKIN_TYPES = new Set(["oily", "dry", "combination", "sensitive"]);
const ALLOWED_CONCERNS = new Set([
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier"
]);
const TEXTURE_INPUTS = new Set(["watery", "essence", "gel", "lotion", "cream"]);
const FINISH_INPUTS = new Set([
  "fresh",
  "clean",
  "calm",
  "moist",
  "dewy",
  "natural",
  "soft-matte",
  "soft_matte",
  "matte"
]);

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeNullableEnum(value, allowed, field, diagnostics) {
  if (value == null || value === "") {
    diagnostics.missing.push(field);
    return null;
  }

  const normalized = normalizeKey(value);
  if (!allowed.has(normalized)) {
    diagnostics.invalid.push(field);
    return null;
  }

  return normalized;
}

function normalizeNullableText(value, field, diagnostics) {
  if (value == null || value === "") {
    diagnostics.missing.push(field);
    return null;
  }

  if (typeof value !== "string") {
    diagnostics.invalid.push(field);
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    diagnostics.missing.push(field);
    return null;
  }

  return normalized;
}

function normalizeNullableBoolean(value, field, diagnostics) {
  if (value == null) {
    diagnostics.missing.push(field);
    return null;
  }

  if (typeof value !== "boolean") {
    diagnostics.invalid.push(field);
    return null;
  }

  return value;
}

function normalizeNullableNumber(value, field, diagnostics) {
  if (value == null || value === "") {
    diagnostics.missing.push(field);
    return null;
  }

  const numeric = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) {
    diagnostics.invalid.push(field);
    return null;
  }

  return numeric;
}

function normalizeNullableStringArray(value, field, diagnostics) {
  if (value == null) {
    diagnostics.missing.push(field);
    return null;
  }

  if (!Array.isArray(value)) {
    diagnostics.invalid.push(field);
    return null;
  }

  const normalized = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) {
      diagnostics.invalid.push(field);
      return null;
    }

    const text = item.trim();
    if (!normalized.includes(text)) {
      normalized.push(text);
    }
  }

  return Object.freeze(normalized);
}

function parseExistingList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeKey(item)).filter(Boolean);
  }

  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => normalizeKey(item)).filter(Boolean);
      }
    } catch {}
  }

  return trimmed.split(",").map((item) => normalizeKey(item)).filter(Boolean);
}

function hasValidExistingList(value, allowed) {
  return parseExistingList(value).some((item) => allowed.has(item));
}

export function identifyRecommendationMetadataFallbacks(source = {}) {
  const fallbacks = [];

  if (!hasValidExistingList(source.skin_types, ALLOWED_SKIN_TYPES)) {
    fallbacks.push("skin_types:combination");
  }

  if (!hasValidExistingList(source.concerns, ALLOWED_CONCERNS)) {
    fallbacks.push("concerns:dehydration");
  }

  if (!TEXTURE_INPUTS.has(normalizeKey(source.texture))) {
    fallbacks.push("texture:watery");
  }

  if (!FINISH_INPUTS.has(normalizeKey(source.finish))) {
    fallbacks.push("finish:natural");
  }

  const irritation = normalizeKey(source.irritation_risk);
  const irritationNumber = typeof source.irritation_risk === "number"
    ? source.irritation_risk
    : Number.parseInt(irritation, 10);
  const hasIrritationValue =
    ALLOWED_RISK_LEVELS.has(irritation) || Number.isFinite(irritationNumber);

  if (!hasIrritationValue) {
    fallbacks.push(
      source.sensitivity_safe === true
        ? "irritation_risk:low_from_sensitivity_safe"
        : "irritation_risk:medium"
    );
  }

  if (typeof source.sensitivity_safe !== "boolean") {
    fallbacks.push("sensitivity_safe:false");
  }

  return Object.freeze(fallbacks);
}

export function buildRecommendationMetadataTransport(source = {}, options = {}) {
  const diagnostics = { missing: [], invalid: [] };
  const metadata = {
    cleansing_profile: normalizeNullableEnum(
      source.cleansing_profile,
      ALLOWED_CLEANSING_PROFILES,
      "cleansing_profile",
      diagnostics
    ),
    balm_functional_tags: normalizeNullableStringArray(
      source.balm_functional_tags,
      "balm_functional_tags",
      diagnostics
    ),
    balm_usage_scope: normalizeNullableEnum(
      source.balm_usage_scope,
      ALLOWED_BALM_USAGE_SCOPES,
      "balm_usage_scope",
      diagnostics
    ),
    balm_type: normalizeNullableEnum(
      source.balm_type,
      ALLOWED_BALM_TYPES,
      "balm_type",
      diagnostics
    ),
    is_primary_moisturizer: normalizeNullableBoolean(
      source.is_primary_moisturizer,
      "is_primary_moisturizer",
      diagnostics
    ),
    balm_caution_tags: normalizeNullableStringArray(
      source.balm_caution_tags,
      "balm_caution_tags",
      diagnostics
    ),
    balm_research_confidence: normalizeNullableEnum(
      source.balm_research_confidence,
      ALLOWED_RESEARCH_CONFIDENCE,
      "balm_research_confidence",
      diagnostics
    ),
    spf_value: normalizeNullableText(source.spf_value, "spf_value", diagnostics),
    uva_label: normalizeNullableText(source.uva_label, "uva_label", diagnostics),
    water_resistant_minutes: normalizeNullableNumber(
      source.water_resistant_minutes,
      "water_resistant_minutes",
      diagnostics
    ),
    uv_filter_type: normalizeNullableEnum(
      source.uv_filter_type,
      ALLOWED_UV_FILTER_TYPES,
      "uv_filter_type",
      diagnostics
    ),
    tone_up: normalizeNullableBoolean(source.tone_up, "tone_up", diagnostics),
    white_cast: normalizeNullableEnum(
      source.white_cast,
      ALLOWED_WHITE_CAST,
      "white_cast",
      diagnostics
    ),
    eye_sting: normalizeNullableEnum(
      source.eye_sting,
      ALLOWED_RISK_LEVELS,
      "eye_sting",
      diagnostics
    ),
    pilling_risk: normalizeNullableEnum(
      source.pilling_risk,
      ALLOWED_RISK_LEVELS,
      "pilling_risk",
      diagnostics
    )
  };

  const envelope = Object.freeze({
    version: RECOMMENDATION_METADATA_TRANSPORT_VERSION,
    productMetadataVersion: PRODUCT_METADATA_VERSION,
    role: normalizeText(options.role) || "recommendation_product",
    metadata: Object.freeze(metadata),
    metadataMissing: Object.freeze(Array.from(new Set(diagnostics.missing)).sort()),
    metadataInvalid: Object.freeze(Array.from(new Set(diagnostics.invalid)).sort()),
    metadataFallbacksApplied: Object.freeze(
      Array.from(new Set(options.metadataFallbacksApplied || [])).sort()
    )
  });

  return envelope;
}

export function attachRecommendationMetadataTransport(target, source, options = {}) {
  if (!target || typeof target !== "object") {
    return target;
  }

  const envelope = buildRecommendationMetadataTransport(source, options);
  Object.defineProperty(target, TRANSPORT_SYMBOL, {
    value: envelope,
    enumerable: false,
    configurable: true,
    writable: false
  });

  const id = normalizeText(target.id || source?.id);
  if (id) {
    metadataRegistry.set(id, envelope);
  }

  return target;
}

export function getRecommendationMetadataTransport(productOrId) {
  if (productOrId && typeof productOrId === "object") {
    if (productOrId[TRANSPORT_SYMBOL]) {
      return productOrId[TRANSPORT_SYMBOL];
    }

    const id = normalizeText(productOrId.id || productOrId.productId || productOrId.product_id);
    return id ? metadataRegistry.get(id) || null : null;
  }

  const id = normalizeText(productOrId);
  return id ? metadataRegistry.get(id) || null : null;
}

export function clearRecommendationMetadataTransportRegistryForTests() {
  metadataRegistry.clear();
}
