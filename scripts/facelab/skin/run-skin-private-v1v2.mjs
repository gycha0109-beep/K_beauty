#!/usr/bin/env node
// PRIVATE operator host only. No dotenv, shell interpolation, secrets in output
// and no workflow/CI entrypoint. Nothing is uploaded without explicit --live.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
const [flag,manifestFlag,manifestPath,dirFlag,privateDir]=process.argv.slice(2);
const permitted=new Set(["--validate-private-cohort","--live-private-cohort","--live-private-v2-only"]);
if(!permitted.has(flag)||manifestFlag!=="--manifest"||!manifestPath||
  dirFlag!=="--photo-dir"||!privateDir||process.argv.length!==7){
  console.error("Usage: node scripts/facelab/skin/run-skin-private-v1v2.mjs --validate-private-cohort|--live-private-cohort|--live-private-v2-only --manifest /PRIVATE/cohort.json --photo-dir /PRIVATE/photos");
  process.exitCode=2;
}else{
  try{
    if(flag!=="--validate-private-cohort"&&process.env.GITHUB_ACTIONS==="true")
      throw new Error("ci_face_photo_execution_forbidden");
    // The manifest is a local private file, never embedded in a git revision.
    const data=JSON.parse(readFileSync(resolve(manifestPath),"utf8"));
    const result=await runPrivatePhotoCohort({
      manifest:data,photoDir:resolve(privateDir),
      live:flag!=="--validate-private-cohort",
      studyMode:flag==="--live-private-v2-only"?"v2_only":"paired"
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
