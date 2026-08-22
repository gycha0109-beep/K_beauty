export const CRAWLER_CANONICAL_STRUCTURAL_ADOPTION_VERSION =
  "crawler-canonical-product-structural-adoption-v1";
export const CRAWLER_IDENTITY_RESOLUTION_VERSION =
  "crawler-identity-resolution-v1";

export const STRUCTURAL_CANONICAL_FIELDS = Object.freeze([
  "id",
  "name",
  "brand",
  "category",
  "product_form",
  "normalized_name",
  "normalized_brand",
  "external_source",
  "external_type",
  "external_id",
  "source_url",
  "created_at",
  "updated_at",
]);

export const RECOMMENDATION_SEMANTIC_DENYLIST = Object.freeze([
  "skin_types",
  "concerns",
  "texture",
  "finish",
  "irritation_risk",
  "sensitivity_safe",
]);

export const IDENTITY_RESOLUTION_STATES = Object.freeze([
  "unresolved",
  "resolved",
  "identity_ambiguous",
  "variant_scope_conflict",
  "formulation_scope_conflict",
  "reformulation_candidate",
]);

const VOLUME_PATTERN = /(?:^|\s)(\d+(?:\.\d+)?)\s*(ml|g|kg|l|oz|fl\.?\s*oz)(?=\s|$)/giu;
const VARIANT_PATTERN = /(?:^|\s)(refill|limited|set|gift|option|bundle|edition|리필|한정|세트|기획|옵션)(?=\s|$)/giu;
const RENEWAL_PATTERN = /(?:^|\s)(renewal|renewed|reformulated|new formula|리뉴얼|개선|처방변경|포뮬러변경)(?=\s|$)/giu;

function collapse(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\[\](){}_/,:;+|]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function analyzeCrawlerIdentityObservation({ brand, name }) {
  const rawBrand = String(brand ?? "").trim();
  const rawName = String(name ?? "").trim();
  const normalizedBrand = collapse(rawBrand);
  const collapsedName = collapse(rawName);
  const volumeMarkers = [...collapsedName.matchAll(VOLUME_PATTERN)].map((match) => match[0].trim());
  const variantMarkers = [...collapsedName.matchAll(VARIANT_PATTERN)].map((match) => match[0].trim());
  const renewalMarkers = [...collapsedName.matchAll(RENEWAL_PATTERN)].map((match) => match[0].trim());
  const normalizedName = collapsedName
    .replace(VOLUME_PATTERN, " ")
    .replace(VARIANT_PATTERN, " ")
    .replace(RENEWAL_PATTERN, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return Object.freeze({
    rawBrand,
    rawName,
    normalizedBrand,
    normalizedName,
    comparisonKey: `${normalizedBrand}::${normalizedName}`,
    volumeMarkers,
    variantMarkers,
    renewalMarkers,
    uncertaintySignalsPreserved:
      volumeMarkers.length > 0 || variantMarkers.length > 0 || renewalMarkers.length > 0,
  });
}

export function evaluateStructuralAdoption(input) {
  const state = input?.identityResolutionState ?? "unresolved";
  if (!IDENTITY_RESOLUTION_STATES.includes(state)) {
    return Object.freeze({ allowed: false, reason: "identity_state_invalid" });
  }
  if (state !== "resolved") {
    return Object.freeze({ allowed: false, reason: state });
  }

  const semanticAssertions = RECOMMENDATION_SEMANTIC_DENYLIST.filter(
    (field) => input?.recommendationSemantics?.[field] !== null &&
      input?.recommendationSemantics?.[field] !== undefined,
  );
  if (semanticAssertions.length > 0) {
    return Object.freeze({
      allowed: false,
      reason: "recommendation_semantic_assertion_forbidden",
      fields: Object.freeze([...semanticAssertions]),
    });
  }

  if (input?.explicitProductIdentityConflict) {
    return Object.freeze({ allowed: false, reason: "identity_ambiguous" });
  }
  if (Number(input?.normalizedCollisionCount ?? 0) > 0 && !input?.explicitExistingProductId) {
    return Object.freeze({ allowed: false, reason: "identity_ambiguous" });
  }

  return Object.freeze({
    allowed: true,
    reason: "structural_adoption_allowed",
    action: input?.explicitExistingProductId ? "merge_existing" : "create_new",
    recommendationSemanticWriteCount: 0,
  });
}
