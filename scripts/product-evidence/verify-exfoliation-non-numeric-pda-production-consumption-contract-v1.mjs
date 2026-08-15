#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";

const STAGE = "V2.1-8U";
const TERMINAL = "PRODUCTION_CONSUMPTION_CONTRACT_FROZEN";
const BASE = "d988f33664e3086250e2595b55319aa18e127608";
const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v1";
const CONTRACT = `${ROOT}/exfoliation-non-numeric-pda-production-consumption-contract-v1.json`;
const PRECEDENCE = `${ROOT}/exfoliation-non-numeric-pda-authority-precedence-matrix-v1.json`;
const MIGRATION = `${ROOT}/exfoliation-non-numeric-pda-legacy-migration-compatibility-matrix-v1.json`;
const EXAMPLES = `${ROOT}/exfoliation-non-numeric-pda-production-consumption-canonical-examples-v1.json`;
const READINESS_8T = `${ROOT}/exfoliation-non-numeric-pda-production-consumption-readiness-summary-v1.json`;
const TAXONOMY_8T = `${ROOT}/exfoliation-non-numeric-pda-shadow-divergence-taxonomy-v1.json`;
const OUTPUT_8P = `${ROOT}/exfoliation-non-numeric-pda-offline-shadow-output-v1.json`;

let assertions = 0;
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions += 1; };
const ok = (value, message) => { assert.ok(value, message); assertions += 1; };
const read = (path) => fs.readFileSync(path, "utf8");
const json = (path) => JSON.parse(read(path));
const sha = (path) => crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex");
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const canonical = (path) => `${JSON.stringify(stable(json(path)))}\n`;

const contract = json(CONTRACT);
const precedence = json(PRECEDENCE);
const migration = json(MIGRATION);
const examples = json(EXAMPLES);
const readiness8t = json(READINESS_8T);
const taxonomy8t = json(TAXONOMY_8T);

for (const path of [CONTRACT, PRECEDENCE, MIGRATION, EXAMPLES]) {
  eq(read(path), canonical(path), `${path} canonical bytes`);
}

eq(contract.stage, STAGE, "contract stage");
eq(contract.terminal_outcome, TERMINAL, "terminal exact");
eq(contract.version, "exfoliation-non-numeric-pda-production-consumption-contract-v1", "contract version");
eq(contract.execution_authority.v21_8t_merged_main_sha, BASE, "8T main authority");
eq(contract.execution_authority.upstream_8t_terminal, "PRODUCTION_CONSUMPTION_CONTRACT_DESIGN_READY", "8T readiness authority");
eq(readiness8t.primary_terminal_outcome, "PRODUCTION_CONSUMPTION_CONTRACT_DESIGN_READY", "frozen 8T terminal");
eq(readiness8t.evidence_assessment.semantic_incompatibility_blocker_found, false, "8T no semantic blocker");
eq(taxonomy8t.comparison_principles.clear_not_production_approval, true, "8T clear boundary");
eq(taxonomy8t.comparison_principles.restrict_not_production_block, true, "8T restrict boundary");
eq(sha(OUTPUT_8P), "03d4446fd7ea1ce8dd23c44bb6c641804bd3394b4aab39db9ee0d7e021029624", "frozen 8P bytes");

const gates = contract.canonical_input_shape.consumption_gate.state;
eq(gates, [
  "READY_FOR_SEPARATE_POLICY_EVALUATION",
  "DEFER_INSUFFICIENT_AUTHORITY",
  "DEFER_BLOCKED_AUTHORITY",
  "DEFER_CONTEXT_CONFLICT",
  "NOT_APPLICABLE"
], "neutral gate enum exact");
eq(contract.canonical_input_shape.consumption_gate.final_decision_authority, "SEPARATE_VERSIONED_PRODUCTION_POLICY_REQUIRED", "separate final policy");
eq(contract.contract_mode, "DESIGN_FROZEN_NO_RUNTIME_IMPLEMENTATION", "no runtime implementation");
eq(contract.activation_boundary.current_stage_authorizes_activation, false, "no activation");
eq(contract.activation_boundary.production_activation_authorized, false, "activation unauthorized");
eq(contract.activation_boundary.production_behavior_change_authorized, false, "no production behavior authorization");

eq(contract.authority_model.global_rule, "DOMAIN_SCOPED_AUTHORITY_PRECEDENCE_NO_CROSS_DOMAIN_OVERRIDE", "domain-scoped authority");
ok(contract.authority_model.intrinsic_exfoliation_pda.cannot_be_overridden_by.includes("legacy ingredient count"), "legacy count cannot override");
ok(contract.authority_model.legacy_heuristics.forbidden_roles.includes("PDA missing-value filler"), "legacy cannot fill missing");
eq(contract.authority_model.production_policy.current_authority_unchanged, true, "production authority unchanged");
eq(contract.authority_model.production_policy.contract_role, "CONSUMPTION_INPUT_ONLY_NOT_FINAL_DECISION", "contract not final decision");

