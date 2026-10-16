// Synthetic data ONLY: zero actual image/provider/key, no network.
import assert from "node:assert/strict";
import { mkdtempSync,writeFileSync,rmSync,unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrivatePhotoCohort,PRIVATE_V1V2_VERSION } from "./skin-private-v1v2-runner.mjs";
import { validatePrivateV2ProbeMetadata,mergePrivateV2ResumeFour } from "./skin-private-v2-resume-core.mjs";
import { comparePrivateSkinV2Correction } from "./skin-private-v2-correction-audit.mjs";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";
const ids=["TC-01","TC-02","TC-03","TC-04","TC-05"];
const clone=x=>structuredClone(x);
const img=(i)=>Buffer.from([255,216,255,224,0,4,0,i,255,192,0,17,8,0,16,0,16,
  3,1,17,0,2,17,0,3,17,0,255,217]);
const dir=mkdtempSync(join(tmpdir(),"s1d-four-mock-"));
const manifest={
  schemaVersion:PRIVATE_V1V2_VERSION,studyId:"S1D_RESUME_MOCK",
  attestation:{sourceRights:"user_attested",depictedPersonConsent:"user_attested",
    openAiTransferConsent:"user_attested",attestedOn:"2026-10-16"},
  executionPolicy:{privateOnly:true,gitHubActionsForbidden:true,
    rawResponsesPersisted:false,imagesPersistedByRunner:false,
    providerKeyEnv:"OPENAI_API_KEY2",maxCalls:10},
  cases:ids.map((caseId,i)=>({caseId,filename:"fabricated_"+i+".jpg",
    expectedWidth:16,expectedHeight:16}))
};
const states=()=>({present:0,not_seen:0,unassessable:0,unknown:7});
const axes=()=>SKIN_VISIBLE_AXES.map(axis=>({
  axis,state:"unknown",value:null,confidence:"unknown"}));
const diagnostics=()=>({
  version:"skin-private-axis-diagnostic-v1",
  status:"ELIGIBLE_ROWS_CONTRACT_READY",issues:[],
  axisDiagnostics:SKIN_VISIBLE_AXES.map(axis=>({
    axis,state:"unknown",valid:true,issues:[]
  }))
});
const probeV2={
  caseId:"TC-01",variant:"v2",responseComplete:true,finishReason:"stop",
  inputTokens:4426,outputTokens:1972,elapsedMs:14695,nearTokenCap:false,
  structuralResult:"STRUCTURALLY_VALID",faceStatus:"available",
  faceAvailableFieldCount:19,eligibilityStatus:"eligible",
  faceLabEligible:true,skinAnalysisEligible:true,skinStatus:"ready",
  skinAxisStates:states(),v2AxisCount:7,
  v2ContractStatus:"ELIGIBLE_SEVEN_VALIDATED",
  expectedIneligibleAbstention:false,
  v2Axes:axes(),privateAxisContractDiagnostics:diagnostics(),metadataOnly:true
};
const flags={humanPhotoSentToProvider:true,gitHubActionsUsed:false,
  rawOutputsPersisted:false,photosSavedByRunner:false};
