// Mock-only / fabricated JPEG-header safety verification for the PRIVATE runner.
// No actual human image, OpenAI Provider call, production key or raw response disk IO.
import assert from "node:assert/strict";
import { mkdtempSync,writeFileSync,rmSync,unlinkSync,symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrivatePhotoCohort,validatePrivateCohortManifest,PRIVATE_V1V2_VERSION } from "./skin-private-v1v2-runner.mjs";
import { SKIN_VISIBLE_AXES } from "./skin-axis-evidence-contract-core.mjs";

const tmp=mkdtempSync(join(tmpdir(),"skin-private-cohort-mock-"));
const ids=["TC-01","TC-02","TC-03","TC-04","TC-05"];
const makeJpeg=(width,height)=>Buffer.from([
  255,216,255,192,0,17,8,height>>8,height&255,width>>8,width&255,
  3,1,17,0,2,17,0,3,17,0,255,217
]);
const manifest={
  schemaVersion:PRIVATE_V1V2_VERSION,studyId:"S1D_MOCK_ONLY",
  attestation:{
    sourceRights:"user_attested",depictedPersonConsent:"user_attested",
    openAiTransferConsent:"user_attested",attestedOn:"2026-10-16"
  },
  executionPolicy:{
    privateOnly:true,gitHubActionsForbidden:true,rawResponsesPersisted:false,
    imagesPersistedByRunner:false,providerKeyEnv:"OPENAI_API_KEY2",maxCalls:10
  },
  cases:ids.map((caseId,i)=>({
    caseId,filename:"synthetic_"+i+".jpg",expectedWidth:16,expectedHeight:16
  }))
};
const clone=v=>structuredClone(v);
try {
  for(const c of manifest.cases)writeFileSync(join(tmp,c.filename),makeJpeg(16,16));
  assert.equal(validatePrivateCohortManifest(manifest).cases.length,5);
  let attempts=0;
  const fakeSecret="KEY2_SENTINEL_SHOULD_NOT_LEAK";
  const prodSecret="PROD_KEY_SENTINEL_DO_NOT_USE";
  const elig={
    status:"eligible",source:"vision",imageType:"photorealistic_human",
    humanFaceCount:1,faceLabEligible:true,skinAnalysisEligible:true,
    faceLabFailureReason:null,skinFailureReason:null,confidence:0.85,
    evidence:["synthetic test data: one face"]
  };
  const fakeInvoker=async p=>{
    attempts++;
    assert.equal(p.apiKey,fakeSecret);
    assert.equal(p.stage,"vision-observation");
    assert.equal(p.logEvent instanceof Function,true);
    assert.equal(p.body.max_completion_tokens,2200);
    assert.equal(p.body.model,"gpt-5.6-luna");
    assert.equal(p.body.response_format.type,"json_object");
    assert.equal(p.body.messages[1].content[1].type,"image_url");
    assert.match(p.body.messages[1].content[1].image_url.url,/^data:image\/jpeg;base64,/);
    assert.deepEqual(Buffer.from(
      p.body.messages[1].content[1].image_url.url.split(",")[1],"base64"),
      makeJpeg(16,16));
    const variant=attempts%2===1?"v1":"v2";
    const parsed=variant==="v1"
      ?{schemaVersion:"vision-observation-v1",eligibility:elig,
        skin:{signals:Object.fromEntries([...SKIN_VISIBLE_AXES,"uv"].map(axis=>[axis,0])),
          observations:[]},face:{}}
      :{schemaVersion:"vision-observation-v2",eligibility:elig,
        skin:{axisEvidence:SKIN_VISIBLE_AXES.map(axis=>({
          axis,state:"unknown",value:null,confidence:"unknown",
          cue:null,area:null,reason:"missing"}))},face:{}};
    return {status:200,durationMs:variant==="v1"?1100:1650,parsed,
      providerPayload:{
        choices:[{finish_reason:"stop",message:{content:JSON.stringify(parsed)}}],
        usage:{prompt_tokens:350,completion_tokens:200}
      }};
  };
  const precheck=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:false,environment:{}
  });
  assert.equal(precheck.providerCallsAttempted,0);
  assert.equal(precheck.outcome,"PRIVATE_LOCAL_PRECHECK_ONLY");
  assert.equal(precheck.cases.length,5);
  assert(precheck.cases.every(c=>c.width===16&&c.inputLowResolution===true));
  assert.equal(attempts,0);
  await assert.rejects(runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,environment:{OPENAI_API_KEY:prodSecret},
    invoke:fakeInvoker
  }),/key2_not_available/);
  await assert.rejects(runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret,GITHUB_ACTIONS:"true"},
    invoke:fakeInvoker
  }),/ci_face_photo_execution_forbidden/);
  await assert.rejects(runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret,CI:"true"},
    invoke:fakeInvoker
  }),/ci_face_photo_execution_forbidden/);
  assert.equal(attempts,0);
  const missing=clone(manifest);
  missing.cases[4].filename="missing.jpg";
  const blocked=await runPrivatePhotoCohort({
    manifest:missing,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret},invoke:fakeInvoker
  });
  assert.equal(blocked.outcome,"HOLD_PRIVATE_PHOTO_INPUT");
  assert.equal(blocked.providerCallsAttempted,0);
  assert.equal(blocked.privacy.humanPhotoSentToProvider,false);
  assert.equal(attempts,0);
  const report=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret,OPENAI_API_KEY:prodSecret},
    invoke:fakeInvoker
  });
  assert.equal(attempts,10);
  assert.equal(report.providerCallsAttempted,10);
  assert.equal(report.cases.length,5);
  assert.equal(report.pairedSummary.matchedPairs,5);
  assert.equal(report.pairedSummary.faceBaselineUnassessable,5);
  assert(report.cases.every(c=>c.variants[1].v2AxisCount===7));
  assert(report.cases.every(c=>c.variants[1].v2ContractStatus==="ELIGIBLE_SEVEN_VALIDATED"));
  assert(report.cases.every(c=>c.verdict==="FACE_OR_SKIN_REVIEW_REQUIRED"));
  assert.equal(report.authority.independentHumanEvaluationDone,false);
  assert.equal(report.authority.scoringOrDeploymentAuthorized,false);
  assert.equal(report.authority.photoAccuracyCertified,false);
  assert.equal(report.privacy.gitHubActionsUsed,false);
  assert.equal(JSON.stringify(report).includes(fakeSecret),false);
  assert.equal(JSON.stringify(report).includes(prodSecret),false);
  assert.equal(JSON.stringify(report).includes("data:image"),false);
  assert.equal(JSON.stringify(report).includes("synthetic_0.jpg"),false);
  assert.equal(JSON.stringify(report).includes("one face"),false);
  for(const input of [
    {...manifest,cases:[...manifest.cases.slice(0,4),manifest.cases[0]]},
    {...manifest,executionPolicy:{...manifest.executionPolicy,maxCalls:11}},
    {...manifest,attestation:{...manifest.attestation,openAiTransferConsent:"unverified"}},
    {...manifest,cases:[{...manifest.cases[0],filename:"../secret.jpg"},...manifest.cases.slice(1)]},
    {...manifest,cases:[{...manifest.cases[0],imageUrl:"https://example.com/x.jpg"},...manifest.cases.slice(1)]}
  ])assert.throws(()=>validatePrivateCohortManifest(input));

  // Provider errors must stop immediately; no raw data even if error carries it.
  attempts=0;
  const failed=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret},
    invoke:async()=>{attempts++;throw new Error("USER_FACE_SOURCE_PRIVATE_DO_NOT_PRINT");}
  });
  assert.equal(attempts,1);
  assert.equal(failed.providerCallsAttempted,1);
  assert.equal(failed.outcome,"HOLD_INCOMPLETE_PROVIDER_DATA");
  assert.equal(JSON.stringify(failed).includes("USER_FACE_SOURCE_PRIVATE"),false);

  // Reject symlink to any photo file and consume zero provider calls.
  unlinkSync(join(tmp,manifest.cases[3].filename));
  symlinkSync(join(tmp,manifest.cases[0].filename),join(tmp,manifest.cases[3].filename));
  const symlinkBlocked=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,environment:{OPENAI_API_KEY2:fakeSecret},
    invoke:fakeInvoker
  });
  assert.equal(symlinkBlocked.providerCallsAttempted,0);
  assert.equal(symlinkBlocked.outcome,"HOLD_PRIVATE_PHOTO_INPUT");
  console.log("verify-skin-private-v1v2-runner: PASS (mock-only, five paired cases, privacy, no key fallback, zero CI photo calls)");
}finally{
  rmSync(tmp,{recursive:true,force:true});
}