const forbidden = new Set(contract.forbidden_inferences);
for (const item of [
  "NUMERIC_POTENCY",
  "ORDINAL_POTENCY",
  "STRONGER_WEAKER_ORDERING",
  "IDENTITY_COUNT_TO_MAGNITUDE",
  "MULTIPLE_TO_STRONGER",
  "CONCENTRATION_TO_CROSS_ACTIVE_MAGNITUDE",
  "UNKNOWN_TO_FALSE",
  "MISSING_TO_ZERO",
  "CLEAR_TO_PRODUCTION_ALLOW",
  "RESTRICT_TO_PRODUCTION_BLOCK",
  "LEGACY_STRENGTH_TO_GOVERNED_AUTHORITY",
  "DIRECT_PDA_TO_SCORE",
  "DIRECT_PDA_TO_RANK",
  "DIRECT_PDA_TO_ELIGIBILITY"
]) ok(forbidden.has(item), `forbidden ${item}`);

eq(contract.multi_active_semantics.multiple_is_stronger, false, "multiple not stronger");
eq(contract.multi_active_semantics.identity_count_is_potency, false, "count not potency");
eq(contract.multi_active_semantics.identity_ordering, "NONE", "no identity ordering");
eq(contract.multi_active_semantics.cross_product_overlap_rule, "GOVERNED_IDENTITY_SET_INTERSECTION_ONLY", "identity intersection only");
eq(contract.product_context_semantics.active_concentration.cross_active_magnitude_inference, false, "concentration no cross-active magnitude");
eq(contract.product_context_semantics.recommended_use_frequency.potency_inference, false, "frequency no potency");

eq(precedence.stage, STAGE, "precedence stage");
eq(precedence.execution_authority.main_sha, BASE, "precedence authority");
eq(precedence.global_rule, contract.authority_model.global_rule, "precedence global rule");
eq(precedence.matrix.length, 9, "precedence rows");
ok(precedence.matrix.some((row) => row.resolution === "DEFER_BLOCKED_AUTHORITY"), "blocked precedence");
ok(precedence.matrix.some((row) => row.resolution === "NO_RUNTIME_OVERRIDE_IN_V21_8U"), "current production authority preserved");

eq(migration.stage, STAGE, "migration stage");
eq(migration.execution_authority.main_sha, BASE, "migration authority");
eq(migration.matrix.length, 6, "migration rows");
for (const row of migration.matrix) {
  ok(!String(row.governed_equivalent).toLowerCase().includes("potency"), `${row.surface} no governed potency equivalence`);
}
ok(migration.matrix.some((row) => row.surface.startsWith("ProductFunctionalProfile")), "legacy profile inventoried");
ok(migration.matrix.some((row) => row.surface.startsWith("FunctionalRankingContract")), "legacy numeric ranking inventoried");
ok(migration.matrix.some((row) => row.surface.startsWith("CandidateExposurePolicy")), "candidate policy boundary inventoried");

