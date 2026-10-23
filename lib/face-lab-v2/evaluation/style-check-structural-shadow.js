import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../../face-lab-observation-contract.js";
import { buildStyleDelta } from "../style-delta.js";
import { buildStyleRoutes } from "../route-generator.js";
import { buildFaceLabV2Canonical } from "../canonical-composer.js";
import { buildFaceLabV2TargetSweepCohort } from "./target-responsiveness.js";

/**
 * SC-06B: candidate-only feasibility experiments for under-used, EXISTING
 * structural observations. These are hypotheses to submit to Human review,
 * NOT statements about aesthetic suitability or production recommendation.
 * Imported only by evaluation / CI, never by canonical composer or runtime.
 */
export const STYLE_CHECK_STRUCTURAL_SHADOW_VERSION =
  "face-lab-style-check-structural-shadow-sc06b-v1";

export const UNTESTED_STRUCTURAL_FIELDS = Object.freeze([
  "outline.foreheadWidthVsCheek",
  "outline.jawlineAngularity",
  "outline.jawTaper",
  "outline.cheekboneProminence",
  "vertical.midfaceLength",
  "vertical.lowerFaceLength",
  "eyes.eyeLength",
  "eyes.eyeOpenness",
  "featureLayout.featureScale",
  "featureLayout.focalFeatures"
]);

export const STRUCTURAL_SHADOW_HYPOTHESES = Object.freeze([
  Object.freeze({
    id: "SC-STRUCT-001",
    fieldPath: "outline.jawlineAngularity",
    trigger: "angular",
    actionMatch: Object.freeze({
      domain: "eyewear", parameter: "angularity",
      direction: "increase", reason: "target_softSharp_high"
    }),
    operation: "strength_cap",
    limit: "light",
    humanQuestion: "각이 두드러지는 턱선과 안경테 각도 강조를 함께 조절할 때 목표 적합성이 개선되는가?"
  }),
  Object.freeze({
    id: "SC-STRUCT-002",
    fieldPath: "eyes.eyeOpenness",
    trigger: "wide",
    actionMatch: Object.freeze({
      domain: "makeup", parameter: "outerEyeEmphasis",
      direction: "increase", reason: "target_softSharp_high"
    }),
    operation: "strength_cap",
    limit: "light",
    humanQuestion: "눈의 개방감이 큰 사진에서 눈 바깥쪽 강조를 줄인 후보가 더 실용적이고 목표에 맞는가?"
  }),
  Object.freeze({
    id: "SC-STRUCT-003",
    fieldPath: "featureLayout.featureScale",
    trigger: "large",
    actionMatch: Object.freeze({
      domain: "makeup", parameter: "selectedFeatureContrast",
      direction: "increase", reason: "target_minimalStatement_high"
    }),
    operation: "strength_cap",
    limit: "light",
    humanQuestion: "특징 크기가 크게 관찰될 때 포인트 대비를 완화한 후보가 과증폭 없이 추구미를 살리는가?"
  })
]);

const rank=Object.freeze({light:1,moderate:2,strong:3});
const validObserved=(profile,path,trigger)=>{
  const [group,key]=path.split(".");
  const defined=FACE_LAB_OBSERVATION_DEFINITIONS[group]?.[key];
  return Array.isArray(defined)&&defined.includes(trigger)&&
    profile?.structuralProfile?.values?.[key]===trigger;
};
const isMatching=(action,match)=>Object.keys(match)
  .every(k=>action?.[k]===match[k]);
const actionSemantics=(a)=>[
  a?.domain,a?.parameter,a?.direction,a?.strength,a?.reason
].join(":");
const active=(delta)=>(delta?.priorities||[])
  .filter(x=>x.constraintState==="allowed");
const signature=(delta)=>active(delta).map(actionSemantics).sort().join("|");
const routeSignature=(r)=>(r?.routes||[]).map(route=>[
  route.strategy,
  ...(route.actions||[]).map(actionSemantics).sort()
].join(":")).sort().join("|");

export function buildStyleCheckStructuralShadow({
  currentFaceProfile,targetStyle
}={}) {
  const current=buildStyleDelta({currentFaceProfile,targetStyle});
  const disallowed=current.status!=="available" ||
    targetStyle?.recommendationPriority!=="face_harmony";
  const ledger=[];
  const next=(current.priorities||[]).map(action=>{
    const cloned={...action,evidence:[...(action?.evidence||[])]};
    if(disallowed||action.constraintState!=="allowed")return cloned;
    for(const hypothesis of STRUCTURAL_SHADOW_HYPOTHESES) {
      if(!validObserved(currentFaceProfile,hypothesis.fieldPath,
        hypothesis.trigger))continue;
      if(!isMatching(cloned,hypothesis.actionMatch))continue;
      if((rank[cloned.strength]||0)<=(rank[hypothesis.limit]||0))continue;
      const before=cloned.strength;
      cloned.strength=hypothesis.limit;
      cloned.reason="candidate_structural_guard";
      cloned.expectedEffect="얼굴 구조 단서를 참고해 강조 강도를 한 단계 낮추는 대안을 사람 평가에서 비교합니다.";
      cloned.evidence.push("candidate_structural:"+hypothesis.fieldPath+"="+hypothesis.trigger);
      cloned.evidence.push("candidate_relation:"+hypothesis.id);
      ledger.push({
        id:hypothesis.id,fieldPath:hypothesis.fieldPath,
        domain:cloned.domain,parameter:cloned.parameter,
        beforeStrength:before,afterStrength:cloned.strength,
        humanReviewRequired:true
      });
    }
    return cloned;
  });
  return {
    ...current,
    priorities:next,
    version:STYLE_CHECK_STRUCTURAL_SHADOW_VERSION,
    candidatePolicy:{
      productionActive:false,
      humanCalibrationRequired:true,
      independentRealPhotoValidationRequired:true,
      permissionToReplaceCanonical:false
    },
    shadowLedger:ledger
  };
}

