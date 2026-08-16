#!/usr/bin/env node
import { pathToFileURL } from "node:url";

export const STAGE = "V2.1-8Z";
export const TERMINAL = "NORMATIVE_PRODUCTION_POLICY_ACTIVATION_REQUIRES_ADDITIONAL_SHADOW_EVIDENCE";
export const BASE_MAIN = "5ce7195670eab6f2e9a2aff7810d4f48c9b6f688";
export const FROZEN_8X_MAIN = "7dd6f3566ca3a680627eb64430ca8d34178b53bd";
export const FROZEN_8Y_MAIN = BASE_MAIN;
export const POLICY_CONTRACT_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1";
export const SHADOW_RUNTIME_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1";
export const UPSTREAM_NEUTRAL_CONTRACT_VERSION = "exfoliation-non-numeric-pda-production-consumption-contract-v1";
export const UPSTREAM_NEUTRAL_SHADOW_VERSION = "exfoliation-non-numeric-pda-production-consumption-shadow-v1";
export const CANDIDATE_POLICY_VERSION = "candidate-exposure-policy-v1";
export const ROUTINE_POLICY_VERSION = "routine-policy-v1";
export const ACTIVATION_GATE_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-activation-gate-v1";
export const ENFORCEMENT_CONTRACT_VERSION = "exfoliation-non-numeric-pda-normative-production-policy-enforcement-boundary-v1";
export const FALLBACK_MODE = "FAIL_CLOSED_TO_POLICY_DEFER_PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((a, b) => a.localeCompare(b, "en"))
        .map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

const canonical = (value) => `${JSON.stringify(stable(value))}\n`;

const actionEffects = [
  {
    policy_action: "ALLOW",
    policy_eligibility_effect: "NO_POLICY_RESTRICTION",
    existing_eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    explanation_effect: "NO_WARNING_REQUIRED",
    future_consumer_invariant: "MUST_NOT_APPROVE_OR_FORCE_ELIGIBLE"
  },
  {
    policy_action: "CAUTION",
    policy_eligibility_effect: "NO_POLICY_EXCLUSION",
    existing_eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    explanation_effect: "WARNING_REQUIRED",
    future_consumer_invariant: "WARNING_METADATA_ADDITIVE_ONLY"
  },
  {
    policy_action: "RESTRICT",
    policy_eligibility_effect: "EXCLUDE_WHEN_POLICY_ENFORCED",
    existing_eligibility_effect: "CAN_ONLY_REMOVE_FROM_EXISTING_ELIGIBLE_SET",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    top_k_effect: "INDIRECT_VIA_ELIGIBILITY_EXCLUSION_ONLY",
    explanation_effect: "RESTRICTION_EXPLANATION_REQUIRED",
    future_consumer_invariant: "NEVER_RESURRECT_OR_REWEIGHT_CANDIDATE"
  },
  {
    policy_action: "DEFER",
    policy_eligibility_effect: "NO_POLICY_EXCLUSION",
    existing_eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    explanation_effect: "UNCERTAINTY_EXPLANATION_REQUIRED",
    future_consumer_invariant: "MUST_NOT_COERCE_TO_ALLOW"
  },
  {
    policy_action: "NOT_APPLICABLE",
    policy_eligibility_effect: "NO_POLICY_RESTRICTION",
    existing_eligibility_effect: "PRESERVE_EXISTING_ELIGIBILITY",
    score_effect: "NO_DIRECT_SCORE_MUTATION",
    ranking_effect: "NO_DIRECT_RANK_MUTATION",
    top_k_effect: "NO_DIRECT_TOP_K_MUTATION",
    explanation_effect: "EXPLANATION_OPTIONAL",
    future_consumer_invariant: "NOT_A_NEGATIVE_PRODUCT_JUDGMENT"
  }
];

