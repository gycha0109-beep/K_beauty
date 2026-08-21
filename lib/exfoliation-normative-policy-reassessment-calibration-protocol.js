import {
  V21_9N_CALIBRATION_CONTRACT,
  V21_9N_CALIBRATION_PARAMETERS,
  V21_9N_DECISION_STATES
} from "./exfoliation-normative-policy-reassessment-sufficiency.js";
import {
  V21_9O_METHODOLOGY_CONTRACT,
  V21_9O_PARAMETER_METHODS
} from "./exfoliation-normative-policy-reassessment-calibration-methodology.js";
import {
  V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT,
  V21_9P_NORMATIVE_ACCEPTANCE_VERSION
} from "./exfoliation-normative-policy-reassessment-normative-acceptance.js";

export const V21_9Q_PROTOCOL_VERSION =
  "enforce-reassessment-calibration-protocol-v1";
export const V21_9Q_PRIMARY_OUTCOME =
  "ENFORCE_REASSESSMENT_CALIBRATION_PROTOCOL_FROZEN_AND_PROSPECTIVELY_REGISTERED";

export const V21_9Q_PROTOCOL_STATES = Object.freeze({
  REGISTERED_CALIBRATION_PENDING: "PROTOCOL_REGISTERED_CALIBRATION_PENDING",
  RETROSPECTIVE_EVIDENCE_INELIGIBLE: "RETROSPECTIVE_EVIDENCE_INELIGIBLE",
  CANDIDATE_GOVERNANCE_ADOPTION_REQUIRED: "CANDIDATE_GOVERNANCE_ADOPTION_REQUIRED",
  VALIDATION_PENDING: "VALIDATION_PENDING",
  HOLDOUT_PENDING: "HOLDOUT_PENDING",
  SUCCESSOR_POLICY_PENDING: "SUCCESSOR_POLICY_PENDING",
  READY: "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT",
  REJECTED: "REJECTED_BY_CALIBRATION_PROTOCOL"
});

export const V21_9Q_REGIME_KEYS = Object.freeze([
  "activation_version",
  "policy_contract_version",
  "runtime_version",
  "evidence_schema_version",
  "context_bucket_version",
  "activation_scope"
]);

export const V21_9Q_REGISTERED_REGIME = Object.freeze({
  activation_version:
    "exfoliation-non-numeric-pda-normative-production-policy-activation-v1",
  policy_contract_version:
    "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1",
  runtime_version:
    "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1",
  evidence_schema_version:
    "exfoliation-normative-organic-shadow-evidence-daily-v1",
  context_bucket_version:
    "privacy-safe-recommendation-context-bucket-v1",
  activation_scope:
    "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY"
});

function schema(name, requiredFields, orderingRules = []) {
  return Object.freeze({
    name,
    required_fields: Object.freeze([...requiredFields]),
    ordering_rules: Object.freeze([...orderingRules])
  });
}

