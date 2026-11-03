#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {verifyCleanserR5PrivateSourceDriftV1 as guard}
  from "../lib/trust/cleanser-r5-private-source-drift-guard-v1.mjs";

const source=JSON.parse(await readFile(
 "evidence/trust/cleanser-r5-existing-source-axis-footprint-20261024-v1.json","utf8"));
const makeKeys=n=>Object.fromEntries(Array.from({length:n},(_,i)=>["key"+i,i]));
const makeMapped=n=>Array.from({length:n},()=>({mapped:["dehydration"],count:1}));
const products=source.records.map(x=>{
 const captured=x.capture_url_same_string;
 const path="https://www.hwahae.co.kr/goods/"+x.product_id.slice(0,8);
 return {
  id:x.product_id,category:"cleanser",product_form:null,cleansing_profile:null,
  hwahae_url:captured?path:null,
  review_signals:{
    source:x.review_source_is_hwahae?"hwahae_ai_review":null,
    positive:makeMapped(x.mapped_positive_count),
    negative:makeMapped(x.mapped_negative_count)
  },
  market_signals:{
    source:x.market_source_is_hwahae?"hwahae_visible_page":null,
    review_count:x.market_total_review_count,
    hwahae_review_page:captured?path:null
  },
  ingredient_signals:{
    source:x.ingredient_source_is_hwahae?"hwahae_visible_page":null,
    skin_type:makeKeys(x.ingredient_skin_axis_count),
    functional_summary:makeKeys(x.ingredient_function_axis_count),
    risk:makeKeys(x.ingredient_risk_bucket_count)
  }
 };
});
const run=(input=products,footprint=source)=>
  guard({products:input,footprint});
const r=run();
assert.equal(r.matched_products,10);
assert.equal(r.matched_capture_urls,7);
assert.equal(r.product_facts_confirmed,0);
assert.equal(r.g2_grants,0);
assert.equal(r.production_writes,0);
assert.equal(r.payload_content_unchanged_not_proven,true);
assert.equal(r.exact_market_sku_not_proven,true);
const invalid=[
 x=>{x[0].market_signals.review_count++;},
 x=>{x[0].ingredient_signals.risk.another=4;},
 x=>{x[0].hwahae_url="https://www.hwahae.co.kr/goods/other";},
 x=>{x[0].review_signals.source="unknown";},
 x=>{x[0].review_signals.positive.pop();},
 x=>{x[0].review_signals.positive[0].mapped=[];},
 x=>{x[0].ingredient_signals.skin_type=[];},
 x=>{x[0].market_signals.review_count="3.2";},
 x=>{x[0].product_form="foam";},
 x=>{x[0].cleansing_profile="low_ph";},
 x=>{x[0].category="serum";},
 x=>{x[0].id=x[1].id;},
 x=>{x.pop();},
];
for(const modify of invalid){
 const candidate=structuredClone(products);
 modify(candidate);
 assert.throws(()=>run(candidate),TypeError);
}
const stale=structuredClone(source);
stale.records[0].market_total_review_count=999;
assert.throws(()=>run(products,stale),TypeError);
// This deliberately documents the limit of an aggregate-only snapshot:
// equal counts are NOT cryptographic proof of unmodified source contents.
const sameCountDifferentValue=structuredClone(products);
sameCountDifferentValue[0].ingredient_signals.risk.key0=555;
assert.equal(run(sameCountDifferentValue).payload_content_unchanged_not_proven,true);
console.log("R5 private-source drift guard: PASS 10 captured=7 source/aggregate drift denied, "+
  "raw source values and exact SKU NOT proven, G2=0 DB writes=0");
