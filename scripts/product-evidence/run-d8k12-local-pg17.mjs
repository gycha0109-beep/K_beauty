#!/usr/bin/env node
// Real PG17 acceptance in disposable LOCAL Docker only. No hosted DB URL,
// no mounted files, no network, no Docker remote context, no env/secrets reads.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {readFileSync,existsSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const IMAGE="postgres:17";
const CONTAINER="bejewely-d8k12-"+process.pid+"-"+randomBytes(4).toString("hex");
const SQL_PATHS=Object.freeze([
 "tests/fixtures/r16i-d8k12/00_minimal_pg17.sql",
 "supabase/migrations/20261015185000_taxonomy_ai_r16i_d8k12_owner_review_revocation_v1.sql",
 "tests/fixtures/r16i-d8k12/10_runtime_pg17.sql"
]);
let started=false,cleaning=false;
function docker(args,{input=null,allowFailure=false,seconds=90}={}){
 const p=spawnSync("docker",args,{
  input:input??undefined,encoding:"utf8",shell:false,windowsHide:true,
  timeout:seconds*1000,maxBuffer:4*1024*1024
 });
 if(p.error&&!allowFailure)throw Error("DOCKER_UNAVAILABLE");
 if(!allowFailure&&p.status!==0)
   throw Error("DOCKER_COMMAND_FAILED_"+args[0]+": "+
     (p.stderr||p.stdout||"").trim().slice(0,1400));
 return p;
}
function file(rel){
 if(!SQL_PATHS.includes(rel))throw Error("SQL_INPUT_NOT_IN_FIXED_ALLOWLIST");
 const p=path.join(ROOT,rel);
 if(!existsSync(p))throw Error("MISSING_REPOSITORY_FIXTURE: "+rel);
 const sql=readFileSync(p,"utf8");
 if(!sql.trim()||sql.includes("\u0000"))throw Error("SQL_SOURCE_INVALID: "+rel);
 return sql;
}
function psql(sql,{db="postgres",expectedError=null}={}){
 const p=docker([
  "exec","-i","--user","postgres",CONTAINER,
  "psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d",db,"-f","-"
 ],{input:sql,allowFailure:!!expectedError,seconds:90});
 const stdout=p.stdout||"",stderr=p.stderr||"";
 if(expectedError){
  assert.notEqual(p.status,0,"Expected DB safeguard to fail");
  assert.match(stderr,new RegExp(expectedError),
    "Actual PostgreSQL guard should reject legacy migration precondition");
 }else{
  assert.equal(p.status,0,stderr);
 }
 return stdout+"\n"+stderr;
}
function checkLocal(){
 const override=process.env.DOCKER_HOST;
 if(override&&!/^(?:unix:\/\/|npipe:\/\/)/.test(override))
   throw Error("REMOTE_DOCKER_HOST_FORBIDDEN");
 const context=docker(["context","inspect","--format","{{json .Endpoints}}"]);
 let endpoints;
 try{endpoints=JSON.parse(context.stdout.trim())}
 catch{throw Error("UNVERIFIED_DOCKER_CONTEXT")}
 const endpoint=endpoints?.docker?.Host;
 if(typeof endpoint!=="string"||
    !/^(?:unix:\/\/|npipe:\/\/)/.test(endpoint))
   throw Error("REMOTE_OR_UNKNOWN_DOCKER_CONTEXT_FORBIDDEN");
 if(docker(["info","--format","{{.OSType}}"]).stdout.trim()!=="linux")
   throw Error("DOCKER_LINUX_ENGINE_REQUIRED");
 docker(["image","inspect",IMAGE,"--format","{{.Id}}"]);
}
function cleanup(){
 if(!started||cleaning)return;
 cleaning=true;
 docker(["rm","--force",CONTAINER],{allowFailure:true,seconds:15});
 started=false;
}
process.on("SIGINT",()=>{cleanup();process.exit(130)});
process.on("SIGTERM",()=>{cleanup();process.exit(143)});

