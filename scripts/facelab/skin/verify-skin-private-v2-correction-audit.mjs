// Synthetic metadata only. No real human cohort, OpenAI requests, images or
// provider response. Validates private historical v1/v2 vs new v2-only audit.
import assert from "node:assert/strict";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";
import { comparePrivateSkinV2Correction as compare } from "./skin-private-v2-correction-audit.mjs";

const ids=["TC-01","TC-02","TC-03","TC-04","TC-05"];
const clone=v=>structuredClone(v);
const makeV2Rows=(mode)=>mode==="ineligible"?[]:SKIN_VISIBLE_AXES.map((axis,i)=>({
  axis,state:mode==="partial"&&i===0?"not_seen":"unknown",
  value:mode==="partial"&&i===0?0:null,
  confidence:mode==="partial"&&i===0?"medium":"unknown"
}));
function variant(id,version,mode="ready"){
  const isV2=version==="v2";
  const eligible=mode!=="ineligible";
  return {
    caseId:id,variant:version,responseComplete:true,finishReason:"stop",
    inputTokens:400,outputTokens:300,nearTokenCap:false,
    structuralResult:(!isV2||mode==="ready")?"STRUCTURALLY_VALID":"INVALID_OR_INCOMPLETE",
    faceStatus:"available",faceAvailableFieldCount:19,
    skinAnalysisEligible:eligible,
    skinAxisStates:{
      present:0,not_seen:0,unassessable:0,unknown:7
    },v2AxisCount:isV2?(eligible?7:0):null,
    v2ContractStatus:isV2?(eligible?
      mode==="ready"?"ELIGIBLE_SEVEN_VALIDATED":"ELIGIBLE_SKIN_EVIDENCE_HOLD"
      :"EXPECTED_INELIGIBLE_EMPTY"):"not_applicable",
    v2Axes:isV2?makeV2Rows(mode):null
  };
}
const metadataPrivacy={
  gitHubActionsUsed:false,rawOutputsPersisted:false,photosSavedByRunner:false,
  humanPhotoSentToProvider:true
};
const studyId="PRIVATE_SYNTHETIC_ONLY";
const baseline={
  version:"skin-private-v1v2-cohort-v1",studyId,
  outcome:"PRIVATE_REAL_PHOTO_STRUCTURAL_REVIEW_ONLY",providerCallsAttempted:10,
  privacy:metadataPrivacy,
  cases:ids.map((id,i)=>({
    caseId:id,photoShortSidePx:300+i,
    variants:[
      variant(id,"v1"),
      variant(id,"v2",i===4?"ineligible":i===3?"ready":"partial")
    ]
  }))
};
const correction={
  version:"skin-private-v1v2-cohort-v1",studyId,studyMode:"v2_only",
  outcome:"PRIVATE_V2_ONLY_STRUCTURAL_RESEARCH_ONLY",providerCallsAttempted:5,
  privacy:metadataPrivacy,
  cases:ids.map((id,i)=>({
    caseId:id,photoShortSidePx:300+i,
    variants:[variant(id,"v2",i===4?"ineligible":"ready")]
  }))
};
const report=compare(baseline,correction);
assert.equal(report.status,"PRIVATE_PAIRED_HISTORICAL_COMPARISON_RESEARCH_ONLY");
assert.equal(report.matchedOpaqueCases,5);
assert.equal(report.baseline.skinEligible,4);
assert.equal(report.baseline.eligibleSkinContractPass,1);
assert.equal(report.baseline.eligibleSkinContractHolds,3);
assert.equal(report.corrected.eligibleSkinContractPass,4);
assert.equal(report.corrected.expectedIneligibleEmpty,1);
assert.equal(report.changes.eligibleContractsBecameValid,3);
assert.equal(report.changes.eligibleContractsRegressed,0);
assert.equal(report.changes.faceFieldLossVsPriorV1,0);
assert.equal(report.changes.faceStatusLossVsPriorV1,0);
assert.equal(report.changes.photoShortSideChanges,0);
assert.equal(report.caveats.actualImageIdentityAcrossRunsVerified,false);
assert.equal(report.caveats.faceValueParityVerified,false);
assert.equal(report.caveats.humanTruthVerified,false);
assert.equal(report.caveats.readyForScoring,false);
assert.equal(report.caveats.readyForRelease,false);

const weaker=clone(correction);
weaker.cases[0].photoShortSidePx=123;
weaker.cases[0].variants[0].faceAvailableFieldCount=18;
weaker.cases[1].variants[0].faceStatus="partial";
weaker.cases[2].variants[0].skinAnalysisEligible=false;
weaker.cases[2].variants[0].v2AxisCount=0;
weaker.cases[2].variants[0].v2ContractStatus="EXPECTED_INELIGIBLE_EMPTY";
weaker.cases[2].variants[0].v2Axes=[];
weaker.cases[2].variants[0].structuralResult="INVALID_OR_INCOMPLETE";
const review=compare(baseline,weaker);
assert.equal(review.changes.photoShortSideChanges,1);
assert.equal(review.changes.faceFieldLossVsPriorV1,1);
assert.equal(review.changes.faceStatusLossVsPriorV2,1);
assert.equal(review.changes.skinEligibleToIneligible,1);
assert.equal(review.changes.eligibleContractsBecameValid,2);
const unknownFace=clone(correction);
unknownFace.cases[0].variants[0].faceAvailableFieldCount=null;
const unknown=compare(baseline,unknownFace);
assert.equal(unknown.changes.faceFieldUnassessable,1);
assert.equal(unknown.changes.faceFieldLossVsPriorV1,0);
const wrongStudy=clone(correction);
wrongStudy.studyId="DIFFERENT_STUDY";
assert.throws(()=>compare(baseline,wrongStudy),/private_study_link_invalid/);
const malformed=clone(correction);
malformed.cases[4].caseId="CONFLICT";
assert.throws(()=>compare(baseline,malformed),/private_case_invalid/);
const dup=clone(correction);
dup.cases[4].caseId=dup.cases[0].caseId;
assert.throws(()=>compare(baseline,dup),/private_case_invalid/);
const wrongCalls=clone(correction);
wrongCalls.providerCallsAttempted=10;
assert.throws(()=>compare(baseline,wrongCalls),/private_cohort_invalid/);
const secret=clone(correction);
secret.cases[0].variants[0].faceFreeText="SENSITIVE_SUBJECT_NAME_SECRET";
secret.cases[0].variants[0].v2Axes[0].reason="SENSITIVE_GEOLOCATION";
const safe=compare(baseline,secret);
assert(!JSON.stringify(safe).includes("SENSITIVE"));
assert(!JSON.stringify(safe).includes("TC-01"));
assert(!JSON.stringify(safe).includes("SENSITIVE_SUBJECT_NAME"));
console.log("verify-skin-private-v2-correction-audit: PASS (synthetic aggregate-only, 5-case, no Provider or person)");
