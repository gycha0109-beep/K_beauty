#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { build,canonical,STAGE,TERMINAL,BAND_ORDER } from "./build-barrier-support-coverage-recovery-prioritization-v1.mjs";

const ROOT="evidence/product-decision-axis-non-numeric-shadow-v2";
const INPUT=`${ROOT}/barrier-support-coverage-recovery-priority-input-v1.json`;
const QUEUE=`${ROOT}/barrier-support-coverage-recovery-priority-queue-v1.json`;
const SUMMARY=`${ROOT}/barrier-support-coverage-recovery-prioritization-summary-v1.json`;
const DOC="docs/evidence/v21-8h-r8-barrier-support-coverage-recovery-prioritization-v1.md";
let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));

const input=json(INPUT);
eq(input.stage,STAGE,"input stage");
eq(input.blocked_candidate_count,51,"51 blocked candidates");
eq(input.historical_hold_guard_count,3,"three historical moisturizer HOLD guards");
eq(input.source_authority.source_binding_semantics,"RESEARCH_LOCATOR_ONLY_NOT_PRODUCT_FACT_AUTHORITY","source locator boundary");
eq(input.source_authority.market_review_count_semantics,"RESEARCH_PRIORITY_TIE_BREAK_ONLY_NOT_RECOMMENDATION_OR_TRUTH_AUTHORITY","market signal boundary");
eq(input.source_authority.recommendation_tier_semantics,"TRACE_ONLY_NOT_USED_IN_PRIORITY_ORDER","tier trace boundary");

const A=build(),B=build();
eq(canonical(A.queue),canonical(B.queue),"queue deterministic");
eq(canonical(A.summary),canonical(B.summary),"summary deterministic");
eq(read(QUEUE),canonical(A.queue),"queue checked-in canonical");
eq(read(SUMMARY),canonical(A.summary),"summary checked-in canonical");
eq(A.summary.primary_terminal_outcome,TERMINAL,"terminal");
eq(A.summary.blocked_candidates,51,"blocked count");
eq(A.summary.context_reach_distribution,{"5":1,"7":20,"9":30},"context reach distribution");
eq(A.summary.source_research_readiness_distribution,{BOUND_URL:29,NO_SOURCE_HINT:8,SOURCE_HINT:14},"source readiness distribution");
eq(A.summary.priority_band_distribution,{
  P0_PRIMARY_FULL_CONTEXT_READY:5,
  P1_FULL_CONTEXT_BOUND_SOURCE:11,
  P2_FULL_CONTEXT_SOURCE_HINT:11,
  P3_FULL_CONTEXT_SOURCE_GAP:3,
  P3_PARTIAL_CONTEXT_SOURCE_READY:16,
  P4_LOWER_PRIORITY:5
},"priority distribution");
eq(A.summary.explicit_primary_moisturizer_count,5,"explicit primary count");
eq(A.summary.historical_hold_guard_count,3,"hold count");
eq(A.summary.historical_hold_product_ids,[
  "65a4c320-4815-4488-b031-b0a06b4702ca",
  "b639c8b4-6a61-440e-b4db-fac7381593ff",
  "d0319209-502b-4c85-be54-392600ff6b23"
],"historical holds sorted");

eq(A.queue.priority_band_order,BAND_ORDER,"band order");
eq(A.queue.queue.length,51,"queue length");
eq(new Set(A.queue.queue.map(x=>x.product_id)).size,51,"unique products");
for(let i=0;i<A.queue.queue.length;i++){
  const x=A.queue.queue[i];
  eq(x.research_order,i+1,`${x.product_id}: order`);
  eq(x.subject_registration_authorized,false,`${x.product_id}: no subject registration`);
  eq(x.product_fact_write_authorized,false,`${x.product_id}: no fact write`);
  eq(x.research_only,true,`${x.product_id}: research only`);
}
const expectedP0=[
  "b1f6b527-679f-48f3-9b58-5d28ec095f2f",
  "418e2bc1-7d6c-4334-9058-7af7ce159c6c",
  "7a98b5e7-2c1f-441a-afee-dd1c592d95bc",
  "e15a1f7e-29b3-49fd-aae4-297bf9ada4ed",
  "06d1ad4b-2291-4b73-8bf4-f1f3c0226fea"
];
eq(A.summary.p0_wave.product_ids,expectedP0,"P0 exact five");
for(const id of expectedP0){
  const x=A.queue.queue.find(v=>v.product_id===id);
  eq(x.priority_band,"P0_PRIMARY_FULL_CONTEXT_READY",`${id}: P0 band`);
  eq(x.context_reach_scenarios,9,`${id}: full context reach`);
  eq(x.explicit_primary_moisturizer,true,`${id}: explicit primary`);
  ok(x.source_research_readiness!=="NO_SOURCE_HINT",`${id}: source research ready`);
  eq(x.historical_hold,null,`${id}: not historical HOLD`);
}
for(const id of A.summary.historical_hold_product_ids){
  const x=A.queue.queue.find(v=>v.product_id===id);
  ok(x?.historical_hold?.decision==="HOLD",`${id}: HOLD preserved`);
  eq(x.subject_registration_authorized,false,`${id}: HOLD not auto released`);
}

eq(A.queue.ordering_contract.numeric_product_fact_calibration,false,"no fact calibration");
eq(A.queue.ordering_contract.recommendation_ranking_authority,false,"no ranking authority");
eq(A.queue.ordering_contract.product_fact_truth_authority,false,"no truth authority");
for(const k of ["score_delta","ranking_delta","eligibility_delta","candidate_policy_delta","public_response_delta","persistence_delta"]) eq(A.summary.production_invariance[k],0,`production ${k}`);
eq(A.summary.production_invariance.pda_production_consumption,"NO","no production consumption");
eq(A.summary.production_invariance.recommendation_activation,"NO","no activation");
for(const k of ["subject_writes","product_fact_writes","registry_definition_delta","migration_delta"]) eq(A.summary.hosted_invariance[k],0,`hosted ${k}`);
eq(A.summary.next_gate.stage,"V2.1-8H-R9_BARRIER_SUPPORT_P0_OFFICIAL_IDENTITY_AUTHORITY_RESEARCH","next gate");
eq(A.summary.next_gate.product_count,5,"next wave five");
eq(A.summary.next_gate.status,"RECOMMENDED_NOT_EXECUTED","R9 not executed");

const doc=read(DOC);
for(const token of [TERMINAL,"51개","P0","5개","HOLD","공식 사실 권위가 아니다","V2.1-8H-R9"]) ok(doc.includes(token),`doc token ${token}`);
console.log(JSON.stringify({status:"PASS",stage:STAGE,terminal:TERMINAL,assertions,p0:5,blocked:51}));