async function run(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==="--help"){
  console.log("Local Docker only: node scripts/product-evidence/run-d8k12-local-pg17.mjs [--check-files]");
  console.log("Requires a previously pulled postgres:17 image and Docker Desktop Linux engine.");
  return;
 }
 if(args.some(x=>x!=="--check-files")||args.length>1)
  throw Error("UNKNOWN_ARGUMENT");
 const [seed,migration,test]=SQL_PATHS.map(file);
 assert.match(migration,/D8K12_REVIEWER_CANNOT_APPROVE_OWN_CAPTURE/);
 assert.match(migration,/D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION/);
 assert.match(migration,/admin_product_correction_evidence_review_events_v2/);
 assert.match(migration,/REVOKE INSERT,UPDATE,DELETE ON public\.admin_product_correction_evidence_verdicts_v1/);
 assert.match(test,/D8K12_PG17_SQL_ACCEPTANCE_PASS/);
 assert.match(seed,/CREATE TABLE auth\.users/);
 console.log("D8K12_CHECK_FILES_PASS (3 fixed local SQL files)");
 if(args.length)return;

 checkLocal();
 try{
  docker(["run","--detach","--rm","--pull=never","--network=none",
   "--tmpfs","/var/lib/postgresql/data:rw,size=268435456",
   "--name",CONTAINER,
   "--label","bejewely.local-test=d8k12",
   "--env","POSTGRES_PASSWORD=disposable-local-only",IMAGE],{seconds:60});
  started=true;
  let ready=false;
  for(let i=0;i<80;i++){
   const p=docker(["exec","--user","postgres",CONTAINER,
    "pg_isready","-q","-U","postgres","-d","postgres"],{
    allowFailure:true,seconds:10
   });
   if(p.status===0){ready=true;break}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!ready)throw Error("PG17_CONTAINER_NOT_READY");
  assert.match(psql("select current_setting('server_version_num')::integer/10000;"),/\b17\b/);

  console.log("PG17 isolated fixture 1/3: initial roles and synthetic records");
  psql(seed);
  console.log("PG17 isolated fixture 2/3: revised approval+withdrawal DB rules");
  psql(migration);
  console.log("PG17 isolated fixture 3/3: actual role/approval/withdrawal assertions");
  const report=psql(test);
  assert.match(report,/D8K12_PG17_SQL_ACCEPTANCE_PASS/);
  console.log("D8K12_PG17_SQL_ACCEPTANCE_PASS");

  // Reject migration when ANY unreviewed historical verdict already exists.
  docker(["exec","--user","postgres",CONTAINER,"createdb",
    "-U","postgres","d8k12_existing"],{seconds:20});
  psql(seed,{db:"d8k12_existing"});
  psql(`INSERT INTO public.admin_product_correction_evidence_verdicts_v1(
   evidence_id,verdict,reason,reviewer_id,request_id
  ) VALUES(
   '00000000-0000-4000-8000-000000000041',
   'VERIFIED','Old unchecked verdict',
   '00000000-0000-4000-8000-000000000011',
   '00000000-0000-4000-8000-000000000088'
  );`,{db:"d8k12_existing"});
  psql(migration,{db:"d8k12_existing",
    expectedError:"D8K12_EXISTING_VERDICTS_REQUIRE_EXPLICIT_RECONCILIATION"});
  const rollback=psql(`SELECT CASE WHEN
    to_regclass('public.admin_product_correction_evidence_review_events_v2') IS NULL
      AND (SELECT count(*) FROM public.admin_product_correction_evidence_verdicts_v1)=1
    THEN 'SAFE_ROLLBACK' ELSE 'UNSAFE' END;`,{db:"d8k12_existing"});
  assert.match(rollback,/SAFE_ROLLBACK/);
  console.log("D8K12_LEGACY_VERDICT_MIGRATION_REFUSED_AND_ROLLED_BACK_PASS");
  console.log("D8K12_LOCAL_DOCKER_PG17_PASS");
 }finally{
  cleanup();
  console.log("Removed isolated temporary PG17 container.");
 }
}
run().catch(error=>{
 cleanup();console.error("D8K12_LOCAL_DOCKER_PG17_FAIL:",error.message);
 process.exitCode=1;
});
