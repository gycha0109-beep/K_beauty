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
const makeJpeg=(width,height,caseIndex=0)=>Buffer.from([
  // Deliberately fabricated, distinct APP0 payload for each mock case.
  255,216,255,224,0,4,0,caseIndex,255,192,0,17,8,height>>8,height&255,width>>8,width&255,
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
// Windows file symbolic-link creation often requires Developer Mode or an
// elevated account. Only SKIP that OS privilege-dependent *fixture creation*
// when unsupported; the actual private-photo reader still rejects symlinks.
// In Linux CI the symlink negative test is mandatory.
const symlinkFixtureDeniedOnWindows=(error,platform=process.platform)=>
  platform==="win32" && ["EPERM","EACCES","ENOTSUP","ENOSYS"]
    .includes(error?.code);
assert.equal(symlinkFixtureDeniedOnWindows({code:"EPERM"},"win32"),true);
assert.equal(symlinkFixtureDeniedOnWindows({code:"EACCES"},"win32"),true);
assert.equal(symlinkFixtureDeniedOnWindows({code:"ENOSYS"},"win32"),true);
assert.equal(symlinkFixtureDeniedOnWindows({code:"EPERM"},"linux"),false);
assert.equal(symlinkFixtureDeniedOnWindows({code:"ENOENT"},"win32"),false);
let phase="SETUP";
try {
  for(const [i,c] of manifest.cases.entries())writeFileSync(join(tmp,c.filename),makeJpeg(16,16,i));
  // One mock image contains a sensitive JPEG COM segment which must not be
  // forwarded to OpenAI: the outgoing bytes must exactly match clean JPEG.
  const comment=Buffer.from("SYNTHETIC_PRIVATE_COMMENT_NOT_FOR_PROVIDER");
  const commentLen=Buffer.alloc(2); commentLen.writeUInt16BE(comment.length+2);
  const clean=makeJpeg(16,16,4);
  const withComment=Buffer.concat([
    clean.subarray(0,2),Buffer.from([255,254]),commentLen,comment,clean.subarray(2)
  ]);
  writeFileSync(join(tmp,manifest.cases[4].filename),withComment);
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
      makeJpeg(16,16,Math.floor((attempts-1)/2)));
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
  phase="LOCAL_PRECHECK";
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
  if(process.env.GITHUB_ACTIONS==="true" || process.env.CI==="true") {
    // Deliberately omit the key so that this negative test could NEVER make
    // a real OpenAI request even if a future CI process guard regresses.
    await assert.rejects(runPrivatePhotoCohort({
      manifest,photoDir:tmp,live:true,environment:{}
    }),/ci_face_photo_execution_forbidden/);
  }
  for (const [name,value] of [
    ["CI","1"], ["CI","True"], ["GITLAB_CI","true"],
    ["CIRCLECI","true"], ["TF_BUILD","True"], ["BUILDKITE","yes"],
    ["JENKINS_URL","https://ci.private.invalid"]
  ]) {
    await assert.rejects(runPrivatePhotoCohort({
      manifest,photoDir:tmp,live:true,
      environment:{OPENAI_API_KEY2:fakeSecret,[name]:value},
      invoke:fakeInvoker
    }),/ci_face_photo_execution_forbidden/);
  }
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
  phase="MOCKED_PROVIDER_PAIR";
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
  assert(report.cases.every(c=>c.variants[1].expectedIneligibleAbstention===false));
  assert.equal(report.pairedSummary.v2ExpectedIneligibleAbstentions,0);
  assert.equal(report.pairedSummary.v2EligibleStructuralFailures,0);
  assert.equal(report.pairedSummary.v2OtherStructuralFailures,0);
  assert(report.cases.every(c=>c.variants[1].v2ContractStatus==="ELIGIBLE_SEVEN_VALIDATED"));
  // Private-only seven-axis metadata can later be compared to independent
  // Human labels without emitting raw visual descriptions or identity.
  assert(report.cases.every(c=>c.variants[0].v1LegacyZeroUnverifiable===true));
  assert(report.cases.every(c=>Object.keys(c.variants[0].v1LegacyNumeric).length===7));
  assert(report.cases.every(c=>Object.values(c.variants[0].v1LegacyNumeric).every(x=>x===0)));
  assert(report.cases.every(c=>c.variants[0].v2Axes===null));
  assert(report.cases.every(c=>c.variants[1].v1LegacyNumeric===null));
  assert(report.cases.every(c=>c.variants[1].v2Axes.length===7));
  assert(report.cases.every(c=>c.variants[1].v2Axes.every(row=>
    row.state==="unknown" && row.value===null &&
    row.confidence==="unknown" && SKIN_VISIBLE_AXES.includes(row.axis)
  )));
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
  assert.equal(JSON.stringify(report).includes("face_not_detected"),false);
  assert.equal(JSON.stringify(report).includes("source_shine"),false);
  assert.equal(JSON.stringify(report).includes("cue"),false);
  // A Skin-ineligible result with zero rows is a safe abstention, not
  // a Skin-eligible seven-axis validation defect or a scoring release gate.
  attempts=0;
  const ineligibleInvoker=async args=>{
    const reply=await fakeInvoker(args);
    if(attempts%2===0) {
      reply.parsed.eligibility={
        ...elig,skinAnalysisEligible:false,
        skinFailureReason:"lighting_insufficient"
      };
      reply.parsed.skin={axisEvidence:[]};
      reply.providerPayload.choices[0].message.content=JSON.stringify(reply.parsed);
    }
    return reply;
  };
  const abstentionCohort=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret},
    invoke:ineligibleInvoker
  });
  assert.equal(abstentionCohort.providerCallsAttempted,10);
  assert.equal(abstentionCohort.pairedSummary.v2Invalid,5);
  assert.equal(abstentionCohort.pairedSummary.v2ExpectedIneligibleAbstentions,5);
  assert.equal(abstentionCohort.pairedSummary.v2EligibleStructuralFailures,0);
  assert.equal(abstentionCohort.pairedSummary.v2OtherStructuralFailures,0);
  assert.equal(abstentionCohort.pairedSummary.structuralCandidatePass,false);
  assert(abstentionCohort.cases.every(c=>
    c.verdict==="EXPECTED_SKIN_INELIGIBLE_ABSTENTION_RESEARCH_ONLY" &&
    c.variants[1].v2AxisCount===0 &&
    c.variants[1].expectedIneligibleAbstention===true
  ));
  assert.equal(abstentionCohort.authority.scoringOrDeploymentAuthorized,false);
  assert.equal(JSON.stringify(abstentionCohort).includes(fakeSecret),false);
  for(const input of [
    {...manifest,cases:[...manifest.cases.slice(0,4),manifest.cases[0]]},
    {...manifest,cases:manifest.cases.map((c,i)=>i===4?{...c,filename:manifest.cases[0].filename}:c)},
    {...manifest,executionPolicy:{...manifest.executionPolicy,maxCalls:11}},
    {...manifest,attestation:{...manifest.attestation,openAiTransferConsent:"unverified"}},
    {...manifest,cases:[{...manifest.cases[0],filename:"../secret.jpg"},...manifest.cases.slice(1)]},
    {...manifest,cases:[{...manifest.cases[0],imageUrl:"https://example.com/x.jpg"},...manifest.cases.slice(1)]}
  ])assert.throws(()=>validatePrivateCohortManifest(input));

  phase="NEGATIVE_CASES";
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

  // Same image bytes under DIFFERENT file basenames must block the entire
  // cohort preflight, even when the manifest case IDs and names are distinct.
  writeFileSync(join(tmp,manifest.cases[2].filename),makeJpeg(16,16,0));
  const duplicateContentBlocked=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,
    environment:{OPENAI_API_KEY2:fakeSecret},invoke:fakeInvoker
  });
  assert.equal(duplicateContentBlocked.providerCallsAttempted,0);
  assert.equal(duplicateContentBlocked.outcome,"HOLD_PRIVATE_PHOTO_INPUT");
  writeFileSync(join(tmp,manifest.cases[2].filename),makeJpeg(16,16,2));
  // EXIF-bearing JPEGs require explicit orientation review before transfer.
  const exif=Buffer.concat([
    clean.subarray(0,2),
    Buffer.from([255,225,0,8,69,120,105,102,0,0]),
    clean.subarray(2)
  ]);
  writeFileSync(join(tmp,manifest.cases[1].filename),exif);
  const exifBlocked=await runPrivatePhotoCohort({
    manifest,photoDir:tmp,live:true,environment:{OPENAI_API_KEY2:fakeSecret},
    invoke:fakeInvoker
  });
  assert.equal(exifBlocked.providerCallsAttempted,0);
  assert.equal(exifBlocked.outcome,"HOLD_PRIVATE_PHOTO_INPUT");
  writeFileSync(join(tmp,manifest.cases[1].filename),makeJpeg(16,16,1));
  phase="SYMLINK_FIXTURE";
  // Reject symlink to any photo file and consume zero provider calls.
  // Windows non-admin accounts may not have OS permission to CREATE one.
  unlinkSync(join(tmp,manifest.cases[3].filename));
  let linkCreated=false;
  try {
    symlinkSync(join(tmp,manifest.cases[0].filename),join(tmp,manifest.cases[3].filename),"file");
    linkCreated=true;
  } catch(error) {
    if(!symlinkFixtureDeniedOnWindows(error))throw error;
    console.log("MOCK_SYMLINK_FIXTURE: WINDOWS_PRIVILEGE_UNAVAILABLE");
  }
  if(linkCreated){
    const symlinkBlocked=await runPrivatePhotoCohort({
      manifest,photoDir:tmp,live:true,environment:{OPENAI_API_KEY2:fakeSecret},
      invoke:fakeInvoker
    });
    assert.equal(symlinkBlocked.providerCallsAttempted,0);
    assert.equal(symlinkBlocked.outcome,"HOLD_PRIVATE_PHOTO_INPUT");
  } else {
    // Even without fixture-creation rights on this host, ensure the source
    // file was NOT recreated by accident and no Provider mock was invoked.
    assert.equal(attempts,1);
  }
  console.log("verify-skin-private-v1v2-runner: PASS (mock-only, five paired cases, privacy, no key fallback, zero CI photo calls)");
}catch(error){
  const safeCode=["EPERM","EACCES","ENOTSUP","ENOSYS"].includes(error?.code)
    ? error.code : error?.name==="AssertionError" ? "ASSERTION" : "OTHER";
  // A fixed category only, never an exception message/path/photo/key.
  console.log("MOCK_SAFE_FAILURE: "+phase+" "+safeCode);
  throw error;
}finally{
  rmSync(tmp,{recursive:true,force:true});
}
