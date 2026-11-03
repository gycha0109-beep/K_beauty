#!/usr/bin/env node
// D8K13 original bootstrap artifact PRIVATE evidence intake.
// OFFLINE / READ ONLY. Never executes SQL or prints source bytes, credentials,
// filenames, arbitrary manifest text, or raw SQL. Candidate != attested history.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,realpathSync,statSync} from "node:fs";
import {dirname,join,resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const INVENTORY="scripts/product-evidence/baselines/d8k13-original-bootstrap-source-discovery-20261018.json";
const MAX_SQL_BYTES=64*1024*1024;
const ERROR_PREFIX="D8K13_PRIVATE_INTAKE_";
function demand(ok,label){
 if(!ok)throw Error(ERROR_PREFIX+label);
}
function repoExternalPath(file,root){
 demand(typeof file==="string"&&file.length>0,"PATH_REQUIRED");
 const resolved=realpathSync(file);
 const realRoot=realpathSync(root);
 demand(!(resolved===realRoot||resolved.startsWith(realRoot+sep)),"REPO_ARTIFACT_FORBIDDEN");
 demand(statSync(resolved).isFile(),"REGULAR_FILE_REQUIRED");
 return resolved;
}
export function verifyD8k13OriginalSourceInventory(root=ROOT){
 const m=JSON.parse(readFileSync(join(root,INVENTORY),"utf8"));
 assert.equal(m.schema,"D8K13_ORIGINAL_BOOTSTRAP_DISCOVERY_V1");
 assert.equal(m.status,"RELEASE_HOLD");
 assert.equal(m.productionProject.ref,"bygrczggxfuisupcevaz");
 assert.equal(m.productionProject.createdAtUtc,"2026-03-21T11:54:08.277807Z");
 assert.equal(m.productionProject.developmentBranchesObserved,0);
 assert.equal(m.productionProject.backupsEnumerationAvailableThroughConnectedSupabaseTools,false);
 assert.equal(m.productionProject.projectBackupListQueried,false);
 assert.equal(m.productionProject.backupExistenceAttested,false);
 assert.equal(m.earliestGitCommit.sha,"934762c805e910a946bb23b09f2c4634e47468f0");
 assert.equal(m.earliestGitCommit.sqlFileCount,0);
 assert.equal(m.earliestGitCommit.originalBootstrapFoundInEarlyGitTree,false);
 assert.equal(m.otherConnectedRepositories.matchingAuthenticFoundationalSqlFound,false);
 assert.equal(m.connectedGoogleDrive.relevantOriginalSqlOrBackupFound,false);
 assert.equal(m.connectedGitHub.releasesObserved,0);
 assert.equal(m.artifactIntake.realPreFirstMigrationSqlBytesRecovered,false);
 assert.equal(m.artifactIntake.verifiedOriginAndApprovedCustody,false);
 assert.equal(m.artifactIntake.independentOwnerSignature,false);
 assert.equal(m.artifactIntake.historicalFull178ReplayVerified,false);
 assert.equal(m.officialBackupPolicyAtObservation.projectActualPlanRead,false);
 assert.equal(m.officialBackupPolicyAtObservation.projectActualBackupRetentionAttested,false);
 assert.equal(m.releaseAuthorized,false);
 assert.equal(m.migrationHistoryRepairAuthorized,false);
 assert.equal(m.productionDbWrites,0);
 assert.equal(m.noSecretsOrSqlDumpContentsInThisManifest,true);
 return {status:"HOLD",originalBootstrapFound:false,originalBackupAttested:false,
  historicalFullChainReplayVerified:false,releaseAuthorized:false};
}
export function inspectD8k13PrivateBootstrapCandidate({root=ROOT,artifactPath,manifestPath}={}){
 verifyD8k13OriginalSourceInventory(root);
 const candidate=repoExternalPath(artifactPath,root);
 const manifestFile=repoExternalPath(manifestPath,root);
 const m=JSON.parse(readFileSync(manifestFile,"utf8"));
 demand(m.schema==="D8K13_PRIVATE_BOOTSTRAP_CANDIDATE_V1","MANIFEST_SCHEMA");
 demand(m.targetProjectRef==="bygrczggxfuisupcevaz","TARGET_PROJECT_MISMATCH");
 demand(m.sourceKind==="ORIGINAL_BOOTSTRAP_SQL_CLAIMED"||
   m.sourceKind==="HISTORICAL_PRELEDGER_SCHEMA_SQL_DUMP_CLAIMED","SOURCE_KIND_INVALID");
 demand(m.custodyLocation==="PRIVATE_EXTERNAL_NOT_REPOSITORY","CUSTODY_REQUIRED");
 demand(m.firstAppliedMigrationVersion==="20260410","FIRST_APPLIED_VERSION_MISMATCH");
 demand(m.preFirstMigrationSchemaClaim===true,"NO_PRELEDGER_SCHEMA_CLAIM");
 demand(m.independentlyApprovedForReplay===false,"REPLAY_APPROVAL_CANNOT_COME_FROM_MANIFEST");
 demand(m.releaseAuthorized===false,"RELEASE_APPROVAL_CANNOT_COME_FROM_MANIFEST");
 demand(m.rawArtifactUploadedToGit===false,"PUBLIC_ARTIFACT_NOT_ALLOWED");
 demand(/^[a-f0-9]{64}$/.test(m.sha256??""),"SHA256_REQUIRED");
 demand(Number.isSafeInteger(m.byteLength)&&m.byteLength>0&&m.byteLength<=MAX_SQL_BYTES,
  "SIZE_INVALID");
 const stat=statSync(candidate);
 demand(stat.size===m.byteLength,"ARTIFACT_SIZE_MISMATCH");
 const raw=readFileSync(candidate);
 const digest=createHash("sha256").update(raw).digest("hex");
 demand(digest===m.sha256,"ARTIFACT_SHA256_MISMATCH");
 // A shallow contents check is not SQL validation, safe to run, or proof of
 // true source. A real artifact may require independent DBA review to qualify.
 demand(!raw.includes(0),"SQL_BINARY_NOT_SUPPORTED");
 const source=raw.toString("utf8");
 demand(!source.includes("\ufffd"),"NON_UTF8_SQL_NOT_SUPPORTED");
 const names=["products","product_candidates","source_rankings"];
 const found=names.filter(name=>{
  const pattern=new RegExp("create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(?:\\\"?public\\\"?\\.)?\\\"?"+name+"\\\"?\\s*\\(","i");
  return pattern.test(source);
 });
 demand(found.length===3,"FOUNDATIONAL_TABLE_DDL_INCOMPLETE");
 const forbidden=/test.only disposable|intentionally synthetic|synthetic fixture|not a production historical baseline/i;
 demand(!forbidden.test(source),"SYNTHETIC_FIXTURE_REJECTED");
 return {status:"CANDIDATE_ONLY_NOT_ATTESTED",hashVerified:true,byteLengthVerified:true,
  foundationalCreateTablePatterns:3,privateExternalOnly:true,
  sourceAuthenticityVerified:false,originalAppliedAtVerified:false,
  historicRolesAclAttested:false,approvedForSqlExecution:false,
  full178ReplayVerified:false,releaseAuthorized:false};
}
const directlyInvoked=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(directlyInvoked){
 const args=process.argv.slice(2);
 const candidates=[];
 let enforce=false;
 for(let i=0;i<args.length;i++){
  if(args[i]==="--enforce-release")enforce=true;
  else if(["--artifact","--manifest"].includes(args[i])){
   demand(i+1<args.length,"ARGUMENT_VALUE_MISSING");
   candidates.push([args[i],args[++i]]);
  }else throw Error(ERROR_PREFIX+"UNKNOWN_ARGUMENT");
 }
 const artifact=candidates.filter(x=>x[0]==="--artifact");
 const manifest=candidates.filter(x=>x[0]==="--manifest");
 demand(artifact.length<=1&&manifest.length<=1,"DUPLICATE_ARGUMENT");
 demand(artifact.length===manifest.length,"PAIR_REQUIRED");
 const result=artifact.length?inspectD8k13PrivateBootstrapCandidate({
  artifactPath:artifact[0][1],manifestPath:manifest[0][1]}):
  verifyD8k13OriginalSourceInventory();
 console.log(JSON.stringify(result));
 console.log("D8K13_PRIVATE_BOOTSTRAP_EVIDENCE_INTAKE_HOLD");
 if(enforce){
  console.error("D8K13_PRIVATE_BOOTSTRAP_RELEASE_REFUSED");
  process.exitCode=3;
 }
}
