export const CATALOG_EXPANSION_SELECTION_POLICY_V2 = Object.freeze({
  version: 'catalog-expansion-selection-policy-v2',
  stage: 'V2.1-8F-R1',
  targetFloor: 3,
  batchSize: 12,
  excludedCategories: Object.freeze(['sunscreen', '__NULL__']),
  weights: Object.freeze({
    categoryFloorGap: 20,
    categoryCoverageGap: 20,
    recommendationRelevance: 25,
    identityReadiness: 15,
    registryOpportunity: 15,
    evidenceDiscoveryReadiness: 5,
  }),
  priorityP0Threshold: 60,
  recommendationEventThresholds: Object.freeze([[100,15],[50,13],[20,11],[10,9],[5,7],[1,4],[0,0]]),
  topPickThresholds: Object.freeze([[5,10],[2,8],[1,5],[0,0]]),
  discoveryScores: Object.freeze({ first_party_seed: 5, secondary_seed: 3, identity_only: 1, none: 0 }),
  riskPenalties: Object.freeze({ identityRisk: 15, unresolvedSubject: 10 }),
  tieBreak: Object.freeze([
    'priority_score DESC',
    'recommendation_relevance_score DESC',
    'category_adopted_count ASC',
    'identity_readiness_score DESC',
    'registry_opportunity_score DESC',
    'normalized_brand UTF8_BYTE_ASC',
    'normalized_name UTF8_BYTE_ASC',
    'product_id ASC',
  ]),
  semantics: Object.freeze({
    selectionMeaning: 'priority for next Product Fact evidence research only',
    recommendationTierScored: false,
    sourceSeedIsEvidenceAuthority: false,
    subjectCreationRequiredPenalty: 0,
    evidenceAuthority: false,
    productFactAssertion: false,
    randomSampling: false,
    llmRanking: false,
    hostedWrites: 0,
    externalEvidenceResearch: 0,
  }),
});

export function round2(value) {
  return Number(Number(value).toFixed(2));
}

export function thresholdScore(value, thresholds) {
  for (const [min, score] of thresholds) if (Number(value) >= min) return score;
  return 0;
}

export function compareUtf8(a, b) {
  return Buffer.compare(Buffer.from(String(a ?? ''), 'utf8'), Buffer.from(String(b ?? ''), 'utf8'));
}

export function compareCandidatesV2(a, b) {
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  if (b.recommendation_relevance_score !== a.recommendation_relevance_score) {
    return b.recommendation_relevance_score - a.recommendation_relevance_score;
  }
  if (a.category_adopted_count !== b.category_adopted_count) return a.category_adopted_count - b.category_adopted_count;
  if (b.identity_readiness_score !== a.identity_readiness_score) return b.identity_readiness_score - a.identity_readiness_score;
  if (b.registry_opportunity_score !== a.registry_opportunity_score) return b.registry_opportunity_score - a.registry_opportunity_score;
  return compareUtf8(a.normalized_brand, b.normalized_brand)
    || compareUtf8(a.normalized_name, b.normalized_name)
    || compareUtf8(a.product_id, b.product_id);
}
