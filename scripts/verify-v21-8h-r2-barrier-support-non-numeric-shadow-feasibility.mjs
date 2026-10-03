#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import { relevantProductAxisKeys } from "./product-evidence/product-decision-axis-shadow-recommendation-v1.mjs";

const ROOT="evidence/product-decision-axis-feasibility-v2";
const corpus=JSON.parse(fs.readFileSync(`${ROOT}/barrier-support-shadow-feasibility-corpus-v1.json`,"utf8"));
const ledger=JSON.parse(fs.readFileSync(`${ROOT}/barrier-support-downstream-requirement-ledger-v1.json`,"utf8"));
const matrix=JSON.parse(fs.readFileSync(`${ROOT}/barrier-support-representation-option-matrix-v1.json`,"utf8"));
const feasibility=JSON.parse(fs.readFileSync(`${ROOT}/barrier-support-non-numeric-shadow-feasibility-v1.json`,"utf8"));
const r1=JSON.parse(fs.readFileSync("evidence/product-decision-axis-readiness-v2/v21-8h-r1-post-confirmation-pda-readiness-replay-v1.json","utf8"));
const registry=JSON.parse(fs.readFileSync("evidence/product-evidence-decision-axis-v1/cross-category-registry-v1.json","utf8"));
const legacyCorpus=new Set(fs.readFileSync("fixtures/recommendation-governance/legacy-frozen-recommendation-corpus-v1.txt","utf8").trim().split(/\s+/));
const scenariosDoc=JSON.parse(fs.readFileSync("fixtures/recommendation-metadata/user-scenarios-v1.json","utf8"));
const scenarios=Array.isArray(scenariosDoc)?scenariosDoc:(scenariosDoc.scenarios||[]);
const productsDoc=JSON.parse(fs.readFileSync("fixtures/recommendation-metadata/products-v1.json","utf8"));
const products=Array.isArray(productsDoc)?productsDoc:(productsDoc.products||[]);

