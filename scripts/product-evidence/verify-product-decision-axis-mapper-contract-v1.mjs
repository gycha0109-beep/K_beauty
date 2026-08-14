#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { VERSION, SNAPSHOT_PATH, REPRESENTATIVE_COVERAGE_POLICY, canonicalJson, sha256Json, buildAll } from "./product-decision-axis-mapper-contract-v1.mjs";

let assertions = 0;
function eq(a,b,msg){ assert.deepEqual(a,b,msg); assertions += 1; }
function ok(v,msg){ assert.ok(v,msg); assertions += 1; }
function includes(arr,v,msg){ ok(arr.includes(v),msg || `missing ${v}`); }
function factKey(item){ return typeof item === "string" ? item.split(" ")[0] : item.fact_key; }

const snapshotText = fs.readFileSync(SNAPSHOT_PATH,"utf8");
const snapshotSha = crypto.createHash("sha256").update(snapshotText).digest("hex");
eq(snapshotSha,"fde7b6fd9902ff965424be43d3c5e5bc1845f5e0a2fa97d3860376859636f05b","8I snapshot bytes drift");
const snapshot = JSON.parse(snapshotText);
const A = buildAll(snapshot), B = buildAll(snapshot);
eq(canonicalJson(A.contract),canonicalJson(B.contract),"contract Build A/B drift");
eq(canonicalJson(A.replay),canonicalJson(B.replay),"replay Build A/B drift");
eq(A.doc,B.doc,"docs Build A/B drift");

eq(A.contract.version,VERSION); eq(A.contract.stage,"V2.1-8J");
eq(A.contract.authority.execution_main_sha,"6f573b632824be13dfe208f29c796aa3306b4984");
eq(A.contract.authority.registry_version,"product-fact-registry-cross-category-v1");
eq(A.contract.authority.registry_definition_count,20);
eq(A.contract.authority.registry_checksum,"79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575");
eq(A.contract.authority.subject_serializer,"product-fact-subject-identity-v1");
eq(A.contract.authority.proposition_serializer_lineage,"product-fact-proposition-pilot-v1");
eq(A.contract.authority.v21_8i_audit_sha256,"589dafe9ab4db7849676aef69d26e5122b4c64aea7bd548a497e60b6a21d5057");

eq(A.contract.axes.length,7,"all seven axes required");
eq(new Set(A.contract.axes.map(x=>x.axis_key)).size,7,"axis keys unique");
for (const axis of A.contract.axes) {
  ok(axis.signal_contract,"signal contract missing"); ok(axis.calibration_eligibility_contract,"calibration eligibility missing"); ok(axis.cohort_readiness_contract,"cohort readiness missing");
  ok(axis.signal_contract !== axis.calibration_eligibility_contract,"signal and calibration contracts must be distinct");
  eq(axis.numeric_calibration,false,`${axis.axis_key} numeric calibration`); eq(axis.production_consumed,false,`${axis.axis_key} production consumption`); eq(axis.calibration_eligibility_contract.numeric_anchor_available,false,`${axis.axis_key} numeric anchor invented`);
  const classified = new Set([...axis.signal_contract.SIGNAL_REQUIRED.map(factKey),...axis.signal_contract.SIGNAL_OPTIONAL.map(factKey),...axis.signal_contract.CONTEXT_ONLY.map(factKey),...axis.signal_contract.NOT_CONSUMED.map(factKey)]);
  for (const key of axis.mapper_input_universe) ok(classified.has(key),`${axis.axis_key} unclassified mapper input ${key}`);
  eq(axis.calibration_eligibility_contract.semantic_status_allowlist,["supported"]); ok(axis.calibration_eligibility_contract.authority_floor_or_rule.includes("product_specific_primary"));
}

eq(REPRESENTATIVE_COVERAGE_POLICY.disposition,"REFINED");
eq(REPRESENTATIVE_COVERAGE_POLICY.prior_proposal.version,"catalog-expansion-selection-policy-v1");
eq(REPRESENTATIVE_COVERAGE_POLICY.prior_proposal.rule,"category_floor_target = 3 adopted distinct products per catalog category");
eq(REPRESENTATIVE_COVERAGE_POLICY.authoritative_structural_gate.minimum_eligible_product_rule,"at least 3 calibration-cohort-eligible distinct products per axis");
eq(REPRESENTATIVE_COVERAGE_POLICY.structural_only,true); eq(REPRESENTATIVE_COVERAGE_POLICY.statistical_power_claimed,false);

