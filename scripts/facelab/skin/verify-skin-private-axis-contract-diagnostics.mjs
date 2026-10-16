// Entirely synthetic, no real image, no network, no Provider or Key.
// Verifies privacy-safe local codes against the SAME strict S1-A validator.
import assert from "node:assert/strict";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";
import { inspectPrivateSkinV2AxisContract as inspect,
  SKIN_PRIVATE_AXIS_DIAGNOSTIC_VERSION as VERSION
} from "./skin-private-axis-contract-diagnostics.mjs";

const cues={
  oiliness:"surface_shine",dehydration:"dry_texture",acne:"active_spots",
  uneven_tone:"tone_variation",pores:"pore_visibility",
  redness:"red_appearance",barrier:"surface_stress"
};
const validRow=axis=>({axis,state:"not_seen",value:0,confidence:"medium",
  cue:cues[axis],area:"cheeks",reason:"none"});
const base={
  schemaVersion:"vision-observation-v2",
  eligibility:{source:"vision",skinAnalysisEligible:true},
  skin:{axisEvidence:SKIN_VISIBLE_AXES.map(validRow)}
};
const deepClone=x=>structuredClone(x);
const test=(change,expectedStatus="ELIGIBLE_ROWS_CONTRACT_HOLD")=>{
  const candidate=deepClone(base);
  change(candidate);
  const result=inspect(candidate);
  assert.equal(result.status,expectedStatus);
  assert.equal(result.version,VERSION);
  assert.equal(result.axisDiagnostics.length,7);
  assert.equal(result.issues.length,0);
  return result;
};
const valid=inspect(base);
assert.equal(valid.status,"ELIGIBLE_ROWS_CONTRACT_READY");
assert(valid.axisDiagnostics.every(x=>x.valid && x.issues.length===0));
const missingCue=test(x=>{x.skin.axisEvidence[0].cue=null});
assert.deepEqual(missingCue.axisDiagnostics[0].issues,["target_cue_missing_or_invalid"]);
const missingArea=test(x=>{x.skin.axisEvidence[1].area=null});
assert.deepEqual(missingArea.axisDiagnostics[1].issues,["inspected_area_missing_or_invalid"]);
const missingReason=test(x=>{x.skin.axisEvidence[2].reason="missing"});
assert.deepEqual(missingReason.axisDiagnostics[2].issues,["reason_state_mismatch"]);
const rawInvalidNegative=test(x=>{
  x.skin.axisEvidence[3].cue=null;
  x.skin.axisEvidence[3].area=null;
  x.skin.axisEvidence[3].reason="missing";
});
assert.deepEqual(rawInvalidNegative.axisDiagnostics[3].issues,[
  "target_cue_missing_or_invalid",
  "inspected_area_missing_or_invalid",
  "reason_state_mismatch"
]);
const wrongScore=test(x=>{x.skin.axisEvidence[1].value=1});
assert.deepEqual(wrongScore.axisDiagnostics[1].issues,["value_state_mismatch"]);
const extraKey=test(x=>{x.skin.axisEvidence[0].identity="NEVER_LEAK_SECRET"});
assert.deepEqual(extraKey.axisDiagnostics[0].issues,["row_shape_invalid"]);
assert(!JSON.stringify(extraKey).includes("NEVER_LEAK_SECRET"));
const validUnknown=test(x=>{
  x.skin.axisEvidence[0]={axis:"oiliness",state:"unknown",value:null,
    confidence:"unknown",cue:null,area:null,reason:"missing"};
},"ELIGIBLE_ROWS_CONTRACT_READY");
assert.equal(validUnknown.axisDiagnostics[0].valid,true);
const validUnassessable=test(x=>{
  x.skin.axisEvidence[2]={axis:"acne",state:"unassessable",value:null,
    confidence:"unknown",cue:null,area:null,reason:"lighting"};
},"ELIGIBLE_ROWS_CONTRACT_READY");
assert.equal(validUnassessable.axisDiagnostics[2].valid,true);
const unknownAsZero=test(x=>{
  x.skin.axisEvidence[3]={axis:"uneven_tone",state:"unknown",value:0,
    confidence:"unknown",cue:null,area:null,reason:"missing"};
});
assert.deepEqual(unknownAsZero.axisDiagnostics[3].issues,["value_state_mismatch"]);
const omit=test(x=>{x.skin.axisEvidence.splice(1,1)});
assert.deepEqual(omit.axisDiagnostics[1].issues,["missing_axis"]);
const duplicate=test(x=>{x.skin.axisEvidence.push(validRow("oiliness"))});
assert.deepEqual(duplicate.axisDiagnostics[0].issues,["duplicate_axis"]);
const unrecognized=deepClone(base);
unrecognized.skin.axisEvidence.push({axis:"uv",state:"present",value:1,
  confidence:"medium",cue:"source_faces",area:"cheeks",reason:"none",
  photoBase64:"DO_NOT_LEAK"});
const unmatched=inspect(unrecognized);
assert.equal(unmatched.status,"ELIGIBLE_ROWS_CONTRACT_HOLD");
assert(unmatched.issues.includes("unsupported_axis_or_row"));
assert(!JSON.stringify(unmatched).includes("DO_NOT_LEAK"));
const ineligible=deepClone(base);
ineligible.eligibility.skinAnalysisEligible=false;
ineligible.skin.axisEvidence=[];
assert.equal(inspect(ineligible).status,"SKIN_INELIGIBLE_ZERO_AXES");
ineligible.skin.axisEvidence=base.skin.axisEvidence;
assert.equal(inspect(ineligible).status,"SKIN_INELIGIBLE_UNEXPECTED_AXES");
assert.equal(inspect({schemaVersion:"vision-observation-v1"}).status,"UNSUPPORTED_VERSION");
const excessive=deepClone(base);
excessive.skin.axisEvidence=Array.from({length:17},(_,i)=>validRow("acne"));
assert.equal(inspect(excessive).status,"AXIS_ROWS_EXCESSIVE");
const nonexistent=deepClone(base);
delete nonexistent.skin.axisEvidence;
assert.equal(inspect(nonexistent).status,"AXIS_ROWS_MISSING");
const privateInput=deepClone(base);
privateInput.skin.axisEvidence[0].cue="PERSONAL_STRING_AND_SK_abc123_NOT_FOR_LOGGING";
privateInput.skin.axisEvidence[0].area="https://sensitive.invalid/foo";
privateInput.skin.axisEvidence[0].reason="PERSONAL_EXIF_METADATA";
const safe=inspect(privateInput);
assert.equal(safe.status,"ELIGIBLE_ROWS_CONTRACT_HOLD");
assert(!JSON.stringify(safe).includes("PERSONAL"));
assert(!JSON.stringify(safe).includes("https://"));
assert(!JSON.stringify(safe).includes("SK_abc"));
console.log("verify-skin-private-axis-contract-diagnostics: PASS (synthetic strict cue/area/reason, no source text)");
