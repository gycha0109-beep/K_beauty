#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { inspectTrustP3OfficialPageShape } from "../lib/trust/official-product-page-shape-p3-v1.mjs";
import {assertTrustP3Cohort,observeTrustP3OfficialThreeBrand,runTrustP3ThreeBrandCli}
  from "./trust-p3-official-three-brand-pilot.mjs";
const cohort=JSON.parse(fs.readFileSync("evidence/trust/p3-official-three-brand-live-cohort-v1.json","utf8"));
assert.equal(assertTrustP3Cohort(cohort),true);
const duplicate=structuredClone(cohort);
duplicate.targets[1].sourceKind="hwahae_review";
assert.throws(()=>assertTrustP3Cohort(duplicate),/TRUST_P3_LIVE_COHORT_UNGOVERNED/);
const dry=await observeTrustP3OfficialThreeBrand({execute:false,cohort});
assert.equal(dry.summary.attempted,0);
assert.equal(dry.summary.aiApiCalls,0);
assert.equal(dry.summary.dbWrites,0);
assert.equal(dry.items.length,3);
const requests=[];
const fetched=await observeTrustP3OfficialThreeBrand({
 execute:true,cohort,
 fetchRobots:async(url,origin)=>{
   requests.push(["robots",url]);
   assert.equal(url,origin+"/robots.txt");
   return {bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url};
 },
 fetchProduct:async(url,origin,policy)=>{
   requests.push(["product",url]);
   assert.equal(new URL(url).origin,origin);
   assert.equal(policy.allowed(url),true);
   const t=cohort.targets.find(t=>t.officialUrl===url);
   const name=t.nameEn??t.name;
   const label=name+" "+t.sizeMl+"ml";
   const html="<title>"+label+"</title><main><h1>"+label+"</h1>"+
      "<section data-product-specs>SPF50+ PA++++ / 무기자차</section></main>";
   return {bytes:Buffer.from(html),finalUrl:url};
 },
});
assert.deepEqual(requests.map(x=>x[0]),["robots","product","robots","product","robots","product"]);
assert.equal(fetched.summary.eligibleCandidatePages,3);
assert.equal(fetched.summary.observedDirectSpf,3);
assert.equal(fetched.summary.observedDirectPa,3);
assert.equal(fetched.summary.dbWrites,0);
assert.equal(fetched.summary.subjectWrites,0);
assert.equal(fetched.summary.factWrites,0);
assert.equal(fetched.summary.aiApiCalls,0);
assert.equal(fetched.items[0].evidence.fields.spf.value,"SPF50+");

assert.equal(fetched.items[0].pageShape.titleNameMatch,true);
assert.equal(fetched.items[0].pageShape.h1Count,1);
assert.equal(fetched.items[0].pageShape.factConfirmationAuthorized,false);
const diagnosticTarget={id:cohort.targets[0].productId,name:cohort.targets[0].name};
const scriptOnly='<title>Just a moment...</title><script>const x="'+diagnosticTarget.name+'";</script>';
const shape=inspectTrustP3OfficialPageShape(Buffer.from(scriptOnly),diagnosticTarget,
  {contentType:"text/html; charset=utf-8"});
assert.equal(shape.likelyChallengeTitle,true);
assert.equal(shape.scriptNameMention,true);
assert.equal(shape.visibleTextNameMention,false);
assert.equal(shape.exactSkuVerified,false);
assert.equal(shape.declaredCharset,"utf-8");
const oddCharset=inspectTrustP3OfficialPageShape(Buffer.from("<title>Other</title>"),
  diagnosticTarget,{contentType:"text/html; charset=euc-kr"});
assert.equal(oddCharset.declaredCharset,"euc-kr");
assert.equal(oddCharset.titleNameMatch,false);

assert.equal(fetched.fullyVerifiedExactSkuCount,0);
assert.ok(!JSON.stringify(fetched).includes("data-product-specs"));
let pageRequests=0;
const blocked=await observeTrustP3OfficialThreeBrand({
 execute:true,cohort,
 fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nDisallow: /\n"),finalUrl:url}),
 fetchProduct:async()=>{pageRequests++;throw Error("POLICY_BYPASS");},
});
assert.equal(pageRequests,0);
assert.equal(blocked.summary.states.SOURCE_POLICY_HOLD,3);
const unavailable=await observeTrustP3OfficialThreeBrand({
 execute:true,cohort,
 fetchRobots:async()=>{throw Error("SOURCE_BLOCKED:robots_unavailable");},
 fetchProduct:async()=>{throw Error("UNAUTHORIZED_REQUEST");},
});
assert.equal(unavailable.summary.states.ROBOTS_UNAVAILABLE,3);
const prev=process.env.TRUST_P3_OFFICIAL_LIVE_ENABLED;
delete process.env.TRUST_P3_OFFICIAL_LIVE_ENABLED;
try{await assert.rejects(()=>runTrustP3ThreeBrandCli(["--execute"]),/TRUST_P3_LIVE_DISABLED/);}
finally{
  if(prev===undefined)delete process.env.TRUST_P3_OFFICIAL_LIVE_ENABLED;
  else process.env.TRUST_P3_OFFICIAL_LIVE_ENABLED=prev;
}
const source=fs.readFileSync("scripts/trust-p3-official-three-brand-pilot.mjs","utf8");
for(const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(",
  "SUPABASE_SERVICE_ROLE_KEY","openai","gemini"]){
 assert.ok(!source.toLowerCase().includes(forbidden.toLowerCase()),forbidden);
}
console.log("TRUST_P3_LIVE_COHORT_POLICY_READ_ONLY_PASS");