const probe={
  version:PRIVATE_V1V2_VERSION,studyId:manifest.studyId,
  studyMode:"v2_probe_one",outcome:"PRIVATE_V2_PROBE_ONE_DIAGNOSTIC_ONLY",
  providerCallsAttempted:1,privacy:flags,
  cases:[{caseId:"TC-01",verdict:"STRUCTURAL_PREFLIGHT_ONLY",
    photoShortSidePx:16,variants:[probeV2]}]
};
const fakeSecret="TEST_KEY2_SENTINEL_NEVER_PRINT";
const makeResponse=()=>{
  const parsed={
    schemaVersion:"vision-observation-v2",
    eligibility:{status:"eligible",source:"vision",imageType:"photorealistic_human",
      humanFaceCount:1,faceLabEligible:true,skinAnalysisEligible:true,
      faceLabFailureReason:null,skinFailureReason:null,confidence:0.9,
      evidence:["synthetic fixture: single mock face"]},
    skin:{axisEvidence:SKIN_VISIBLE_AXES.map(axis=>({
      axis,state:"unknown",value:null,confidence:"unknown",cue:null,area:null,reason:"missing"
    }))},face:{}
  };
  return {parsed,durationMs:800,providerPayload:{
    choices:[{finish_reason:"stop",message:{content:JSON.stringify(parsed)}}],
    usage:{prompt_tokens:4426,completion_tokens:1972}
  }};
};
try {
  for(let i=0;i<5;i++)writeFileSync(join(dir,manifest.cases[i].filename),img(i));
  const accepted=validatePrivateV2ProbeMetadata(probe,manifest.studyId,manifest.cases[0]);
  assert.equal(accepted.caseId,"TC-01");
  assert.equal(accepted.variants[0].v2AxisCount,7);
  for(const wrong of [
    {...probe,providerCallsAttempted:2},
    {...probe,studyId:"WRONG"},
    {...probe,studyMode:"v2_only"},
    {...probe,cases:[probe.cases[0],probe.cases[0]]},
    {...probe,cases:[{...probe.cases[0],verdict:"FACE_OR_SKIN_REVIEW_REQUIRED"}]}
  ])assert.throws(()=>validatePrivateV2ProbeMetadata(wrong,manifest.studyId,manifest.cases[0]));
  const mutated=clone(probe);
  mutated.cases[0].variants[0].privateAxisContractDiagnostics.axisDiagnostics[0].valid=false;
  assert.throws(()=>validatePrivateV2ProbeMetadata(mutated),/private_v2_axis_diagnostic_invalid/);
  const invalidUnknown=clone(probe);
  invalidUnknown.cases[0].variants[0].v2Axes[0].value=0;
  assert.throws(()=>validatePrivateV2ProbeMetadata(invalidUnknown),/private_v2_unknown_must_not_be_zero/);
  let calls=0;
  const invoke=async args=>{
    assert.equal(args.apiKey,fakeSecret);
    assert.equal(args.body.max_completion_tokens,2200);
    assert.equal(args.body.response_format.type,"json_object");
    const image=Buffer.from(args.body.messages[1].content[1].image_url.url.split(",")[1],"base64");
    const expected=++calls;
    assert.deepEqual(image,img(expected),"Only TC-02,03,04,05, in that order");
    const response=makeResponse();
    if(expected===4){
      // TC-05 has independently Face-eligible but Skin-ineligible photo.
      response.parsed.eligibility.skinAnalysisEligible=false;
      response.parsed.eligibility.skinFailureReason="lighting_insufficient";
      response.parsed.skin.axisEvidence=[];
      response.providerPayload.choices[0].message.content=JSON.stringify(response.parsed);
    }
    return response;
  };
  await assert.rejects(runPrivatePhotoCohort({manifest,photoDir:dir,
    live:true,studyMode:"v2_resume_four",
    environment:{OPENAI_API_KEY2:fakeSecret},invoke}),/private_resume_probe/);
  assert.equal(calls,0,"No call without prior successful probe");
  const continuation=await runPrivatePhotoCohort({manifest,photoDir:dir,
    live:true,studyMode:"v2_resume_four",resumeProbeMetadata:probe,
    environment:{OPENAI_API_KEY2:fakeSecret},invoke});
  assert.equal(calls,4);
  assert.equal(continuation.providerCallsAttempted,4);
  assert.equal(continuation.outcome,"PRIVATE_V2_RESUME_FOUR_STRUCTURAL_RESEARCH_ONLY");
  assert.deepEqual(continuation.cases.map(c=>c.caseId),ids.slice(1));
  assert(continuation.cases.every(c=>c.variants.length===1 &&c.variants[0].variant==="v2"));
  assert(continuation.cases.slice(0,3).every(c=>
    c.variants[0].privateAxisContractDiagnostics.status==="ELIGIBLE_ROWS_CONTRACT_READY"));
  assert.equal(continuation.cases[3].variants[0].v2AxisCount,0);
  assert.equal(continuation.cases[3].variants[0].v2ContractStatus,"EXPECTED_INELIGIBLE_EMPTY");
  assert.equal(continuation.cases[3].verdict,"EXPECTED_SKIN_INELIGIBLE_ABSTENTION_RESEARCH_ONLY");
  // No raw provider or source fingerprint may escape from the continuation.
  assert(!JSON.stringify(continuation).includes(fakeSecret));
  assert(!JSON.stringify(continuation).includes("data:image"));
  const merged=mergePrivateV2ResumeFour(probe,continuation);
  assert.deepEqual(merged.cases.map(c=>c.caseId),ids);
  assert.equal(merged.providerCallsAttempted,4);
  assert.equal(merged.reusedProbeProviderCalls,1);
  assert.equal(merged.providerCallsRepresented,5);
  assert.equal(merged.cases[0].variants[0].outputTokens,1972);
  assert.equal(merged.authority.faceValueParityVerified,false);
  assert.equal(merged.authority.scoringOrDeploymentAuthorized,false);
  const baseline={version:PRIVATE_V1V2_VERSION,studyId:probe.studyId,
    outcome:"PRIVATE_REAL_PHOTO_STRUCTURAL_REVIEW_ONLY",
    providerCallsAttempted:10,privacy:flags,
    cases:ids.map((id,i)=>({
      caseId:id,photoShortSidePx:16,variants:[
        {...probeV2,caseId:id,variant:"v1",v2Axes:null,v2ContractStatus:"not_applicable"},
        {...probeV2,caseId:id}
      ]
    }))
  };
  const audit=comparePrivateSkinV2Correction(baseline,merged);
  assert.equal(audit.matchedOpaqueCases,5);
  assert.equal(audit.correctionProviderCallsNew,4);
  assert.equal(audit.correctionProviderCallsReused,1);
  assert.equal(audit.caveats.readyForScoring,false);
  const leakage=clone(continuation);
  leakage.cases[0].variants[0].rawProviderResponse="PRIVATE_FACE_AND_TOKEN_SHOULD_NOT_LEAK";
  leakage.cases[0].variants[0].v2Axes[0].reason="PERSONAL_DATA_NOT_A_FIELD";
  const cleaned=mergePrivateV2ResumeFour(probe,leakage);
  assert(!JSON.stringify(cleaned).includes("PRIVATE_FACE"));
  assert(!JSON.stringify(cleaned).includes("PERSONAL_DATA"));
  const dup=clone(continuation);
  dup.cases[3].caseId="TC-02";
  assert.throws(()=>mergePrivateV2ResumeFour(probe,dup),/private_resume_duplicate_or_unknown_case/);
  assert.throws(()=>mergePrivateV2ResumeFour(probe,{...continuation,
    studyId:"ANOTHER_STUDY"}),/private_resume_four_invalid/);
  assert.throws(()=>mergePrivateV2ResumeFour(probe,{...continuation,
    providerCallsAttempted:5}),/private_resume_four_invalid/);
  let failures=0;
  const stopped=await runPrivatePhotoCohort({manifest,photoDir:dir,
    live:true,studyMode:"v2_resume_four",resumeProbeMetadata:probe,
    environment:{OPENAI_API_KEY2:fakeSecret},
    invoke:async()=>{failures++;throw new Error("SENSITIVE_IMAGE_BYTES_NOT_A_LOG");}});
  assert.equal(failures,1);
  assert.equal(stopped.outcome,"HOLD_INCOMPLETE_PROVIDER_DATA");
  assert.equal(stopped.providerCallsAttempted,1);
  assert(!JSON.stringify(stopped).includes("SENSITIVE_IMAGE"));
  const invalidManifest={...manifest,cases:manifest.cases.map(c=>
    c.caseId==="TC-05"?{...c,filename:"not_here.jpg"}:c)};
  let preflightCalls=0;
  const blocked=await runPrivatePhotoCohort({manifest:invalidManifest,photoDir:dir,
    live:true,studyMode:"v2_resume_four",resumeProbeMetadata:probe,
    environment:{OPENAI_API_KEY2:fakeSecret},invoke:async()=>{preflightCalls++;}});
  assert.equal(blocked.providerCallsAttempted,0);
  assert.equal(preflightCalls,0);
  // CI run must use a fake invoker only, and a declared CI environment must fail.
  await assert.rejects(runPrivatePhotoCohort({manifest,photoDir:dir,
    live:true,studyMode:"v2_resume_four",resumeProbeMetadata:probe,
    environment:{OPENAI_API_KEY2:fakeSecret,CI:"true"},
    invoke}),/ci_face_photo_execution_forbidden/);
  assert.equal(calls,4);
  console.log("verify-skin-private-v2-resume: PASS (synthetic only, TC01 never recalled, 4 requests maximum, strict merge, privacy)");
}finally{rmSync(dir,{recursive:true,force:true});}
