import {
  V21_9O_METHODOLOGY_CONTRACT,
  V21_9O_UNRESOLVED_GOVERNANCE
} from "./exfoliation-normative-policy-reassessment-calibration-methodology.js";
import {
  V21_9N_CALIBRATION_CONTRACT,
  V21_9N_CALIBRATION_PARAMETERS,
  V21_9N_DECISION_STATES
} from "./exfoliation-normative-policy-reassessment-sufficiency.js";

export const V21_9P_NORMATIVE_ACCEPTANCE_VERSION =
  "enforce-reassessment-normative-acceptance-objectives-v1";
export const V21_9P_PRIMARY_OUTCOME =
  "ENFORCE_REASSESSMENT_NORMATIVE_ACCEPTANCE_OBJECTIVES_FROZEN";

export const V21_9P_GOVERNANCE_STATES = Object.freeze({
  NORMATIVE_OBJECTIVES_FROZEN: "NORMATIVE_OBJECTIVES_FROZEN",
  NORMATIVE_ACCEPTANCE_INCOMPLETE: "NORMATIVE_ACCEPTANCE_INCOMPLETE",
  REJECTED_BY_GOVERNANCE: "REJECTED_BY_GOVERNANCE"
});

export const V21_9P_OBJECTIVE_TAXONOMY = Object.freeze([
  "HARD_INTEGRITY_OR_SAFETY_INVARIANT",
  "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
  "CALIBRATABLE_COVERAGE_OR_REPRESENTATIVENESS_OBJECTIVE",
  "NON_PROMOTABLE_EVIDENCE_DOMAIN",
  "PROMOTION_GOVERNANCE_GATE"
]);

export const V21_9P_SAFETY_RELEVANT_ACTION_FAMILY = Object.freeze([
  "CAUTION",
  "RESTRICT",
  "DEFER"
]);

export const V21_9P_RUNTIME_ERROR_CLASSES = Object.freeze([
  "INTEGRITY_AFFECTING_RUNTIME_ERROR",
  "CONTAINED_OBSERVABLE_RUNTIME_ERROR",
  "UNCLASSIFIED_RUNTIME_ERROR"
]);

export const V21_9P_FALLBACK_CLASSES = Object.freeze([
  "INTENDED_SAFETY_FALLBACK",
  "EXPECTED_GRACEFUL_DEGRADATION",
  "UNEXPECTED_FALLBACK",
  "FAILURE_MASKING_FALLBACK",
  "UNCLASSIFIED_FALLBACK"
]);

export const V21_9P_HARD_BLOCKERS = Object.freeze([
  "FROZEN_9N_INTEGRITY_PREREQUISITE_FAILURE",
  "UNAUTHORIZED_ENFORCE_ACTIVATION",
  "ENFORCE_ACTIVE_WITHOUT_AUTHORITY",
  "SHADOW_ACTUAL_EXCLUSION_NONZERO",
  "CONTROLLED_EVIDENCE_ATTRIBUTED_AS_ORGANIC",
  "UNKNOWN_EVIDENCE_PROMOTED_AS_ORGANIC",
  "INCOMPATIBLE_VERSION_REGIMES_SILENTLY_POOLED",
  "PRODUCT_FACT_UNEXPECTED_MUTATION",
  "CANONICAL_RECOMMENDATION_MUTATION_FROM_SHADOW_POLICY",
  "EVIDENCE_SCHEMA_INVALID_OR_PROVENANCE_BROKEN",
  "STOP_REQUIRED_INTEGRITY_FAILURE"
]);

export const V21_9P_NON_PROMOTABLE_EVIDENCE = Object.freeze([
  "SYNTHETIC_ONLY_MATURITY_CLAIM",
  "CONTROLLED_ONLY_MATURITY_CLAIM",
  "UNKNOWN_AS_ORGANIC_MATURITY_CLAIM",
  "CROSS_MARGINAL_RECONSTRUCTED_PSEUDO_USER_EVIDENCE",
  "EXTERNAL_NUMERIC_THRESHOLD_IMPORTED_AS_INTERNAL_AUTHORITY",
  "OPERATOR_INVENTED_TOLERANCE_TO_PASS_CURRENT_EVIDENCE"
]);