export const V21_9Q_ARTIFACT_SCHEMAS = Object.freeze({
  parameter_derivation: schema(
    "enforce-reassessment-parameter-derivation-artifact-v1",
    [
      "protocol_version",
      "parameter_name",
      "methodology_version",
      "normative_acceptance_version",
      "registered_regime_identity",
      "calibration_role_registration_reference",
      "eligible_evidence_prefix_reference",
      "derivation_method_family",
      "derivation_input_digest",
      "candidate_value_representation",
      "authority_lineage"
    ],
    [
      "USE_COMPLETE_ELIGIBLE_REGISTERED_PREFIX_NO_OUTCOME_BASED_SUBSETTING",
      "ONE_PARAMETER_ARTIFACT_PER_FROZEN_9N_PARAMETER",
      "DERIVATION_MUST_REFERENCE_EXACT_9O_METHOD_FAMILY"
    ]
  ),
  calibrated_candidate: schema(
    "enforce-reassessment-calibrated-candidate-artifact-v1",
    [
      "candidate_version",
      "protocol_version",
      "parameter_derivation_artifact_references",
      "all_frozen_parameter_values",
      "registered_regime_identity",
      "calibration_evidence_role_reference",
      "normative_acceptance_version",
      "candidate_digest",
      "locked_before_validation"
    ],
    [
      "ALL_NINE_FROZEN_PARAMETERS_REQUIRED",
      "CANDIDATE_LOCK_PRECEDES_VALIDATION_EVIDENCE",
      "NO_VALIDATION_OR_HOLDOUT_RETUNING"
    ]
  ),
  candidate_governance_adoption: schema(
    "enforce-reassessment-candidate-governance-adoption-artifact-v1",
    [
      "adoption_version",
      "protocol_version",
      "candidate_version",
      "candidate_digest",
      "normative_acceptance_version",
      "objective_evaluation_plan",
      "validation_role_registration_reference",
      "holdout_role_registration_reference",
      "authority_lineage",
      "adoption_precedes_validation_evidence"
    ],
    [
      "ADOPTION_MUST_PRECEDE_FIRST_VALIDATION_EVIDENCE",
      "VALIDATION_AND_HOLDOUT_ROLES_REGISTERED_BEFORE_VALIDATION_OUTCOMES",
      "NO_ADOPTION_AFTER_SEEING_VALIDATION_RESULT"
    ]
  ),
  validation_result: schema(
    "enforce-reassessment-validation-result-artifact-v1",
    [
      "protocol_version",
      "candidate_version",
      "governance_adoption_reference",
      "validation_role_registration_reference",
      "registered_regime_identity",
      "validation_evidence_digest",
      "objective_results",
      "retuned_candidate",
      "validation_disposition"
    ],
    [
      "VALIDATION_EVIDENCE_STRICTLY_POST_ADOPTION_AND_NON_OVERLAPPING_WITH_CALIBRATION",
      "RETUNED_CANDIDATE_MUST_BE_FALSE_FOR_PROMOTION"
    ]
  ),
  holdout_result: schema(
    "enforce-reassessment-holdout-result-artifact-v1",
    [
      "protocol_version",
      "candidate_version",
      "governance_adoption_reference",
      "holdout_role_registration_reference",
      "registered_regime_identity",
      "holdout_evidence_digest",
      "objective_results",
      "holdout_reused",
      "holdout_disposition"
    ],
    [
      "HOLDOUT_REMAINS_SEQUESTERED_UNTIL_VALIDATION_PASS",
      "FAILED_VALIDATION_INVALIDATES_HOLDOUT_RESERVATION_FOR_A_REVISED_CANDIDATE",
      "HOLDOUT_REUSE_FOR_REVISED_CANDIDATE_FORBIDDEN"
    ]
  ),
  successor_sufficiency_policy: schema(
    "enforce-reassessment-successor-sufficiency-policy-artifact-v1",
    [
      "successor_policy_version",
      "protocol_version",
      "candidate_version",
      "governance_adoption_reference",
      "validation_result_reference",
      "holdout_result_reference",
      "normative_acceptance_version",
      "promotion_disposition",
      "ready_semantics"
    ],
    [
      "SUCCESSOR_POLICY_REQUIRED_BEFORE_READY",
      "READY_MEANS_SEPARATE_ENFORCE_REASSESSMENT_ENTRY_ONLY"
    ]
  )
});

