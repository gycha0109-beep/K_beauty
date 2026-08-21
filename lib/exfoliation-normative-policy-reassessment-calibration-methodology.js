import {
  V21_9N_CALIBRATION_PARAMETERS,
  V21_9N_CALIBRATION_CONTRACT
} from "./exfoliation-normative-policy-reassessment-sufficiency.js";

export const V21_9O_METHODOLOGY_VERSION =
  "enforce-reassessment-sufficiency-calibration-methodology-v1";
export const V21_9O_PRIMARY_OUTCOME =
  "ENFORCE_REASSESSMENT_SUFFICIENCY_CALIBRATION_DESIGN_REQUIRES_FURTHER_GOVERNANCE";

export const V21_9O_EXECUTION_STATES = Object.freeze({
  INSUFFICIENT_TO_CALIBRATE: "INSUFFICIENT_TO_CALIBRATE",
  CALIBRATION_CANDIDATE_DATA_AVAILABLE: "CALIBRATION_CANDIDATE_DATA_AVAILABLE",
  VALIDATION_DATA_NOT_YET_AVAILABLE: "VALIDATION_DATA_NOT_YET_AVAILABLE",
  HOLDOUT_DATA_NOT_YET_AVAILABLE: "HOLDOUT_DATA_NOT_YET_AVAILABLE",
  VERSION_PARTITION_REQUIRED: "VERSION_PARTITION_REQUIRED",
  FURTHER_GOVERNANCE_REQUIRED: "FURTHER_GOVERNANCE_REQUIRED",
  METHODOLOGY_PATH_AVAILABLE: "METHODOLOGY_PATH_AVAILABLE",
  REJECTED_BY_METHODOLOGY: "REJECTED_BY_METHODOLOGY"
});

const commonEligible = Object.freeze([
  "ORGANIC_PRODUCTION_DURABLE_SHADOW_AGGREGATES",
  "SAME_VERSION_REGIME_ONLY",
  "PRIVACY_SAFE_DAILY_AGGREGATES_ONLY"
]);

const commonIneligible = Object.freeze([
  "CONTROLLED_PRODUCTION_AS_ORGANIC_MATURITY",
  "SYNTHETIC_OR_PERSONA_AS_ORGANIC_MATURITY",
  "OPERATOR_GUESS",
  "CROSS_MARGINAL_USER_RECONSTRUCTION",
  "RETROACTIVE_VALIDATION_TUNING"
]);

function method(parameter, question, methodFamily, options = {}) {
  return Object.freeze({
    parameter,
    question,
    authority_source: "ORGANIC_PRODUCTION_EVIDENCE_UNDER_PRE_FROZEN_METHOD",
    eligible_evidence: commonEligible,
    ineligible_substitutes: commonIneligible,
    calibration_preconditions: Object.freeze([
      "INTEGRITY_PREREQUISITES_PASS",
      "CALIBRATION_WINDOW_PROSPECTIVELY_LOCKED",
      "VERSION_REGIME_HOMOGENEOUS",
      ...(options.preconditions || [])
    ]),
    method_family: methodFamily,
    validation_requirement:
      options.validation || "NON_OVERLAPPING_LATER_ORGANIC_VALIDATION_THEN_SEQUESTERED_HOLDOUT",
    insufficient_data_behavior:
      options.insufficient || "AWAIT_MORE_ORGANIC_EVIDENCE",
    promotion_requirement:
      options.promotion || "FROZEN_CANDIDATE_MUST_PASS_VALIDATION_AND_HOLDOUT_WITHOUT_RETUNING",
    normative_target_dependency: options.normativeTarget || null
  });
}

