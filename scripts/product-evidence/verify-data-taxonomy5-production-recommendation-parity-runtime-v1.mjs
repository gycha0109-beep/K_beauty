import assert from "node:assert/strict";
import fs from "node:fs";

const workflowPath = ".github/workflows/v21-admission-g3a-pf-authority-read.yml";
const routePath = "app/api/internal/catalog-taxonomy-recommendation-shadow-replay/route.js";
const replayPath = "lib/catalog-taxonomy-recommendation-shadow-replay.js";
const readerPath = "lib/catalog-taxonomy-recommendation-shadow-reader.js";

for (const file of [workflowPath, routePath, replayPath, readerPath]) {
  assert.ok(fs.existsSync(file), `missing DATA-TAXONOMY5 runtime file: ${file}`);
}

const workflow = fs.readFileSync(workflowPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
const replay = fs.readFileSync(replayPath, "utf8");
const reader = fs.readFileSync(readerPath, "utf8");

for (const marker of [
  "catalog-taxonomy-recommendation-shadow-replay",
  "/api/internal/catalog-taxonomy-recommendation-shadow-replay",
  "payload.expectedProductCount !== 165",
  "payload.expectedRecommendationProductCount !== 164",
  "payload.expectedOverlayOnlyCount !== 1",
  "payload.overlayCount !== 165",
  "payload.recommendationProductCount !== 164",
  "payload.overlayOnlyCount !== 1",
  "payload.overlayOnlyNonLegacyCount !== 1",
  "payload.missingLegacyLiveCount !== 0",
  "payload.unexpectedLiveCount !== 0",
  "payload.duplicateOverlayCount !== 0",
  "payload.nonExactOverlayCount !== 0",
  "payload.invalidTaxonomyStateCount !== 0",
  "payload.unmatchedProductCount !== 0",
  "payload.legacyIdentityMismatchCount !== 0",
  "payload.scenarioCount !== 8",
  "payload.scoreDeltaCount !== 0",
  "payload.slotDeltaCount !== 0",
  "payload.fullOrderDeltaCount !== 0",
  "payload.top1DeltaCount !== 0",
  "payload.top3DeltaCount !== 0",
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
  "scoreCanonicalProduct(product, scenario)",
  "sort(compareRankedProducts)",
  "getProductCategorySlot(projected)",
  "recommendationRuntimeCutover: false",
]) assert.ok(replay.includes(marker), `runtime replay contract drifted: ${marker}`);

for (const marker of [
  "select id from public.products limit 1",
  "select product_id from public.catalog_taxonomy_product_exact_equivalence_v1 limit 1",
  "recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v1()",
]) assert.ok(reader.includes(marker), `runtime reader contract drifted: ${marker}`);

console.log(JSON.stringify({
  status: "PASS",
  expectedProductCount: 165,
  expectedRecommendationProductCount: 164,
  expectedOverlayCount: 165,
  expectedOverlayOnlyCount: 1,
  expectedScenarioCount: 8,
  runtimeAuthorityCutover: false,
  oidcBoundary: "existing-g3a-workflow",
}, null, 2));
console.log("DATA-TAXONOMY5 deployed replay wiring verified");