export const V21_9Q_CALIBRATION_PROTOCOL = Object.freeze({
  version: V21_9Q_PROTOCOL_VERSION,
  status: "PROTOCOL_FROZEN_AND_PROSPECTIVELY_REGISTERED_VALUES_UNCALIBRATED",
  primary_outcome: V21_9Q_PRIMARY_OUTCOME,
  frozen_inputs: Object.freeze({
    v21_9n_calibration_contract_version: V21_9N_CALIBRATION_CONTRACT.version,
    v21_9n_calibration_contract_status: V21_9N_CALIBRATION_CONTRACT.status,
    v21_9n_parameters: V21_9N_CALIBRATION_PARAMETERS,
    v21_9o_methodology_version: V21_9O_METHODOLOGY_CONTRACT.version,
    v21_9o_methodology_status: V21_9O_METHODOLOGY_CONTRACT.status,
    v21_9p_normative_acceptance_version: V21_9P_NORMATIVE_ACCEPTANCE_VERSION,
    v21_9p_normative_acceptance_status: V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.status
  }),
  prospective_registration: Object.freeze({
    state: "PROSPECTIVELY_REGISTERED_BEFORE_ELIGIBLE_CANONICAL_CALIBRATION_EVIDENCE",
    registration_event: "AUTHORITATIVE_MAIN_PUBLICATION_OF_THIS_PROTOCOL_VERSION",
    pre_registration_evidence:
      "HISTORICAL_DIAGNOSTIC_ONLY_NOT_CANONICAL_V1_CALIBRATION_EVIDENCE",
    eligible_evidence_cutoff:
      "FIRST_FULL_UTC_DAILY_AGGREGATE_BUCKET_WHOSE_START_IS_STRICTLY_AFTER_PROTOCOL_REGISTRATION",
    partial_registration_bucket:
      "INELIGIBLE_FOR_CANONICAL_V1_CALIBRATION_TO_AVOID_PRE_POST_REGISTRATION_MIXING",
    role_assignment:
      "DETERMINISTIC_BY_PRE_REGISTERED_LIFECYCLE_STATE_NOT_OUTCOME_FAVORABILITY",
    no_concrete_future_dates_assigned: true,
    no_numeric_window_sizes_assigned: true
  }),
  registered_calibration_regime: V21_9Q_REGISTERED_REGIME,
  version_partitioning: Object.freeze({
    regime_keys: V21_9Q_REGIME_KEYS,
    canonical_v1_evidence_must_match_registered_regime: true,
    incompatible_regime_pooling: "FORBIDDEN",
    later_regime_change:
      "START_NEW_SEPARATE_REGIME_AND_REGISTER_SUCCESSOR_PROTOCOL_OR_EXPLICIT_COMPATIBILITY_GOVERNANCE",
    favorable_regime_selection_after_outcomes: "FORBIDDEN"
  }),
  evidence_eligibility: Object.freeze({
    canonical_calibration: "POST_REGISTRATION_ORGANIC_PRODUCTION_DURABLE_SHADOW_DAILY_AGGREGATES_MATCHING_REGISTERED_REGIME",
    controlled_production: "WIRING_PROVENANCE_INSTRUMENTATION_AND_REACHABILITY_ONLY",
    synthetic_persona: "CONTRACT_EDGE_STRESS_REACHABILITY_AND_REGRESSION_ONLY",
    unknown_source: "SEPARATE_RISK_DESCRIPTOR_ONLY_NEVER_ORGANIC_MATURITY",
    external_reference: "METHODOLOGY_OR_RISK_FRAMING_ONLY_NOT_DIRECT_THRESHOLD_AUTHORITY"
  }),
  calibration_role_registration: Object.freeze({
    start: "FIRST_ELIGIBLE_POST_REGISTRATION_FULL_UTC_DAILY_BUCKET_IN_REGISTERED_REGIME",
    evidence_selection: "COMPLETE_ELIGIBLE_PREFIX_NO_BACKDATING_NO_CHERRY_PICKING",
    derivation_methods: V21_9O_PARAMETER_METHODS.map((entry) => Object.freeze({
      parameter: entry.parameter,
      method_family: entry.method_family
    })),
    end_semantics:
      "CANDIDATE_DERIVATION_CLOSURE_MUST_USE_COMPLETE_ELIGIBLE_PREFIX_AND_EMIT_LOCKED_VERSIONED_ARTIFACT_BEFORE_VALIDATION_ROLE_OPENS",
    retrospective_window_selection: "FORBIDDEN"
  }),
  validation_role_registration: Object.freeze({
    concrete_role_boundary_registration_time:
      "BEFORE_FIRST_VALIDATION_EVIDENCE_IS_ELIGIBLE_AND_AFTER_CANDIDATE_LOCK_AND_GOVERNANCE_ADOPTION",
    overlap_with_calibration: "FORBIDDEN",
    evidence_ordering: "STRICTLY_LATER_THAN_CALIBRATION_EVIDENCE",
    candidate_retuning: "FORBIDDEN",
    validation_outcome_may_change_candidate: false
  }),
  holdout_role_registration: Object.freeze({
    registration_time:
      "BEFORE_VALIDATION_OUTCOMES_ARE_OBSERVED_AS_PART_OF_CANDIDATE_GOVERNANCE_ADOPTION",
    evidence_ordering: "STRICTLY_LATER_THAN_VALIDATION_EVIDENCE",
    overlap_with_calibration_or_validation: "FORBIDDEN",
    sequestered_until_validation_pass: true,
    failed_validation_behavior:
      "DO_NOT_CONSUME_RESERVED_HOLDOUT_FOR_REVISED_CANDIDATE_AND_REQUIRE_FRESH_REGISTRATION",
    reuse_after_failed_validation: "FORBIDDEN"
  }),
  artifact_schemas: V21_9Q_ARTIFACT_SCHEMAS,
  anti_retrofit_rules: Object.freeze([
    "NO_PRE_REGISTRATION_EVIDENCE_AS_CANONICAL_V1_CALIBRATION_SET",
    "NO_OUTCOME_BASED_CALIBRATION_WINDOW_SELECTION",
    "NO_FAVORABLE_VERSION_REGIME_SELECTION_AFTER_OUTCOMES",
    "NO_CALIBRATION_VALIDATION_HOLDOUT_OVERLAP",
    "NO_CANDIDATE_RETUNING_ON_VALIDATION_OR_HOLDOUT",
    "NO_HOLDOUT_REUSE_AFTER_FAILED_VALIDATION",
    "NO_CANDIDATE_GOVERNANCE_ADOPTION_AFTER_VALIDATION_RESULT",
    "NO_EXTERNAL_NUMBER_DIRECT_IMPORT_AS_INTERNAL_TOLERANCE",
    "NO_OPERATOR_THRESHOLD_INVENTED_TO_PASS_CURRENT_EVIDENCE",
    "NO_SYNTHETIC_OR_CONTROLLED_SUBSTITUTION_FOR_ORGANIC_MATURITY",
    "NO_PRIVACY_SAFE_MARGINAL_CROSS_JOIN_OR_PSEUDO_USER_RECONSTRUCTION"
  ]),
  authority_lineage: Object.freeze([
    "9N_DEFINES_WHAT_PARAMETERS_REQUIRE_CALIBRATION",
    "9O_DEFINES_EMPIRICAL_DERIVATION_VALIDATION_HOLDOUT_METHOD_FAMILIES",
    "9P_DEFINES_NORMATIVE_ACCEPTANCE_AND_NON_COMPENSATORY_PROMOTION",
    "9Q_DEFINES_PROSPECTIVE_ROLE_REGISTRATION_AND_ARTIFACT_LINEAGE_BEFORE_ELIGIBLE_EVIDENCE",
    "ORGANIC_EVIDENCE_DESCRIBES_AND_CALIBRATES_UNDER_PROTOCOL_BUT_DOES_NOT_SELECT_THE_PROTOCOL",
    "EMPIRICAL_CANDIDATE_REQUIRES_EX_ANTE_GOVERNANCE_ADOPTION_BEFORE_VALIDATION"
  ]),
  privacy_boundary: V21_9O_METHODOLOGY_CONTRACT.privacy_constraints,
  promotion_requirements: V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT.future_promotion_requirements,
  calibrated_parameter_values: "NONE",
  ready_enforce_boundary: Object.freeze({
    ready_semantics: "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT_ONLY",
    ready_is_enforce_authorized: false,
    ready_is_enforce_active: false,
    enforce_authorized_by_9q: false,
    enforce_active_by_9q: false,
    production_mode_changed_by_9q: false
  })
});

