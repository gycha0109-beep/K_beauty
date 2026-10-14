#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {validateTrustP3LocatorCohort,observeTrustP3LocatorFreshness,
  runTrustP3LocatorCli} from "./trust-p3-official-locator-revalidation.mjs";
const cohort=JSON.parse(fs.readFileSync("evidence/trust/p3-official-locator-revalidation-cohort-v1.json","utf8"));
assert.equal(validateTrustP3LocatorCohort(cohort),true);
const changed=structuredClone(cohort);
changed.targets[0].locators[1].url="https://example.com/not-governed";
assert.throws(()=>validateTrustP3LocatorCohort(changed),/P3_LOCATOR_POLICY_OR_VARIANT_HOLD/);
changed.targets[0].locators[1].url=cohort.targets[0].locators[1].url;
changed.targets[0].locators[1].indexedTitleSizeMl=100;
assert.throws(()=>validateTrustP3LocatorCohort(changed),/P3_LOCATOR_POLICY_OR_VARIANT_HOLD/);
changed.targets[0].locators[1].indexedTitleSizeMl=60;
changed.authority.automaticPromotion=true;
assert.throws(()=>validateTrustP3LocatorCohort(changed),/P3_LOCATOR_COHORT_INVALID/);
const plan=await observeTrustP3LocatorFreshness({cohort});
assert.equal(plan.mode,"PLAN_ONLY_NO_NETWORK");
assert.equal(plan.summary.locators,6);
assert.equal(plan.summary.dbWrites,0);
assert.equal(plan.summary.readOnlyFunnel.denominators.officialLocators,6);
assert.equal(plan.summary.readOnlyFunnel.stageCounts.NOT_EXECUTED,6);
assert.equal(plan.summary.readOnlyFunnel.policyEligibilityAuthorized,false);
assert.equal(plan.summary.aiApiCalls,0);
const events=[];
const live=await observeTrustP3LocatorFreshness({
  execute:true,cohort,
  fetchRobots:async(url,origin)=>{
    events.push({kind:"robots",origin,url});
    assert.equal(url,origin+"/robots.txt");
    return {bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url};
  },
  fetchProduct:async(url,origin,policy)=>{
    events.push({kind:"page",origin,url});
    assert.equal(new URL(url).origin,origin);
    assert.equal(policy.allowed(url),true);
    const target=cohort.targets.find(t=>t.locators.some(loc=>loc.url===url));
    const name=target.catalogNameEn??target.catalogName;
    const text=name+" "+target.sizeMl+"ml";
    return {bytes:Buffer.from("<title>"+text+"</title><main><h1>"+
      text+"</h1><section data-product-specs>SPF50+ PA++++</section></main>"),
      contentType:"text/html; charset=utf-8",finalUrl:url};
  },
});
assert.equal(events.filter(x=>x.kind==="robots").length,4);
assert.equal(events.filter(x=>x.kind==="page").length,6);
assert.equal(live.items.length,6);
assert.equal(live.summary.dbWrites,0);
assert.equal(live.summary.factWrites,0);
assert.equal(live.summary.subjectWrites,0);
assert.equal(live.summary.verifiedExactSkuCount,0);
assert.equal(live.summary.productCandidates,6);
assert.equal(live.summary.readOnlyFunnel.denominators.officialLocators,6);
assert.equal(live.summary.readOnlyFunnel.denominators.htmlFetched,6);
assert.equal(live.summary.readOnlyFunnel.existingP3ReviewCandidates,6);
assert.equal(live.summary.readOnlyFunnel.explicitSelectedSizeMatchObserved,0);
assert.equal(live.summary.readOnlyFunnel.policyEligibilityAuthorized,false);
assert.equal(live.summary.readOnlyFunnel.factWrites,0);
assert.ok(live.items.every(x=>x.readOnlyFunnel.exactSkuVerified===false));
assert.ok(live.items.every(x=>x.readOnlyFunnel.policyEligibilityAuthorized===false));
assert.ok(live.items.every(x=>x.live.exactSkuVerified===false));
assert.ok(live.items.every(x=>x.live.templateShape.contract==="trust-p3-template-shape-v1"));
assert.ok(live.items.every(x=>x.live.templateShape.templateFamily==="UNDETERMINED"));
assert.ok(live.items.every(x=>x.live.templateShape.factConfirmationAuthorized===false));
assert.ok(live.items.every(x=>x.live.templateShape.dbWrites===0));
assert.ok(live.items.every(x=>x.live.templateShape.aiApiCalls===0));
assert.ok(live.items.every(x=>x.live.templateShape.primaryTitleSurfaces.h1WithinMain===1));
assert.ok(!JSON.stringify(live).includes("selected value"));

assert.ok(!JSON.stringify(live).includes("data-product-specs"));
const disallowed=await observeTrustP3LocatorFreshness({
  execute:true,cohort,
  fetchRobots:async(url)=>({bytes:Buffer.from("User-agent: *\nDisallow: /\n"),finalUrl:url}),
  fetchProduct:async()=>{throw Error("ROBOTS_BYPASS");},
});
assert.equal(disallowed.summary.outcomes.SOURCE_POLICY_HOLD,6);
assert.equal(disallowed.summary.readOnlyFunnel.stageCounts.SOURCE_HOLD,6);
const blocked=await observeTrustP3LocatorFreshness({
  execute:true,cohort,
  fetchRobots:async()=>{throw Error("SOURCE_BLOCKED:policy");},
  fetchProduct:async()=>{throw Error("UNAUTHORIZED");},
});
assert.equal(blocked.summary.outcomes.ROBOTS_UNAVAILABLE,6);
assert.equal(blocked.summary.readOnlyFunnel.stageCounts.SOURCE_HOLD,6);
const prior=process.env.TRUST_P3_LOCATOR_LIVE_ENABLED;
delete process.env.TRUST_P3_LOCATOR_LIVE_ENABLED;
try{await assert.rejects(()=>runTrustP3LocatorCli(["--execute"]),/P3_LOCATOR_LIVE_DISABLED/);}
finally{if(prior===undefined)delete process.env.TRUST_P3_LOCATOR_LIVE_ENABLED;
  else process.env.TRUST_P3_LOCATOR_LIVE_ENABLED=prior;}
const source=fs.readFileSync("scripts/trust-p3-official-locator-revalidation.mjs","utf8").toLowerCase();
for(const forbidden of [".insert(", ".upsert(", ".update(", ".delete(", ".rpc(",
  "supabase_service_role_key","gemini","openai"])assert.ok(!source.includes(forbidden),forbidden);
console.log("TRUST_P3_LOCATOR_REVALIDATION_POLICY_PASS");
