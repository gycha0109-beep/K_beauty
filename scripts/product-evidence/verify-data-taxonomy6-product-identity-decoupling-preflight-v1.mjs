import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const evidence = JSON.parse(read("evidence/catalog-taxonomy-v1/data-taxonomy6-product-identity-decoupling-preflight-v1.json"));
const taxonomyFoundation = read("supabase/migrations/20260913201050_data_taxonomy1_shadow_catalog_taxonomy_foundation_v1.sql");
const candidateTaxonomy = read("supabase/migrations/20260913202500_data_taxonomy2_candidate_manual_classification_v1.sql");
const promotionAuthority = read("supabase/migrations/20260822130309_crawler_canonical_adoption_authority_remediation_v1.sql");
const categoryNormalizer = read("lib/product-category-normalizer.js");
const productSource = read("lib/product-source.js");
const recommendationScoring = read("lib/recommendation-scoring.ts");

assert.equal(evidence.schema_version, "data-taxonomy6-product-identity-decoupling-preflight-v1");
assert.equal(evidence.issue, 486);
assert.equal(evidence.baseline_main_sha, "2921c701cf4454c1a262196e6fb74535a2370cc9");

const current = evidence.current_production;
assert.equal(current.product_count, 165);
assert.equal(current.products_category_type, "public.product_category");
assert.equal(current.products_category_nullable, false);
assert.equal(current.null_category_count, 0);
assert.equal(current.products_product_form_nullable, true);
assert.equal(current.null_product_form_count, 147);
assert.equal(current.taxonomy_assignment_count, 165);
assert.equal(current.taxonomy_exact_equivalent_count, 165);
assert.equal(current.taxonomy_non_exact_count, 0);
assert.equal(current.assignment_without_legacy_projection_count, 0);
assert.equal(current.recommendation_admitted_baseline, 164);
assert.equal(current.recommendation_runtime_cutover, false);
assert.equal(current.legacy_enum_contains_future_mask_makeup_tool_device_terms, false);

const existing = evidence.existing_canonical_representation;
assert.equal(existing.assignment_table, "public.product_catalog_taxonomy_assignments");
assert.equal(existing.legacy_projection_column, "legacy_projection_key");
assert.equal(existing.legacy_projection_nullable, true);
assert.equal(existing.new_sidecar_required, false);
assert.match(taxonomyFoundation, /create table public\.product_catalog_taxonomy_assignments/);
assert.match(taxonomyFoundation, /legacy_projection_key text,/);
assert.match(taxonomyFoundation, /category:mask/);
assert.match(taxonomyFoundation, /domain:makeup/);
assert.match(taxonomyFoundation, /entity_kind:tool/);
assert.match(taxonomyFoundation, /entity_kind:device/);
assert.match(candidateTaxonomy, /catalog-taxonomy-v1/);

const coupling = evidence.structural_coupling_inventory;
assert.deepEqual(coupling.direct_product_insert_authority, ["public.promote_product_candidate_structural_v1"]);
assert.equal(coupling.current_write_coupling, "product_candidates.service_category -> public.products.category");
assert.match(promotionAuthority, /create or replace function public\.promote_product_candidate_structural_v1/);
assert.match(promotionAuthority, /v_candidate\.service_category is null/);
assert.match(promotionAuthority, /insert into public\.products/i);
assert.match(promotionAuthority, /v_candidate\.service_category/);

assert.match(categoryNormalizer, /authorizesRecommendationCategory/);
assert.match(productSource, /getRecommendationProducts/);
assert.match(productSource, /authorizesRecommendationCategory/);
assert.match(recommendationScoring, /scoreCanonicalProduct/);
assert.match(recommendationScoring, /compareRankedProducts/);

const identity = evidence.identity_and_lineage;
assert.equal(identity.canonical_product_identity, "public.products.id");
assert.equal(identity.product_id_rewrite_required, false);
assert.equal(identity.preserve_product_fact_lineage, true);
assert.equal(identity.preserve_offer_lineage, true);
assert.ok(identity.foreign_key_dependents.includes("product_catalog_taxonomy_assignments.product_id"));
assert.ok(identity.foreign_key_dependents.includes("product_fact_subjects.product_id"));
assert.ok(identity.foreign_key_dependents.includes("product_offers.product_id"));

const target = evidence.selected_target_model;
assert.equal(target.canonical_identity, "public.products.id");
assert.equal(target.canonical_classification, "public.product_catalog_taxonomy_assignments");
assert.equal(target.target_category_nullable, true);
assert.equal(target.target_product_form_nullable, true);
assert.equal(target.recommendation_behavior_without_legacy_projection, "fail_closed_not_admitted");
assert.equal(target.expand_legacy_product_category_enum_for_future_taxonomy, false);
assert.equal(target.coerce_future_catalog_terms_to_nearest_legacy_category, false);

const parity = evidence.parity_semantics_after_decoupling;
assert.equal(parity.catalog_only_product_is_not_a_taxonomy_mismatch, true);
assert.match(parity.catalog_coverage, /every Product/i);
assert.match(parity.legacy_projection_exactness, /legacy projection/i);
assert.match(parity.recommendation_admission, /independently authorized/i);

assert.equal(evidence.staged_migration.length, 6);
assert.equal(evidence.staged_migration[0].stage, 0);
assert.equal(evidence.staged_migration[0].production_write, false);
assert.equal(evidence.staged_migration[2].requires_explicit_production_approval, true);
assert.equal(evidence.staged_migration[3].requires_explicit_production_approval, true);
assert.match(evidence.rollback.before_any_null_category_product_exists, /zero/i);
assert.match(evidence.rollback.after_catalog_only_product_exists, /Do not coerce/i);

for (const value of Object.values(evidence.mutation_scope)) assert.equal(value, false);
assert.ok(evidence.non_goals.includes("Recommendation taxonomy authority cutover"));
assert.ok(evidence.non_goals.includes("legacy enum expansion for mask/makeup/tools/devices"));

console.log("DATA-TAXONOMY6 Product identity decoupling preflight: PASS");
