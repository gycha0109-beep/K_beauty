import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../../face-lab-observation-contract.js";
import {
  FACE_ACTION_RELATIONS,
  FACE_ACTION_RELATION_AUTHORITY
} from "../personalization/face-action-relations.js";
import {
  PROFILE_KEY_FEATURE_SOURCES
} from "./style-check-observation-coverage-audit.js";
import {
  buildFaceLabV2EvaluationCohort
} from "./harness.js";
import {
  buildFaceLabV2TargetSweepCohort,
  runFaceLabV2TargetResponsivenessEvaluation
} from "./target-responsiveness.js";

export const STYLE_CHECK_CONTRAST_AUDIT_VERSION =
  "face-lab-style-check-counterfactual-sc04-v1";

// Audits existing policy without editing, reweighting or promoting its rules.
// Distinguishes documented *face modifiers* from generic target-driven advice.
const active=(canonical)=>Array.isArray(canonical?.styleDelta?.priorities)
  ?canonical.styleDelta.priorities.filter(x=>x.constraintState==="allowed"):[];
const routes=(canonical)=>Array.isArray(canonical?.routes?.routes)
  ?canonical.routes.routes:[];
const actionSignature=(action)=>[
  action.domain,action.parameter,action.direction,action.strength,
  action.expectedEffect||action.explanation||"",action.reason||"",
  ...(Array.isArray(action.evidence)?[...action.evidence].sort():[])
].join("|");
const signature=(canonical)=>active(canonical).map(actionSignature).sort().join("::");
const routeSignature=(canonical)=>routes(canonical)
  .map(route=>[route.routeId,...(route.actions||[]).map(actionSignature).sort()].join(":"))
  .sort().join("::");

const profileFeature=(canonical,key)=>
  canonical?.currentFaceProfile?.keyFeatures?.find(f=>f.key===key)?.direction||null;
const build=(analysis,surveyAnswers,priority)=>
  buildFaceLabV2Canonical({
    analysis,surveyAnswers:{...surveyAnswers,recommendationPriority:priority}
  });