const failureRows = [
  ["EVALUATOR_EXCEPTION", "policy_evaluator_exception"],
  ["INVALID_POLICY_ACTION", "invalid_policy_action"],
  ["CONTRACT_VERSION_MISMATCH", "policy_contract_version_mismatch"],
  ["MISSING_NEUTRAL_ENVELOPE", "missing_neutral_envelope"],
  ["MALFORMED_EXTERNAL_POLICY_CONTEXT", "malformed_external_policy_context"],
  ["MISSING_PROVENANCE", "missing_policy_provenance"],
  ["UNSUPPORTED_UPSTREAM_VERSION", "unsupported_upstream_version"],
  ["CONTRADICTORY_REASON_STATE", "contradictory_policy_reason_state"],
  ["ENFORCEMENT_ADAPTER_FAILURE", "policy_enforcement_adapter_failure"]
].map(([failure_class, reason_code]) => ({
  failure_class,
  reason_code,
  fallback_policy_action: "DEFER",
  default_to_allow: false,
  apply_policy_exclusion: false,
  canonical_fallback: "PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH",
  fallback_mode: FALLBACK_MODE,
  observability_required: true
}));

const requiredMetrics = [
  "evaluations_total",
  "allow_count",
  "allow_rate",
  "caution_count",
  "caution_rate",
  "restrict_count",
  "restrict_rate",
  "defer_count",
  "defer_rate",
  "not_applicable_count",
  "not_applicable_rate",
  "evaluation_error_count",
  "fallback_count",
  "policy_legacy_divergence_count",
  "policy_legacy_divergence_rate",
  "divergence_taxonomy_distribution",
  "enforcement_relevant_divergence_count",
  "activation_blocking_divergence_count",
  "reason_code_distribution",
  "provenance_missing_count",
  "candidate_exclusion_count",
  "candidate_count_before_enforcement",
  "candidate_count_after_enforcement",
  "top_k_changed_count",
  "rollback_event_count",
  "policy_contract_version",
  "runtime_version",
  "activation_version"
];

export function buildActionEffectMatrix() {
  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-canonical-effect-matrix-v1",
    stage: STAGE,
    terminal: TERMINAL,
    policy_contract_version: POLICY_CONTRACT_VERSION,
    actions: actionEffects,
    invariants: {
      allow_is_approval: false,
      caution_numeric_penalty: false,
      defer_is_permissive_default: false,
      not_applicable_is_negative_judgment: false,
      restrict_direct_score_mutation: false,
      restrict_direct_rank_mutation: false,
      restrict_direct_top_k_mutation: false
    }
  };
}

export function buildEnforcementBoundaryContract() {
  return {
    version: ENFORCEMENT_CONTRACT_VERSION,
    stage: STAGE,
    terminal: TERMINAL,
    policy_contract_version: POLICY_CONTRACT_VERSION,
    future_integration_boundary: {
      preferred_boundary: "POST_SCORE_POST_SORT_ELIGIBILITY_OVERLAY_BEFORE_RESULT_ASSEMBLY",
      current_architecture_anchor: [
        "required-field/gender candidate filtering",
        "score calculation",
        "deterministic score sorting",
        "existing candidate eligibility/exposure resolution",
        "FUTURE_NORMATIVE_POLICY_ELIGIBILITY_OVERLAY",
        "TopPick/Top3/supporting/budget/routine/public-result assembly"
      ],
      candidate_level_scope: true,
      score_calculation_occurs_before_policy_exclusion: true,
      candidate_exposure_policy_relationship: "INDEPENDENT_INTERSECTION_NOT_REPLACEMENT",
      existing_hard_filter_relationship: "EXISTING_FILTERS_REMAIN_AUTHORITATIVE_AND_RUN_INDEPENDENTLY",
      final_eligibility_formula: "existing_eligibility AND normative_policy_eligibility",
      top_k_relationship: "RECOMPUTED_ONLY_FROM_POST_ELIGIBILITY_SET_WITH_NO_DIRECT_TOP_K_RULE",
      persistence_effect: "NONE_BY_DEFAULT",
      public_response_schema_effect: "NONE_IN_8Z"
    },
    restrict_enforcement_contract: {
      action: "RESTRICT",
      enforcement_effect: "SET_NORMATIVE_POLICY_ELIGIBLE_FALSE_WHEN_AND_ONLY_WHEN_MODE_ENFORCE",
      removes_candidate_from_all_selection_lanes: true,
      mutates_score_value: false,
      mutates_rank_score_formula: false,
      can_change_top_k_indirectly: true,
      reason_propagation_required: [
        "policy_action",
        "reason_codes",
        "authority_sources",
        "policy_contract_version",
        "runtime_version",
        "activation_version",
        "upstream_neutral_gate",
        "fallback_state"
      ],
      observability_event_required: true,
      partial_enforcement_on_adapter_failure_allowed: false,
      rollback_target: "LEGACY_ONLY"
    },
    non_restrict_actions: Object.fromEntries(
      actionEffects
        .filter((row) => row.policy_action !== "RESTRICT")
        .map((row) => [row.policy_action, row])
    ),
    implementation_state: {
      contract_frozen_in_8z: true,
      canonical_consumer_implemented: false,
      restrict_enforcement_implemented: false,
      production_activation_authorized: false
    }
  };
}

