export const DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT = 165;
export const DATA_TAXONOMY15_BASE_OVERLAY_ONLY_COUNT = 1;

export function evaluateCatalogTaxonomyOverlayCardinality({ rows, liveIds, legacyCorpusIds }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const live = new Set([...liveIds].map(String));
  const legacy = new Set([...legacyCorpusIds].map(String));
  const overlayOnlyRows = safeRows.filter((row) => !live.has(String(row.productId)));
  const exactEquivalentCount = safeRows.filter((row) => row.exactEquivalent === true).length;
  const catalogOnlyShadowRows = safeRows.filter((row) => row.catalogOnlyShadowValid === true);
  const catalogOnlyShadowCount = catalogOnlyShadowRows.length;
  const nonExactOverlayCount = safeRows.length - exactEquivalentCount;
  const invalidOverlayCount = safeRows.filter(
    (row) => row.exactEquivalent !== true && row.catalogOnlyShadowValid !== true,
  ).length;
  const overlayOnlyCount = overlayOnlyRows.length;
  const overlayOnlyNonLegacyCount = overlayOnlyRows.filter(
    (row) => !legacy.has(String(row.productId)),
  ).length;
  const overlayOnlyCatalogOnlyCount = overlayOnlyRows.filter(
    (row) => row.catalogOnlyShadowValid === true,
  ).length;
  const missingLegacyLiveCount = [...legacy].filter((id) => !live.has(id)).length;
  const unexpectedLiveCount = [...live].filter((id) => !legacy.has(id)).length;
  const catalogOnlyRecommendationLeakCount = catalogOnlyShadowRows.filter(
    (row) => live.has(String(row.productId)),
  ).length;
  const expectedProductCount =
    DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT + catalogOnlyShadowCount;
  const expectedOverlayOnlyCount = DATA_TAXONOMY15_BASE_OVERLAY_ONLY_COUNT + catalogOnlyShadowCount;

  const pass =
    safeRows.length === expectedProductCount &&
    exactEquivalentCount === DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT &&
    nonExactOverlayCount === catalogOnlyShadowCount &&
    invalidOverlayCount === 0 &&
    overlayOnlyCount === expectedOverlayOnlyCount &&
    overlayOnlyNonLegacyCount === expectedOverlayOnlyCount &&
    overlayOnlyCatalogOnlyCount === catalogOnlyShadowCount &&
    missingLegacyLiveCount === 0 &&
    unexpectedLiveCount === 0 &&
    catalogOnlyRecommendationLeakCount === 0;

  return Object.freeze({
    pass,
    expectedProductCount,
    expectedLegacyExactOverlayCount: DATA_TAXONOMY15_LEGACY_EXACT_OVERLAY_BASELINE_COUNT,
    expectedOverlayOnlyCount,
    exactEquivalentCount,
    catalogOnlyShadowCount,
    nonExactOverlayCount,
    invalidOverlayCount,
    overlayOnlyCount,
    overlayOnlyNonLegacyCount,
    overlayOnlyCatalogOnlyCount,
    missingLegacyLiveCount,
    unexpectedLiveCount,
    catalogOnlyRecommendationLeakCount,
  });
}
