import {
  validateV21_9MReadback
} from "./exfoliation-normative-policy-durable-evidence-readback.js";

export const V21_9N_POLICY_VERSION =
  "enforce-reassessment-sufficiency-governance-v1";
export const V21_9N_CALIBRATION_CONTRACT_VERSION =
  "enforce-reassessment-sufficiency-calibration-contract-v1";
export const V21_9N_PRIMARY_OUTCOME =
  "ENFORCE_REASSESSMENT_SUFFICIENCY_CALIBRATION_REQUIRED";

export const V21_9N_DECISION_STATES = Object.freeze({
  BLOCKED: "BLOCKED_INTEGRITY_FAILURE",
  NOT_READY: "NOT_READY",
  CALIBRATION_REQUIRED: "SUFFICIENCY_CALIBRATION_REQUIRED",
  READY: "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT"
});

export const V21_9N_ACTIONS = Object.freeze([
  "ALLOW",
  "CAUTION",
  "RESTRICT",
  "DEFER",
  "NOT_APPLICABLE"
]);

export const V21_9N_CONTEXT_DIMENSIONS = Object.freeze([
  "PRIMARY_CONCERN_CLASS",
  "SENSITIVITY_RISK_CLASS",
  "CONCERN_STRUCTURE_CLASS",
  "SURVEY_COMPLETENESS_CLASS",
  "RECENT_INSTABILITY_CLASS"
]);

export const V21_9N_AUTHORITY_HIERARCHY = Object.freeze([
  Object.freeze({
    level: 1,
    authority: "FROZEN_BEJEWELY_GOVERNANCE_INVARIANT",
    hard_prerequisite: true,
    qualitative_requirement: true,
    numeric_threshold: "METHODOLOGY_ONLY_UNLESS_EMPIRICALLY_CALIBRATED"
  }),
  Object.freeze({
    level: 2,
    authority: "OBSERVED_CANONICAL_SYSTEM_BEHAVIOR",
    hard_prerequisite: "STATE_EVIDENCE",
    qualitative_requirement: true,
    numeric_threshold: false
  }),
  Object.freeze({
    level: 3,
    authority: "CONTROLLED_VALIDATION_EVIDENCE",
    hard_prerequisite: "MECHANISM_VALIDATION",
    qualitative_requirement: true,
    numeric_threshold: "CANNOT_SUBSTITUTE_FOR_ORGANIC_MATURITY"
  }),
  Object.freeze({
    level: 4,
    authority: "ORGANIC_PRODUCTION_EVIDENCE",
    hard_prerequisite: "OBSERVED_STATE",
    qualitative_requirement: true,
    numeric_threshold: "ELIGIBLE_ONLY_UNDER_FROZEN_CALIBRATION_METHOD"
  }),
  Object.freeze({
    level: 5,
    authority: "EXTERNAL_SCIENTIFIC_OR_INDUSTRY_REFERENCE",
    hard_prerequisite: false,
    qualitative_requirement: "METHODOLOGY_REFERENCE_ONLY",
    numeric_threshold: "NOT_INTERNAL_AUTHORITY_BY_ITSELF"
  }),
  Object.freeze({
    level: 6,
    authority: "PURE_OPERATOR_PREFERENCE",
    hard_prerequisite: false,
    qualitative_requirement: false,
    numeric_threshold: false
  })
]);

export const V21_9N_CALIBRATION_PARAMETERS = Object.freeze([
  "minimum_observation_horizon",
  "minimum_organic_execution_volume",
  "required_temporal_recurrence",
  "required_context_breadth",
  "required_safety_relevant_branch_coverage",
  "unknown_source_tolerance",
  "runtime_error_tolerance",
  "fallback_tolerance",
  "stability_criterion"
]);

