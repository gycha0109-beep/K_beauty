#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r3k = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r3k-broad-spectrum-phase-closeout-v1.json",
  "utf8",
));
const r4 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r4-blocked-subject-reassessment-v1.json",
  "utf8",
));

assert.equal(r3k.decision, "UVA_R3K_BROAD_SPECTRUM_PHASE_CLOSEOUT_PASS");
assert.equal(r4.stage, "DATA-AI29C-UVA-R4");
assert.deepEqual(r4.registryContract.allowedValues, [
  "PA+","PA++","PA+++","PA++++","UVA-PF-declared",
]);
assert.equal(r4.registryContract.broadSpectrumIsAllowedValue, false);
assert.equal(r4.reassessment.length, 3);
assert.equal(
  r4.reassessment.every((row) => row.registryAdmissibleUvaLabelRecovered === false),
  true,
);
assert.equal(
  r4.reassessment.every((row) => row.result === "HOLD_EVIDENCE_INSUFFICIENT"),
  true,
);
assert.equal(r4.summary.blockedSubjectsReassessed, 3);
assert.equal(r4.summary.recoveredUvaLabels, 0);
assert.equal(r4.summary.tasksRemainBlocked, 3);
assert.equal(r4.summary.blockerCode, "EVIDENCE_INSUFFICIENT");
assert.equal(r4.summary.broadSpectrumMayNotBeMappedToUvaLabel, true);
assert.equal(r4.writeBoundary.productFactWrites, 0);
assert.equal(r4.writeBoundary.researchTaskWrites, 0);
assert.equal(r4.writeBoundary.registryWrites, 0);
assert.equal(r4.writeBoundary.policyWrites, 0);
assert.equal(r4.recommendationBoundary.productionRankingChanged, false);
assert.equal(r4.recommendationBoundary.publicActivation, false);
assert.equal(
  r4.decision,
  "UVA_R4_BLOCKED_SUBJECT_REASSESSMENT_HOLD_NO_NEW_REGISTRY_ADMISSIBLE_UVA_LABEL",
);
assert.equal(r4.nextGate, "DATA-AI29C-UVA-R5_BLOCKED_SUBJECT_CLOSEOUT");

console.log(JSON.stringify({
  status:"PASS",
  stage:r4.stage,
  reassessed:r4.summary.blockedSubjectsReassessed,
  recovered:r4.summary.recoveredUvaLabels,
  remainBlocked:r4.summary.tasksRemainBlocked,
  decision:r4.decision,
}));
