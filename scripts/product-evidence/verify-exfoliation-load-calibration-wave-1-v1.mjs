#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import {
  AXIS_KEY,
  EXPECTED_HASHES,
  OUTPUTS,
  UPSTREAM_AUTHORITY,
  buildAll,
  canonicalJson,
  sha256Json,
} from "./exfoliation-load-calibration-wave-1-v1.mjs";

let assertions = 0;
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions += 1; }
function ok(value, message) { assert.ok(value, message); assertions += 1; }
function fileSha(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }

const upstream = {
  snapshot: "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-snapshot-v1.json",
  audit: "evidence/product-decision-axis-readiness-v1/product-decision-axis-input-coverage-audit-v1.json",
  contract: "evidence/product-decision-axis-contract-v1/product-decision-axis-mapper-contract-v1.json",
  replay: "evidence/product-decision-axis-contract-v1/product-decision-axis-contract-replay-v1.json",
};

eq(fileSha(upstream.snapshot), UPSTREAM_AUTHORITY.v21_8i_snapshot_sha256, "8I snapshot bytes drift");
eq(fileSha(upstream.audit), UPSTREAM_AUTHORITY.v21_8i_audit_sha256, "8I audit bytes drift");
eq(fileSha(upstream.contract), UPSTREAM_AUTHORITY.v21_8j_contract_file_sha256, "8J contract bytes drift");
eq(fileSha(upstream.replay), UPSTREAM_AUTHORITY.v21_8j_replay_sha256, "8J replay bytes drift");

const contract = readJson(upstream.contract);
const { contract_digest, contract_digest_semantics, ...contractBody } = contract;
eq(contract_digest, UPSTREAM_AUTHORITY.v21_8j_contract_digest, "8J declared contract digest drift");
eq(sha256Json(contractBody), UPSTREAM_AUTHORITY.v21_8j_contract_digest, "8J canonical body digest drift");

const A = buildAll();
const B = buildAll();
for (const key of ["input", "feasibility", "result"]) {
  eq(canonicalJson(A[key]), canonicalJson(B[key]), `${key} Build A/B drift`);
}
eq(A.doc, B.doc, "documentation Build A/B drift");
for (const [key, relativePath] of Object.entries(OUTPUTS)) {
  const checkedIn = fs.readFileSync(relativePath, "utf8");
  eq(checkedIn, A.rendered[key], `${relativePath} does not match deterministic builder`);
  eq(fileSha(relativePath), EXPECTED_HASHES[key], `${relativePath} SHA256 drift`);
}

const input = A.input;
const feasibility = A.feasibility;
const result = A.result;

eq(input.stage, "V2.1-8K");
eq(input.axis_key, AXIS_KEY);
eq(result.axis_key, AXIS_KEY);
eq(input.authority.execution_main_sha, "c4d8c2273b21cd6453b123796222b62769736aeb");
eq(input.authority.v21_8j_contract_digest, UPSTREAM_AUTHORITY.v21_8j_contract_digest);
eq(input.cohort.distinct_product_count, 3);
eq(input.cohort.topology_distribution, { treatment: 1, toner_essence: 1, toner_pad: 1 });

const products = new Map(input.cohort.exact_products.map((product) => [product.product_id, product]));
eq([...products.keys()].sort(), [
  "0b88019a-9eb2-4be9-842d-f1e60e42cf51",
  "230f1c9c-cbf8-4458-aaac-ea1010a21e8c",
  "c4a5f510-8d9e-46bd-a31c-3c0a34fee331",
].sort(), "exact 8J cohort drift");

for (const product of products.values()) {
  eq(product.subject.identity_status, "resolved", `${product.product_id} identity`);
  eq(product.subject.current_state, "current", `${product.product_id} subject current state`);
  ok(product.relevant_active_propositions.length >= 1, `${product.product_id} lacks relevant active`);
  for (const active of product.relevant_active_propositions) {
    eq(active.fact_key, "contains_active");
    eq(active.semantic_status, "supported");
    eq(active.authority_ceiling, "product_specific_primary");
    ok(["lactic_acid", "mandelic_acid", "salicylic_acid"].includes(active.typed_value), "non-v1 active leaked");
    ok(active.proposition_key && active.fact_instance_id, "active lineage missing");
    eq(active.provenance.binding_state, "exact_subject_match", "active binding not exact");
    eq(active.provenance.evidence_authority, "product_specific_primary", "active evidence authority");
  }
}

