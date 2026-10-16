#!/usr/bin/env node
// PRIVATE local metadata-only merger: NO Provider, photos, key, raw JSON or CI.
import { readFileSync,writeFileSync,lstatSync } from "node:fs";
import { resolve,sep } from "node:path";
import { mergePrivateV2ResumeFour } from "./skin-private-v2-resume-core.mjs";

function readPrivate(path){
  const file=resolve(path);
  const stat=lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)
    throw new Error("private_input_invalid");
  return JSON.parse(readFileSync(file,"utf8"));
}
if(process.argv.length!==5){
  console.error("private_v2_resume_merge_invalid_arguments");
  process.exitCode=2;
}else{
  try{
    const [probeFile,fourFile,outFile]=process.argv.slice(2);
    const dest=resolve(outFile),cwd=resolve(process.cwd());
    if(dest===cwd||dest.startsWith(cwd+sep))throw new Error("output_inside_repository_forbidden");
    if(dest===resolve(probeFile)||dest===resolve(fourFile))
      throw new Error("output_overlaps_input");
    const report=mergePrivateV2ResumeFour(readPrivate(probeFile),readPrivate(fourFile));
    writeFileSync(dest,JSON.stringify(report,null,2)+"\n",{flag:"wx",mode:0o600});
    console.log("PRIVATE_V2_RESUME_MERGE_WRITTEN: 5 cases (1 reused + 4 new); local metadata only; Human/production HOLD");
  }catch{
    // Private paths, arbitrary input JSON and filesystem errors never leave process.
    console.error("private_v2_resume_merge_validation_failed");
    process.exitCode=1;
  }
}
