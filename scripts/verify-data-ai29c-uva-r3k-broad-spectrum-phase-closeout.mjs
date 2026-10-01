#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3j = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3j-broad-spectrum-coverage-recon-v1.json",
  "utf8",
));
const r3k = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3k-broad-spectrum-phase-closeout-v1.json",
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

assert.equal(r3j.decision, "UVA_R3J_BROAD_SPECTRUM_COVERAGE_RECON_PASS_US_SCOPE_COMPLETE");
assert.equal(r3k.stage, "DATA-AI29C-UVA-R3K");
assert.equal(r3k.phaseOutcome.registryDefinitionCount, 21);
assert.equal(r3k.phaseOutcome.governedBroadSpectrumCurrentSubjects, 2);
assert.equal(r3k.phaseOutcome.usEligibleSubjects, 2);
assert.equal(r3k.phaseOutcome.usCoverage, "2/2");
assert.equal(r3k.phaseOutcome.currentProductFactCount, 94);
assert.equal(r3k.semantics.separateFromUvaLabel, true);
assert.equal(r3k.semantics.quantitativeUvaStrength, false);
assert.equal(r3k.semantics.crossMarketTransferAllowed, false);
assert.equal(contract.includes('"broad_spectrum"'), false);
assert.equal(projection.includes('"broad_spectrum"'), false);
assert.equal(r3k.recommendationBoundary.rankingContribution, 0);
assert.equal(r3k.recommendationBoundary.recommendationAdmissionGranted, false);
assert.equal(r3k.recommendationBoundary.publicActivation, false);
assert.equal(r3k.uvaLabelHandoff.currentUvaLabelSubjects, 10);
assert.equal(r3k.uvaLabelHandoff.blockedSubjects.length, 3);
assert.equal(
  r3k.uvaLabelHandoff.blockedSubjects.every(
    (row) => row.blockerCode === "EVIDENCE_INSUFFICIENT",
  ),
  true,
);
assert.equal(r3k.uvaLabelHandoff.broadSpectrumDoesNotResolveTheseBlocks, true);
assert.equal(r3k.writeBoundary.productFactWritesInThisStage, 0);
assert.equal(r3k.writeBoundary.registryWritesInThisStage, 0);
assert.equal(r3k.writeBoundary.policyWritesInThisStage, 0);
assert.equal(r3k.decision, "UVA_R3K_BROAD_SPECTRUM_PHASE_CLOSEOUT_PASS");
assert.equal(
  r3k.nextGate,
  "DATA-AI29C-UVA-R4_UVA_LABEL_BLOCKED_SUBJECT_REASSESSMENT",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:r3k.stage,
  usCoverage:r3k.phaseOutcome.usCoverage,
  broadSpectrumSubjects:r3k.phaseOutcome.governedBroadSpectrumCurrentSubjects,
  blockedUvaSubjects:r3k.uvaLabelHandoff.blockedSubjects.length,
  rankingContribution:r3k.recommendationBoundary.rankingContribution,
  decision:r3k.decision,
}));
