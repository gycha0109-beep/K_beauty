import assert from "node:assert/strict";
import {
  STYLE_CHECK_REAL_STUDY_READINESS_VERSION,
  STYLE_CHECK_SC05_EVALUATION_AXES,
  auditStyleCheckRealStudyPreflight
} from "../lib/face-lab-v2/evaluation/style-check-real-study-readiness.js";
import {
  FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE,
  FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION
} from "../lib/face-lab-v2/evaluation/human-pairwise-contract.js";
import {
  buildFaceLabV2HumanPairwiseReviewPacket
} from "../lib/face-lab-v2/evaluation/human-pairwise-builder.js";

// The already-frozen 14 synthetic review items are not real-person evidence.
const existing=buildFaceLabV2HumanPairwiseReviewPacket();
assert.equal(existing.reviewItems.length,14);
assert.equal(existing.reviewItems.every(x=>
  Object.keys(FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE).every(k=>
    x.blindState?.[k]===true
  )
),true);

const reviewers=(prefix)=>["observation","recommendation"].flatMap(task=>
  ["r1","r2"].map(x=>({
    task,reviewerRef:prefix+"-"+x,assignmentState:"planned"
  }))
);
const permission={
  evaluationConsent:"not_applicable",
  evaluationUseRights:"synthetic_evaluation_only",
  withdrawalProcessVersion:null,
  deletionProcessVersion:null
};
const sample=(n,split)=>({
  sampleRef:"fixture-"+n,
  subjectGroupRef:"synthetic-subject-"+n,
  derivationFamilyRef:"synthetic-family-"+n,
  sourceClass:"synthetic_fixture",
  split,permission:{...permission},
  captureConditions:split==="development"?
    ["frontal_clear","image_soft","color_unusable"]:
    ["slight_yaw","partial_occlusion","low_light","nonuniform_light","cosmetics_visible"],
  observationGroups:split==="development"?
    ["outline","vertical","eyes"]:
    ["featureLayout","visualLanguage","colorAppearance"],
  reviewerAssignments:reviewers("reviewer"+n)
});
const base={
  protocolVersion:STYLE_CHECK_REAL_STUDY_READINESS_VERSION,
  humanContractVersion:FACE_LAB_V2_HUMAN_PAIRWISE_CONTRACT_VERSION,
  samplingPlanVersion:"sc05-protocol-synthetic-fixture-v1",
  blinding:{...FACE_LAB_V2_HUMAN_PAIRWISE_BLIND_STATE},
  operatorMappingHeldSeparate:true,
  evaluationAxes:[...STYLE_CHECK_SC05_EVALUATION_AXES],
  samples:[sample("001","development"),sample("002","locked_holdout")]
};
const original=JSON.stringify(base);
const report=auditStyleCheckRealStudyPreflight(base);
assert.equal(report.status,"plan_contract_valid_not_executed",JSON.stringify(report.issues));
assert.deepEqual(report.issues,[]);
assert.equal(report.summary.sampleCount,2);
assert.equal(report.summary.realPersonSampleCount,0);
assert.equal(report.summary.syntheticSampleCount,2);
assert.equal(report.summary.reviewAssignmentCount,8);
assert.equal(report.summary.independentReviewerPlanCount,4);
assert.equal(report.missingObservationGroups.length,0);
assert.equal(report.missingCaptureConditions.length,0);
assert.equal(report.pilotExecutionAuthorized,false);
assert.equal(report.productionAuthorization,false);
assert.equal(report.realWorldStyleQualityValidated,false);
assert.equal(report.containsHumanJudgments,false);
assert.equal(JSON.stringify(base),original,"audit must never mutate study plan");
assert.equal(JSON.stringify(report).includes("synthetic-subject"),false);
assert.equal(JSON.stringify(report).includes("reviewer001"),false);

function rejects(mutate,expected){
  const changed=structuredClone(base);
  mutate(changed);
  const out=auditStyleCheckRealStudyPreflight(changed);
  assert.equal(out.status,"invalid_plan",JSON.stringify(out));
  assert.ok(out.issues.includes(expected),JSON.stringify(out.issues));
  assert.equal(out.pilotExecutionAuthorized,false);
  assert.equal(out.productionAuthorization,false);
}
rejects(x=>{x.blinding.pairMappingHidden=false},"blind_state_incomplete");
rejects(x=>{x.operatorMappingHeldSeparate=false},"operator_role_mapping_must_be_separate");
rejects(x=>{x.evaluationAxes=["target_fit"]},"evaluation_axes_missing_or_unfrozen");
rejects(x=>{x.samples[1].subjectGroupRef=x.samples[0].subjectGroupRef},
  "subject_or_family_split_leakage");
rejects(x=>{x.samples[1].derivationFamilyRef=x.samples[0].derivationFamilyRef},
  "subject_or_family_split_leakage");
rejects(x=>{x.samples[1].reviewerAssignments=x.samples[1].reviewerAssignments.slice(0,1)},
  "locked_holdout_needs_two_independent_reviewers");
rejects(x=>{x.samples[1].reviewerAssignments.push(x.samples[1].reviewerAssignments[0])},
  "duplicate_reviewer_task_assignment");
rejects(x=>{x.samples[0].rawImage="data:image/png;base64,injected"},
  "sample_has_unapproved_fields");
rejects(x=>{x.samples[0].observationGroups.push("skinToneVerified")},
  "observation_groups_invalid");
rejects(x=>{x.samples[0].captureConditions.push("unknown_captured_face")},
  "capture_conditions_invalid");
rejects(x=>{x.samples[0].sourceClass="real_person"},
  "real_person_permission_and_withdrawal_gate");
rejects(x=>{
  x.samples[0].sourceClass="real_person";
  x.samples[0].permission={
    evaluationConsent:"operator_attested",
    evaluationUseRights:"operator_attested",
    withdrawalProcessVersion:"withdraw-v1",
    deletionProcessVersion:"delete-v1"
  };
  x.samples[0].imageUrl="https://example.com/photo.jpg";
}, "sample_has_unapproved_fields");
rejects(x=>{x.samples[0].permission.evaluationConsent="operator_attested"},
  "synthetic_cannot_claim_real_person_rights");
rejects(x=>{x.samples=[]},"sample_plan_missing_or_unbounded");

const realPlan=structuredClone(base);
realPlan.samples[0].sourceClass="real_person";
realPlan.samples[0].permission={
  evaluationConsent:"operator_attested",
  evaluationUseRights:"operator_attested",
  withdrawalProcessVersion:"withdraw-v1",
  deletionProcessVersion:"delete-v1"
};
const realResult=auditStyleCheckRealStudyPreflight(realPlan);
assert.equal(realResult.status,"plan_contract_valid_not_executed");
assert.equal(realResult.summary.realPersonSampleCount,1);
assert.equal(realResult.pilotExecutionAuthorized,false,
  "operator metadata does not prove real consent or create human judgments");
assert.equal(realResult.productionAuthorization,false);

console.log(JSON.stringify({
  ok:true,suite:STYLE_CHECK_REAL_STUDY_READINESS_VERSION,
  priorSyntheticBlindPairs:existing.reviewItems.length,
  samplePlansTested:2,negativeCases:14,
  realHumanImagesCollected:0,realHumanJudgmentsCollected:0,
  existingHumanPairwiseContractReused:true,
  operatorConsentVerificationRequired:true,
  productionAuthorityGranted:false
}));
