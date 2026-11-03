#!/usr/bin/env node
// D8K-13 migration-chain audit. Filesystem + checked-in read-only migration
// metadata ONLY. No network, env/secrets, DB, subprocess, or filesystem writes.
// Source version/name equality is NOT proof of SQL-body equality.
import {verifyD8k13PreledgerReconstruction} from "./verify-d8k13-preledger-reconstruction-v1.mjs";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {dirname,join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const baselinePath=join(root,
 "scripts/product-evidence/baselines/d8k13-hosted-migrations-readonly-20261016.json");
const migrationDir=join(root,"supabase/migrations");
const args=process.argv.slice(2);
if(args.length>1||args.some(arg=>!["--enforce-release","--full","--help"].includes(arg)))
 throw Error("D8K13_UNKNOWN_READONLY_MIGRATION_AUDIT_ARGUMENT");
if(args.includes("--help")){
 console.log("Read-only: node scripts/product-evidence/verify-d8k13-migration-chain-readonly-v1.mjs [--full|--enforce-release]");
 console.log("Never changes database, files, migration history, or deployment state.");
 process.exit(0);
}

const preledger=verifyD8k13PreledgerReconstruction(root);
assert.equal(preledger.foundationalSchemaOriginAttested,false);
assert.equal(preledger.full178MigrationReplayApproved,false);
const baseline=JSON.parse(readFileSync(baselinePath,"utf8"));
assert.equal(baseline.schema,"D8K13_HOSTED_MIGRATION_HISTORY_READONLY_V1");
assert.ok(Array.isArray(baseline.migrations)&&baseline.migrations.length>0);
assert.equal(baseline.observed_count,baseline.migrations.length);
const formatVersion=/^\d{8}(?:\d{6})?$/;
const localFiles=readdirSync(migrationDir,{withFileTypes:true})
 .filter(entry=>entry.isFile()&&entry.name.endsWith(".sql"))
 .map(entry=>{
  const match=/^(\d{8}(?:\d{6})?)_(.+)\.sql$/.exec(entry.name);
  if(!match)throw Error("D8K13_UNKNOWN_MIGRATION_FILENAME: "+entry.name);
  return {version:match[1],name:match[2],file:entry.name};
 }).sort((a,b)=>a.version.localeCompare(b.version)||a.name.localeCompare(b.name));

const byVersion=new Map(),byName=new Map();
for(const entry of baseline.migrations){
 assert.ok(formatVersion.test(entry.version));
 assert.ok(typeof entry.name==="string"&&entry.name.length>0);
 if(byVersion.has(entry.version))throw Error("D8K13_DUPLICATE_HOSTED_VERSION");
 if(byName.has(entry.name))throw Error("D8K13_DUPLICATE_HOSTED_NAME");
 byVersion.set(entry.version,entry);
 byName.set(entry.name,entry);
}
const latest=[...byVersion.keys()].sort().at(-1);
assert.equal(latest,baseline.last_applied_version);
const localVersions=new Map(),localNames=new Set();
for(const entry of localFiles){
 const earlier=localVersions.get(entry.version)??[];
 earlier.push(entry.file);
 localVersions.set(entry.version,earlier);
 if(localNames.has(entry.name))throw Error("D8K13_DUPLICATE_LOCAL_NAME");
 localNames.add(entry.name);
}
const duplicateLocalVersions=[...localVersions]
 .filter(([_,files])=>files.length>1)
 .map(([version,files])=>({version,files}));
const non14DigitLocalVersions=localFiles
 .filter(x=>x.version.length!==14).map(x=>x.file);

const exact=[],versionCollision=[],nameMoved=[],localUnmatched=[];
for(const f of localFiles){
 const v=byVersion.get(f.version);
 const n=byName.get(f.name);
 if(v&&v.name===f.name)exact.push(f);
 else if(v)versionCollision.push({
  file:f.file,appliedVersion:v.version,appliedName:v.name
 });
 else if(n)nameMoved.push({
  file:f.file,localVersion:f.version,appliedVersion:n.version,name:f.name
 });
 else localUnmatched.push({file:f.file,relativeToLastApplied:
    f.version>latest?"AFTER_WATERMARK":"BEFORE_OR_AT_WATERMARK"});
}
const appliedOnly=baseline.migrations.filter(x=>!localNames.has(x.name))
 .map(x=>({version:x.version,name:x.name}));
const localWithoutVersion=localFiles.filter(x=>!byVersion.has(x.version));
const belowWatermark=localWithoutVersion.filter(x=>x.version<=latest);
const afterWatermark=localWithoutVersion.filter(x=>x.version>latest);
const matchedVersions=localFiles.filter(x=>byVersion.has(x.version));

assert.equal(localFiles.length,exact.length+versionCollision.length+
 nameMoved.length+localUnmatched.length);
// Different-name version collisions are already represented in appliedOnly:
// counting them here would double-count the hosted applied record.
assert.equal(baseline.migrations.length,exact.length+
 nameMoved.length+appliedOnly.length);

const summary={
 stage:"D8K13_FULL_PENDING_MIGRATION_HISTORY_AUDIT",
 status:"HOLD",
 evidence:"LOCAL_REPOSITORY_FILES_VS_PINNED_READ_ONLY_HOSTED_MIGRATION_METADATA",
 snapshotDateKst:baseline.observed_date_kst,
 liveHostedStateQueriedNow:false,
 productionDbWrites:0,
 deploymentAuthorized:false,
 originalArchiveBytesAccessed:false,
 comparedRepositoryMigrationFiles:localFiles.length,
 historicalAppliedMigrationRecords:baseline.migrations.length,
 lastAppliedVersion:latest,
 exactVersionAndName:exact.length,
 sameVersionDifferentName:versionCollision.length,
 sameNameDifferentVersion:nameMoved.length,
 duplicateLocalVersionGroups:duplicateLocalVersions.length,
 non14DigitLocalMigrationFiles:non14DigitLocalVersions.length,
 localNoMatchingAppliedName:localUnmatched.length,
 appliedNameWithoutLocalFile:appliedOnly.length,
 localVersionNotInAppliedHistory:localWithoutVersion.length,
 localVersionAbsentAtOrBeforeWatermark:belowWatermark.length,
 localVersionAbsentAfterWatermark:afterWatermark.length,
 sourceSqlBodyEquivalentVerified:false,
 migrationRepairAuthorized:false,
 preledgerFoundationalSchemaOriginAttested:preledger.foundationalSchemaOriginAttested,
 preledgerHistoricalBootstrapReconstructionAccepted:false,
 preledgerCurrentSchemaOnly:preledger.currentSchemaOnly,
 preledgerBlockingPrerequisites:preledger.blockingPrerequisites,
 historicalFullReplayCannotStartWithoutIndependentBootstrap:true,
 recommendedAction:"Do NOT run db push or migration repair; reconcile exact versions, historical SQL bodies, deployed schema, older unmatched scripts and full dependency chain under independent review."
};
const result={...summary,
 localUnmatched,
 versionCollision,
 duplicateLocalVersions,
 non14DigitLocalVersions,
 remoteOnlyCount:appliedOnly.length,
 // Emit bounded high-value examples by default; --full shows all 41+34.
 nameMoved:args.includes("--full")?nameMoved:nameMoved.slice(-8),
 appliedOnly:args.includes("--full")?appliedOnly:appliedOnly.slice(-12),
 postWatermarkFiles:afterWatermark.map(x=>x.file)};
console.log(JSON.stringify(result,null,2));
console.log("D8K13_FULL_MIGRATION_CHAIN_READONLY_HOLD");
if(args.includes("--enforce-release")){
 console.error("D8K13_FULL_CHAIN_RELEASE_REFUSED: version/name drift, unverified SQL equivalence, backup/security/reviewer gates");
 process.exitCode=3;
}
