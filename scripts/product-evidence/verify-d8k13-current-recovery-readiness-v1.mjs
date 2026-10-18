#!/usr/bin/env node
// Current-state recovery is intentionally independent of historical pre-ledger replay.
// Read-only offline evidence validator. A catalog inventory is NOT a usable backup.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
export function verifyD8k13CurrentRecoveryReadiness(dir=root){
 const b=JSON.parse(readFileSync(join(dir,
  "scripts/product-evidence/baselines/d8k13-current-public-recovery-inventory-20261018.json"),"utf8"));
 assert.equal(b.schema,"D8K13_CURRENT_PUBLIC_RECOVERY_INVENTORY_V1");
 assert.equal(b.status,"CURRENT_STRUCTURE_OBSERVED_RESTORE_UNTESTED");
 assert.equal(b.recoveryStrategy,"CURRENT_STATE_BASELINE_INSTEAD_OF_HISTORICAL_178_REPLAY");
 assert.equal(b.projectRef,"bygrczggxfuisupcevaz");
 assert.equal(b.postgresMajor,17);
 assert.equal(b.scope,"public");
 assert.deepEqual(b.counts,{
  tables:101,views:6,matviews:0,rlsEnabled:101,rlsForced:4,columns:1425,
  primaryKeys:101,foreignKeys:233,routines:187,securityDefinerRoutines:135,
  policies:58,nonInternalTriggers:23,enums:5
 });
 const query=readFileSync(join(dir,b.queryPath));
 const blob=createHash("sha1").update(Buffer.from("blob "+query.length+"\u0000")).update(query).digest("hex");
 assert.equal(blob,b.queryGitBlob,"D8K13_CURRENT_INVENTORY_SQL_BLOB_DRIFT");
 const lines=query.toString("utf8").split(/\r?\n/).map(s=>s.trim());
 assert.ok(lines.some(s=>s.startsWith("SELECT jsonb_build_object(")));
 assert.ok(lines.some(s=>s.includes("FROM pg_class")));
 assert.ok(lines.some(s=>s.includes("pg_policy")));
 assert.ok(lines.some(s=>s.includes("pg_trigger")));
 assert.ok(lines.some(s=>s.includes("pg_proc")));
 assert.ok(lines.some(s=>s.includes("'no_data_exported',true")));
 const forbidden=/^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|TRUNCATE|COPY|CALL|DO|EXECUTE|SELECT\s+.*INTO\s)\b/i;
 assert.ok(!lines.some(s=>forbidden.test(s)),"D8K13_CURRENT_INVENTORY_NOT_SELECT_ONLY");
 assert.deepEqual(b.boundaries,{
  publicSchemaMetadataOnly:true,authStorageSchemasNotInventoried:true,
  clusterRolesNotInventoried:true,schemaObjectDefinitionsNotExported:true,
  rowDataNotExported:true,storageObjectsNotBackedUp:true,
  databaseCredentialsExcluded:true,privateArtifactsInRepository:false,productionWrites:0
 });
 const prerequisites=[
  "approvedPrivateSchemaRolesAndDataDumpCaptured",
  "objectStorageAndManagedAuthDependenciesAssessed",
  "targetPg17CompatReviewed",
  "disposableSchemaRestoreDrillPassed",
  "disposableDataRestoreDrillPassed",
  "identityAndPrivilegeParityReviewed",
  "encryptionSecretsAndExternalStorageContinuityReviewed",
  "independentOwnerAndSecurityApproval",
  "releaseAuthorized"
 ];
 assert.deepEqual(Object.keys(b.recoveryPrerequisites).sort(),prerequisites.sort());
 for(const k of prerequisites)assert.equal(b.recoveryPrerequisites[k],false,"D8K13_CURRENT_UNVERIFIED_PREREQUISITE_"+k);
 assert.equal(b.doesNotClaimOldMigrationChainReplay,true);
 assert.equal(b.currentProductionBaselineMayChangeAfterObservation,true);
 assert.equal(b.productionWrites,0);
 assert.equal(b.releaseAuthorized,false);
 return {status:"HOLD",scope:"PUBLIC_METADATA_ONLY",counts:b.counts,
  currentStructureObserved:true,privateFullBackupAvailable:false,
  actualCurrentDbRestorePassed:false,releaseAuthorized:false,productionWrites:0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.length>1||args.some(s=>s!=="--enforce-release"))
  throw Error("D8K13_CURRENT_READINESS_UNKNOWN_ARGUMENT");
 console.log(JSON.stringify(verifyD8k13CurrentRecoveryReadiness(root)));
 console.log("D8K13_CURRENT_RECOVERY_INVENTORY_PASS_HOLD");
 if(args.includes("--enforce-release")){
  console.error("D8K13_CURRENT_RECOVERY_RELEASE_REFUSED");
  process.exitCode=3;
 }
}
