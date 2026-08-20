export const V21_9M_READBACK_SCHEMA_VERSION =
  "recommendation-shadow-evidence-readback-v1";
export const V21_9M_READINESS_EVALUATOR_VERSION =
  "enforce-reassessment-trigger-evaluator-v1";
export const V21_9M_SUFFICIENCY_GOVERNANCE_STATUS =
  "ENFORCE_REASSESSMENT_SUFFICIENCY_POLICY_REQUIRED";

export const V21_9M_TRIGGER_STATES = Object.freeze({
  NOT_READY: "NOT_READY",
  READY: "READY_FOR_SEPARATE_ENFORCE_REASSESSMENT",
  BLOCKED: "BLOCKED_INTEGRITY_FAILURE",
  POLICY_REQUIRED: "ENFORCE_REASSESSMENT_SUFFICIENCY_POLICY_REQUIRED"
});

const SOURCES = Object.freeze([
  "ORGANIC_PRODUCTION",
  "CONTROLLED_PRODUCTION_PROBE",
  "UNKNOWN_PRODUCTION_SOURCE"
]);
const ACTIONS = Object.freeze([
  "ALLOW",
  "CAUTION",
  "RESTRICT",
  "DEFER",
  "NOT_APPLICABLE"
]);
const CONTEXT_DIMENSIONS = Object.freeze([
  "PRIMARY_CONCERN_CLASS",
  "SENSITIVITY_RISK_CLASS",
  "CONCERN_STRUCTURE_CLASS",
  "SURVEY_COMPLETENESS_CLASS",
  "RECENT_INSTABILITY_CLASS"
]);
const FORBIDDEN_KEYS = new Set([
  "userid", "user", "sessionid", "session", "ip", "ipaddress", "email",
  "name", "fullname", "authtoken", "sessiontoken", "accesstoken", "refreshtoken",
  "devicefingerprint", "rawimage", "image", "rawquestionnaire", "questionnaire",
  "rawrequest", "request", "freetext", "productid", "productname"
]);

function int(value) {
  return Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hasForbiddenKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenKey);
  return Object.entries(value).some(
    ([key, nested]) => FORBIDDEN_KEYS.has(normalizeKey(key)) || hasForbiddenKey(nested)
  );
}

function sourceCounters(source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return null;
  const actions = source.actions;
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) return null;
  const normalized = {
    execution_count: int(source.execution_count),
    candidate_evaluation_count: int(source.candidate_evaluation_count),
    actions: Object.fromEntries(ACTIONS.map((action) => [action, int(actions[action])])),
    fallback_count: int(source.fallback_count),
    runtime_error_count: int(source.runtime_error_count),
    hypothetical_exclusion_count: int(source.hypothetical_exclusion_count),
    actual_exclusion_count: int(source.actual_exclusion_count),
    stop_required_count: int(source.stop_required_count)
  };
  if (
    Object.values(normalized).some((value) => value === null) ||
    Object.values(normalized.actions).some((value) => value === null)
  ) return null;
  return normalized;
}

