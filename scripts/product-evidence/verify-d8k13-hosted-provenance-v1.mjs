#!/usr/bin/env node
// D8K-13 historic migration provenance audit: OFFLINE ONLY.
// Provenance was established from read-only hosted statement fingerprints
// and GitHub source blob IDs on 2026-10-16. This program does NOT query
// hosted DB, read credentials, export historic SQL, or authorize a release.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const migrationsDir=join(ROOT,"supabase/migrations");
const provenance=JSON.parse(readFileSync(join(ROOT,
 "scripts/product-evidence/baselines/d8k13-hosted-migration-provenance-readonly-20261016.json"),"utf8"));
const args=process.argv.slice(2);
if(args.length>1||args.some(x=>!["--full","--enforce-release","--help"].includes(x)))
 throw Error("D8K13_UNKNOWN_PROVENANCE_DIAGNOSTIC_ARG");
if(args.includes("--help")){
 console.log("node scripts/product-evidence/verify-d8k13-hosted-provenance-v1.mjs [--full|--enforce-release]");
 process.exit(0);
}
assert.equal(provenance.schema,"D8K13_HOSTED_MIGRATION_SOURCE_PROVENANCE_V1");
assert.equal(provenance.status,"RELEASE_HOLD");
assert.equal(provenance.sourceSqlBodiesPublished,false);
const sameVersionTriage=JSON.parse(readFileSync(join(ROOT,
 "scripts/product-evidence/baselines/d8k13-hosted-same-version-sql-triage-readonly-20261016.json"),"utf8"));
assert.equal(sameVersionTriage.schema,"D8K13_SAME_VERSION_SQL_TRIAGE_READONLY_V1");
assert.equal(sameVersionTriage.status,"RELEASE_HOLD");
assert.equal(sameVersionTriage.sourceSqlBodiesPublished,false);
assert.equal(sameVersionTriage.summary.sameVersionAndNameButBlobNotDirectMatch,
 provenance.summaries.sameVersionNameUnmatched);
assert.equal(sameVersionTriage.summary.joinReassemblyNotProven,28);
assert.equal(sameVersionTriage.summary.singleStatementDifferent,18);
assert.equal(sameVersionTriage.entries.length,46);
const entries=readdirSync(migrationsDir).filter(x=>x.endsWith(".sql"));
const unique=new Set(entries);
assert.equal(unique.size,entries.length);
assert.equal(entries.length,provenance.summaries.local);
assert.equal(provenance.versionChanged.length,41);
assert.equal(provenance.remoteOnly.length,34);
function gitBlobSha(buffer){
 return createHash("sha1")
  .update(Buffer.from("blob "+buffer.length+"\0","utf8"))
  .update(buffer).digest("hex");
}
const triageCategories=new Map();
const triageFiles=new Set();
for(const entry of sameVersionTriage.entries){
 assert.ok(unique.has(entry.local_file),
  "D8K13_TRIAGE_SOURCE_FILE_MISSING: "+entry.local_file);
 assert.ok(!triageFiles.has(entry.local_file),
  "D8K13_TRIAGE_DUPLICATE_SOURCE_FILE: "+entry.local_file);
 triageFiles.add(entry.local_file);
 assert.ok(entry.local_file.startsWith(entry.version+"_"));
 assert.equal(gitBlobSha(readFileSync(join(migrationsDir,entry.local_file))),
  entry.git_blob_sha,
  "D8K13_TRIAGE_SOURCE_CHANGED: "+entry.local_file);
 triageCategories.set(entry.classification,
  (triageCategories.get(entry.classification)??0)+1);
}
for(const [classification,count] of [
 ["MULTI_STATEMENT_SPLIT_REASSEMBLY_NOT_PROVEN",28],
 ["TERMINAL_SQL_DELIMITER_DIFFERENCE_ONLY",6],
 ["SQL_TOKEN_EQUIVALENT_IGNORE_COMMENTS_WHITESPACE",5],
 ["GIT_BLOB_IDENTICAL_AFTER_TRIMMING_EDGE_NEWLINES",6],
 ["DELIMITER_OR_FUNCTION_BODY_DRIFT_REQUIRES_NATIVE_PG17_REVIEW",1]
])assert.equal(triageCategories.get(classification),count,
 "D8K13_TRIAGE_CLASSIFICATION_COUNT_CHANGED: "+classification);