const ordinary = products.get("0b88019a-9eb2-4be9-842d-f1e60e42cf51");
const drg = products.get("c4a5f510-8d9e-46bd-a31c-3c0a34fee331");
const medicube = products.get("230f1c9c-cbf8-4458-aaac-ea1010a21e8c");

eq(ordinary.category, "treatment");
eq(drg.category, "toner_essence");
eq(medicube.category, "toner_pad");
eq(ordinary.relevant_active_propositions.map((x) => x.typed_value), ["mandelic_acid"]);
eq(drg.relevant_active_propositions.map((x) => x.typed_value), ["mandelic_acid"]);
eq(medicube.relevant_active_propositions.map((x) => x.typed_value).sort(), ["lactic_acid", "salicylic_acid"], "multi-active collapsed");

const ordinaryConcentrations = ordinary.context_facts.active_concentration.facts;
eq(ordinaryConcentrations.length, 1, "Ordinary concentration coverage drift");
const concentration = ordinaryConcentrations[0];
const mandelic = ordinary.relevant_active_propositions[0];
eq(concentration.parent_proposition_key, mandelic.proposition_key, "concentration parent proposition mismatch");
eq(concentration.parent_fact_instance_id, mandelic.fact_instance_id, "concentration parent Fact Instance mismatch");
eq(concentration.typed_value, { value: 10, unit: "percent" });
eq(drg.context_facts.active_concentration.presence, "missing_current");
eq(medicube.context_facts.active_concentration.presence, "missing_current");
eq(drg.context_facts.active_concentration.facts, []);
eq(medicube.context_facts.active_concentration.facts, []);
ok(drg.context_facts.active_concentration.missing_semantics.includes("NOT_ZERO"), "missing concentration became zero");
ok(medicube.context_facts.active_concentration.missing_semantics.includes("NOT_ZERO"), "missing concentration became zero");

eq(ordinary.context_facts.recommended_use_frequency.facts.length, 1);
eq(drg.context_facts.recommended_use_frequency.facts.length, 0);
eq(medicube.context_facts.recommended_use_frequency.facts.length, 0);
eq(drg.context_facts.product_format.facts[0].typed_value, "liquid");
eq(medicube.context_facts.product_format.facts[0].typed_value, "pad");
eq(medicube.context_facts.wipe_off_use.facts[0].typed_value, true);
eq(medicube.context_facts.pad_surface_texture.facts[0].typed_value, "embossed");

eq(input.input_semantics.active_concentration, "CONTEXT_PARENT_BOUND_NOT_CROSS_ACTIVE_POTENCY");
eq(input.input_semantics.recommended_use_frequency, "CONTEXT_INSTRUCTION_NOT_EFFICACY");
eq(input.input_semantics.product_format, "CONTEXT_NOT_EFFECT_MAGNITUDE");
eq(input.input_semantics.wipe_off_use, "CONTEXT_NOT_EFFECT_MAGNITUDE");
eq(input.input_semantics.pad_surface_texture, "CONTEXT_NOT_EFFECT_MAGNITUDE");
eq(input.contract.multi_value.arbitrary_first_selection, false);
eq(input.contract.multi_value.ungoverned_aggregation_authorized, false);
eq(input.external_research_performed, false);
eq(input.hosted_writes_performed, false);

eq(feasibility.verdict, "NO_VALID_CALIBRATION_ANCHOR_AVAILABLE");
ok(feasibility.candidates.every((candidate) => !["VALID_NUMERIC_ANCHOR", "VALID_ORDINAL_ANCHOR"].includes(candidate.anchor_validity)), "unauthorized anchor accepted");
const candidateByName = new Map(feasibility.candidates.map((candidate) => [candidate.candidate, candidate]));
eq(candidateByName.get("contains_active").role, "PREDICTOR");
for (const key of ["active_concentration", "recommended_use_frequency", "product_format", "wipe_off_use", "pad_surface_texture"]) {
  eq(candidateByName.get(key).role, "CONTEXT", `${key} role drift`);
  eq(candidateByName.get(key).anchor_validity, "INVALID_ANCHOR", `${key} incorrectly usable as anchor`);
}
for (const key of [
  "governed_direct_exfoliation_measurement",
  "governed_outcome_measurement",
  "authoritative_ordinal_exfoliation_label",
  "validated_transformation_or_benchmark_ground_truth",
]) {
  eq(candidateByName.get(key).role, "NOT_AVAILABLE", `${key} unexpectedly available`);
}
ok(feasibility.verdict_reason_codes.includes("PREDICTOR_AS_TARGET_WOULD_BE_CIRCULAR"));
ok(feasibility.verdict_reason_codes.includes("CROSS_ACTIVE_POTENCY_MAPPING_NOT_AUTHORIZED"));
ok(feasibility.verdict_reason_codes.includes("USAGE_INSTRUCTION_NOT_EFFICACY"));