export const V21_9O_PARAMETER_METHODS = Object.freeze([
  method(
    "minimum_observation_horizon",
    "At what prospective observation boundary does naturally recurring organic evidence become temporally informative enough for calibration?",
    "TEMPORAL_PREFIX_ACCUMULATION_AND_LATER_WINDOW_REPLICATION",
    { preconditions: ["OBSERVATION_GAPS_RETAINED_AS_GAPS_NOT_ZERO"] }
  ),
  method(
    "minimum_organic_execution_volume",
    "At what accumulated organic exposure boundary do the governed empirical descriptors become reproducible in later unseen evidence?",
    "CUMULATIVE_ORGANIC_EXPOSURE_FRONTIER_WITH_OUT_OF_SAMPLE_REPLICATION"
  ),
  method(
    "required_temporal_recurrence",
    "How should concentration in one period be distinguished from recurrence across naturally separated operation periods?",
    "UTC_DAILY_RECURRENCE_PATTERN_ANALYSIS_WITH_GAPS_PRESERVED"
  ),
  method(
    "required_context_breadth",
    "When do independent privacy-safe context marginals show reproducible breadth without joining them into user fingerprints?",
    "PER_MARGINAL_SUPPORT_AND_DISTRIBUTION_REPLICATION_NO_CROSS_MARGINAL_JOIN"
  ),
  method(
    "required_safety_relevant_branch_coverage",
    "What organic evidence is sufficient for safety-relevant CAUTION/RESTRICT/DEFER branch maturity while controlled/synthetic data only prove reachability?",
    "ORGANIC_ACTION_OCCURRENCE_AND_RECURRENCE_WITH_REACHABILITY_SIDE_EVIDENCE",
    {
      normativeTarget:
        "REQUIRES_GOVERNED_SAFETY_COVERAGE_ACCEPTANCE_OBJECTIVE_BEFORE_FINAL_VALUE_DERIVATION"
    }
  ),
  method(
    "unknown_source_tolerance",
    "What UNKNOWN prevalence/recurrence remains acceptable once provenance separation is intact?",
    "ORGANIC_UNKNOWN_PREVALENCE_AND_TEMPORAL_CLUSTERING_ESTIMATION",
    {
      normativeTarget:
        "REQUIRES_GOVERNED_UNKNOWN_ACCEPTABILITY_OBJECTIVE_NOT_DERIVABLE_FROM_PREVALENCE_ALONE"
    }
  ),
  method(
    "runtime_error_tolerance",
    "What runtime-error prevalence/recurrence separates isolated observations from unacceptable instability?",
    "ORGANIC_RUNTIME_ERROR_PREVALENCE_RECURRENCE_AND_CLUSTERING_ESTIMATION",
    {
      normativeTarget:
        "REQUIRES_GOVERNED_RUNTIME_RISK_ACCEPTANCE_OBJECTIVE_NOT_DERIVABLE_FROM_PREVALENCE_ALONE"
    }
  ),
  method(
    "fallback_tolerance",
    "What fallback prevalence/recurrence separates normal fallback behavior from unacceptable instability?",
    "ORGANIC_FALLBACK_PREVALENCE_RECURRENCE_AND_CLUSTERING_ESTIMATION",
    {
      normativeTarget:
        "REQUIRES_GOVERNED_FALLBACK_ACCEPTANCE_OBJECTIVE_NOT_DERIVABLE_FROM_PREVALENCE_ALONE"
    }
  ),
  method(
    "stability_criterion",
    "How should hard version/collection stability be separated from empirical outcome-distribution stability?",
    "EXACT_VERSION_AND_COLLECTION_IDENTITY_GATES_PLUS_OUTCOME_DISTRIBUTION_REPLICATION",
    {
      normativeTarget:
        "REQUIRES_GOVERNED_EMPIRICAL_DRIFT_ACCEPTANCE_OBJECTIVE_FOR_PROMOTION"
    }
  )
]);

export const V21_9O_UNRESOLVED_GOVERNANCE = Object.freeze([
  "SAFETY_RELEVANT_BRANCH_COVERAGE_ACCEPTANCE_OBJECTIVE",
  "UNKNOWN_SOURCE_ACCEPTABILITY_OBJECTIVE",
  "RUNTIME_ERROR_RISK_ACCEPTANCE_OBJECTIVE",
  "FALLBACK_RISK_ACCEPTANCE_OBJECTIVE",
  "EMPIRICAL_OUTCOME_DRIFT_ACCEPTANCE_OBJECTIVE",
  "PROMOTION_ACCEPTANCE_RULE_CONNECTING_EMPIRICAL_DESCRIPTORS_TO_REASSESSMENT_SUFFICIENCY"
]);

