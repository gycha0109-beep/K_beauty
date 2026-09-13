import "server-only";
import { getRecommendationProducts } from "@/lib/product-source";
import {
  compareRankedProducts,
  getProductCategorySlot,
  scoreCanonicalProduct,
} from "@/lib/recommendation-scoring";
import {
  LEGACY_RECOMMENDATION_CORPUS_COUNT,
  LEGACY_RECOMMENDATION_CORPUS_IDS,
} from "@/lib/recommendation-legacy-corpus-v1.mjs";
import { runCatalogTaxonomyRecommendationShadowSecurityProbe } from "@/lib/catalog-taxonomy-recommendation-shadow-reader";

export const DATA_TAXONOMY5_REPLAY_VERSION = "data-taxonomy5-production-recommendation-parity-v1";
export const DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT = 165;
export const DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT = LEGACY_RECOMMENDATION_CORPUS_COUNT;
export const DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT =
  DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT - DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT;

const SCENARIOS = Object.freeze([
  Object.freeze({ id: "oiliness", skinType: "oily", sensitivity: "medium", mainConcerns: ["oiliness", "pores"], preferredTexture: "gel", afternoonSkinChange: "more_oily" }),
  Object.freeze({ id: "pores", skinType: "combination", sensitivity: "medium", mainConcerns: ["pores", "oiliness"], preferredTexture: "watery", mostDislikedFeel: "heavy" }),
  Object.freeze({ id: "acne", skinType: "oily", sensitivity: "high", mainConcerns: ["acne", "redness"], preferredTexture: "watery", verySensitivePeriod: true }),
  Object.freeze({ id: "dehydration", skinType: "dry", sensitivity: "medium", mainConcerns: ["dehydration", "barrier"], preferredTexture: "cream", postWashFeeling: "tight" }),
  Object.freeze({ id: "barrier", skinType: "sensitive", sensitivity: "high", mainConcerns: ["barrier", "redness"], preferredTexture: "lotion", verySensitivePeriod: true }),
  Object.freeze({ id: "redness", skinType: "sensitive", sensitivity: "high", mainConcerns: ["redness", "barrier"], preferredTexture: "watery", afternoonSkinChange: "red_or_irritated" }),
  Object.freeze({ id: "uneven_tone", skinType: "normal", sensitivity: "low", mainConcerns: ["uneven_tone", "dehydration"], preferredTexture: "lotion" }),
  Object.freeze({ id: "uv-outdoor", skinType: "combination", sensitivity: "medium", mainConcerns: ["uv", "dehydration"], preferredTexture: "gel", outdoorExposure: true, sunscreenIntent: true, explicitCategoryIntent: "sunscreen" }),
]);

function nullable(value) {
  return value == null || value === "" ? null : String(value);
}

function sortAndScore(products, scenario) {
  return products.map((product) => scoreCanonicalProduct(product, scenario)).sort(compareRankedProducts);
}

