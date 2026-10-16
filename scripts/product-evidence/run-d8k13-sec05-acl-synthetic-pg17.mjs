#!/usr/bin/env node
// Isolated synthetic PostgreSQL 17 acceptance only. NEVER connect to hosted DB.
// No Docker pull, remote context, network, published port, volume or DB URL.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {existsSync,readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const IMAGE="postgres:17";
const NAME="bejewely-d8k13-sec05-"+process.pid+"-"+randomBytes(4).toString("hex");
const SOURCE="supabase/migrations/20260711032649_sec_05_anonymous_write_grants.sql";
const FIXTURES=Object.freeze([
 "tests/fixtures/r16i-d8k13/30_sec05_acl_synthetic_setup_pg17.sql",
 "tests/fixtures/r16i-d8k13/31_sec05_legacy_null_behavior_pg17.sql",
 "tests/fixtures/r16i-d8k13/32_sec05_hardened_null_contract_pg17.sql",
 "tests/fixtures/r16i-d8k13/33_sec05_ranking_acl_minimal_revoke_pg17.sql"
]);
const ALLOWLIST=Object.freeze([SOURCE,...FIXTURES]);
let running=false,cleaning=false;

function read(rel){
 assert.ok(ALLOWLIST.includes(rel),"SEC05_SQL_FILE_NOT_ALLOWLISTED");
 const file=path.join(ROOT,rel);
 assert.ok(existsSync(file),"SEC05_FIXTURE_FILE_MISSING: "+rel);
 const sql=readFileSync(file,"utf8");
 assert.ok(sql.trim()&&!sql.includes("\u0000"),"SEC05_SQL_SOURCE_INVALID: "+rel);
 return sql;
}
function docker(args,{input=null,allowFailure=false,seconds=60}={}){
 const p=spawnSync("docker",args,{
  input:input??undefined,encoding:"utf8",shell:false,windowsHide:true,
  timeout:seconds*1000,maxBuffer:4*1024*1024
 });
 if(p.error&&!allowFailure)throw Error("LOCAL_DOCKER_UNAVAILABLE: "+p.error.message);
 if(!allowFailure&&p.status!==0){
  throw Error("SEC05_DOCKER_COMMAND_FAILED_"+args[0]+": "+
    (p.stderr||p.stdout||"").trim().slice(0,1100));
 }
 return p;
}
function psql(sql,{expectedError=null}={}){
 const r=docker(["exec","-i","--user","postgres",NAME,
   "psql","-X","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres","-f","-"
  ],{input:sql,allowFailure:!!expectedError,seconds:60});
 const result=(r.stdout||"")+"\n"+(r.stderr||"");
 if(expectedError){
  assert.notEqual(r.status,0,"SEC05_EXPECTED_DB_ERROR_NOT_RAISED");
  assert.match(result,new RegExp(expectedError),"SEC05_UNEXPECTED_DATABASE_ERROR");
 }else assert.equal(r.status,0,result.slice(-1100));
 return result;
}
function checkLocal(){
 const host=process.env.DOCKER_HOST;
 if(host&&!/^(?:unix:\/\/|npipe:\/\/)/.test(host))
  throw Error("SEC05_REMOTE_DOCKER_HOST_FORBIDDEN");
 const context=docker(["context","inspect","--format","{{json .Endpoints}}"]);
 let info=null;
 try{info=JSON.parse(context.stdout.trim())}
 catch{throw Error("SEC05_DOCKER_CONTEXT_UNVERIFIED")}
 if(!/^(?:unix:\/\/|npipe:\/\/)/.test(info?.docker?.Host||""))
  throw Error("SEC05_REMOTE_OR_UNKNOWN_DOCKER_CONTEXT_FORBIDDEN");
 if(docker(["info","--format","{{.OSType}}"]).stdout.trim()!=="linux")
  throw Error("SEC05_DOCKER_LINUX_ENGINE_REQUIRED");
 docker(["image","inspect",IMAGE,"--format","{{.Id}}"]);
}
function cleanup(){
 if(!running||cleaning)return;
 cleaning=true;
 docker(["rm","--force",NAME],{allowFailure:true,seconds:15});
 running=false;
}
process.on("SIGINT",()=>{cleanup();process.exit(130)});
process.on("SIGTERM",()=>{cleanup();process.exit(143)});

