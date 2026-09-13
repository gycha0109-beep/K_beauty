import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
  evidence: "evidence/catalog-taxonomy-v1/data-taxonomy5-production-recommendation-parity-v1.json",
  migration: "supabase/migrations/20260913152500_data_taxonomy5_recommendation_shadow_replay_v1.sql",
  reader: "lib/catalog-taxonomy-recommendation-shadow-reader.js",
  replay: "lib/catalog-taxonomy-recommendation-shadow-replay.js",
  route: "app/api/internal/catalog-taxonomy-recommendation-shadow-replay/route.js",
};

for (const file of Object.values(files)) assert.ok(fs.existsSync(file), `missing DATA-TAXONOMY5 foundation file: ${file}`);

const evidence = JSON.parse(fs.readFileSync(files.evidence, "utf8"));
const migration = fs.readFileSync(files.migration, "utf8");
const reader = fs.readFileSync(files.reader, "utf8");
const replay = fs.readFileSync(files.replay, "utf8");
const route = fs.readFileSync(files.route, "utf8");

assert.equal(evidence.schema_version, "data-taxonomy5-production-recommendation-parity-v1");
assert.equal(evidence.issue, 479);
assert.equal(evidence.foundation_pr, 480);
assert.equal(evidence.taxonomy_version, "catalog-taxonomy-v1");
assert.equal(evidence.taxonomy_lifecycle_state, "shadow");
assert.equal(evidence.taxonomy_authority_mode, "shadow_only");
assert.equal(evidence.recommendation_runtime_authority, "legacy_product_category_product_form");
assert.equal(evidence.recommendation_runtime_cutover, false);
assert.equal(evidence.production_product_count, 165);
assert.equal(evidence.production_exact_equivalent_count, 165);
assert.equal(evidence.production_non_exact_count, 0);
assert.equal(evidence.production_category_mismatch_count, 0);
assert.equal(evidence.production_form_mismatch_count, 0);
assert.equal(evidence.production_recommendation_product_count, 164);
assert.equal(evidence.production_overlay_only_count, 1);
assert.equal(evidence.production_overlay_only_nonlegacy_count, 1);
assert.equal(evidence.production_missing_legacy_live_count, 0);
assert.equal(evidence.production_unexpected_live_count, 0);
assert.equal(evidence.overlay_only_product.product_id, "08b85f37-b1fa-42d7-893a-0d4facb17878");
assert.equal(evidence.overlay_only_product.legacy_recommendation_corpus_member, false);
assert.equal(evidence.overlay_only_product.current_subject_resolved, true);
assert.deepEqual(evidence.overlay_only_product.current_fact_keys, ["spf_value", "uva_label"]);
assert.equal(evidence.overlay_only_product.current_nonlegacy_admission_disposition, "REJECTED");
assert.equal(evidence.overlay_only_product.current_nonlegacy_admission_reason, "REQUIRED_CURRENT_FACT_MISSING:contains_active");
assert.equal(evidence.foundation.runtime_probe_enabled_before_migration, false);
assert.equal(evidence.replay_contract.uses_actual_get_recommendation_products, true);
assert.equal(evidence.replay_contract.uses_actual_recommendation_scoring, true);
assert.equal(evidence.replay_contract.uses_actual_rank_comparator, true);
assert.equal(evidence.replay_contract.scenario_count, 8);
assert.equal(evidence.replay_contract.expected_catalog_product_count, evidence.production_product_count);
assert.equal(evidence.replay_contract.expected_recommendation_product_count, evidence.production_recommendation_product_count);
assert.equal(evidence.replay_contract.expected_overlay_count, evidence.production_product_count);
assert.equal(evidence.replay_contract.expected_overlay_only_count, evidence.production_overlay_only_count);
assert.equal(evidence.replay_contract.requires_exact_recommendation_legacy_id_set, true);
assert.equal(evidence.replay_contract.requires_exact_overlay_count, true);
assert.equal(evidence.replay_contract.requires_overlay_only_rows_to_be_nonlegacy, true);
for (const [key, value] of Object.entries(evidence.replay_contract)) {
  if (key.startsWith("required_") && key.endsWith("_delta")) assert.equal(value, 0, `${key} must remain zero`);
}

for (const marker of [
  "create schema if not exists recommendation_shadow",
  "security definer",
  "set search_path = ''",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from public",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from anon",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from authenticated",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from service_role",
  "grant execute on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() to recommendation_admission_runtime",
]) assert.ok(migration.includes(marker), `migration contract drifted: ${marker}`);

for (const marker of [
  "RECOMMENDATION_ADMISSION_DATABASE_URL_ENV",
  "RECOMMENDATION_ADMISSION_RUNTIME_ROLE",
  "recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1()",
  "select id from public.products limit 1",
  "select product_id from public.catalog_taxonomy_product_exact_equivalence_v1 limit 1",
]) assert.ok(reader.includes(marker), `reader contract drifted: ${marker}`);

for (const marker of [
  "DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT = 165",
  "DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT = LEGACY_RECOMMENDATION_CORPUS_COUNT",
  "DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT",
  "LEGACY_RECOMMENDATION_CORPUS_IDS",
  "products.length === DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT",
  "probe.rows.length === DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT",
  "overlayOnlyCount === DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT",
  "overlayOnlyNonLegacyCount === DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT",
  "missingLegacyLiveCount === 0",
  "unexpectedLiveCount === 0",
  "scenarioResults.length === SCENARIOS.length",
  "getRecommendationProducts()",
  "runCatalogTaxonomyRecommendationShadowSecurityProbe()",
  "scoreCanonicalProduct(product, scenario)",
  "sort(compareRankedProducts)",
  "getProductCategorySlot(projected)",
  "recommendationRuntimeCutover: false",
]) assert.ok(replay.includes(marker), `replay contract drifted: ${marker}`);

for (const marker of [
  "@/lib/server/recommendation-candidate-admission-runtime",
  "verifyG3AGitHubActionsOidcToken",
  "runCatalogTaxonomyRecommendationShadowReplay",
  "deploymentRef !== \"main\"",
  "secretValueExposed: false",
]) assert.ok(route.includes(marker), `route contract drifted: ${marker}`);

assert.deepEqual(evidence.mutation_scope, {
  product: false,
  product_fact: false,
  offer: false,
  recommendation_decision_path: false,
  production_business_data: false,
  schema_only_after_foundation_merge: true,
});

console.log(JSON.stringify({
  status: "PASS",
  catalog_product_count: evidence.production_product_count,
  recommendation_product_count: evidence.production_recommendation_product_count,
  exact_equivalent_count: evidence.production_exact_equivalent_count,
  overlay_only_count: evidence.production_overlay_only_count,
  scenario_count: evidence.replay_contract.scenario_count,
  runtime_probe_enabled_before_migration: evidence.foundation.runtime_probe_enabled_before_migration,
  recommendation_runtime_cutover: evidence.recommendation_runtime_cutover,
}, null, 2));
console.log("DATA-TAXONOMY5 foundation verified");