/**
 * Fixed structured observation tests: counts actual policy opportunity
 * separately from stylistic merit. No photo, names or specific values returned.
 */
export function auditStyleCheckStructuralShadow({faceCount=8}={}) {
  if(!Number.isInteger(faceCount)||faceCount<1||faceCount>16)
    return {version:STYLE_CHECK_STRUCTURAL_SHADOW_VERSION,
      status:"invalid_input",errors:["invalid_face_count"]};

  const cohort=buildFaceLabV2TargetSweepCohort({faceCount});
  const counts=Object.fromEntries(STRUCTURAL_SHADOW_HYPOTHESES.map(h=>[
    h.id,{
      fieldPath:h.fieldPath,
      actionDomain:h.actionMatch.domain,
      matchedSourceAndAction:0,changedActions:0,
      routeChangedCases:0
    }
  ]));
  let compared=0,activated=0,routeChanged=0,heldForward=0;
  const errors=[];
  for(const item of cohort.cases){
    const inputBefore=JSON.stringify(item.analysis);
    const canonical=buildFaceLabV2Canonical({
      analysis:item.analysis,surveyAnswers:item.surveyAnswers
    });
    const current=buildStyleDelta({
      currentFaceProfile:canonical.currentFaceProfile,
      targetStyle:canonical.targetStyle
    });
    const shadow=buildStyleCheckStructuralShadow({
      currentFaceProfile:canonical.currentFaceProfile,
      targetStyle:canonical.targetStyle
    });
    if(shadow.candidatePolicy.productionActive!==false)
      errors.push("candidate_activation_forbidden");
    if(current.priorities.length!==shadow.priorities.length)
      errors.push("action_count_mutation");
    for(const h of STRUCTURAL_SHADOW_HYPOTHESES){
      const account=counts[h.id];
      if(validObserved(canonical.currentFaceProfile,h.fieldPath,h.trigger)&&
        active(current).some(a=>isMatching(a,h.actionMatch)&&
          rank[a.strength]>rank[h.limit]))
        account.matchedSourceAndAction++;
    }
    const applied=new Set(shadow.shadowLedger.map(x=>x.id));
    for(const id of applied)counts[id].changedActions++;
    const cRoutes=buildStyleRoutes(current,{targetStyle:canonical.targetStyle});
    const sRoutes=buildStyleRoutes(shadow,{targetStyle:canonical.targetStyle});
    if(routeSignature(cRoutes)!==routeSignature(sRoutes)){
      routeChanged++;
      for(const id of applied)counts[id].routeChangedCases++;
    }
    if(signature(current)!==signature(shadow)){
      activated++;
      if(!shadow.shadowLedger.length)
        errors.push("untracked_candidate_action_change");
    }else if(shadow.shadowLedger.length)
      errors.push("ledger_without_semantic_change");
    if(JSON.stringify(item.analysis)!==inputBefore)
      errors.push("fixture_mutation");
    compared++;
    const forward=buildFaceLabV2Canonical({
      analysis:item.analysis,
      surveyAnswers:{...item.surveyAnswers,recommendationPriority:"target_forward"}
    });
    const fBaseline=buildStyleDelta({
      currentFaceProfile:forward.currentFaceProfile,targetStyle:forward.targetStyle
    });
    const fShadow=buildStyleCheckStructuralShadow({
      currentFaceProfile:forward.currentFaceProfile,targetStyle:forward.targetStyle
    });
    if(signature(fBaseline)!==signature(fShadow)||fShadow.shadowLedger.length)
      errors.push("target_forward_override");
    else heldForward++;
  }
  return {
    version:STYLE_CHECK_STRUCTURAL_SHADOW_VERSION,
    status:errors.length?"contract_violation":"shadow_feasibility_only",
    summary:{
      existingUnmodifiedStructuralFields:UNTESTED_STRUCTURAL_FIELDS.length,
      exploredCandidateQuestions:STRUCTURAL_SHADOW_HYPOTHESES.length,
      baselineCases:compared,
      activatedCases:activated,
      routeChangedCases:routeChanged,
      targetForwardHeldCases:heldForward,
      realPhotoReviewed:0,
      humanJudgments:0
    },
    hypothesisCounts:counts,
    errors:[...new Set(errors)],
    photoObservationAccuracyValidated:false,
    stylingPreferenceValidated:false,
    productionAuthorization:false
  };
}
