export const CATALOG_EXPANSION_SELECTION_POLICY_V1 = Object.freeze({
  version: 'catalog-expansion-selection-policy-v1',
  stage: 'V2.1-8F',
  targetFloor: 3,
  weights: Object.freeze({
    categoryGap: 40,
    recommendationLogs: 15,
    sourceRankings: 10,
    identityReadiness: 15,
    registryOpportunity: 15,
    evidenceDiscoveryReadiness: 5,
  }),
  priorityP0Threshold: 60,
  brandCap: 2,
  nonblockingPenalties: Object.freeze([]),
  sourceRankingComponent: Object.freeze({
    status: 'unavailable',
    score: 0,
    reason: 'source_rankings has candidate_id only and current product_candidates.matched_product_id count is zero; no defensible product-level mapping',
  }),
  wave1CategoryQuota: Object.freeze([
    Object.freeze({ category: 'cleanser', quota: 4 }),
    Object.freeze({ category: 'toner_essence', quota: 3 }),
    Object.freeze({ category: 'moisturizer_lotion_emulsion', quota: 2 }),
    Object.freeze({ category: 'moisturizer_gel', quota: 2 }),
    Object.freeze({ category: 'toner_pad', quota: 1 }),
  ]),
  candidateFactFamilies: Object.freeze({
    cleanser: Object.freeze(['low_ph', 'deep_cleansing', 'fragrance_declared']),
    toner_essence: Object.freeze(['product_format', 'contains_active', 'recommended_use_frequency', 'wipe_off_use']),
    toner_pad: Object.freeze(['product_format', 'contains_active', 'pad_surface_texture', 'wipe_off_use', 'recommended_use_frequency']),
    moisturizer_lotion_emulsion: Object.freeze(['primary_use_role', 'barrier_support_claim', 'contains_active', 'active_concentration']),
    moisturizer_gel: Object.freeze(['primary_use_role', 'barrier_support_claim', 'contains_active', 'active_concentration']),
  }),
  tieBreak: Object.freeze([
    'priority_score DESC',
    'recommendation_relevance_score DESC',
    'category_adopted_count ASC',
    'identity_readiness_score DESC',
    'registry_opportunity_score DESC',
    'normalized_brand ASC',
    'normalized_name ASC',
    'product_id ASC',
  ]),
  semantics: Object.freeze({
    selectionMeaning: 'priority for next Product Fact evidence research only',
    evidenceAuthority: false,
    productFactAssertion: false,
    randomSampling: false,
    llmRanking: false,
  }),
});

export function round6(value) {
  return Number(Number(value).toFixed(6));
}

export function compareCodepointAsc(a, b) {
  const aa = String(a ?? '');
  const bb = String(b ?? '');
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return 0;
}

export function compareCandidates(a, b) {
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  if (b.recommendation_relevance_score !== a.recommendation_relevance_score) return b.recommendation_relevance_score - a.recommendation_relevance_score;
  if (a.category_adopted_count !== b.category_adopted_count) return a.category_adopted_count - b.category_adopted_count;
  if (b.identity_readiness_score !== a.identity_readiness_score) return b.identity_readiness_score - a.identity_readiness_score;
  if (b.registry_opportunity_score !== a.registry_opportunity_score) return b.registry_opportunity_score - a.registry_opportunity_score;
  return compareCodepointAsc(a.normalized_brand, b.normalized_brand)
    || compareCodepointAsc(a.normalized_name, b.normalized_name)
    || compareCodepointAsc(a.product_id, b.product_id);
}

// Exact-head CI trigger after canonical Wave 1 planning outputs were frozen.
