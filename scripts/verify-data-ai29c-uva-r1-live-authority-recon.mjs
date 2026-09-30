#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const recon = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r1-live-authority-recon-v1.json",
    "utf8",
  ),
);
const d4 = JSON.parse(
  fs.readFileSync(
    "fixtures/data-ai29c-d4-uva-authority-recovery-review-v1.json",
    "utf8",
  ),
);

assert.equal(recon.version, "data-ai29c-uva-r1-live-authority-recon-v1");
assert.equal(recon.observedFromProduction, true);
assert.equal(recon.productionProject, "bygrczggxfuisupcevaz");
assert.equal(recon.track, "taxonomy-ai");
assert.equal(recon.factKey, "uva_label");

assert.equal(recon.comparableCorpus.count, 14);
assert.equal(recon.comparableCorpus.productIds.length, 14);
assert.equal(new Set(recon.comparableCorpus.productIds).size, 14);

assert.deepEqual(recon.comparableCorpus.uvaAuthority, {
  eligibleCount: 12,
  missingCount: 2,
  complete: false,
  labelDistribution: {
    "PA++++": 9,
    "PA+++": 1,
    "PA++": 2,
  },
  missingProductIds: [
    "9983f167-24e7-4223-bd86-446ce6ced31b",
    "fdf06871-db8e-4e73-a48c-c057c5ce925d",
  ],
});

assert.equal(
  Object.values(recon.comparableCorpus.uvaAuthority.labelDistribution)
    .reduce((sum, value) => sum + value, 0),
  recon.comparableCorpus.uvaAuthority.eligibleCount,
);

assert.equal(
  recon.registry.registryVersion,
  "product-fact-registry-cross-category-v1",
);
assert.equal(
  recon.registry.definitionChecksum,
  "11f1d398e1c460c8597357a162725c708c019d4efc8f3a42b312b5e46bfe43ae",
);
assert.equal(recon.registry.valueType, "enum");
assert.equal(
  recon.registry.semanticDefinition,
  "Market-scoped UVA protection label.",
);
assert.deepEqual(recon.registry.allowedValues, [
  "PA+",
  "PA++",
  "PA+++",
  "PA++++",
  "UVA-PF-declared",
]);
assert.equal(
  recon.registry.positiveEvidenceRequirement,
  "product-specific evidence",
);
assert.deepEqual(recon.registry.requiredScopeFields, ["market"]);
assert.equal(recon.registry.historicalUvaPfDeclaredInstanceCount, 0);

const reconTargets = [...recon.missingTargets].sort((a, b) =>
  a.productId.localeCompare(b.productId),
);
const d4Targets = [...d4.targets].sort((a, b) =>
  a.productId.localeCompare(b.productId),
);

assert.equal(reconTargets.length, 2);
assert.equal(d4Targets.length, 2);

for (let i = 0; i < reconTargets.length; i += 1) {
  const current = reconTargets[i];
  const previous = d4Targets[i];

  assert.equal(current.productId, previous.productId);
  assert.equal(current.subjectId, previous.subjectId);
  assert.equal(current.subjectSemanticKey, previous.subjectSemanticKey);
  assert.equal(current.variantKey, previous.variantKey);
  assert.equal(current.identityResolutionVersion, previous.identityResolutionVersion);
  assert.equal(current.market, previous.market);
  assert.equal(current.identityStatus, "resolved");
  assert.equal(current.currentState, "current");
  assert.equal(current.currentUvaFact, false);
}

assert.equal(
  d4.d4Status.decision,
  "UVA_AXIS_D4_HOLD_EXACT_SUBJECT_AUTHORITY_INCOMPLETE",
);
assert.equal(
  recon.continuity.previousD4Decision,
  d4.d4Status.decision,
);
assert.deepEqual(recon.continuity, {
  previousD4Decision: "UVA_AXIS_D4_HOLD_EXACT_SUBJECT_AUTHORITY_INCOMPLETE",
  sameComparableCorpusCount: true,
  sameMissingTargets: true,
  sameRegistryVersion: true,
  sameUvaPfDeclaredUsage: true,
  reconOutcome: "UNCHANGED",
});

assert.deepEqual(recon.limits, {
  productFactWritten: false,
  evidenceWritten: false,
  registryChanged: false,
  productionCandidateAdmissionWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  uvaActivated: false,
  waterResistanceApplied: false,
  spfProductionStateMutated: false,
});

assert.equal(
  recon.decision,
  "UVA_R1_LIVE_RECON_PASS_R2_EXACT_SUBJECT_RESEARCH_REQUIRED",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: "DATA-AI29C-UVA-R1",
  comparableCorpusCount: recon.comparableCorpus.count,
  uvaEligibleCount: recon.comparableCorpus.uvaAuthority.eligibleCount,
  missingProductIds: recon.comparableCorpus.uvaAuthority.missingProductIds,
  decision: recon.decision,
}));
