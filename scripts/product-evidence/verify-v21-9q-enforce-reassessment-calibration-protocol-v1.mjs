import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import {
  V21_9Q_ARTIFACT_SCHEMAS,
  V21_9Q_CALIBRATION_PROTOCOL,
  V21_9Q_PRIMARY_OUTCOME,
  V21_9Q_PROTOCOL_STATES,
  V21_9Q_PROTOCOL_VERSION,
  V21_9Q_REGIME_KEYS,
  evaluateV21_9QProtocolScenario,
  serializeV21_9Q
} from "../../lib/exfoliation-normative-policy-reassessment-calibration-protocol.js";
import {
  V21_9N_CALIBRATION_CONTRACT,
  V21_9N_CALIBRATION_PARAMETERS,
  V21_9N_DECISION_STATES
} from "../../lib/exfoliation-normative-policy-reassessment-sufficiency.js";
import {
  V21_9O_METHODOLOGY_CONTRACT,
  V21_9O_PARAMETER_METHODS
} from "../../lib/exfoliation-normative-policy-reassessment-calibration-methodology.js";
import {
  V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT,
  V21_9P_NORMATIVE_ACCEPTANCE_VERSION
} from "../../lib/exfoliation-normative-policy-reassessment-normative-acceptance.js";

const manifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../fixtures/exfoliation-normative-reassessment-calibration-protocol-fixtures-v1.json",
      import.meta.url
    ),
    "utf8"
  )
);
assert.deepEqual(
  manifest.map((fixture) => fixture.id),
  ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"]
);

const f1 = evaluateV21_9QProtocolScenario({});
assert.equal(f1.protocol_state, V21_9Q_PROTOCOL_STATES.REGISTERED_CALIBRATION_PENDING);
assert.equal(f1.protocol_frozen, true);
assert.equal(f1.protocol_prospectively_registered, true);
assert.equal(f1.calibration_executable_now, false);
assert.equal(f1.calibrated_parameter_values, "NONE");
assert.equal(f1.ready_for_separate_enforce_reassessment, false);

const f2 = evaluateV21_9QProtocolScenario({
  pre_registration_evidence_present: true,
  post_registration_organic_evidence_present: false
});
assert.equal(f2.protocol_state, V21_9Q_PROTOCOL_STATES.RETROSPECTIVE_EVIDENCE_INELIGIBLE);
assert.equal(f2.calibration_executable_now, false);
assert.ok(f2.reason_codes.includes("pre_registration_evidence_is_diagnostic_only"));

const f3 = evaluateV21_9QProtocolScenario({
  calibration_validation_overlap: true
});
assert.equal(f3.protocol_state, V21_9Q_PROTOCOL_STATES.REJECTED);
assert.equal(f3.decision_state, V21_9N_DECISION_STATES.NOT_READY);

const f4 = evaluateV21_9QProtocolScenario({
  holdout_reused_after_failed_validation: true
});
assert.equal(f4.protocol_state, V21_9Q_PROTOCOL_STATES.REJECTED);
assert.ok(f4.reason_codes.includes("holdout_reuse_after_failed_validation_forbidden"));

const f5 = evaluateV21_9QProtocolScenario({
  incompatible_versions_silently_pooled: true
});
assert.equal(f5.protocol_state, V21_9Q_PROTOCOL_STATES.REJECTED);
assert.ok(f5.reason_codes.includes("incompatible_version_regime_pooling_forbidden"));

const f6 = evaluateV21_9QProtocolScenario({
  post_registration_organic_evidence_present: true,
  registered_regime_matches: true,
  calibrated_candidate_locked: true,
  candidate_governance_adopted: false
});
assert.equal(f6.protocol_state, V21_9Q_PROTOCOL_STATES.CANDIDATE_GOVERNANCE_ADOPTION_REQUIRED);
assert.equal(f6.ready_for_separate_enforce_reassessment, false);

const f7 = evaluateV21_9QProtocolScenario({
  candidate_adoption_after_validation_result: true
});
assert.equal(f7.protocol_state, V21_9Q_PROTOCOL_STATES.REJECTED);
assert.ok(f7.reason_codes.includes("retroactive_candidate_governance_adoption_forbidden"));

