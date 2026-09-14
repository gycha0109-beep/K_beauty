export const VERSION = "catalog-only-product-promotion-eligibility-v1";

const txt = (v) => v == null || v === "" ? null : String(v);
const get = (o, a, b) => o && typeof o === "object" ? (o[a] ?? o[b] ?? null) : null;
const deny = (reason) => Object.freeze({version: VERSION, eligible: false, reason, recommendationAdmissionAllowed: false, requiresAtomicTaxonomyAssignment: true, executionEnabled: false});
const term = (v, version, axis) => { const x = txt(v); const p = `${version}:${axis}:`; return x != null && x.startsWith(p) && /^[a-z0-9][a-z0-9_]*$/.test(x.slice(p.length)); };

export function resolveCatalogOnlyProductPromotionEligibility({candidate, classification, expectedTaxonomyVersion = "catalog-taxonomy-v1"} = {}) {
  const id = txt(candidate?.id);
  if (!id) return deny("MISSING_CANDIDATE_ID");
  if (!txt(get(candidate,"canonicalName","canonical_name")) || !txt(get(candidate,"canonicalBrand","canonical_brand"))) return deny("CANONICAL_IDENTITY_MISSING");
  if (txt(get(candidate,"reviewStatus","review_status")) !== "approved") return deny("CANDIDATE_NOT_APPROVED");
  if (txt(get(candidate,"identityResolutionState","identity_resolution_state")) !== "resolved" || txt(get(candidate,"identityResolutionVersion","identity_resolution_version")) !== "crawler-identity-resolution-v1") return deny("IDENTITY_CONTRACT_INVALID");
  if (txt(get(candidate,"serviceCategory","service_category")) != null || txt(get(candidate,"productForm","product_form")) != null) return deny("LEGACY_FIELDS_PRESENT");
  if (!classification || typeof classification !== "object") return deny("MISSING_CLASSIFICATION");
  if (txt(get(classification,"candidateId","candidate_id")) !== id) return deny("CANDIDATE_CLASSIFICATION_ID_MISMATCH");
  const version = txt(get(classification,"taxonomyVersion","taxonomy_version"));
  if (version !== expectedTaxonomyVersion) return deny("TAXONOMY_VERSION_MISMATCH");
  if (txt(get(classification,"classificationState","classification_state")) !== "active_shadow") return deny("CLASSIFICATION_STATE_NOT_ACTIVE");
  if (txt(get(classification,"classificationMethod","classification_method")) !== "source_rule_v1") return deny("CLASSIFICATION_METHOD_INVALID");
  const rule = txt(get(classification,"sourceRuleKey","source_rule_key"));
  if (!rule) return deny("SOURCE_RULE_KEY_MISSING");
  if (txt(get(classification,"sourceNameSnapshot","source_name_snapshot")) !== txt(get(candidate,"sourceName","source_name")) || txt(get(classification,"categoryPathSnapshot","category_path_snapshot")) !== txt(get(candidate,"categoryPath","category_path"))) return deny("STALE_CLASSIFICATION_SNAPSHOT");
  if (txt(get(classification,"legacyCategorySnapshot","legacy_category_snapshot")) != null || txt(get(classification,"legacyProductFormSnapshot","legacy_product_form_snapshot")) != null || txt(get(classification,"legacyProjectionKey","legacy_projection_key")) != null) return deny("LEGACY_PROJECTION_STATE_PRESENT");
  const e = txt(get(classification,"entityKindTermId","entity_kind_term_id"));
  const d = txt(get(classification,"domainTermId","domain_term_id"));
  const r = txt(get(classification,"recommendationFamilyTermId","recommendation_family_term_id"));
  const c = txt(get(classification,"categoryTermId","category_term_id"));
  const f = txt(get(classification,"formTermId","form_term_id"));
  if (!term(e,version,"entity_kind") || !term(d,version,"domain") || !term(r,version,"recommendation_family") || !term(c,version,"category") || (f != null && !term(f,version,"form"))) return deny("CANONICAL_TERM_SET_INVALID");
  if (get(classification,"productWriteAllowed","product_write_allowed") !== false || get(classification,"productPromotionAllowed","product_promotion_allowed") !== false || get(classification,"recommendationAdmissionAllowed","recommendation_admission_allowed") !== false) return deny("CLASSIFIER_BOUNDARY_DRIFT");
  return Object.freeze({version: VERSION, eligible: true, reason: "CATALOG_ONLY_PROMOTION_ELIGIBLE", candidateId: id, recommendationAdmissionAllowed: false, requiresAtomicTaxonomyAssignment: true, executionEnabled: false, assignmentPlan: Object.freeze({taxonomyVersion: version, entityKindTermId: e, domainTermId: d, recommendationFamilyTermId: r, categoryTermId: c, formTermId: f, legacyProjectionKey: null, assignmentState: "shadow", assignmentMethod: "candidate_source_rule_catalog_only_adoption_v1"})});
}
