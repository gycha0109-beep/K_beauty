import assert from "node:assert/strict";
import {runFaceLabStyleCheckCounterfactualAudit,
  STYLE_CHECK_CONTRAST_AUDIT_VERSION} from
  "../lib/face-lab-v2/evaluation/style-check-contrast-audit.js";

const report=runFaceLabStyleCheckCounterfactualAudit({
  lockedCaseCount:12,sweepFaceCount:1
});
assert.equal(report.version,STYLE_CHECK_CONTRAST_AUDIT_VERSION);
assert.equal(report.status,"verified_policy_wiring_only",
  JSON.stringify(report.failures));
assert.deepEqual(report.failures,[]);
assert.equal(report.summary.syntheticInputCases,24);
assert.equal(report.summary.currentFaceRelations,4);
assert.equal(report.relations.length,4);
assert.ok(report.summary.faceModifiersTriggered>0,
  "at least one current-contract modifier must change an applicable style action");
assert.ok(report.summary.hardExclusionChecks>0,
  "whole-domain hard exclusion needs an active baseline");
assert.ok(report.summary.targetSwitchChangedStyleDeltas>0,
  "the same face with different confirmed targets should change actions");
assert.ok(report.relations.every(r=>r.checked===24));
assert.ok(report.relations.every(r=>r.targetForwardInvariance===r.checked));
assert.ok(report.relations.every(r=>r.applicable===r.modifiedWithEvidence),
  "every exercised modifier must provide explainable face evidence");
assert.equal(report.rawFaceDataReturned,false);
assert.equal(report.targetSelectionsReturned,false);
assert.equal(report.evaluationAccuracyValidated,false);
assert.equal(report.productionAuthorization,false);
assert.equal(JSON.stringify(report).includes("target-sweep:"),false);
assert.equal(JSON.stringify(report).includes("eval:"),false);

// Deterministic rerun and a low-sample smoke test protect against silent
// changes to fixture sampling that would overstate responsiveness coverage.
const repeat=runFaceLabStyleCheckCounterfactualAudit({
  lockedCaseCount:12,sweepFaceCount:1
});
assert.deepEqual(repeat,report);
const small=runFaceLabStyleCheckCounterfactualAudit({
  lockedCaseCount:2,sweepFaceCount:1
});
assert.equal(small.status,"verified_policy_wiring_only",
  JSON.stringify(small.failures));
assert.equal(small.summary.syntheticInputCases,14);

console.log(JSON.stringify({
  ok:true,suite:STYLE_CHECK_CONTRAST_AUDIT_VERSION,
  summary:report.summary,
  relations:report.relations,
  repeatable:true,
  independentPhotoGroundTruth:false,
  humanPreferenceValidation:false,
  productionRecommendationsUnchanged:true
}));
