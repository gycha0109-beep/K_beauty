import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  V21_9P_FALLBACK_CLASSES,
  V21_9P_GOVERNANCE_STATES,
  V21_9P_HARD_BLOCKERS,
  V21_9P_NON_PROMOTABLE_EVIDENCE,
  V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT,
  V21_9P_OBJECTIVE_REGISTRY,
  V21_9P_PRIMARY_OUTCOME,
  V21_9P_RUNTIME_ERROR_CLASSES,
  evaluateV21_9PNormativeAcceptance,
  serializeV21_9P
} from "../../lib/exfoliation-normative-policy-reassessment-normative-acceptance.js";
import { V21_9O_UNRESOLVED_GOVERNANCE } from "../../lib/exfoliation-normative-policy-reassessment-calibration-methodology.js";
import {
  V21_9N_CALIBRATION_PARAMETERS,
  V21_9N_DECISION_STATES
} from "../../lib/exfoliation-normative-policy-reassessment-sufficiency.js";

const manifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../fixtures/exfoliation-normative-reassessment-normative-acceptance-fixtures-v1.json",
      import.meta.url
    ),
    "utf8"
  )
);

assert.deepEqual(
  manifest.map((fixture) => fixture.id),
  ["F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16"]
);

const empiricalObjectiveKeys = V21_9O_UNRESOLVED_GOVERNANCE.slice(0, -1);
const pendingStates = Object.fromEntries(empiricalObjectiveKeys.map((key) => [key, "PENDING"]));
const passStates = Object.fromEntries(empiricalObjectiveKeys.map((key) => [key, "PASS"]));

const base = Object.freeze({
  organic_execution_count: 1,
  normative_contract_frozen: true,
  promotion_rule_present: true,
  organic_safety_coverage_observed: true,
  context_breadth_observed: true,
  runtime_error_class: "CONTAINED_OBSERVABLE_RUNTIME_ERROR",
  fallback_class: "EXPECTED_GRACEFUL_DEGRADATION",
  evidence_schema_valid: true,
  provenance_valid: true
});

function evaluate(overrides = {}) {
  return evaluateV21_9PNormativeAcceptance({ ...base, ...overrides });
}

