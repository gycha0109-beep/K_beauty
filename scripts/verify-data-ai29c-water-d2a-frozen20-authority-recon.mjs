#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const artifact = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d2a-frozen20-authority-recon-v1.json",
    "utf8",
  ),
);
const prospective = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-c6g-prospective-protection-shadow-input-v1.json",
    "utf8",
  ),
);
const waterB = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-b-evidence-frontier-v1.json",
    "utf8",
  ),
);
const dayDew = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-d1-day-dew-controlled-expansion-v1.json",
    "utf8",
  ),
);

assert.equal(
  artifact.version,
  "data-ai29c-water-d2a-frozen20-authority-recon-v1",
);
assert.equal(artifact.stage, "DATA-AI29C-WATER-D2A");
assert.equal(artifact.track, "taxonomy-ai");
assert.equal(artifact.productionProject, "bygrczggxfuisupcevaz");

assert.equal(
  artifact.registry.registryVersion,
  waterB.registry.registryVersion,
);
assert.equal(artifact.registry.factKey, waterB.registry.factKey);
assert.equal(
  artifact.registry.definitionChecksum,
  waterB.registry.definitionChecksum,
);
assert.deepEqual(artifact.registry.allowedUnits, waterB.registry.allowedUnits);

assert.equal(prospective.records.length, 20);
assert.equal(artifact.entryState.frozenProspectiveCorpusCount, 20);
assert.equal(artifact.entryState.frozenProspectiveDenominatorRebased, false);
assert.equal(artifact.entryState.existingFrozenGovernedWaterEligibleCount, 1);
assert.equal(artifact.entryState.frozenCoverageBeforeRecon, "1/20");

const anessaId = "cbcd06a2-de29-47ca-afd1-ab1d5de93903";
assert.deepEqual(
  artifact.entryState.existingFrozenGovernedWaterEligibleProductIds,
  [anessaId],
);
assert.deepEqual(
  artifact.researchScope.excludedAlreadyGovernedFrozenProductIds,
  [anessaId],
);

const prospectiveIds = prospective.records.map((record) => record.product_id);
const expectedTargets = prospectiveIds.filter((id) => id !== anessaId).sort();
assert.equal(artifact.researchScope.targetCount, 19);
assert.deepEqual(
  [...artifact.researchScope.targetProductIds].sort(),
  expectedTargets,
);
assert.equal(artifact.targets.length, 19);
assert.deepEqual(
  artifact.targets.map((target) => target.productId).sort(),
  expectedTargets,
);
assert.equal(
  new Set(artifact.targets.map((target) => target.subjectId)).size,
  19,
);

assert.equal(artifact.sourceBindingAudit.firstPartyBoundTargetCount, 18);
assert.equal(artifact.sourceBindingAudit.equivalentScopeTargetCount, 17);
assert.equal(artifact.sourceBindingAudit.narrowerScopeTargetCount, 1);
assert.equal(artifact.sourceBindingAudit.firstPartySourceGapCount, 1);
assert.deepEqual(
  artifact.sourceBindingAudit.firstPartySourceGapProductIds,
  ["df32d800-2f16-4511-8efa-dc353ea1c2ef"],
);

const bushman = artifact.targets.find(
  (target) => target.productId === "4608b3b4-8b51-4464-b46e-380b05c1a3d7",
);
assert.ok(bushman);
assert.equal(bushman.observedWaterSignal, "Waterproof Pro Suncream");
assert.equal(bushman.directNumericDurationClaim, null);
assert.equal(bushman.confirmationEligible, false);
assert.equal(
  bushman.decision,
  "HOLD_GENERIC_WATERPROOF_NO_DURATION_MAPPING",
);

const fully = artifact.targets.find(
  (target) => target.productId === "df32d800-2f16-4511-8efa-dc353ea1c2ef",
);
assert.ok(fully);
assert.equal(fully.officialSource, null);
assert.equal(fully.confirmationEligible, false);
assert.equal(
  fully.decision,
  "HOLD_FIRST_PARTY_SOURCE_NOT_ESTABLISHED",
);

assert.equal(
  artifact.targets.filter(
    (target) => target.decision === "HOLD_NO_EXPLICIT_DURATION_AUTHORITY",
  ).length,
  17,
);
assert.equal(
  artifact.targets.filter((target) => target.confirmationEligible).length,
  0,
);
assert.equal(
  artifact.targets.filter(
    (target) => target.directNumericDurationClaim !== null,
  ).length,
  0,
);

assert.deepEqual(artifact.researchOutcome, {
  directConfirmationEligibleTargetCount: 0,
  newGovernedSemanticMappingCandidateCount: 0,
  genericWaterproofHoldCount: 1,
  noExplicitDurationAuthorityCount: 17,
  firstPartySourceGapCount: 1,
  frozenGovernedWaterEligibleAfterRecon: 1,
  frozenCoverageAfterRecon: "1/20",
  d2bGovernedAdoptionRequired: false,
  reason:
    "No additional frozen-20 exact Subject has a first-party, registry-admissible water-resistance duration or governed label-to-duration mapping candidate. BUSHMAN remains a generic waterproof-word HOLD and FULLY remains a first-party source gap.",
});

assert.equal(
  prospective.records.some(
    (record) => record.product_id === dayDew.identity.productId,
  ),
  false,
  "Day Dew must remain outside the frozen prospective 20-product corpus",
);
assert.equal(
  artifact.entryState.outOfCorpusGovernedWaterFactCount,
  1,
);
assert.deepEqual(
  artifact.entryState.outOfCorpusGovernedWaterProducts,
  [dayDew.identity.productId],
);

for (const value of Object.values(artifact.semanticBoundaries)) {
  assert.equal(value, true);
}

assert.deepEqual(artifact.limits, {
  productFactWritten: false,
  evidenceRecordWritten: false,
  reviewAssignmentWritten: false,
  confirmationWritten: false,
  registryChanged: false,
  sourceBindingWritten: false,
  productQueryIntentSchemaMutated: false,
  protectionScorerWired: false,
  waterAxisActivated: false,
  waterRankingWired: false,
  productionRankingChanged: false,
  productionCutoverAuthorized: false,
  outdoorRankableSignalAuthorized: false,
  publicActivation: false,
  persistence: false,
  spfProductionStateMutated: false,
});

assert.equal(
  artifact.decision,
  "WATER_D2A_FROZEN20_RECON_HOLD_NO_NEW_ADMISSIBLE_DURATION_AUTHORITY",
);
assert.equal(
  artifact.nextGate,
  "NO_D2B_ADOPTION_RESOLVE_SOURCE_GAPS_OR_COMPLETE_SEPARATE_GOVERNED_RESEARCH",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: artifact.stage,
    targetCount: artifact.researchScope.targetCount,
    directConfirmationEligible:
      artifact.researchOutcome.directConfirmationEligibleTargetCount,
    firstPartySourceGap:
      artifact.researchOutcome.firstPartySourceGapCount,
    frozenWaterCoverage:
      artifact.researchOutcome.frozenCoverageAfterRecon,
    d2bGovernedAdoptionRequired:
      artifact.researchOutcome.d2bGovernedAdoptionRequired,
    decision: artifact.decision,
  }),
);
