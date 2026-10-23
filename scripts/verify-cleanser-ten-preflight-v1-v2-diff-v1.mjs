#!/usr/bin/env node
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {compareExistingTenCleanserPreflightsV1 as compare} from "../lib/cleanser-ten-preflight-v1-v2-diff-v1.mjs";
const ids=Array.from({length:10},(_,i)=>"11111111-1111-4111-8111-"+String(i+1).padStart(12,"0"));
const snapshot=()=>({
 expected_product_ids:[...ids],
 products:ids.map((id,i)=>({id,category:"cleanser",name:"Synthetic Product "+i,
  brand:"Test Brand",normalized_brand:"test",normalized_name:"cleanser-"+i,size_ml:150})),
 subjects:[],official_bindings:[],observations:[],confirmed_facts:[],
 governed_formula_pairs:[],
 catalog_products:ids.map((id,i)=>({id,normalized_brand:"test",normalized_name:"cleanser-"+i}))
});
const v1=({product})=>({
  version:"cleanser-initial-admission-preflight-v1",
  productId:product.id,state:"RESEARCH_OR_EVIDENCE_REQUIRED",
  blockers:["CURRENT_EXACT_SUBJECT_REQUIRED","VERIFIED_EXACT_CAPACITY_REQUIRED"],
  conflicts:[],admissionGranted:false,recommendationRuntimeActivated:false
});
const f=snapshot();
const r=await compare({cohort:f,evaluateV1:v1});
assert.equal(r.total,10);
assert.equal(r.v1_capacity_block_count,10);
assert.equal(r.v2_capacity_scope_reconciled_count,0);
assert.equal(r.v2_review_required_count,10);
assert.ok(r.results.every(x=>x.v1_blockers.includes("VERIFIED_EXACT_CAPACITY_REQUIRED")));
assert.ok(r.results.every(x=>x.v2_remaining_blockers.includes("CURRENT_EXACT_SUBJECT_REQUIRED")));
assert.ok(r.results.every(x=>x.formula_decision==="FORMULA_UNRESOLVED"));
assert.equal(r.admission_grants,0);
assert.equal(r.production_writes,0);
const scopedFacts=snapshot();
const subjectId="22222222-2222-4222-8222-222222222222";
scopedFacts.subjects.push({product_id:ids[0],subject_id:subjectId,
 current_state:"current",identity_status:"resolved",market_applicability:"KR",formulation_revision_key:"reviewed"});
scopedFacts.confirmed_facts.push({subject_id:subjectId,fact_key:"low_ph",semantic_status:"supported"});
const factReads=[];
await compare({cohort:scopedFacts,evaluateV1:input=>{
  factReads.push([input.product.id,input.confirmedFacts.length]);
  return v1(input);
}});
assert.deepEqual(factReads.find(x=>x[0]===ids[0]),[ids[0],1]);
assert.ok(factReads.slice(1).every(x=>x[1]===0));
const rejectedFact=snapshot();
rejectedFact.confirmed_facts.push({subject_id:subjectId,fact_key:"low_ph"});
await assert.rejects(compare({cohort:rejectedFact,evaluateV1:v1}),TypeError);
const reordered=snapshot();
reordered.products.reverse();
assert.deepEqual(await compare({cohort:reordered,evaluateV1:v1}),r);
const doNotPromote=await compare({cohort:snapshot(),evaluateV1:async ({product})=>({
  ...v1({product}),blockers:["VERIFIED_EXACT_CAPACITY_REQUIRED"]
})});
assert.equal(doNotPromote.v2_capacity_scope_reconciled_count,0);
assert.equal(doNotPromote.v2_review_required_count,10);
const invoked=[];
await compare({cohort:snapshot(),evaluateV1:async x=>{
  invoked.push(x.product.id);
  return v1(x);
}});
assert.deepEqual(invoked,[...ids]);
for(const update of [
 x=>x.products.pop(),
 x=>x.expected_product_ids.pop(),
 x=>x.products[0].category="serum",
 x=>x.subjects.push({product_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}),
 x=>x.governed_formula_pairs.push({product_id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}),
 x=>x.official_bindings=null
]){
 const c=snapshot();update(c);
 await assert.rejects(compare({cohort:c,evaluateV1:v1}),TypeError);
}
await assert.rejects(compare({cohort:snapshot(),evaluateV1:()=>({
  ...v1({product:{id:ids[0]}}),admissionGranted:true
})}),TypeError);
// Standalone #1401 intentionally blocks the missing upstream v1.
// This isolated integration branch instead verifies the byte-identical v1 runs.
const cmd=spawnSync(process.execPath,["scripts/run-cleanser-ten-preflight-v1-v2-diff-v1.mjs","--stdin"],
  {input:JSON.stringify(snapshot()),encoding:"utf8"});
let upstreamPresent=false;
try{
  const mod=await import("../lib/cleanser-initial-admission-preflight-v1.mjs");
  upstreamPresent=typeof mod.evaluateCleanserInitialAdmissionPreflight==="function";
}catch{}
if(upstreamPresent){
  assert.equal(cmd.status,0,cmd.stderr);
  const integrated=JSON.parse(cmd.stdout);
  assert.equal(integrated.total,10);
  assert.equal(integrated.v2_capacity_scope_reconciled_count,0);
  assert.equal(integrated.admission_grants,0);
}else{
  assert.notEqual(cmd.status,0);
  assert.match(cmd.stderr,/UPSTREAM_PR_1390_V1_MUST_BE_INTEGRATED_BEFORE_REAL_COMPARISON/);
}
console.log("C4 exact-ten v1/v2 integration bridge: PASS ("+(upstreamPresent?"original upstream v1 executed with synthetic scoped fixture; full live snapshot not tested":"upstream v1 absent; runner correctly fail-closed")+")");