export async function runCatalogTaxonomyRecommendationShadowReplay() {
  const [products, probe] = await Promise.all([
    getRecommendationProducts(),
    runCatalogTaxonomyRecommendationShadowSecurityProbe(),
  ]);

  const overlayById = new Map();
  let duplicateOverlayCount = 0;
  for (const row of probe.rows) {
    if (overlayById.has(row.productId)) duplicateOverlayCount += 1;
    overlayById.set(row.productId, row);
  }

  const projectedProducts = [];
  let unmatchedProductCount = 0;
  let legacyIdentityMismatchCount = 0;
  let nonExactOverlayCount = 0;
  let invalidTaxonomyStateCount = 0;

  for (const row of probe.rows) {
    if (!row.exactEquivalent) nonExactOverlayCount += 1;
    if (row.taxonomyVersion !== "catalog-taxonomy-v1" || row.taxonomyLifecycleState !== "shadow" || row.taxonomyAuthorityMode !== "shadow_only") invalidTaxonomyStateCount += 1;
  }

  for (const product of products) {
    const overlay = overlayById.get(String(product.id));
    if (!overlay) {
      unmatchedProductCount += 1;
      continue;
    }
    if (nullable(product.category) !== nullable(overlay.legacyCategory) || nullable(product.product_form) !== nullable(overlay.legacyProductForm)) {
      legacyIdentityMismatchCount += 1;
    }
    projectedProducts.push(Object.freeze({
      ...product,
      category: overlay.projectedLegacyCategory,
      product_form: overlay.projectedLegacyProductForm,
    }));
  }

  const liveIds = new Set(products.map((product) => String(product.id)));
  const expectedLiveIds = new Set(LEGACY_RECOMMENDATION_CORPUS_IDS);
  const overlayOnlyRows = probe.rows.filter((row) => !liveIds.has(row.productId));
  const overlayOnlyCount = overlayOnlyRows.length;
  const missingLegacyLiveCount = LEGACY_RECOMMENDATION_CORPUS_IDS.filter((id) => !liveIds.has(id)).length;
  const unexpectedLiveCount = [...liveIds].filter((id) => !expectedLiveIds.has(id)).length;
  const overlayOnlyNonLegacyCount = overlayOnlyRows.filter((row) => !expectedLiveIds.has(row.productId)).length;
  const scenarioResults = [];
  let scoreDeltaCount = 0;
  let slotDeltaCount = 0;
  let fullOrderDeltaCount = 0;
  let top1DeltaCount = 0;
  let top3DeltaCount = 0;

  if (
    products.length === DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT &&
    probe.rows.length === DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT &&
    overlayOnlyCount === DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT &&
    overlayOnlyNonLegacyCount === DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT &&
    missingLegacyLiveCount === 0 &&
    unexpectedLiveCount === 0 &&
    unmatchedProductCount === 0 &&
    projectedProducts.length === products.length
  ) {
    for (const scenario of SCENARIOS) {
      const legacyRanked = sortAndScore(products, scenario);
      const projectedRanked = sortAndScore(projectedProducts, scenario);
      const projectedById = new Map(projectedRanked.map((product) => [String(product.id), product]));

      for (const legacy of legacyRanked) {
        const projected = projectedById.get(String(legacy.id));
        if (!projected || projected.score !== legacy.score || projected.score_breakdown?.category_priority !== legacy.score_breakdown?.category_priority || projected.score_breakdown?.outdoor_sunscreen_bonus !== legacy.score_breakdown?.outdoor_sunscreen_bonus) scoreDeltaCount += 1;
        if (!projected || getProductCategorySlot(projected) !== getProductCategorySlot(legacy)) slotDeltaCount += 1;
      }

      const legacyOrder = legacyRanked.map((product) => String(product.id));
      const projectedOrder = projectedRanked.map((product) => String(product.id));
      const fullOrderEqual = JSON.stringify(projectedOrder) === JSON.stringify(legacyOrder);
      const top1Equal = projectedOrder[0] === legacyOrder[0];
      const top3Equal = JSON.stringify(projectedOrder.slice(0, 3)) === JSON.stringify(legacyOrder.slice(0, 3));
      if (!fullOrderEqual) fullOrderDeltaCount += 1;
      if (!top1Equal) top1DeltaCount += 1;
      if (!top3Equal) top3DeltaCount += 1;
      scenarioResults.push(Object.freeze({ id: scenario.id, fullOrderEqual, top1Equal, top3Equal }));
    }
  }

  const pass = probe.credentialAvailable && probe.runtimeRoleMatch && probe.rawProductSelectDenied && probe.rawTaxonomySelectDenied && products.length === DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT && probe.rows.length === DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT && overlayOnlyCount === DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT && overlayOnlyNonLegacyCount === DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT && missingLegacyLiveCount === 0 && unexpectedLiveCount === 0 && duplicateOverlayCount === 0 && nonExactOverlayCount === 0 && invalidTaxonomyStateCount === 0 && unmatchedProductCount === 0 && legacyIdentityMismatchCount === 0 && projectedProducts.length === products.length && scenarioResults.length === SCENARIOS.length && scoreDeltaCount === 0 && slotDeltaCount === 0 && fullOrderDeltaCount === 0 && top1DeltaCount === 0 && top3DeltaCount === 0;

  return Object.freeze({
    result: pass ? "PASS" : "FAIL_CLOSED",
    replayVersion: DATA_TAXONOMY5_REPLAY_VERSION,
    expectedProductCount: DATA_TAXONOMY5_EXPECTED_PRODUCT_COUNT,
    expectedRecommendationProductCount: DATA_TAXONOMY5_EXPECTED_RECOMMENDATION_PRODUCT_COUNT,
    expectedOverlayOnlyCount: DATA_TAXONOMY5_EXPECTED_OVERLAY_ONLY_COUNT,
    credentialAvailable: probe.credentialAvailable,
    runtimeRoleMatch: probe.runtimeRoleMatch,
    rawProductSelectDenied: probe.rawProductSelectDenied,
    rawTaxonomySelectDenied: probe.rawTaxonomySelectDenied,
    overlayCount: probe.rows.length,
    recommendationProductCount: products.length,
    overlayOnlyCount,
    overlayOnlyNonLegacyCount,
    missingLegacyLiveCount,
    unexpectedLiveCount,
    duplicateOverlayCount,
    nonExactOverlayCount,
    invalidTaxonomyStateCount,
    unmatchedProductCount,
    legacyIdentityMismatchCount,
    scenarioCount: SCENARIOS.length,
    scoreDeltaCount,
    slotDeltaCount,
    fullOrderDeltaCount,
    top1DeltaCount,
    top3DeltaCount,
    scenarios: Object.freeze(scenarioResults),
    recommendationRuntimeCutover: false,
    secretValueExposed: false,
  });
}
