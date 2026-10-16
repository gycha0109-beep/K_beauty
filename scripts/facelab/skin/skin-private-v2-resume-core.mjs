// Private research metadata: TC-01 validated probe + TC-02..05 continuation.
// No image bytes, names, identifiers, secrets or Provider responses are accepted or emitted.
// Only run on a private local host; synthetic CI tests call these pure functions.
const IDS=["TC-01","TC-02","TC-03","TC-04","TC-05"];
const AXES=["oiliness","dehydration","acne","uneven_tone","pores","redness","barrier"];
const STATES=["present","not_seen","unassessable","unknown"];
const FACE=["available","partial","insufficient_evidence","unavailable"];
const STRUCT=["STRUCTURALLY_VALID","INVALID_OR_INCOMPLETE"];
const STATUS=["ELIGIBLE_SEVEN_VALIDATED","ELIGIBLE_SKIN_EVIDENCE_HOLD",
  "EXPECTED_INELIGIBLE_EMPTY","INELIGIBLE_NONEMPTY_OR_MISSING_HOLD"];
const ISSUES=["row_shape_invalid","state_invalid","value_state_mismatch",
  "confidence_state_mismatch","target_cue_missing_or_invalid",
  "inspected_area_missing_or_invalid","reason_state_mismatch",
  "cue_must_be_null","area_must_be_null","missing_axis","duplicate_axis",
  "unsupported_axis_or_row","diagnostic_core_disagreement"];
