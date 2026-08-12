#!/usr/bin/env node
import assert from "node:assert/strict";
import { buildArtifact } from "./build-product-decision-axis-cross-category-v1.mjs";
import { resolveProductCurrentFactGroups } from "./product-evidence/product-fact-current-group-resolver-v1.mjs";

const output = buildArtifact();
let assertions = 0;
function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions += 1; }
function ok(value, message) { assert.ok(value, message); assertions += 1; }
function byPilot(id) { const product = output.products.find((item) => item.pilot_id === id); ok(product, `missing ${id}`); return product; }
function group(product, factKey) { return product.groups.find((item) => item.fact_key === factKey); }

// Cross-category output envelope.
eq(output.summary.products, 12);
eq(output.summary.categories, 4);
eq(output.summary.axis_keys, 3);
eq(output.summary.axis_outputs, 12);
eq(output.summary.numeric_estimates, 0);
eq(output.summary.null_estimates, 12);
eq(output.summary.identity_blocked_products, 1);
eq(output.summary.coverage_counts, {
  active_identity_only: 1,
  active_identity_with_unscaled_context: 1,
  claim_only: 1,
  corroborated_fact: 2,
  identity_blocked: 1,
  missing_fact: 3,
  no_relevant_fact: 2,
  partial_fact_coverage: 1,
});

// Sunscreen: label facts retain market/variant scope; missing water resistance is not false/zero.
for (const id of ["S1", "S3"]) {
  const product = byPilot(id);
  eq(product.axis.axis_key, "photo_protection");
  eq(product.axis.coverage, "corroborated_fact");
  eq(product.axis.estimate, null);
  ok(product.axis.fact_inputs.some((fact) => fact.fact_key === "spf_value"));
  ok(product.axis.fact_inputs.some((fact) => fact.fact_key === "uva_label"));
  ok(product.axis.reason_codes.includes("market_variant_scope_preserved_per_fact"));
  ok(product.axis.reason_codes.includes("water_resistance_missing_does_not_negate_uv_protection"));
  ok(product.axis.scope_set.every((scope) => scope.market !== null), `${id} scope lost`);
}
const s2 = byPilot("S2");
eq(s2.axis.coverage, "partial_fact_coverage");
eq(s2.axis.estimate, null);
ok(s2.axis.reason_codes.includes("water_resistance_missing_does_not_negate_uv_protection"));

// Treatment: cardinality-many active identity is preserved; concentration/use are context, never magnitude.
const t1 = byPilot("T1");
eq(t1.axis.coverage, "no_relevant_fact");
eq(t1.axis.estimate, null);
const t2 = byPilot("T2");
eq(t2.axis.coverage, "active_identity_with_unscaled_context");
eq(t2.axis.estimate, null);
eq(group(t2, "contains_active").cardinality, "many");
eq(group(t2, "contains_active").facts.length, 2);
ok(t2.axis.fact_inputs.some((fact) => fact.typed_value === "mandelic_acid"));
ok(t2.axis.reason_codes.includes("active_identity_relevant_but_not_exfoliation_intensity"));
ok(t2.axis.reason_codes.includes("concentration_preserved_as_context_not_generic_effect_magnitude"));
ok(t2.axis.reason_codes.includes("usage_instruction_preserved_not_efficacy"));
const t3 = byPilot("T3");
eq(t3.axis.coverage, "no_relevant_fact");
eq(t3.axis.estimate, null);
ok(group(t3, "contains_active").facts.length >= 2, "T3 multi-active identities collapsed");

// Moisturizer: role stays role; only barrier claim contributes to the axis.
const m1 = byPilot("M1");
eq(m1.axis.coverage, "missing_fact");
ok(m1.axis.reason_codes.includes("source_blocked_preserved_as_missing_fact_not_false"));
const m2 = byPilot("M2");
eq(m2.axis.coverage, "claim_only");
eq(m2.axis.estimate, null);
eq(m2.axis.fact_inputs.length, 1);
eq(m2.axis.fact_inputs[0].fact_key, "barrier_support_claim");
ok(m2.axis.reason_codes.includes("usage_role_context_excluded_from_efficacy_contribution"));
const m3 = byPilot("M3");
eq(m3.axis.coverage, "missing_fact");
ok(m3.axis.reason_codes.includes("source_blocked_preserved_as_missing_fact_not_false"));

