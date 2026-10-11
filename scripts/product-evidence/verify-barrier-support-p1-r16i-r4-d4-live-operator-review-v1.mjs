#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildR16IR4D4LiveReview,R16I_R4_D4_VERSION,R16I_PRODUCT_ID,R16I_RETAIL_URL }
  from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";
import { readR16IR4D4Review } from "../../lib/product-offer-r16i-r4-d4-db-reader.mjs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p1-r16i-r4-readonly-prestate-20261010.json","utf8"));
const clean={
  observed_at:"2026-10-11T09:45:42.100914+09:00",
  product:structuredClone(evidence.product),
  bindings:structuredClone(evidence.bindings),
  offers_by_product:[],offers_by_listing:[],offers_by_url:[],
  subjects:[],intakes:structuredClone(evidence.intakes)
};
const result=buildR16IR4D4LiveReview(clean);
assert.equal(result.contract_version,R16I_R4_D4_VERSION);
assert.equal(result.decision,"REVIEW_REQUIRED");
assert.equal(result.live_read_verified,true);
assert.equal(result.revision_matches,true);
assert.equal(result.collision_free,true);
assert.equal(result.reviewed_fields.length,20);
assert.equal(result.product_anchor_reused,true);
assert.equal(result.proposed_offer.price_amount,null);
assert.equal(result.proposed_offer.availability_state,"unknown");
assert.equal(result.proposed_offer.insert_authorized,false);
assert.equal(result.current_live_checkout_price,null);
assert.equal(result.current_verified_review_count,null);
assert.equal(result.operator_decision,null);
assert.equal(result.write_set,null);
assert.equal(result.executable_sql,null);
assert.equal(result.ranking_writes_authorized,false);
assert.equal(result.release_ready,false);
assert.ok(result.reviewed_fields.every(x=>x.after===null&&x.field_approved===false&&x.write_authorized===false));
assert.equal(result.reviewed_fields.find(x=>x.field==="size_ml").before,160);
assert.equal(result.reviewed_fields.find(x=>x.field==="price_min").before,29900);
assert.equal(result.reviewed_fields.find(x=>x.field==="unit_price_per_10ml").before,1868.75);
assert.equal(result.reviewed_fields.find(x=>x.field==="market_signals").before.review_count,41475);
assert.equal(result.reviewed_fields.find(x=>x.field==="binding_state").before,"resolved");
assert.equal(result.reviewed_fields.find(x=>x.field==="trust_state").before,"REVIEW_REQUIRED");

let rejected=0;
function blocked(name,modify,reason){
  const x=structuredClone(clean);modify(x);
  const v=buildR16IR4D4LiveReview(x);
  assert.equal(v.decision,"BLOCKED",name);
  assert.deepEqual(v.reasons,[reason],name);
  assert.equal(v.reviewed_fields.length,0,name);
  assert.equal(v.write_set,null,name);
  assert.equal(v.release_ready,false,name);
  rejected++;
}
const missing="MISSING_TRUSTED_LIVE_READ",
  product="PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT",
  collision="OFFER_LISTING_OR_SUBJECT_COLLISION",
  binding="SOURCE_BINDING_DRIFT",
  intake="TRUST_INTAKE_DRIFT";
blocked("missing product",x=>x.product=null,missing);
blocked("missing offers",x=>delete x.offers_by_listing,missing);
blocked("bad date",x=>x.observed_at="bad",missing);
blocked("wrong id",x=>x.product.id="00000000-0000-4000-8000-000000000099",product);
blocked("changed revision",x=>x.product.updated_at="2026-10-11T07:00:00+09:00",product);
blocked("volume changed to single",x=>x.product.size_ml=80,product);
blocked("price changed",x=>x.product.price_min=35000,product);
blocked("unit price cast to wrong 80ml",x=>x.product.unit_price_per_10ml=3737.5,product);
blocked("source link spoof",x=>x.product.buy_link="https://example.invalid",product);
blocked("indexed review copied",x=>x.product.market_signals.review_count=43612,product);
blocked("market source promoted",x=>x.product.market_signals.source="official",product);
blocked("product offer exists",x=>x.offers_by_product.push({offer_id:"other"}),collision);
blocked("seller listing collision",x=>x.offers_by_listing.push({product_id:"other"}),collision);
blocked("seller url collision",x=>x.offers_by_url.push({product_id:"other"}),collision);
blocked("subject already minted",x=>x.subjects.push({subject_id:"other"}),collision);
blocked("missing binding",x=>x.bindings=[],binding);
blocked("conflicting binding",x=>x.bindings.push({...x.bindings[0],binding_id:"other"}),binding);
blocked("binding resolved scope silently",x=>x.bindings[0].product_scope_state="product",binding);
blocked("binding changed time",x=>x.bindings[0].updated_at="2026-10-11T06:00:00+09:00",binding);
blocked("binding URL reassigned",x=>x.bindings[0].source_url="https://example.invalid",binding);
blocked("missing intake",x=>x.intakes=[],intake);
blocked("intake approved",x=>x.intakes[0].trust_state="APPROVED",intake);
blocked("intake subject created",x=>x.intakes[0].subject_id="abc",intake);
blocked("intake changed time",x=>x.intakes[0].updated_at="2026-10-11T07:00:00+09:00",intake);

