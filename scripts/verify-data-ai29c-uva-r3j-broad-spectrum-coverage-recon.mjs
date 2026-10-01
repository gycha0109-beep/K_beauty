#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3i = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3i-skin1004-broad-spectrum-recovery-v1.json",
  "utf8",
));
const r3j = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3j-broad-spectrum-coverage-recon-v1.json",
  "utf8",
));
const contract = fs.readFileSync(
  "lib/recommendation-sunscreen-protection-authority-contract.mjs",
  "utf8",
);
const projection = fs.readFileSync(
  "lib/sunscreen-protection-projection.mjs",
  "utf8",
);

assert.equal(r3i.decision, "UVA_R3I_SKIN1004_BROAD_SPECTRUM_SECOND_SUBJECT_PASS");
assert.equal(r3j.stage, "DATA-AI29C-UVA-R3J");
assert.equal(r3j.scope.resolvedCurrentSunscreenSubjects, 13);
assert.equal(r3j.scope.usSubjects, 2);
assert.equal(r3j.scope.nonUsSubjects, 9);
assert.equal(r3j.scope.unscopedSubjects, 2);
assert.equal(r3j.governedCoverage.totalBroadSpectrumCurrentSubjects, 2);
assert.equal(r3j.governedCoverage.usEligibleSubjects, 2);
assert.equal(r3j.governedCoverage.usGovernedBroadSpectrumSubjects, 2);
assert.equal(r3j.governedCoverage.usMissingBroadSpectrumSubjects, 0);
assert.equal(r3j.governedCoverage.usCoverage, "2/2");
assert.equal(r3j.nonUsBoundary.subjectCount, 11);
assert.equal(r3j.nonUsBoundary.broadSpectrumCurrentSubjects, 0);
assert.equal(r3j.nonUsBoundary.automaticCrossMarketTransferAllowed, false);
assert.equal(contract.includes('"broad_spectrum"'), false);
assert.equal(projection.includes('"broad_spectrum"'), false);
assert.equal(r3j.recommendationBoundary.rankingChanged, false);
assert.equal(r3j.recommendationBoundary.publicActivation, false);
assert.equal(r3j.frozenCorpusBoundary.prospectiveCorpusCount, 20);
assert.equal(r3j.frozenCorpusBoundary.frozenWaterCoverage, "1/20");
assert.equal(r3j.writeBoundary.productFactWritesInThisStage, 0);
assert.equal(r3j.writeBoundary.registryWritesInThisStage, 0);
assert.equal(r3j.writeBoundary.policyWritesInThisStage, 0);
assert.equal(r3j.decision, "UVA_R3J_BROAD_SPECTRUM_COVERAGE_RECON_PASS_US_SCOPE_COMPLETE");
assert.equal(r3j.nextGate, "DATA-AI29C-UVA-R3K_BROAD_SPECTRUM_PHASE_CLOSEOUT");

console.log(JSON.stringify({
  status:"PASS",
  stage:r3j.stage,
  usCoverage:r3j.governedCoverage.usCoverage,
  broadCurrent:r3j.governedCoverage.totalBroadSpectrumCurrentSubjects,
  rankingChanged:r3j.recommendationBoundary.rankingChanged,
  decision:r3j.decision,
}));