// Toner/pad: source shortage and identity ambiguity fail closed; physical pad facts do not become intensity.
const p1 = byPilot("P1");
eq(p1.axis.coverage, "missing_fact");
ok(p1.axis.reason_codes.includes("source_blocked_preserved_as_missing_fact_not_false"));
const p2 = byPilot("P2");
eq(p2.identity_status, "ambiguous");
eq(p2.axis.coverage, "identity_blocked");
eq(p2.axis.fact_inputs.length, 0);
const p3 = byPilot("P3");
eq(p3.axis.coverage, "active_identity_only");
eq(p3.axis.estimate, null);
eq(group(p3, "contains_active").facts.length, 2);
eq(new Set(group(p3, "contains_active").facts.map((fact) => fact.typed_value)), new Set(["lactic_acid", "salicylic_acid"]));
const activeFamily = p3.axis.signal_families.find((item) => item.signal_family === "exfoliating_active_identity");
ok(activeFamily);
eq(activeFamily.raw_fact_count, 2);
eq(activeFamily.contribution_units, 1);
ok(p3.axis.reason_codes.includes("active_concentration_not_established_not_zero"));
ok(p3.axis.reason_codes.includes("format_usage_surface_not_reinterpreted_as_skin_effect_magnitude"));

// New Facts do not create axes automatically; all numeric magnitudes stay fail-closed before calibration.
eq(output.axis_contract.fact_registry_auto_axis_creation, false);
ok(output.authority.registry_blob.length === 40);
ok(output.summary.axis_keys < 20, "registry growth leaked into axis count");
ok(output.products.every((product) => product.axis.estimate === null));
eq(output.lifecycle.DECISION_AXIS_CONSUMPTION, false);
eq(output.lifecycle.RECOMMENDATION_ACTIVATED, false);
eq(output.lifecycle.HOSTED_PRODUCT_FACT_WRITES, 0);

// Production resolver contract: cardinality-many survives, cardinality-one duplicate fails closed.
const rowBase = {
  product_id: "product-x", subject_id: "subject-x", identity_status: "resolved", subject_current_state: "current",
  confirmation_id: "confirmation-x", registry_version: "registry-x", semantic_status: "supported", value_type: "entity_identifier",
  value_boolean: null, value_enum: null, value_number: null, value_unit: null, value_range_min: null, value_range_max: null,
  authority_ceiling: "product_specific_primary", fused_confidence: "high", fusion_policy_version: "fusion-x",
  fusion_input_digest: "a".repeat(64), market: "KR", region: null, locale: null, valid_from: null, valid_to: null,
  qualifier: {}, parent_proposition_key: null, parent_fact_instance_id: null, subject_variant_key: "variant-x",
  subject_formulation_revision_key: "formulation-x", subject_market_applicability: "KR", subject_region_applicability: null,
};
const manyRows = [
  { ...rowBase, fact_key: "contains_active", proposition_key: "1".repeat(64), fact_instance_id: "fact-1", value_entity_identifier: "a" },
  { ...rowBase, fact_key: "contains_active", proposition_key: "2".repeat(64), fact_instance_id: "fact-2", value_entity_identifier: "b" },
];
const grouped = resolveProductCurrentFactGroups({ product_id: "product-x", current_rows: manyRows, fact_definitions: [{ fact_key: "contains_active", cardinality: "many" }], fact_keys: ["contains_active"] });
eq(grouped.groups[0].facts.length, 2);
eq(grouped.groups[0].facts[0].scope.subject_variant_key, "variant-x");
assert.throws(() => resolveProductCurrentFactGroups({ product_id: "product-x", current_rows: manyRows.map((row) => ({ ...row, fact_key: "spf_value", value_type: "number", value_number: 50, value_entity_identifier: null })), fact_definitions: [{ fact_key: "spf_value", cardinality: "one" }], fact_keys: ["spf_value"] }), /cardinality-one/); assertions += 1;

console.log("PASS verify-product-decision-axis-cross-category-v1");
console.log(`assertions=${assertions}`);
console.log(`products=${output.summary.products} categories=${output.summary.categories} axes=${output.summary.axis_outputs} axis_keys=${output.summary.axis_keys}`);
console.log(`coverage=${JSON.stringify(output.summary.coverage_counts)}`);
console.log(`numeric_estimates=${output.summary.numeric_estimates} null_estimates=${output.summary.null_estimates}`);
console.log(`p3_raw_active_facts=${activeFamily.raw_fact_count} p3_signal_family_units=${activeFamily.contribution_units}`);
console.log("mandatory_cleanser_acceptance=DELEGATED_TO_V21_5_VERIFIER");
console.log("review_uncertainty_acceptance=DELEGATED_TO_V21_4_VERIFIER");
console.log("production_invariance=CI_GATE");
console.log("decision_axis_consumption=NO recommendation_activation=NO hosted_writes=0");
