import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../../face-lab-observation-contract.js";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { buildCandidateStyleDelta } from "../candidate-style-delta.js";
import { buildStyleRoutes } from "../route-generator.js";
import { buildFaceLabV2TargetSweepCohort } from "./target-responsiveness.js";
import {
  PROFILE_KEY_FEATURE_SOURCES,
  PROFILE_STRUCTURAL_SOURCES
} from "./style-check-observation-coverage-audit.js";

/**
 * SC-06: Exhaustive defined-value perturbation for the 22 currently normalized
 * face-observation fields, through the EXISTING Canonical V2 execution.
 *
 * Synthetic fixtures are not photos: this is sensitivity/pathway coverage,
 * never validity of a face cue or evidence of good style.
 *
 * No existing production module is mutated. Candidate Face Fit is evaluated
 * separately and stays productionActive:false.
 */
export const STYLE_CHECK_FIELD_IMPACT_VERSION =
  "face-lab-style-check-field-impact-sc06-v1";

const rawFields = Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)
  .flatMap(([group,definition])=>Object.entries(definition)
    .map(([key,options])=>({group,key,options,path:group+"."+key})));

const keyFeaturePaths = new Set(Object.values(PROFILE_KEY_FEATURE_SOURCES));
const structuralPaths = new Set(Object.values(PROFILE_STRUCTURAL_SOURCES));
const semanticAction = (action) => [
  action?.domain,action?.parameter,action?.direction,action?.strength,
  action?.reason,action?.expectedEffect||action?.explanation,
  (action?.evidence||[]).filter(x=>
    x.startsWith("face_feature:")||x.startsWith("target_axis:")
  ).sort()
];
const sorted=(v)=>JSON.stringify(v);
const styleSignature=(canonical)=>sorted((canonical?.styleDelta?.priorities||[])
  .filter(x=>x.constraintState==="allowed").map(semanticAction)
  .sort((a,b)=>sorted(a).localeCompare(sorted(b))));
const routeSignature=(routes)=>sorted((routes?.routes||[]).map(r=>({
  routeId:r.routeId,
  actions:(r.actions||[]).map(semanticAction)
    .sort((a,b)=>sorted(a).localeCompare(sorted(b)))
})).sort((a,b)=>a.routeId.localeCompare(b.routeId)));
const domainSignature=(canonical)=>sorted(Object.fromEntries(
  ["hair","makeup","color","grooming","eyewear","accessories","looks"]
    .map(key=>[key,{
      status:canonical?.[key]?.status??null,
      value:canonical?.[key]?.value??null
    }])
));
const featureSignature=(profile)=>sorted((profile?.keyFeatures||[])
  .map(x=>({key:x.key,direction:x.direction}))
  .sort((a,b)=>a.key.localeCompare(b.key)));
const structuralSignature=(profile)=>sorted(profile?.structuralProfile?.values||null);

