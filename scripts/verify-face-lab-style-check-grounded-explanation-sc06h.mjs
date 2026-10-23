import assert from "node:assert/strict";
import {buildFaceLabV2TargetSweepCohort} from "../lib/face-lab-v2/evaluation/target-responsiveness.js";
import {buildFaceLabV2Canonical} from "../lib/face-lab-v2/canonical-composer.js";
import {buildStyleCheckGroundedExplanation as explain} from "../lib/face-lab-v2/evaluation/style-check-grounded-explanation-sc06h.js";
const cohort=buildFaceLabV2TargetSweepCohort({faceCount:1}).cases;
for(const target of ["natural","chic"]){
 const item=cohort.find(x=>x.targetKey===target);
 const canonical=buildFaceLabV2Canonical({analysis:item.analysis,surveyAnswers:item.surveyAnswers,locale:"ko"});
 const result=explain({canonical,targetKey:target});
 if(target==="natural"){assert.equal(result.status,"held");assert.equal(result.reason,"no_traceable_actions");continue;}assert.equal(result.status,"research_copy_ready");
 assert.ok(result.headline.length>5);
 assert.ok(result.cards.length>0);
 assert.equal(result.productionActive,false);
 assert.equal(result.qualityValidated,false);
 assert.equal(result.providerInvoked,false);
 assert.ok(!result.rationale.includes("이 특징과 추구미를 함께 고려")||result.cards.some(x=>x.scope==="face_and_target"));
 for(const c of result.cards)assert.ok(c.source.evidence.some(x=>x.startsWith("target_axis:")||x.startsWith("face_")||x.startsWith("observation:")));
 console.log(JSON.stringify({target,headline:result.headline,rationale:result.rationale,actions:result.cards.length,faceLink:result.cards.some(x=>x.scope==="face_and_target")}));
}
assert.equal(explain({canonical:{}}).status,"held");
assert.equal(explain({canonical:null}).cards.length,0);
const item=cohort.find(x=>x.targetKey==="chic"),c=buildFaceLabV2Canonical({analysis:item.analysis,surveyAnswers:item.surveyAnswers,locale:"ko"});
assert.equal(explain({canonical:c,targetKey:"natural"}).reason,"target_mismatch");
assert.equal(explain({canonical:c,routeId:"nonexistent"}).reason,"route_unavailable");
console.log(JSON.stringify({ok:true,tests:6,productionActive:false}));