function gateFor(input) {
  if (input.signal_status === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (
    input.blocked === true ||
    input.signal_status === "GOVERNED_SIGNAL_BLOCKED" ||
    ["conflict_blocked", "identity_blocked"].includes(input.coverage_state)
  ) return "DEFER_BLOCKED_AUTHORITY";
  if (
    input.signal_status === "GOVERNED_SIGNAL_UNKNOWN" ||
    (Array.isArray(input.missing_context_keys) && input.missing_context_keys.length > 0) ||
    ["insufficient_fact", "missing_fact", "category_unknown"].includes(input.coverage_state) ||
    ["partial", "unknown"].includes(input.external_context_completeness)
  ) return "DEFER_INSUFFICIENT_AUTHORITY";
  if (input.semantic_conflict === true || input.external_context_completeness === "conflict") {
    return "DEFER_CONTEXT_CONFLICT";
  }
  return "READY_FOR_SEPARATE_POLICY_EVALUATION";
}

function overlapFor(input) {
  if (input.signal_status === "NOT_APPLICABLE") return "not_applicable";
  if (input.blocked === true || input.signal_status === "GOVERNED_SIGNAL_BLOCKED") return "blocked";
  if (
    input.signal_status === "GOVERNED_SIGNAL_UNKNOWN" ||
    ["partial", "unknown", "conflict"].includes(input.external_context_completeness)
  ) return "unknown";
  const active = new Set(Array.isArray(input.active_identities) ? input.active_identities : []);
  const current = (Array.isArray(input.current_identity_sets) ? input.current_identity_sets : []).flat();
  return current.some((identity) => active.has(identity)) ? "present" : "not_established";
}

eq(examples.stage, STAGE, "examples stage");
eq(examples.execution_authority.main_sha, BASE, "examples authority");
eq(examples.cases.length, 12, "12 canonical examples");
for (const row of examples.cases) {
  eq(gateFor(row.input), row.expected.gate, `${row.case_id} gate`);
  eq(overlapFor(row.input), row.expected.identity_overlap, `${row.case_id} overlap`);
  eq(row.expected.production_decision, "UNSPECIFIED", `${row.case_id} final decision unspecified`);
}
eq(examples.cases.find((row) => row.case_id === "complete_multi_active_unordered").expected.semantic_ordering, "NONE", "multi active ordering none");
eq(examples.cases.find((row) => row.case_id === "reviewed_no_relevant_signal_complete").expected.negative_signal_claim, false, "no false negative claim");

const explicitNo = contract.explicit_no;
eq(explicitNo, {
  candidate_policy_production_changed: false,
  decision_axis_production_consumption: false,
  hosted_product_fact_writes: 0,
  legacy_heuristic_replaced: false,
  migration_delta: 0,
  numeric_fitting: 0,
  potency_ordering_created: false,
  production_activation_authorized: false,
  production_consumption_runtime_implemented: false,
  recommendation_activated: false,
  recommendation_scorer_changed: false,
  registry_definition_delta: 0,
  shadow_clear_promoted_to_allow: false,
  shadow_restrict_promoted_to_block: false
}, "explicit NO exact");

const consumerSource = read("lib/exfoliation-non-numeric-pda-shadow-consumer.js");
const candidatePolicySource = read("lib/candidate-exposure-policy.js");
const candidateContractSource = read("lib/candidate-exposure-policy-contract.js");
const functionalProfileSource = read("lib/product-functional-profile.js");
const rankingSource = read("lib/functional-ranking-contract.js");
const routineSource = read("lib/routine-policy.js");
const guardSource = read("lib/recent-instability-guard-policy.js");

ok(consumerSource.includes("production_authority: false"), "8S remains non-production authority");
ok(consumerSource.includes("CAUTION_RESTRICTION_SHADOW_INPUT_PROJECTION_ONLY"), "8S decision basis frozen");
ok(!candidatePolicySource.includes("exfoliation-non-numeric-pda-production-consumption-contract-v1"), "CandidatePolicy does not consume 8U contract");
for (const exposure of ["primary", "contextual", "collapsed", "hidden", "insufficient_evidence"]) {
  ok(candidateContractSource.includes(`"${exposure}"`), `candidate exposure ${exposure} preserved`);
}
ok(functionalProfileSource.includes("function strengthFromCount(count)"), "legacy count strength still exists");
for (const token of ['return "low";', 'return "medium";', 'return "high";']) ok(functionalProfileSource.includes(token), `legacy strength ${token}`);
for (const token of ["const STRENGTH_SCORE", "low: 0.35", "medium: 0.7", "high: 1"]) ok(rankingSource.includes(token), `legacy numeric dependency ${token}`);
ok(routineSource.includes("duplicateAxisBurden"), "routine external burden preserved");
ok(routineSource.includes("prohibitedSameWindow"), "routine window policy preserved");
ok(guardSource.includes('"hard_block_candidate"'), "existing safety hard block remains separate");
ok(guardSource.includes('"allow_with_context"'), "existing safety allow-with-context remains separate");

const docs = read("docs/evidence/exfoliation-non-numeric-pda-production-consumption-contract-v1.md");
ok(docs.includes(TERMINAL), "docs terminal");
ok(docs.includes("READY_FOR_SEPARATE_POLICY_EVALUATION"), "docs neutral gate");
ok(docs.includes("Every example keeps `production_decision = UNSPECIFIED`."), "docs no final decision");
ok(!docs.includes("PRODUCTION_CONSUMPTION_CONTRACT_REQUIRES_POLICY_DECISION`"), "docs do not freeze B");
ok(!docs.includes("PRODUCTION_CONSUMPTION_CONTRACT_BLOCKED_BY_SEMANTIC_INCOMPATIBILITY`"), "docs do not freeze C");

console.log(JSON.stringify({
  stage: STAGE,
  terminal: TERMINAL,
  assertions,
  canonical_examples: examples.cases.length,
  precedence_rows: precedence.matrix.length,
  migration_rows: migration.matrix.length,
  production_runtime_implemented: false,
  production_activation_authorized: false
}, null, 2));