eq(A.contract.null_semantics.missing_current,"UNKNOWN_NOT_FALSE"); eq(A.contract.null_semantics.not_reviewed,"UNKNOWN_NOT_FALSE"); eq(A.contract.null_semantics.reviewed_not_established,"UNKNOWN_NOT_FALSE"); eq(A.contract.null_semantics.evidence_insufficient,"UNKNOWN_NOT_FALSE"); eq(A.contract.null_semantics.evidence_conflict,"BLOCKED_NOT_FALSE"); eq(A.contract.null_semantics.source_blocked,"UNKNOWN_NOT_FALSE"); eq(A.contract.null_semantics.registry_gap,"BLOCKED_CONTRACT_GAP_NOT_FALSE"); eq(A.contract.null_semantics.supported_false,"EXPLICIT_NEGATIVE_ONLY_WHEN_REGISTRY_CONTRACT_PERMITS");

eq(A.contract.authority_semantics.calibration_required_authority,"product_specific_primary"); ok(A.contract.authority_semantics.mapper_authority_rule.includes("never above weakest"));
eq(A.contract.multi_value_semantics.preserve_all_relevant_values,true); eq(A.contract.multi_value_semantics.preserve_proposition_lineage,true); eq(A.contract.multi_value_semantics.arbitrary_first_selection,false); eq(A.contract.multi_value_semantics.dedupe_by_product_only,false); ok(A.contract.multi_value_semantics.parent_child_concentration_lineage.includes("required"));

const byAxis = Object.fromEntries(A.contract.axes.map(x=>[x.axis_key,x]));
includes(byAxis.cleansing_burden.signal_contract.SIGNAL_REQUIRED,"deep_cleansing"); includes(byAxis.cleansing_burden.signal_contract.NOT_CONSUMED,"low_ph"); ok(byAxis.cleansing_burden.authority_contract.includes("does not become measured cleansing burden magnitude"));
includes(byAxis.hydration_preservation.signal_contract.SIGNAL_REQUIRED,"low_ph"); ok(byAxis.hydration_preservation.authority_contract.includes("never hydration-preservation magnitude"));
includes(byAxis.sebum_pore_control.signal_contract.SIGNAL_REQUIRED,"deep_cleansing"); ok(byAxis.sebum_pore_control.authority_contract.includes("does not become measured sebum/pore outcome"));

eq(A.contract.irritation_contract_decision.decision,"KEEP_NOT_CONSUMED_REQUIRE_GOVERNED_CLEANSER_IRRITATION_SIGNAL_EXTENSION");
eq(A.contract.irritation_contract_decision.eye_sting_observed_role,"NOT_CONSUMED for cleanser irritation_burden v1");
eq(A.contract.irritation_contract_decision.registry_observation.domain_scope,["sunscreen"]); eq(A.contract.irritation_contract_decision.registry_observation.evidence_class,["observation"]); includes(byAxis.irritation_burden.signal_contract.NOT_CONSUMED,"eye_sting_observed"); eq(byAxis.irritation_burden.calibration_eligibility_contract.CALIBRATION_REQUIRED,[]);

eq(byAxis.photo_protection.calibration_eligibility_contract.CALIBRATION_REQUIRED,["spf_value","uva_label"]); eq(byAxis.photo_protection.calibration_eligibility_contract.NON_CALIBRATING_CONTEXT,["uv_filter_type","water_resistance_duration"]); ok(byAxis.photo_protection.authority_contract.includes("not converted into arbitrary effect scores")); eq(A.contract.photo_protection_contract_decision.core_input_set,["spf_value","uva_label"]);

includes(byAxis.barrier_support.signal_contract.SIGNAL_REQUIRED,"barrier_support_claim"); includes(byAxis.barrier_support.signal_contract.CONTEXT_ONLY,"primary_use_role"); includes(byAxis.barrier_support.signal_contract.NOT_CONSUMED,"contains_active"); includes(byAxis.barrier_support.signal_contract.NOT_CONSUMED,"active_concentration"); ok(byAxis.barrier_support.calibration_eligibility_contract.claim_only_policy.includes("never establishes numeric barrier-effect magnitude"));

eq(byAxis.exfoliation_load.signal_contract.SIGNAL_REQUIRED[0].value_set,["lactic_acid","mandelic_acid","salicylic_acid"]); eq(byAxis.exfoliation_load.calibration_eligibility_contract.active_identity_set_is_exhaustive_forever,false);
for (const k of ["active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture"]) includes(byAxis.exfoliation_load.signal_contract.CONTEXT_ONLY,k);
ok(byAxis.exfoliation_load.multi_value_contract.includes("never arbitrary first")); ok(byAxis.exfoliation_load.multi_value_contract.includes("matching parent contains_active lineage"));

