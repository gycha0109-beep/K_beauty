#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const ROOT="evidence/product-decision-axis-readiness-v2";
const snapshot=JSON.parse(fs.readFileSync(`${ROOT}/v21-8h-r1-post-confirmation-pda-readiness-snapshot-v1.json`,"utf8"));
const replay=JSON.parse(fs.readFileSync(`${ROOT}/v21-8h-r1-post-confirmation-pda-readiness-replay-v1.json`,"utf8"));
const delta=JSON.parse(fs.readFileSync(`${ROOT}/v21-8h-r1-post-confirmation-pda-delta-attribution-v1.json`,"utf8"));
const historical=JSON.parse(fs.readFileSync("evidence/product-decision-axis-contract-v1/product-decision-axis-contract-replay-v1.json","utf8"));
const contract=JSON.parse(fs.readFileSync("evidence/product-decision-axis-contract-v1/product-decision-axis-mapper-contract-v1.json","utf8"));
const receipt=JSON.parse(fs.readFileSync("evidence/product-fact-catalog-expansion-v1/v21-8h-final-product-fact-confirmation-v1.json","utf8"));

assert.equal(snapshot.version,"v21-8h-r1-post-confirmation-pda-readiness-snapshot-v1");
assert.equal(snapshot.stage,"V2.1-8H-R1");
assert.equal(snapshot.gate,"POST_CONFIRMATION_PRODUCT_DECISION_AXIS_READINESS_RECONCILIATION");
assert.equal(snapshot.authority.registry_version,"product-fact-registry-cross-category-v1");
assert.equal(snapshot.authority.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
assert.equal(snapshot.snapshot_semantics.historical_frozen_denominators_mutated,false);
assert.equal(snapshot.snapshot_semantics.live_snapshot_is_separate_from_historical_snapshot,true);
assert.equal(snapshot.snapshot_semantics.missing_coerced_to_false,false);
assert.equal(snapshot.snapshot_semantics.numeric_calibration_performed,false);
assert.equal(snapshot.snapshot_semantics.production_consumption_changed,false);
assert.equal(snapshot.snapshot_semantics.recommendation_activation_changed,false);
assert.equal(snapshot.snapshot_semantics.product_fact_writes,0);
assert.equal(snapshot.snapshot_semantics.pda_writes,0);
assert.equal(snapshot.historical_v21_8j_frozen.catalog_total,164);
assert.equal(snapshot.historical_v21_8j_frozen.product_fact_current,41);
assert.equal(snapshot.pre_v21_8h_reconstructed.product_fact_current,95);
assert.equal(snapshot.post_v21_8h_live.catalog_total,176);
assert.equal(snapshot.post_v21_8h_live.resolved_current_subjects,43);
assert.equal(snapshot.post_v21_8h_live.product_fact_current,101);
assert.equal(snapshot.post_v21_8h_live.fact_instances_total,102);
assert.equal(snapshot.post_v21_8h_live.confirmations_total,102);

const historicalByAxis=Object.fromEntries(historical.axes.map(x=>[x.axis_key,x]));
const replayByAxis=Object.fromEntries(replay.axes.map(x=>[x.axis_key,x]));
assert.equal(replay.axes.length,7);
assert.equal(new Set(replay.axes.map(x=>x.axis_key)).size,7);

const expectedHistorical={
 barrier_support:[61,4,2,2,2,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
 cleansing_burden:[26,2,1,1,0,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
 exfoliation_load:[66,7,3,3,4,"STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION"],
 hydration_preservation:[26,2,1,1,0,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
 irritation_burden:[26,2,0,0,0,"REGISTRY_OR_MAPPER_EXTENSION_REQUIRED"],
 photo_protection:[11,3,3,2,1,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
 sebum_pore_control:[26,2,1,1,0,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
};
for(const [axis,e] of Object.entries(expectedHistorical)){
 const h=historicalByAxis[axis]; const r=replayByAxis[axis];
 assert.ok(h&&r,`${axis}: missing replay`);
 assert.deepEqual([h.applicable_catalog_distinct_products,h.adopted_distinct_products,h.mapper_signal_eligible_distinct_products,h.calibration_cohort_eligible_distinct_products,h.partial_structural_coverage_distinct_products,h.post_contract_readiness],e,`${axis}: historical replay drift`);
 assert.deepEqual([r.historical_v21_8j.frozen_applicable_catalog_distinct_products,r.historical_v21_8j.adopted_distinct_products,r.historical_v21_8j.mapper_signal_eligible_distinct_products,r.historical_v21_8j.calibration_cohort_eligible_distinct_products,r.historical_v21_8j.partial_structural_coverage_distinct_products,r.historical_v21_8j.readiness],e,`${axis}: R1 historical projection drift`);
 assert.equal(r.numeric_anchor_available,false); assert.equal(r.production_consumed,false);
}

const expectedPost={
 barrier_support:[61,10,6,6,0,"STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION"],
 cleansing_burden:[26,3,1,1,0,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
 exfoliation_load:[66,8,3,3,5,"STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION"],
 hydration_preservation:[26,3,2,2,0,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
 irritation_burden:[26,3,0,0,0,"REGISTRY_OR_MAPPER_EXTENSION_REQUIRED"],
 photo_protection:[13,13,13,10,3,"STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION"],
 sebum_pore_control:[26,3,1,1,0,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
};
for(const [axis,e] of Object.entries(expectedPost)){
 const r=replayByAxis[axis];
 assert.deepEqual([r.post_v21_8h.live_applicable_catalog_distinct_products,r.post_v21_8h.adopted_distinct_products,r.post_v21_8h.mapper_signal_eligible_distinct_products,r.post_v21_8h.calibration_cohort_eligible_distinct_products,r.post_v21_8h.partial_structural_coverage_distinct_products,r.post_v21_8h.readiness],e,`${axis}: post-8H replay mismatch`);
}

assert.deepEqual(replay.summary.post_v21_8h_structurally_ready_axes,["barrier_support","exfoliation_load","photo_protection"]);
assert.deepEqual(replay.summary.post_v21_8h_targeted_coverage_axes,["cleansing_burden","hydration_preservation","sebum_pore_control"]);
assert.deepEqual(replay.summary.post_v21_8h_registry_or_mapper_extension_axes,["irritation_burden"]);
assert.deepEqual(replay.summary.v21_8h_readiness_state_transitions,[]);
assert.equal(replay.summary.readiness_state_transition_count,0);
assert.deepEqual(replay.summary.numeric_anchor_available_axes,[]);
assert.deepEqual(replay.summary.production_consumed_axes,[]);
assert.equal(replay.summary.recommendation_activation,false);

for(const axis of contract.axes){
 assert.equal(axis.numeric_calibration,false,`${axis.axis_key}: numeric calibration drift`);
 assert.equal(axis.production_consumed,false,`${axis.axis_key}: production consumption drift`);
 assert.equal(axis.cohort_readiness_contract.minimum_eligible_product_rule,"at least 3 calibration-cohort-eligible distinct products per axis",`${axis.axis_key}: structural floor drift`);
}
assert.equal(contract.deferred_numeric_calibration_policy.recommendation_activation,false);

assert.equal(receipt.decision,"V21_8H_FINAL_PRODUCT_FACT_CONFIRMATION_PASS");
assert.equal(receipt.confirmations.length,6);
const receiptBySlug=Object.fromEntries(receipt.confirmations.map(x=>[x.slug,x]));
assert.equal(delta.exact_v21_8h_facts.length,6);
for(const fact of delta.exact_v21_8h_facts){
 const confirmed=receiptBySlug[fact.slug]; assert.ok(confirmed,`${fact.slug}: missing 8H confirmation`);
 assert.equal(confirmed.request_id,fact.request_id); assert.equal(confirmed.fact_key,fact.fact_key);
}

const a=Object.fromEntries(delta.axis_attribution.map(x=>[x.axis_key,x]));
assert.deepEqual([a.barrier_support.historical_v21_8j_eligible,a.barrier_support.pre_v21_8h_eligible,a.barrier_support.post_v21_8h_eligible],[2,4,6]);
assert.deepEqual([a.photo_protection.historical_v21_8j_eligible,a.photo_protection.pre_v21_8h_eligible,a.photo_protection.post_v21_8h_eligible],[2,10,10]);
assert.deepEqual([a.hydration_preservation.pre_v21_8h_eligible,a.hydration_preservation.post_v21_8h_eligible],[1,2]);
assert.equal(a.exfoliation_load.direct_v21_8h_partial_context_delta,1);
assert.equal(delta.readiness_transition_summary.v21_8h_caused_axis_readiness_transitions,0);
assert.ok(delta.axis_attribution.every(x=>x.v21_8h_caused_transition===false));

assert.equal(delta.authority_boundary.fact_adoption_implies_recommendation_activation,false);
assert.equal(delta.authority_boundary.numeric_calibration_authorized,false);
assert.equal(delta.authority_boundary.production_consumption_authorized,false);
assert.equal(delta.authority_boundary.recommendation_activation_authorized,false);
assert.equal(delta.authority_boundary.public_activation,false);
assert.equal(replay.decision,"V21_8H_R1_POST_CONFIRMATION_PDA_READINESS_RECONCILIATION_PASS");
assert.equal(replay.next_gate,"V2.1-8H-R2_BARRIER_SUPPORT_NON_NUMERIC_PDA_SHADOW_FEASIBILITY");

console.log(JSON.stringify({version:"verify-v21-8h-r1-post-confirmation-pda-readiness",status:"PASS",current:snapshot.post_v21_8h_live.product_fact_current,ready_axes:replay.summary.post_v21_8h_structurally_ready_axes,v21_8h_readiness_transitions:replay.summary.readiness_state_transition_count,recommendation_activation:replay.summary.recommendation_activation}));
