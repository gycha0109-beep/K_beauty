#!/usr/bin/env node
/**
 * Offline-only ten-cleanser audit. Input must be a reviewed, exact-scope
 * SELECT snapshot supplied on stdin. No built-in credentials, URL fetch,
 * Supabase client, product mutation, or filesystem outputs.
 *
 * node scripts/run-cleanser-presentation-cohort-shadow-v1.mjs --stdin < scoped-snapshot.json
 */
import {evaluateExistingCleanserCohortPresentationsV1} from "../lib/cleanser-cohort-presentation-shadow-v1.mjs";

if (process.argv.length!==3||process.argv[2]!=="--stdin"||process.stdin.isTTY) {
  throw new Error("EXPLICIT_READONLY_JSON_STDIN_REQUIRED");
}
let raw="";
for await (const chunk of process.stdin) {
  raw+=chunk;
  if (raw.length>1024*1024) throw new Error("INPUT_SCOPE_TOO_LARGE");
}
if (!raw.trim()) throw new Error("EXACT_COHORT_SNAPSHOT_REQUIRED");
const parsed=JSON.parse(raw);
const result=evaluateExistingCleanserCohortPresentationsV1(parsed);
process.stdout.write(JSON.stringify(result,null,2)+"\n");
