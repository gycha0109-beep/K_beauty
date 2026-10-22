import assert from "node:assert/strict";
import {
  STYLE_CHECK_FIELD_IMPACT_VERSION,
  runFaceLabStyleCheckFieldImpactAudit
} from "../lib/face-lab-v2/evaluation/style-check-field-impact-audit.js";

const report=runFaceLabStyleCheckFieldImpactAudit({faceCount:2});
assert.equal(report.version,STYLE_CHECK_FIELD_IMPACT_VERSION);
assert.equal(report.status,"sensitivity_audit_only",JSON.stringify(report.errors));
assert.deepEqual(report.errors,[]);
assert.equal(report.summary.normalizedFieldCount,22);
assert.equal(report.summary.sampleFaceCount,2);
assert.equal(report.summary.distinctTargetCount,12);
assert.equal(report.summary.syntheticBaselineCases,24);
assert.equal(report.matrix.length,22);
assert.ok(report.summary.fieldPerturbations>24*22);
assert.equal(report.matrix.reduce((n,x)=>n+x.testedAlternatives,0),
  report.summary.fieldPerturbations);
assert.equal(new Set(report.matrix.map(x=>x.fieldPath)).size,22);
assert.ok(report.matrix.every(x=>x.testedAlternatives>0));
assert.ok(report.matrix.some(x=>x.profileFeatureChanges>0));
assert.ok(report.matrix.some(x=>x.structuralProfileChanges>0));
assert.ok(report.matrix.some(x=>x.styleDeltaChanges>0));
assert.ok(report.matrix.some(x=>x.executionChanges>0),
  "existing hair execution uses structural values beyond four modifiers");
assert.ok(report.summary.candidateActivations>=0);
const color=report.matrix.filter(x=>x.fieldPath.startsWith("colorAppearance."));
assert.equal(color.length,3);
for(const x of color) {
  assert.equal(x.profileProjection,"not_consumed_by_current_profile");
  assert.equal(x.profileFeatureChanges,0);
  assert.equal(x.structuralProfileChanges,0);
  assert.equal(x.styleDeltaChanges,0);
  assert.equal(x.routeChanges,0);
  assert.equal(x.executionChanges,0);
  assert.equal(x.candidateActionChanges,0);
}
assert.equal(report.realImageCount,undefined);
assert.equal(report.summary.realImageCount,0);
assert.equal(report.summary.independentHumanJudgments,0);
assert.equal(report.faceFitCandidateProductionActive,false);
assert.equal(report.noProductionPolicyChange,true);
assert.equal(report.styleAccuracyValidated,false);
assert.equal(JSON.stringify(report).includes("FL-TS-"),false,
  "no synthetic participant IDs must leave aggregate evaluator");
assert.equal(JSON.stringify(report).includes("target-sweep:"),false,
  "no observation evidence text must leave aggregate evaluator");
const invalid=runFaceLabStyleCheckFieldImpactAudit({faceCount:0});
assert.equal(invalid.status,"invalid_input");
assert.deepEqual(invalid.errors,["face_count_out_of_range"]);

// CI assertions test *wiring*, not a predetermined number of responsive
// fields; observed field-level coverage must remain inspectable in logs.
console.log(JSON.stringify({
  ok:true,
  auditVersion:STYLE_CHECK_FIELD_IMPACT_VERSION,
  summary:report.summary,
  matrix:report.matrix,
  riskFlags:report.riskFlags,
  syntheticOnly:true,
  noPromotion:true
}));
