import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveCatalogOnlyProductPromotionEligibility } from "../../lib/catalog-only-product-promotion-eligibility.mjs";

const evidencePath = "evidence/catalog-taxonomy-v1/data-taxonomy10-catalog-only-product-promotion-eligibility-v1.json";
const resolverPath = "lib/catalog-only-product-promotion-eligibility.mjs";
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const resolverSource = fs.readFileSync(resolverPath, "utf8");

assert.equal(evidence.schema_version, "data-taxonomy10-catalog-only-product-promotion-eligibility-v1");
assert.equal(evidence.issue, 497);
assert.equal(evidence.baseline_main_sha, "d5413c606e2f245fa357c3bbd802bc42f85922ae");
assert.equal(evidence.production_baseline.product_count, 165);
assert.equal(evidence.production_baseline.category_null_count, 0);
assert.equal(evidence.production_baseline.taxonomy_assignment_count, 165);
assert.equal(evidence.production_baseline.taxonomy_exact_equivalent_count, 165);
assert.equal(evidence.production_baseline.recommendation_product_count, 164);
assert.equal(evidence.contract.pure, true);
assert.equal(evidence.contract.database_access, false);
assert.equal(evidence.contract.network_access, false);
assert.equal(evidence.contract.execution_enabled, false);
assert.equal(evidence.contract.recommendation_admission_allowed, false);
assert.equal(evidence.contract.requires_atomic_taxonomy_assignment, true);
assert.equal(evidence.atomic_adoption_boundary.future_product_insert_and_taxonomy_assignment_same_transaction, true);
assert.equal(evidence.atomic_adoption_boundary.catalog_only_product_without_assignment_allowed, false);
for (const value of Object.values(evidence.mutation_scope_now)) assert.equal(value, false);

assert.doesNotMatch(resolverSource, /process\.env|fetch\s*\(|supabase|postgres|execute_sql/i);
assert.doesNotMatch(resolverSource, /\b(insert|update|delete|truncate|alter table)\b/i);

const baseCandidate = Object.freeze({
  id: "11111111-1111-4111-8111-111111111111",
  canonical_name: "Catalog Only Fixture",
  canonical_brand: "Fixture Brand",
  review_status: "approved",
  identity_resolution_state: "resolved",
  identity_resolution_version: "crawler-identity-resolution-v1",
  source_name: "fixture-source",
  category_path: "future_active_fixture",
  service_category: null,
  product_form: null
});

const baseClassification = Object.freeze({
  candidate_id: baseCandidate.id,
  taxonomy_version: "catalog-taxonomy-v1",
  source_name_snapshot: baseCandidate.source_name,
  category_path_snapshot: baseCandidate.category_path,
  legacy_category_snapshot: null,
  legacy_product_form_snapshot: null,
  classification_state: "active_shadow",
  classification_method: "source_rule_v1",
  source_rule_key: "fixture-source:future_active_fixture",
  legacy_projection_key: null,
  entity_kind_term_id: "catalog-taxonomy-v1:entity_kind:product",
  domain_term_id: "catalog-taxonomy-v1:domain:beauty",
  recommendation_family_term_id: "catalog-taxonomy-v1:recommendation_family:catalog_only_fixture",
  category_term_id: "catalog-taxonomy-v1:category:catalog_only_fixture",
  form_term_id: null,
  product_write_allowed: false,
  product_promotion_allowed: false,
  recommendation_admission_allowed: false
});

const good = resolveCatalogOnlyProductPromotionEligibility({ candidate: baseCandidate, classification: baseClassification });
assert.equal(good.eligible, true);
assert.equal(good.reason, "CATALOG_ONLY_PROMOTION_ELIGIBLE");
assert.equal(good.recommendationAdmissionAllowed, false);
assert.equal(good.requiresAtomicTaxonomyAssignment, true);
assert.equal(good.executionEnabled, false);
assert.equal(good.assignmentPlan.legacyProjectionKey, null);
assert.equal(good.assignmentPlan.assignmentState, "shadow");

const cases = [
  ["candidate_not_approved", {candidate:{...baseCandidate,review_status:"needs_review"},classification:baseClassification}, "CANDIDATE_NOT_APPROVED"],
  ["identity_invalid", {candidate:{...baseCandidate,identity_resolution_state:"unresolved"},classification:baseClassification}, "IDENTITY_CONTRACT_INVALID"],
  ["wrong_taxonomy_version", {candidate:baseCandidate,classification:{...baseClassification,taxonomy_version:"catalog-taxonomy-v2"}}, "TAXONOMY_VERSION_MISMATCH"],
  ["reserved_taxonomy", {candidate:baseCandidate,classification:{...baseClassification,classification_state:"reserved_shadow"}}, "CLASSIFICATION_STATE_NOT_ACTIVE"],
  ["unresolved_taxonomy", {candidate:baseCandidate,classification:{...baseClassification,classification_state:"unresolved"}}, "CLASSIFICATION_STATE_NOT_ACTIVE"],
  ["non_source_rule", {candidate:baseCandidate,classification:{...baseClassification,classification_method:"manual_legacy_projection_v1"}}, "CLASSIFICATION_METHOD_INVALID"],
  ["stale_snapshot", {candidate:baseCandidate,classification:{...baseClassification,category_path_snapshot:"stale"}}, "STALE_CLASSIFICATION_SNAPSHOT"],
  ["legacy_fields_present", {candidate:{...baseCandidate,service_category:"cleanser"},classification:baseClassification}, "LEGACY_FIELDS_PRESENT"],
  ["legacy_projection_present", {candidate:baseCandidate,classification:{...baseClassification,legacy_projection_key:"legacy:cleanser"}}, "LEGACY_PROJECTION_STATE_PRESENT"],
  ["missing_term", {candidate:baseCandidate,classification:{...baseClassification,category_term_id:null}}, "CANONICAL_TERM_SET_INVALID"],
  ["candidate_id_mismatch", {candidate:baseCandidate,classification:{...baseClassification,candidate_id:"22222222-2222-4222-8222-222222222222"}}, "CANDIDATE_CLASSIFICATION_ID_MISMATCH"],
  ["classifier_boundary_drift", {candidate:baseCandidate,classification:{...baseClassification,product_write_allowed:true}}, "CLASSIFIER_BOUNDARY_DRIFT"]
];

for (const [id, input, expectedReason] of cases) {
  const result = resolveCatalogOnlyProductPromotionEligibility(input);
  assert.equal(result.eligible, false, id);
  assert.equal(result.reason, expectedReason, id);
  assert.equal(result.recommendationAdmissionAllowed, false, id);
  assert.equal(result.executionEnabled, false, id);
}

const evidenceById = new Map(evidence.scenarios.map((item) => [item.id, item]));
assert.equal(evidenceById.get("positive_catalog_only")?.eligible, true);
for (const [id,,expectedReason] of cases) {
  assert.equal(evidenceById.get(id)?.eligible, false, `missing evidence scenario ${id}`);
  assert.equal(evidenceById.get(id)?.reason, expectedReason, `evidence reason ${id}`);
}

console.log("DATA-TAXONOMY10 catalog-only Product promotion eligibility: PASS");