assert.equal(corpus.version,"barrier-support-shadow-feasibility-corpus-v1");
assert.equal(corpus.stage,"V2.1-8H-R2");
assert.equal(corpus.axis_key,"barrier_support");
assert.equal(corpus.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(corpus.authority.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");

const r1Barrier=r1.axes.find(x=>x.axis_key==="barrier_support");
assert.ok(r1Barrier);
assert.equal(r1Barrier.post_v21_8h.calibration_cohort_eligible_distinct_products,6);
assert.equal(r1Barrier.post_v21_8h.readiness,"STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION");
assert.equal(r1Barrier.numeric_anchor_available,false);
assert.equal(r1Barrier.production_consumed,false);

const claimDef=registry.facts.find(x=>x.fact_key==="barrier_support_claim");
const roleDef=registry.facts.find(x=>x.fact_key==="primary_use_role");
assert.ok(claimDef&&roleDef);
assert.equal(claimDef.semantic_definition,"Official barrier-support claim; distinct from measured barrier improvement.");
assert.equal(claimDef.value_type,"boolean");
assert.equal(claimDef.cardinality,"one");
assert.equal(claimDef.negative_evidence_requirement,"explicit_negative_only");
assert.ok(claimDef.permitted_evidence_classes.includes("product_claim"));
assert.equal(roleDef.semantic_definition,"Declared or reviewed primary usage role; role is not recommendation policy.");

assert.equal(corpus.mapper_contract.signal_fact,"barrier_support_claim");
assert.equal(corpus.mapper_contract.context_fact,"primary_use_role");
assert.equal(corpus.mapper_contract.context_contributes_efficacy,false);
assert.equal(corpus.mapper_contract.mapper_coverage_for_primary_authority,"claim_only");
assert.equal(corpus.mapper_contract.numeric_estimate,null);

assert.equal(corpus.products.length,10);
assert.equal(new Set(corpus.products.map(x=>x.product_id)).size,10);
assert.ok(corpus.products.every(x=>x.legacy_candidate===true));
for(const p of corpus.products) assert.ok(legacyCorpus.has(p.product_id),`${p.product_id}: adopted moisturizer must already be legacy candidate`);

const established=corpus.products.filter(x=>x.claim_state==="GOVERNED_CLAIM_ESTABLISHED_TRUE");
const unknown=corpus.products.filter(x=>x.claim_state==="GOVERNED_CLAIM_UNKNOWN_NO_CURRENT");
assert.equal(established.length,6);
assert.equal(unknown.length,4);
assert.ok(established.every(x=>x.claim_authority==="product_specific_primary"&&x.claim_confidence==="high"));
assert.ok(unknown.every(x=>x.claim_authority===undefined&&x.claim_confidence===undefined));

const relevantScenarios=scenarios.filter(s=>relevantProductAxisKeys(s.answers||{}).includes("barrier_support"));
assert.deepEqual(relevantScenarios.map(x=>x.id),["U2","U3","U4","U5","U6","U7","U9","U10","U11"]);
assert.equal(relevantScenarios.length,9);
assert.deepEqual(corpus.bounded_shadow_corpus.relevant_scenarios,relevantScenarios.map(x=>x.id));
assert.equal(corpus.bounded_shadow_corpus.scenario_product_pairs,90);
assert.equal(corpus.bounded_shadow_corpus.claim_established_pairs,54);
assert.equal(corpus.bounded_shadow_corpus.no_current_claim_pairs,36);
assert.equal(corpus.bounded_shadow_corpus.no_current_claim_semantics,"UNKNOWN_NOT_FALSE");
assert.equal(corpus.bounded_shadow_corpus.admission_extension_required,false);

const establishedIds=new Set(established.map(x=>x.product_id));
const productRows=products.filter(p=>establishedIds.has(String(p.id)));
assert.equal(productRows.length,6);
const overlaps=productRows.map(p=>({
 concern:(p.concerns||[]).includes("barrier"),
 ingredient:Number(p.ingredient_signals?.functional_summary?.barrier||0)>0,
 review:[...(p.review_signals?.positive||[]),...(p.review_signals?.negative||[])].some(r=>(r.mapped||[]).includes("barrier")),
}));
assert.deepEqual({
 concern:overlaps.filter(x=>x.concern).length,
 ingredient:overlaps.filter(x=>x.ingredient).length,
 review:overlaps.filter(x=>x.review).length,
}, {
 concern:corpus.semantic_overlap_audit.overlaps.legacy_product_concern_barrier,
 ingredient:corpus.semantic_overlap_audit.overlaps.legacy_ingredient_barrier_signal,
 review:corpus.semantic_overlap_audit.overlaps.legacy_review_barrier_signal,
});
assert.deepEqual([overlaps.filter(x=>x.concern).length,overlaps.filter(x=>x.ingredient).length,overlaps.filter(x=>x.review).length],[5,6,4]);
assert.equal(corpus.semantic_overlap_audit.direct_additive_consumption_risk,"HIGH_DOUBLE_COUNT_RISK");
assert.equal(corpus.semantic_overlap_audit.evidence_identity_equivalence_claimed,false);

assert.equal(ledger.requirements.length,12);
assert.equal(ledger.summary.total_requirements,12);
assert.equal(ledger.summary.numeric_or_ordinal_required_but_not_authorized,3);
assert.equal(ledger.summary.non_numeric_or_context_requirements,9);
assert.equal(ledger.summary.direct_score_requirement_authorized,false);
assert.equal(ledger.summary.non_numeric_shadow_need_established,true);
const req=Object.fromEntries(ledger.requirements.map(x=>[x.requirement_id,x]));
assert.equal(req.R07.status,"NOT_AUTHORIZED");
assert.equal(req.R08.status,"NOT_ESTABLISHED");
assert.equal(req.R09.status,"NOT_SUPPORTED_BY_CURRENT_FACT");
assert.equal(req.R11.status,"REQUIRED");
assert.equal(req.R12.status,"OUT_OF_SCOPE_SEPARATE_AUTHORITY");

assert.equal(matrix.options.numeric_effect_score.disposition,"REJECTED");
assert.equal(matrix.options.ordinal_strength.disposition,"REJECTED");
assert.equal(matrix.options.direct_binary_recommendation_boost.disposition,"REJECTED");
assert.equal(matrix.options.structured_categorical_claim_state.disposition,"RECOMMENDED_PRIMARY");
assert.equal(matrix.primary_terminal_outcome,"STRUCTURED_CATEGORICAL_NON_NUMERIC_SHADOW_RECOMMENDED");
assert.ok(matrix.options.structured_categorical_claim_state.guardrails.includes("NO_DIRECT_FACT_TO_SCORE"));
assert.ok(matrix.options.structured_categorical_claim_state.guardrails.includes("MISSING_NOT_FALSE"));
assert.ok(matrix.options.structured_categorical_claim_state.guardrails.includes("EXPLICIT_NEGATIVE_ONLY_FOR_FALSE"));
assert.ok(matrix.options.structured_categorical_claim_state.guardrails.includes("LEGACY_PATHWAYS_NON_ADDITIVE"));

assert.equal(feasibility.gate,"BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_FEASIBILITY");
assert.equal(feasibility.evidence.eligible_products,6);
assert.equal(feasibility.evidence.adopted_moisturizer_products,10);
assert.equal(feasibility.evidence.all_adopted_products_already_legacy_candidates,true);
assert.equal(feasibility.evidence.relevant_frozen_scenarios,9);
assert.equal(feasibility.evidence.bounded_scenario_product_pairs,90);
assert.equal(feasibility.decisions.numeric_calibration,"NOT_FEASIBLE_FROM_CURRENT_CLAIM_FACTS");
assert.equal(feasibility.decisions.ordinal_strength,"NOT_FEASIBLE_FROM_CURRENT_CLAIM_FACTS");
assert.equal(feasibility.decisions.direct_binary_score_boost,"REJECTED_DOUBLE_COUNT_AND_AUTHORITY_RISK");
assert.equal(feasibility.decisions.structured_categorical_shadow,"FEASIBLE_AND_RECOMMENDED");
assert.equal(feasibility.decisions.candidate_admission_change_required,false);
assert.equal(feasibility.decisions.production_consumption_authorized,false);
assert.equal(feasibility.terminal_outcome,"BARRIER_SUPPORT_NON_NUMERIC_SHADOW_FEASIBLE_CONTRACT_REQUIRED");
assert.equal(feasibility.next_gate,"V2.1-8H-R3_BARRIER_SUPPORT_NON_NUMERIC_PDA_CONTRACT");
assert.equal(feasibility.execute_next_gate_now,false);

for(const [k,v] of Object.entries(feasibility.explicit_non_actions)){
  if(typeof v==="number") assert.equal(v,0,`${k}: must remain zero`);
  if(typeof v==="boolean") assert.equal(v,false,`${k}: must remain false`);
}
for(const [k,v] of Object.entries(corpus.invariants)){
  if(typeof v==="number") assert.equal(v,0,`${k}: must remain zero`);
  if(typeof v==="boolean") assert.equal(v,false,`${k}: must remain false`);
}

console.log(JSON.stringify({
 version:"verify-v21-8h-r2-barrier-support-non-numeric-shadow-feasibility",
 status:"PASS",
 adopted_products:corpus.products.length,
 established_claim_products:established.length,
 relevant_scenarios:relevantScenarios.length,
 bounded_pairs:corpus.bounded_shadow_corpus.scenario_product_pairs,
 primary_outcome:matrix.primary_terminal_outcome,
 next_gate:feasibility.next_gate,
 production_consumption:false
}));