export function buildFailureFallbackMatrix() {
  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-failure-fallback-matrix-v1",
    stage: STAGE,
    terminal: TERMINAL,
    fallback_mode: FALLBACK_MODE,
    design_principles: {
      policy_certainty_fail_closed: "DEFER",
      production_continuity: "PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH",
      default_allow_forbidden: true,
      blanket_candidate_exclusion_on_policy_failure: false,
      per_request_partial_enforcement_forbidden: true
    },
    failures: failureRows
  };
}

export function buildObservabilityRequirements() {
  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-observability-requirements-v1",
    stage: STAGE,
    terminal: TERMINAL,
    telemetry_state: "CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED",
    required_metrics: requiredMetrics,
    rate_denominator: "evaluations_total",
    privacy_boundary: {
      aggregate_by_default: true,
      raw_user_input_forbidden: true,
      raw_photo_forbidden: true,
      product_name_required: false,
      reason_codes_aggregated: true
    },
    mandatory_dimensions: [
      "policy_action",
      "divergence_class",
      "reason_code",
      "fallback_reason",
      "policy_contract_version",
      "runtime_version",
      "activation_version",
      "mode"
    ]
  };
}

export function buildRollbackRequirements() {
  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-rollback-requirements-v1",
    stage: STAGE,
    terminal: TERMINAL,
    rollback_state: "CONTRACT_ONLY_NOT_PRODUCTION_IMPLEMENTED",
    requirements: {
      one_step_disable: true,
      disable_overrides_enable_and_mode: true,
      restore_target: "LEGACY_ONLY",
      database_rollback_required: false,
      product_fact_rollback_required: false,
      registry_rollback_required: false,
      migration_rollback_required: false,
      irreversible_policy_decision_persistence_allowed: false,
      activation_version_auditable: true,
      previous_version_recoverable: true,
      rollback_event_observable: true
    },
    rollback_sequence: [
      "set kill-switch/disable override",
      "stop normative enforcement consumption",
      "restore existing legacy candidate path as sole canonical authority",
      "emit rollback event with versions",
      "verify candidate/public/persistence path follows legacy-only contract"
    ]
  };
}

