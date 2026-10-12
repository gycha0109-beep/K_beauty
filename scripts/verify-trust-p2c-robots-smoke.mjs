#!/usr/bin/env node
import assert from "node:assert/strict";
import { probeTrustP2CRobots,runTrustP2CCommand,TRUST_P2C_OFFICIAL_ORIGIN } from "./trust-p2c-robots-smoke.mjs";
const no=await probeTrustP2CRobots({});
assert.equal(no.status,"PLAN_ONLY");assert.equal(no.requests,0);
let calls=0;
const good=await probeTrustP2CRobots({execute:true,fetchRobots:async url=>{
 calls++;assert.equal(url,TRUST_P2C_OFFICIAL_ORIGIN+"/robots.txt");
 return {bytes:Buffer.from("User-agent: *\nAllow: /\n"),finalUrl:url};
}});
assert.equal(calls,1);assert.equal(good.status,"ROBOTS_PERMIT_PATHS");
assert.equal(good.productPagesRequested,0);
assert.equal(good.sourceConfirmed,false);
assert.equal(good.robotsDigest.length,64);
const hold=await probeTrustP2CRobots({execute:true,fetchRobots:async url=>({
 bytes:Buffer.from("User-agent: *\nDisallow: /goods\n"),
 finalUrl:url,
})});
assert.equal(hold.status,"ROBOTS_RESTRICTED");
assert.equal(hold.productAllowed,false);
const delay=await probeTrustP2CRobots({execute:true,fetchRobots:async url=>({
 bytes:Buffer.from("User-agent: *\nCrawl-delay: 5\n"),
 finalUrl:url,
})});
assert.equal(delay.status,"CRAWL_DELAY_HOLD");
const missing=await probeTrustP2CRobots({execute:true,fetchRobots:async()=>{throw new Error("SOURCE_BLOCKED:http_404");}});
assert.equal(missing.status,"ROBOTS_ACCESS_BLOCKED");
const offline=await probeTrustP2CRobots({execute:true,fetchRobots:async()=>{throw new Error("TRANSIENT_FAILURE:fetch_error");}});
assert.equal(offline.status,"NETWORK_UNAVAILABLE");
const redirected=await probeTrustP2CRobots({execute:true,fetchRobots:async()=>({
 bytes:Buffer.from("User-agent: *\nAllow: /\n"),
 finalUrl:"https://evil.example.test/robots.txt",
})});
assert.equal(redirected.status,"ROBOTS_FETCH_FAILED");
await assert.rejects(()=>runTrustP2CCommand(["--execute"]),/TRUST_P2C_LIVE_DISABLED/);
await assert.rejects(()=>runTrustP2CCommand(["--unsafe"]),/TRUST_P2C_UNSUPPORTED_FLAG/);
console.log("TRUST_P2C_LIVE_ROBOTS_POLICY_CONTRACT_PASS");
