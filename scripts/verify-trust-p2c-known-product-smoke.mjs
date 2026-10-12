#!/usr/bin/env node
import assert from "node:assert/strict";
import {
 probeTrustP2CProduct,VERIFIED_BASELINE,runTrustP2CProductCli,
} from "./trust-p2c-known-product-smoke.mjs";

assert.equal((await probeTrustP2CProduct()).status,"PLAN_ONLY");
let calls=0;
const html=Buffer.from('<!doctype html><title>다이브인 무기자차 마일드 선크림 60ml - 토리든</title>');
const mocks={
 async fetchRobots(url){calls++;assert.equal(url,VERIFIED_BASELINE.origin+"/robots.txt");
  return {bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url};},
 async fetchPage(url,policy){calls++;assert.equal(url,VERIFIED_BASELINE.locator);
  assert.ok(policy.allowed(url));return {bytes:html,finalUrl:url};},
};
const got=await probeTrustP2CProduct({execute:true,...mocks});
assert.equal(got.status,"TITLE_NAME_CANDIDATE");
assert.equal(got.requests,2);
assert.equal(calls,2);
assert.equal(got.marketVerified,false);
assert.equal(got.formulationVerified,false);
assert.equal(got.newProductIdentityVerified,false);
assert.equal(got.factConfirmationAuthorized,false);
assert.equal(got.productFactWrites,0);
assert.equal(got.dbWrites,0);
assert.equal(got.knownNameVisibleInNonScriptText,true);
assert.equal(got.evidenceAdmissionAuthorized,false);
assert.equal(got.pageDigest.length,64);
assert.equal("pageContent" in got,false);
const scriptOnly=await probeTrustP2CProduct({execute:true,
 ...mocks,fetchPage:async url=>({
   bytes:Buffer.from('<title>Generic brand shop</title><script>var name="다이브인 무기자차 마일드 선크림";</script>'),
   finalUrl:url,
 }),
});
assert.equal(scriptOnly.knownNameVisibleInNonScriptText,false);
assert.equal(scriptOnly.metadataTitleMatched,false);
const blocked=await probeTrustP2CProduct({execute:true,
 fetchRobots:async url=>({bytes:Buffer.from("User-agent: *\nDisallow: /goods/\n"),finalUrl:url}),
 fetchPage:async()=>{throw Error("unexpected HTTP");},
});
assert.equal(blocked.status,"ROBOTS_HOLD");
assert.equal(blocked.requests,1);
const noRobots=await probeTrustP2CProduct({execute:true,
 fetchRobots:async()=>{throw Error("SOURCE_BLOCKED:http_403");},
 fetchPage:async()=>{throw Error("unexpected HTTP");},
});
assert.equal(noRobots.status,"ROBOTS_UNAVAILABLE");
assert.equal(noRobots.requests,1);
const wrongPage=await probeTrustP2CProduct({execute:true,
 ...mocks,fetchPage:async()=>({bytes:html,finalUrl:"https://elsewhere.example/"}),
});
assert.equal(wrongPage.status,"REQUEST_FAILED");
const value=process.env.TRUST_P2C_PRODUCT_LIVE_ENABLED;
delete process.env.TRUST_P2C_PRODUCT_LIVE_ENABLED;
try {
 await assert.rejects(()=>runTrustP2CProductCli(["--execute"]),
  /TRUST_P2C_PRODUCT_LIVE_DISABLED/);
} finally {
 if(value===undefined)delete process.env.TRUST_P2C_PRODUCT_LIVE_ENABLED;
 else process.env.TRUST_P2C_PRODUCT_LIVE_ENABLED=value;
}
console.log("TRUST_P2C_KNOWN_PRODUCT_LIVE_GUARD_PASS");