eq(result.identifiability_analysis.independent_anchor_observations, 0);
eq(result.identifiability_analysis.free_model_parameters, 0);
eq(result.identifiability_analysis.fitting_status, "PROHIBITED_NO_TARGET");
eq(result.identifiability_analysis.context_coverage, {
  active_concentration: "1/3",
  recommended_use_frequency: "1/3",
  product_format: "2/3",
  wipe_off_use: "1/3",
  pad_surface_texture: "1/3",
});
eq(result.identifiability_analysis.multi_active_handling, "MULTI_ACTIVE_AGGREGATION_NOT_AUTHORIZED");
eq(result.identifiability_analysis.verdict, "NUMERIC_METHOD_NOT_IDENTIFIABLE_WITH_CURRENT_AUTHORITY");

eq(result.calibration.executed, false);
eq(result.calibration.mode, "none");
eq(result.calibration.target_or_anchor, null);
eq(result.calibration.parameters, []);
eq(result.calibration.outputs, []);
eq(result.invariants.ingredient_potency_constants, []);
eq(result.invariants.cross_active_numeric_normalization, false);
eq(result.invariants.synthetic_target_created, false);
eq(result.invariants.hosted_write_path_present, false);
eq(result.invariants.hosted_product_fact_writes_v21_8k, 0);
eq(result.invariants.external_product_evidence_research_v21_8k, 0);
eq(result.invariants.registry_definition_delta_v21_8k, 0);
eq(result.invariants.migration_delta_v21_8k, 0);
eq(result.invariants.pda_production_consumption_v21_8k, 0);
eq(result.invariants.recommendation_behavior_delta_v21_8k, 0);
eq(result.production_consumed, false);
eq(result.recommendation_activated, false);

const validated = result.outcome_flags.OFFLINE_CALIBRATION_METHOD_VALIDATED;
const gap = result.outcome_flags.NUMERIC_ANCHOR_GAP_CONFIRMED;
eq(Number(validated) + Number(gap), 1, "exactly one primary outcome flag required");
eq(validated, false);
eq(gap, true);
eq(result.outcome_flags.EXFOLIATION_LOAD_OFFLINE_CALIBRATED, false);
eq(result.primary_experiment_outcome, "NUMERIC_ANCHOR_GAP_CONFIRMED");
eq(result.next_stage_recommendation.stage, "Exfoliation Load Numeric Anchor / Evidence Contract Design");
eq(result.next_stage_recommendation.execute_now, false);

const replay = readJson(upstream.replay);
const exReplay = replay.axes.find((axis) => axis.axis_key === AXIS_KEY);
ok(exReplay, "8J exfoliation replay missing");
eq(exReplay.calibration_cohort_eligible_distinct_products, 3);
eq(exReplay.post_contract_readiness, "STRUCTURALLY_READY_FOR_BOUNDED_OFFLINE_CALIBRATION");
eq(exReplay.numeric_anchor_available, false);
eq(exReplay.category_topology_coverage.map((row) => [row.topology_key, row.eligible_distinct_products, row.met]), [
  ["treatment", 1, true],
  ["toner_essence", 1, true],
  ["toner_pad", 1, true],
]);
eq(replay.summary.structurally_ready_axes, ["exfoliation_load"]);
eq(replay.summary.all_estimates_remain_null, true);

console.log(JSON.stringify({
  version: "verify-exfoliation-load-calibration-wave-1-v1",
  status: "PASS",
  assertions,
  axis_key: AXIS_KEY,
  cohort_products: 3,
  feasibility_verdict: feasibility.verdict,
  identifiability_verdict: result.identifiability_analysis.verdict,
  primary_experiment_outcome: result.primary_experiment_outcome,
  calibration_executed: result.calibration.executed,
  hashes: EXPECTED_HASHES,
}));
