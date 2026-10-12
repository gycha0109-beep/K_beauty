#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
 prepareTrustP2BObservations,
 appendTrustP2BObservations,
} from "../lib/trust/official-discovery-observation-store-v1.mjs";
import { findTrustP2BOfficialPeerLinks } from "../lib/trust/official-peer-index-links-v1.mjs";
import { buildTrustOfficialDiscoveryRequests } from "../lib/trust/brand-official-frontier-v1.mjs";

const productId="4608b3b4-8b51-4464-b46e-380b05c1a3d7";
const intakeId="0b5963bb-67d6-4738-a620-32ec86c1e3d0";
const row={
 intakeId,productId,status:"BRAND_OFFICIAL_DISCOVERY_SEEDS",
 discoveryOrigins:[{
  origin:"https://brand.example.test",
  evidenceRefs:[{peerOfficialLocator:"https://brand.example.test/goods/goods_view.php?goodsNo=136"}],
 }],
};
const product={id:productId,name:"다이브인 저분자 히알루론산 세럼",
 name_en:"DIVE IN Serum"};
const requests=buildTrustOfficialDiscoveryRequests(row,product);
assert.equal(requests.length,1);
assert.equal(requests[0].peer_official_index_urls.length,1);
assert.ok(requests[0].product_path_prefixes.includes("/goods/goods_view.php"));
const bytes=Buffer.from(`<div><a href="/goods/goods_view.php?goodsNo=333">다이브인 저분자 히알루론산 세럼</a>
<a href="https://evil.example.test/goods/goods_view.php?goodsNo=1">다이브인 저분자 히알루론산 세럼</a>
<a href="/goods/goods_view.php?goodsNo=444">다이브인 저분자 히알루론산 크림</a>
<a href="/private?goodsNo=2">다이브인 저분자 히알루론산 세럼</a></div>`);
const links=findTrustP2BOfficialPeerLinks(bytes,requests[0].peer_official_index_urls[0],product);
assert.deepEqual(links,["https://brand.example.test/goods/goods_view.php?goodsNo=333"]);
const run={
 productId,intakeId,readOnly:true,
 officialProductEvidenceConfirmed:false,marketVerified:false,formulationVerified:false,
 subjectCreationAuthorized:false,factWrites:0,recommendationWrites:0,aiApiCalls:0,
 sites:[{
  origin:"https://brand.example.test",status:"CANDIDATES_DISCOVERED",
  pages:[{url:links[0],status:"STRUCTURED_NAME_CANDIDATE",
    sha256:"a".repeat(64)}],
 }],
};
const prepared=prepareTrustP2BObservations(run);
assert.equal(prepared.length,2);
assert.deepEqual(prepared.map(x=>x.observation_kind).sort(),["page_candidate","site_disposition"]);
assert.ok(prepared.every(x=>x.observation_fingerprint.length===64));
assert.equal(prepared.find(x=>x.observation_kind==="page_candidate").identity_surface,"product_jsonld_name");
assert.deepEqual(prepareTrustP2BObservations(run),prepared,"fingerprints stable across replay");
assert.throws(()=>prepareTrustP2BObservations({...run,subjectCreationAuthorized:true}),
 /TRUST_P2B_RUN_NOT_ELIGIBLE/);
assert.throws(()=>prepareTrustP2BObservations({...run,sites:[{
  ...run.sites[0],pages:[{url:"https://evil.example.test/steal",status:"IDENTITY_UNRESOLVED"}],
 }]}),/TRUST_P2B_LOCATOR_INVALID/);
assert.throws(()=>prepareTrustP2BObservations({...run,sites:[{
  ...run.sites[0],pages:[{url:links[0],status:"CONFIRMED"}],
 }]}),/TRUST_P2B_PAGE_STATUS_INVALID/);
assert.throws(()=>prepareTrustP2BObservations({...run,sites:[{
  ...run.sites[0],pages:[{url:links[0],status:"STRUCTURED_NAME_CANDIDATE",sha256:"bad"}],
 }]}),/TRUST_P2B_DIGEST_INVALID/);
const snapshots=new Map();let inserts=0,selects=0;
const client={from(name){
 assert.equal(name,"trust_official_discovery_observations_v1");
 return {
  async insert(row){
   inserts++;
   if(snapshots.has(row.observation_fingerprint))
     return {error:{code:"23505"}};
   snapshots.set(row.observation_fingerprint,row);
   return {error:null};
  },
  select(){
   return {
    eq(field,value){
     assert.equal(field,"observation_fingerprint");
     return {async limit(n){
      selects++;assert.equal(n,2);
      return {data:[snapshots.get(value)].filter(Boolean),error:null};
     }};
    },
   };
  },
 };
}};
const first=await appendTrustP2BObservations(client,run);
assert.equal(first.inserted,2);assert.equal(first.duplicates,0);
const second=await appendTrustP2BObservations(client,run);
assert.equal(second.inserted,0);assert.equal(second.duplicates,2);
assert.equal(snapshots.size,2);assert.equal(selects,2);
const src=fs.readFileSync("scripts/trust-p2-official-discovery.mjs","utf8");
assert.match(src,/TRUST_P2_PERSIST_ENABLED/);
assert.match(src,/appendTrustP2BObservations/);
assert.match(src,/--persist/);
for(const forbidden of [".update(", ".upsert(", ".delete(", ".rpc(", "openai","gemini"]){
 assert.ok(!src.toLowerCase().includes(forbidden),"CLI disallowed "+forbidden);
}
const migration=fs.readFileSync("supabase/migrations/20261012110000_trust_p2b_official_discovery_observations_v1.sql","utf8");
assert.match(migration,/force row level security/i);
assert.match(migration,/grant select,insert/i);
assert.ok(!/grant\s+.*update\s+on/i.test(migration));
console.log("TRUST_P2B_DISCOVERY_LEDGER_PASS");
