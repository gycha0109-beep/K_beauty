import assert from "node:assert/strict";
import {buildFaceLabV2EvaluationCohort} from "../lib/face-lab-v2/evaluation/harness.js";
import {buildFaceLabV2Canonical} from "../lib/face-lab-v2/canonical-composer.js";
import {
  auditFaceLabStyleCheckObservationCoverage,
  PROFILE_KEY_FEATURE_SOURCES,
  PROFILE_STRUCTURAL_SOURCES,
  UNSUPPORTED_STYLE_OBSERVATIONS
} from "../lib/face-lab-v2/evaluation/style-check-observation-coverage-audit.js";

const cohort=buildFaceLabV2EvaluationCohort({caseCount:24}).cases;
assert.equal(cohort.length,24);
let totalAvailable=0;
let validations=0;
const nonempty=[];
for(const item of cohort){
  const canonical=buildFaceLabV2Canonical({
    analysis:item.analysis,surveyAnswers:item.surveyAnswers,resultId:item.caseId
  });
  const before=JSON.stringify({analysis:item.analysis,canonical});
  const output=auditFaceLabStyleCheckObservationCoverage({
    analysis:item.analysis,currentFaceProfile:canonical.currentFaceProfile
  });
  assert.equal(output.status,"verified_wiring_only",
    JSON.stringify({caseId:item.caseId,issues:output.issues}));
  assert.deepEqual(output.issues,[]);
  assert.equal(output.summary.definedFields,22);
  assert.equal(output.summary.keyFeatureSources,8);
  assert.equal(output.summary.structuralSources,16);
  assert.equal(output.summary.notUsedInCurrentProfile,3);
  assert.equal(output.groups.length,6);
  assert.equal(output.ledger.length,22);
  assert.equal(output.normalizedFieldValuesPersisted,false);
  assert.equal(output.rawEvidencePersisted,false);
  assert.equal(output.styleQualityValidated,false);
  assert.equal(output.productionAuthorization,false);
  assert.equal(JSON.stringify({analysis:item.analysis,canonical}),before,
    "audit must never mutate canonical or input");
  assert.equal(JSON.stringify(output).includes(item.caseId),false,
    "audit must not return case identifiers or raw values");
  assert.equal(JSON.stringify(output).includes("fixture:"),false,
    "audit must not leak raw evidence text");
  totalAvailable+=output.summary.available;
  validations++;
  if(output.summary.keyFeaturesExposed>0)nonempty.push({canonical,item});
}
assert.ok(nonempty.length>0);
assert.equal(Object.keys(PROFILE_KEY_FEATURE_SOURCES).length,8);
assert.equal(Object.keys(PROFILE_STRUCTURAL_SOURCES).length,16);
assert.ok(UNSUPPORTED_STYLE_OBSERVATIONS.includes("browShape"));
assert.ok(UNSUPPORTED_STYLE_OBSERVATIONS.includes("lipContour"));

const {canonical,item}=nonempty[0];
function corrupt(mutator){
  const clone=structuredClone({
    analysis:item.analysis,profile:canonical.currentFaceProfile
  });
  mutator(clone);
  return auditFaceLabStyleCheckObservationCoverage({
    analysis:clone.analysis,currentFaceProfile:clone.profile
  });
}
function rejects(result,code){
  assert.equal(result.status,"contract_violation");
  assert.ok(result.issues.some(i=>i.code===code),JSON.stringify(result.issues));
}
rejects(corrupt(({analysis})=>{
  delete analysis.observations.outline.faceShape;
}),"normalized_observation_field_missing");
rejects(corrupt(({analysis})=>{
  analysis.observations.outline.faceShape.status="insufficient_evidence";
  analysis.observations.outline.faceShape.value=null;
  analysis.observations.outline.faceShape.evidence=[];
}),"profile_key_feature_from_held_observation");
rejects(corrupt(({profile})=>{
  profile.keyFeatures.push({
    key:"unsupportedSkinEyeVector",direction:"new",evidence:[],confidence:1
  });
}),"unknown_profile_key_feature");
rejects(corrupt(({profile})=>{
  profile.keyFeatures=profile.keyFeatures.filter(x=>x.key!=="eyeDirection");
}),"available_key_feature_not_propagated");
rejects(corrupt(({profile})=>{
  profile.structuralProfile.values.faceShape="injected";
}),"structural_value_mismatch");
rejects(corrupt(({analysis})=>{
  analysis.observations.outline.faceShape.evidence=[];
}),"available_field_missing_source_or_evidence");
rejects(corrupt(({analysis})=>{
  analysis.observations.brows={browShape:{
    status:"available",source:"vision",value:"arched",evidence:["injected"]
  }};
}),"undeclared_observation_group");
rejects(corrupt(({analysis})=>{
  analysis.observations.eyes.eyeSymmetry={
    status:"available",source:"vision",value:"balanced",evidence:["injected"]
  };
}),"undeclared_observation_field");
rejects(corrupt(({analysis})=>{
  analysis.quality.value.colorSuitability="unsuitable";
}),"unusable_photo_exposes_color_observations");
rejects(corrupt(({analysis})=>{
  analysis.quality.value.structureSuitability="unsuitable";
}),"unusable_photo_exposes_structural_observations");

const held=corrupt(({analysis,profile})=>{
  analysis.status="unavailable";
  profile.status="unavailable";profile.keyFeatures=[];
});
assert.equal(held.status,"held_upstream_unavailable",JSON.stringify(held.issues));

console.log(JSON.stringify({
  ok:true,version:"face-lab-style-check-observation-coverage-sc03-v1",
  syntheticCases:validations,totalFieldObservations:validations*22,
  availableFieldObservations:totalAvailable,definedGroups:6,
  keyFeatureMappings:8,structuralMappings:16,
  schemaExtensionRequiresReview:true,
  mutationChecks:10,
  realFacesReviewed:0,styleAccuracyClaimsAuthorized:false,
  canonicalProductionChanges:0
}));