export function runFaceLabStyleCheckFieldImpactAudit({faceCount=2}={}) {
  if(!Number.isInteger(faceCount)||faceCount<1||faceCount>4) {
    return {version:STYLE_CHECK_FIELD_IMPACT_VERSION,
      status:"invalid_input",errors:["face_count_out_of_range"]};
  }
  const cohort=buildFaceLabV2TargetSweepCohort({faceCount});
  const matrix=rawFields.map(field=>({
    fieldPath:field.path,
    profileProjection:keyFeaturePaths.has(field.path)?"key_feature":
      structuralPaths.has(field.path)?"structural_only":
      "not_consumed_by_current_profile",
    testedAlternatives:0,profileFeatureChanges:0,structuralProfileChanges:0,
    styleDeltaChanges:0,routeChanges:0,executionChanges:0,
    candidateActionChanges:0,candidateRouteChanges:0
  }));
  let baselineCases=0,candidateActivations=0,fieldPerturbations=0;
  let errors=[];
  for(const item of cohort.cases) {
    const before=JSON.stringify({analysis:item.analysis,survey:item.surveyAnswers});
    const baseline=buildFaceLabV2Canonical({
      analysis:item.analysis,surveyAnswers:item.surveyAnswers
    });
    if(baseline.currentFaceProfile?.status==="unavailable"||
      baseline.targetStyle?.status!=="available") {
      errors.push("synthetic_cohort_not_eligible");continue;
    }
    baselineCases++;
    const baseStyle=styleSignature(baseline),
      baseRoutes=routeSignature(baseline.routes),
      baseDomains=domainSignature(baseline),
      baseFeatures=featureSignature(baseline.currentFaceProfile),
      baseStructure=structuralSignature(baseline.currentFaceProfile);
    const candidateBase=buildCandidateStyleDelta({
      currentFaceProfile:baseline.currentFaceProfile,
      targetStyle:baseline.targetStyle
    });
    if(candidateBase.candidatePolicy?.productionActive!==false)
      errors.push("candidate_production_authority_violation");
    candidateActivations+=(candidateBase.personalizationLedger||[]).length;
    const candidateBaseActions=sorted(candidateBase.priorities
      .filter(x=>x.constraintState==="allowed").map(semanticAction)
      .sort((a,b)=>sorted(a).localeCompare(sorted(b))));
    const candidateBaseRoutes=routeSignature(buildStyleRoutes(candidateBase,{
      targetStyle:baseline.targetStyle
    }));

    for(let i=0;i<rawFields.length;i++){
      const entry=matrix[i],{group,key,options}=rawFields[i];
      const existing=item.analysis.observations?.[group]?.[key];
      if(existing?.status!=="available"){
        errors.push("synthetic_field_unavailable");continue;
      }
      for(const option of options){
        // Array-based focalFeatures uses a one-token controlled variant;
        // the test never claims these labels were photographed.
        const replacement=group==="featureLayout"&&key==="focalFeatures"?
          [option]:option;
        if(sorted(replacement)===sorted(existing.value))continue;
        const perturbed=structuredClone(item.analysis);
        perturbed.observations[group][key].value=replacement;
        const probe=buildFaceLabV2Canonical({
          analysis:perturbed,surveyAnswers:item.surveyAnswers
        });
        entry.testedAlternatives++;fieldPerturbations++;
        if(featureSignature(probe.currentFaceProfile)!==baseFeatures)
          entry.profileFeatureChanges++;
        if(structuralSignature(probe.currentFaceProfile)!==baseStructure)
          entry.structuralProfileChanges++;
        if(styleSignature(probe)!==baseStyle)entry.styleDeltaChanges++;
        if(routeSignature(probe.routes)!==baseRoutes)entry.routeChanges++;
        if(domainSignature(probe)!==baseDomains)entry.executionChanges++;
        if(sorted(probe.targetStyle?.vector)!==
           sorted(baseline.targetStyle?.vector))
          errors.push("face_change_mutated_target");

        // Use the pre-existing candidate-only Face Fit planner. All
        // candidate comparisons remain local and read-only.
        const candidateNext=buildCandidateStyleDelta({
          currentFaceProfile:probe.currentFaceProfile,
          targetStyle:probe.targetStyle
        });
        if(candidateNext.candidatePolicy?.productionActive!==false)
          errors.push("candidate_production_authority_violation");
        const nextActions=sorted(candidateNext.priorities
          .filter(x=>x.constraintState==="allowed").map(semanticAction)
          .sort((a,b)=>sorted(a).localeCompare(sorted(b))));
        if(nextActions!==candidateBaseActions)entry.candidateActionChanges++;
        const nextRoutes=routeSignature(buildStyleRoutes(candidateNext,{
          targetStyle:probe.targetStyle
        }));
        if(nextRoutes!==candidateBaseRoutes)entry.candidateRouteChanges++;
      }
    }
    if(JSON.stringify({analysis:item.analysis,survey:item.surveyAnswers})!==before)
      errors.push("input_was_mutated");
  }
  const stages=["profileFeatureChanges","structuralProfileChanges",
    "styleDeltaChanges","routeChanges","executionChanges",
    "candidateActionChanges","candidateRouteChanges"];
  const stageCounts=Object.fromEntries(stages.map(stage=>
    [stage,matrix.filter(x=>x[stage]>0).length]));
  const riskFlags=[];
  for(const row of matrix){
    if(row.profileProjection==="not_consumed_by_current_profile" &&
      (row.profileFeatureChanges||row.structuralProfileChanges))
      errors.push("unmapped_field_changed_profile");
    if(row.styleDeltaChanges>0 && row.profileFeatureChanges===0)
      riskFlags.push({fieldPath:row.fieldPath,
        flag:"style_delta_changed_without_key_feature_projection"});
    if(row.routeChanges>0 && row.styleDeltaChanges===0)
      riskFlags.push({fieldPath:row.fieldPath,
        flag:"route_changed_without_style_delta_change"});
    if(row.candidateActionChanges>0 &&
      row.styleDeltaChanges===0)
      riskFlags.push({fieldPath:row.fieldPath,
        flag:"candidate_only_sensitivity"});
  }
  return {
    version:STYLE_CHECK_FIELD_IMPACT_VERSION,
    status:errors.length?"contract_violation":"sensitivity_audit_only",
    summary:{
      normalizedFieldCount:matrix.length,
      sampleFaceCount:faceCount,
      distinctTargetCount:cohort.targetCount,
      syntheticBaselineCases:baselineCases,
      fieldPerturbations,
      candidateActivations,
      stageFieldCoverage:stageCounts,
      realImageCount:0,
      independentHumanJudgments:0
    },
    matrix,riskFlags,
    errors:[...new Set(errors)],
    usesSyntheticStructuredObservations:true,
    noProductionPolicyChange:true,
    faceFitCandidateProductionActive:false,
    styleAccuracyValidated:false
  };
}