export function buildActivationGateContract() {
  return {
    version: ACTIVATION_GATE_VERSION,
    stage: STAGE,
    terminal: TERMINAL,
    modes: ["OFF", "SHADOW", "ENFORCE"],
    default_mode: "OFF",
    required_fields: [
      "policy_contract_version",
      "runtime_version",
      "activation_version",
      "enabled",
      "mode",
      "kill_switch_requested",
      "rollback_target",
      "expected_upstream_versions",
      "fallback_mode"
    ],
    expected_versions: {
      policy_contract_version: POLICY_CONTRACT_VERSION,
      runtime_version: SHADOW_RUNTIME_VERSION,
      upstream_neutral_contract_version: UPSTREAM_NEUTRAL_CONTRACT_VERSION,
      upstream_neutral_shadow_version: UPSTREAM_NEUTRAL_SHADOW_VERSION,
      candidate_exposure_policy_version: CANDIDATE_POLICY_VERSION,
      routine_policy_version: ROUTINE_POLICY_VERSION
    },
    gate_semantics: {
      OFF: "NO_NORMATIVE_CANONICAL_CONSUMPTION",
      SHADOW: "EVALUATE_AND_OBSERVE_WITH_ZERO_CANONICAL_EFFECT",
      ENFORCE: "APPLY_ONLY_RESTRICT_ELIGIBILITY_OVERLAY_AFTER_ALL_ACTIVATION_PREREQUISITES_PASS",
      kill_switch: "DISABLE_OVERRIDES_ENABLE_AND_MODE",
      invalid_or_unknown_mode: "OFF_WITH_FALLBACK_OBSERVABILITY",
      version_mismatch: FALLBACK_MODE
    },
    current_state: {
      canonical_gate_implemented: false,
      selected_canonical_mode: "OFF",
      shadow_runtime_available: true,
      separate_shadow_observation_available: true,
      enforce_authorized: false,
      activation_executed: false
    },
    activation_version_contract: {
      example_identifier: "exfoliation-non-numeric-pda-normative-production-policy-activation-v1",
      exact_version_pin_required: true,
      production_enforce_requires_separate_authorization: true
    },
    rollback_target: "LEGACY_ONLY",
    fallback_mode: FALLBACK_MODE
  };
}

export function buildReadinessEvidenceAssessment() {
  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-readiness-evidence-assessment-v1",
    stage: STAGE,
    terminal: TERMINAL,
    evidence_classes: {
      synthetic_contract_coverage: {
        canonical_cases: 17,
        all_five_policy_actions_covered: true,
        status: "SUFFICIENT_FOR_CONTRACT_SEMANTICS"
      },
      real_governed_product_coverage: {
        product_count: 4,
        observed_action_distribution: {
          ALLOW: 2,
          CAUTION: 0,
          RESTRICT: 0,
          DEFER: 2,
          NOT_APPLICABLE: 0
        },
        real_restrict_observed: false,
        real_caution_observed: false,
        all_policy_actions_represented: false,
        status: "INSUFFICIENT_FOR_ACTIVATION_AUTHORIZATION"
      },
      production_distribution_coverage: {
        full_distribution_normative_shadow_observed: false,
        canonical_1968_invariance_available: true,
        canonical_1968_action_distribution_available: false,
        status: "INSUFFICIENT_FOR_ACTIVATION_AUTHORIZATION"
      }
    },
    external_context_coverage: {
      governed_replay_resolved_hard_block: false,
      governed_replay_routine_hold_or_blocked: false,
      governed_replay_caution_context: false,
      governed_replay_defer_context: true,
      synthetic_contract_has_restrict_and_caution: true
    },
    divergence_evidence: {
      bounded_governed_rows: 4,
      distribution: {
        AUTHORITY_COVERAGE_GAP: 2,
        LEGACY_MORE_CAUTIOUS: 2
      },
      unexplained_high_risk_divergence_count_in_bounded_cohort: 0,
      real_restrict_enforcement_relevant_divergence_observed: false,
      activation_risk_conclusion: "CANNOT_AUTHORIZE_ENFORCEMENT_FROM_BOUNDED_NON_RESTRICT_COHORT"
    },
    failure_mode_coverage: {
      contract_simulation_in_8z: true,
      production_runtime_failure_handling_implemented: false,
      status: "CONTRACT_DEFINED_IMPLEMENTATION_VALIDATION_STILL_REQUIRED"
    },
    unmet_activation_evidence_requirements: [
      "real governed CAUTION observation",
      "real governed RESTRICT observation",
      "real governed NOT_APPLICABLE/non-applicable observation",
      "external safety/routine contexts exercised on governed real products",
      "production-distribution normative shadow action distribution",
      "RESTRICT-driven hypothetical Top-K impact on production-distribution candidates",
      "runtime failure/fallback implementation validation",
      "observability implementation validation",
      "kill-switch/rollback implementation validation"
    ],
    quantitative_sample_threshold: "NOT_ARBITRARILY_DEFINED",
    future_activation_evidence_gate: [
      "all five actions remain deterministic in canonical contract cases",
      "no unresolved semantic gap",
      "real governed products exercise ALLOW/CAUTION/RESTRICT/DEFER and a real NOT_APPLICABLE case is represented",
      "all externally sourced RESTRICT/DEFER/CAUTION context families are exercised on governed real-product shadow cases",
      "production-distribution shadow action and divergence distributions are measured",
      "every RESTRICT-related divergence is explainable and zero activation-blocking divergence remains",
      "failure fallback behavior is implementation-validated and never defaults to ALLOW",
      "observability, rollback, and version gate implementations are validated",
      "pre-activation canonical production invariance remains zero-delta"
    ]
  };
}