function extractClaimFunction(source){
 const startMark="create or replace function public.claim_anonymous_write_grant(";
 const start=source.indexOf(startMark);
 assert.ok(start>0,"SEC05_SOURCE_CLAIM_FUNCTION_MISSING");
 assert.equal(source.indexOf(startMark,start+startMark.length),-1,
  "SEC05_DUPLICATE_CLAIM_FUNCTION_DEFINITION");
 const end=source.indexOf("\n$$;",start);
 assert.ok(end>start,"SEC05_CLAIM_FUNCTION_TERMINATOR_MISSING");
 const result=source.slice(start,end+4);
 assert.match(result,/returns jsonb[\s\S]+language plpgsql[\s\S]+as \$\$/);
 assert.match(result,/public\.anonymous_write_grants[\s\S]+for update/);
 assert.match(result,/public\.anonymous_write_grant_uses/);
 assert.match(result,/return jsonb_build_object\('state', 'claimed'/);
 return result;
}
function legacyVariant(hardened){
 const before=[
  "  if p_jti_hash is null",
  "     or p_principal_hash is null",
  "     or p_resource_type is null",
  "     or p_resource_id is null",
  "     or p_operation is null",
  "     or p_request_fingerprint_hash is null",
  "     or p_jti_hash !~ '^[0-9a-f]{64}$'"
 ].join("\n");
 const after="  if p_jti_hash !~ '^[0-9a-f]{64}$'";
 assert.equal(hardened.split(before).length,2,
  "SEC05_EXACT_HARDENED_SIX_NULL_GUARDS_MISSING");
 return hardened.replace(before,after);
}
async function startDocker(){
 checkLocal();
 docker(["run","--detach","--rm","--pull=never","--network=none",
  "--tmpfs","/var/lib/postgresql/data:rw,size=268435456",
  "--name",NAME,"--label","bejewely.local-test=sec05-acl",
  "--env","POSTGRES_PASSWORD=disposable-local-only",IMAGE],{seconds:60});
 running=true;
 let ok=false;
 for(let i=0;i<120;i++){
  const ready=docker(["exec","--user","postgres",NAME,"pg_isready",
    "-q","-h","127.0.0.1","-U","postgres","-d","postgres"],{
     allowFailure:true,seconds:10
    });
  if(ready.status===0){
   const p=docker(["exec","--user","postgres",
    "--env","PGPASSWORD=disposable-local-only",NAME,
    "psql","-X","-A","-t","-v","ON_ERROR_STOP=1",
    "-h","127.0.0.1","-U","postgres","-d","postgres",
    "-c","SELECT current_setting('server_version_num')::integer/10000;"],{
     allowFailure:true,seconds:10
    });
   if(p.status===0&&p.stdout.trim()==="17"){ok=true;break}
  }
  await new Promise(r=>setTimeout(r,500));
 }
 assert.ok(ok,"SEC05_LOCAL_PG17_TCP_NOT_READY");
}
async function main(){
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==="--help"){
  console.log("node scripts/product-evidence/run-d8k13-sec05-acl-synthetic-pg17.mjs [--check-files]");
  console.log("Requires cached postgres:17 and LOCAL Docker Linux engine. No external DB.");
  return;
 }
 assert.ok(args.length<=1&&args.every(x=>x==="--check-files"),
  "SEC05_UNKNOWN_ARG");
 const [seed,legacyCheck,hardenedCheck,aclCheck]=FIXTURES.map(read);
 const source=read(SOURCE);
 const fn=extractClaimFunction(source),oldFn=legacyVariant(fn);
 const tableBoundary="alter table public.recommendation_logs";
 const until=source.indexOf(tableBoundary);
 assert.ok(source.startsWith("begin;")&&until>0,
  "SEC05_EXPECTED_SOURCE_TABLE_PREFIX_MISSING");
 const tables=source.slice(0,until);
 assert.match(tables,/create table if not exists public\.anonymous_write_grants/);
 assert.match(tables,/create table if not exists public\.anonymous_write_grant_uses/);
 assert.ok(!tables.includes("public.recommendation_logs"),
  "SEC05_DEPENDENT_PRODUCT_TABLE_OUT_OF_SCOPE");
 assert.match(seed,/D8K13_SYNTHETIC_ACL_BASELINE_PASS/);
 assert.match(legacyCheck,/D8K13_SEC05_LEGACY_NULL_COUNTEREXAMPLE_AND_ROLLBACK_PASS/);
 assert.match(hardenedCheck,/D8K13_SEC05_HARDENED_NULL_MATRIX_ROLE_AND_RETRY_PASS/);
 assert.match(aclCheck,/D8K13_SYNTHETIC_RANKING_ACL_REVOKE_ROLLBACK_IDEMPOTENCE_PASS/);
 assert.notEqual(fn,oldFn);
 console.log("D8K13_SEC05_ACL_SYNTHETIC_CHECK_FILES_PASS");
 if(args.length)return;
 try{
  await startDocker();
  console.log("D8K13_SEC05_LOCAL_PG17_READY");
  const dbVersion=psql("SELECT current_setting('server_version_num')::integer/10000;");
  assert.match(dbVersion,/\b17\b/);
  const base=psql(seed);
  assert.match(base,/D8K13_SYNTHETIC_ACL_BASELINE_PASS/);
  psql(tables+"\nCOMMIT;\n");
  psql("ALTER TABLE public.anonymous_write_grants ENABLE ROW LEVEL SECURITY;\n"+
       "ALTER TABLE public.anonymous_write_grant_uses ENABLE ROW LEVEL SECURITY;\n"+
       "REVOKE ALL ON TABLE public.anonymous_write_grants,public.anonymous_write_grant_uses "+
       "FROM PUBLIC,anon,authenticated;\n"+
       "GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.anonymous_write_grants,"+
       "public.anonymous_write_grant_uses TO service_role;\n");
  psql(oldFn);
  const identity="public.claim_anonymous_write_grant(text,text,text,text,text,text)";
  psql("REVOKE ALL ON FUNCTION "+identity+" FROM PUBLIC,anon,authenticated;\n"+
       "GRANT EXECUTE ON FUNCTION "+identity+" TO service_role;\n");
  const legacy=psql(legacyCheck);
  assert.match(legacy,/D8K13_SEC05_LEGACY_NULL_COUNTEREXAMPLE_AND_ROLLBACK_PASS/);
  console.log("D8K13_SEC05_LEGACY_NULL_REPRODUCED_AND_ROLLBACK_PASS");
  psql(fn);
  const fixed=psql(hardenedCheck);
  assert.match(fixed,/D8K13_SEC05_HARDENED_NULL_MATRIX_ROLE_AND_RETRY_PASS/);
  console.log("D8K13_SEC05_HARDENED_NULL_MATRIX_AND_RETRY_PASS");
  const acl=psql(aclCheck);
  assert.match(acl,/D8K13_SYNTHETIC_RANKING_ACL_REVOKE_ROLLBACK_IDEMPOTENCE_PASS/);
  console.log("D8K13_SEC05_RANKING_MINIMAL_ACL_ROLLBACK_PASS");
  console.log("D8K13_SEC05_ACL_LOCAL_DOCKER_PG17_PASS");
 }finally{cleanup()}
}
main().catch(e=>{console.error("D8K13_SEC05_ACL_LOCAL_VERIFY_FAILED: "+e.message);process.exitCode=1;cleanup()});
