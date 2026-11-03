#!/usr/bin/env node
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {createCleanserSelectOnlyFetchV1,ALLOWED_CLEANSER_TABLES}
  from "../lib/trust/cleanser-hosted-select-only-transport-v1.mjs";

const base="https://trusted-audit.supabase.co";
let visited=[];
const stub=async (input,init)=>{
  visited.push({url:String(typeof input==="string"?input:input.url),...init});
  return {ok:true,status:200};
};
const transport=createCleanserSelectOnlyFetchV1({baseUrl:base,fetchImpl:stub});
for(const table of ALLOWED_CLEANSER_TABLES){
  const reply=await transport(base+"/rest/v1/"+table+"?select=id",{method:"GET"});
  assert.equal(reply.status,200);
}
assert.equal(visited.length,9);
assert.ok(visited.every(x=>x.method==="GET"&&x.redirect==="error"));
for(const url of [
  "https://untrusted.supabase.co/rest/v1/products?select=id",
  "http://trusted-audit.supabase.co/rest/v1/products",
  base+"/rest/v1/rpc/catalog_required_product_facts_v1",
  base+"/auth/v1/admin/users",
  base+"/storage/v1/object/public/file",
  base+"/rest/v1/unregistered_table",
  base+"/rest/v1/products/anything",
  base+"/rest/v1/products#frag",
  "https://user:password@trusted-audit.supabase.co/rest/v1/products",
]) await assert.rejects(transport(url,{method:"GET"}),/SELECT_ONLY_TABLE_GET_REQUIRED/);
for(const method of ["POST","PUT","PATCH","DELETE","OPTIONS","HEAD"]){
  await assert.rejects(transport(base+"/rest/v1/products",{method}),/SELECT_ONLY_TABLE_GET_REQUIRED/);
}
await assert.rejects(transport(base+"/rest/v1/products",{method:"GET",body:"payload"}),
  /SELECT_ONLY_TABLE_GET_REQUIRED/);
assert.equal(visited.length,9,"blocked requests must never reach transport");
assert.throws(()=>createCleanserSelectOnlyFetchV1({baseUrl:"http://untrusted.supabase.co",fetchImpl:stub}),
  /TRUSTED_HOSTED_SUPABASE_ORIGIN_REQUIRED/);
assert.throws(()=>createCleanserSelectOnlyFetchV1({baseUrl:base,fetchImpl:null}),
  /FETCH_IMPL_REQUIRED/);
const ids=Array.from({length:10},(_,n)=>"11111111-1111-4111-8111-"+String(n+1).padStart(12,"0"));
const processRun=(arg,env={})=>spawnSync(process.execPath,
  ["scripts/run-cleanser-ten-live-v1-v2-readonly-v1.mjs",arg],{
    encoding:"utf8",maxBuffer:20000,
    env:{...process.env,SUPABASE_URL:"",SUPABASE_SERVICE_ROLE_KEY:"",...env}
  });
const noEnv=processRun("--ids="+ids.join(","));
assert.notEqual(noEnv.status,0);
assert.match(noEnv.stderr,/AUTHORIZED_SERVER_CREDENTIALS_REQUIRED/);
assert.equal(noEnv.stdout,"");
const invalid=processRun("--ids="+ids[0]);
assert.notEqual(invalid.status,0);
assert.match(invalid.stderr,/TEN_DISTINCT_UUIDS_REQUIRED/);
assert.equal(invalid.stdout,"");
console.log("C4 hosted cleanser audit transport: PASS (GET whitelist only, no CI credentials, zero network writes)");