function objective(id, taxonomy, normativeObjective, acceptanceSemantics, extra = {}) {
  return Object.freeze({
    id,
    taxonomy,
    normative_objective: normativeObjective,
    acceptance_semantics: acceptanceSemantics,
    hard_blocker_boundary: Object.freeze([...(extra.hard_blocker_boundary || [])]),
    calibratable_boundary: Object.freeze([...(extra.calibratable_boundary || [])]),
    non_promotable_substitutes: Object.freeze([...(extra.non_promotable_substitutes || [])]),
    future_calibration_dependency: extra.future_calibration_dependency || null,
    failed_objective_behavior:
      extra.failed_objective_behavior ||
      "BLOCK_READY_AND_REQUIRE_NEW_GOVERNED_CANDIDATE_OR_MORE_EVIDENCE",
    compensation_allowed: false
  });
}

export const V21_9P_OBJECTIVE_REGISTRY = Object.freeze([
  objective(
    "SAFETY_RELEVANT_BRANCH_COVERAGE_ACCEPTANCE_OBJECTIVE",
    "CALIBRATABLE_COVERAGE_OR_REPRESENTATIVENESS_OBJECTIVE",
    "ESTABLISH_REPRODUCIBLE_ORGANIC_MATURITY_FOR_THE_SAFETY_RELEVANT_ACTION_FAMILY_WITHOUT_TREATING_BRANCH_ABSENCE_AS_SAFETY",
    "CONTROLLED_OR_SYNTHETIC_REACHABILITY_MAY_PROVE_LOGIC_PATHS_BUT_ONLY_ORGANIC_INCIDENCE_AND_RECURRENCE_UNDER_A_FROZEN_CALIBRATION_METHOD_CAN_SUPPORT_MATURITY; UNOBSERVED_REACHABLE_BRANCHES_REMAIN_EXPLICIT_RESIDUAL_UNCERTAINTY",
    {
      hard_blocker_boundary: [
        "SAFETY_PATH_EXECUTION_CAUSES_SHADOW_ACTUAL_EXCLUSION",
        "SAFETY_PATH_EXECUTION_MUTATES_CANONICAL_RECOMMENDATION_IN_SHADOW"
      ],
      calibratable_boundary: [
        "ORGANIC_SAFETY_ACTION_FAMILY_INCIDENCE",
        "ORGANIC_SAFETY_ACTION_FAMILY_RECURRENCE",
        "RESIDUAL_UNOBSERVED_REACHABLE_BRANCH_DISCLOSURE"
      ],
      non_promotable_substitutes: [
        "CONTROLLED_REACHABILITY_AS_ORGANIC_MATURITY",
        "SYNTHETIC_REACHABILITY_AS_ORGANIC_MATURITY",
        "ABSENCE_OF_RESTRICT_AS_PROOF_OF_SAFETY"
      ],
      future_calibration_dependency: "required_safety_relevant_branch_coverage"
    }
  ),
  objective(
    "UNKNOWN_SOURCE_ACCEPTABILITY_OBJECTIVE",
    "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
    "LIMIT_PROVENANCE_UNCERTAINTY_SO_THAT_ATTRIBUTABLE_ORGANIC_MATURITY_IS_NOT_MATERIALLY_OBSCURED",
    "CORRECTLY_SEPARATED_UNKNOWN_IS_NOT_AN_INTEGRITY_FAILURE_BY_EXISTENCE; IT_REMAINS_NON_ORGANIC_AND_REQUIRES_A_VERSIONED_EMPIRICAL_TOLERANCE_OBJECTIVE_BEFORE_PROMOTION",
    {
      hard_blocker_boundary: [
        "UNKNOWN_PROMOTED_TO_ORGANIC",
        "UNKNOWN_PROVENANCE_SEPARATION_BROKEN"
      ],
      calibratable_boundary: [
        "CORRECTLY_SEPARATED_UNKNOWN_PREVALENCE",
        "UNKNOWN_TEMPORAL_CLUSTERING",
        "UNKNOWN_DILUTION_OF_ATTRIBUTABLE_ORGANIC_EVIDENCE"
      ],
      non_promotable_substitutes: ["UNKNOWN_COUNTED_AS_ORGANIC_MATURITY"],
      future_calibration_dependency: "unknown_source_tolerance"
    }
  ),
  objective(
    "RUNTIME_ERROR_RISK_ACCEPTANCE_OBJECTIVE",
    "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
    "BOUND_CONTAINED_RUNTIME_FAILURE_RISK_WHILE_ESCALATING_INTEGRITY_AFFECTING_FAILURES_TO_HARD_BLOCKERS",
    "AN_ISOLATED_CONTAINED_ERROR_IS_NEITHER_SYSTEMATIC_INSTABILITY_NOR_AUTOMATICALLY_ACCEPTABLE; CHARACTERIZED_ZERO_REQUIRES_OBSERVED_ORGANIC_EXECUTION_AND_VALID_INSTRUMENTATION; ACCEPTANCE_REQUIRES_CALIBRATION_VALIDATION_AND_HOLDOUT",
    {
      hard_blocker_boundary: [
        "RUNTIME_ERROR_CAUSES_ACTUAL_EXCLUSION",
        "RUNTIME_ERROR_CAUSES_STOP_REQUIRED_INTEGRITY_FAILURE",
        "RUNTIME_ERROR_CORRUPTS_PROVENANCE_OR_EVIDENCE_SCHEMA",
        "RUNTIME_ERROR_MUTATES_CANONICAL_RECOMMENDATION_IN_SHADOW"
      ],
      calibratable_boundary: [
        "CONTAINED_OBSERVABLE_RUNTIME_ERROR_PREVALENCE",
        "CONTAINED_OBSERVABLE_RUNTIME_ERROR_RECURRENCE",
        "CONTAINED_OBSERVABLE_RUNTIME_ERROR_CLUSTERING"
      ],
      future_calibration_dependency: "runtime_error_tolerance"
    }
  ),
  objective(
    "FALLBACK_RISK_ACCEPTANCE_OBJECTIVE",
    "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
    "DISTINGUISH_INTENDED_SAFETY_AND_GRACEFUL_DEGRADATION_FROM_UNEXPECTED_OR_FAILURE_MASKING_FALLBACK_BEHAVIOR_BEFORE_ACCEPTANCE",
    "FALLBACK_EXISTENCE_IS_NOT_AUTOMATIC_FAILURE; FALLBACK_MUST_BE_CLASSIFIED_AND_EMPIRICALLY_CHARACTERIZED, WHILE_FAILURE_MASKING_OF_A_HARD_INTEGRITY_VIOLATION_INHERITS_HARD_BLOCKER_PRECEDENCE",
    {
      hard_blocker_boundary: [
        "FALLBACK_MASKS_HARD_INTEGRITY_FAILURE",
        "FALLBACK_CAUSES_SHADOW_ACTUAL_EXCLUSION",
        "FALLBACK_MUTATES_CANONICAL_RECOMMENDATION_IN_SHADOW"
      ],
      calibratable_boundary: [
        "INTENDED_SAFETY_FALLBACK_BEHAVIOR",
        "EXPECTED_GRACEFUL_DEGRADATION_BEHAVIOR",
        "UNEXPECTED_BUT_OBSERVABLE_FALLBACK_BEHAVIOR"
      ],
      non_promotable_substitutes: ["UNCLASSIFIED_FALLBACK_TREATED_AS_ACCEPTABLE"],
      future_calibration_dependency: "fallback_tolerance"
    }
  ),
  objective(
    "EMPIRICAL_OUTCOME_DRIFT_ACCEPTANCE_OBJECTIVE",
    "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
    "REQUIRE_REPLICATED_OUTCOME_DISTRIBUTION_BEHAVIOR_WITHIN_A_FUTURE_CALIBRATED_ENVELOPE_FOR_A_COMPATIBLE_VERSION_REGIME",
    "DISTRIBUTION_SHIFT_ALONE_IS_NOT_INTEGRITY_FAILURE; HARD_IDENTITY_MISMATCH_OR_SILENT_VERSION_POOLING_IS. SAME_REGIME_OUTCOME_DRIFT_REQUIRES_CONTEXT_AWARE_REPLICATION_AND_A_FROZEN_ACCEPTANCE_ENVELOPE; OUTSIDE_ENVELOPE_BLOCKS_PROMOTION_AND_REQUIRES_INVESTIGATION_OR_RECALIBRATION",
    {
      hard_blocker_boundary: [
        "HARD_VERSION_IDENTITY_MISMATCH",
        "INCOMPATIBLE_VERSION_REGIMES_SILENTLY_POOLED"
      ],
      calibratable_boundary: [
        "ACTION_DISTRIBUTION_DRIFT",
        "CONTEXT_MARGINAL_DRIFT",
        "RUNTIME_ERROR_DISTRIBUTION_DRIFT",
        "FALLBACK_DISTRIBUTION_DRIFT"
      ],
      non_promotable_substitutes: [
        "ARBITRARY_DRIFT_PERCENTAGE",
        "CROSS_MARGINAL_USER_RECONSTRUCTION"
      ],
      future_calibration_dependency: "stability_criterion"
    }
  ),
  objective(
    "PROMOTION_ACCEPTANCE_RULE_CONNECTING_EMPIRICAL_DESCRIPTORS_TO_REASSESSMENT_SUFFICIENCY",
    "PROMOTION_GOVERNANCE_GATE",
    "PROMOTE_ONLY_WHEN_ALL_MANDATORY_NON_COMPENSATORY_GATES_PASS_UNDER_EXACT_VERSIONED_AUTHORITY_LINEAGE",
    "HARD_BLOCKERS_DOMINATE; UNOBSERVED_IS_NOT_HEALTHY; ALL_NINE_9N_CALIBRATION_PARAMETERS_MUST_BE_VERSIONED_AND_LOCKED; EACH_MANDATORY_CALIBRATABLE_OBJECTIVE_MUST_PASS_LATER_VALIDATION_AND_SEQUESTERED_HOLDOUT; NO_STRONG_METRIC_MAY_COMPENSATE_A_FAILED_OR_MISSING_SAFETY_OR_INTEGRITY_OBJECTIVE",
    {
      hard_blocker_boundary: V21_9P_HARD_BLOCKERS,
      calibratable_boundary: V21_9N_CALIBRATION_PARAMETERS,
      non_promotable_substitutes: V21_9P_NON_PROMOTABLE_EVIDENCE,
      future_calibration_dependency: "ALL_V21_9N_CALIBRATION_PARAMETERS"
    }
  )
]);