const productRow=structuredClone(evidence.product);
const bindingRow=structuredClone(evidence.bindings[0]);
const intakeRow=structuredClone(evidence.intakes[0]);
let calls=[];
function fakeClient({raiseOn=null,wrongOwner=false,collisionOffer=false}={}){
  const base={
    products:[productRow],
    product_source_bindings:[bindingRow],
    product_offers:collisionOffer?[{offer_id:"other",product_id:R16I_PRODUCT_ID,
      seller_key:"hwahae",listing_id:"45194",listing_url:R16I_RETAIL_URL}]:[],
    product_fact_subjects:[],
    catalog_trust_intake:[intakeRow]
  };
  if(wrongOwner)base.product_source_bindings.push({...bindingRow,
    binding_id:"other",product_id:"00000000-0000-4000-8000-000000000099"});
  return {from(table){
    calls.push(["from",table]);
    let filters=[];
    return {select(columns){calls.push(["select",table,columns]);return this;},
      eq(key,value){filters.push([key,value]);return this;},
      limit(n){
        calls.push(["limit",table,n]);
        if(table===raiseOn)return Promise.resolve({data:null,error:{message:"no"}});
        const rows=(base[table]||[]).filter(item=>filters.every(([key,value])=>item[key]===value));
        return Promise.resolve({data:structuredClone(rows.slice(0,n)),error:null});
      }
    };
  }};
}
calls=[];
const actual=await readR16IR4D4Review(fakeClient());
assert.equal(actual.decision,"REVIEW_REQUIRED");
assert.equal(calls.filter(([cmd])=>cmd==="from").length,8);
assert.equal(calls.filter(([cmd])=>cmd==="limit").length,8);
assert.ok(calls.every(([cmd])=>cmd==="from"||cmd==="select"||cmd==="limit"));
calls=[];assert.equal((await readR16IR4D4Review(fakeClient({wrongOwner:true}))).decision,"BLOCKED");
calls=[];assert.equal((await readR16IR4D4Review(fakeClient({collisionOffer:true}))).decision,"BLOCKED");
await assert.rejects(()=>readR16IR4D4Review(fakeClient({raiseOn:"products"})),/R16I_D4_READ_FAILED:product/);
await assert.rejects(()=>readR16IR4D4Review(null),/R16I_D4_DB_UNAVAILABLE/);

const routeText=fs.readFileSync("app/api/admin/products/r16i-correction-review/route.js","utf8");
assert.match(routeText,/requireAdminCapability\(ADMIN_CAPABILITIES\.PRODUCTS_REVIEW\)/);
assert.match(routeText,/if\(!access\.allowed \|\| !access\.userId\)/);
assert.ok(routeText.indexOf("requireAdminCapability(")<routeText.indexOf("createSupabaseAdminClient()"));
assert.match(routeText,/private, no-store/);
assert.match(routeText,/export async function GET\(\)/);
assert.doesNotMatch(routeText,/export async function (POST|PUT|PATCH|DELETE)\(/);
for(const path of ["lib/product-offer-r16i-r4-d4-live-review.mjs",
                   "lib/product-offer-r16i-r4-d4-db-reader.mjs",
                   "app/api/admin/products/r16i-correction-review/route.js"]){
  const text=fs.readFileSync(path,"utf8");
  assert.doesNotMatch(text,/\.insert\s*\(|\.upsert\s*\(|\.update\s*\(|\.delete\s*\(|\.rpc\s*\(/,path);
}
console.log(JSON.stringify({status:"PASS",stage:"R16I-R4-D4",admin_preview:true,
  review_fields:result.reviewed_fields.length,
  blocked_mutations:rejected,select_queries:8,source_binding_collision_guard:true,
  actual_checkout_authority:false,field_level_approvals:0,production_writes:0}));