function freezeReasons(reasons) {
  return Object.freeze([...new Set(reasons)].sort((a, b) => a.localeCompare(b, "en")));
}

function result(state, reasons, extra = {}) {
  return Object.freeze({
    protocol_version: V21_9Q_PROTOCOL_VERSION,
    primary_outcome: V21_9Q_PRIMARY_OUTCOME,
    protocol_frozen: true,
    protocol_prospectively_registered: true,
    protocol_state: state,
    reason_codes: freezeReasons(reasons),
    calibration_executable_now: extra.calibration_executable_now === true,
    calibrated_parameter_values:
      extra.calibrated_parameter_values || "NONE",
    decision_state:
      extra.decision_state || V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
    ready_for_separate_enforce_reassessment:
      extra.decision_state === V21_9N_DECISION_STATES.READY,
    enforce_authorized: false,
    enforce_active: false
  });
}

function protocolViolationReasons(input) {
  const reasons = [];
  if (input.retroactive_window_selection === true) reasons.push("retroactive_calibration_window_selection_forbidden");
  if (input.favorable_regime_selected_after_outcomes === true) reasons.push("outcome_based_version_regime_selection_forbidden");
  if (input.calibration_validation_overlap === true || input.calibration_holdout_overlap === true || input.validation_holdout_overlap === true) reasons.push("calibration_validation_holdout_overlap_forbidden");
  if (input.holdout_reused_after_failed_validation === true) reasons.push("holdout_reuse_after_failed_validation_forbidden");
  if (input.incompatible_versions_silently_pooled === true) reasons.push("incompatible_version_regime_pooling_forbidden");
  if (input.candidate_adoption_after_validation_result === true) reasons.push("retroactive_candidate_governance_adoption_forbidden");
  if (input.candidate_retuned_on_validation_or_holdout === true) reasons.push("candidate_retuning_on_validation_or_holdout_forbidden");
  if (input.external_threshold_imported_directly === true) reasons.push("external_numeric_threshold_requires_internal_governance");
  if (input.operator_threshold_invented_to_pass_current_evidence === true) reasons.push("operator_retrofit_threshold_forbidden");
  if (input.synthetic_or_controlled_used_as_organic_maturity === true) reasons.push("nonorganic_evidence_substitution_forbidden");
  if (input.cross_marginal_join === true) reasons.push("privacy_safe_marginal_cross_join_forbidden");
  return reasons;
}

