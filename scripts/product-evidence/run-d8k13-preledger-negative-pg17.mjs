#!/usr/bin/env node
// D8K13 isolated PG17 pre-ledger negative acceptance.
// This script only invokes psql against an explicitly supplied disposable PG database.
// NEVER supply production coordinates. No Supabase tokens, no network calls, no migrations written.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const first=join(root,"supabase/migrations/20260410_safe_review_and_promotion_layer.sql");
const args=process.argv.slice(2);
if(args.length!==1||args[0]!=="--isolated-pg17")
 throw Error("D8K13_ISOLATED_PG17_OPT_IN_REQUIRED");
const env=process.env;
const host=env.PGHOST,port=env.PGPORT,db=env.PGDATABASE,user=env.PGUSER;
if(!host||!port||!db||!user)
 throw Error("D8K13_DISPOSABLE_PG_COORDINATES_REQUIRED");
if(!["127.0.0.1","localhost","::1"].includes(host))
 throw Error("D8K13_ONLY_LOCAL_LOOPBACK_DATABASE");
if(!/^\d{2,5}$/.test(port)||Number(port)<1024||Number(port)>65535)
 throw Error("D8K13_INVALID_DISPOSABLE_PORT");
if(db!=="d8k13_preledger_disposable"||user!=="d8k13_fixture")
 throw Error("D8K13_FIXTURE_DATABASE_AND_USER_REQUIRED");
if("SUPABASE_URL" in env||"SUPABASE_SERVICE_ROLE_KEY" in env||"DATABASE_URL" in env)
 throw Error("D8K13_FORBIDDEN_SUPABASE_OR_EXTERNAL_DB_ENV");
const cliEnv={
 PATH:env.PATH,PGHOST:host,PGPORT:port,PGDATABASE:db,PGUSER:user,PGPASSWORD:env.PGPASSWORD||"",
 PGCONNECT_TIMEOUT:"5",PGOPTIONS:"-c statement_timeout=15000"
};
function psql(cmd){
 const r=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-Atqc",cmd],{
  env:cliEnv,encoding:"utf8",timeout:30000,maxBuffer:1_000_000
 });
 if(r.error||r.status!==0)throw Error("D8K13_ISOLATED_PSQL_PROBE_FAILED: "+(r.error?.message||r.stderr||r.status));
 return r.stdout.trim();
}
const before=psql("select current_setting('server_version_num')::int / 10000, current_database(), current_user, to_regclass('public.products') is null, to_regclass('public.product_candidates') is null, to_regclass('public.source_rankings') is null");
const components=before.split("|");
assert.equal(components.length,6,"D8K13_PG17_PROBE_SHAPE");
assert.equal(components[0],"17","D8K13_REQUIRE_PG17");
assert.equal(components[1],db);
assert.equal(components[2],user);
assert.deepEqual(components.slice(3),["t","t","t"],"D8K13_EMPTY_SCHEMA_PRECONDITION");
const attempt=spawnSync("psql",["-X","-v","ON_ERROR_STOP=1","-f",first],{
 env:cliEnv,encoding:"utf8",timeout:45000,maxBuffer:2_000_000
});
if(attempt.error)throw attempt.error;
assert.notEqual(attempt.status,0,"D8K13_PRELEDGER_NEGATIVE_UNEXPECTED_SQL_SUCCESS");
assert.match(attempt.stderr,/relation "public\.products" does not exist/,
 "D8K13_EXPECTED_FOUNDATIONAL_PRODUCTS_FAILURE_NOT_OBSERVED");
const after=psql("select to_regclass('public.products') is null, to_regclass('public.product_candidates') is null, to_regclass('public.source_rankings') is null, to_regtype('public.product_review_status') is null");
assert.equal(after,"t|t|t|t","D8K13_FAILED_FIRST_MIGRATION_LEFT_PARTIAL_SCHEMA");
console.log(JSON.stringify({
 stage:"D8K13_PRELEDGER_EMPTY_PG17_NEGATIVE_ACCEPTANCE",status:"EXPECTED_FAILURE_PASS",
 pgMajor:17,disposableDatabaseOnly:true,
 firstRecordedMigrationFailedDueToMissingProducts:true,
 transactionRollbackObserved:true,preexistingBootstrapRecovered:false,
 applied178Migrations:false,fullChainReplayPassed:false,
 hostedSqlExecuted:false,releaseAuthorized:false
 }));
console.log("D8K13_PRELEDGER_ISOLATED_PG17_EXPECTED_FAILURE_PASS");