// Only statuses, counts, relation IDs and invariant error codes are returned.
// Never return facial traits/values, photo blobs, survey answers or raw evidence.
export function runFaceLabStyleCheckCounterfactualAudit({
  lockedCaseCount=12,
  sweepFaceCount=1
}={}) {
  const locked=buildFaceLabV2EvaluationCohort({caseCount:lockedCaseCount}).cases;
  const sweep=buildFaceLabV2TargetSweepCohort({faceCount:sweepFaceCount}).cases;
  const cases=[...locked,...sweep];
  const currentRelations=FACE_ACTION_RELATIONS.filter(
    r=>r.authorityClass===FACE_ACTION_RELATION_AUTHORITY.CURRENT_CONTRACT
  );
  const failures=[];
  const add=(code,relationId=null)=>failures.push(relationId?{code,relationId}:{code});
  const stats=Object.fromEntries(currentRelations.map(r=>[r.relationId,{
    relationId:r.relationId,sourceFeatureKey:r.sourceFeatureKey,
    checked:0,applicable:0,modifiedWithEvidence:0,
    targetForwardInvariance:0
  }]));
  let sourceCases=0,matchedCases=0,hardExclusionChecks=0;
  let targetChangedCount=0,targetComparisonCount=0;

  for(const source of cases){
    sourceCases++;
    const original=JSON.stringify(source.analysis);
    const originalSurvey=JSON.stringify(source.surveyAnswers);
    const base=build(source.analysis,source.surveyAnswers,"face_harmony");
    if(base.targetStyle?.status!=="available"){
      add("confirmed_target_unavailable");
      continue;
    }

    // Existing E3 checks target responsiveness; this SC-04 layer checks
    // that a controlled target switch does not modify face observations.
    if(source===sweep[0]){
      const alternatives=sweep.filter(x=>x.faceGroupId===source.faceGroupId);
      const faceBaseline=JSON.stringify(base.currentFaceProfile);
      for(const alternative of alternatives){
        const other=build(source.analysis,alternative.surveyAnswers,"face_harmony");
        targetComparisonCount++;
        if(JSON.stringify(other.currentFaceProfile)!==faceBaseline)
          add("target_change_mutates_face_profile");
        if(signature(other)!==signature(base))targetChangedCount++;
      }
    }

    for(const relation of currentRelations){
      const path=PROFILE_KEY_FEATURE_SOURCES[relation.sourceFeatureKey];
      if(!path){add("modifier_source_not_in_profile",relation.relationId);continue;}
      const [group,key]=path.split(".");
      const variants=FACE_LAB_OBSERVATION_DEFINITIONS[group]?.[key]||[];
      const trigger=relation.sourceValues[0];
      const control=variants.find(v=>!relation.sourceValues.includes(v));
      if(!control||!variants.includes(trigger)){
        add("modifier_has_no_valid_counterfactual",relation.relationId);
        continue;
      }
      const off=structuredClone(source.analysis);
      const on=structuredClone(source.analysis);
      if(off.observations?.[group]?.[key]?.status!=="available")continue;
      off.observations[group][key].value=control;
      on.observations[group][key].value=trigger;
      const offHarmony=build(off,source.surveyAnswers,"face_harmony");
      const onHarmony=build(on,source.surveyAnswers,"face_harmony");
      const offForward=build(off,source.surveyAnswers,"target_forward");
      const onForward=build(on,source.surveyAnswers,"target_forward");
      const data=stats[relation.relationId];
      data.checked++;

      if(profileFeature(offHarmony,relation.sourceFeatureKey)!==control ||
         profileFeature(onHarmony,relation.sourceFeatureKey)!==trigger)
        add("controlled_face_feature_not_propagated",relation.relationId);
      if(JSON.stringify(offHarmony.targetStyle?.vector)!==
         JSON.stringify(onHarmony.targetStyle?.vector))
        add("face_change_mutates_target",relation.relationId);
      if(signature(offForward)!==signature(onForward) ||
         routeSignature(offForward)!==routeSignature(onForward))
        add("target_forward_inappropriately_uses_face_modifier",relation.relationId);
      else data.targetForwardInvariance++;

      const matched=active(offHarmony).some(action=>
        action.domain===relation.actionMatch.domain &&
        action.parameter===relation.actionMatch.parameter
      );
      if(!matched)continue; // A valid face difference need not change an unrelated target action.
      data.applicable++;
      const faceEvidence="face_feature:"+relation.sourceFeatureKey+"="+trigger;
      const observed=active(onHarmony).some(action=>
        Array.isArray(action.evidence)&&action.evidence.includes(faceEvidence)
      );
      if(!observed || signature(offHarmony)===signature(onHarmony))
        add("applicable_face_modifier_not_reflected",relation.relationId);
      else { data.modifiedWithEvidence++;matchedCases++; }
    }

    for(const domain of ["hair","makeup"]){
      // The same face+target+preference; only add an explicit whole-domain
      // exclusion. Check that *all* candidate Routes remove that domain.
      const existing=active(base).some(action=>action.domain===domain);
      if(!existing)continue;
      const changed=structuredClone(source.surveyAnswers);
      changed.constraints={
        ...(changed.constraints||{}),
        hardExclusions:[
          ...new Set([...(changed.constraints?.hardExclusions||[]),domain+"_disabled"])
        ]
      };
      const excluded=build(source.analysis,changed,"face_harmony");
      hardExclusionChecks++;
      if(JSON.stringify(excluded.targetStyle?.vector)!==
         JSON.stringify(base.targetStyle?.vector) ||
         JSON.stringify(excluded.currentFaceProfile)!==
         JSON.stringify(base.currentFaceProfile))
        add("hard_exclusion_mutates_face_or_target");
      if(active(excluded).some(action=>action.domain===domain) ||
         routes(excluded).some(route=>(route.actions||[]).some(action=>action.domain===domain)))
        add("disabled_domain_still_actionable");
      if(excluded[domain]?.status==="available")
        add("disabled_domain_execution_available");
    }
    if(original!==JSON.stringify(source.analysis) ||
       originalSurvey!==JSON.stringify(source.surveyAnswers))
      add("audit_mutated_input");
  }

  const previous=runFaceLabV2TargetResponsivenessEvaluation({
    faceCount:sweepFaceCount
  });
  if(previous.summary.hardFailureCount>0)
    add("existing_target_responsiveness_contract_failed");

  return {
    version:STYLE_CHECK_CONTRAST_AUDIT_VERSION,
    status:failures.length?"contract_violation":"verified_policy_wiring_only",
    summary:{
      syntheticInputCases:sourceCases,
      currentFaceRelations:currentRelations.length,
      faceModifiersTriggered:matchedCases,
      hardExclusionChecks,
      targetSwitchComparisons:targetComparisonCount,
      targetSwitchChangedStyleDeltas:targetChangedCount,
      priorTargetResponseHardFailures:previous.summary.hardFailureCount,
      noHumanAestheticReview:true
    },
    relations:Object.values(stats),
    failures,
    rawFaceDataReturned:false,
    targetSelectionsReturned:false,
    evaluationAccuracyValidated:false,
    productionAuthorization:false
  };
}
