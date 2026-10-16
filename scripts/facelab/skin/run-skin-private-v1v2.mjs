#!/usr/bin/env node
// PRIVATE operator host only. No dotenv, shell interpolation, secrets in output
// and no workflow/CI entrypoint. Nothing is uploaded without explicit --live.
import { readFileSync,writeFileSync } from "node:fs";
import { resolve,sep } from "node:path";
import { runPrivatePhotoCohort } from "./skin-private-v1v2-runner.mjs";

function safeError(error){
  const allowed=new Set([
    "key2_not_available","ci_face_photo_execution_forbidden","consent_not_attested",
    "manifest_shape_invalid","manifest_header_invalid","attestation_shape_invalid",
    "attestation_date_invalid","execution_policy_invalid","execution_policy_rejected",
    "five_cases_required","case_shape_invalid","case_id_invalid",
    "private_filename_invalid","case_dimensions_invalid"
  ]);
  return allowed.has(error?.message)?error.message:"private_cohort_preflight_failed";
}
const [flag,manifestFlag,manifestPath,dirFlag,privateDir,probeFlag,probePath,lockFlag,lockPath]=process.argv.slice(2);
const liveResume=flag==="--live-private-v2-resume-four";
const resuming=liveResume||flag==="--validate-private-v2-resume-four";
const permitted=new Set(["--validate-private-cohort","--live-private-cohort","--live-private-v2-only","--live-private-v2-probe-one","--live-private-v2-resume-four","--validate-private-v2-resume-four"]);
if(!permitted.has(flag)||manifestFlag!=="--manifest"||!manifestPath||
  dirFlag!=="--photo-dir"||!privateDir||
  (resuming?(probeFlag!=="--resume-probe"||!probePath||
    (liveResume?(process.argv.length!==11||lockFlag!=="--attempt-lock"||!lockPath):
      process.argv.length!==9)):process.argv.length!==7)){
  console.error("Usage: node scripts/facelab/skin/run-skin-private-v1v2.mjs --validate-private-cohort|--live-private-cohort|--live-private-v2-only|--live-private-v2-probe-one|--live-private-v2-resume-four|--validate-private-v2-resume-four --manifest /PRIVATE/cohort.json --photo-dir /PRIVATE/photos [--resume-probe /PRIVATE/tc01_metadata.json] [--attempt-lock /PRIVATE/resume4.lock (live only)]");
  process.exitCode=2;
}else{
  try{
    if(flag!=="--validate-private-cohort"&&process.env.GITHUB_ACTIONS==="true")
      throw new Error("ci_face_photo_execution_forbidden");
    // The manifest is a local private file, never embedded in a git revision.
    const data=JSON.parse(readFileSync(resolve(manifestPath),"utf8"));
    const probeRaw=resuming?readFileSync(resolve(probePath)):null;
    if(probeRaw&&probeRaw.length>2*1024*1024)throw new Error("private_probe_too_large");
    const resumeProbeMetadata=probeRaw?JSON.parse(probeRaw.toString("utf8")):null;
    if(liveResume){
      // Full five-photo + saved TC-01 proof preflight, without a KEY2 request.
      const preflight=await runPrivatePhotoCohort({
        manifest:data,photoDir:resolve(privateDir),resumeProbeMetadata,
        live:false,studyMode:"v2_resume_four"
      });
      if(preflight.outcome!=="PRIVATE_LOCAL_PRECHECK_ONLY"||
         preflight.providerCallsAttempted!==0||preflight.cases.length!==4)
        throw new Error("resume_private_preflight_failed");
      if(!process.env.OPENAI_API_KEY2?.trim())throw new Error("key2_not_available");
      const lock=resolve(lockPath),cwd=resolve(process.cwd());
      if(lock===cwd||lock.startsWith(cwd+sep))throw new Error("attempt_lock_in_repo_forbidden");
      // Atomic wx; retained even after a crash or partial failure, to forbid
      // accidental repeat charges. Never auto-remove or auto-retry this lock.
      writeFileSync(lock,"PRIVATE_V2_RESUME_ATTEMPT_STARTED\\n",{flag:"wx",mode:0o600});
    }
    const result=await runPrivatePhotoCohort({
      manifest:data,photoDir:resolve(privateDir),resumeProbeMetadata,
      live:flag!=="--validate-private-cohort"&&flag!=="--validate-private-v2-resume-four",
      studyMode:resuming?"v2_resume_four":flag==="--live-private-v2-probe-one"?"v2_probe_one":flag==="--live-private-v2-only"?"v2_only":"paired"
    });
    console.log(JSON.stringify(result,null,2));
    if(result.outcome==="HOLD_INCOMPLETE_PROVIDER_DATA" ||
       result.cases.some(c=>c.verdict==="PRIVATE_PHOTO_INPUT_HOLD"))
      process.exitCode=1;
  }catch(error){
    // Do not print arbitrary errors: they may contain filesystem paths, source
    // image content, raw Provider data, identity or bearer token.
    console.error("private_skin_v1v2_failed: "+safeError(error));
    process.exitCode=1;
  }
}