const f8 = evaluateV21_9QProtocolScenario({
  synthetic_evidence_present: true,
  controlled_evidence_present: true,
  post_registration_organic_evidence_present: false
});
assert.equal(f8.protocol_state, V21_9Q_PROTOCOL_STATES.REGISTERED_CALIBRATION_PENDING);
assert.equal(f8.calibration_executable_now, false);

const f9 = evaluateV21_9QProtocolScenario({
  post_registration_organic_evidence_present: true,
  registered_regime_matches: true,
  calibrated_candidate_locked: false
});
assert.equal(f9.protocol_state, V21_9Q_PROTOCOL_STATES.REGISTERED_CALIBRATION_PENDING);
assert.equal(f9.protocol_frozen, true);
assert.equal(f9.protocol_prospectively_registered, true);
assert.equal(f9.calibration_executable_now, true);
assert.equal(f9.calibrated_parameter_values, "NONE");

const f10 = evaluateV21_9QProtocolScenario({
  post_registration_organic_evidence_present: true,
  registered_regime_matches: true,
  calibrated_candidate_locked: true,
  candidate_governance_adopted: true,
  validation_role_registered_before_evidence: true,
  holdout_role_registered_before_validation_outcomes: true,
  validation_passed: true,
  holdout_passed: true,
  all_normative_objectives_passed: true,
  successor_sufficiency_policy_frozen: true
});
assert.equal(f10.protocol_state, V21_9Q_PROTOCOL_STATES.READY);
assert.equal(f10.decision_state, V21_9N_DECISION_STATES.READY);
assert.equal(f10.ready_for_separate_enforce_reassessment, true);
assert.equal(f10.enforce_authorized, false);
assert.equal(f10.enforce_active, false);

for (const scenario of [
  { retroactive_window_selection: true },
  { favorable_regime_selected_after_outcomes: true },
  { candidate_retuned_on_validation_or_holdout: true },
  { external_threshold_imported_directly: true },
  { operator_threshold_invented_to_pass_current_evidence: true },
  { synthetic_or_controlled_used_as_organic_maturity: true },
  { cross_marginal_join: true }
]) {
  const result = evaluateV21_9QProtocolScenario(scenario);
  assert.equal(result.protocol_state, V21_9Q_PROTOCOL_STATES.REJECTED);
  assert.equal(result.ready_for_separate_enforce_reassessment, false);
  assert.equal(result.enforce_authorized, false);
  assert.equal(result.enforce_active, false);
}

assert.equal(V21_9Q_PROTOCOL_VERSION, "enforce-reassessment-calibration-protocol-v1");
assert.equal(
  V21_9Q_PRIMARY_OUTCOME,
  "ENFORCE_REASSESSMENT_CALIBRATION_PROTOCOL_FROZEN_AND_PROSPECTIVELY_REGISTERED"
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.status,
  "PROTOCOL_FROZEN_AND_PROSPECTIVELY_REGISTERED_VALUES_UNCALIBRATED"
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.frozen_inputs.v21_9n_calibration_contract_version,
  V21_9N_CALIBRATION_CONTRACT.version
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.frozen_inputs.v21_9o_methodology_version,
  V21_9O_METHODOLOGY_CONTRACT.version
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.frozen_inputs.v21_9p_normative_acceptance_version,
  V21_9P_NORMATIVE_ACCEPTANCE_VERSION
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.frozen_inputs.v21_9p_normative_acceptance_status,
  V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.status
);
assert.deepEqual(
  V21_9Q_CALIBRATION_PROTOCOL.frozen_inputs.v21_9n_parameters,
  V21_9N_CALIBRATION_PARAMETERS
);
assert.deepEqual(
  V21_9Q_CALIBRATION_PROTOCOL.calibration_role_registration.derivation_methods.map(
    (entry) => entry.parameter
  ),
  V21_9N_CALIBRATION_PARAMETERS
);
assert.deepEqual(
  V21_9Q_CALIBRATION_PROTOCOL.calibration_role_registration.derivation_methods.map(
    (entry) => entry.method_family
  ),
  V21_9O_PARAMETER_METHODS.map((entry) => entry.method_family)
);
assert.deepEqual(V21_9Q_REGIME_KEYS, [
  "activation_version",
  "policy_contract_version",
  "runtime_version",
  "evidence_schema_version",
  "context_bucket_version",
  "activation_scope"
]);

assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.prospective_registration.pre_registration_evidence,
  "HISTORICAL_DIAGNOSTIC_ONLY_NOT_CANONICAL_V1_CALIBRATION_EVIDENCE"
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.prospective_registration.partial_registration_bucket,
  "INELIGIBLE_FOR_CANONICAL_V1_CALIBRATION_TO_AVOID_PRE_POST_REGISTRATION_MIXING"
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.prospective_registration.no_concrete_future_dates_assigned,
  true
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.prospective_registration.no_numeric_window_sizes_assigned,
  true
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.version_partitioning.favorable_regime_selection_after_outcomes,
  "FORBIDDEN"
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.holdout_role_registration.reuse_after_failed_validation,
  "FORBIDDEN"
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.ready_enforce_boundary.ready_is_enforce_authorized,
  false
);
assert.equal(
  V21_9Q_CALIBRATION_PROTOCOL.ready_enforce_boundary.ready_is_enforce_active,
  false
);
assert.equal(V21_9Q_CALIBRATION_PROTOCOL.calibrated_parameter_values, "NONE");

const artifactSchemaNames = Object.values(V21_9Q_ARTIFACT_SCHEMAS).map(
  (entry) => entry.name
);
assert.deepEqual(artifactSchemaNames, [
  "enforce-reassessment-parameter-derivation-artifact-v1",
  "enforce-reassessment-calibrated-candidate-artifact-v1",
  "enforce-reassessment-candidate-governance-adoption-artifact-v1",
  "enforce-reassessment-validation-result-artifact-v1",
  "enforce-reassessment-holdout-result-artifact-v1",
  "enforce-reassessment-successor-sufficiency-policy-artifact-v1"
]);
assert.ok(
  V21_9Q_ARTIFACT_SCHEMAS.candidate_governance_adoption.ordering_rules.includes(
    "NO_ADOPTION_AFTER_SEEING_VALIDATION_RESULT"
  )
);
assert.ok(
  V21_9Q_ARTIFACT_SCHEMAS.holdout_result.ordering_rules.includes(
    "HOLDOUT_REUSE_FOR_REVISED_CANDIDATE_FORBIDDEN"
  )
);

const serialized = serializeV21_9Q(V21_9Q_CALIBRATION_PROTOCOL);
for (const forbidden of [
  "7 days",
  "30 days",
  "100 executions",
  "95%",
  "1%",
  "0.5%",
  "confidence threshold"
]) {
  assert.equal(serialized.includes(forbidden), false, forbidden);
}
assert.equal(serialized.includes("CROSS_MARGINAL"), true);
assert.equal(serialized.includes("NO_OUTCOME_BASED_CALIBRATION_WINDOW_SELECTION"), true);
assert.equal(serialized.includes("NO_CANDIDATE_GOVERNANCE_ADOPTION_AFTER_VALIDATION_RESULT"), true);

const buildA = serializeV21_9Q(V21_9Q_CALIBRATION_PROTOCOL);
const buildB = serializeV21_9Q(
  JSON.parse(JSON.stringify(V21_9Q_CALIBRATION_PROTOCOL))
);
assert.equal(buildA, buildB);
const hashA = crypto.createHash("sha256").update(buildA).digest("hex");
const hashB = crypto.createHash("sha256").update(buildB).digest("hex");
assert.equal(hashA, hashB);
assert.equal(
  serializeV21_9Q({ z: 1, a: { y: 2, x: 3 } }),
  serializeV21_9Q({ a: { x: 3, y: 2 }, z: 1 })
);

console.log(JSON.stringify({
  verifier: "verify-v21-9q-enforce-reassessment-calibration-protocol-v1",
  fixtures: "F1-F10",
  protocol_version: V21_9Q_PROTOCOL_VERSION,
  protocol_status: V21_9Q_CALIBRATION_PROTOCOL.status,
  primary_outcome: V21_9Q_PRIMARY_OUTCOME,
  protocol_frozen: true,
  protocol_prospectively_registered: true,
  current_calibration_executable_now: false,
  calibrated_parameter_values: "NONE",
  current_trigger: "NOT_READY_ORGANIC_TRAFFIC_ABSENT",
  semantic_digest: hashA,
  production_write: false,
  hosted_write: false,
  product_fact_write: false,
  enforce_authorized: false,
  enforce_active: false
}, null, 2));
