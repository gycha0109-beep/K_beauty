import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DATA_TAXONOMY15_BASE_OVERLAY_ONLY_COUNT,
  DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT,
  evaluateCatalogTaxonomyOverlayCardinality,
} from "../../lib/catalog-taxonomy-recommendation-shadow-cardinality-v2.mjs";

const migrationPath = "supabase/migrations/20260915161000_data_taxonomy15_recommendation_shadow_catalog_only_v2.sql";
const readerPath = "lib/catalog-taxonomy-recommendation-shadow-reader.js";
const replayPath = "lib/catalog-taxonomy-recommendation-shadow-replay.js";
const workflowPath = ".github/workflows/v21-admission-g3a-pf-authority-read.yml";

for (const file of [migrationPath, readerPath, replayPath, workflowPath]) {
  assert.ok(fs.existsSync(file), `missing DATA-TAXONOMY15 parity file: ${file}`);
}

const migration = fs.readFileSync(migrationPath, "utf8");
const reader = fs.readFileSync(readerPath, "utf8");
const replay = fs.readFileSync(replayPath, "utf8");
const workflow = fs.readFileSync(workflowPath, "utf8");

assert.equal(DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT, 165);
assert.equal(DATA_TAXONOMY15_BASE_OVERLAY_ONLY_COUNT, 1);

for (const marker of [
  "security definer",
  "set search_path = ''",
  "assignment_state = 'shadow'",
  "assignment_method = 'source_classification'",
  "legacy_projection_key is null",
  "projection_present is false",
  "legacy_category is null",
  "legacy_product_form is null",
  "taxonomy_lifecycle_state = 'shadow'",
  "taxonomy_authority_mode = 'shadow_only'",
  "catalog_only_shadow_valid",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from public",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from anon",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from authenticated",
  "revoke all on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() from service_role",
  "grant execute on function recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2() to recommendation_admission_runtime",
]) assert.ok(migration.includes(marker), `migration boundary missing: ${marker}`);

for (const forbidden of [
  /insert\s+into\s+public\.products/i,
  /update\s+public\.products/i,
  /delete\s+from\s+public\.products/i,
  /insert\s+into\s+public\.product_fact_/i,
  /update\s+public\.product_fact_/i,
  /insert\s+into\s+public\.recommendation/i,
  /update\s+public\.recommendation/i,
  /grant\s+execute[\s\S]+(?:public|anon|authenticated|service_role)/i,
]) assert.ok(!forbidden.test(migration), `migration crosses authority boundary: ${forbidden}`);

assert.ok(reader.includes("recommendation_shadow.read_catalog_taxonomy_recommendation_overlay_v2()"));
assert.ok(reader.includes("catalogOnlyShadowValid: row.catalog_only_shadow_valid === true"));
assert.ok(replay.includes("evaluateCatalogTaxonomyOverlayCardinality"));
assert.ok(replay.includes("overlay.exactEquivalent !== true || overlay.catalogOnlyShadowValid === true"));
assert.ok(workflow.includes("payload.expectedProductCount !== 165 + payload.catalogOnlyShadowCount"));
assert.ok(workflow.includes("payload.expectedOverlayOnlyCount !== 1 + payload.catalogOnlyShadowCount"));
assert.ok(workflow.includes("payload.catalogOnlyRecommendationLeakCount !== 0"));

const legacyIds = Array.from({ length: 164 }, (_, index) => `legacy-${index + 1}`);
const baselineRows = legacyIds.map((productId) => ({ productId, exactEquivalent: true, catalogOnlyShadowValid: false }));
baselineRows.push({ productId: "existing-overlay-only", exactEquivalent: true, catalogOnlyShadowValid: false });

const baseline = evaluateCatalogTaxonomyOverlayCardinality({
  rows: baselineRows,
  liveIds: new Set(legacyIds),
  legacyCorpusIds: legacyIds,
});
assert.equal(baseline.pass, true);
assert.equal(baseline.expectedProductCount, 165);
assert.equal(baseline.expectedOverlayOnlyCount, 1);
assert.equal(baseline.catalogOnlyShadowCount, 0);
assert.equal(baseline.nonExactOverlayCount, 0);

const catalogOnlyRows = [
  ...baselineRows,
  { productId: "catalog-only-1", exactEquivalent: false, catalogOnlyShadowValid: true },
];
const catalogOnly = evaluateCatalogTaxonomyOverlayCardinality({
  rows: catalogOnlyRows,
  liveIds: new Set(legacyIds),
  legacyCorpusIds: legacyIds,
});
assert.equal(catalogOnly.pass, true);
assert.equal(catalogOnly.expectedProductCount, 166);
assert.equal(catalogOnly.expectedOverlayOnlyCount, 2);
assert.equal(catalogOnly.exactEquivalentCount, 165);
assert.equal(catalogOnly.catalogOnlyShadowCount, 1);
assert.equal(catalogOnly.nonExactOverlayCount, 1);
assert.equal(catalogOnly.invalidOverlayCount, 0);
assert.equal(catalogOnly.catalogOnlyRecommendationLeakCount, 0);

const leaked = evaluateCatalogTaxonomyOverlayCardinality({
  rows: catalogOnlyRows,
  liveIds: new Set([...legacyIds, "catalog-only-1"]),
  legacyCorpusIds: legacyIds,
});
assert.equal(leaked.pass, false);
assert.equal(leaked.catalogOnlyRecommendationLeakCount, 1);
assert.equal(leaked.unexpectedLiveCount, 1);

const invalid = evaluateCatalogTaxonomyOverlayCardinality({
  rows: [
    ...baselineRows,
    { productId: "invalid-nonexact", exactEquivalent: false, catalogOnlyShadowValid: false },
  ],
  liveIds: new Set(legacyIds),
  legacyCorpusIds: legacyIds,
});
assert.equal(invalid.pass, false);
assert.equal(invalid.invalidOverlayCount, 1);

const extraLegacyProjection = evaluateCatalogTaxonomyOverlayCardinality({
  rows: [
    ...baselineRows,
    { productId: "unexpected-exact-overlay", exactEquivalent: true, catalogOnlyShadowValid: false },
  ],
  liveIds: new Set(legacyIds),
  legacyCorpusIds: legacyIds,
});
assert.equal(extraLegacyProjection.pass, false);
assert.equal(extraLegacyProjection.exactEquivalentCount, 166);

console.log(JSON.stringify({
  status: "PASS",
  baseline: {
    expectedProductCount: baseline.expectedProductCount,
    expectedOverlayOnlyCount: baseline.expectedOverlayOnlyCount,
  },
  firstCatalogOnly: {
    expectedProductCount: catalogOnly.expectedProductCount,
    expectedOverlayOnlyCount: catalogOnly.expectedOverlayOnlyCount,
    exactEquivalentCount: catalogOnly.exactEquivalentCount,
    catalogOnlyShadowCount: catalogOnly.catalogOnlyShadowCount,
  },
  failClosed: {
    recommendationLeakRejected: !leaked.pass,
    invalidOverlayRejected: !invalid.pass,
    unexpectedLegacyProjectionRejected: !extraLegacyProjection.pass,
  },
}, null, 2));
console.log("DATA-TAXONOMY15 catalog-only Recommendation parity extension verified");
