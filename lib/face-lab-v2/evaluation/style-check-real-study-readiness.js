import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../../face-lab-observation-contract.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE,
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS
} from "./human-pairwise-contract.js";

/**
 * SC-05: contract-only gate before ANY real-person Style Check study.
 *
 * All inputs here are anonymous plan metadata. Neither image bytes, face
 * coordinates, labels, respondent comments, nor human judgments are accepted.
 * Plan validation is NOT a verification of legal consent or a quality result.
 */
export const STYLE_CHECK_REAL_STUDY_READINESS_VERSION =
  "face-lab-style-check-sc05-study-preflight-v1";

const SOURCE_CLASSES=new Set(["synthetic_fixture","real_person"]);
const SPLITS=new Set(["development","locked_holdout"]);
const TASKS=["observation","recommendation"];
const CONDITIONS=new Set([
  "frontal_clear","slight_yaw","partial_occlusion","low_light",
  "nonuniform_light","cosmetics_visible","color_unusable","image_soft"
]);
const SAFE_SAMPLE_KEYS=[
  "sampleRef","subjectGroupRef","derivationFamilyRef","sourceClass",
  "split","permission","captureConditions","observationGroups",
  "reviewerAssignments"
];
const SAFE_PERMISSION_KEYS=[
  "evaluationConsent","evaluationUseRights","withdrawalProcessVersion",
  "deletionProcessVersion"
];
const SAFE_REVIEWER_KEYS=["task","reviewerRef","assignmentState"];
const array=(v)=>Array.isArray(v)?v:[];
const record=(v)=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const keysOnly=(v,keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k));
const token=(v)=>typeof v==="string"&&/^[a-zA-Z0-9][a-zA-Z0-9._:-]{1,95}$/.test(v);
const unique=(xs)=>new Set(xs).size===xs.length;
const groupNames=Object.keys(FACE_LAB_OBSERVATION_DEFINITIONS);
const humanDimensions=[...FACE_LAB_V2_HUMAN_PAIRWISE_DIMENSIONS];

export const STYLE_CHECK_SC05_EVALUATION_AXES = Object.freeze([
  "observation_agreement",
  ...humanDimensions,
  "not_assessable_distribution"
]);

