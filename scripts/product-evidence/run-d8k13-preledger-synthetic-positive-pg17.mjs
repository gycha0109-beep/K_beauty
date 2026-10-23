#!/usr/bin/env node
// Synthetic-only PostgreSQL17 first-migration positive-path compatibility test.
// NEVER a historical bootstrap attestation or permission to apply a full chain.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const fixture=join(root,"tests/fixtures/r16i-d8k13/36_preledger_synthetic_base_pg17.sql");
const first=join(root,"supabase/migrations/20260410_safe_review_and_promotion_layer.sql");
if(process.argv.length!==3||process.argv[2]!=="--isolated-pg17")
 throw Error("D8K13_SYNTHETIC_PG17_OPT_IN_REQUIRED");
const env=process.env,host=env.PGHOST,port=env.PGPORT,db=env.PGDATABASE,user=env.PGUSER;
if(!["127.0.0.1","localhost","::1"].includes(host)||!/^\d{2,5}$/.test(port??"")||
 Number(port)<1024||Number(port)>65535)
 throw Error("D8K13_SYNTHETIC_LOCAL_LOOPBACK_ONLY");
if(db!=="d8k13_preledger_synthetic"||user!=="d8k13_fixture")
 throw Error("D8K13_SYNTHETIC_DISPOSABLE_DB_AND_USER_REQUIRED");
if(["DATABASE_URL","DIRECT_URL","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"].some(k=>k in env))
 throw Error("D8K13_SYNTHETIC_PRODUCTION_ENV_FORBIDDEN");
const childEnv={
 PATH:env.PATH,PGHOST:host,PGPORT:port,PGDATABASE:db,PGUSER:user,
 PGPASSWORD:env.PGPASSWORD||"",PGCONNECT_TIMEOUT:"5",
 PGOPTIONS:"-c statement_timeout=15000"
};
function run(args){
 const result=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1",...args],{
  env:childEnv,encoding:"utf8",timeout:60000,maxBuffer:500_000
 });
 if(result.error||result.status!==0)
  throw Error("D8K13_SYNTHETIC_PSQL_STAGE_FAILED: "+(result.error?.message||result.stderr||result.status));
 return result.stdout.trim();
}
const before=run(["-Atqc",
 "select current_setting('server_version_num')::int/10000,current_database(),current_user,to_regclass('public.products') is null,to_regclass('public.source_rankings') is null,to_regclass('public.product_candidates') is null"]);
assert.equal(before,"17|"+db+"|"+user+"|t|t|t","D8K13_SYNTHETIC_EMPTY_PG17_REQUIRED");
run(["-f",fixture]);
const ready=run(["-Atqc",
 "select (select count(*) from public.products),(select count(*) from public.product_candidates),(select count(*) from public.source_rankings),to_regtype('public.product_category') is null"]);
assert.equal(ready,"1|1|1|t","D8K13_SYNTHETIC_FIXTURE_PRECONDITION_FAILED");
run(["-f",first]);
const after=run(["-Atqc",`select
 (select count(*) from public.products),
 (select count(*) from public.product_candidates),
 (select count(*) from public.source_rankings),
 (select count(*) from public.product_candidate_evidence_summary),
 (select source_evidence_count from public.product_candidate_evidence_summary limit 1),
 (select best_rank_position from public.product_candidate_evidence_summary limit 1),
 (select normalized_name from public.products limit 1),
 (select normalized_brand from public.products limit 1),
 (select review_status::text from public.product_candidates limit 1),
 (select pg_typeof(category)::text from public.products limit 1),
 (select pg_typeof(texture)::text from public.products limit 1),
 (select pg_typeof(finish)::text from public.products limit 1),
 (select pg_typeof(skin_types)::text from public.products limit 1),
 to_regprocedure('public.promote_product_candidate(uuid,text)') is not null,
 to_regtype('public.product_review_status') is not null`]);
assert.equal(after,
 "1|1|1|1|1|1|synthetic fixture sunscreen|fixture brand|new|product_category|product_texture|product_finish|text[]|t|t",
 "D8K13_SYNTHETIC_POST_MIGRATION_CONTRACT_DRIFT: "+after);
const constraints=run(["-Atqc",
 "select count(*) from pg_constraint where conrelid='public.product_candidates'::regclass and conname='product_candidates_matched_product_id_fkey'"]);
assert.equal(constraints,"1","D8K13_SYNTHETIC_CANDIDATE_FK_ABSENT");
console.log(JSON.stringify({
 stage:"D8K13_PRELEDGER_SYNTHETIC_FIRST_MIGRATION_PG17",
 status:"SYNTHETIC_FIRST_MIGRATION_PASS",pgMajor:17,
 originalHistoricalBootstrapRecovered:false,syntheticFixtureOnly:true,
 exactFirstMigrationApplied:true,complete178MigrationReplayPassed:false,
 realProductionSchemaEquivalenceVerified:false,
 originalAclGrantHistoryAttested:false,productionDatabaseWrites:0,
 releaseAuthorized:false
}));
console.log("D8K13_PRELEDGER_SYNTHETIC_FIRST_MIGRATION_PG17_PASS");
