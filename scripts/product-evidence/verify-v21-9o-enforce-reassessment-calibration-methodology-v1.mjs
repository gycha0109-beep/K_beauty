import assert from "node:assert/strict";
import fs from "node:fs";
import {
  V21_9O_EXECUTION_STATES,
  V21_9O_METHODOLOGY_CONTRACT,
  V21_9O_PARAMETER_METHODS,
  V21_9O_PRIMARY_OUTCOME,
  V21_9O_UNRESOLVED_GOVERNANCE,
  evaluateV21_9OMethodologyScenario,
  serializeV21_9O
} from "../../lib/exfoliation-normative-policy-reassessment-calibration-methodology.js";
import { V21_9N_CALIBRATION_PARAMETERS } from "../../lib/exfoliation-normative-policy-reassessment-sufficiency.js";

const manifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../fixtures/exfoliation-normative-reassessment-calibration-methodology-fixtures-v1.json",
      import.meta.url
    ),
    "utf8"
  )
);
assert.deepEqual(manifest.map((x) => x.id), [
  "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12"
]);

const c = { start: "CAL_A", end: "CAL_Z" };
const v = { start: "VAL_A", end: "VAL_Z" };
const h = { start: "HOLD_A", end: "HOLD_Z" };

for (const fixture of ["F1", "F12"]) {
  const r = evaluateV21_9OMethodologyScenario({ organic_execution_count: 0 });
  assert.equal(r.execution_state, V21_9O_EXECUTION_STATES.INSUFFICIENT_TO_CALIBRATE, fixture);
  assert.deepEqual(r.reason_codes, ["organic_evidence_absent"]);
}

const f2 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 1,
  version_regime_count: 1
});
assert.equal(f2.execution_state, V21_9O_EXECUTION_STATES.CALIBRATION_CANDIDATE_DATA_AVAILABLE);
assert.equal(f2.calibrated_parameter_values, "NONE");

const f3 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 2,
  version_regime_count: 1,
  calibration_window: c
});
assert.equal(f3.execution_state, V21_9O_EXECUTION_STATES.VALIDATION_DATA_NOT_YET_AVAILABLE);

const f4 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 3,
  version_regime_count: 1,
  calibration_window: c,
  validation_window: v,
  holdout_window: h,
  normative_acceptance_objectives_frozen: true
});
assert.equal(f4.execution_state, V21_9O_EXECUTION_STATES.METHODOLOGY_PATH_AVAILABLE);
assert.equal(f4.ready_for_separate_enforce_reassessment, false);
assert.equal(f4.enforce_authorized, false);
assert.equal(f4.enforce_active, false);

const f5 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 3,
  version_regime_count: 2,
  version_partitioned: false
});
assert.equal(f5.execution_state, V21_9O_EXECUTION_STATES.VERSION_PARTITION_REQUIRED);

for (const fixture of ["F6", "F7"]) {
  const r = evaluateV21_9OMethodologyScenario({
    organic_execution_count: 3,
    version_regime_count: 1,
    calibration_window: c,
    validation_window: v,
    holdout_window: h,
    normative_acceptance_objectives_frozen: false
  });
  assert.equal(r.execution_state, V21_9O_EXECUTION_STATES.FURTHER_GOVERNANCE_REQUIRED, fixture);
  assert.ok(r.reason_codes.includes("normative_acceptance_objectives_not_frozen"));
}

const f8 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 0,
  controlled_execution_count: 999999,
  synthetic_execution_count: 999999
});
assert.equal(f8.execution_state, V21_9O_EXECUTION_STATES.INSUFFICIENT_TO_CALIBRATE);

const f9 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 999999,
  retroactive_threshold_selection: true
});
assert.equal(f9.execution_state, V21_9O_EXECUTION_STATES.REJECTED_BY_METHODOLOGY);

