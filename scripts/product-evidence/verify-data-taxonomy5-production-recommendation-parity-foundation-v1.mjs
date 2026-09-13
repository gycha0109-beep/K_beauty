import assert from "node:assert/strict";
import fs from "node:fs";

const files = {
  evidence: "evidence/catalog-taxonomy-v1/data-taxonomy5-production-recommendation-parity-v1.json",
  migration: "supabase/migrations/20260913152500_data_taxonomy5_recommendation_shadow_replay_v1.sql",
  reader: "lib/catalog-taxonomy-recommendation-shadow-reader.js",
  replay: "lib/catalog-taxonomy-recommendation-shadow-replay.js",
  oidc: "lib/catalog-taxonomy-recommendation-shadow-probe-oidc.js",
  route: "app/api/internal/catalog-taxonomy-recommendation-shadow-replay/route.js",
  workflow: ".github/workflows/data-taxonomy5-production-recommendation-parity.yml",
};

for (const file of Object.values(files)) assert.ok(fs.existsSync(file), `missing DATA-TAXONOMY5 file: ${file}`);

const evidence = JSON.parse(fs.readFileSync(files.evidence, "utf8"));
const migration = fs.readFileSync(files.migration, "utf8");
const reader = fs.readFileSync(files.reader, "utf8");
const replay = fs.readFileSync(files.replay, "utf8");
const oidc = fs.readFileSync(files.oidc, "utf8");
const route = fs.readFileSync(files.route, "utf8");
const workflow = fs.readFileSync(files.workflow, "utf8");

assert.equal(evidence.schema_version, "data-taxonomy5-production-recommendation-parity-v1");
assert.equal(evidence.issue, 479);
assert.equal(evidence.foundation_pr, 480);
assert.equal(evidence.cardinality_hardening_pr, 481);
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
assert.equal(evidence.foundation.raw_product_select_granted, false);
assert.equal(evidence.foundation.raw_taxonomy_select_granted, false);
assert.equal(evidence.foundation.anon_execute_granted, false);
assert.equal(evidence.foundation.authenticated_execute_granted, false);
assert.equal(evidence.foundation.service_role_execute_granted, false);
assert.equal(evidence.foundation.runtime_execute_granted, true);
assert.equal(evidence.foundation.production_overlay_count, 165);
assert.equal(evidence.foundation.production_distinct_product_count, 165);
assert.equal(evidence.foundation.production_overlay_only_count, 0);
assert.equal(evidence.foundation.production_product_without_overlay_count, 0);
assert.equal(evidence.foundation.production_invalid_taxonomy_state_count, 0);
assert.equal(evidence.foundation.runtime_probe_enabled_before_migration, false);

assert.equal(evidence.replay_contract.uses_actual_get_recommendation_products, true);
assert.equal(evidence.replay_contract.uses_actual_recommendation_scoring, true);
assert.equal(evidence.replay_contract.uses_actual_rank_comparator, true);
assert.equal(evidence.replay_contract.scenario_count, 8);
assert.equal(evidence.replay_contract.expected_product_count, evidence.production_product_count);
assert.equal(evidence.replay_contract.requires_exact_recommendation_corpus_count, true);
assert.equal(evidence.replay_contract.requires_exact_overlay_count, true);
assert.equal(evidence.replay_contract.requires_zero_overlay_only_rows, true);
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
  "products.length === DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT",
  "probe.rows.length === DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT",
  "overlayOnlyCount === 0",
  "scenarioResults.length === SCENARIOS.length",
  "getRecommendationProducts()",
  "runCatalogTaxonomyRecommendationShadowSecurityProbe()",
  "scoreCanonicalProduct(product, scenario)",
  "sort(compareRankedProducts)",
  "getProductCategorySlot(projected)",
  "recommendationRuntimeCutover: false",
]) assert.ok(replay.includes(marker), `replay contract drifted: ${marker}`);

for (const marker of [
  '"urn:bejewely:data-taxonomy5:production-recommendation-parity"',
  '".github/workflows/data-taxonomy5-production-recommendation-parity.yml"',
  'payload?.event_name !== "push"',
  "payload?.workflow_sha !== expectedDeploymentSha",
  "payload?.sha !== expectedDeploymentSha",
  'payload?.runner_environment !== "github-hosted"',
]) assert.ok(oidc.includes(marker), `OIDC boundary drifted: ${marker}`);

for (const marker of [
  "verifyDataTaxonomy5GitHubActionsOidcToken",
  "getDataTaxonomy5BearerTokenFromRequest",
  "runCatalogTaxonomyRecommendationShadowReplay",
  "deploymentRef !== \"main\"",
  "secretValueExposed: false",
]) assert.ok(route.includes(marker), `route contract drifted: ${marker}`);

for (const marker of [
  "deployments: read",
  "id-token: write",
  "DATA_TAXONOMY5 deployed Production replay",
  "DATA_TAXONOMY5_OIDC_AUDIENCE: urn:bejewely:data-taxonomy5:production-recommendation-parity",
  "select(.sha == \\\"$GITHUB_SHA\\\")",
  "x-vercel-trusted-oidc-idp-token",
  "/api/internal/catalog-taxonomy-recommendation-shadow-replay",
  "payload.deploymentSha !== expectedSha",
  "payload.expectedProductCount !== 165",
  "payload.recommendationProductCount !== 165",
  "payload.overlayCount !== 165",
  "payload.scenarioCount !== 8",
  "payload.recommendationRuntimeCutover !== false",
  "payload.secretValueExposed !== false",
]) assert.ok(workflow.includes(marker), `deployed replay workflow drifted: ${marker}`);

assert.equal(evidence.deployed_probe_contract.enabled_after_production_rpc_readback, true);
assert.equal(evidence.deployed_probe_contract.workflow, files.workflow);
assert.equal(evidence.deployed_probe_contract.oidc_audience, "urn:bejewely:data-taxonomy5:production-recommendation-parity");
assert.equal(evidence.deployed_probe_contract.requires_push_event, true);
assert.equal(evidence.deployed_probe_contract.requires_main_ref, true);
assert.equal(evidence.deployed_probe_contract.requires_exact_deployment_sha, true);
assert.equal(evidence.deployed_probe_contract.requires_exact_vercel_deployment, true);
assert.equal(evidence.deployed_probe_contract.requires_http_200, true);
assert.equal(evidence.deployed_probe_contract.requires_replay_pass, true);
assert.equal(evidence.deployed_probe_contract.requires_product_count, 165);
assert.equal(evidence.deployed_probe_contract.requires_overlay_count, 165);
assert.equal(evidence.deployed_probe_contract.requires_scenario_count, 8);
assert.equal(evidence.deployed_probe_contract.requires_all_deltas_zero, true);
assert.equal(evidence.deployed_probe_contract.requires_recommendation_runtime_cutover_false, true);
assert.equal(evidence.deployed_probe_contract.requires_secret_value_exposed_false, true);

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
  product_count: evidence.production_product_count,
  exact_equivalent_count: evidence.production_exact_equivalent_count,
  expected_product_count: evidence.replay_contract.expected_product_count,
  scenario_count: evidence.replay_contract.scenario_count,
  production_overlay_count: evidence.foundation.production_overlay_count,
  deployed_probe_enabled: evidence.deployed_probe_contract.enabled_after_production_rpc_readback,
  recommendation_runtime_cutover: evidence.recommendation_runtime_cutover,
}, null, 2));
console.log("DATA-TAXONOMY5 foundation and deployed replay closure contract verified");