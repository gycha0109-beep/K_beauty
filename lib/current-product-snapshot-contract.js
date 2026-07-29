export const CURRENT_PRODUCT_SNAPSHOT_PROTECTION_METADATA_VERSION =
  "current-product-snapshot-protection-metadata-v1";

export const CURRENT_PRODUCT_SNAPSHOT_PROTECTION_FIELDS = Object.freeze([
  "spf_value",
  "uva_label",
  "uv_filter_type",
  "tone_up",
  "white_cast",
  "eye_sting",
  "pilling_risk"
]);

const UV_FILTER_TYPES = new Set(["mineral", "organic", "hybrid"]);
const PREFERENCE_LEVELS = new Set(["none", "low", "medium", "high"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);

function preserveNullableScalar(value, allowedTypes) {
  if (value == null) return null;
  if (!allowedTypes.includes(typeof value)) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  return value;
}

function preserveAllowedValue(value, allowedValues) {
  if (value == null) return null;
  return typeof value === "string" && allowedValues.has(value) ? value : null;
}

export function buildCurrentProductSnapshotProtectionMetadata(product = {}) {
  return {
    spf_value: preserveNullableScalar(product?.spf_value, ["string", "number"]),
    uva_label: preserveNullableScalar(product?.uva_label, ["string"]),
    uv_filter_type: preserveAllowedValue(product?.uv_filter_type, UV_FILTER_TYPES),
    tone_up: typeof product?.tone_up === "boolean" ? product.tone_up : null,
    white_cast: preserveAllowedValue(product?.white_cast, PREFERENCE_LEVELS),
    eye_sting: preserveAllowedValue(product?.eye_sting, RISK_LEVELS),
    pilling_risk: preserveAllowedValue(product?.pilling_risk, RISK_LEVELS)
  };
}