const f1 = evaluate({ organic_execution_count: 0 });
assert.equal(f1.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.ok(f1.reason_codes.includes("zero_error_fallback_unknown_is_unobserved_not_healthy"));

for (const [id, overrides] of [
  ["F2", {}],
  ["F3", { runtime_pattern: "ISOLATED", runtime_error_class: "CONTAINED_OBSERVABLE_RUNTIME_ERROR" }],
  ["F4", { runtime_pattern: "REPEATED", runtime_error_class: "CONTAINED_OBSERVABLE_RUNTIME_ERROR" }],
  ["F5", { fallback_pattern: "ISOLATED", fallback_class: "INTENDED_SAFETY_FALLBACK" }],
  ["F6", { fallback_pattern: "REPEATED", fallback_class: "UNEXPECTED_FALLBACK" }],
  ["F7", { correctly_separated_unknown_observed: true }],
  ["F14", {}]
]) {
  const r = evaluate(overrides);
  assert.equal(r.decision_state, V21_9N_DECISION_STATES.CALIBRATION_REQUIRED, id);
  assert.equal(r.ready_for_separate_enforce_reassessment, false, id);
}

const f8 = evaluate({ unknown_promoted_as_organic: true, calibrated_values_locked: true });
assert.equal(f8.decision_state, V21_9N_DECISION_STATES.BLOCKED);
assert.ok(f8.hard_blockers.includes("UNKNOWN_EVIDENCE_PROMOTED_AS_ORGANIC"));

const f9 = evaluate({ actual_exclusion_count: 1, calibrated_values_locked: true });
assert.equal(f9.decision_state, V21_9N_DECISION_STATES.BLOCKED);
assert.ok(f9.hard_blockers.includes("SHADOW_ACTUAL_EXCLUSION_NONZERO"));

const f10 = evaluate({
  synthetic_safety_reachability_complete: true,
  controlled_safety_reachability_complete: true,
  organic_safety_coverage_observed: false
});
assert.equal(f10.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.ok(f10.reason_codes.includes("safety_relevant_organic_coverage_unobserved"));

const f11 = evaluate({ organic_execution_count: 999999, context_breadth_observed: false });
assert.equal(f11.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.ok(f11.reason_codes.includes("context_breadth_objective_unobserved"));

const f12 = evaluate({ objective_states: pendingStates, runtime_pattern: "REPEATED" });
assert.equal(f12.decision_state, V21_9N_DECISION_STATES.CALIBRATION_REQUIRED);
assert.equal(f12.ready_for_separate_enforce_reassessment, false);

const f13 = evaluate({
  objective_states: passStates,
  calibrated_values_locked: true,
  independent_validation_passed: true,
  sequestered_holdout_passed: true,
  successor_sufficiency_policy_frozen: true,
  promotion_rule_present: false
});
assert.equal(f13.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.equal(f13.governance_state, V21_9P_GOVERNANCE_STATES.NORMATIVE_ACCEPTANCE_INCOMPLETE);

const f15 = evaluate({ operator_invented_tolerance: true });
assert.equal(f15.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.equal(f15.governance_state, V21_9P_GOVERNANCE_STATES.REJECTED_BY_GOVERNANCE);

const f16 = evaluate({ external_threshold_imported_directly: true });
assert.equal(f16.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.equal(f16.governance_state, V21_9P_GOVERNANCE_STATES.REJECTED_BY_GOVERNANCE);

assert.deepEqual(
  V21_9P_OBJECTIVE_REGISTRY.map((objective) => objective.id),
  V21_9O_UNRESOLVED_GOVERNANCE
);
assert.equal(new Set(V21_9P_OBJECTIVE_REGISTRY.map((objective) => objective.id)).size, V21_9O_UNRESOLVED_GOVERNANCE.length);
assert.ok(V21_9P_OBJECTIVE_REGISTRY.every((objective) => objective.compensation_allowed === false));

assert.ok(V21_9P_HARD_BLOCKERS.includes("UNAUTHORIZED_ENFORCE_ACTIVATION"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("SHADOW_ACTUAL_EXCLUSION_NONZERO"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("CONTROLLED_EVIDENCE_ATTRIBUTED_AS_ORGANIC"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("UNKNOWN_EVIDENCE_PROMOTED_AS_ORGANIC"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("PRODUCT_FACT_UNEXPECTED_MUTATION"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("CANONICAL_RECOMMENDATION_MUTATION_FROM_SHADOW_POLICY"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("EVIDENCE_SCHEMA_INVALID_OR_PROVENANCE_BROKEN"));
assert.ok(V21_9P_HARD_BLOCKERS.includes("STOP_REQUIRED_INTEGRITY_FAILURE"));

assert.ok(V21_9P_NON_PROMOTABLE_EVIDENCE.includes("SYNTHETIC_ONLY_MATURITY_CLAIM"));
assert.ok(V21_9P_NON_PROMOTABLE_EVIDENCE.includes("CONTROLLED_ONLY_MATURITY_CLAIM"));
assert.ok(V21_9P_NON_PROMOTABLE_EVIDENCE.includes("CROSS_MARGINAL_RECONSTRUCTED_PSEUDO_USER_EVIDENCE"));
assert.ok(V21_9P_NON_PROMOTABLE_EVIDENCE.includes("OPERATOR_INVENTED_TOLERANCE_TO_PASS_CURRENT_EVIDENCE"));

assert.deepEqual(
  V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.future_calibration_dependency.parameters,
  V21_9N_CALIBRATION_PARAMETERS
);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.promotion_rule.model, "NON_COMPENSATORY_CONJUNCTIVE_GATE");
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.promotion_rule.failed_objective_can_be_compensated, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.promotion_rule.unobserved_objective_can_promote, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.compensation_policy.weighted_total_score, "FORBIDDEN");
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.missing_vs_zero_policy.zero_not_equal_missing, true);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.missing_vs_zero_policy.unobserved_zero_is_healthy, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.unknown_source_objective.existence_is_hard_blocker, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.unknown_source_objective.can_count_as_organic_maturity, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.safety_branch_objective.organic_absence_means_safe, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.safety_branch_objective.every_action_organic_observation_required_by_9p, false);
assert.ok(V21_9P_RUNTIME_ERROR_CLASSES.includes("INTEGRITY_AFFECTING_RUNTIME_ERROR"));
assert.ok(V21_9P_RUNTIME_ERROR_CLASSES.includes("CONTAINED_OBSERVABLE_RUNTIME_ERROR"));
assert.ok(V21_9P_FALLBACK_CLASSES.includes("INTENDED_SAFETY_FALLBACK"));
assert.ok(V21_9P_FALLBACK_CLASSES.includes("FAILURE_MASKING_FALLBACK"));
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.synthetic_controlled_ceiling.cannot_establish.includes("REASSESSMENT_READINESS"), true);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.enforce_boundary.enforce_authorized_by_9p, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.enforce_boundary.enforce_active_by_9p, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.calibrated_parameter_values, "NONE");
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.calibrated_value_adoption_policy.empirical_derivation_creates_permission, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.calibrated_value_adoption_policy.observed_prevalence_is_risk_tolerance, false);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.calibrated_value_adoption_policy.candidate_values_require_versioned_governance_adoption, true);
assert.equal(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.calibrated_value_adoption_policy.candidate_value_adoption_must_precede_validation, true);

function collectNumbers(value, numbers = []) {
  if (typeof value === "number") numbers.push(value);
  if (Array.isArray(value)) for (const item of value) collectNumbers(item, numbers);
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const item of Object.values(value)) collectNumbers(item, numbers);
  }
  return numbers;
}
assert.deepEqual(collectNumbers(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT), []);

const serialized = serializeV21_9P(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT);
for (const forbidden of [
  "7 days",
  "30 days",
  "100 executions",
  "95% confidence",
  "UNKNOWN < 1%",
  "runtime error < 0.5%",
  "fallback < 1%",
  "total score"
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}
assert.equal(
  serializeV21_9P({ z: 1, a: { y: 2, x: 3 } }),
  serializeV21_9P({ a: { x: 3, y: 2 }, z: 1 })
);
const buildA = Buffer.from(serialized, "utf8");
const buildB = Buffer.from(serializeV21_9P(V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT), "utf8");
assert.equal(buildA.equals(buildB), true);
const hashA = crypto.createHash("sha256").update(buildA).digest("hex");
const hashB = crypto.createHash("sha256").update(buildB).digest("hex");
assert.equal(hashA, hashB);

const theoreticalReady = evaluate({
  objective_states: passStates,
  calibrated_values_locked: true,
  independent_validation_passed: true,
  sequestered_holdout_passed: true,
  successor_sufficiency_policy_frozen: true
});
assert.equal(theoreticalReady.decision_state, V21_9N_DECISION_STATES.READY);
assert.equal(theoreticalReady.ready_for_separate_enforce_reassessment, true);
assert.equal(theoreticalReady.enforce_authorized, false);
assert.equal(theoreticalReady.enforce_active, false);

for (const [gate, value] of [
  ["calibrated_values_locked", false],
  ["independent_validation_passed", false],
  ["sequestered_holdout_passed", false],
  ["successor_sufficiency_policy_frozen", false]
]) {
  const r = evaluate({
    objective_states: passStates,
    calibrated_values_locked: true,
    independent_validation_passed: true,
    sequestered_holdout_passed: true,
    successor_sufficiency_policy_frozen: true,
    [gate]: value
  });
  assert.notEqual(r.decision_state, V21_9N_DECISION_STATES.READY, gate);
  assert.equal(r.ready_for_separate_enforce_reassessment, false, gate);
}

const blockerDominates = evaluate({
  objective_states: passStates,
  calibrated_values_locked: true,
  independent_validation_passed: true,
  sequestered_holdout_passed: true,
  successor_sufficiency_policy_frozen: true,
  unknown_promoted_as_organic: true,
  organic_execution_count: 999999
});
assert.equal(blockerDominates.decision_state, V21_9N_DECISION_STATES.BLOCKED);
assert.equal(blockerDominates.ready_for_separate_enforce_reassessment, false);

assert.equal(
  V21_9P_PRIMARY_OUTCOME,
  "ENFORCE_REASSESSMENT_NORMATIVE_ACCEPTANCE_OBJECTIVES_FROZEN"
);

console.log(JSON.stringify({
  verifier: "verify-v21-9p-enforce-reassessment-normative-acceptance-v1",
  fixtures: "F1-F16",
  primary_outcome: V21_9P_PRIMARY_OUTCOME,
  normative_contract_version: V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.version,
  unresolved_9o_objectives_accounted_for: V21_9P_OBJECTIVE_REGISTRY.length,
  arbitrary_numeric_thresholds: 0,
  contract_numeric_values: 0,
  deterministic_contract_sha256: hashA,
  calibration_executable_now: false,
  current_trigger: "NOT_READY",
  current_reason: "organic_traffic_absent",
  ready_for_separate_enforce_reassessment: false,
  enforce_authorized: false,
  enforce_active: false,
  product_fact_write: 0,
  supabase_migration: 0,
  production_traffic_generated: 0
}, null, 2));
