import {createHash} from "node:crypto";
import {buildFaceLabV2Canonical} from "../canonical-composer.js";
import {buildStyleRoutes} from "../route-generator.js";
import {STYLE_DELTA_VERSION} from "../style-delta.js";
import {buildFaceLabV2TargetSweepCohort} from "./target-responsiveness.js";
import {
  buildStyleCheckStructuralShadow,
  STYLE_CHECK_STRUCTURAL_SHADOW_VERSION
} from "./style-check-structural-shadow.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE,
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS,
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
  canonicalizeFaceLabV2HumanPairwiseArtifact,
  validateFaceLabV2HumanPairwiseReviewItem
} from "./human-pairwise-contract.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA,
  FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA
} from "./human-pairwise-builder.js";

export const STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION =
  "face-lab-style-check-structural-human-packet-sc06b-v1";
export const STYLE_CHECK_STRUCTURAL_HUMAN_CREATED_AT =
  "2026-10-23T01:30:00.000Z";

function stable(value){
  if(Array.isArray(value))return value.map(stable);
  if(!value||typeof value!=="object")return value;
  return Object.fromEntries(Object.keys(value).sort()
    .map(k=>[k,stable(value[k])]));
}
const digest=(value)=>createHash("sha256")
  .update(typeof value==="string"?value:JSON.stringify(stable(value)))
  .digest("hex");
const seal=(value,key)=>({...value,[key]:digest(value)});

const chosen=(routes)=>{
  const list=routes?.routes||[];
  return list.find(x=>x.routeId===routes?.defaultRouteId)||list[0]||null;
};
function contextFor(canonical,caseDef){
  const target=canonical.targetStyle;
  const profile=canonical.currentFaceProfile;
  const features=(profile.keyFeatures||[])
    .filter(f=>typeof f?.direction==="string"&&Array.isArray(f.evidence)&&f.evidence.length)
    .map(f=>({key:f.key,direction:f.direction,evidence:[...f.evidence]}));
  // Human reviewers need the structural cue used by the hypothesis, rather
  // than an unexplained style adjustment. Add the SAME cue to A and B.
  // Source provenance is a synthetic structured observation, NOT a photo.
  for(const fieldPath of ["outline.jawlineAngularity","eyes.eyeOpenness","featureLayout.featureScale"]){
    const [group,key]=fieldPath.split(".");
    if(features.some(f=>f.key===key))continue;
    const observation=caseDef.analysis?.observations?.[group]?.[key];
    if(observation?.status==="available" &&
       typeof observation.value==="string" &&
       Array.isArray(observation.evidence)&&observation.evidence.length)
      features.push({key,direction:observation.value,evidence:[...observation.evidence]});
  }
  return {
    targetLabel:caseDef.targetKey,
    targetVector:Object.fromEntries(
      ["softSharp","naturalPolished","playfulMature",
       "minimalStatement","warmCool","classicTrendy"].map(k=>[k,target.vector[k]])),
    currentFaceFeatures:features,
    stylingScope:[...(target.stylingScope||[])],
    constraints:{
      changeTolerance:target.changeTolerance||null,
      makeupIntensity:target.constraints?.makeup?.intensity||null,
      dailyMinutes:target.constraints?.lifestyle?.dailyMinutes??null,
      budgetBand:target.constraints?.lifestyle?.budgetBand||null,
      maintenanceTolerance:target.constraints?.lifestyle?.maintenanceTolerance||null,
      hardExclusions:[...(target.constraints?.hardExclusions||[])]
    }
  };
}

function visibleOption(route,baselineActions){
  const original=new Map((baselineActions||[])
    .map(a=>[[a.domain,a.parameter,a.direction].join("|"),a]));
  const projected={
    routeStrategy:route.strategy,
    actions:(route.actions||[]).map(a=>{
      const key=[a.domain,a.parameter,a.direction].join("|");
      const baseline=original.get(key);
      const explanation=baseline?.explanation||a.explanation;
      const reason=baseline?.reason||a.reason;
      const evidence=(baseline?.evidence||a.evidence||[])
        .filter(v=>typeof v==="string" &&
          !v.startsWith("candidate_"));
      return {
        domain:a.domain,parameter:a.parameter,
        direction:a.direction,strength:a.strength,
        reason,evidence,explanation
      };
    })
  };
  return {...projected,recommendationDigest:digest(projected)};
}