const VERSION="skin-private-v1v2-cohort-v1";
const fail=code=>{throw new Error(code);};
const obj=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
const int=(x,min=0,max=1000000)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
const same=(a,b)=>a===b;
function privacy(report){
  if(!obj(report?.privacy)||report.privacy.gitHubActionsUsed!==false||
     report.privacy.rawOutputsPersisted!==false||
     report.privacy.photosSavedByRunner!==false||
     report.privacy.humanPhotoSentToProvider!==true)fail("private_source_privacy_invalid");
}
function common(report){
  if(!obj(report)||report.version!==VERSION||
     typeof report.studyId!=="string"||
     !/^[A-Za-z0-9_-]{1,64}$/.test(report.studyId))fail("private_source_version_invalid");
  privacy(report);
}
function safeVariant(v,id){
  if(!obj(v)||v.caseId!==id||v.variant!=="v2"||
     v.responseComplete!==true||v.finishReason!=="stop"||
     !STRUCT.includes(v.structuralResult)||!FACE.includes(v.faceStatus)||
     !int(v.inputTokens)||!int(v.outputTokens,0,2200)||
     !(v.elapsedMs===null||int(v.elapsedMs,0,600000))||
     typeof v.nearTokenCap!=="boolean"||v.nearTokenCap!==(v.outputTokens>=1980)||
     v.metadataOnly!==true||
     !(v.faceAvailableFieldCount===null||int(v.faceAvailableFieldCount,0,100))||
     typeof v.skinAnalysisEligible!=="boolean"||
     !STATUS.includes(v.v2ContractStatus)||!int(v.v2AxisCount,0,7)||
     !Array.isArray(v.v2Axes)||v.v2Axes.length!==v.v2AxisCount||
     !obj(v.skinAxisStates)||!obj(v.privateAxisContractDiagnostics))
       fail("private_v2_variant_invalid");
  const rows=v.v2Axes.map(row=>{
    if(!obj(row)||!AXES.includes(row.axis)||![...STATES,"invalid"].includes(row.state)||
       !(row.value===null||int(row.value,0,5))||
       !["low","medium","high","unknown"].includes(row.confidence))
      fail("private_v2_axis_invalid");
    if((row.state==="unknown"||row.state==="unassessable")&&row.value!==null)
      fail("private_v2_unknown_must_not_be_zero");
    if(row.state==="not_seen"&&
       (row.value!==0||!["medium","high"].includes(row.confidence)))
      fail("private_v2_not_seen_invalid");
    if(["unknown","unassessable"].includes(row.state)&&row.confidence!=="unknown")
      fail("private_v2_unknown_confidence_invalid");
    if(row.state==="present"&&
       (!(row.value>=1&&row.value<=5)||!["low","medium","high"].includes(row.confidence)))
      fail("private_v2_present_invalid");
    return {axis:row.axis,state:row.state,value:row.value,confidence:row.confidence};
  });
  if(new Set(rows.map(r=>r.axis)).size!==rows.length)fail("private_v2_duplicate_axis");
  for(const s of STATES)if(!int(v.skinAxisStates[s],0,7))
    fail("private_v2_state_count_invalid");
  const stateCount=STATES.reduce((n,s)=>n+v.skinAxisStates[s],0);
  if(stateCount>7)fail("private_v2_state_total_invalid");
  const d=v.privateAxisContractDiagnostics;
  if(d.version!=="skin-private-axis-diagnostic-v1"||
     !["ELIGIBLE_ROWS_CONTRACT_READY","ELIGIBLE_ROWS_CONTRACT_HOLD",
       "SKIN_INELIGIBLE_ZERO_AXES"].includes(d.status)||
     !Array.isArray(d.axisDiagnostics)||!Array.isArray(d.issues)||
     d.issues.some(x=>!ISSUES.includes(x))||
     d.status==="DIAGNOSTIC_DISAGREES_WITH_CORE")fail("private_v2_diagnostic_invalid");
  const axesDiagnostics=d.axisDiagnostics.map(a=>{
    if(!obj(a)||!AXES.includes(a.axis)||
       ![...STATES,"missing","invalid"].includes(a.state)||
       typeof a.valid!=="boolean"||!Array.isArray(a.issues)||
       a.issues.some(x=>!ISSUES.includes(x))||
       a.valid!==(a.issues.length===0))
      fail("private_v2_axis_diagnostic_invalid");
    return {axis:a.axis,state:a.state,valid:a.valid,issues:[...a.issues]};
  });
  const validSeven=v.skinAnalysisEligible&&
    v.v2ContractStatus==="ELIGIBLE_SEVEN_VALIDATED";
  if(validSeven){
    if(v.structuralResult!=="STRUCTURALLY_VALID"||rows.length!==7||
       new Set(axesDiagnostics.map(a=>a.axis)).size!==7||
       axesDiagnostics.length!==7||axesDiagnostics.some(a=>!a.valid)||
       d.status!=="ELIGIBLE_ROWS_CONTRACT_READY"||d.issues.length||
       v.skinStatus!=="ready"||stateCount!==7)
      fail("private_v2_seven_contract_invalid");
    for(const a of AXES){
      const row=rows.find(r=>r.axis===a);
      const diagnosis=axesDiagnostics.find(d=>d.axis===a);
      if(!row||!diagnosis||diagnosis.state!==row.state)
        fail("private_v2_diagnostic_state_mismatch");
    }
  } else if(!v.skinAnalysisEligible) {
    if(v.v2ContractStatus!=="EXPECTED_INELIGIBLE_EMPTY"||rows.length!==0||
       d.status!=="SKIN_INELIGIBLE_ZERO_AXES"||
       v.expectedIneligibleAbstention!==true)
      fail("private_v2_abstention_invalid");
  } else if(d.status==="ELIGIBLE_ROWS_CONTRACT_READY"){
    fail("private_v2_diagnostic_contract_mismatch");
  }
  const expectedCounts=Object.fromEntries(STATES.map(s=>[s,0]));
  if(validSeven) {
    for(const r of rows) expectedCounts[r.state]++;
    if(STATES.some(s=>v.skinAxisStates[s]!==expectedCounts[s]))
      fail("private_v2_state_disagreement");
  }
  return {
    caseId:id,variant:"v2",responseComplete:true,finishReason:"stop",
    inputTokens:v.inputTokens,outputTokens:v.outputTokens,elapsedMs:v.elapsedMs,
    nearTokenCap:v.nearTokenCap,structuralResult:v.structuralResult,
    faceStatus:v.faceStatus,faceAvailableFieldCount:v.faceAvailableFieldCount,
    eligibilityStatus:["eligible","ineligible","insufficient_evidence"].includes(v.eligibilityStatus)
      ?v.eligibilityStatus:"insufficient_evidence",
    skinAnalysisEligible:v.skinAnalysisEligible,faceLabEligible:v.faceLabEligible===true,
    skinStatus:["ready","blocked","insufficient_evidence","invalid","unavailable"].includes(v.skinStatus)
      ?v.skinStatus:"unavailable",
    skinAxisStates:Object.fromEntries(STATES.map(s=>[s,v.skinAxisStates[s]])),
    v2AxisCount:v.v2AxisCount,v2ContractStatus:v.v2ContractStatus,
    expectedIneligibleAbstention:v.expectedIneligibleAbstention===true,
    v1LegacyZeroUnverifiable:null,v1LegacyNumeric:null,v2Axes:rows,
    privateAxisContractDiagnostics:{
      version:d.version,status:d.status,axisDiagnostics:axesDiagnostics,issues:[...d.issues]
    },
    metadataOnly:true
  };
}
function safeCase(c,id){
  if(!obj(c)||c.caseId!==id||!int(c.photoShortSidePx,1,8192)||
     !Array.isArray(c.variants)||c.variants.length!==1||
     !["STRUCTURAL_PREFLIGHT_ONLY","EXPECTED_SKIN_INELIGIBLE_ABSTENTION_RESEARCH_ONLY",
       "FACE_OR_SKIN_REVIEW_REQUIRED"].includes(c.verdict))
     fail("private_v2_case_invalid");
  const v=safeVariant(c.variants[0],id);
  if(c.verdict==="STRUCTURAL_PREFLIGHT_ONLY"&&
     (v.v2ContractStatus!=="ELIGIBLE_SEVEN_VALIDATED"||v.nearTokenCap))fail("private_v2_case_verdict_invalid");
  if(c.verdict==="EXPECTED_SKIN_INELIGIBLE_ABSTENTION_RESEARCH_ONLY"&&
     v.v2ContractStatus!=="EXPECTED_INELIGIBLE_EMPTY")fail("private_v2_case_verdict_invalid");
  return {
    caseId:id,verdict:c.verdict,photoShortSidePx:c.photoShortSidePx,
    variants:[v],faceParityStatus:"BASELINE_NOT_INCLUDED_IN_V2_ONLY_REPORT",
    faceStatusDegraded:null,faceCoverageDegraded:null
  };
}
export function validatePrivateV2ProbeMetadata(report,studyId=null,firstCase=null){
  common(report);
  if(report.studyMode!=="v2_probe_one"||
     report.outcome!=="PRIVATE_V2_PROBE_ONE_DIAGNOSTIC_ONLY"||
     report.providerCallsAttempted!==1||!Array.isArray(report.cases)||
     report.cases.length!==1|| (studyId!==null&&!same(report.studyId,studyId)))
     fail("private_resume_probe_invalid");
  const c=safeCase(report.cases[0],"TC-01");
  const v=c.variants[0];
  if(c.verdict!=="STRUCTURAL_PREFLIGHT_ONLY"||
     v.v2ContractStatus!=="ELIGIBLE_SEVEN_VALIDATED"||v.nearTokenCap===true||
     (firstCase&&c.photoShortSidePx!==Math.min(firstCase.expectedWidth,firstCase.expectedHeight)))
    fail("private_resume_probe_not_validated");
  return c;
}
export function mergePrivateV2ResumeFour(probe,continuation){
  const first=validatePrivateV2ProbeMetadata(probe);
  common(continuation);
  if(continuation.studyId!==probe.studyId||
     continuation.studyMode!=="v2_resume_four"||
     continuation.outcome!=="PRIVATE_V2_RESUME_FOUR_STRUCTURAL_RESEARCH_ONLY"||
     continuation.providerCallsAttempted!==4||
     !Array.isArray(continuation.cases)||continuation.cases.length!==4)
    fail("private_resume_four_invalid");
  const rows=new Map([["TC-01",first]]);
  for(const c of continuation.cases){
    if(!obj(c)||!IDS.slice(1).includes(c.caseId)||rows.has(c.caseId))
      fail("private_resume_duplicate_or_unknown_case");
    rows.set(c.caseId,safeCase(c,c.caseId));
  }
  if(rows.size!==5)fail("private_resume_incomplete");
  const cases=IDS.map(id=>rows.get(id));
  return {
    version:VERSION,studyId:probe.studyId,studyMode:"v2_resume_merged_five",
    outcome:"PRIVATE_V2_RESUME_MERGED_STRUCTURAL_RESEARCH_ONLY",
    providerCallsAttempted:4,reusedProbeProviderCalls:1,
    providerCallsRepresented:5,cases,pairedSummary:null,
    privacy:{humanPhotoSentToProvider:true,rawOutputsPersisted:false,
      photosSavedByRunner:false,gitHubActionsUsed:false},
    authority:{
      independentHumanEvaluationDone:false,photoAccuracyCertified:false,
      scoringOrDeploymentAuthorized:false,productReady:false,releaseReady:false,
      actualImageIdentityAcrossRunsVerified:false,faceValueParityVerified:false
    }
  };
}
