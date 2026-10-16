#!/usr/bin/env node
// Private local metadata-only comparison; ZERO Provider calls, ZERO photos.
// Safe stdout contains aggregate counters only. Never print filepaths or
// arbitrary parser/IO exceptions, which might embed private user content.
import { readFileSync } from "node:fs";
import { comparePrivateSkinV2Correction } from "./skin-private-v2-correction-audit.mjs";

if(process.argv.length!==4){
  console.error("private_comparison_invalid_arguments");
  process.exitCode=2;
}else{
  try {
    const parsePrivatePath=p=>{
      const raw=readFileSync(p);
      if(raw.length>2*1024*1024)throw new Error("private_report_too_large");
      return JSON.parse(raw.toString("utf8"));
    };
    const baseline=parsePrivatePath(process.argv[2]);
    const correction=parsePrivatePath(process.argv[3]);
    console.log(JSON.stringify(comparePrivateSkinV2Correction(baseline,correction),null,2));
  }catch {
    console.error("private_comparison_validation_failed");
    process.exitCode=1;
  }
}
