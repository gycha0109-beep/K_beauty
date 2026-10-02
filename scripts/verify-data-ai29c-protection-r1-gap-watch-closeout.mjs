#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const r5 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-uva-r5-blocked-subject-closeout-v1.json",
  "utf8",
));
const r2 = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-filter-r2-roundlab-exact-kr-formulation-closeout-v1.json",
  "utf8",
));
const closeout = JSON.parse(fs.readFileSync(
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-r1-gap-watch-closeout-v1.json",
  "utf8",
));

assert.equal(r5.blockedSubjects.length, 3);
assert.equal(r2.target.result, "HOLD_EVIDENCE_INSUFFICIENT");
assert.equal(closeout.stage, "DATA-AI29C-PROTECTION-R1");

assert.equal(closeout.productionSnapshot.resolvedCurrentSunscreenSubjects, 13);
assert.equal(closeout.productionSnapshot.currentProductFacts, 95);
assert.equal(closeout.productionSnapshot.spfValueSubjects, 13);
assert.equal(closeout.productionSnapshot.uvaLabelSubjects, 10);
assert.equal(closeout.productionSnapshot.uvaBlockedSubjects, 3);
assert.equal(closeout.productionSnapshot.uvFilterTypeSubjects, 12);
assert.equal(closeout.productionSnapshot.uvFilterHeldSubjects, 1);
assert.equal(closeout.productionSnapshot.waterResistanceDurationSubjects, 2);
assert.equal(closeout.productionSnapshot.broadSpectrumSubjects, 2);
assert.equal(closeout.productionSnapshot.broadSpectrumUsCoverage, "2/2");

assert.equal(closeout.axisDisposition.spf_value.status, "COMPLETE_CURRENT_SCOPE");
assert.equal(closeout.axisDisposition.uva_label.status, "WATCH_ON_CHANGE");
assert.equal(closeout.axisDisposition.uv_filter_type.status, "WATCH_ON_CHANGE");
assert.equal(
  closeout.axisDisposition.water_resistance_duration.status,
  "DIRECT_DURATION_AUTHORITY_ONLY",
);
assert.equal(
  closeout.axisDisposition.broad_spectrum.status,
  "COMPLETE_ELIGIBLE_US_SCOPE",
);

assert.equal(closeout.axisDisposition.uva_label.automaticResearch, false);
assert.equal(closeout.axisDisposition.uv_filter_type.automaticResearch, false);
assert.equal(
  closeout.axisDisposition.water_resistance_duration.automaticCoverageExpansion,
  false,
);
assert.equal(closeout.axisDisposition.broad_spectrum.recommendationConsumed, false);
assert.equal(closeout.axisDisposition.broad_spectrum.rankingContribution, 0);

assert.equal(closeout.writeBoundary.productFactWrites, 0);
assert.equal(closeout.writeBoundary.researchTaskWrites, 0);
assert.equal(closeout.writeBoundary.registryWrites, 0);
assert.equal(closeout.writeBoundary.policyWrites, 0);
assert.equal(closeout.writeBoundary.recommendationWrites, 0);

assert.equal(
  closeout.decision,
  "PROTECTION_R1_PHASE_CLOSEOUT_PASS_TRIGGERED_REOPEN_ONLY",
);
assert.equal(
  closeout.nextGate,
  "TRIGGERED_REOPEN_ONLY_NO_AUTOMATIC_PROTECTION_RESEARCH_WAVE",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: closeout.stage,
  currentFacts: closeout.productionSnapshot.currentProductFacts,
  spf: closeout.axisDisposition.spf_value.coverage,
  uva: closeout.axisDisposition.uva_label.coverage,
  uvFilter: closeout.axisDisposition.uv_filter_type.coverage,
  water: closeout.axisDisposition.water_resistance_duration.currentCoverage,
  broadSpectrumUs: closeout.axisDisposition.broad_spectrum.eligibleUsCoverage,
  decision: closeout.decision,
}));