export const V21_9O_METHODOLOGY_CONTRACT = Object.freeze({
  version: V21_9O_METHODOLOGY_VERSION,
  status: "PARTIAL_METHODOLOGY_FROZEN_NORMATIVE_TARGET_GOVERNANCE_REQUIRED",
  governance_basis: Object.freeze({
    v21_9n_contract_version: V21_9N_CALIBRATION_CONTRACT.version,
    v21_9n_status: V21_9N_CALIBRATION_CONTRACT.status,
    preserved_parameters: V21_9N_CALIBRATION_PARAMETERS
  }),
  calibration_evidence_eligibility: Object.freeze({
    primary: "ORGANIC_PRODUCTION_DURABLE_SHADOW_EVIDENCE",
    controlled: "MECHANISM_AND_REACHABILITY_ONLY",
    synthetic_persona: "REGRESSION_STRESS_AND_METHOD_FIXTURES_ONLY",
    external_reference: "METHODOLOGY_REFERENCE_ONLY",
    operator_preference: "NOT_SUFFICIENT_AUTHORITY"
  }),
  calibration_window_contract: Object.freeze({
    selection: "PROSPECTIVE_BOUNDARIES_LOCKED_BEFORE_OUTCOME_AGGREGATES_ARE_USED_FOR_DERIVATION",
    gaps: "PRESERVE_AS_UNOBSERVED_TIME_NOT_ZERO_EXPOSURE",
    role: "DERIVE_CANDIDATE_PARAMETER_VALUES_ONLY"
  }),
  validation_window_contract: Object.freeze({
    ordering: "STRICTLY_LATER_THAN_CALIBRATION",
    overlap: "FORBIDDEN",
    role: "TEST_FROZEN_CANDIDATE_WITHOUT_RETUNING"
  }),
  holdout_contract: Object.freeze({
    ordering: "STRICTLY_LATER_THAN_VALIDATION",
    overlap: "FORBIDDEN_WITH_CALIBRATION_AND_VALIDATION",
    role: "SEQUESTERED_CONFIRMATORY_PROMOTION_EVIDENCE",
    reuse_after_failed_validation: "FORBIDDEN_WITHOUT_NEW_VERSIONED_PROTOCOL"
  }),
  version_partitioning_policy: Object.freeze({
    regime_keys: Object.freeze([
      "activation_version",
      "policy_contract_version",
      "runtime_version",
      "evidence_schema_version",
      "context_bucket_version",
      "activation_scope"
    ]),
    pooling: "INCOMPATIBLE_VERSION_REGIMES_MUST_NOT_BE_POOLED",
    change: "START_NEW_REGIME_AND_RECALIBRATE_OR_SEPARATELY_JUSTIFY_COMPATIBILITY"
  }),
  temporal_recurrence_method:
    "USE_ORDERED_UTC_DAILY_AGGREGATES_AND_PRESERVE_NATURAL_GAPS; DO_NOT_INVENT_RECURRENCE_COUNTS",
  context_breadth_method:
    "ANALYZE_EACH_GOVERNED_MARGINAL_INDEPENDENTLY; NEVER_JOIN_MARGINALS_OR_RECONSTRUCT_USERS",
  safety_branch_coverage_method:
    "ORGANIC_OCCURRENCE_AND_RECURRENCE_FOR_MATURITY; CONTROLLED_SYNTHETIC_ONLY_FOR_REACHABILITY_LOGIC",
  unknown_source_method:
    "CHARACTERIZE_PREVALENCE_AND_RECURRENCE_WHILE_PRESERVING_SOURCE_PARTITION; ACCEPTABILITY_TARGET_UNRESOLVED",
  runtime_error_method:
    "CHARACTERIZE_PREVALENCE_RECURRENCE_AND_CLUSTERING; ACCEPTABILITY_TARGET_UNRESOLVED",
  fallback_method:
    "CHARACTERIZE_PREVALENCE_RECURRENCE_AND_CLUSTERING; ACCEPTABILITY_TARGET_UNRESOLVED",
  stability_method:
    "HARD_IDENTITY_FIELDS_ARE_INTEGRITY_GATES; OUTCOME_DISTRIBUTION_STABILITY_IS_EMPIRICAL_AND_REQUIRES_ACCEPTANCE_OBJECTIVE",
  authority_lineage_requirements: Object.freeze([
    "EVERY_DERIVED_VALUE_REFERENCES_LOCKED_METHOD_VERSION",
    "EVERY_DERIVED_VALUE_REFERENCES_EXACT_CALIBRATION_WINDOW_AND_VERSION_REGIME",
    "VALIDATION_AND_HOLDOUT_ARTIFACTS_REFERENCE_FROZEN_CANDIDATE_VERSION",
    "NO_EXTERNAL_REFERENCE_NUMBER_BECOMES_INTERNAL_THRESHOLD_WITHOUT_SEPARATE_GOVERNANCE"
  ]),
  privacy_constraints: Object.freeze([
    "NO_UNIQUE_USER_RECONSTRUCTION",
    "NO_COMPOSITE_CONTEXT_FINGERPRINTS",
    "NO_CROSS_MARGINAL_JOIN",
    "PRIVACY_SAFE_AGGREGATES_ONLY"
  ]),
  anti_overfitting_constraints: Object.freeze([
    "METHOD_AND_ROLE_BOUNDARIES_LOCK_BEFORE_DERIVATION",
    "CALIBRATION_VALIDATION_HOLDOUT_NON_OVERLAP",
    "NO_THRESHOLD_TUNING_ON_VALIDATION_OR_HOLDOUT",
    "NO_RETROACTIVE_WINDOW_SELECTION_TO_MAKE_CANDIDATE_PASS",
    "FAILED_VALIDATION_REQUIRES_NEW_VERSIONED_CANDIDATE_AND_FRESH_UNSEEN_EVIDENCE"
  ]),
  promotion_gate: Object.freeze([
    "NORMATIVE_ACCEPTANCE_OBJECTIVES_FROZEN",
    "CALIBRATED_VALUES_VERSIONED_AND_LOCKED",
    "INDEPENDENT_VALIDATION_PASS",
    "SEQUESTERED_HOLDOUT_PASS",
    "SUCCESSOR_SUFFICIENCY_POLICY_FROZEN",
    "READY_DOES_NOT_AUTHORIZE_ENFORCE"
  ]),
  insufficient_data_outcomes: Object.freeze([
    "INSUFFICIENT_TO_CALIBRATE",
    "VALIDATION_DATA_NOT_YET_AVAILABLE",
    "HOLDOUT_DATA_NOT_YET_AVAILABLE",
    "FURTHER_GOVERNANCE_REQUIRED"
  ]),
  future_stage_entry_conditions: Object.freeze([
    "NORMATIVE_ACCEPTANCE_OBJECTIVES_GOVERNED",
    "PROSPECTIVE_CALIBRATION_WINDOW_REGISTERED",
    "ORGANIC_EVIDENCE_AVAILABLE_IN_SINGLE_VERSION_REGIME",
    "VALIDATION_AND_HOLDOUT_ROLE_BOUNDARIES_PRE_REGISTERED"
  ]),
  calibrated_parameter_values: "NONE",
  ready_semantics:
    "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT_NEVER_ENFORCE_AUTHORIZATION"
});

function positiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

function intervalsOverlap(a, b) {
  if (!a || !b) return false;
  return String(a.start) < String(b.end) && String(b.start) < String(a.end);
}

export function evaluateV21_9OMethodologyScenario(input = {}) {
  if (input.retroactive_threshold_selection === true) {
    return result(V21_9O_EXECUTION_STATES.REJECTED_BY_METHODOLOGY, [
      "retroactive_threshold_selection_forbidden"
    ]);
  }
  if (input.composite_context_reconstruction === true) {
    return result(V21_9O_EXECUTION_STATES.REJECTED_BY_METHODOLOGY, [
      "composite_context_reconstruction_forbidden"
    ]);
  }
  if (
    intervalsOverlap(input.calibration_window, input.validation_window) ||
    intervalsOverlap(input.calibration_window, input.holdout_window) ||
    intervalsOverlap(input.validation_window, input.holdout_window)
  ) {
    return result(V21_9O_EXECUTION_STATES.REJECTED_BY_METHODOLOGY, [
      "calibration_validation_holdout_overlap_forbidden"
    ]);
  }
  if (positiveInt(input.version_regime_count) > 1 && input.version_partitioned !== true) {
    return result(V21_9O_EXECUTION_STATES.VERSION_PARTITION_REQUIRED, [
      "mixed_version_regimes_must_be_partitioned"
    ]);
  }
  if (positiveInt(input.organic_execution_count) === 0) {
    return result(V21_9O_EXECUTION_STATES.INSUFFICIENT_TO_CALIBRATE, [
      "organic_evidence_absent"
    ]);
  }
  if (!input.calibration_window) {
    return result(V21_9O_EXECUTION_STATES.CALIBRATION_CANDIDATE_DATA_AVAILABLE, [
      "prospective_calibration_window_not_registered"
    ]);
  }
  if (!input.validation_window) {
    return result(V21_9O_EXECUTION_STATES.VALIDATION_DATA_NOT_YET_AVAILABLE, [
      "independent_validation_window_unavailable"
    ]);
  }
  if (!input.holdout_window) {
    return result(V21_9O_EXECUTION_STATES.HOLDOUT_DATA_NOT_YET_AVAILABLE, [
      "sequestered_holdout_window_unavailable"
    ]);
  }
  if (input.normative_acceptance_objectives_frozen !== true) {
    return result(V21_9O_EXECUTION_STATES.FURTHER_GOVERNANCE_REQUIRED, [
      "normative_acceptance_objectives_not_frozen"
    ]);
  }
  return result(V21_9O_EXECUTION_STATES.METHODOLOGY_PATH_AVAILABLE, [
    "methodology_path_available_values_still_uncalibrated"
  ]);
}

function result(executionState, reasons) {
  return Object.freeze({
    methodology_version: V21_9O_METHODOLOGY_VERSION,
    primary_outcome: V21_9O_PRIMARY_OUTCOME,
    execution_state: executionState,
    reason_codes: Object.freeze([...reasons].sort((a, b) => a.localeCompare(b, "en"))),
    calibrated_parameter_values: "NONE",
    ready_for_separate_enforce_reassessment: false,
    enforce_authorized: false,
    enforce_active: false
  });
}

export function canonicalizeV21_9O(value) {
  if (Array.isArray(value)) return value.map(canonicalizeV21_9O);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, canonicalizeV21_9O(value[key])])
  );
}

export function serializeV21_9O(value) {
  return JSON.stringify(canonicalizeV21_9O(value));
}