export const V21_9P_NORMATIVE_ACCEPTANCE_CONTRACT = Object.freeze({
  version: V21_9P_NORMATIVE_ACCEPTANCE_VERSION,
  status: "NORMATIVE_OBJECTIVES_FROZEN_VALUES_UNCALIBRATED",
  primary_outcome: V21_9P_PRIMARY_OUTCOME,
  governance_basis: Object.freeze({
    v21_9n_policy_status: V21_9N_CALIBRATION_CONTRACT.status,
    v21_9n_calibration_contract_version: V21_9N_CALIBRATION_CONTRACT.version,
    v21_9o_methodology_version: V21_9O_METHODOLOGY_CONTRACT.version,
    v21_9o_methodology_status: V21_9O_METHODOLOGY_CONTRACT.status,
    unresolved_9o_governance_accounted_for: V21_9O_UNRESOLVED_GOVERNANCE
  }),
  objective_taxonomy: V21_9P_OBJECTIVE_TAXONOMY,
  objective_registry: V21_9P_OBJECTIVE_REGISTRY,
  hard_blockers: V21_9P_HARD_BLOCKERS,
  calibratable_acceptance_domains: Object.freeze([
    "SAFETY_RELEVANT_BRANCH_COVERAGE",
    "CORRECTLY_SEPARATED_UNKNOWN_SOURCE_RISK",
    "CONTAINED_RUNTIME_ERROR_RISK",
    "CLASSIFIED_FALLBACK_RISK",
    "SAME_VERSION_EMPIRICAL_OUTCOME_DRIFT"
  ]),
  non_promotable_evidence: V21_9P_NON_PROMOTABLE_EVIDENCE,
  safety_branch_objective: Object.freeze({
    safety_relevant_family: V21_9P_SAFETY_RELEVANT_ACTION_FAMILY,
    every_action_organic_observation_required_by_9p: false,
    organic_absence_means_safe: false,
    reachability_authority: "CONTROLLED_OR_SYNTHETIC_MECHANISM_ONLY",
    maturity_authority: "ORGANIC_PRODUCTION_UNDER_FROZEN_CALIBRATION_METHOD",
    unobserved_reachable_branch_semantics:
      "EXPLICIT_RESIDUAL_UNCERTAINTY_NOT_HEALTHY_ZERO"
  }),
  unknown_source_objective: Object.freeze({
    correctly_separated_unknown_class: "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
    existence_is_hard_blocker: false,
    can_count_as_organic_maturity: false,
    promotion_to_organic: "HARD_INTEGRITY_BLOCKER",
    risk_concern:
      "DILUTION_OF_ATTRIBUTABLE_ORGANIC_MATURITY_AND_PROVENANCE_UNCERTAINTY"
  }),
  runtime_error_objective: Object.freeze({
    classes: V21_9P_RUNTIME_ERROR_CLASSES,
    isolated_error_semantics:
      "NOT_SYSTEMATIC_BY_EVENT_EXISTENCE_ALONE_AND_NOT_AUTOMATICALLY_ACCEPTABLE",
    characterized_zero_semantics:
      "ORGANIC_EXECUTION_OBSERVED_AND_RUNTIME_ERROR_INSTRUMENTATION_VALID_AND_ZERO_OBSERVED",
    unobserved_zero_semantics: "NOT_ACCEPTANCE_EVIDENCE",
    contained_error_semantics: "CALIBRATABLE_RISK_TOLERANCE_DOMAIN",
    integrity_affecting_error_semantics: "HARD_BLOCKER"
  }),
  fallback_objective: Object.freeze({
    classes: V21_9P_FALLBACK_CLASSES,
    fallback_exists_semantics: "NOT_AUTOMATIC_FAILURE",
    classification_required_before_acceptance: true,
    failure_masking_hard_integrity_semantics: "INHERITS_HARD_BLOCKER_PRECEDENCE",
    classified_non_integrity_fallback_semantics: "CALIBRATABLE_RISK_TOLERANCE_DOMAIN"
  }),
  empirical_drift_objective: Object.freeze({
    hard_identity_stability: "HARD_INTEGRITY_GATE",
    same_regime_distribution_shift: "CALIBRATABLE_EMPIRICAL_RISK_DOMAIN",
    expected_traffic_mix_variation:
      "CHARACTERIZE_BY_GOVERNED_CONTEXT_MARGINALS_WITHOUT_USER_RECONSTRUCTION",
    replicated_stability_objective: true,
    calibrated_envelope_required: true,
    outside_envelope_semantics:
      "BLOCK_PROMOTION_AND_REQUIRE_INVESTIGATION_OR_RECALIBRATION"
  }),
  promotion_rule: Object.freeze({
    model: "NON_COMPENSATORY_CONJUNCTIVE_GATE",
    hard_blocker_precedence: "ABSOLUTE",
    normative_contract_required: true,
    organic_maturity_required: true,
    all_nine_9n_calibration_parameters_versioned_and_locked: true,
    all_mandatory_calibratable_objectives_required: true,
    independent_validation_required: true,
    sequestered_holdout_required: true,
    successor_sufficiency_policy_required: true,
    unobserved_objective_can_promote: false,
    failed_objective_can_be_compensated: false,
    high_volume_can_override_integrity_failure: false,
    high_stability_can_override_provenance_corruption: false,
    average_score_can_override_hard_safety_failure: false,
    ready_semantics: "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT_ONLY"
  }),
  precedence: Object.freeze([
    "BLOCKED_INTEGRITY_FAILURE",
    "NOT_READY_FOR_MISSING_UNOBSERVED_OR_NON_PROMOTABLE_EVIDENCE",
    "SUFFICIENCY_CALIBRATION_REQUIRED",
    "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT"
  ]),
  compensation_policy: Object.freeze({
    model: "NON_COMPENSATORY_GATE",
    weighted_total_score: "FORBIDDEN",
    volume_vs_context_breadth_tradeoff:
      "FORBIDDEN_UNLESS_A_FUTURE_DOMAIN_SPECIFIC_GOVERNANCE_CONTRACT_EXPLICITLY_SUPERSEDES_THIS_RULE",
    runtime_risk_vs_action_coverage_tradeoff: "FORBIDDEN",
    unknown_risk_vs_observation_horizon_tradeoff: "FORBIDDEN",
    safety_or_integrity_compensation: "FORBIDDEN"
  }),
  missing_vs_zero_policy: Object.freeze({
    zero_not_equal_missing: true,
    characterized_zero_requires_observed_exposure_and_valid_instrumentation: true,
    unobserved_zero_is_healthy: false
  }),
  unobserved_policy: Object.freeze({
    unobserved_is_pass: false,
    unobserved_is_healthy_zero: false,
    unobserved_can_be_compensated_by_volume: false,
    required_behavior:
      "REMAIN_NOT_READY_OR_CALIBRATION_PENDING_UNTIL_GOVERNED_OBJECTIVE_IS_ESTABLISHED"
  }),
  authority_lineage: Object.freeze([
    "FROZEN_BEJEWELY_SAFETY_AND_GOVERNANCE_INVARIANTS_DEFINE_HARD_BOUNDARIES",
    "EXISTING_RECOMMENDATION_SEMANTIC_COMMITMENTS_DEFINE_CANONICAL_BEHAVIOR_BOUNDARIES",
    "ORGANIC_PRODUCTION_EVIDENCE_DESCRIBES_BEHAVIOR_BUT_DOES_NOT_CREATE_PERMISSION",
    "CONTROLLED_PRODUCTION_VALIDATES_MECHANISM_AND_REACHABILITY_ONLY",
    "SYNTHETIC_EVIDENCE_VALIDATES_REGRESSION_STRESS_AND_REACHABILITY_ONLY",
    "EXTERNAL_GUIDANCE_MAY_INFORM_METHODOLOGY_OR_RISK_FRAMING_BUT_DOES_NOT_AUTO_CREATE_BEJEWELY_THRESHOLDS",
    "OPERATOR_GOVERNANCE_MAY_ENACT_A_DOCUMENTED_POLICY_BUT_MAY_NOT_INVENT_A_RETROACTIVE_TOLERANCE_SOLELY_TO_PASS_CURRENT_EVIDENCE"
  ]),
  privacy_constraints: V21_9O_METHODOLOGY_CONTRACT.privacy_constraints,
  synthetic_controlled_ceiling: Object.freeze({
    synthetic: "CONTRACT_EDGE_METAMORPHIC_REACHABILITY_AND_REGRESSION_ONLY",
    controlled_production:
      "WIRING_PROVENANCE_INSTRUMENTATION_AND_EXPLICIT_REACHABILITY_ONLY",
    cannot_establish: Object.freeze([
      "NATURAL_PREVALENCE",
      "NATURAL_RECURRENCE",
      "NATURAL_DIVERSITY",
      "ORGANIC_RUNTIME_STABILITY",
      "ORGANIC_MATURITY",
      "RISK_TOLERANCE_CALIBRATION",
      "REASSESSMENT_READINESS"
    ])
  }),
  future_calibration_dependency: Object.freeze({
    parameters: V21_9N_CALIBRATION_PARAMETERS,
    methodology_version: V21_9O_METHODOLOGY_CONTRACT.version,
    values_status: "UNCALIBRATED",
    future_values_must_reference_normative_contract_version:
      V21_9P_NORMATIVE_ACCEPTANCE_VERSION
  }),
  calibrated_value_adoption_policy: Object.freeze({
    empirical_derivation_creates_permission: false,
    observed_prevalence_is_risk_tolerance: false,
    candidate_values_require_versioned_governance_adoption: true,
    candidate_value_adoption_must_precede_validation: true,
    retroactive_value_adoption_to_pass_current_evidence: "FORBIDDEN",
    authority_requirement:
      "EX_ANTE_GOVERNED_ADOPTION_AGAINST_THIS_NORMATIVE_OBJECTIVE_CONTRACT"
  }),
  future_promotion_requirements: Object.freeze([
    "EXACT_NORMATIVE_CONTRACT_VERSION_REFERENCED",
    "ALL_NINE_9N_PARAMETER_VALUES_VERSIONED_AND_LOCKED",
    "CALIBRATED_CANDIDATE_VALUES_GOVERNANCE_ADOPTED_BEFORE_VALIDATION",
    "CALIBRATION_WINDOW_AND_VERSION_REGIME_LINEAGE_RECORDED",
    "EACH_MANDATORY_OBJECTIVE_EVALUATED_NON_COMPENSATORILY",
    "INDEPENDENT_VALIDATION_PASSED_WITHOUT_RETUNING",
    "SEQUESTERED_HOLDOUT_PASSED_WITHOUT_RETUNING",
    "NO_HARD_BLOCKER_PRESENT",
    "SUCCESSOR_SUFFICIENCY_POLICY_FROZEN"
  ]),
  ready_semantics:
    "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT_NEVER_ENFORCE_AUTHORIZATION",
  enforce_boundary: Object.freeze({
    ready_is_enforce_authorized: false,
    ready_is_enforce_active: false,
    enforce_authorized_by_9p: false,
    enforce_active_by_9p: false,
    production_mode_changed_by_9p: false
  }),
  calibrated_parameter_values: "NONE"
});

function nonNegativeInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

function deriveHardBlockers(input) {
  const blockers = new Set(
    Array.isArray(input.hard_blockers) ? input.hard_blockers : []
  );
  if (input.integrity_failure === true) {
    blockers.add("FROZEN_9N_INTEGRITY_PREREQUISITE_FAILURE");
  }
  if (input.unauthorized_enforce === true) {
    blockers.add("UNAUTHORIZED_ENFORCE_ACTIVATION");
  }
  if (input.enforce_active_without_authority === true) {
    blockers.add("ENFORCE_ACTIVE_WITHOUT_AUTHORITY");
  }
  if (nonNegativeInt(input.actual_exclusion_count) > 0) {
    blockers.add("SHADOW_ACTUAL_EXCLUSION_NONZERO");
  }
  if (input.controlled_attributed_as_organic === true) {
    blockers.add("CONTROLLED_EVIDENCE_ATTRIBUTED_AS_ORGANIC");
  }
  if (input.unknown_promoted_as_organic === true) {
    blockers.add("UNKNOWN_EVIDENCE_PROMOTED_AS_ORGANIC");
  }
  if (input.mixed_versions_silently_pooled === true) {
    blockers.add("INCOMPATIBLE_VERSION_REGIMES_SILENTLY_POOLED");
  }
  if (input.product_fact_mutated === true) {
    blockers.add("PRODUCT_FACT_UNEXPECTED_MUTATION");
  }
  if (input.canonical_recommendation_mutated === true) {
    blockers.add("CANONICAL_RECOMMENDATION_MUTATION_FROM_SHADOW_POLICY");
  }
  if (input.evidence_schema_valid === false || input.provenance_valid === false) {
    blockers.add("EVIDENCE_SCHEMA_INVALID_OR_PROVENANCE_BROKEN");
  }
  if (nonNegativeInt(input.stop_required_count) > 0) {
    blockers.add("STOP_REQUIRED_INTEGRITY_FAILURE");
  }
  return [...blockers].sort((a, b) => a.localeCompare(b, "en"));
}

