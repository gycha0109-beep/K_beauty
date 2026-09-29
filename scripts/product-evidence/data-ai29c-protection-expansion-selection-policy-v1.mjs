export const DATA_AI29C_PROTECTION_EXPANSION_POLICY_V1 = Object.freeze({
  version: "data-ai29c-protection-expansion-selection-v1",
  stage: "DATA-AI29C-C5",
  waveSize: 8,
  taxonomyVersion: "catalog-taxonomy-v1",
  categoryTermId: "catalog-taxonomy-v1:category:sunscreen",
  brandCap: 1,
  weights: Object.freeze({
    spfNon50Lead: 40,
    uvaNonPa4Lead: 35,
    waterDurationLead: 45,
    waterClaimResearchLead: 20,
    sourceEvidencePerObservation: 2,
    sourceEvidenceMax: 10,
    identityComponent: 4,
    identityMax: 16,
  }),
  semantics: Object.freeze({
    candidateSourceAuthority: false,
    discoveryLeadIsProductFact: false,
    discoveryLeadIsRecommendationSignal: false,
    waterClaimResearchLeadIsDurationEvidence: false,
    planningMayPromoteProducts: false,
    planningMayWriteProductFacts: false,
    planningMayChangeRecommendation: false,
    productionCutoverAuthorized: false,
    outdoorRankableSignalAuthorized: false,
  }),
  tieBreak: Object.freeze([
    "lead_score DESC",
    "priority_score DESC",
    "recommendation_relevance_score DESC",
    "evidence_readiness_score DESC",
    "normalized_brand ASC",
    "normalized_name ASC",
    "candidate_id ASC",
  ]),
});

export function compareCodepointAsc(a, b) {
  const aa = String(a ?? "");
  const bb = String(b ?? "");
  if (aa < bb) return -1;
  if (aa > bb) return 1;
  return 0;
}

export function compareProtectionExpansionCandidates(a, b) {
  if (b.lead_score !== a.lead_score) return b.lead_score - a.lead_score;
  if (b.priority_score !== a.priority_score) return b.priority_score - a.priority_score;
  if (b.recommendation_relevance_score !== a.recommendation_relevance_score) {
    return b.recommendation_relevance_score - a.recommendation_relevance_score;
  }
  if (b.evidence_readiness_score !== a.evidence_readiness_score) {
    return b.evidence_readiness_score - a.evidence_readiness_score;
  }
  return compareCodepointAsc(a.normalized_brand, b.normalized_brand)
    || compareCodepointAsc(a.normalized_name, b.normalized_name)
    || compareCodepointAsc(a.candidate_id, b.candidate_id);
}