assert.equal(triageCategories.size,5);
const categories={BYTE_IDENTICAL:0,IDENTICAL_PLUS_FINAL_LF:0,DIFFERENT:0};
const historicalRecovery=[];
for(const entry of provenance.versionChanged){
 assert.ok(unique.has(entry.local_file),"D8K13_PINNED_FILE_MISSING: "+entry.local_file);
 const sha=gitBlobSha(readFileSync(join(migrationsDir,entry.local_file)));
 assert.equal(sha,entry.local_git_blob_sha,
  "D8K13_SOURCE_CHANGED_SINCE_PROVENANCE_ATTESTATION: "+entry.local_file);
 assert.ok(Object.hasOwn(categories,entry.comparison));
 categories[entry.comparison]++;
 if(entry.followup==="EXACT_OLDER_GIT_REVISION")
  historicalRecovery.push(entry.name);
}
assert.equal(categories.BYTE_IDENTICAL+categories.IDENTICAL_PLUS_FINAL_LF,34);
assert.equal(categories.DIFFERENT,7);
assert.equal(historicalRecovery.length,1);
const localNames=new Set(entries.map(x=>x.replace(/^\d+_/,"").replace(/\.sql$/,"")));
for(const entry of provenance.remoteOnly){
 assert.ok(!localNames.has(entry.name),
  "D8K13_PREVIOUSLY_MISSING_APPLIED_SQL_NOW_LOCAL: "+entry.name);
 assert.ok(entry.statement_count>=1 && entry.stored_sql_bytes>0);
 // Never print SQL text, passwords, ids, or privately held SQL digests.
}
const result={
 stage:"D8K13_HOSTED_MIGRATION_SOURCE_PROVENANCE_AUDIT",
 status:"HOLD",offlineOnly:true,hostedDbQueried:false,
 productionDbWrites:0,publicSqlBodyExports:0,
 localFilesChecked:entries.length,versionShiftPairs:41,
 currentExactBytes:categories.BYTE_IDENTICAL,
 currentExactExceptFinalLf:categories.IDENTICAL_PLUS_FINAL_LF,
 currentFileDifferent:categories.DIFFERENT,
 exactHistoricalGitRevisionRecovered:historicalRecovery.length,
 appliedOnlyHistoryRows:provenance.remoteOnly.length,
 appliedOnlyHistoryRowsWithStoredSql:provenance.remoteOnly.filter(x=>x.statement_count>0).length,
 nameAndVersionSameButCurrentSqlBodyNotProven:provenance.summaries.sameVersionNameUnmatched,
 sameVersionTriage:{
  splitMultiStatementsNeedsParser:28,
  oneStatementTrailingDelimiterOnly:6,
  oneStatementSqlTokenEquivalent:5,
  oneStatementEdgeNewlinesOnly:6,
  requiresNativePg17ParserReview:1
 },
 sourceSqlBodyEquivalentForEntireHistory:false,
 releaseAuthorized:false,
 next:"Review Taxonomy8 migration-scope mismatch and the crawler function delimiter; validate parser-aware equivalence of 28 split-statement history rows and 12 one-statement differences (6 terminal delimiter + 5 SQL token equivalents + 1 crawler), then restore and approve the full chain independently."
};
if(args[0]==="--full")
 result.currentFileDrifts=provenance.versionChanged.filter(x=>x.comparison==="DIFFERENT")
  .map(x=>({file:x.local_file,status:x.followup}));
console.log(JSON.stringify(result,null,2));
console.log("D8K13_HOSTED_PROVENANCE_READONLY_HOLD");
if(args.includes("--enforce-release")){
 console.error("D8K13_PROVENANCE_RELEASE_REFUSED");
 process.exitCode=3;
}