function result(decisionState, governanceState, reasons, extra = {}) {
  return Object.freeze({
    contract_version: V21_9P_NORMATIVE_ACCEPTANCE_VERSION,
    primary_outcome: V21_9P_PRIMARY_OUTCOME,
    governance_state: governanceState,
    decision_state: decisionState,
    reason_codes: Object.freeze(
      [...new Set(reasons)].sort((a, b) => a.localeCompare(b, "en"))
    ),
    hard_blockers: Object.freeze([...(extra.hard_blockers || [])]),
    normative_contract_complete: extra.normative_contract_complete === true,
    calibrated_parameter_values_locked:
      extra.calibrated_parameter_values_locked === true,
    ready_for_separate_enforce_reassessment:
      decisionState === V21_9N_DECISION_STATES.READY,
    enforce_authorized: false,
    enforce_active: false
  });
}

export function evaluateV21_9PNormativeAcceptance(input = {}) {
  const hardBlockers = deriveHardBlockers(input);
  if (hardBlockers.length > 0) {
    return result(
      V21_9N_DECISION_STATES.BLOCKED,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      hardBlockers,
      {
        hard_blockers: hardBlockers,
        normative_contract_complete: true
      }
    );
  }

  if (input.operator_invented_tolerance === true) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.REJECTED_BY_GOVERNANCE,
      ["operator_invented_tolerance_has_no_acceptance_authority"],
      { normative_contract_complete: true }
    );
  }

  if (input.external_threshold_imported_directly === true) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.REJECTED_BY_GOVERNANCE,
      ["external_numeric_threshold_requires_separate_internal_governance"],
      { normative_contract_complete: true }
    );
  }

  if (
    input.normative_contract_frozen !== true ||
    input.promotion_rule_present !== true
  ) {
    const reasons = [];
    if (input.normative_contract_frozen !== true) {
      reasons.push("normative_acceptance_contract_not_frozen");
    }
    if (input.promotion_rule_present !== true) {
      reasons.push("promotion_acceptance_rule_absent");
    }
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_ACCEPTANCE_INCOMPLETE,
      reasons
    );
  }

  if (nonNegativeInt(input.organic_execution_count) === 0) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      [
        "organic_traffic_absent",
        "zero_error_fallback_unknown_is_unobserved_not_healthy"
      ],
      { normative_contract_complete: true }
    );
  }

  if (
    input.synthetic_only_maturity === true ||
    input.controlled_only_maturity === true
  ) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["non_promotable_evidence_cannot_establish_organic_maturity"],
      { normative_contract_complete: true }
    );
  }

  if (input.organic_safety_coverage_observed === false) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["safety_relevant_organic_coverage_unobserved"],
      { normative_contract_complete: true }
    );
  }

  if (input.context_breadth_observed === false) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["context_breadth_objective_unobserved"],
      { normative_contract_complete: true }
    );
  }

  if (input.runtime_error_class === "UNCLASSIFIED_RUNTIME_ERROR") {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["runtime_error_classification_required"],
      { normative_contract_complete: true }
    );
  }

  if (input.fallback_class === "UNCLASSIFIED_FALLBACK") {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["fallback_classification_required"],
      { normative_contract_complete: true }
    );
  }

  const objectiveStates = input.objective_states || {};
  const empiricalObjectiveKeys = V21_9O_UNRESOLVED_GOVERNANCE.slice(0, -1);
  const missingObjectiveState = empiricalObjectiveKeys.filter(
    (key) => !Object.prototype.hasOwnProperty.call(objectiveStates, key)
  );
  if (missingObjectiveState.length > 0) {
    return result(
      V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["calibratable_objective_evaluation_pending"],
      { normative_contract_complete: true }
    );
  }

  const unobserved = empiricalObjectiveKeys.filter((key) =>
    ["UNOBSERVED", "MISSING", "UNCLASSIFIED"].includes(objectiveStates[key])
  );
  if (unobserved.length > 0) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["mandatory_objective_unobserved_or_unclassified"],
      { normative_contract_complete: true }
    );
  }

  const failed = empiricalObjectiveKeys.filter(
    (key) => objectiveStates[key] === "FAIL"
  );
  if (failed.length > 0) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["mandatory_calibrated_objective_failed"],
      {
        normative_contract_complete: true,
        calibrated_parameter_values_locked: input.calibrated_values_locked
      }
    );
  }

  if (input.calibrated_values_locked !== true) {
    return result(
      V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["all_nine_calibrated_parameter_values_not_locked"],
      { normative_contract_complete: true }
    );
  }

  if (input.independent_validation_passed !== true) {
    return result(
      V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["independent_validation_not_passed"],
      {
        normative_contract_complete: true,
        calibrated_parameter_values_locked: true
      }
    );
  }

  if (input.sequestered_holdout_passed !== true) {
    return result(
      V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["sequestered_holdout_not_passed"],
      {
        normative_contract_complete: true,
        calibrated_parameter_values_locked: true
      }
    );
  }

  if (input.successor_sufficiency_policy_frozen !== true) {
    return result(
      V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["successor_sufficiency_policy_not_frozen"],
      {
        normative_contract_complete: true,
        calibrated_parameter_values_locked: true
      }
    );
  }

  const notPassed = empiricalObjectiveKeys.filter(
    (key) => objectiveStates[key] !== "PASS"
  );
  if (notPassed.length > 0) {
    return result(
      V21_9N_DECISION_STATES.NOT_READY,
      V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
      ["mandatory_objective_not_passed"],
      {
        normative_contract_complete: true,
        calibrated_parameter_values_locked: true
      }
    );
  }

  return result(
    V21_9N_DECISION_STATES.READY,
    V21_9P_GOVERNANCE_STATES.NORMATIVE_OBJECTIVES_FROZEN,
    ["all_non_compensatory_promotion_gates_passed"],
    {
      normative_contract_complete: true,
      calibrated_parameter_values_locked: true
    }
  );
}

export function canonicalizeV21_9P(value) {
  if (Array.isArray(value)) return value.map(canonicalizeV21_9P);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, canonicalizeV21_9P(value[key])])
  );
}

export function serializeV21_9P(value) {
  return JSON.stringify(canonicalizeV21_9P(value));
}