export const V21_9N_CALIBRATION_CONTRACT = Object.freeze({
  version: V21_9N_CALIBRATION_CONTRACT_VERSION,
  status: "FROZEN_PARAMETERS_VALUES_UNCALIBRATED",
  primary_maturity_source: "FUTURE_ORGANIC_DURABLE_SHADOW_EVIDENCE",
  supporting_sources: Object.freeze({
    CONTROLLED_PRODUCTION_EVIDENCE:
      "INSTRUMENTATION_AND_EDGE_VALIDATION_ONLY_NOT_ORGANIC_MATURITY",
    SYNTHETIC_SIMULATION_EVIDENCE:
      "REGRESSION_AND_STRESS_ONLY_NOT_ORGANIC_MATURITY",
    HISTORICAL_PRIVACY_SAFE_PROJECTIONS:
      "DIAGNOSTIC_ONLY_UNLESS_SEPARATELY_GOVERNED",
    EXTERNAL_REFERENCE:
      "METHODOLOGY_ONLY_NOT_DIRECT_THRESHOLD_AUTHORITY",
    OPERATOR_PREFERENCE:
      "INSUFFICIENT_AS_SOLE_CALIBRATION_AUTHORITY"
  }),
  parameters: V21_9N_CALIBRATION_PARAMETERS,
  methodology_constraints: Object.freeze([
    "PRE_REGISTER_CALIBRATION_METHOD_BEFORE_VALIDATION_WINDOW",
    "SEPARATE_CALIBRATION_DATA_FROM_VALIDATION_OR_HOLDOUT",
    "VERSION_AND_LOCK_RESULTING_POLICY_ARTIFACT",
    "NO_RETROACTIVE_THRESHOLD_SELECTION_TO_MAKE_CURRENT_EVIDENCE_PASS",
    "NO_UNIQUE_USER_RECONSTRUCTION",
    "NO_COMPOSITE_CONTEXT_FINGERPRINTS",
    "CONTROLLED_OR_SYNTHETIC_EVIDENCE_MUST_NOT_SUBSTITUTE_FOR_ORGANIC_MATURITY",
    "THRESHOLD_OR_CRITERION_MUST_HAVE_EXPLICIT_AUTHORITY_LINEAGE"
  ]),
  future_stage_entry_conditions: Object.freeze([
    "INTEGRITY_PREREQUISITES_PASS",
    "MANDATORY_QUALITATIVE_EVIDENCE_CATEGORIES_OBSERVED",
    "ORGANIC_SHADOW_EVIDENCE_ACCUMULATED",
    "CALIBRATION_METHOD_FROZEN",
    "CALIBRATION_VALUES_DERIVED_FROM_AUTHORIZED_EVIDENCE",
    "SEPARATE_VALIDATION_COMPLETED",
    "SUCCESSOR_SUFFICIENCY_POLICY_FROZEN"
  ]),
  ready_semantics:
    "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT_NEVER_ENFORCE_AUTHORIZATION"
});

