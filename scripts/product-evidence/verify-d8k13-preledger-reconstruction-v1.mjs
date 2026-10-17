#!/usr/bin/env node
// D8K13 pre-ledger reconstruction gate. OFFLINE read-only proof review.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {join,dirname,resolve} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const baselinePath="scripts/product-evidence/baselines/d8k13-preledger-reconstruction-readiness-20261017.json";
const queryPath="scripts/product-evidence/sql/d8k13-preledger-schema-profile-readonly-v1.sql";
const firstMigrationPath="supabase/migrations/20260410_safe_review_and_promotion_layer.sql";
const flags=[
 "originalFoundationalSchemaBootstrapBytesRecovered",
 "originalBootstrapObjectOwnerAndAclCreationEvidenceAttested",
 "complete178SqlStatementsProvenReplayableInCorrectOrder",
 "historicalSchemaAndRuntimeDependencySnapshotsAvailable",
 "isolatedPg17Full178MigrationReplayVerified",
 "crawlerSixTerminalSemicolonNativePg17ParserVerified",
 "historicalSourceRankingsAndProductCandidatesAclOriginAttested",
 "independentBackupPitrRestoreSuccess",
 "independentOwnerAndSecuritySignoff",
 "securityIssue1208Resolved",
 "explicitProductionReleaseAuthorization"
];
export function verifyD8k13PreledgerReconstruction(root=ROOT){
 const b=JSON.parse(readFileSync(join(root,baselinePath),"utf8"));
 assert.equal(b.schema,"D8K13_PRELEDGER_RECONSTRUCTION_READINESS_V1");
 assert.equal(b.status,"RELEASE_HOLD");
 assert.equal(b.firstRepoCommit,"934762c805e910a946bb23b09f2c4634e47468f0");
 assert.equal(b.firstRepoTreeContainedSqlFiles,false);
 assert.equal(b.initialGitScanDoesNotProveNoExternalBootstrap,true);
 assert.equal(b.earliestRecordedAppliedVersion,"20260410");
 assert.equal(b.appliedMigrationCount,178);
 assert.equal(b.repositoryMigrationCountAtOriginalHistoryAudit,153);
 assert.equal(b.earliestAppliedAltersPreexistingProductCandidates,true);
 assert.equal(b.earliestAppliedViewDependsOnSourceRankings,true);
 assert.equal(b.earliestAppliedCreatesEitherFoundationalTable,false);
 const sqlBytes=readFileSync(join(root,firstMigrationPath));
 const sha=createHash("sha1").update(Buffer.from("blob "+sqlBytes.length+String.fromCharCode(0),"utf8"))
  .update(sqlBytes).digest("hex");
 assert.equal(sha,b.earliestRecordedAppliedMigrationBlob,"D8K13_PRELEDGER_EARLIEST_MIGRATION_BLOB_DRIFT");
 const source=sqlBytes.toString("utf8");
 assert.ok(source.includes("alter table public.product_candidates"));
 assert.ok(source.includes("left join public.source_rankings sr"));
 assert.ok(!source.includes("create table public.source_rankings"));
 assert.ok(!source.includes("create table public.product_candidates"));
 const expected=[
  {key:"sourceRankings",columns:14,constraints:3,foreignKeys:2,notNullColumns:6,defaultColumns:2},
  {key:"productCandidates",columns:36,constraints:8,foreignKeys:2,notNullColumns:11,defaultColumns:12}
 ];
 assert.equal(b.currentSchemaSnapshot.status,"CURRENT_ONLY_NOT_HISTORICAL_INITIAL_SCHEMA");
 for(const e of expected){
  const item=b.currentSchemaSnapshot[e.key];
  assert.equal(item.owner,"postgres");
  assert.equal(item.relkind,"r");
  for(const [key,val] of Object.entries(e))if(key!=="key")assert.equal(item[key],val);
  assert.equal(item.rlsEnabled,true);
  assert.equal(item.extensionOwned,false);
  assert.equal(item.anonReadWriteAllowed,false);
  assert.equal(item.authenticatedReadWriteAllowed,false);
  assert.equal(item.serviceRoleInsert,true);
 }
 assert.deepEqual(Object.keys(b.prerequisites).sort(),[...flags].sort(),"D8K13_PRELEDGER_REQUIRED_GATES_CHANGED");
 for(const key of flags)assert.equal(b.prerequisites[key],false,
  "D8K13_PRELEDGER_BLOCKED_GATE_UNEXPECTEDLY_ATTESTED: "+key);
 const query=readFileSync(join(root,queryPath),"utf8");
 assert.ok(query.includes("D8K13_PRELEDGER_CURRENT_SCHEMA_PROFILE_V1"));
 assert.ok(query.includes("FROM pg_class"));
 assert.ok(query.includes("SELECT jsonb_build_object("));
 assert.ok(!query.split(String.fromCharCode(10)).some(line=>
  ["insert","update","delete","create","alter","drop","grant","revoke","truncate"]
   .includes(line.trim().split(" ")[0].toLowerCase())),"D8K13_PRELEDGER_QUERY_NOT_SELECT_ONLY");
 assert.equal(b.historicalSqlBodiesExportedToPublic,false);
 assert.equal(b.productionDatabaseWrites,0);
 assert.equal(b.fullMigrationReplayCertified,false);
 assert.equal(b.releaseAuthorized,false);
 assert.equal(b.migrationHistoryRepairAuthorized,false);
 assert.equal(b.v2GateEnabled,false);
 return {status:"HOLD",offlineOnly:true,foundationalSchemaOriginAttested:false,
  currentSchemaOnly:true,blockingPrerequisites:flags.length,
  full178MigrationReplayApproved:false,hostedWrites:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length>1||args.some(x=>x!=="--enforce-release"))
  throw Error("D8K13_UNKNOWN_PRELEDGER_RECONSTRUCTION_ARGUMENT");
 const summary=verifyD8k13PreledgerReconstruction(ROOT);
 console.log(JSON.stringify(summary));
 console.log("D8K13_PRELEDGER_RECONSTRUCTION_CONTRACT_PASS_HOLD");
 if(args.includes("--enforce-release")){
  console.error("D8K13_PRELEDGER_RECONSTRUCTION_RELEASE_REFUSED");
  process.exitCode=3;
 }
}
