#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
  FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF,
  inspectFaceLabProductionIdentity
} from "../lib/face-lab-v2/production-identity-readback-core.mjs";

const url="https://"+FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF+".supabase.co";
let cases=0;
async function test(label,fn){await fn();cases++;}

await test("valid response is still HOLD",async()=>{
  let calls=0;
  const r=await inspectFaceLabProductionIdentity({
    environment:"production",configuredSupabaseUrl:url,
    probeReadOnly:async()=>{calls++;return {status:200,data:null,error:null};}
  });
  assert.equal(calls,1);
  assert.equal(r.status,"HOLD");
  assert.equal(r.serverProjectMatch,true);
  assert.equal(r.dbHeadReadback,"ok");
  assert.equal(r.probeExecuted,true);
  assert.equal(r.productionProjectIdentityVerified,false);
  assert.equal(r.migrationHistoryVerified,false);
  assert.equal(r.runtimeAuthorizationVerified,false);
  assert.equal(r.productionReady,false);
  assert.ok(!JSON.stringify(r).includes(url));
  assert.ok(!JSON.stringify(r).includes(FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF));
});
await test("preview deployment never performs HEAD",async()=>{
  let calls=0;
  const r=await inspectFaceLabProductionIdentity({
    environment:"preview",configuredSupabaseUrl:url,
    probeReadOnly:async()=>{calls++;throw Error("should not run");}
  });
  assert.equal(calls,0);
  assert.equal(r.serverProjectMatch,null);
  assert.equal(r.dbHeadReadback,"skipped");
});
await test("different server ref never performs HEAD",async()=>{
  let calls=0;
  const r=await inspectFaceLabProductionIdentity({
    environment:"production",configuredSupabaseUrl:"https://aaaaaaaaaaaaaaaaaaaa.supabase.co",
    probeReadOnly:async()=>{calls++;return {status:200,error:null};}
  });
  assert.equal(calls,0);
  assert.equal(r.serverProjectMatch,false);
  assert.equal(r.reason,"project_ref_mismatch");
});
await test("malformed or credentialed URLs are never used",async()=>{
  for(const value of [
    null,"not-url","http://"+FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF+".supabase.co",
    "https://u:p@"+FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF+".supabase.co",
    url+"?key=secret",url+"#fragment",url+":8443","https://example.com",
    url+"/path","https://"+FACE_LAB_PUBLIC_BUNDLE_SUPABASE_REF+".supabase.co.evil.invalid"
  ]){
    let calls=0;
    const r=await inspectFaceLabProductionIdentity({
      environment:"production",configuredSupabaseUrl:value,
      probeReadOnly:async()=>{calls++;return {status:200,error:null};}
    });
    assert.equal(calls,0,String(value));
    assert.equal(r.dbHeadReadback,"skipped");
    assert.equal(r.status,"HOLD");
  }
});
await test("missing read callback is fail closed",async()=>{
  const r=await inspectFaceLabProductionIdentity({
    environment:"production",configuredSupabaseUrl:url
  });
  assert.equal(r.probeExecuted,false);
  assert.equal(r.reason,"readback_not_available");
});
await test("HTTP errors or thrown exceptions remain HOLD",async()=>{
  for(const callback of [
    async()=>({status:503,error:{code:"db-error",details:"secret"}}),
    async()=>({status:200,error:{message:"secret"}}),
    async()=>({status:500,error:null}),
    async()=>({status:200,error:null,data:[],notRelevant:"secret",headers:{}}),
    async()=>{throw Error("do not leak project url or secret")}
  ]){
    const r=await inspectFaceLabProductionIdentity({
      environment:"production",configuredSupabaseUrl:url,
      probeReadOnly:callback
    });
    assert.equal(r.status,"HOLD");
    assert.equal(r.probeExecuted,true);
    assert.equal(r.productionReady,false);
    assert.ok(!JSON.stringify(r).includes("secret"));
  }
});
// The object-only callback intentionally accepts only result.status & error.
// An unauthorized result must never convert to PASS.
await test("suspicious callback output never changes operational HOLD",async()=>{
  for(const value of [null,undefined,{},true,42,"ok",{status:401,error:null}]){
    const r=await inspectFaceLabProductionIdentity({
      environment:"production",configuredSupabaseUrl:url,
      probeReadOnly:async()=>value
    });
    assert.equal(r.status,"HOLD");
    assert.equal(r.dbHeadReadback,"failed");
  }
});
await test("route contract: owner audit gate precedes service role query",async()=>{
  const route=readFileSync(new URL(
    "../app/api/admin/face-lab/production-identity/route.js",import.meta.url
  ),"utf8");
  assert.ok(route.includes("requireAdminCapability(ADMIN_CAPABILITIES.AUDIT_READ)"));
  assert.ok(route.includes('process.env.VERCEL_ENV !== "production"'));
  assert.ok(route.includes(".select(\"face_lab_revision\", {head:true}).limit(0)"));
  assert.ok(route.includes('\"Cache-Control\": \"private, no-store, max-age=0\"'));
  assert.ok(route.includes('\"CDN-Cache-Control\": \"no-store\"'));
  assert.ok(route.includes('\"Vercel-CDN-Cache-Control\": \"no-store\"'));
  assert.ok(!route.includes("SUPABASE_SERVICE_ROLE_KEY"));
  assert.ok(!route.includes("serverProjectRef:"));
  assert.ok(!route.includes("console.log"));
  for(const pattern of [/\bexport\s+async\s+function\s+POST\b/,
    /\.insert\(/,/\.update\(/,/\.delete\(/, /\.upsert\(/, /\.rpc\(/])
    assert.doesNotMatch(route,pattern);
  const requireAt=route.indexOf("requireAdminCapability(ADMIN_CAPABILITIES.AUDIT_READ)");
  const configAt=route.indexOf("getSupabaseAdminConfig()");
  const readAt=route.indexOf("createSupabaseAdminClient()");
  assert.ok(requireAt>=0&&requireAt<configAt&&configAt<readAt);
});
console.log(JSON.stringify({status:"PASS",cases,productionIdentityConfirmed:false,
  databaseCalls:0,productionReadiness:"HOLD"}));