export function validateV21_9MReadback(readback) {
  const errors = [];
  if (!readback || typeof readback !== "object" || Array.isArray(readback)) {
    return { valid: false, errors: ["readback_not_object"] };
  }
  if (hasForbiddenKey(readback)) errors.push("forbidden_privacy_field");
  if (readback.readback_schema_version !== V21_9M_READBACK_SCHEMA_VERSION) {
    errors.push("readback_schema_version_invalid");
  }
  if (readback.storage_schema_version !== "exfoliation-normative-organic-shadow-evidence-daily-v1") {
    errors.push("storage_schema_version_invalid");
  }
  if (readback.context_bucket_version !== "privacy-safe-recommendation-context-bucket-v1") {
    errors.push("context_bucket_version_invalid");
  }
  if (!readback.window || typeof readback.window !== "object") errors.push("window_invalid");
  if (!Array.isArray(readback.version_groups)) errors.push("version_groups_invalid");
  if (!Array.isArray(readback.context_marginals)) errors.push("context_marginals_invalid");
  if (!Array.isArray(readback.stop_reason_distribution)) errors.push("stop_reasons_invalid");
  if (!readback.sources || typeof readback.sources !== "object") {
    errors.push("sources_invalid");
  } else {
    for (const source of SOURCES) {
      if (!sourceCounters(readback.sources[source])) errors.push(`source_invalid:${source}`);
    }
  }
  if (int(readback.observed_days) === null) errors.push("observed_days_invalid");
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

function dimension(id, state, evidence = {}) {
  return Object.freeze({ id, state, evidence: Object.freeze({ ...evidence }) });
}

function actionTotal(source) {
  return ACTIONS.reduce((sum, action) => sum + source.actions[action], 0);
}

function organicMarginalCoverage(readback) {
  const rows = readback.context_marginals.filter(
    (row) => row?.production_source === "ORGANIC_PRODUCTION" && Number(row?.execution_count) > 0
  );
  return Object.fromEntries(
    CONTEXT_DIMENSIONS.map((key) => [key, rows.some((row) => row.partition_key === key)])
  );
}

function totalAcrossSources(sources, key) {
  return SOURCES.reduce((sum, source) => sum + sources[source][key], 0);
}

export function evaluateV21_9MReassessmentReadiness(readback, authority = {}) {
  const validation = validateV21_9MReadback(readback);
  if (!validation.valid) {
    return Object.freeze({
      evaluator_version: V21_9M_READINESS_EVALUATOR_VERSION,
      trigger_state: V21_9M_TRIGGER_STATES.BLOCKED,
      reason_codes: Object.freeze(validation.errors),
      dimensions: Object.freeze([]),
      enforce_authorized: false,
      enforce_active: false,
      sufficiency_governance: V21_9M_SUFFICIENCY_GOVERNANCE_STATUS
    });
  }

  const sources = Object.fromEntries(
    SOURCES.map((source) => [source, sourceCounters(readback.sources[source])])
  );
  const organic = sources.ORGANIC_PRODUCTION;
  const unknown = sources.UNKNOWN_PRODUCTION_SOURCE;
  const coverage = organicMarginalCoverage(readback);
  const actualExclusionTotal = totalAcrossSources(sources, "actual_exclusion_count");
  const stopRequiredTotal = totalAcrossSources(sources, "stop_required_count");
  const mixedRuntimeVersions = readback.version_groups.length > 1;
  const productionShadowActive = authority.productionShadowActive === true;
  const enforceInactive = authority.enforceInactive === true;
  const canonicalInvariant = authority.canonicalRecommendationInvarianceReference === true;
  const productionStable = authority.productionVersionScopeStable === true;
  const productFactStable = authority.hostedProductFactStable === true;

  const dimensions = Object.freeze([
    dimension("R1_ORGANIC_TRAFFIC_PRESENT", organic.execution_count > 0 ? "PASS" : "NOT_OBSERVED", {
      organic_execution_count: organic.execution_count
    }),
    dimension("R2_PROVENANCE_INTEGRITY", "PASS", {
      explicit_source_partitions: SOURCES.length
    }),
    dimension("R3_UNKNOWN_SOURCE_INTEGRITY", unknown.execution_count === 0 ? "PASS" : "NOT_READY", {
      unknown_execution_count: unknown.execution_count
    }),
    dimension("R4_ORGANIC_ACTION_EVIDENCE", actionTotal(organic) > 0 ? "PASS" : "NOT_OBSERVED", {
      organic_action_total: actionTotal(organic)
    }),
    dimension("R5_ORGANIC_CONTEXT_DIVERSITY_EVIDENCE", Object.values(coverage).every(Boolean) ? "PASS" : "NOT_OBSERVED", {
      marginal_dimensions_populated: Object.values(coverage).filter(Boolean).length,
      marginal_dimensions_required: CONTEXT_DIMENSIONS.length
    }),
    dimension("R6_FALLBACK_BEHAVIOR_EVIDENCE", organic.execution_count > 0 ? "PASS" : "NOT_OBSERVED", {
      organic_fallback_count: organic.fallback_count
    }),
    dimension("R7_RUNTIME_ERROR_BEHAVIOR_EVIDENCE", organic.execution_count > 0 ? "PASS" : "NOT_OBSERVED", {
      organic_runtime_error_count: organic.runtime_error_count
    }),
    dimension("R8_SHADOW_ACTUAL_EXCLUSION_INVARIANT", actualExclusionTotal === 0 ? "PASS" : "BLOCKED", {
      actual_exclusion_total: actualExclusionTotal
    }),
    dimension("R9_CANONICAL_RECOMMENDATION_INVARIANCE_REFERENCE", canonicalInvariant ? "PASS" : "BLOCKED", {}),
    dimension("R10_PRODUCTION_VERSION_SCOPE_STABILITY", productionStable && !mixedRuntimeVersions ? "PASS" : "BLOCKED", {
      version_group_count: readback.version_groups.length
    }),
    dimension("R11_HOSTED_PRODUCT_FACT_STABILITY", productFactStable ? "PASS" : "BLOCKED", {}),
    dimension("R12_OBSERVATION_WINDOW_EVIDENCE", organic.execution_count > 0 && readback.observed_days > 0
      ? "EVIDENCE_PRESENT_SUFFICIENCY_UNGOVERNED"
      : "NOT_OBSERVED", {
      observed_days: readback.observed_days
    })
  ]);

  const blockers = [];
  if (!productionShadowActive) blockers.push("production_shadow_not_active");
  if (!enforceInactive) blockers.push("enforce_not_inactive");
  if (actualExclusionTotal > 0) blockers.push("shadow_actual_exclusion_nonzero");
  if (stopRequiredTotal > 0) blockers.push("stop_required_observed");
  if (mixedRuntimeVersions) blockers.push("mixed_runtime_versions_in_window");
  if (!canonicalInvariant) blockers.push("canonical_recommendation_invariance_not_verified");
  if (!productionStable) blockers.push("production_version_scope_not_stable");
  if (!productFactStable) blockers.push("hosted_product_fact_not_stable");

  let triggerState;
  const reasons = [];
  if (blockers.length > 0) {
    triggerState = V21_9M_TRIGGER_STATES.BLOCKED;
    reasons.push(...blockers);
  } else if (organic.execution_count === 0) {
    triggerState = V21_9M_TRIGGER_STATES.NOT_READY;
    reasons.push("organic_traffic_absent");
  } else if (unknown.execution_count > 0) {
    triggerState = V21_9M_TRIGGER_STATES.NOT_READY;
    reasons.push("unknown_source_evidence_present");
  } else if (actionTotal(organic) === 0) {
    triggerState = V21_9M_TRIGGER_STATES.NOT_READY;
    reasons.push("organic_action_evidence_absent");
  } else if (!Object.values(coverage).every(Boolean)) {
    triggerState = V21_9M_TRIGGER_STATES.NOT_READY;
    reasons.push("organic_context_marginals_incomplete");
  } else {
    triggerState = V21_9M_TRIGGER_STATES.POLICY_REQUIRED;
    reasons.push("governed_reassessment_sufficiency_policy_not_defined");
  }

  return Object.freeze({
    evaluator_version: V21_9M_READINESS_EVALUATOR_VERSION,
    trigger_state: triggerState,
    reason_codes: Object.freeze([...new Set(reasons)].sort()),
    dimensions,
    enforce_authorized: false,
    enforce_active: false,
    sufficiency_governance: V21_9M_SUFFICIENCY_GOVERNANCE_STATUS
  });
}

export function canonicalizeV21_9M(value) {
  if (Array.isArray(value)) return value.map(canonicalizeV21_9M);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort((a, b) => a.localeCompare(b, "en"))
      .map((key) => [key, canonicalizeV21_9M(value[key])])
  );
}

export function serializeV21_9M(value) {
  return JSON.stringify(canonicalizeV21_9M(value));
}
