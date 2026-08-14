#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import {
  AXIS_KEY,
  EXPECTED_HASHES,
  OUTPUTS,
  UPSTREAM,
  buildAll,
  canonicalJson,
  sha256Text,
} from "./exfoliation-load-anchor-contract-v1.mjs";

let assertions = 0;
function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`assertion ${assertions} failed: ${message}`);
}
function hasAll(list, required) {
  return required.every((item) => list.includes(item));
}
function digestFile(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

const built = buildAll();
const { contract, replay } = built;

assert(contract.axis_key === AXIS_KEY, "axis must be exfoliation_load");
assert(contract.stage === "V2.1-8L", "stage");
assert(contract.authority.execution_main_sha === UPSTREAM.execution_main_sha, "main authority");
assert(contract.authority.v21_8k_result_sha256 === UPSTREAM.v21_8k_result_sha256, "8K result authority");
assert(contract.authority.v21_8j_contract_digest === UPSTREAM.v21_8j_contract_digest, "8J contract authority");
assert(contract.authority.registry_definition_count === 20, "definition count");
assert(contract.authority.registry_version === "product-fact-registry-cross-category-v1", "registry version");
assert(contract.frozen_findings.v21_8k_primary_outcome === "NUMERIC_ANCHOR_GAP_CONFIRMED", "8K outcome preserved");
assert(contract.frozen_findings.current_valid_numeric_anchor_count === 0, "numeric anchor count");
assert(contract.frozen_findings.current_valid_ordinal_anchor_count === 0, "ordinal anchor count");
assert(contract.frozen_findings.current_registry_fact_keys.length === 20, "registry key count");
assert(!contract.frozen_findings.current_registry_fact_keys.includes("exfoliation_response_change"), "proposed key absent from current Registry");
assert(contract.frozen_findings.current_registry_exfoliation_anchor_fact === "NONE", "no current anchor Fact");
assert(contract.frozen_findings.measurement_shaped_precedents.length === 2, "measurement precedents");
assert(contract.frozen_findings.measurement_shaped_precedents.some((x) => x.fact_key === "hydration_change"), "hydration precedent");
assert(contract.frozen_findings.measurement_shaped_precedents.some((x) => x.fact_key === "tewl_change"), "tewl precedent");

const roles = contract.frozen_findings.current_predictor_and_context_roles;
assert(roles.contains_active === "PREDICTOR_NOT_ANCHOR", "contains_active role");
assert(roles.active_concentration === "CONTEXT_NOT_ANCHOR", "concentration role");
assert(roles.recommended_use_frequency === "CONTEXT_NOT_ANCHOR", "frequency role");
assert(roles.product_format === "CONTEXT_NOT_ANCHOR", "format role");
assert(roles.wipe_off_use === "CONTEXT_NOT_ANCHOR", "wipe role");
assert(roles.pad_surface_texture === "CONTEXT_NOT_ANCHOR", "texture role");

const target = contract.anchor_target_contract;
assert(target.target_id === "protocol_scoped_final_product_exfoliation_response_change", "target id");
assert(target.final_product_outcome === true, "final product outcome");
assert(target.ingredient_level_potency_target === false, "not ingredient potency target");
assert(target.active_attribution_required === false, "no active attribution");
assert(target.universal_zero_to_one_scale_authorized === false, "no universal 0-1");
assert(target.cross_metric_pooling_authorized === false, "no cross metric pooling");
assert(target.directionality_rule.includes("declared"), "directionality declared");

const numericClass = contract.admissible_anchor_classes.find((x) => x.class === "PRODUCT_SPECIFIC_DIRECT_OR_OUTCOME_MEASUREMENT");
assert(Boolean(numericClass), "numeric measurement class exists");
assert(numericClass.satisfies_numeric_anchor === true, "numeric measurement class satisfies anchor");
assert(numericClass.requirements.includes("measurement evidence class"), "measurement evidence required");
assert(numericClass.requirements.includes("product_specific_primary authority"), "primary authority required");
assert(numericClass.requirements.includes("declared metric"), "metric required");
assert(numericClass.requirements.includes("declared source-native unit"), "unit required");
assert(numericClass.requirements.includes("declared baseline_or_comparator"), "baseline required");
assert(numericClass.requirements.includes("declared exposure protocol"), "exposure protocol required");
assert(numericClass.requirements.includes("declared timepoint"), "timepoint required");
assert(numericClass.requirements.includes("declared anatomical site"), "site required");
assert(numericClass.requirements.includes("independent of contains_active and context predictors"), "independence required");

const ordinalClass = contract.admissible_anchor_classes.find((x) => x.class === "AUTHORITATIVE_PROTOCOL_DEFINED_ORDINAL_OUTCOME");
assert(Boolean(ordinalClass), "ordinal class");
assert(ordinalClass.satisfies_numeric_anchor === false, "ordinal not numeric");
assert(ordinalClass.satisfies_ordinal_anchor_only === true, "ordinal only");
assert(ordinalClass.requirements.includes("no invented metric distances"), "no invented ordinal distance");

const rejected = new Map(contract.rejected_anchor_classes.map((x) => [x.candidate, x.reason]));
for (const key of ["contains_active","active_concentration","recommended_use_frequency","product_format","wipe_off_use","pad_surface_texture","treatment_claim","ingredient_potency_constants","synthetic_weighted_sum"]) {
  assert(rejected.has(key), `rejected anchor ${key}`);
}
assert(rejected.get("contains_active").includes("circular"), "contains_active circularity");
assert(rejected.get("active_concentration").includes("cross-active"), "concentration cross-active");
assert(rejected.get("synthetic_weighted_sum").includes("circular"), "synthetic target circularity");

const comp = contract.numeric_comparability_contract;
assert(comp.comparability_family_key_fields.length === 7, "comparability dimensions");
assert(hasAll(comp.comparability_family_key_fields, ["metric","unit","method_protocol_family","baseline_or_comparator_semantics","exposure_protocol","timepoint","anatomical_site"]), "comparability dimensions exact");
assert(comp.source_native_units_required === true, "source-native units");
assert(comp.unit_conversion_rule.includes("No unit conversion"), "conversion fail closed");
assert(comp.cross_active_rule.includes("No ingredient potency equivalence"), "no active potency equivalence");
assert(comp.cross_protocol_rule.includes("cannot be normalized"), "no cross-protocol normalization");

const multi = contract.multi_active_contract;
assert(multi.anchor_scope === "FINAL_PRODUCT_FORMULATION", "multi active final product");
assert(multi.preserve_all_relevant_active_lineages === true, "preserve lineages");
assert(multi.decompose_anchor_to_actives === false, "no anchor decomposition");
assert(multi.aggregation_rule.includes("No additive/mean/max"), "no arbitrary aggregation");
assert(multi.concentration_linkage_rule.includes("matching contains_active parent lineage"), "concentration lineage");

const proposed = contract.prospective_registry_fact_family;
assert(proposed.fact_key === "exfoliation_response_change", "proposed fact key");
assert(proposed.status === "DESIGNED_NOT_REGISTERED", "not registered");
assert(proposed.proposed_value_type === "range_unit", "proposed value type");
assert(proposed.cardinality === "many", "cardinality many");
assert(hasAll(proposed.domain_scope, ["treatment","toner_essence","toner_pad"]), "domain scope");
assert(proposed.permitted_evidence_classes.length === 1 && proposed.permitted_evidence_classes[0] === "measurement", "measurement only");
assert(proposed.authority_floor === "product_specific_primary", "authority floor");
assert(hasAll(proposed.required_context_fields, ["metric","method_context","timepoint","baseline_or_comparator","exposure_protocol","anatomical_site"]), "required measurement context");
assert(proposed.unit_schema_policy === "CLOSED_SOURCE_NATIVE_UNIT_SET_REQUIRED_BEFORE_REGISTRY_PUBLICATION", "closed unit policy");
assert(Array.isArray(proposed.allowed_units) && proposed.allowed_units.length === 0, "no invented units");
assert(proposed.registry_publication_ready === false, "publication not ready");
assert(proposed.publication_blocker.includes("No authoritative"), "publication blocker explicit");
assert(proposed.missing_semantics.includes("missing remains unknown"), "missing semantics");

const evidence = contract.anchor_evidence_contract;
assert(evidence.semantic_status_allowlist.length === 1 && evidence.semantic_status_allowlist[0] === "supported", "supported only");
assert(evidence.authority_floor === "product_specific_primary", "anchor authority");
assert(evidence.evidence_class_allowlist.length === 1 && evidence.evidence_class_allowlist[0] === "measurement", "anchor evidence class");
assert(evidence.required_provenance.length === 10, "required provenance");
assert(evidence.forbidden_surrogates.includes("ingredient identity"), "identity surrogate forbidden");
assert(evidence.forbidden_surrogates.includes("marketing exfoliation claim"), "claim surrogate forbidden");

const gate = contract.calibration_entry_gate;
assert(gate.structural_gate_source === "V2.1-8J", "structural gate source");
assert(gate.structural_eligible_product_floor === 3, "structural floor");
assert(gate.comparable_anchor_product_floor === 3, "anchor floor");
assert(gate.required_topology.length === 3, "topology count");
assert(hasAll(gate.required_topology, ["treatment","toner_essence","toner_pad"]), "topology");
assert(gate.partial_anchor_coverage_counts === false, "partial does not count");
assert(gate.ordinal_only_anchor_satisfies_numeric_gate === false, "ordinal does not satisfy numeric");
assert(gate.statistical_power_claimed === false, "no power claim");
assert(gate.future_identifiability_check_required === true, "future identifiability");
assert(gate.future_generalization_validation_required === true, "future validation");

const research = contract.targeted_research_contract;
assert(research.research_allowed_in_v21_8l === false, "no 8L research");
assert(research.next_research_ready === true, "research ready");
assert(research.exact_products.length === 3, "research cohort size");
assert(new Set(research.exact_products.map((x) => x.product_id)).size === 3, "unique products");
assert(new Set(research.exact_products.map((x) => x.category)).size === 3, "three topologies");
assert(research.admissible_result_states.length === 5, "research terminal states");
assert(research.stop_rule.includes("Do not expand"), "bounded research");
assert(research.registry_materialization_rule.includes("separately approved Registry"), "separate registry gate");

const outcome = contract.stage_outcome;
assert(outcome.anchor_contract_validated === true, "anchor contract validated");
assert(outcome.current_registry_contains_numeric_anchor_fact === false, "no current numeric anchor");
assert(outcome.current_registry_contains_ordinal_anchor_fact === false, "no current ordinal anchor");
assert(outcome.measurement_shaped_storage_pattern_exists === true, "measurement architecture exists");
assert(outcome.new_registry_fact_family_required_before_materialization === true, "registry definition required");
assert(outcome.registry_publication_ready_now === false, "registry not ready");
assert(outcome.targeted_anchor_evidence_research_ready === true, "targeted research ready");
assert(outcome.primary_outcome === "NUMERIC_ANCHOR_EVIDENCE_CONTRACT_DESIGNED", "primary outcome");
assert(outcome.disposition.includes("TARGETED_ANCHOR_EVIDENCE_ACQUISITION_REQUIRED"), "disposition");

const inv = contract.invariants;
assert(inv.hosted_product_fact_writes_v21_8l === 0, "Hosted writes zero");
assert(inv.external_product_evidence_research_v21_8l === 0, "external research zero");
assert(inv.registry_definition_delta_v21_8l === 0, "Registry delta zero");
assert(inv.migration_delta_v21_8l === 0, "migration delta zero");
assert(inv.numeric_fitting_v21_8l === 0, "numeric fit zero");
assert(inv.pda_production_consumption_v21_8l === 0, "production consumption zero");
assert(inv.recommendation_behavior_delta_v21_8l === 0, "recommendation delta zero");
assert(inv.production_mapper_changed === false, "mapper unchanged");
assert(inv.recommendation_activated === false, "activation false");

assert(contract.next_stage_recommendation.stage === "Exfoliation Load Targeted Numeric Anchor Evidence Research Wave 1", "next stage");
assert(contract.next_stage_recommendation.execute_now === false, "next stage not executed");
assert(contract.next_stage_recommendation.will_not_do.includes("numeric fitting"), "next stage no fitting");
assert(contract.next_stage_recommendation.will_not_do.includes("Hosted Product Fact writes"), "next stage no hosted writes in design");

assert(replay.registry_replay.fact_keys.length === 20, "replay registry count");
assert(replay.registry_replay.proposed_anchor_fact_present === false, "replay proposed fact absent");
assert(replay.registry_replay.measurement_storage_pattern_reusable === true, "replay storage reusable");
assert(replay.registry_replay.registry_definition_needed_before_materialization === true, "replay registry definition needed");
assert(replay.cohort_replay.distinct_product_count === 3, "replay cohort");
assert(replay.cohort_replay.topology_distribution.treatment === 1, "treatment topology");
assert(replay.cohort_replay.topology_distribution.toner_essence === 1, "toner essence topology");
assert(replay.cohort_replay.topology_distribution.toner_pad === 1, "toner pad topology");
assert(replay.cohort_replay.current_numeric_anchor_observations === 0, "replay numeric observations");
assert(replay.cohort_replay.current_ordinal_anchor_observations === 0, "replay ordinal observations");
assert(replay.cohort_replay.current_comparable_anchor_families === 0, "replay comparable families");
assert(replay.contract_application.current_predictor_signal_available === true, "predictor signal present");
assert(replay.contract_application.current_anchor_available === false, "anchor absent");
assert(replay.contract_application.universal_zero_to_one_mapping_authorized === false, "no universal mapping");
assert(replay.contract_application.cross_active_potency_mapping_authorized === false, "no potency mapping");
assert(replay.contract_application.synthetic_target_authorized === false, "no synthetic target");
assert(replay.contract_application.next_research_gate === "TARGETED_ANCHOR_EVIDENCE_RESEARCH_READY", "research gate");
assert(replay.contract_application.registry_publication_gate === "WAIT_FOR_SOURCE_NATIVE_METRIC_UNIT_AUTHORITY", "registry gate");
assert(replay.contract_application.calibration_gate === "NOT_READY_NO_COMPARABLE_ANCHOR_SET", "calibration gate");
assert(replay.primary_outcome === outcome.primary_outcome, "replay outcome");
assert(replay.execute_next_stage === false, "replay no execution");

for (const [key, expected] of Object.entries(EXPECTED_HASHES)) {
  assert(digestFile(OUTPUTS[key]) === expected, `file hash ${key}`);
  assert(sha256Text(built.rendered[key]) === expected, `rendered hash ${key}`);
}
assert(canonicalJson(contract) === built.rendered.contract, "canonical contract bytes");
assert(canonicalJson(replay) === built.rendered.replay, "canonical replay bytes");

console.log(JSON.stringify({
  status: "PASS",
  assertions,
  stage: "V2.1-8L",
  axis_key: AXIS_KEY,
  primary_outcome: outcome.primary_outcome,
  registry_publication_ready: outcome.registry_publication_ready_now,
  targeted_anchor_evidence_research_ready: outcome.targeted_anchor_evidence_research_ready,
  next_stage: contract.next_stage_recommendation.stage,
}));