const med = A.replay.product_axis_ledger.find(r=>r.axis_key==="exfoliation_load" && r.brand==="메디큐브"); ok(med,"Medicube exfoliation fixture missing"); eq(med.signal_facts.map(x=>x.value).sort(),["lactic_acid","salicylic_acid"],"multi-active propositions collapsed");
const drg = A.replay.product_axis_ledger.find(r=>r.axis_key==="exfoliation_load" && r.brand==="닥터지"); ok(drg,"Dr.G exfoliation fixture missing"); eq(drg.signal_facts.map(x=>x.value),["mandelic_acid"],"non-exfoliating identities leaked into signal");
const ordinary = A.replay.product_axis_ledger.find(r=>r.axis_key==="exfoliation_load" && r.brand==="디오디너리"); ok(ordinary,"The Ordinary exfoliation fixture missing"); eq(ordinary.mapper_signal_eligible,true);

const expected = {
  cleansing_burden:[26,2,1,1,0,25,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
  hydration_preservation:[26,2,1,1,0,25,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
  irritation_burden:[26,2,0,0,0,26,"REGISTRY_OR_MAPPER_EXTENSION_REQUIRED"],
  sebum_pore_control:[26,2,1,1,0,25,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
  photo_protection:[11,3,3,2,1,9,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
  barrier_support:[61,4,2,2,2,59,"TARGETED_PRODUCT_FACT_COVERAGE_REQUIRED"],
  exfoliation_load:[66,7,3,3,4,63,"STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION"],
};
for (const row of A.replay.axes) {
  eq([row.applicable_catalog_distinct_products,row.adopted_distinct_products,row.mapper_signal_eligible_distinct_products,row.calibration_cohort_eligible_distinct_products,row.partial_structural_coverage_distinct_products,row.ineligible_distinct_products,row.post_contract_readiness],expected[row.axis_key],`${row.axis_key} replay mismatch`);
  includes(row.secondary_states,"NO_NUMERIC_ANCHOR_AVAILABLE"); eq(row.numeric_anchor_available,false);
}

eq(A.replay.summary.structurally_ready_axes,["exfoliation_load"]); eq(A.replay.summary.registry_or_mapper_extension_axes,["irritation_burden"]); eq(A.replay.summary.targeted_coverage_axes,["barrier_support","cleansing_burden","hydration_preservation","photo_protection","sebum_pore_control"]); eq(A.replay.summary.authority_quality_axes,[]); eq(A.replay.summary.all_estimates_remain_null,true);
const exReplay = A.replay.axes.find(x=>x.axis_key==="exfoliation_load"); eq(exReplay.category_topology_coverage.map(x=>[x.topology_key,x.eligible_distinct_products,x.met]),[["treatment",1,true],["toner_essence",1,true],["toner_pad",1,true]],"exfoliation topology coverage");
const pReplay = A.replay.axes.find(x=>x.axis_key==="photo_protection"); eq(pReplay.blocker_distribution,{CORE_SPF_UVA_PAIR_INCOMPLETE:1});

eq(A.contract.deferred_numeric_calibration_policy.numeric_calibration,false); eq(A.contract.deferred_numeric_calibration_policy.estimate_must_remain_null,true); eq(A.contract.deferred_numeric_calibration_policy.weights_selected,false); eq(A.contract.deferred_numeric_calibration_policy.priors_selected,false); eq(A.contract.deferred_numeric_calibration_policy.numeric_uncertainty_selected,false); eq(A.contract.deferred_numeric_calibration_policy.statistical_power_claimed,false); eq(A.contract.deferred_numeric_calibration_policy.production_consumption,false); eq(A.contract.deferred_numeric_calibration_policy.recommendation_activation,false);

eq(A.contract.invariants.hosted_product_fact_writes_v21_8j,0); eq(A.contract.invariants.external_product_evidence_research_v21_8j,0); eq(A.contract.invariants.registry_definition_delta_v21_8j,0); eq(A.contract.invariants.migration_delta_v21_8j,0); eq(A.contract.invariants.pda_numeric_calibration_v21_8j,0); eq(A.contract.invariants.pda_production_consumption_v21_8j,0); eq(A.contract.invariants.recommendation_behavior_delta_v21_8j,0);

eq(A.contract.next_stage_recommendation.stage,"Product Decision Axis Offline/Shadow Calibration Wave 1"); eq(A.contract.next_stage_recommendation.axis,"exfoliation_load"); eq(A.contract.next_stage_recommendation.execute_now,false);
const {contract_digest,contract_digest_semantics,...contractBody} = A.contract; eq(contract_digest,sha256Json(contractBody),"contract digest drift"); ok(contract_digest_semantics.includes("excluding contract_digest"));

console.log(JSON.stringify({version:"verify-product-decision-axis-mapper-contract-v1",status:"PASS",assertions,axes:A.contract.axes.length,structurally_ready_axes:A.replay.summary.structurally_ready_axes,contract_digest:A.contract.contract_digest}));