function build(){
  const cohort=buildFaceLabV2TargetSweepCohort({faceCount:8});
  const rows=[];
  const dropReasons={no_modifier:0,no_visible_difference:0};
  for(const def of cohort.cases){
    const canonical=buildFaceLabV2Canonical({
      analysis:def.analysis,surveyAnswers:def.surveyAnswers
    });
    if(canonical.targetStyle?.status!=="available")continue;
    const candidate=buildStyleCheckStructuralShadow({
      currentFaceProfile:canonical.currentFaceProfile,
      targetStyle:canonical.targetStyle
    });
    if(candidate.candidatePolicy?.productionActive!==false)
      throw Error("structural candidate unexpectedly production-active");
    const ledger=candidate.shadowLedger||[];
    if(!ledger.length){dropReasons.no_modifier++;continue;}
    const currentRoute=chosen(canonical.routes);
    const candidateRoute=chosen(buildStyleRoutes(candidate,{
      targetStyle:canonical.targetStyle
    }));
    if(!currentRoute||!candidateRoute)continue;
    const current=visibleOption(currentRoute,canonical.styleDelta.priorities);
    const alternative=visibleOption(candidateRoute,canonical.styleDelta.priorities);
    if(current.recommendationDigest===alternative.recommendationDigest){
      dropReasons.no_visible_difference++;continue;
    }
    rows.push({def,canonical,current,alternative,ledger});
  }
  rows.sort((a,b)=>digest("sc06b-sort|"+a.def.caseId)
    .localeCompare(digest("sc06b-sort|"+b.def.caseId)));
  const reviewItems=[];
  const mappings=[];
  for(let index=0;index<rows.length;index++){
    const row=rows[index];
    const pairId="flhp_"+digest(STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION+
      "|"+row.def.caseId).slice(0,24);
    const currentOnA=index%2===0;
    const A=currentOnA?row.current:row.alternative;
    const B=currentOnA?row.alternative:row.current;
    const item={
      schemaVersion:FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_ITEM_SCHEMA,
      contractVersion:FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
      pairId,evaluationCaseRef:row.def.caseId,
      context:contextFor(row.canonical,row.def),
      options:{A,B},
      blindState:{...FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE},
      createdAt:STYLE_CHECK_STRUCTURAL_HUMAN_CREATED_AT
    };
    const finalItem={
      ...item,
      itemDigest:digest(
        canonicalizeFaceLabV2HumanPairwiseArtifact(
          {...item,itemDigest:"0".repeat(64)},"itemDigest"
        )
      )
    };
    const check=validateFaceLabV2HumanPairwiseReviewItem(finalItem);
    if(!check.ok)throw Error("invalid structural review item "+pairId+
      " "+JSON.stringify(check.errors));
    reviewItems.push(finalItem);
    const roles={
      A:currentOnA?"current":"candidate",
      B:currentOnA?"candidate":"current"
    };
    mappings.push({
      pairId,evaluationCaseRef:row.def.caseId,
      targetKey:row.def.targetKey,
      sampleBucket:"structural_route_visible",
      candidateRelationIds:[...new Set(row.ledger.map(x=>x.id))],
      selectedRouteChanged:true,
      mapping:Object.fromEntries(["A","B"].map(side=>[
        side,{
          role:roles[side],
          engineVersion:roles[side]==="current"?
            STYLE_DELTA_VERSION:STYLE_CHECK_STRUCTURAL_SHADOW_VERSION,
          recommendationDigest:finalItem.options[side].recommendationDigest
        }
      ]))
    });
  }
  const packetId="flhpb_"+digest(STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION+
    "|"+reviewItems.map(i=>i.pairId).join("|")).slice(0,24);
  const basePacket={
    schemaVersion:FACE_LAB_V2_HUMAN_PAIRWISE_REVIEW_PACKET_SCHEMA,
    builderVersion:STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION,
    contractVersion:FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
    packetId,dimensions:[...FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS],
    reviewItems,createdAt:STYLE_CHECK_STRUCTURAL_HUMAN_CREATED_AT
  };
  const reviewPacket=seal(basePacket,"packetDigest");
  const counts={};
  mappings.flatMap(x=>x.candidateRelationIds)
    .forEach(x=>{counts[x]=(counts[x]||0)+1;});
  const operatorBase={
    schemaVersion:FACE_LAB_V2_HUMAN_PAIRWISE_OPERATOR_MANIFEST_SCHEMA,
    builderVersion:STYLE_CHECK_STRUCTURAL_HUMAN_PACKET_VERSION,
    contractVersion:FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
    packetId,reviewPacketDigest:reviewPacket.packetDigest,
    createdAt:STYLE_CHECK_STRUCTURAL_HUMAN_CREATED_AT,
    sampling:{
      seed:"SC06B-LOCKED-SYNTHETIC-COHORT",
      pairCount:mappings.length,
      bucketCounts:{"structural_route_visible":mappings.length},
      highRepetitionTargets:[]
    },mappings
  };
  return {
    reviewPacket,
    operatorManifest:seal(operatorBase,"manifestDigest"),
    diagnostics:{
      syntheticInputCount:cohort.cases.length,
      candidateActivatedCases:cohort.cases.length-dropReasons.no_modifier,
      reviewerVisiblePairs:reviewItems.length,
      excludedNoVisibleDifference:dropReasons.no_visible_difference,
      sampledHypothesisCounts:counts,
      syntheticOnly:true,realPhotoReviewed:0,humanJudgments:0,
      productionAuthorization:false
    }
  };
}

export function buildStyleCheckStructuralHumanReviewPacket(){
  return build().reviewPacket;
}
// Confidential operator-only: do NOT hand to review participants.
export function buildStyleCheckStructuralHumanOperatorManifest(){
  return build().operatorManifest;
}
export function auditStyleCheckStructuralHumanPacketSampling(){
  return build().diagnostics;
}