export function evaluateV21_9QProtocolScenario(input = {}) {
  const violations = protocolViolationReasons(input);
  if (violations.length > 0) {
    return result(V21_9Q_PROTOCOL_STATES.REJECTED, violations, {
      decision_state: V21_9N_DECISION_STATES.NOT_READY
    });
  }

  if (
    input.pre_registration_evidence_present === true &&
    input.post_registration_organic_evidence_present !== true
  ) {
    return result(
      V21_9Q_PROTOCOL_STATES.RETROSPECTIVE_EVIDENCE_INELIGIBLE,
      ["pre_registration_evidence_is_diagnostic_only"],
      { decision_state: V21_9N_DECISION_STATES.NOT_READY }
    );
  }

  if (input.post_registration_organic_evidence_present !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.REGISTERED_CALIBRATION_PENDING,
      ["eligible_post_registration_organic_evidence_absent"],
      { decision_state: V21_9N_DECISION_STATES.NOT_READY }
    );
  }

  if (input.registered_regime_matches !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.REGISTERED_CALIBRATION_PENDING,
      ["registered_version_regime_match_required"],
      { decision_state: V21_9N_DECISION_STATES.NOT_READY }
    );
  }

  if (input.calibrated_candidate_locked !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.REGISTERED_CALIBRATION_PENDING,
      ["calibration_derivation_pending"],
      { calibration_executable_now: true }
    );
  }

  if (input.candidate_governance_adopted !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.CANDIDATE_GOVERNANCE_ADOPTION_REQUIRED,
      ["candidate_governance_adoption_required_before_validation"],
      { calibrated_parameter_values: "VERSIONED_CANDIDATE_PRESENT" }
    );
  }

  if (
    input.validation_role_registered_before_evidence !== true ||
    input.holdout_role_registered_before_validation_outcomes !== true
  ) {
    return result(
      V21_9Q_PROTOCOL_STATES.REJECTED,
      ["prospective_validation_and_holdout_role_registration_required"],
      {
        decision_state: V21_9N_DECISION_STATES.NOT_READY,
        calibrated_parameter_values: "VERSIONED_CANDIDATE_PRESENT"
      }
    );
  }

  if (input.validation_passed !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.VALIDATION_PENDING,
      ["independent_validation_not_passed"],
      { calibrated_parameter_values: "VERSIONED_CANDIDATE_PRESENT" }
    );
  }

  if (input.holdout_passed !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.HOLDOUT_PENDING,
      ["sequestered_holdout_not_passed"],
      { calibrated_parameter_values: "VERSIONED_CANDIDATE_PRESENT" }
    );
  }

  if (input.all_normative_objectives_passed !== true || input.successor_sufficiency_policy_frozen !== true) {
    return result(
      V21_9Q_PROTOCOL_STATES.SUCCESSOR_POLICY_PENDING,
      ["successor_sufficiency_policy_or_normative_objective_gate_pending"],
      { calibrated_parameter_values: "VERSIONED_CANDIDATE_PRESENT" }
    );
  }

  return result(
    V21_9Q_PROTOCOL_STATES.READY,
    ["protocol_calibration_validation_holdout_and_successor_policy_gates_satisfied"],
    {
      calibrated_parameter_values: "VERSIONED_CANDIDATE_PRESENT",
      decision_state: V21_9N_DECISION_STATES.READY
    }
  );
}

export function canonicalizeV21_9Q(value) {
  if (Array.isArray(value)) return value.map(canonicalizeV21_9Q);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, canonicalizeV21_9Q(value[key])])
  );
}

export function serializeV21_9Q(value) {
  return JSON.stringify(canonicalizeV21_9Q(value));
}