function candidate(id, score, action, legacyEligible = true) {
  return { id, score, legacy_rank: null, action, legacy_eligible: legacyEligible };
}

function rank(rows) {
  return [...rows]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, "en"))
    .map((row, index) => ({ ...row, legacy_rank: index + 1 }));
}

function simulate(rows, mode = "ENFORCE") {
  const ranked = rank(rows);
  const before = ranked.filter((row) => row.legacy_eligible);
  const excluded = mode === "ENFORCE"
    ? before.filter((row) => row.action === "RESTRICT").map((row) => row.id)
    : [];
  const after = mode === "ENFORCE"
    ? before.filter((row) => row.action !== "RESTRICT")
    : before;
  return {
    mode,
    label: "HYPOTHETICAL_ENFORCEMENT_ONLY",
    before_candidate_ids: before.map((row) => row.id),
    after_candidate_ids: after.map((row) => row.id),
    excluded_candidate_ids: excluded,
    top3_before: before.slice(0, 3).map((row) => row.id),
    top3_after: after.slice(0, 3).map((row) => row.id),
    top_k_changed_indirectly: before.slice(0, 3).map((row) => row.id).join("|") !== after.slice(0, 3).map((row) => row.id).join("|"),
    score_values_mutated: false,
    rank_formula_mutated: false,
    canonical_production_mutated: false
  };
}

function fallbackScenario(failureClass) {
  return {
    label: "HYPOTHETICAL_ENFORCEMENT_ONLY",
    failure_class: failureClass,
    effective_policy_action: "DEFER",
    default_to_allow: false,
    policy_exclusion_applied: false,
    canonical_path: "PRESERVE_EXISTING_LEGACY_PRODUCTION_PATH"
  };
}

