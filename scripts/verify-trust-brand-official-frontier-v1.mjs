#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 planTrustBrandOfficialFrontier as plan,
 buildTrustOfficialDiscoveryRequests as requests,
} from "../lib/trust/brand-official-frontier-v1.mjs";
const t="4608b3b4-8b51-4464-b46e-380b05c1a3d7";
const known="0b5963bb-67d6-4738-a620-32ec86c1e3d0";
const subject="02bba165-1f52-4a13-8e83-4f57f3383840";
const otherBrand="a26a9cda-f084-4d42-a195-9d8b6c98c248";
const intakeId="6d1d63e4-fbd7-4304-a0e1-9a90fcbf9c1c";
const bindingId="4e2ee3d9-e088-452e-b05f-d351f1c92c14";
const sourceId="97d5e17d-ae04-4d90-89ec-3fd60d5357e3";
const base={
 backlog:[{id:intakeId,product_id:t,identity_state:"SUBJECT_CREATION_REQUIRED",trust_state:"REVIEW_REQUIRED"}],
 products:[
  {id:t,normalized_brand:"브랜드A",name:"신제품 크림",name_en:"New Cream"},
  {id:known,normalized_brand:"브랜드a",name:"기존 로션"},
  {id:otherBrand,normalized_brand:"경쟁브랜드",name:"다른 상품"},
 ],
 bindings:[{binding_id:bindingId,product_id:known,subject_id:subject,
  source_id:sourceId,binding_state:"exact_subject_match",scope_relation:"equivalent"}],
 sources:[{source_id:sourceId,source_kind:"brand_official_product_page",
  canonical_locator:"https://official-example.test/products/known"}],
};
const r=plan(base);
assert.equal(r.total,1);
assert.equal(r.withSeeds,1);
assert.equal(r.items[0].discoveryOrigins[0].origin,"https://official-example.test");
assert.equal(r.items[0].marketVerified,false);
assert.equal(r.items[0].subjectCreationAuthorized,false);
assert.equal(r.mutationPolicy,"DISCOVERY_ONLY_NO_DB_WRITE");
assert.equal(r.aiApiCalls,0);
const request=requests(r.items[0],base.products[0]);
assert.equal(request[0].allowed_hosts[0],"official-example.test");
assert.deepEqual(request[0].discovery_surfaces.map(x=>x.kind),["sitemap","sitemap"]);
assert.ok(!JSON.stringify(request).includes("confirmed"));
assert.throws(()=>requests(r.items[0],base.products[1]),/TRUST_FRONTIER_NO_DISCOVERY_SEEDS/);
for(const mod of [
 {bindings:base.bindings.map(b=>({...b,binding_state:"unreviewed"}))},
 {bindings:base.bindings.map(b=>({...b,scope_relation:"narrower"}))},
 {sources:base.sources.map(s=>({...s,source_kind:"third_party_review"}))},
 {sources:base.sources.map(s=>({...s,canonical_locator:"https://www.hwahae.com/product"}))},
 {sources:base.sources.map(s=>({...s,canonical_locator:"http://official-example.test/products/known"}))},
 {sources:base.sources.map(s=>({...s,canonical_locator:"https://127.0.0.1/products/known"}))},
 {products:base.products.map(p=>p.id===known?{...p,normalized_brand:"다른브랜드"}:p)},
 {bindings:base.bindings.map(b=>({...b,product_id:t}))},
]) {
 const x=plan({...base,...mod});
 assert.equal(x.withSeeds,0,"untrusted source must never seed");
 assert.equal(x.items[0].subjectCreationAuthorized,false);
}
assert.throws(()=>plan({...base,products:[...base.products,base.products[0]]}),
 /TRUST_FRONTIER_DUPLICATE_OR_INVALID_PRODUCT/);
assert.throws(()=>plan({...base,backlog:[...base.backlog,{...base.backlog[0],id:"bad"}]}),
 /TRUST_FRONTIER_INVALID_TARGET/);
const server=fs.readFileSync("lib/admin/trust-intake-readiness.js","utf8");
const page=fs.readFileSync("app/admin/products/trust/identity-readiness/page.js","utf8");
for(const source of [
 "product_evidence_source_subject_bindings","product_evidence_sources",
 "planTrustBrandOfficialFrontier"
]) assert.ok(server.includes(source),"missing canonical source "+source);
for(const forbidden of [".insert(", ".update(", ".delete(", ".upsert(", ".rpc(",
 "openai","gemini"]) assert.ok(!server.toLowerCase().includes(forbidden.toLowerCase()),
 "read-only discovery must not write: "+forbidden);
assert.ok(page.includes("requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW)"));
assert.ok(page.includes("제품 일치/시장/처방 미검증"));
assert.ok(page.includes("브랜드 공식 사이트 탐색 후보"));
console.log("TRUST_P1_BRAND_OFFICIAL_FRONTIER_PASS");
