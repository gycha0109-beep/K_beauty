#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const STAGE="V2.1-8H-R5";
const TERMINAL="BARRIER_SUPPORT_SHADOW_CONSUMPTION_ADAPTER_CONTRACT_FROZEN";
const ROOT="evidence/product-decision-axis-non-numeric-shadow-v2";
const CONTRACT=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-contract-v1.json`;
const EXAMPLES=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-examples-v1.json`;
const REPLAY=`${ROOT}/barrier-support-non-numeric-pda-shadow-adapter-replay-v1.json`;
const R4_OUTPUT=`${ROOT}/barrier-support-non-numeric-pda-offline-shadow-output-v1.json`;
const R4_REPLAY=`${ROOT}/barrier-support-non-numeric-pda-offline-shadow-replay-v1.json`;
const DOC="docs/evidence/v21-8h-r5-barrier-support-shadow-consumption-adapter-contract-v1.md";
const R4_OUTPUT_BLOB="eff81d7d7c8bf0afed334f86e6d440ab0c4914b4";
const R4_REPLAY_BLOB="a1e53ea67de414e6a6115e715f9a8938cffa0acf";
let assertions=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);assertions+=1};
const ok=(v,m)=>{assert.ok(v,m);assertions+=1};
const read=p=>fs.readFileSync(p,"utf8");
const json=p=>JSON.parse(read(p));
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
const canonical=p=>`${JSON.stringify(stable(json(p)))}\n`;
const blob=p=>{const b=fs.readFileSync(p);return crypto.createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex")};

function normalizeAxes(value){
  if(!Array.isArray(value)) return null;
  return [...new Set(value.map(x=>String(x||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"en"));
}
function adapt(input){
  const p=input.product_state||{};
  const u=input.user_context||{};
  const presenceMap={
    GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE:"present",
    GOVERNED_BARRIER_CLAIM_ESTABLISHED_FALSE:"explicit_negative",
    GOVERNED_BARRIER_CLAIM_UNKNOWN:"unknown",
    GOVERNED_BARRIER_CLAIM_BLOCKED:"blocked",
    NOT_APPLICABLE:"not_applicable"
  };
  const presence=presenceMap[p.signal_state]||"unknown";
  const axes=normalizeAxes(u.concern_axes);
  let relevance, relevantAxes=[];
  if(presence==="not_applicable") relevance="not_applicable";
  else if(axes===null||axes.length===0) relevance="unknown";
  else {
    relevantAxes=axes.filter(x=>x==="barrier"||x==="dehydration");
    relevance=relevantAxes.length?"relevant":"not_relevant";
  }
  let roleState="missing";
  if(presence==="not_applicable") roleState="not_applicable";
  else if(p.primary_use_role_state==="ESTABLISHED") roleState="established";
  else if(p.primary_use_role_state==="BLOCKED") roleState="blocked";
  else if(p.primary_use_role_state==="UNKNOWN") roleState="unknown";
  const roleValues=roleState==="established"
    ? [...new Set(Array.isArray(p.primary_use_role_values)?p.primary_use_role_values:[])].sort((a,b)=>String(a).localeCompare(String(b),"en"))
    : [];
  let annotation;
  if(presence==="not_applicable") annotation="not_applicable";
  else if(presence==="blocked") annotation="blocked";
  else if(relevance==="unknown") annotation="held_unknown_user_context";
  else if(relevance==="not_relevant") annotation="not_relevant";
  else if(presence==="unknown") annotation="held_unknown_product_fact";
  else if(presence==="present") annotation="positive_claim_context_available";
  else if(presence==="explicit_negative") annotation="explicit_negative_claim_context_available";
  else annotation="held_unknown_product_fact";
  return {
    barrier_claim_presence_state:presence,
    user_relevance_state:relevance,
    relevant_user_axes:relevantAxes,
    usage_role_context:{state:roleState,values:roleValues},
    annotation_authority_state:annotation,
    coverage_state:p.coverage_state??null,
    uncertainty_state:{reasons:Array.isArray(p.uncertainty_reasons)?p.uncertainty_reasons:[]},
    scope_state:p.scope_resolution_state??null,
    provenance:"PRESERVE_INTRINSIC_ONLY",
    numeric_contribution:null,
    rank_effect:"NONE",
    eligibility_effect:"NONE"
  };
}

const contract=json(CONTRACT), examples=json(EXAMPLES), replay=json(REPLAY), r4=json(R4_OUTPUT), r4Replay=json(R4_REPLAY);
eq(blob(R4_OUTPUT),R4_OUTPUT_BLOB,"R4 output blob");
eq(blob(R4_REPLAY),R4_REPLAY_BLOB,"R4 replay blob");
eq(r4Replay.primary_terminal_outcome,"NON_NUMERIC_BARRIER_SUPPORT_PDA_OFFLINE_SHADOW_REPLAY_VALIDATED","R4 terminal");
eq(r4.products.length,176,"R4 catalog");
eq(r4Replay.production_invariance.evaluations,1968,"R4 recommendation denominator");
eq(r4Replay.production_invariance.pda_production_consumption,"NO","R4 production consumption");
eq(r4Replay.production_invariance.recommendation_activation,"NO","R4 activation");

eq(contract.stage,STAGE,"contract stage");
eq(contract.implementation_status,"DESIGNED_NOT_IMPLEMENTED","implementation not in R5");
eq(contract.primary_terminal_outcome,TERMINAL,"contract terminal");
eq(contract.boundary,"non_numeric_barrier_support_pda + user_barrier_dehydration_context -> shadow_annotation_input","boundary");
eq(contract.inputs.external_user_context.recognized_relevant_axes,["barrier","dehydration"],"relevant user axes");
eq(contract.scope.shadow_only,true,"shadow only");
eq(contract.scope.runtime_implementation_in_r5,false,"no runtime implementation");
eq(contract.scope.production_activation_authorized,false,"no production activation");
eq(contract.scope.database_write_authorized,false,"no DB write");

const allowed=[
  "annotation_authority_state","barrier_claim_presence_state","coverage_state","eligibility_effect",
  "numeric_contribution","provenance","rank_effect","relevant_user_axes","scope_state",
  "uncertainty_state","usage_role_context","user_relevance_state"
].sort();
eq(contract.outputs.allowed.slice().sort(),allowed,"allowed output surface");
for(const forbidden of [
  "numeric_score_bonus","numeric_score_penalty","rank_boost","rank_penalty",
  "candidate_eligibility_change","candidate_admission_change","stronger_weaker_inference",
  "barrier_effect_magnitude_inference","measured_barrier_improvement_inference",
  "safety_or_suitability_inference_from_claim","full_face_suitability_inference_from_primary_use_role",
  "unknown_to_false","blocked_to_unknown","implicit_scope_selection",
  "barrier_plus_dehydration_double_count","legacy_barrier_pathway_additive_count",
  "public_recommendation_mutation"
]) ok(contract.outputs.forbidden.includes(forbidden),`forbidden ${forbidden}`);

eq(examples.examples.length,12,"12 contract cases");
for(const item of examples.examples){
  const actual=adapt(item.input);
  eq(actual,item.expected_output,`${item.case_id} exact replay`);
  eq(actual.numeric_contribution,null,`${item.case_id} nonnumeric`);
  eq(actual.rank_effect,"NONE",`${item.case_id} no rank`);
  eq(actual.eligibility_effect,"NONE",`${item.case_id} no eligibility`);
}

const dual=examples.examples.find(x=>x.case_id==="present_barrier_and_dehydration_single_annotation");
eq(dual.expected_output.relevant_user_axes,["barrier","dehydration"],"dual axes preserved");
eq(dual.expected_output.numeric_contribution,null,"dual axes no contribution");
eq(dual.expected_output.annotation_authority_state,"positive_claim_context_available","dual axes one annotation authority");
const local=examples.examples.find(x=>x.case_id==="present_dehydration_relevant_local_area");
eq(local.expected_output.usage_role_context.values,["local_area"],"local role preserved");
eq(local.expected_output.eligibility_effect,"NONE","local role no eligibility");
const neg=examples.examples.find(x=>x.case_id==="explicit_negative_relevant");
eq(neg.expected_output.barrier_claim_presence_state,"explicit_negative","explicit false preserved");
eq(neg.expected_output.annotation_authority_state,"explicit_negative_claim_context_available","explicit false context only");
const unknown=examples.examples.find(x=>x.case_id==="unknown_missing_fact_relevant");
eq(unknown.expected_output.barrier_claim_presence_state,"unknown","missing not false");
eq(unknown.expected_output.annotation_authority_state,"held_unknown_product_fact","unknown held");
const blocked=examples.examples.find(x=>x.case_id==="blocked_identity_relevant");
eq(blocked.expected_output.barrier_claim_presence_state,"blocked","blocked preserved");
const scope=examples.examples.find(x=>x.case_id==="scope_context_required_relevant");
eq(scope.expected_output.scope_state,"CONTEXT_REQUIRED","scope context preserved");
eq(scope.expected_output.annotation_authority_state,"held_unknown_product_fact","scope unresolved held");
const unrelated=examples.examples.find(x=>x.case_id==="present_unrelated_user_context");
eq(unrelated.expected_output.user_relevance_state,"not_relevant","unrelated not relevant");

eq(replay.stage,STAGE,"replay stage");
eq(replay.primary_terminal_outcome,TERMINAL,"replay terminal");
eq(replay.implementation_status,"DESIGNED_NOT_IMPLEMENTED","replay implementation status");
eq(replay.synthetic_contract_replay.case_count,12,"replay cases");
eq(replay.non_additivity.barrier_plus_dehydration_contribution_units,0,"no dual-axis additivity");
eq(replay.non_additivity.primary_use_role_contribution_units,0,"role no contribution");
eq(replay.non_additivity.legacy_barrier_pathway_additive_units,0,"legacy no additivity");
for(const field of ["score_delta","ranking_delta","top1_delta","top3_delta","eligibility_delta","candidate_policy_delta","public_response_delta","persistence_delta"]){
  eq(replay.production_invariance[field],0,`production ${field}`);
}
eq(replay.production_invariance.frozen_candidate_products,164,"frozen products");
eq(replay.production_invariance.frozen_user_scenarios,12,"frozen scenarios");
eq(replay.production_invariance.frozen_evaluations,1968,"frozen evaluations");
eq(replay.production_invariance.pda_production_consumption,"NO","no production PDA");
eq(replay.production_invariance.recommendation_activation,"NO","no activation");
eq(replay.next_gate.stage,"V2.1-8H-R6_BARRIER_SUPPORT_SHADOW_CONSUMPTION_ADAPTER_IMPLEMENTATION","next gate");
eq(replay.next_gate.status,"NOT_EXECUTED","R6 not executed");

for(const p of [CONTRACT,EXAMPLES,REPLAY]){
  eq(read(p),canonical(p),`${p} canonical bytes`);
}
ok(read(DOC).includes(TERMINAL),"doc terminal");
ok(!JSON.stringify({contract,examples,replay}).includes('"numeric_contribution":1'),"no numeric contribution");
ok(!JSON.stringify({contract,examples,replay}).includes('"rank_effect":"BOOST"'),"no rank boost");
ok(!JSON.stringify({contract,examples,replay}).includes('"eligibility_effect":"ALLOW"'),"no eligibility activation");

console.log(JSON.stringify({
  version:"verify-barrier-support-non-numeric-pda-shadow-adapter-contract-v1",
  status:"PASS",
  assertions,
  stage:STAGE,
  cases:examples.examples.length,
  primary_terminal_outcome:TERMINAL,
  production_consumption:"NO",
  recommendation_activation:"NO"
}));
