// S2-E research-only: frozen engine risk test with *synthetic* image-condition
// evidence, NOT any actual provided face or source/model prediction.
// Never imports or changes production scorer, product ranks or persistence.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { buildSkinPhotoCounterfactual, compareSkinPhotoDecisions } from "./skin-photo-counterfactual-core.mjs";
import { SKIN_AXIS_EVIDENCE_VERSION, SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

register("../../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => { throw new Error("SKIN_SCORE_SAFETY_NETWORK_FORBIDDEN"); };
const { buildSkinMatchDecisionBundle } = await import("../../../lib/skin-match-decision-engine.js");
const { buildRecommendationProductFromSource } = await import("../../../lib/product-source.js");
const productsSource=JSON.parse(readFileSync("fixtures/recommendation-metadata/products-v1.json","utf8"));
const scenarios=JSON.parse(readFileSync("fixtures/recommendation-metadata/user-scenarios-v1.json","utf8"));
assert.equal(productsSource.productCount,164);
assert.equal(scenarios.scenarioCount,12);
const products=[...productsSource.products]
  .sort((a,b)=>String(a.category).localeCompare(String(b.category),"en")||
    String(a.brand).localeCompare(String(b.brand),"en")||
    String(a.name).localeCompare(String(b.name),"en")||
    String(a.id).localeCompare(String(b.id),"en"))
  .map(buildRecommendationProductFromSource);

const photoAxes=["barrier","dehydration","oiliness","redness","acne","pores","uneven_tone","uv"];
const cues={
  barrier:"surface_stress",dehydration:"dry_texture",oiliness:"surface_shine",
  redness:"red_appearance",acne:"active_spots",pores:"pore_visibility",
  uneven_tone:"tone_variation"
};
const noCue=axis=>({axis,state:"not_seen",value:0,confidence:"medium",
  cue:cues[axis],area:"cheeks",reason:"none"});
const rows=()=>SKIN_VISIBLE_AXES.map(noCue);
const rowPatch=(items,axis,patch)=>items.map(row=>row.axis===axis?{...row,...patch}:row);
const positive=(items,axis,value,confidence="high")=>rowPatch(items,axis,{
  state:"present",value,confidence,cue:cues[axis],area:"cheeks",reason:"none"
});
const blocked=(items,axis,state,reason)=>rowPatch(items,axis,{
  state,value:null,confidence:"unknown",cue:null,area:null,reason
});
const manifest=items=>({schemaVersion:SKIN_AXIS_EVIDENCE_VERSION,axes:items});
const legacy=(scores,{photoStatus="available",skinEligible=true}={})=>({
  signals:Object.fromEntries(photoAxes.map(axis=>[axis,scores[axis]??0])),
  imageEligibility:{skinAnalysisEligible:skinEligible},
  photoEvidenceState:{status:photoStatus,source:"vision"},
  photoObservations:{signals:[],surveyAlignment:{status:"unknown"}}
});
const cases=[
  {
    id:"S2E_LOW_RES_VISIBLE_REDNESS_UNASSESSABLE",
    photo:legacy({redness:5}),
    evidence:manifest(blocked(rows(),"redness","unassessable","low_resolution")),
    held:["redness"],unchanged:false
  },
  {
    id:"S2E_SHADOW_REDNESS_OILINESS_UNASSESSABLE",
    photo:legacy({redness:5,oiliness:4}),
    evidence:manifest(blocked(blocked(rows(),"redness","unassessable","lighting"),
      "oiliness","unassessable","lighting")),
    held:["redness","oiliness"],unchanged:false
  },
  {
    id:"S2E_PARTIAL_FACE_MISSING_PORES_RELIABLE_REDNESS",
    photo:legacy({pores:5,redness:3}),
    evidence:manifest(positive(blocked(rows(),"pores","unknown","unsupported"),
      "redness",3)),
    held:["pores"],kept:["redness"],unchanged:false
  },
  {
    id:"S2E_FILTERED_ACNE_UNASSESSABLE",
    photo:legacy({acne:5}),
    evidence:manifest(blocked(rows(),"acne","unassessable","filter")),
    held:["acne"],unchanged:false
  },
  {
    id:"S2E_FACE_ELIGIBLE_SKIN_INELIGIBLE",
    photo:legacy({redness:5},{photoStatus:"insufficient_evidence",skinEligible:false}),
    evidence:manifest(positive(rows(),"redness",5)),
    held:["redness"],unchanged:true
  },
  {
    id:"S2E_CONTRADICTORY_ACNE_VALUE",
    photo:legacy({acne:5}),
    evidence:manifest(positive(rows(),"acne",2)),
    held:["acne"],unchanged:false
  },
  {
    id:"S2E_CONFIRMED_POSITIVE_PRESERVE",
    photo:legacy({redness:4,acne:3}),
    evidence:manifest(positive(positive(rows(),"redness",4),"acne",3)),
    held:[],kept:["redness","acne"],unchanged:true
  },
  {
    id:"S2E_SCOPED_NEGATIVE_DOES_NOT_CONFIRM_LEGACY_SCORE",
    photo:legacy({redness:5}),
    evidence:manifest(rows()),
    held:["redness"],unchanged:false
  },
  {
    id:"S2E_PARTIAL_CONFIDENCE_UNKNOWN_REDNESS",
    photo:legacy({redness:5}),
    evidence:manifest(positive(rows(),"redness",5,"low")),
    held:["redness"],unchanged:false
  },
  {
    id:"S2E_UNKNOWN_PHOTO_STATE_WITH_POSITIVE_SCORE",
    photo:legacy({redness:5},{photoStatus:"unknown"}),
    evidence:manifest(positive(rows(),"redness",5)),
    held:["redness"],unchanged:false
  }
];
const output=[];
for(const item of cases){
  const hypothesis=buildSkinPhotoCounterfactual(item.photo,item.evidence);
  assert.equal(hypothesis.evaluationOnly,true);
  assert.equal(hypothesis.authority.scoreActivationAuthorized,false);
  assert.equal(hypothesis.authority.realPhotoTruthEstablished,false);
  assert.notStrictEqual(hypothesis.candidatePhotoAnalysis,item.photo);
  assert.deepEqual(item.photo.signals,Object.fromEntries(photoAxes.map(axis=>[axis,item.photo.signals[axis]])));
  for(const axis of item.held)assert.equal(hypothesis.candidatePhotoAnalysis.signals[axis],0,
    item.id+":"+axis+" evidence must be held");
  for(const axis of item.kept??[])assert.equal(hypothesis.candidatePhotoAnalysis.signals[axis],
    item.photo.signals[axis],item.id+":"+axis+" reliable evidence must not regress");

  const result={id:item.id,scenarios:0,photoPointChanges:0,priorityChanges:0,
    topPickChanges:0,topThreeChanges:0,rankingChanges:0,heldAxes:item.held,
    photoGate:hypothesis.photoGate};
  for(const sc of [...scenarios.scenarios].sort((a,b)=>a.id.localeCompare(b.id))){
    const opts={products,includeCandidateSourceDiagnostics:true,locale:"ko"};
    const before=await buildSkinMatchDecisionBundle(sc.answers,{...opts,photoAnalysis:item.photo});
    const after=await buildSkinMatchDecisionBundle(sc.answers,
      {...opts,photoAnalysis:hypothesis.candidatePhotoAnalysis});
    const comparison=compareSkinPhotoDecisions(before,after);
    assert.equal(comparison.candidateCount,164);
    assert.equal(comparison.photoPointReduction>0,!item.unchanged,
      item.id+":"+sc.id+" photo reduction");
    if(item.unchanged){
      assert.equal(comparison.priorityChanged,false);
      assert.equal(comparison.topPickChanged,false);
      assert.equal(comparison.rankingChanged,false);
    }
    result.scenarios++;
    result.photoPointChanges+=Number(comparison.photoPointReduction>0);
    result.priorityChanges+=Number(comparison.priorityChanged);
    result.topPickChanges+=Number(comparison.topPickChanged);
    result.topThreeChanges+=Number(comparison.topThreeRankedChanged);
    result.rankingChanges+=Number(comparison.rankingChanged);
  }
  output.push(result);
}
assert.equal(output.reduce((n,r)=>n+r.scenarios,0),120);
assert.equal(output.reduce((n,r)=>n+r.photoPointChanges,0),96);
console.log("verify-face-lab-s2-score-admission-safety: PASS "+
  JSON.stringify({
    classification:"SYNTHETIC_RISK_SENSITIVITY_NOT_PHOTO_ACCURACY",
    catalog:164,questionnaireScenarios:12,imageConditionFixtures:10,
    controlledPairedComparisons:120,
    photosAnalyzed:0,providerCalls:0,recommendationEngineModified:false,
    productionScoringActivated:false,results:output
  }));
