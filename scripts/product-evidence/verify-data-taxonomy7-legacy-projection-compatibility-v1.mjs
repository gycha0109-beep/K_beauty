import assert from "node:assert/strict";
import fs from "node:fs";
import {
  CATALOG_PRODUCT_LEGACY_PROJECTION_COMPATIBILITY_VERSION,
  LEGACY_PROJECTION_COMPATIBILITY_STATUS,
  resolveCatalogProductLegacyProjectionCompatibility,
} from "../../lib/catalog-product-legacy-projection-compatibility.mjs";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/catalog-taxonomy-v1/data-taxonomy7-legacy-projection-compatibility-v1.json",
    "utf8",
  ),
);
const resolverSource = fs.readFileSync(
  "lib/catalog-product-legacy-projection-compatibility.mjs",
  "utf8",
);

assert.equal(evidence.schema_version, "data-taxonomy7-legacy-projection-compatibility-v1");
assert.equal(evidence.issue, 488);
assert.equal(evidence.baseline_main_sha, "53eac9a76094a4c927ced4217532194369bb53e7");
assert.equal(
  CATALOG_PRODUCT_LEGACY_PROJECTION_COMPATIBILITY_VERSION,
  evidence.contract.version,
);
assert.deepEqual(Object.values(LEGACY_PROJECTION_COMPATIBILITY_STATUS), evidence.contract.statuses);
assert.equal(evidence.production_baseline.product_count, 165);
assert.equal(evidence.production_baseline.taxonomy_assignment_count, 165);
assert.equal(evidence.production_baseline.taxonomy_exact_equivalent_count, 165);
assert.equal(evidence.production_baseline.recommendation_admitted_baseline, 164);
assert.equal(evidence.production_baseline.products_category_nullable, false);
assert.equal(evidence.production_baseline.recommendation_runtime_cutover, false);
assert.equal(evidence.contract.pure_side_effect_free, true);
assert.equal(evidence.contract.database_access, false);
assert.equal(evidence.contract.network_access, false);
assert.equal(evidence.contract.environment_access, false);
assert.equal(evidence.contract.legacy_projection_grants_recommendation_admission, false);
assert.doesNotMatch(resolverSource, /\bfetch\s*\(/);
assert.doesNotMatch(resolverSource, /createClient|supabase|postgres|process\.env/);

const projectedAssignment = {
  productId: "11111111-1111-4111-8111-111111111111",
  taxonomyVersion: "catalog-taxonomy-v1",
  assignmentState: "shadow",
  entityKindTermId: "catalog-taxonomy-v1:entity_kind:cosmetic",
  domainTermId: "catalog-taxonomy-v1:domain:skincare",
  recommendationFamilyTermId: "catalog-taxonomy-v1:recommendation_family:sunscreen",
  categoryTermId: "catalog-taxonomy-v1:category:sunscreen",
  formTermId: null,
  legacyProjectionKey: "legacy:sunscreen:none",
};
const projectedProduct = {
  id: projectedAssignment.productId,
  category: "sunscreen",
  product_form: null,
};
const projectedProjection = {
  projectionKey: "legacy:sunscreen:none",
  taxonomyVersion: "catalog-taxonomy-v1",
  legacyCategory: "sunscreen",
  legacyProductForm: null,
};

const validLegacy = resolveCatalogProductLegacyProjectionCompatibility({
  product: projectedProduct,
  assignment: projectedAssignment,
  projection: projectedProjection,
});
assert.equal(validLegacy.status, "LEGACY_PROJECTED");
assert.equal(validLegacy.reason, "EXACT_LEGACY_PROJECTION");
assert.equal(validLegacy.hasLegacyRecommendationProjection, true);
assert.equal(validLegacy.grantsRecommendationAdmission, false);

const treatmentAssignment = {
  ...projectedAssignment,
  productId: "22222222-2222-4222-8222-222222222222",
  recommendationFamilyTermId: "catalog-taxonomy-v1:recommendation_family:treatment",
  categoryTermId: "catalog-taxonomy-v1:category:treatment",
  formTermId: "catalog-taxonomy-v1:form:serum",
  legacyProjectionKey: "legacy:treatment:serum",
};
const treatment = resolveCatalogProductLegacyProjectionCompatibility({
  product: { id: treatmentAssignment.productId, category: "treatment", product_form: "serum" },
  assignment: treatmentAssignment,
  projection: {
    projectionKey: "legacy:treatment:serum",
    taxonomyVersion: "catalog-taxonomy-v1",
    legacyCategory: "treatment",
    legacyProductForm: "serum",
  },
});
assert.equal(treatment.status, "LEGACY_PROJECTED");
assert.equal(treatment.grantsRecommendationAdmission, false);

const catalogOnlyAssignment = {
  product_id: "33333333-3333-4333-8333-333333333333",
  taxonomy_version: "catalog-taxonomy-v1",
  assignment_state: "shadow",
  entity_kind_term_id: "catalog-taxonomy-v1:entity_kind:cosmetic",
  domain_term_id: "catalog-taxonomy-v1:domain:skincare",
  recommendation_family_term_id: "catalog-taxonomy-v1:recommendation_family:mask",
  category_term_id: "catalog-taxonomy-v1:category:mask",
  form_term_id: null,
  legacy_projection_key: null,
};
const catalogOnly = resolveCatalogProductLegacyProjectionCompatibility({
  product: { id: catalogOnlyAssignment.product_id, category: null, product_form: null },
  assignment: catalogOnlyAssignment,
});
assert.equal(catalogOnly.status, "CATALOG_ONLY");
assert.equal(catalogOnly.reason, "NO_LEGACY_PROJECTION");
assert.equal(catalogOnly.hasLegacyRecommendationProjection, false);
assert.equal(catalogOnly.grantsRecommendationAdmission, false);

const coerced = resolveCatalogProductLegacyProjectionCompatibility({
  product: { id: catalogOnlyAssignment.product_id, category: "moisturizer", product_form: null },
  assignment: catalogOnlyAssignment,
});
assert.equal(coerced.status, "INVALID");
assert.equal(coerced.reason, "LEGACY_FIELDS_WITHOUT_PROJECTION");

const missingProjection = resolveCatalogProductLegacyProjectionCompatibility({
  product: projectedProduct,
  assignment: projectedAssignment,
});
assert.equal(missingProjection.status, "INVALID");
assert.equal(missingProjection.reason, "MISSING_REFERENCED_LEGACY_PROJECTION");

const keyMismatch = resolveCatalogProductLegacyProjectionCompatibility({
  product: projectedProduct,
  assignment: projectedAssignment,
  projection: { ...projectedProjection, projectionKey: "legacy:other:none" },
});
assert.equal(keyMismatch.status, "INVALID");
assert.equal(keyMismatch.reason, "LEGACY_PROJECTION_KEY_MISMATCH");

const idMismatch = resolveCatalogProductLegacyProjectionCompatibility({
  product: { ...projectedProduct, id: "44444444-4444-4444-8444-444444444444" },
  assignment: projectedAssignment,
  projection: projectedProjection,
});
assert.equal(idMismatch.status, "INVALID");
assert.equal(idMismatch.reason, "PRODUCT_ASSIGNMENT_ID_MISMATCH");

const fieldMismatch = resolveCatalogProductLegacyProjectionCompatibility({
  product: { ...projectedProduct, category: "moisturizer" },
  assignment: projectedAssignment,
  projection: projectedProjection,
});
assert.equal(fieldMismatch.status, "INVALID");
assert.equal(fieldMismatch.reason, "LEGACY_PROJECTION_FIELDS_MISMATCH");

const malformedTerms = resolveCatalogProductLegacyProjectionCompatibility({
  product: projectedProduct,
  assignment: { ...projectedAssignment, categoryTermId: "catalog-taxonomy-v1:domain:sunscreen" },
  projection: projectedProjection,
});
assert.equal(malformedTerms.status, "INVALID");
assert.equal(malformedTerms.reason, "CANONICAL_ASSIGNMENT_TERMS_INVALID");

assert.equal(evidence.required_scenarios.length, 9);
assert.equal(evidence.invariants.catalog_only_never_coerces_to_legacy, true);
assert.equal(evidence.invariants.legacy_projection_must_be_exact, true);
assert.equal(evidence.invariants.resolver_never_grants_recommendation_admission, true);
assert.equal(evidence.invariants.legacy_enum_expansion, false);
for (const value of Object.values(evidence.mutation_scope)) assert.equal(value, false);

console.log("DATA-TAXONOMY7 legacy projection compatibility contract: PASS");
