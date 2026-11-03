#!/usr/bin/env node
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {evaluateCleanserExistingHwahaeScoreShadowV1 as evaluate}
  from "../lib/trust/cleanser-hwahae-existing-score-shadow-v1.mjs";

const snapshot=JSON.parse(await readFile(
  "evidence/trust/cleanser-existing-hwahae-signal-footprint-20261024-v1.json","utf8"));
const rows=snapshot.records;
assert.equal(snapshot.version,"cleanser-existing-hwahae-signal-footprint-v1");
assert.equal(rows.length,10);
assert.equal(new Set(rows.map(x=>x.product_id)).size,10);
assert.equal(rows.filter(x=>x.review_scorer_input_status==="REVIEW_SCORE_INPUT_CANDIDATE").length,6);
assert.equal(rows.filter(x=>x.review_scorer_input_status==="NO_TOP_THREE_MAPPED_REVIEW_TAGS").length,1);
assert.equal(rows.filter(x=>x.review_scorer_input_status==="NO_HWAHAE_REVIEW_CAPTURE").length,3);
assert.equal(rows.filter(x=>x.market_source==="hwahae_visible_page").length,7);
assert.equal(rows.filter(x=>x.ingredient_source==="hwahae_visible_page").length,7);
assert.ok(rows.every(x=>x.production_recommendation_admitted===false&&
  x.official_product_fact_confirmed===false));
const missing=rows.filter(x=>x.review_scorer_input_status==="NO_HWAHAE_REVIEW_CAPTURE");
assert.deepEqual(missing.map(x=>x.product_id),[
 "4f918d80-be34-4857-817b-6ad88ddf1bee",
 "e3ebe3ff-8fe8-4aa7-9d6f-2fb6af5069bf",
 "fa793e6b-9fa6-441d-9b24-9bcc9a111e8c"
]);
const mug=rows.find(x=>x.product_id==="4d5b22c7-b802-4474-a459-7331c17adef1");
assert.equal(mug.market_review_count,2);
assert.equal(mug.top_three_positive_mapped_entries+mug.top_three_negative_mapped_entries,0);
const example=rows.find(x=>x.review_scorer_input_status==="REVIEW_SCORE_INPUT_CANDIDATE");
const p={
 id:example.product_id,brand:example.brand,name:example.product_name,
 category:"cleanser",product_form:null,
 hwahae_url:"https://www.hwahae.co.kr/products/123456",
 review_signals:{
  source:"hwahae_ai_review",updated_at:"2026-10-22",
  positive:[{label:"사용 후 산뜻함",count:83,mapped:["fresh"]}],
  negative:[{label:"세안 후 당김",count:21,mapped:["drying"]}]
 },
 market_signals:{
  source:"hwahae_visible_page",review_count:1234,rating:4.4,
  hwahae_review_page:"https://www.hwahae.co.kr/products/123456"
 },
 ingredient_signals:{source:"hwahae_visible_page",total_ingredients:17}
};
const valid=evaluate({product:p});
assert.equal(valid.product_id,p.id);
assert.equal(valid.status,"REVIEW_SCORE_INPUT_CANDIDATE");
assert.equal(valid.score_profiles.length,3);
assert.equal(valid.score_type,"LEGACY_REVIEW_SIGNAL_ONLY_NOT_COMPLETE_SKIN_MATCH");
assert.ok(valid.score_profiles.every(x=>typeof x.review_signal_score==="number"&&
  x.review_signal_score<=10&&x.review_signal_score>=-10));
assert.equal(valid.market_review_count,1234);
assert.equal(valid.review_summary_entry_count,2);
assert.equal(valid.top_three_mapped_entries,2);
assert.equal(valid.low_ph,"UNKNOWN");
assert.equal(valid.deep_cleansing,"UNKNOWN");
assert.equal(valid.actual_recommendation_candidate_admitted,false);
assert.equal(valid.g2_grant_issued,false);
assert.equal(valid.production_writes,0);
assert.equal(valid.independently_verified_exact_sku,false);
// No separate reviewer field is required to reuse *canonical* review signals:
assert.equal(Object.hasOwn(p.review_signals,"reviewed_by"),false);
assert.equal(Object.hasOwn(p.review_signals,"sample_count"),false);
assert.equal(Object.hasOwn(p.review_signals,"review_state"),false);
const changed=(updates)=>{
 const clone=structuredClone(p);
 updates(clone);
 return evaluate({product:clone});
};
assert.equal(changed(x=>{x.market_signals.hwahae_review_page=
  "https://www.hwahae.co.kr/products/765432"}).status,"CAPTURE_URL_MISMATCH_HOLD");
