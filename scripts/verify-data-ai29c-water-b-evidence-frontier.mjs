#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const waterA = JSON.parse(
  fs.readFileSync("fixtures/data-ai29c-water-a-intent-contract-v1.json", "utf8"),
);
const waterB = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-water-b-evidence-frontier-v1.json",
    "utf8",
  ),
);

assert.equal(
  waterA.decision,
  "WATER_A_CANONICAL_INTENT_CONTRACT_FROZEN_RUNTIME_NOT_WIRED",
);

assert.equal(waterB.version, "data-ai29c-water-b-evidence-frontier-v1");
assert.equal(waterB.track, "taxonomy-ai");
assert.equal(waterB.productionProject, "bygrczggxfuisupcevaz");

assert.deepEqual(waterB.registry, {
  registryVersion: "product-fact-registry-cross-category-v1",
  factKey: "water_resistance_duration",
  definitionChecksum:
    "14510b53371121c1edc552f33155edc7fc5c9d44e509ed85d9589e65da6542ee",
  valueType: "number_unit",
  allowedUnits: ["minutes"],
  semanticDefinition:
    "Established water-resistance duration with explicit time unit.",
  permittedEvidenceClasses: ["product_claim", "measurement"],
  positiveEvidenceRequirement: "product-specific evidence",
  requiredQualifierContextFields: ["metric", "method_context", "timepoint"],
});

assert.deepEqual(waterB.productionBaseline, {
  prospectiveCorpusCount: 20,
  currentFactInstanceCount: 0,
  supportedFactInstanceCount: 0,
  productSpecificPrimaryFactInstanceCount: 0,
  currentFactCount: 0,
  evidenceRecordCount: 0,
  reviewAssignmentCount: 0,
});

const anessa = waterB.currentCorpusCandidates.find(
  (candidate) =>
    candidate.productId === "cbcd06a2-de29-47ca-afd1-ab1d5de93903",
);
assert.ok(anessa);
assert.equal(anessa.subjectId, "d1d748c3-8706-4b6c-8719-676f6f317532");
assert.equal(anessa.market, "JP");
assert.equal(anessa.productEvidence.identityMatch, "exact");
assert.equal(anessa.productEvidence.observedClaim, "UV耐水性★★");
assert.equal(anessa.productEvidence.directNumericDurationClaim, null);
assert.equal(anessa.semanticAuthority.waterImmersionConditionMinutes, 80);
assert.equal(anessa.semanticAuthority.condition, "20 minutes x 4");
assert.equal(anessa.candidateProjection.valueNumber, 80);
assert.equal(anessa.candidateProjection.valueUnit, "minutes");
assert.equal(anessa.directConfirmationEligible, false);
assert.equal(anessa.governedSemanticMappingCandidate, true);
assert.equal(
  anessa.decision,
  "REVIEW_LABEL_TO_DURATION_MAPPING_BEFORE_FACT_ADOPTION",
);

const bushman = waterB.currentCorpusCandidates.find(
  (candidate) =>
    candidate.productId === "4608b3b4-8b51-4464-b46e-380b05c1a3d7",
);
assert.ok(bushman);
assert.equal(bushman.subjectId, "0b5963bb-67d6-4738-a620-32ec86c1e3d0");
assert.equal(bushman.market, "KR");
assert.equal(bushman.productEvidence.identityMatch, "exact");
assert.equal(bushman.productEvidence.directNumericDurationClaim, null);
assert.equal(bushman.candidateProjection, null);
assert.equal(bushman.directConfirmationEligible, false);
assert.equal(bushman.governedSemanticMappingCandidate, false);
assert.equal(bushman.decision, "HOLD_NO_EXPLICIT_DURATION_AUTHORITY");

assert.equal(waterB.outOfCorpusDiscovery.length, 1);
const dayDew = waterB.outOfCorpusDiscovery[0];
assert.equal(dayDew.brand, "Beauty of Joseon");
assert.equal(dayDew.currentCatalogProductFound, false);
assert.equal(dayDew.durationMinutes, 80);
assert.equal(
  dayDew.decision,
  "CATALOG_EXPANSION_CANDIDATE_NOT_TRANSFERABLE_TO_EXISTING_BOJ_SUBJECTS",
);

for (const key of [
  "waterproofWordToDurationForbidden",
  "superWaterproofWordToDurationForbidden",
  "sweatResistanceToWaterDurationForbidden",
  "jciaUvWaterResistanceDoesNotRepresentSweatResistance",
  "outOfCorpusProductClaimTransferForbidden",
  "missingDurationToZeroForbidden",
  "missingDurationToNonWaterproofForbidden",
]) {
  assert.equal(waterB.semanticBoundaries[key], true);
}

assert.deepEqual(waterB.researchOutcome, {
  directConfirmationEligibleCurrentSubjectCount: 0,
  governedSemanticMappingCandidateCount: 1,
  holdCurrentSubjectCount: 1,
  catalogExpansionCandidateCount: 1,
  factAdoptionPerformed: false,
  nextGate: "WATER_B1_GOVERNED_LABEL_TO_DURATION_MAPPING_REVIEW",
});

assert.ok(Object.values(waterB.limits).every((value) => value === false));
assert.equal(
  waterB.decision,
  "WATER_B_EVIDENCE_FRONTIER_PASS_SEMANTIC_MAPPING_REVIEW_REQUIRED",
);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: "DATA-AI29C-WATER-B",
    directConfirmationEligible:
      waterB.researchOutcome.directConfirmationEligibleCurrentSubjectCount,
    semanticMappingCandidates:
      waterB.researchOutcome.governedSemanticMappingCandidateCount,
    nextGate: waterB.researchOutcome.nextGate,
    decision: waterB.decision,
  }),
);
