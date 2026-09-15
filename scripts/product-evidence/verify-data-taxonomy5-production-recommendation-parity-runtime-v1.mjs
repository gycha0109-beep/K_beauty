import assert from "node:assert/strict";
import fs from "node:fs";

const workflowPath = ".github/workflows/v21-admission-g3a-pf-authority-read.yml";
const routePath = "app/api/internal/catalog-taxonomy-recommendation-shadow-replay/route.js";
const replayPath = "lib/catalog-taxonomy-recommendation-shadow-replay.js";
const readerPath = "lib/catalog-taxonomy-recommendation-shadow-reader.js";
const cardinalityPath = "lib/catalog-taxonomy-recommendation-shadow-cardinality-v2.mjs";

for (const file of [workflowPath, routePath, replayPath, readerPath, cardinalityPath]) {
  assert.ok(fs.existsSync(file), `missing Recommendation parity runtime file: ${file}`);
}

const workflow = fs.readFileSync(workflowPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const replay = fs.readFileSync(replayPath, "utf8");
const reader = fs.readFileSync(readerPath, "utf8");
const cardinality = fs.readFileSync(cardinalityPath, "utf8");

for (const marker of [
  "catalog-taxonomy-recommendation-shadow-replay",
  "/api/internal/catalog-taxonomy-recommendation-shadow-replay",
  "payload.expectedLegacyExactOverlayCount !== 165",
  "payload.expectedRecommendationProductCount !== 164",
  "payload.expectedProductCount !== 165 + payload.catalogOnlyShadowCount",
  "payload.expectedOverlayOnlyCount !== 1 + payload.catalogOnlyShadowCount",
  "payload.overlayCount !== payload.expectedProductCount",
  "payload.recommendationProductCount !== 164",
  "payload.exactEquivalentCount !== 165",
  "payload.nonExactOverlayCount !== payload.catalogOnlyShadowCount",
  "payload.invalidOverlayCount !== 0",
  "payload.catalogOnlyRecommendationLeakCount !== 0",
  "payload.overlayOnlyCount !== payload.expectedOverlayOnlyCount",
  "payload.overlayOnlyNonLegacyCount !== payload.expectedOverlayOnlyCount",
  "payload.overlayOnlyCatalogOnlyCount !== payload.catalogOnlyShadowCount",
  "payload.missingLegacyLiveCount !== 0",
  "payload.unexpectedLiveCount !== 0",
  "payload.scenarioCount !== 8",
  "payload.recommendationRuntimeCutover !== false",
  "payload.rawProductSelectDenied !== true",
  "payload.rawTaxonomySelectDenied !== true",
  "payload.secretValueExposed !== false",
]) assert.ok(workflow.includes(marker), `runtime workflow contract drifted: ${marker}`);

for (const marker of [
  "@/lib/server/recommendation-candidate-admission-runtime",
  "verifyG3AGitHubActionsOidcToken",
  "deploymentRef !== \"main\"",
  "runCatalogTaxonomyRecommendationShadowReplay",
  "secretValueExposed: false",
]) assert.ok(route.includes(marker), `runtime route contract drifted: ${marker}`);

for (const marker of [
  "DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT = LEGACY_RECOMMENDATION_CORPUS_COUNT",
  "evaluateCatalogTaxonomyOverlayCardinality",
  "LEGACY_RECOMMENDATION_CORPUS_IDS",
  "cardinality.pass",
  "overlay.exactEquivalent !== true || overlay.catalogOnlyShadowValid === true",
  "scenarioResults.length === SCENARIOS.length",
  "getRecommendationProducts()",
  "scoreCanonicalProduct(product, scenario)",
  "sort(compareRankedProducts)",
  "getProductCategorySlot(projected)",
  "recommendationRuntimeCutover: false",
]) assert.ok(replay.includes(marker), `runtime replay contract drifted: ${marker}`);

for (const marker of [
  "select id from public.products limit 1",
  "select product_id from public.catalog_taxonomy_product_exact_equivalence_v1 limit 1",
  "recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2()",
  "catalogOnlyShadowValid: row.catalog_only_shadow_valid === true",
]) assert.ok(reader.includes(marker), `runtime reader contract drifted: ${marker}`);

for (const marker of [
  "DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT = 165",
  "DATA_TAXONOMY15_BASE_OVERLAY_ONLY_COUNT = 1",
  "catalogOnlyRecommendationLeakCount === 0",
  "invalidOverlayCount === 0",
  "nonExactOverlayCount === catalogOnlyShadowCount",
]) assert.ok(cardinality.includes(marker), `cardinality contract drifted: ${marker}`);

console.log(JSON.stringify({
  status: "PASS",
  legacyExactOverlayBaselineCount: 165,
  recommendationProductCount: 164,
  baseOverlayOnlyCount: 1,
  catalogOnlyShadowExtension: "dynamic_fail_closed",
  expectedScenarioCount: 8,
  runtimeAuthorityCutover: false,
  oidcBoundary: "existing-g3a-workflow",
}, null, 2));
console.log("Recommendation parity deployed replay wiring verified");
