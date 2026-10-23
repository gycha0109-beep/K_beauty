#!/usr/bin/env node
/**
 * Integration-only read path. Requires original v1 from draft PR #1390
 * to be present at its canonical lib path after a legitimate merge/rebase.
 * No copied v1 logic or remote download; no database/network/DB mutation.
 */
import {compareExistingTenCleanserPreflightsV1} from "../lib/cleanser-ten-preflight-v1-v2-diff-v1.mjs";
if(process.argv.length!==3||process.argv[2]!=="--stdin"||process.stdin.isTTY)
  throw new Error("EXPLICIT_TEN_PRODUCT_SCOPED_STDIN_REQUIRED");
let content="";
for await(const chunk of process.stdin){
  content+=chunk;
  if(content.length>2_000_000)throw new Error("SCOPE_INPUT_TOO_LARGE");
}
if(!content.trim())throw new Error("MISSING_READONLY_TEN_PRODUCT_SNAPSHOT");
let v1;
try{
  ({evaluateCleanserInitialAdmissionPreflight:v1}=
    await import("../lib/cleanser-initial-admission-preflight-v1.mjs"));
}catch{
  throw new Error("UPSTREAM_PR_1390_V1_MUST_BE_INTEGRATED_BEFORE_REAL_COMPARISON");
}
if(typeof v1!=="function")throw new Error("UPSTREAM_V1_EVALUATOR_MISSING");
const cohort=JSON.parse(content);
const result=await compareExistingTenCleanserPreflightsV1({cohort,evaluateV1:v1});
process.stdout.write(JSON.stringify(result,null,2)+"\n");
