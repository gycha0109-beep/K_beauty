// S1-D private metadata-only comparison across the original 10-call cohort
// and an opt-in 5-call v2-only correction. NO IMAGE/PROVIDER/FILE WRITES.
// Only aggregated counts and closed categorical observations returned.
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

export const SKIN_PRIVATE_V2_CORRECTION_AUDIT_VERSION="skin-private-v2-correction-audit-v1";
const IDS=new Set(["TC-01","TC-02","TC-03","TC-04","TC-05"]);
const AXES=new Set(SKIN_VISIBLE_AXES);
const FACE_RANK={unavailable:0,insufficient_evidence:1,partial:2,available:3};
function record(o){return o!==null&&typeof o==="object"&&!Array.isArray(o);}
function requireSafe(fail){throw new Error(fail);}
function privateCases(report,expectedVariants,attempted) {
  if(!record(report)||typeof report.studyId!=="string"||
    !/^[A-Za-z0-9_-]{1,64}$/.test(report.studyId)||
    !Array.isArray(report.cases)||report.cases.length!==5||
    report.providerCallsAttempted!==attempted||
    !record(report.privacy)||
    report.privacy.gitHubActionsUsed!==false||
    report.privacy.humanPhotoSentToProvider!==true||
    report.privacy.rawOutputsPersisted!==false||
    report.privacy.photosSavedByRunner!==false)
    requireSafe("private_cohort_invalid");
  const cases=new Map();
  for(const c of report.cases){
    if(!record(c)||!IDS.has(c.caseId)||cases.has(c.caseId)||
      !Number.isSafeInteger(c.photoShortSidePx)||
      c.photoShortSidePx<1||c.photoShortSidePx>8192||
      !Array.isArray(c.variants)||c.variants.length!==expectedVariants.length)
      requireSafe("private_case_invalid");
    const mapped=new Map();
    for(const v of c.variants){
      if(!record(v)||v.caseId!==c.caseId||!expectedVariants.includes(v.variant)||
        mapped.has(v.variant)||
        typeof v.responseComplete!=="boolean"||
        !["STRUCTURALLY_VALID","INVALID_OR_INCOMPLETE"].includes(v.structuralResult)||
        !["available","partial","insufficient_evidence","unavailable"].includes(v.faceStatus)||
        !(v.faceAvailableFieldCount===null ||
          (Number.isSafeInteger(v.faceAvailableFieldCount)&&v.faceAvailableFieldCount>=0))||
        typeof v.skinAnalysisEligible!=="boolean"||
        !record(v.skinAxisStates)||
        !["ELIGIBLE_SEVEN_VALIDATED","ELIGIBLE_SKIN_EVIDENCE_HOLD",
          "EXPECTED_INELIGIBLE_EMPTY","INELIGIBLE_NONEMPTY_OR_MISSING_HOLD",
          "not_applicable"].includes(v.v2ContractStatus))
        requireSafe("private_variant_invalid");
      if(v.variant==="v2"){
        if(!Array.isArray(v.v2Axes)||v.v2Axes.length>16)
          requireSafe("private_axes_invalid");
        for(const row of v.v2Axes) {
          if(!record(row)||!AXES.has(row.axis)||
            !["present","not_seen","unassessable","unknown","invalid"].includes(row.state))
            requireSafe("private_axis_entry_invalid");
        }
      }
      mapped.set(v.variant,v);
    }
    if(expectedVariants.some(v=>!mapped.has(v)))requireSafe("private_variant_missing");
    cases.set(c.caseId,{photoShortSidePx:c.photoShortSidePx,variants:mapped});
  }
  if(cases.size!==IDS.size)requireSafe("private_case_set_incomplete");
  return cases;
}
function countRaw(v,state) {
  return v.v2Axes.filter(x=>x.state===state).length;
}
function countValidated(v,state) {
  const n=v.skinAxisStates[state];
  return Number.isSafeInteger(n)&&n>=0&&n<=7?n:0;
}
function structurallyEligible(v) {
  return v.skinAnalysisEligible===true &&
    v.v2ContractStatus==="ELIGIBLE_SEVEN_VALIDATED" &&
    v.structuralResult==="STRUCTURALLY_VALID" &&
    v.responseComplete===true &&v.finishReason==="stop" &&
    v.v2AxisCount===7;
}
function safeSampleSummary(cases,variant) {
  let eligible=0,ineligible=0,valid=0,holds=0,rawNotSeen=0,validatedNotSeen=0;
  let outputNearCap=0,expectedIneligibleEmpty=0;
  for(const c of cases.values()){
    const v=c.variants.get(variant);
    if(v.skinAnalysisEligible===true) eligible++;
    else ineligible++;
    if(structurallyEligible(v))valid++;
    else if(v.skinAnalysisEligible)holds++;
    if(v.variant==="v2") {
      rawNotSeen+=countRaw(v,"not_seen");
      validatedNotSeen+=countValidated(v,"not_seen");
      if(v.nearTokenCap===true)outputNearCap++;
      const reportedAbstention=Object.hasOwn(v,"expectedIneligibleAbstention")
        ?v.expectedIneligibleAbstention===true
        :!v.skinAnalysisEligible&&v.responseComplete===true&&
          v.finishReason==="stop"&&v.v2AxisCount===0&&
          v.v2ContractStatus==="EXPECTED_INELIGIBLE_EMPTY";
      if(!v.skinAnalysisEligible&&reportedAbstention)expectedIneligibleEmpty++;
    }
  }
  return {
    skinEligible:eligible,skinIneligible:ineligible,
    eligibleSkinContractPass:valid,eligibleSkinContractHolds:holds,
    expectedIneligibleEmpty:expectedIneligibleEmpty,
    rawNotSeen,validatedNotSeen,unvalidatedNotSeen:Math.max(0,rawNotSeen-validatedNotSeen),
    nearOutputCap:outputNearCap
  };
}
export function comparePrivateSkinV2Correction(baseline,correction) {
  const prior=privateCases(baseline,["v1","v2"],10);
  const resumed=correction?.studyMode==="v2_resume_merged_five";
  const next=privateCases(correction,["v2"],resumed?4:5);
  if(resumed&&(correction.reusedProbeProviderCalls!==1||
    correction.providerCallsRepresented!==5))requireSafe("private_resume_provenance_invalid");
  if(baseline.studyId!==correction.studyId||
    !(resumed?correction.outcome==="PRIVATE_V2_RESUME_MERGED_STRUCTURAL_RESEARCH_ONLY":
       correction.studyMode==="v2_only"&&
       correction.outcome==="PRIVATE_V2_ONLY_STRUCTURAL_RESEARCH_ONLY")||
    baseline.outcome!=="PRIVATE_REAL_PHOTO_STRUCTURAL_REVIEW_ONLY")
    requireSafe("private_study_link_invalid");
  let photoSizeChanged=0,eligibleToIneligible=0,ineligibleToEligible=0;
  let faceStatusLossVsPriorV1=0,faceFieldLossVsPriorV1=0;
  let faceStatusLossVsPriorV2=0,faceFieldLossVsPriorV2=0;
  let faceFieldUnassessable=0;
  let eligibleContractsBecameValid=0,eligibleContractsRegressed=0;
  for(const id of IDS){
    const a=prior.get(id),b=next.get(id);
    if(!a||!b)requireSafe("private_case_match_invalid");
    if(a.photoShortSidePx!==b.photoShortSidePx)photoSizeChanged++;
    const v1=a.variants.get("v1"),old=a.variants.get("v2"),updated=b.variants.get("v2");
    if(old.skinAnalysisEligible&&!updated.skinAnalysisEligible)eligibleToIneligible++;
    if(!old.skinAnalysisEligible&&updated.skinAnalysisEligible)ineligibleToEligible++;
    if(FACE_RANK[updated.faceStatus]<FACE_RANK[v1.faceStatus])faceStatusLossVsPriorV1++;
    if(updated.faceAvailableFieldCount===null||v1.faceAvailableFieldCount===null||
      old.faceAvailableFieldCount===null){
      faceFieldUnassessable++;
    } else {
      if(updated.faceAvailableFieldCount<v1.faceAvailableFieldCount)faceFieldLossVsPriorV1++;
      if(updated.faceAvailableFieldCount<old.faceAvailableFieldCount)faceFieldLossVsPriorV2++;
    }
    if(FACE_RANK[updated.faceStatus]<FACE_RANK[old.faceStatus])faceStatusLossVsPriorV2++;
    if(!structurallyEligible(old)&&structurallyEligible(updated))eligibleContractsBecameValid++;
    if(structurallyEligible(old)&&!structurallyEligible(updated))eligibleContractsRegressed++;
  }
  return {
    version:SKIN_PRIVATE_V2_CORRECTION_AUDIT_VERSION,
    status:"PRIVATE_PAIRED_HISTORICAL_COMPARISON_RESEARCH_ONLY",
    matchedOpaqueCases:5,
    correctionProviderCallsNew:resumed?4:5,
    correctionProviderCallsReused:resumed?1:0,
    baseline:safeSampleSummary(prior,"v2"),
    corrected:safeSampleSummary(next,"v2"),
    changes:{
      photoShortSideChanges:photoSizeChanged,
      skinEligibleToIneligible:eligibleToIneligible,
      skinIneligibleToEligible:ineligibleToEligible,
      eligibleContractsBecameValid,eligibleContractsRegressed,
      faceStatusLossVsPriorV1,faceFieldLossVsPriorV1,
      faceStatusLossVsPriorV2,faceFieldLossVsPriorV2,faceFieldUnassessable
    },
    caveats:{
      actualImageIdentityAcrossRunsVerified:false,
      originalV1PromptReexecuted:false,
      providerFreeTextRetained:false,
      humanTruthVerified:false,
      observerBlindingVerified:false,
      faceValueParityVerified:false,
      annotationAccuracyCertified:false,
      accuracyPassClaimPermitted:false,
      readyForScoring:false,
      readyForRelease:false
    }
  };
}
