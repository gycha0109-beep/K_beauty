import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
  evidence: "evidence/catalog-taxonomy-v1/data-taxonomy5-production-recommendation-parity-v1.json",
  migrationV1: "supabase/migrations/20260913152500_data_taxonomy5_recommendation_shadow_replay_v1.sql",
  migrationV2: "supabase/migrations/20260915155629_data_taxonomy15_recommendation_shadow_catalog_only_v2.sql",
  reader: "lib/catalog-taxonomy-recommendation-shadow-reader.js",
  replay: "lib/catalog-taxonomy-recommendation-shadow-replay.js",
  cardinality: "lib/catalog-taxonomy-recommendation-shadow-cardinality-v2.mjs",
  route: "app/api/internal/catalog-taxonomy-recommendation-shadow-replay/route.js",
};

for (const file of Object.values(files)) assert.ok(fs.existsSync(file), `missing Recommendation parity foundation file: ${file}`);

const evidence = JSON.parse(fs.readFileSync(files.evidence, "utf8"));
const migrationV1 = fs.readFileSync(files.migrationV1, "utf8");
const migrationV2 = fs.readFileSync(files.migrationV2, "utf8");
const reader = fs.readFileSync(files.reader, "utf8");
const replay = fs.readFileSync(files.replay, "utf8");
const cardinality = fs.readFileSync(files.cardinality, "utf8");
const route = fs.readFileSync(files.route, "utf8");

// Preserve the closed DATA-TAXONOMY5 historical baseline as immutable evidence.
assert.equal(evidence.schema_version, "data-taxonomy5-production-recommendation-parity-v1");
assert.equal(evidence.issue, 479);
assert.equal(evidence.taxonomy_version, "catalog-taxonomy-v1");
assert.equal(evidence.taxonomy_lifecycle_state, "shadow");
assert.equal(evidence.taxonomy_authority_mode, "shadow_only");
assert.equal(evidence.recommendation_runtime_authority, "legacy_product_category_product_form");
assert.equal(evidence.recommendation_runtime_cutover, false);
assert.equal(evidence.production_product_count, 165);
assert.equal(evidence.production_exact_equivalent_count, 165);
assert.equal(evidence.production_recommendation_product_count, 164);
assert.equal(evidence.production_overlay_only_count, 1);
assert.equal(evidence.production_overlay_only_nonlegacy_count, 1);
assert.equal(evidence.production_missing_legacy_live_count, 0);
assert.equal(evidence.production_unexpected_live_count, 0);

for (const marker of [
  "security definer",
  "set search_path = ''",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from public",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from anon",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from authenticated",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() from service_role",
  "grant execute on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1() to recommendation_admission_runtime",
]) assert.ok(migrationV1.includes(marker), `historical v1 migration contract drifted: ${marker}`);

for (const marker of [
  "read_catalog_taxonomy_recommendation_overlay_v2",
  "assignment_method = 'source_classification'",
  "legacy_projection_key is null",
  "projection_present is false",
  "legacy_category is null",
  "legacy_product_form is null",
  "catalog_only_shadow_valid",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from service_role",
  "grant execute on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() to recommendation_admission_runtime",
]) assert.ok(migrationV2.includes(marker), `catalog-only v2 migration contract drifted: ${marker}`);

for (const marker of [
  "RECOMMENDATION_ADMISSION_DATABASE_URL_ENV",
  "RECOMMENDATION_ADMISSION_RUNTIME_ROLE",
  "recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2()",
  "catalogOnlyShadowValid: row.catalog_only_shadow_valid === true",
  "select id from public.products limit 1",
  "select product_id from public.catalog_taxonomy_product_exact_equivalence_v1 limit 1",
]) assert.ok(reader.includes(marker), `reader contract drifted: ${marker}`);

for (const marker of [
  "DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT = LEGACY_RECOMMENDATION_CORPUS_COUNT",
  "LEGACY_RECOMMENDATION_CORPUS_IDS",
  "evaluateCatalogTaxonomyOverlayCardinality",
  "cardinality.pass",
  "getRecommendationProducts()",
  "runCatalogTaxonomyRecommendationShadowSecurityProbe()",
  "scoreCanonicalProduct(product, scenario)",
  "sort(compareRankedProducts)",
  "getProductCategorySlot(projected)",
  "recommendationRuntimeCutover: false",
]) assert.ok(replay.includes(marker), `replay contract drifted: ${marker}`);

for (const marker of [
  "DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT = 165",
  "DATA_TAXONOMY15_BASE_OVERLAY_ONLY_COUNT = 1",
  "catalogOnlyRecommendationLeakCount === 0",
  "invalidOverlayCount === 0",
]) assert.ok(cardinality.includes(marker), `cardinality contract drifted: ${marker}`);

for (const marker of [
  "@/lib/server/recommendation-candidate-admission-runtime",
  "verifyG3AGitHubActionsOidcToken",
  "runCatalogTaxonomyRecommendationShadowReplay",
  "deploymentRef !== \"main\"",
  "secretValueExposed: false",
]) assert.ok(route.includes(marker), `route contract drifted: ${marker}`);

console.log(JSON.stringify({
  status: "PASS",
  historicalCatalogProductCount: evidence.production_product_count,
  historicalRecommendationProductCount: evidence.production_recommendation_product_count,
  historicalExactEquivalentCount: evidence.production_exact_equivalent_count,
  catalogOnlyParityExtension: true,
  recommendationRuntimeCutover: false,
}, null, 2));
console.log("Recommendation parity foundation verified");