const f10 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 3,
  calibration_window: { start: "A", end: "Z" },
  validation_window: { start: "A", end: "Z" }
});
assert.equal(f10.execution_state, V21_9O_EXECUTION_STATES.REJECTED_BY_METHODOLOGY);
assert.ok(f10.reason_codes.includes("calibration_validation_holdout_overlap_forbidden"));

const f11 = evaluateV21_9OMethodologyScenario({
  organic_execution_count: 3,
  composite_context_reconstruction: true
});
assert.equal(f11.execution_state, V21_9O_EXECUTION_STATES.REJECTED_BY_METHODOLOGY);

assert.deepEqual(
  V21_9O_PARAMETER_METHODS.map((x) => x.parameter),
  V21_9N_CALIBRATION_PARAMETERS
);
assert.equal(V21_9O_METHODOLOGY_CONTRACT.calibrated_parameter_values, "NONE");
assert.equal(
  V21_9O_METHODOLOGY_CONTRACT.status,
  "PARTIAL_METHODOLOGY_FROZEN_NORMATIVE_TARGET_GOVERNANCE_REQUIRED"
);

assert.deepEqual(V21_9O_UNRESOLVED_GOVERNANCE, [
  "SAFETY_RELEVANT_BRANCH_COVERAGE_ACCEPTANCE_OBJECTIVE",
  "UNKNOWN_SOURCE_ACCEPTABILITY_OBJECTIVE",
  "RUNTIME_ERROR_RISK_ACCEPTANCE_OBJECTIVE",
  "FALLBACK_RISK_ACCEPTANCE_OBJECTIVE",
  "EMPIRICAL_OUTCOME_DRIFT_ACCEPTANCE_OBJECTIVE",
  "PROMOTION_ACCEPTANCE_RULE_CONNECTING_EMPIRICAL_DESCRIPTORS_TO_REASSESSMENT_SUFFICIENCY"
]);

const serialized = serializeV21_9O(V21_9O_METHODOLOGY_CONTRACT);
for (const forbidden of [
  "7 days", "30 days", "100 executions", "1000 executions", "95%", "1%", "0.5%"
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}

assert.equal(
  serializeV21_9O({ z: 1, a: { y: 2, x: 3 } }),
  serializeV21_9O({ a: { x: 3, y: 2 }, z: 1 })
);
assert.equal(serializeV21_9O(V21_9O_METHODOLOGY_CONTRACT), serialized);

assert.equal(
  V21_9O_METHODOLOGY_CONTRACT.calibration_evidence_eligibility.external_reference,
  "METHODOLOGY_REFERENCE_ONLY"
);
assert.ok(
  V21_9O_METHODOLOGY_CONTRACT.anti_overfitting_constraints.includes(
    "CALIBRATION_VALIDATION_HOLDOUT_NON_OVERLAP"
  )
);
assert.ok(
  V21_9O_METHODOLOGY_CONTRACT.privacy_constraints.includes("NO_CROSS_MARGINAL_JOIN")
);
assert.ok(
  V21_9O_METHODOLOGY_CONTRACT.promotion_gate.includes("READY_DOES_NOT_AUTHORIZE_ENFORCE")
);
assert.equal(
  V21_9O_PRIMARY_OUTCOME,
  "ENFORCE_REASSESSMENT_SUFFICIENCY_CALIBRATION_DESIGN_REQUIRES_FURTHER_GOVERNANCE"
);

console.log(JSON.stringify({
  verifier: "verify-v21-9o-enforce-reassessment-calibration-methodology-v1",
  fixtures: "F1-F12",
  primary_outcome: V21_9O_PRIMARY_OUTCOME,
  methodology_version: V21_9O_METHODOLOGY_CONTRACT.version,
  calibration_executable_now: false,
  current_reason: "ORGANIC_EVIDENCE_ABSENT",
  calibrated_parameter_values: "NONE",
  arbitrary_numeric_thresholds: 0,
  production_evidence_write: 0,
  product_fact_write: 0,
  supabase_migration: 0,
  enforce_authorized: false,
  enforce_active: false
}, null, 2));
