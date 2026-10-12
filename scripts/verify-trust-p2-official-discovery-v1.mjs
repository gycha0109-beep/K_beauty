#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createTrustRobotsPolicy,strictOriginTransport,runTrustP2Discovery,
  classifyTrustOfficialCandidatePage,
} from "../lib/trust/official-product-discovery-p2-v1.mjs";
import { runTrustP2Cli } from "./trust-p2-official-discovery.mjs";

const product={id:"4608b3b4-8b51-4464-b46e-380b05c1a3d7",
  name:"New Cream",name_en:"New Cream",normalized_name:"new cream"};
const row={
  intakeId:"0b5963bb-67d6-4738-a620-32ec86c1e3d0",
  productId:product.id,status:"BRAND_OFFICIAL_DISCOVERY_SEEDS",
  discoveryOrigins:[{origin:"https://example-brand.test",
    sourceCount:1,evidenceRefs:[]}],
};
const robots=Buffer.from("User-agent: *\nDisallow: /private/\nDisallow: /products/old\nAllow: /products/new-cream\n");
const policy=createTrustRobotsPolicy(robots);
assert.equal(policy.allowed("https://example-brand.test/sitemap.xml"),true);
assert.equal(policy.allowed("https://example-brand.test/private/area"),false);
assert.equal(policy.allowed("https://example-brand.test/products/old-version"),false);
assert.equal(policy.allowed("https://example-brand.test/products/new-cream"),true);
assert.equal(createTrustRobotsPolicy(Buffer.from("User-agent: BEJEWELY-Trust-Research\nDisallow: /\nUser-agent: *\nAllow: /\n"))
  .allowed("https://example-brand.test/sitemap.xml"),false);
const delay=createTrustRobotsPolicy(Buffer.from("User-agent: *\nCrawl-delay: 10\nAllow: /\n"));
assert.equal(delay.delayBlocked,true);
assert.equal(delay.allowed("https://example-brand.test/sitemap.xml"),false);
assert.equal(createTrustRobotsPolicy(Buffer.from("User-agent: *\nDisallow: /*?secret=$\n"))
  .allowed("https://example-brand.test/product?secret="),false);
const html=Buffer.from(`<!doctype html><title>New Cream - Example Brand</title>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"New Cream"}</script>`);
const validated=classifyTrustOfficialCandidatePage(html,product);
assert.equal(validated.status,"STRUCTURED_NAME_CANDIDATE");
assert.equal(validated.marketVerified,false);
assert.equal(validated.subjectCreationAuthorized,false);
assert.equal(validated.factConfirmationAuthorized,false);
const unrelated=classifyTrustOfficialCandidatePage(Buffer.from("<title>Unrelated lotion</title>"),product);
assert.equal(unrelated.status,"IDENTITY_UNRESOLVED");

const sitemap=Buffer.from(`<?xml version="1.0"?><urlset>
<url><loc>https://example-brand.test/products/new-cream</loc></url>
<url><loc>https://example-brand.test/private/new-cream</loc></url>
<url><loc>https://another-brand.test/products/new-cream</loc></url></urlset>`);
const requests=[];
const mock={
 async fetchRobots(url,origin){
   requests.push(["robots",url]);
   assert.equal(origin,"https://example-brand.test");
   return {bytes:robots,finalUrl:url};
 },
 async fetchSitemap(url,origin,policy){
   requests.push(["sitemap",url]);
   assert.ok(policy.allowed(url));assert.equal(origin,"https://example-brand.test");
   if(url.endsWith("/sitemap_index.xml"))throw Error("SOURCE_BLOCKED:404");
   return {bytes:sitemap,finalUrl:url};
 },
 async fetchPage(url,origin,policy){
   requests.push(["page",url]);
   assert.equal(origin,"https://example-brand.test");
   assert.ok(policy.allowed(url));
   return {bytes:html,finalUrl:url};
 },
};
const result=await runTrustP2Discovery(row,product,mock);
assert.deepEqual(requests.map(x=>x[0]),["robots","sitemap","sitemap","page"]);
assert.equal(result.sites[0].status,"CANDIDATES_DISCOVERED");
assert.equal(result.sites[0].pages.length,1);
assert.equal(result.sites[0].pages[0].status,"STRUCTURED_NAME_CANDIDATE");
assert.equal(result.officialProductEvidenceConfirmed,false);
assert.equal(result.factWrites,0);
assert.equal(result.recommendationWrites,0);
assert.equal(result.aiApiCalls,0);
assert.equal(result.subjectCreationAuthorized,false);

