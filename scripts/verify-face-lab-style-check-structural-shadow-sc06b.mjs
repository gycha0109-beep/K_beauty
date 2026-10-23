import assert from "node:assert/strict";
import { buildFaceLabV2Canonical } from "../lib/face-lab-v2/canonical-composer.js";
import { buildFaceLabV2TargetSweepCohort } from "../lib/face-lab-v2/evaluation/target-responsiveness.js";
import { buildStyleDelta } from "../lib/face-lab-v2/style-delta.js";
import {
  STYLE_CHECK_STRUCTURAL_SHADOW_VERSION,
  UNTESTED_STRUCTURAL_FIELDS,
  STRUCTURAL_SHADOW_HYPOTHESES,
  buildStyleCheckStructuralShadow,
  auditStyleCheckStructuralShadow
} from "../lib/face-lab-v2/evaluation/style-check-structural-shadow.js";

const untestedExpected=[
  "outline.foreheadWidthVsCheek","outline.jawlineAngularity",
  "outline.jawTaper","outline.cheekboneProminence",
  "vertical.midfaceLength","vertical.lowerFaceLength",
  "eyes.eyeLength","eyes.eyeOpenness",
  "featureLayout.featureScale","featureLayout.focalFeatures"
].sort();
assert.deepEqual([...UNTESTED_STRUCTURAL_FIELDS].sort(),untestedExpected);
assert.equal(STRUCTURAL_SHADOW_HYPOTHESES.length,3);
assert.equal(new Set(STRUCTURAL_SHADOW_HYPOTHESES.map(x=>x.fieldPath)).size,3);
assert.ok(STRUCTURAL_SHADOW_HYPOTHESES.every(h=>
  UNTESTED_STRUCTURAL_FIELDS.includes(h.fieldPath) &&
  h.operation==="strength_cap" && h.limit==="light" &&
  h.humanQuestion.length>15
));

const result=auditStyleCheckStructuralShadow({faceCount:8});
assert.equal(result.version,STYLE_CHECK_STRUCTURAL_SHADOW_VERSION);
assert.equal(result.status,"shadow_feasibility_only",JSON.stringify(result.errors));
assert.deepEqual(result.errors,[]);
assert.equal(result.summary.baselineCases,96);
assert.equal(result.summary.targetForwardHeldCases,96);
assert.equal(result.summary.existingUnmodifiedStructuralFields,10);
assert.equal(result.summary.exploredCandidateQuestions,3);
assert.equal(result.summary.realPhotoReviewed,0);
assert.equal(result.summary.humanJudgments,0);
assert.equal(result.productionAuthorization,false);
assert.equal(result.stylingPreferenceValidated,false);

// Controlled candidate interventions are tested in isolation; they are NOT
// assumed to be aesthetically helpful or activated on real photographs.
const source=buildFaceLabV2TargetSweepCohort({faceCount:1}).cases[0];
const canonical=buildFaceLabV2Canonical({
  analysis:source.analysis,surveyAnswers:source.surveyAnswers
});
const profile=structuredClone(canonical.currentFaceProfile);
const target=structuredClone(canonical.targetStyle);
target.recommendationPriority="face_harmony";
target.vector.softSharp=0.9;
target.vector.minimalStatement=0.9;
target.stylingScope=["eyewear","makeup","hair"];
target.constraints={
  ...target.constraints,hardExclusions:[],
  makeup:{intensity:"medium"}
};
profile.keyFeatures=profile.keyFeatures.map(f=>{
  if(f.key==="eyeDirection")return {...f,direction:"level"};
  if(f.key==="featureContrast")return {...f,direction:"low"};
  return f;
});
const before=JSON.stringify({profile,target});
for(const h of STRUCTURAL_SHADOW_HYPOTHESES){
  const isolated=structuredClone(profile);
  isolated.structuralProfile.values[h.fieldPath.split(".")[1]]=h.trigger;
  const base=buildStyleDelta({currentFaceProfile:isolated,targetStyle:target});
  const shadow=buildStyleCheckStructuralShadow({
    currentFaceProfile:isolated,targetStyle:target
  });
  assert.equal(shadow.candidatePolicy.productionActive,false);
  assert.equal(shadow.candidatePolicy.permissionToReplaceCanonical,false);
  assert.equal(base.priorities.length,shadow.priorities.length);
  const ledger=shadow.shadowLedger.find(x=>x.id===h.id);
  assert.ok(ledger,JSON.stringify({id:h.id,ledger:shadow.shadowLedger}));
  assert.equal(ledger.afterStrength,"light");
  assert.notEqual(ledger.beforeStrength,ledger.afterStrength);
  assert.ok(shadow.priorities.some(x=>
    x.evidence.includes("candidate_relation:"+h.id)));

  const targetForward=buildStyleCheckStructuralShadow({
    currentFaceProfile:isolated,
    targetStyle:{...target,recommendationPriority:"target_forward"}
  });
  assert.equal(targetForward.shadowLedger.length,0);
  const denied=buildStyleCheckStructuralShadow({
    currentFaceProfile:isolated,
    targetStyle:{
      ...target,
      constraints:{
        ...target.constraints,
        hardExclusions:[h.actionMatch.domain+"_disabled"]
      }
    }
  });
  assert.equal(denied.shadowLedger.some(x=>x.id===h.id),false,
    "hard excluded action must never be changed by shadow");
  const missing=structuredClone(isolated);
  delete missing.structuralProfile.values[h.fieldPath.split(".")[1]];
  assert.equal(buildStyleCheckStructuralShadow({
    currentFaceProfile:missing,targetStyle:target
  }).shadowLedger.some(x=>x.id===h.id),false);
}
assert.equal(JSON.stringify({profile,target}),before);
assert.equal(buildStyleCheckStructuralShadow({
  currentFaceProfile:profile,
  targetStyle:{...target,approvedByUser:false}
}).shadowLedger.length,0);
assert.deepEqual(auditStyleCheckStructuralShadow({faceCount:0}).errors,
  ["invalid_face_count"]);

// The aggregate audit does not expose image, person, provider evidence or
// target preferences; it cannot authorize any actual rule.
assert.equal(JSON.stringify(result).includes("FL-TS-"),false);
assert.equal(JSON.stringify(result).includes("target-sweep:"),false);
console.log(JSON.stringify({
  ok:true,version:STYLE_CHECK_STRUCTURAL_SHADOW_VERSION,
  summary:result.summary,
  hypothesisCounts:result.hypothesisCounts,
  realWorldStylingValidated:false,
  productionActivation:false
}));