export function auditStyleCheckRealStudyPreflight(plan) {
  const problems=[];
  const add=(code)=>problems.push(code);
  const summaries={
    sampleCount:0,realPersonSampleCount:0,syntheticSampleCount:0,
    developmentCount:0,lockedHoldoutCount:0,
    conditionsCovered:[],observationGroupsCovered:[],
    reviewAssignmentCount:0,independentReviewerPlanCount:0,
    humanJudgmentsCollectedByThisAudit:0
  };
  const output=()=>({
    version:STYLE_CHECK_REAL_STUDY_READINESS_VERSION,
    status:problems.length?"invalid_plan":"plan_contract_valid_not_executed",
    issues:[...new Set(problems)].sort(),
    summary:summaries,
    missingObservationGroups:groupNames.filter(g=>
      !summaries.observationGroupsCovered.includes(g)),
    missingCaptureConditions:[...CONDITIONS].filter(g=>
      !summaries.conditionsCovered.includes(g)),
    manualGates:[
      "verify_real_person_evaluation_rights_outside_this_validator",
      "confirm_withdrawal_deletion_and_access_controls",
      "collect_independent_sealed_human_judgments",
      "freeze_holdout_and_register_metrics_before_quality_claims"
    ],
    operatorReviewRequired:true,
    pilotExecutionAuthorized:false,
    realWorldStyleQualityValidated:false,
    productionAuthorization:false,
    containsRealPhotoData:false,
    containsHumanJudgments:false
  });

  if(!record(plan)||!keysOnly(plan,[
    "protocolVersion","humanContractVersion","samplingPlanVersion",
    "blinding","operatorMappingHeldSeparate",
    "evaluationAxes","samples"
  ])){
    add("plan_shape_invalid");
    return output();
  }
  if(plan.protocolVersion!==STYLE_CHECK_REAL_STUDY_READINESS_VERSION)
    add("protocol_version_mismatch");
  if(plan.humanContractVersion!==FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION)
    add("human_contract_version_mismatch");
  if(!token(plan.samplingPlanVersion))
    add("sampling_plan_version_missing");
  if(plan.operatorMappingHeldSeparate!==true)
    add("operator_role_mapping_must_be_separate");
  if(!record(plan.blinding) ||
    Object.keys(FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE).some(key=>
      plan.blinding[key]!==true) ||
    !keysOnly(plan.blinding,Object.keys(FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE)))
    add("blind_state_incomplete");
  if(!Array.isArray(plan.evaluationAxes) ||
    !unique(plan.evaluationAxes) ||
    STYLE_CHECK_SC05_EVALUATION_AXES.some(x=>!plan.evaluationAxes.includes(x)) ||
    plan.evaluationAxes.some(x=>!STYLE_CHECK_SC05_EVALUATION_AXES.includes(x)))
    add("evaluation_axes_missing_or_unfrozen");
  if(!Array.isArray(plan.samples)||plan.samples.length===0 ||
    plan.samples.length>500)
    add("sample_plan_missing_or_unbounded");

  const samples=array(plan.samples).slice(0,500);
  const seenSamples=new Set();
  const subjectSplits=new Map(),familySplits=new Map();
  const conditionSet=new Set(),observationGroupSet=new Set();
  for(const sample of samples){
    summaries.sampleCount++;
    if(!keysOnly(sample,SAFE_SAMPLE_KEYS)){
      add("sample_has_unapproved_fields");
      continue;
    }
    if(!token(sample.sampleRef)||seenSamples.has(sample.sampleRef))
      add("sample_reference_missing_or_duplicate");
    else seenSamples.add(sample.sampleRef);
    if(!token(sample.subjectGroupRef)||!token(sample.derivationFamilyRef))
      add("pseudonymous_group_reference_invalid");
    if(!SOURCE_CLASSES.has(sample.sourceClass))add("sample_origin_invalid");
    if(!SPLITS.has(sample.split))add("sample_split_invalid");
    if(sample.split==="development")summaries.developmentCount++;
    if(sample.split==="locked_holdout")summaries.lockedHoldoutCount++;
    if(sample.sourceClass==="real_person")summaries.realPersonSampleCount++;
    if(sample.sourceClass==="synthetic_fixture")summaries.syntheticSampleCount++;
    for(const [map,value] of [[subjectSplits,sample.subjectGroupRef],
      [familySplits,sample.derivationFamilyRef]]){
      if(!token(value)||!SPLITS.has(sample.split))continue;
      const before=map.get(value);
      if(before&&before!==sample.split)add("subject_or_family_split_leakage");
      map.set(value,sample.split);
    }
    if(!keysOnly(sample.permission,SAFE_PERMISSION_KEYS)){
      add("evaluation_permission_record_missing");
    } else if(sample.sourceClass==="real_person"){
      if(sample.permission.evaluationConsent!=="operator_attested" ||
        sample.permission.evaluationUseRights!=="operator_attested" ||
        !token(sample.permission.withdrawalProcessVersion) ||
        !token(sample.permission.deletionProcessVersion))
        add("real_person_permission_and_withdrawal_gate");
    } else if(sample.sourceClass==="synthetic_fixture"&&
      (sample.permission.evaluationConsent!=="not_applicable" ||
       sample.permission.evaluationUseRights!=="synthetic_evaluation_only"))
      add("synthetic_cannot_claim_real_person_rights");
    if(!Array.isArray(sample.captureConditions)||
      !unique(sample.captureConditions)||
      sample.captureConditions.some(c=>!CONDITIONS.has(c)))
      add("capture_conditions_invalid");
    else sample.captureConditions.forEach(c=>conditionSet.add(c));
    if(!Array.isArray(sample.observationGroups)||
      !unique(sample.observationGroups)||
      sample.observationGroups.some(g=>!groupNames.includes(g)))
      add("observation_groups_invalid");
    else sample.observationGroups.forEach(g=>observationGroupSet.add(g));
    if(!Array.isArray(sample.reviewerAssignments))
      add("reviewer_assignment_plan_missing");
    const slots=new Map(TASKS.map(t=>[t,new Set()]));
    for(const assignment of array(sample.reviewerAssignments)){
      summaries.reviewAssignmentCount++;
      if(!keysOnly(assignment,SAFE_REVIEWER_KEYS)||
        !TASKS.includes(assignment.task) ||
        !token(assignment.reviewerRef) ||
        assignment.assignmentState!=="planned") {
        add("reviewer_assignment_invalid");
        continue;
      }
      const group=slots.get(assignment.task);
      if(group.has(assignment.reviewerRef))
        add("duplicate_reviewer_task_assignment");
      group.add(assignment.reviewerRef);
    }
    for(const task of TASKS){
      const reviewers=slots.get(task);
      if(sample.split==="locked_holdout" && reviewers.size<2)
        add("locked_holdout_needs_two_independent_reviewers");
      if(reviewers.size>=2)summaries.independentReviewerPlanCount++;
    }
  }
  summaries.conditionsCovered=[...conditionSet].sort();
  summaries.observationGroupsCovered=[...observationGroupSet].sort();
  // Even a structurally valid plan has zero actual Human or real-photo proof.
  // Separate operator verification and sealed Human artifacts are mandatory.
  return output();
}