function int(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function actionTotal(source) {
  return V21_9N_ACTIONS.reduce(
    (sum, action) => sum + int(source?.actions?.[action]),
    0
  );
}

function totalAcrossSources(readback, key) {
  return [
    "ORGANIC_PRODUCTION",
    "CONTROLLED_PRODUCTION_PROBE",
    "UNKNOWN_PRODUCTION_SOURCE"
  ].reduce((sum, source) => sum + int(readback?.sources?.[source]?.[key]), 0);
}

function contextCoverage(readback) {
  const present = new Set(
    (readback?.context_marginals || [])
      .filter(
        (row) =>
          row?.production_source === "ORGANIC_PRODUCTION" &&
          int(row?.execution_count) > 0 &&
          V21_9N_CONTEXT_DIMENSIONS.includes(row?.partition_key)
      )
      .map((row) => row.partition_key)
  );
  return Object.fromEntries(
    V21_9N_CONTEXT_DIMENSIONS.map((dimension) => [
      dimension,
      present.has(dimension)
    ])
  );
}

function dimension(id, state, evidence = {}) {
  return Object.freeze({
    id,
    state,
    evidence: Object.freeze({ ...evidence })
  });
}

function integrityBlockers(readback, authority) {
  const blockers = [];
  if (authority.productionShadowActive !== true) {
    blockers.push("production_shadow_not_active");
  }
  if (authority.enforcementAllowed !== false) {
    blockers.push("enforcement_allowed_not_false");
  }
  if (authority.enforceActive !== false) {
    blockers.push("enforce_active_not_false");
  }
  if (authority.restrictCanonicalExclusionActive !== false) {
    blockers.push("restrict_canonical_exclusion_active");
  }
  if (authority.provenanceExplicit !== true) {
    blockers.push("provenance_not_explicit");
  }
  if (authority.controlledEvidenceSeparated !== true) {
    blockers.push("controlled_evidence_not_separated");
  }
  if (authority.unknownEvidenceNotPromotedToOrganic !== true) {
    blockers.push("unknown_source_promoted_or_unverified");
  }
  if (authority.versionCompatible !== true) {
    blockers.push("production_version_incompatible");
  }
  if (authority.scopeValid !== true) {
    blockers.push("production_scope_invalid");
  }
  if (authority.canonicalRecommendationInvarianceReference !== true) {
    blockers.push("canonical_recommendation_invariance_not_verified");
  }
  if (authority.hostedProductFactStable !== true) {
    blockers.push("hosted_product_fact_not_stable");
  }
  if (authority.durableEvidenceAuthorityHealthy !== true) {
    blockers.push("durable_evidence_authority_not_healthy");
  }
  if (totalAcrossSources(readback, "actual_exclusion_count") > 0) {
    blockers.push("shadow_actual_exclusion_nonzero");
  }
  if (totalAcrossSources(readback, "stop_required_count") > 0) {
    blockers.push("stop_required_observed");
  }
  if ((readback?.version_groups || []).length > 1) {
    blockers.push("mixed_runtime_versions_in_window");
  }
  if (
    int(readback?.sources?.ORGANIC_PRODUCTION?.execution_count) > 0 &&
    (readback?.version_groups || []).length === 0
  ) {
    blockers.push("observed_execution_without_version_authority");
  }
  return [...new Set(blockers)].sort((a, b) => a.localeCompare(b, "en"));
}

function mandatoryDimensions(readback, authority) {
  const organic = readback.sources.ORGANIC_PRODUCTION;
  const unknown = readback.sources.UNKNOWN_PRODUCTION_SOURCE;
  const coverage = contextCoverage(readback);
  const integrityPass =
    authority.provenanceExplicit === true &&
    authority.controlledEvidenceSeparated === true &&
    authority.unknownEvidenceNotPromotedToOrganic === true;
  const versionPass =
    authority.versionCompatible === true &&
    authority.scopeValid === true &&
    readback.version_groups.length <= 1;
  return Object.freeze([
    dimension(
      "R1_ORGANIC_TRAFFIC_PRESENT",
      organic.execution_count > 0 ? "PASS" : "NOT_OBSERVED",
      { organic_execution_count: organic.execution_count }
    ),
    dimension(
      "R2_PROVENANCE_INTEGRITY",
      integrityPass ? "PASS" : "BLOCKED",
      {
        provenance_explicit: authority.provenanceExplicit === true,
        controlled_evidence_separated:
          authority.controlledEvidenceSeparated === true,
        unknown_not_promoted:
          authority.unknownEvidenceNotPromotedToOrganic === true
      }
    ),
    dimension(
      "R3_UNKNOWN_SOURCE_INTEGRITY",
      unknown.execution_count === 0
        ? "PASS"
        : integrityPass
          ? "CHARACTERIZED_REQUIRES_CALIBRATION"
          : "BLOCKED",
      { unknown_execution_count: unknown.execution_count }
    ),
    dimension(
      "R4_ORGANIC_ACTION_EVIDENCE",
      actionTotal(organic) > 0 ? "PASS" : "NOT_OBSERVED",
      {
        organic_action_total: actionTotal(organic),
        every_action_required: false,
        safety_relevant_branch_coverage_calibrated: false
      }
    ),
    dimension(
      "R5_ORGANIC_CONTEXT_DIVERSITY_EVIDENCE",
      Object.values(coverage).every(Boolean)
        ? "EVIDENCE_PRESENT_MATURITY_UNGOVERNED"
        : "NOT_OBSERVED",
      {
        marginal_dimensions_present:
          Object.values(coverage).filter(Boolean).length,
        governed_marginal_dimensions: V21_9N_CONTEXT_DIMENSIONS.length,
        composite_fingerprint_used: false,
        breadth_threshold_calibrated: false
      }
    ),
    dimension(
      "R6_FALLBACK_BEHAVIOR_EVIDENCE",
      organic.execution_count > 0 ? "PASS" : "NOT_OBSERVED",
      {
        organic_fallback_count: organic.fallback_count,
        zero_is_characterized_when_organic_observed:
          organic.execution_count > 0 && organic.fallback_count === 0,
        tolerance_calibrated: false
      }
    ),
    dimension(
      "R7_RUNTIME_ERROR_BEHAVIOR_EVIDENCE",
      organic.execution_count > 0 ? "PASS" : "NOT_OBSERVED",
      {
        organic_runtime_error_count: organic.runtime_error_count,
        zero_is_characterized_when_organic_observed:
          organic.execution_count > 0 && organic.runtime_error_count === 0,
        tolerance_calibrated: false
      }
    ),
    dimension(
      "R8_SHADOW_ACTUAL_EXCLUSION_INVARIANT",
      totalAcrossSources(readback, "actual_exclusion_count") === 0
        ? "PASS"
        : "BLOCKED",
      {
        actual_exclusion_total: totalAcrossSources(
          readback,
          "actual_exclusion_count"
        )
      }
    ),
    dimension(
      "R9_CANONICAL_RECOMMENDATION_INVARIANCE_REFERENCE",
      authority.canonicalRecommendationInvarianceReference === true
        ? "PASS"
        : "BLOCKED"
    ),
    dimension(
      "R10_PRODUCTION_VERSION_SCOPE_STABILITY",
      versionPass ? "PASS" : "BLOCKED",
      {
        version_group_count: readback.version_groups.length,
        version_compatible: authority.versionCompatible === true,
        scope_valid: authority.scopeValid === true
      }
    ),
    dimension(
      "R11_HOSTED_PRODUCT_FACT_STABILITY",
      authority.hostedProductFactStable === true ? "PASS" : "BLOCKED"
    ),
    dimension(
      "R12_OBSERVATION_WINDOW_EVIDENCE",
      organic.execution_count > 0 && int(readback.observed_days) > 0
        ? "EVIDENCE_PRESENT_MATURITY_UNGOVERNED"
        : "NOT_OBSERVED",
      {
        observed_days: int(readback.observed_days),
        maturity_threshold_calibrated: false
      }
    )
  ]);
}

export function evaluateV21_9NSufficiency(readback, authority = {}) {
  const validation = validateV21_9MReadback(readback);
  if (!validation.valid) {
    return Object.freeze({
      policy_version: V21_9N_POLICY_VERSION,
      decision_state: V21_9N_DECISION_STATES.BLOCKED,
      maturity_state: "INTEGRITY_BLOCKED",
      reason_codes: Object.freeze(validation.errors),
      dimensions: Object.freeze([]),
      calibration_contract: V21_9N_CALIBRATION_CONTRACT,
      primary_outcome: V21_9N_PRIMARY_OUTCOME,
      ready_for_separate_enforce_reassessment: false,
      enforce_authorized: false,
      enforce_active: false
    });
  }

  const blockers = integrityBlockers(readback, authority);
  const dimensions = mandatoryDimensions(readback, authority);
  if (blockers.length > 0) {
    return Object.freeze({
      policy_version: V21_9N_POLICY_VERSION,
      decision_state: V21_9N_DECISION_STATES.BLOCKED,
      maturity_state: "INTEGRITY_BLOCKED",
      reason_codes: Object.freeze(blockers),
      dimensions,
      calibration_contract: V21_9N_CALIBRATION_CONTRACT,
      primary_outcome: V21_9N_PRIMARY_OUTCOME,
      ready_for_separate_enforce_reassessment: false,
      enforce_authorized: false,
      enforce_active: false
    });
  }

  const organic = readback.sources.ORGANIC_PRODUCTION;
  const coverage = contextCoverage(readback);
  const missing = [];
  if (organic.execution_count === 0) missing.push("organic_traffic_absent");
  if (organic.execution_count > 0 && int(readback.observed_days) === 0) {
    missing.push("observation_window_evidence_absent");
  }
  if (organic.execution_count > 0 && actionTotal(organic) === 0) {
    missing.push("organic_action_evidence_absent");
  }
  if (
    organic.execution_count > 0 &&
    !Object.values(coverage).every(Boolean)
  ) {
    missing.push("organic_context_marginals_incomplete");
  }

  if (missing.length > 0) {
    return Object.freeze({
      policy_version: V21_9N_POLICY_VERSION,
      decision_state: V21_9N_DECISION_STATES.NOT_READY,
      maturity_state: "EVIDENCE_CATEGORY_INCOMPLETE",
      reason_codes: Object.freeze(
        [...new Set(missing)].sort((a, b) => a.localeCompare(b, "en"))
      ),
      dimensions,
      calibration_contract: V21_9N_CALIBRATION_CONTRACT,
      primary_outcome: V21_9N_PRIMARY_OUTCOME,
      ready_for_separate_enforce_reassessment: false,
      enforce_authorized: false,
      enforce_active: false
    });
  }

  return Object.freeze({
    policy_version: V21_9N_POLICY_VERSION,
    decision_state: V21_9N_DECISION_STATES.CALIBRATION_REQUIRED,
    maturity_state: "EMPIRICAL_MATURITY_NOT_ESTABLISHED",
    reason_codes: Object.freeze([
      "empirical_maturity_criteria_not_calibrated"
    ]),
    dimensions,
    calibration_contract: V21_9N_CALIBRATION_CONTRACT,
    primary_outcome: V21_9N_PRIMARY_OUTCOME,
    ready_for_separate_enforce_reassessment: false,
    enforce_authorized: false,
    enforce_active: false
  });
}

export function canonicalizeV21_9N(value) {
  if (Array.isArray(value)) return value.map(canonicalizeV21_9N);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, canonicalizeV21_9N(value[key])])
  );
}

export function serializeV21_9N(value) {
  return JSON.stringify(canonicalizeV21_9N(value));
}
