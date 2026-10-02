#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r5 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r5-blocked-subject-closeout-v1.json",
  "utf8",
));
const r1 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r1-uv-filter-recovery-v1.json",
  "utf8",
));

assert.equal(r5.decision, "UVA_R5_BLOCKED_SUBJECT_CLOSEOUT_PASS_WATCH_ON_CHANGE");
assert.equal(r1.stage, "DATA-AI29C-FILTER-R1");
assert.equal(r1.initialCoverage.uvFilterCurrentSubjects, 11);
assert.equal(r1.initialCoverage.missingSubjects, 2);
assert.equal(r1.initialCoverage.currentProductFacts, 94);

assert.equal(r1.recovered.result, "RECOVERED");
assert.equal(r1.recovered.value, "organic");
assert.equal(r1.recovered.authority, "product_specific_primary");
assert.equal(r1.recovered.confidence, "high");
assert.equal(r1.recovered.evidence.evidenceClass, "composition_identity");
assert.equal(r1.recovered.evidence.evidenceAuthority, "product_specific_primary");
assert.equal(r1.recovered.review.operationalState, "confirmed");
assert.equal(
  r1.recovered.confirmation.factInstanceId,
  "c794fb23-5ff6-4af8-b503-fd7e3c5578a6",
);
assert.equal(
  r1.recovered.confirmation.confirmationId,
  "d9f2ca21-457a-438f-8fbd-a02cbc99e1df",
);
assert.equal(r1.recovered.officialSource.bindingState, "exact_subject_match");
assert.equal(r1.recovered.officialSource.scopeRelation, "equivalent");
assert.ok(r1.recovered.officialSource.compositionMarkers.length >= 4);
assert.deepEqual(r1.recovered.officialSource.inorganicFilterMarkersObserved, []);
assert.equal(r1.recovered.historicalResearchTask.databaseState, "BLOCKED");
assert.equal(r1.recovered.historicalResearchTask.directMutationApplied, false);

assert.equal(r1.held.result, "HOLD_EVIDENCE_INSUFFICIENT");
assert.equal(r1.held.currentUvFilterFactCount, 0);
assert.equal(r1.held.taskState, "BLOCKED");
assert.equal(
  r1.held.globalOfficialClassification.transferToKrSubjectAuthorized,
  false,
);

assert.equal(r1.finalCoverage.resolvedCurrentSunscreenSubjects, 13);
assert.equal(r1.finalCoverage.uvFilterCurrentSubjects, 12);
assert.equal(r1.finalCoverage.missingSubjects, 1);
assert.equal(r1.finalCoverage.currentProductFacts, 95);
assert.equal(r1.writeBoundary.torridenProductFactWrite, true);
assert.equal(r1.writeBoundary.roundLabProductFactWrite, false);
assert.equal(r1.writeBoundary.recommendationWrite, false);
assert.equal(r1.writeBoundary.rankingChanged, false);
assert.equal(r1.writeBoundary.publicActivation, false);

assert.equal(
  r1.decision,
  "FILTER_R1_PARTIAL_PASS_TORRIDEN_ORGANIC_RECOVERED_ROUNDLAB_HOLD",
);
assert.equal(
  r1.nextGate,
  "DATA-AI29C-FILTER-R2_ROUNDLAB_EXACT_KR_FORMULATION_CLOSEOUT",
);

console.log(JSON.stringify({
  status:"PASS",
  stage:r1.stage,
  recovered:r1.recovered.name,
  value:r1.recovered.value,
  held:r1.held.name,
  coverage:`${r1.finalCoverage.uvFilterCurrentSubjects}/${r1.finalCoverage.resolvedCurrentSunscreenSubjects}`,
  currentFacts:r1.finalCoverage.currentProductFacts,
  decision:r1.decision,
}));
