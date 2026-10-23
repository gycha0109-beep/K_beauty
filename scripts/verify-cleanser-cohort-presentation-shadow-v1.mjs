#!/usr/bin/env node
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {evaluateExistingCleanserCohortPresentationsV1 as audit} from "../lib/cleanser-cohort-presentation-shadow-v1.mjs";

const id=i=>"11111111-1111-4111-8111-"+i.toString(16).padStart(12,"0");
const ids=Array.from({length:10},(_,i)=>id(i+1));
const names=["젤 폼 200ml","머그트리 팩클렌저 130g","소이빈 폼 160ml",
  "딥 클렌징 포밍 크림 125ml","아크네 폼 150ml",
  "젤 투 워터 170ml","유자몽 팩클렌저 130g","마이크로 폼 120ml",
  "포밍 클렌저 240ml","무화버터 팩클렌저 130g"];
const sizes=[200,null,160,125,150,170,null,120,240,null];
const fixture=()=>({
  expected_product_ids:[...ids],
  products:ids.map((p,i)=>({id:p,category:"cleanser",brand:"fixture",
    name:names[i],normalized_brand:"fixture",normalized_name:"cleanser-"+i,size_ml:sizes[i]})),
  intakes:ids.map(p=>({product_id:p,identity_state:"SUBJECT_CREATION_REQUIRED",
    trust_state:"REVIEW_REQUIRED"})),
  tasks:ids.flatMap(p=>["low_ph","deep_cleansing"].map(fact_key=>({product_id:p,fact_key,state:"REVIEW_REQUIRED"}))),
  subjects:[],source_bindings:[],offers:[],unverified_research_leads:[
    {product_id:ids[7],amount:150,unit:"ml",basis:"UNVERIFIED_RESEARCH_LEAD",reference:"manufacturer-index-lead-120-to-150"},
    {product_id:ids[5],amount:220,unit:"ml",basis:"UNVERIFIED_RESEARCH_LEAD",reference:"manufacturer-index-lead-170-to-220"}
  ]
});
const result=audit(fixture());
assert.equal(result.cohort_products,10);
assert.equal(result.observed_intakes,10);
assert.equal(result.observed_research_tasks,20);
assert.equal(result.cohort_queue_shape_matches_10_20,true);
assert.equal(result.production_writes,0);
assert.equal(result.confirmed_facts,0);
assert.equal(result.admission_grants,0);
assert.equal(result.results.length,10);
assert.ok(result.results.every(r=>r.decision==="REVIEW_REQUIRED"&&r.physical_presentation==="UNVERIFIED"));
assert.ok(result.results.every(r=>r.formula_decision==="FORMULA_UNRESOLVED"));
assert.ok(result.results.every(r=>r.existing_offer_count===0&&r.existing_subject_count===0&&
  r.created_product_count===0));
for(const i of [1,6,9]){
  const row=result.results.find(r=>r.product_id===ids[i]);
  assert.equal(row.catalog_size_hint,null);
  assert.deepEqual(row.name_unit_hint,{amount:130,unit:"g"});
  assert.ok(row.reasons.includes("PRODUCT_NAME_UNIT_IS_UNVERIFIED_HINT"));
  assert.ok(row.reasons.includes("CATALOG_ML_CAPACITY_MISSING_OR_UNUSABLE"));
}
for(const [i,claimed] of [[7,150],[5,220]]){
  const row=result.results.find(r=>r.product_id===ids[i]);
  assert.equal(row.unverified_research_leads[0].amount,claimed);
  assert.ok(row.reasons.includes("CATALOG_VS_RESEARCH_LEAD_CAPACITY_DISAGREE"));
  assert.equal(row.formula_decision,"FORMULA_UNRESOLVED");
}
const noOffers=fixture();
noOffers.offers.push({product_id:ids[0],listing_id:"offer-1",price_amount:24000});
const offerRow=audit(noOffers).results.find(r=>r.product_id===ids[0]);
assert.ok(offerRow.reasons.includes("SELLER_OFFER_COMPONENT_SCOPE_UNVERIFIED"));
assert.equal(offerRow.physical_presentation,"UNVERIFIED");
const replay=audit(fixture());
assert.deepEqual(replay,result);
const changes=fixture();
changes.products.reverse();
changes.tasks.reverse();
changes.intakes.reverse();
assert.deepEqual(audit(changes),result);
const incomplete=fixture();
incomplete.tasks.pop();
const diff=audit(incomplete);
assert.equal(diff.cohort_queue_shape_matches_10_20,false);
assert.ok(diff.results.some(r=>r.reasons.includes("TRUST_RESEARCH_TASK_SET_DRIFT")));
for (const change of [
  x=>x.expected_product_ids.pop(),
  x=>x.products.pop(),
  x=>x.products[0].category="sunscreen",
  x=>x.intakes.push({product_id:id(25),identity_state:"REVIEW_REQUIRED"}),
  x=>x.offers.push({product_id:id(25),listing_id:"not-in-cohort"}),
  x=>x.unverified_research_leads[0].basis="MANUFACTURER_CONFIRMED",
  x=>x.unverified_research_leads[0].unit="kg",
]) {
  const x=fixture();change(x);
  assert.throws(()=>audit(x),TypeError);
}
const cli=spawnSync(process.execPath,["scripts/run-cleanser-presentation-cohort-shadow-v1.mjs","--stdin"],
  {input:JSON.stringify(fixture()),encoding:"utf8",maxBuffer:1024*1024});
assert.equal(cli.status,0,cli.stderr);
assert.deepEqual(JSON.parse(cli.stdout),result);
const denied=spawnSync(process.execPath,["scripts/run-cleanser-presentation-cohort-shadow-v1.mjs"],
  {input:JSON.stringify(fixture()),encoding:"utf8"});
assert.notEqual(denied.status,0);
const bad=spawnSync(process.execPath,["scripts/run-cleanser-presentation-cohort-shadow-v1.mjs","--stdin"],
  {input:"{}",encoding:"utf8"});
assert.notEqual(bad.status,0);
console.log("Cleanser 10-row C1 read-only cohort contract: PASS (synthetic replay; zero writes)");