assert.equal(changed(x=>{x.review_signals.positive[0].mapped=[];
  x.review_signals.positive[0].label="synthetic unrelated phrase";
  x.review_signals.negative[0].mapped=[];
  x.review_signals.negative[0].label="synthetic other phrase";
 }).status,"NO_TOP_THREE_MAPPED_REVIEW_TAGS");
assert.equal(changed(x=>{x.review_signals=null}).status,"NO_HWAHAE_REVIEW_CAPTURE");
assert.equal(changed(x=>{x.hwahae_url=null}).status,"NO_HWAHAE_REVIEW_CAPTURE");
assert.equal(changed(x=>{x.category="sunscreen"}).status,"INVALID_CATALOG_IDENTITY");
assert.equal(changed(x=>{x.hwahae_url="https://evil.example/products/123456"}).status,"NO_HWAHAE_REVIEW_CAPTURE");
assert.equal(changed(x=>{x.review_signals.positive[0].count=0;
  x.review_signals.negative[0].count=0;
 }).status,"NO_TOP_THREE_MAPPED_REVIEW_TAGS");
assert.throws(()=>evaluate({product:null}),TypeError);
// Hosted script must not silently run without authorized credentials.
const denied=spawnSync(process.execPath,
 ["scripts/run-cleanser-existing-hwahae-live-review-score-v1.mjs"],
 {encoding:"utf8",maxBuffer:100000,
  env:{...process.env,SUPABASE_URL:"",SUPABASE_SERVICE_ROLE_KEY:""}});
assert.notEqual(denied.status,0);
assert.match(denied.stderr,/AUTHORIZED_SERVER_CREDENTIALS_REQUIRED/);
assert.equal(denied.stdout,"");
const trueReplay=JSON.parse(await readFile(
  "evidence/trust/cleanser-actual-review-score-replay-20261024-v1.json","utf8"));
assert.equal(trueReplay.version,"cleanser-actual-existing-review-score-replay-v1");
assert.equal(trueReplay.original_main_commit,"b5687f322bd33d5bdaad61c07eeee4a47544d15d");
assert.equal(trueReplay.review_scoring_blob_sha,"90f91fc7484d54bf5855d75dcec52fc13685c33b");
assert.equal(trueReplay.category_normalizer_blob_sha,"be57d8eee09ea2293a0b35c2f00d2fe62410471a");
assert.deepEqual(trueReplay.summary,{
 actual_product_rows:10,review_scorer_input_candidates:6,
 review_capture_unmapped:1,review_capture_missing:3,admission_grants:0,writes:0
});
assert.deepEqual(trueReplay.products.map(x=>x.product_id),
  rows.map(x=>x.product_id));
assert.ok(trueReplay.products.every(x=>x.official_product_fact_confirmed===false&&
  x.full_skin_match_score_recomputed===false&&x.g2_grants===0&&x.production_writes===0));
assert.ok(trueReplay.products.every(x=>x.status===
  rows.find(r=>r.product_id===x.product_id).review_scorer_input_status));
for(const x of trueReplay.products){
 assert.equal(x.score_profiles.length,x.status==="REVIEW_SCORE_INPUT_CANDIDATE"?3:0);
 assert.ok(x.score_profiles.every(p=>
   ["dry_tight","oily_pores","sensitive_redness"].includes(p.profile)&&
   typeof p.review_signal_score==="number"&&
   Number.isFinite(p.review_signal_score)&&Math.abs(p.review_signal_score)<=10&&
   Number.isSafeInteger(p.contributing_tag_count)&&p.contributing_tag_count>=0));
}
const drg=trueReplay.products.find(x=>x.product_id.startsWith("11322a66"));
const laro=trueReplay.products.find(x=>x.product_id.startsWith("63a958c4"));
assert.equal(drg.score_profiles.find(x=>x.profile==="dry_tight").review_signal_score,4.7);
assert.equal(laro.score_profiles.find(x=>x.profile==="dry_tight").review_signal_score,-5.3);
assert.equal(trueReplay.raw_review_text_exported,false);
assert.equal(trueReplay.raw_urls_exported,false);
console.log("Existing Hwahae canonical scoring bridge: PASS actual sanitized 6/1/3 cohort; exact real numeric replay + synthetic canonical scorer, no new reviewer gate, G2 grants=0");