const denies=await runTrustP2Discovery(row,product,{
 ...mock,async fetchRobots(){throw Error("SOURCE_BLOCKED:robots_missing");},
 async fetchSitemap(){throw Error("SITEMAP_MUST_NOT_BE_FETCHED");},
 async fetchPage(){throw Error("PAGE_MUST_NOT_BE_FETCHED");},
});
assert.equal(denies.sites[0].status,"ROBOTS_UNAVAILABLE");
assert.equal(denies.sites[0].pages.length,0);
const blockedSite=await runTrustP2Discovery(row,product,{
 ...mock,async fetchRobots(){return {bytes:Buffer.from("User-agent: *\nDisallow: /\n")};},
 async fetchSitemap(){throw Error("SITEMAP_MUST_NOT_BE_FETCHED");},
 async fetchPage(){throw Error("PAGE_MUST_NOT_BE_FETCHED");},
});
assert.equal(blockedSite.sites[0].status,"ROBOTS_DISALLOWED");
const paced=await runTrustP2Discovery(row,product,{
 ...mock,async fetchRobots(){return {bytes:Buffer.from("User-agent: *\nCrawl-delay: 15\n")};},
 async fetchSitemap(){throw Error("SITEMAP_MUST_NOT_BE_FETCHED");},
 async fetchPage(){throw Error("PAGE_MUST_NOT_BE_FETCHED");},
});
assert.equal(paced.sites[0].status,"CRAWL_DELAY_NOT_SUPPORTED");

let calls=0;
const mockedFetch=async()=>{calls++;return new Response("",{status:302,headers:{location:"https://evil.test/"}});};
const guarded=strictOriginTransport(mockedFetch,"https://example-brand.test",policy);
await assert.rejects(()=>guarded(new URL("https://evil.test/"),{}),
 /TRUST_P2_ORIGIN_OR_ROBOTS_BLOCKED/);
await assert.rejects(()=>guarded(new URL("https://example-brand.test/private/data"),{}),
 /TRUST_P2_ORIGIN_OR_ROBOTS_BLOCKED/);
assert.equal(calls,0);
assert.equal((await guarded(new URL("https://example-brand.test/products/new-cream"),{})).status,403);
assert.equal(calls,1);
await assert.rejects(()=>runTrustP2Cli(["--product-id="+product.id,"--execute"]),
 /TRUST_P2_LIVE_DISABLED/);

const cli=fs.readFileSync("scripts/trust-p2-official-discovery.mjs","utf8");
const worker=fs.readFileSync("lib/trust/official-product-discovery-p2-v1.mjs","utf8");
for(const token of [
 "TRUST_P2_LIVE_DISCOVERY_ENABLED","--execute",
 "SUBJECT_CREATION_REQUIRED","product_evidence_source_subject_bindings",
 "product_evidence_sources"
])assert.ok(cli.includes(token));
for(const forbidden of [".insert(", ".update(", ".upsert(", ".delete(", ".rpc(",
 "openai","gemini"]) {
 assert.ok(!worker.toLowerCase().includes(forbidden),"worker unauthorized "+forbidden);
 assert.ok(!cli.toLowerCase().includes(forbidden),"cli unauthorized "+forbidden);
}
assert.ok(worker.includes("createTrustRobotsPolicy"));
assert.ok(worker.includes("discoverOfficialSourceCandidates"));
console.log("TRUST_P2_POLICY_GATED_DISCOVERY_PASS");