export function buildHypotheticalEnforcementSimulation() {
  const standard = [
    candidate("allow_high", 100, "ALLOW"),
    candidate("caution_high", 95, "CAUTION"),
    candidate("restrict_inside_topk", 90, "RESTRICT"),
    candidate("defer_candidate", 85, "DEFER"),
    candidate("not_applicable_candidate", 80, "NOT_APPLICABLE"),
    candidate("restrict_outside_topk", 50, "RESTRICT")
  ];
  const deferStrong = [
    candidate("defer_strong_legacy", 120, "DEFER"),
    candidate("allow_second", 100, "ALLOW")
  ];
  const cautionStrong = [
    candidate("caution_strong_preference", 125, "CAUTION"),
    candidate("allow_second", 100, "ALLOW")
  ];
  const disagreement = [
    candidate("legacy_eligible_policy_restrict", 110, "RESTRICT", true),
    candidate("legacy_eligible_allow", 100, "ALLOW", true)
  ];
  const noAuthority = [candidate("no_governed_pda_authority", 105, "DEFER", true)];

  const scenarios = [
    { id: "S01_ALLOW_CANDIDATE", result: simulate([standard[0]], "ENFORCE") },
    { id: "S02_CAUTION_CANDIDATE", result: simulate([standard[1]], "ENFORCE") },
    { id: "S03_RESTRICT_CANDIDATE", result: simulate([standard[2]], "ENFORCE") },
    { id: "S04_DEFER_CANDIDATE", result: simulate([standard[3]], "ENFORCE") },
    { id: "S05_NOT_APPLICABLE_CANDIDATE", result: simulate([standard[4]], "ENFORCE") },
    { id: "S06_RESTRICT_INSIDE_TOP_K", result: simulate(standard, "ENFORCE") },
    { id: "S07_RESTRICT_OUTSIDE_TOP_K", result: simulate([standard[0], standard[1], standard[3], standard[4], standard[5]], "ENFORCE") },
    { id: "S08_MULTIPLE_RESTRICT", result: simulate(standard, "ENFORCE") },
    { id: "S09_DEFER_STRONG_LEGACY_RANKING", result: simulate(deferStrong, "ENFORCE") },
    { id: "S10_CAUTION_STRONG_PREFERENCE_SCORE", result: simulate(cautionStrong, "ENFORCE") },
    { id: "S11_EVALUATOR_FAILURE", result: fallbackScenario("EVALUATOR_EXCEPTION") },
    { id: "S12_INVALID_CONTRACT_VERSION", result: fallbackScenario("CONTRACT_VERSION_MISMATCH") },
    { id: "S13_MISSING_PROVENANCE", result: fallbackScenario("MISSING_PROVENANCE") },
    {
      id: "S14_POLICY_LEGACY_DISAGREEMENT",
      result: {
        ...simulate(disagreement, "ENFORCE"),
        divergence_kind: "ENFORCEMENT_RELEVANT_DIVERGENCE",
        activation_blocking_by_itself: false,
        manual_explanation_required_before_activation: true
      }
    },
    { id: "S15_NO_GOVERNED_PDA_AUTHORITY", result: { ...simulate(noAuthority, "ENFORCE"), effective_policy_action: "DEFER" } },
    { id: "S16_ROLLBACK_TO_LEGACY_ONLY", result: { ...simulate(standard, "OFF"), rollback_target: "LEGACY_ONLY" } },
    { id: "S17_ACTIVATION_GATE_OFF", result: simulate(standard, "OFF") },
    { id: "S18_ACTIVATION_GATE_SHADOW", result: { ...simulate(standard, "SHADOW"), hypothetical_enforce_preview: simulate(standard, "ENFORCE") } },
    { id: "S19_HYPOTHETICAL_ENFORCE", result: simulate(standard, "ENFORCE") }
  ];

  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-hypothetical-enforcement-simulation-v1",
    stage: STAGE,
    terminal: TERMINAL,
    mode: "HYPOTHETICAL_ENFORCEMENT_ONLY",
    scenario_count: scenarios.length,
    scenarios,
    invariants: {
      canonical_production_mutated: false,
      score_formula_mutated: false,
      rank_formula_mutated: false,
      restrict_enforcement_active: false,
      simulation_authorizes_activation: false
    }
  };
}

export function buildActivationReadinessContract() {
  return {
    version: "exfoliation-non-numeric-pda-normative-production-policy-activation-readiness-contract-v1",
    stage: STAGE,
    primary_terminal_outcome: TERMINAL,
    authority: {
      repository: "gycha0109-beep/K_beauty",
      base_main_sha: BASE_MAIN,
      frozen_8x_main_sha: FROZEN_8X_MAIN,
      frozen_8y_main_sha: FROZEN_8Y_MAIN,
      policy_contract_version: POLICY_CONTRACT_VERSION,
      shadow_runtime_version: SHADOW_RUNTIME_VERSION
    },
    readiness_dimensions: [
      {
        dimension: "SEMANTIC_READINESS",
        status: "READY_FOR_FUTURE_ENFORCEMENT_CONTRACT",
        basis: "Five-action vocabulary, precedence, uncertainty, and downstream effects are deterministic in frozen 8X."
      },
      {
        dimension: "RUNTIME_READINESS",
        status: "READY_FOR_FUTURE_CANONICAL_CONSUMER_CONTRACT",
        basis: "8Y runtime is deterministic, callable, exact on 17 canonical cases, and remains shadow-only."
      },
      {
        dimension: "COVERAGE_READINESS",
        status: "ADDITIONAL_SHADOW_EVIDENCE_REQUIRED",
        basis: "Four governed products cover ALLOW and DEFER only; no real CAUTION/RESTRICT or production-distribution action coverage."
      },
      {
        dimension: "DIVERGENCE_READINESS",
        status: "PARTIAL_ADDITIONAL_ENFORCEMENT_RELEVANT_EVIDENCE_REQUIRED",
        basis: "Bounded divergence is explainable but contains no real RESTRICT enforcement case."
      },
      {
        dimension: "ENFORCEMENT_READINESS",
        status: "CONTRACT_FROZEN_IMPLEMENTATION_NOT_ACTIVE",
        basis: "Eligibility-only post-score boundary is deterministic; no enforcement implementation is authorized in 8Z."
      },
      {
        dimension: "OBSERVABILITY_READINESS",
        status: "CONTRACT_FROZEN_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION",
        basis: "Required metrics and privacy boundary are frozen; telemetry backend is not activated by 8Z."
      },
      {
        dimension: "ROLLBACK_READINESS",
        status: "CONTRACT_FROZEN_IMPLEMENTATION_REQUIRED_BEFORE_ACTIVATION",
        basis: "One-step disable and legacy-only rollback are frozen without DB dependency."
      }
    ],
    readiness_result: {
      enforcement_semantics_fully_defined: true,
      canonical_integration_boundary_identified: true,
      fallback_contract_explicit: true,
      observability_contract_explicit: true,
      rollback_contract_explicit: true,
      versioned_activation_gate_explicit: true,
      semantic_blocker_present: false,
      current_evidence_sufficient_for_activation_authorization: false,
      additional_shadow_evidence_required: true
    },
    evidence_separation: [
      "SYNTHETIC_CONTRACT_COVERAGE",
      "REAL_GOVERNED_PRODUCT_COVERAGE",
      "PRODUCTION_DISTRIBUTION_COVERAGE"
    ],
    invariants: {
      DECISION_AXIS_PRODUCTION_CONSUMPTION: "NO",
      NORMATIVE_POLICY_SHADOW_RUNTIME_IMPLEMENTED: "YES",
      NORMATIVE_POLICY_CANONICAL_RUNTIME_IMPLEMENTED: "NO",
      NORMATIVE_POLICY_RUNTIME_ACTIVE: "NO",
      PRODUCTION_POLICY_ACTIVATED: "NO",
      PRODUCTION_ACTIVATION_AUTHORIZED: "NO",
      ACTIVATION_EXECUTED: "NO",
      RESTRICT_ENFORCEMENT_IMPLEMENTED: "NO",
      RESTRICT_CANONICAL_EXCLUSION_ACTIVE: "NO",
      ALLOW_PROMOTED_TO_CANONICAL_APPROVAL: "NO",
      DEFER_PROMOTED_TO_ALLOW: "NO",
      RECOMMENDATION_SCORER_CHANGED: "NO",
      RECOMMENDATION_RANKER_CHANGED: "NO",
      RECOMMENDATION_ACTIVATED: "NO",
      CANDIDATE_POLICY_PRODUCTION_CHANGED: "NO",
      LEGACY_HEURISTIC_REPLACED: "NO",
      NUMERIC_FITTING: 0,
      POTENCY_ORDERING_CREATED: "NO",
      HOSTED_PRODUCT_FACT_WRITES: 0,
      REGISTRY_DEFINITION_DELTA: 0,
      MIGRATION_DELTA: 0
    }
  };
}

export const builders = {
  readiness: buildActivationReadinessContract,
  enforcement: buildEnforcementBoundaryContract,
  effects: buildActionEffectMatrix,
  failure: buildFailureFallbackMatrix,
  observability: buildObservabilityRequirements,
  rollback: buildRollbackRequirements,
  gate: buildActivationGateContract,
  evidence: buildReadinessEvidenceAssessment,
  simulation: buildHypotheticalEnforcementSimulation
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv[2] || "readiness";
  if (!builders[mode]) {
    process.stderr.write(`unknown mode: ${mode}\n`);
    process.exit(2);
  }
  process.stdout.write(canonical(builders[mode]()));
}
