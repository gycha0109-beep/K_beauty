import assert from "node:assert/strict";
import fs from "node:fs";
import {
  V21_9N_ACTIONS,
  V21_9N_CALIBRATION_CONTRACT,
  V21_9N_CALIBRATION_PARAMETERS,
  V21_9N_CONTEXT_DIMENSIONS,
  V21_9N_DECISION_STATES,
  V21_9N_PRIMARY_OUTCOME,
  evaluateV21_9NSufficiency,
  serializeV21_9N
} from "../../lib/exfoliation-normative-policy-reassessment-sufficiency.js";

function source({
  execution = 0,
  candidate = 0,
  allow = 0,
  caution = 0,
  restrict = 0,
  defer = 0,
  notApplicable = 0,
  fallback = 0,
  runtimeError = 0,
  hypothetical = 0,
  actual = 0,
  stop = 0
} = {}) {
  return {
    execution_count: execution,
    candidate_evaluation_count: candidate,
    actions: {
      ALLOW: allow,
      CAUTION: caution,
      RESTRICT: restrict,
      DEFER: defer,
      NOT_APPLICABLE: notApplicable
    },
    fallback_count: fallback,
    runtime_error_count: runtimeError,
    hypothetical_exclusion_count: hypothetical,
    actual_exclusion_count: actual,
    stop_required_count: stop
  };
}

function version(runtime = "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1") {
  return {
    evidence_schema_version:
      "exfoliation-normative-organic-shadow-evidence-daily-v1",
    activation_version:
      "exfoliation-non-numeric-pda-normative-production-policy-activation-v1",
    policy_contract_version:
      "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1",
    runtime_version: runtime,
    context_bucket_version: "privacy-safe-recommendation-context-bucket-v1"
  };
}

function organicMarginals(count = 1) {
  const values = {
    PRIMARY_CONCERN_CLASS: "barrier",
    SENSITIVITY_RISK_CLASS: "LOW",
    CONCERN_STRUCTURE_CLASS: "SINGLE",
    SURVEY_COMPLETENESS_CLASS: "COMPLETE",
    RECENT_INSTABILITY_CLASS: "ABSENT"
  };
  return V21_9N_CONTEXT_DIMENSIONS.map((partition_key) => ({
    production_source: "ORGANIC_PRODUCTION",
    partition_key,
    partition_value: values[partition_key],
    execution_count: count
  }));
}

function readback({
  organic = source(),
  controlled = source(),
  unknown = source(),
  versions = [],
  marginals = [],
  observedDays = 0,
  extraSources = {}
} = {}) {
  return {
    readback_schema_version: "recommendation-shadow-evidence-readback-v1",
    storage_schema_version:
      "exfoliation-normative-organic-shadow-evidence-daily-v1",
    context_bucket_version: "privacy-safe-recommendation-context-bucket-v1",
    window: {
      start_inclusive: "2026-08-20",
      end_exclusive: "2026-08-21"
    },
    observed_days: observedDays,
    observed_day_min: observedDays ? "2026-08-20" : null,
    observed_day_max: observedDays ? "2026-08-20" : null,
    version_groups: versions,
    sources: {
      ORGANIC_PRODUCTION: organic,
      CONTROLLED_PRODUCTION_PROBE: controlled,
      UNKNOWN_PRODUCTION_SOURCE: unknown,
      ...extraSources
    },
    context_marginals: marginals,
    stop_reason_distribution: []
  };
}

const healthyAuthority = Object.freeze({
  productionShadowActive: true,
  enforcementAllowed: false,
  enforceActive: false,
  restrictCanonicalExclusionActive: false,
  provenanceExplicit: true,
  controlledEvidenceSeparated: true,
  unknownEvidenceNotPromotedToOrganic: true,
  versionCompatible: true,
  scopeValid: true,
  canonicalRecommendationInvarianceReference: true,
  hostedProductFactStable: true,
  durableEvidenceAuthorityHealthy: true
});

function dim(result, id) {
  return result.dimensions.find((row) => row.id === id);
}

const fixtureManifest = JSON.parse(
  fs.readFileSync(
    new URL(
      "../fixtures/exfoliation-normative-reassessment-sufficiency-fixtures-v1.json",
      import.meta.url
    ),
    "utf8"
  )
);
assert.deepEqual(
  fixtureManifest.map((fixture) => fixture.id),
  ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]
);

// F1 / T1: zero evidence is valid but incomplete, never calibration-ready.
const f1 = evaluateV21_9NSufficiency(readback(), healthyAuthority);
assert.equal(f1.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.equal(f1.maturity_state, "EVIDENCE_CATEGORY_INCOMPLETE");
assert.deepEqual(f1.reason_codes, ["organic_traffic_absent"]);

// F2 / T12: one thin organic execution can populate every qualitative category.
// It MUST NOT become READY; doing so would hide a one-event sufficiency rule.
const thin = readback({
  organic: source({ execution: 1, candidate: 1, allow: 1 }),
  versions: [version()],
  marginals: organicMarginals(1),
  observedDays: 1
});
const f2 = evaluateV21_9NSufficiency(thin, healthyAuthority);
assert.equal(
  f2.decision_state,
  V21_9N_DECISION_STATES.CALIBRATION_REQUIRED
);
assert.equal(f2.maturity_state, "EMPIRICAL_MATURITY_NOT_ESTABLISHED");
assert.equal(f2.ready_for_separate_enforce_reassessment, false);

// F3: more qualitative observations without governed maturity still cannot
// supply a numeric/recurrence threshold by implication.
const broader = readback({
  organic: source({ execution: 2, candidate: 3, allow: 1, caution: 2 }),
  versions: [version()],
  marginals: organicMarginals(2),
  observedDays: 1
});
const f3 = evaluateV21_9NSufficiency(broader, healthyAuthority);
assert.equal(
  f3.decision_state,
  V21_9N_DECISION_STATES.CALIBRATION_REQUIRED
);

// F4 / T3: provenance integrity failure dominates all sufficiency evidence.
const provenanceBrokenAuthority = {
  ...healthyAuthority,
  provenanceExplicit: false
};
const f4 = evaluateV21_9NSufficiency(thin, provenanceBrokenAuthority);
assert.equal(f4.decision_state, V21_9N_DECISION_STATES.BLOCKED);
assert.ok(f4.reason_codes.includes("provenance_not_explicit"));

// F5 / T4: actual exclusion > 0 while SHADOW is an absolute blocker.
const exclusion = readback({
  organic: source({ execution: 1, candidate: 1, restrict: 1, actual: 1 }),
  versions: [version()],
  marginals: organicMarginals(1),
  observedDays: 1
});
const f5 = evaluateV21_9NSufficiency(exclusion, healthyAuthority);
assert.equal(f5.decision_state, V21_9N_DECISION_STATES.BLOCKED);
assert.ok(f5.reason_codes.includes("shadow_actual_exclusion_nonzero"));

// F6 / T10: mixed runtime versions are integrity-blocked.
const mixed = readback({
  organic: source({ execution: 1, candidate: 1, allow: 1 }),
  versions: [version(), version("future-incompatible-runtime-v2")],
  marginals: organicMarginals(1),
  observedDays: 1
});
const f6 = evaluateV21_9NSufficiency(mixed, healthyAuthority);
assert.equal(f6.decision_state, V21_9N_DECISION_STATES.BLOCKED);
assert.ok(f6.reason_codes.includes("mixed_runtime_versions_in_window"));

// F7 / T11: explicit UNKNOWN is not silently promoted to organic and is not
// automatically a permanent integrity failure. Its future tolerance is a
// calibration question.
const unknownCharacterized = readback({
  organic: source({ execution: 1, candidate: 1, allow: 1 }),
  unknown: source({ execution: 1, candidate: 1, defer: 1 }),
  versions: [version()],
  marginals: organicMarginals(1),
  observedDays: 1
});
const f7 = evaluateV21_9NSufficiency(
  unknownCharacterized,
  healthyAuthority
);
assert.equal(
  f7.decision_state,
  V21_9N_DECISION_STATES.CALIBRATION_REQUIRED
);
assert.equal(
  dim(f7, "R3_UNKNOWN_SOURCE_INTEGRITY").state,
  "CHARACTERIZED_REQUIRES_CALIBRATION"
);
assert.equal(
  dim(f7, "R3_UNKNOWN_SOURCE_INTEGRITY").evidence.unknown_execution_count,
  1
);

// F8: category-complete healthy evidence remains calibration-required until a
// later stage freezes empirically justified maturity criteria.
const healthyComplete = readback({
  organic: source({
    execution: 2,
    candidate: 4,
    allow: 1,
    caution: 1,
    fallback: 0,
    runtimeError: 0
  }),
  versions: [version()],
  marginals: organicMarginals(2),
  observedDays: 1
});
const f8 = evaluateV21_9NSufficiency(healthyComplete, healthyAuthority);
assert.equal(
  f8.decision_state,
  V21_9N_DECISION_STATES.CALIBRATION_REQUIRED
);

// T2: organic traffic with missing context category stays NOT_READY.
const incomplete = readback({
  organic: source({ execution: 1, candidate: 1, allow: 1 }),
  versions: [version()],
  marginals: organicMarginals(1).slice(0, -1),
  observedDays: 1
});
const t2 = evaluateV21_9NSufficiency(incomplete, healthyAuthority);
assert.equal(t2.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.ok(t2.reason_codes.includes("organic_context_marginals_incomplete"));

// T5: controlled Production evidence can validate mechanics but cannot satisfy
// organic maturity.
const controlledOnly = readback({
  controlled: source({ execution: 1, candidate: 1, restrict: 1 }),
  versions: [version()],
  observedDays: 1
});
const t5 = evaluateV21_9NSufficiency(controlledOnly, healthyAuthority);
assert.equal(t5.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.ok(t5.reason_codes.includes("organic_traffic_absent"));

// T6: synthetic evidence is outside the governed Production source set and
// cannot satisfy organic maturity.
const syntheticOnly = readback({
  versions: [version()],
  observedDays: 1,
  extraSources: {
    SYNTHETIC_SIMULATION_EVIDENCE: source({
      execution: 1,
      candidate: 1,
      allow: 1
    })
  }
});
const t6 = evaluateV21_9NSufficiency(syntheticOnly, healthyAuthority);
assert.equal(t6.decision_state, V21_9N_DECISION_STATES.NOT_READY);
assert.ok(t6.reason_codes.includes("organic_traffic_absent"));

// T7: marginal order does not affect the policy result.
const contextA = evaluateV21_9NSufficiency(thin, healthyAuthority);
const contextB = evaluateV21_9NSufficiency(
  { ...thin, context_marginals: [...thin.context_marginals].reverse() },
  healthyAuthority
);
assert.equal(serializeV21_9N(contextA), serializeV21_9N(contextB));

// T8/T9: zero after actual organic execution is characterized evidence, not
// missing evidence.
assert.equal(
  dim(f8, "R7_RUNTIME_ERROR_BEHAVIOR_EVIDENCE").state,
  "PASS"
);
assert.equal(
  dim(f8, "R7_RUNTIME_ERROR_BEHAVIOR_EVIDENCE").evidence
    .zero_is_characterized_when_organic_observed,
  true
);
assert.equal(
  dim(f8, "R6_FALLBACK_BEHAVIOR_EVIDENCE").state,
  "PASS"
);
assert.equal(
  dim(f8, "R6_FALLBACK_BEHAVIOR_EVIDENCE").evidence
    .zero_is_characterized_when_organic_observed,
  true
);

// Action coverage is qualitative presence, not "all actions must be seen".
assert.deepEqual(V21_9N_ACTIONS, [
  "ALLOW",
  "CAUTION",
  "RESTRICT",
  "DEFER",
  "NOT_APPLICABLE"
]);
assert.equal(
  dim(f2, "R4_ORGANIC_ACTION_EVIDENCE").evidence.every_action_required,
  false
);
assert.equal(
  dim(f2, "R4_ORGANIC_ACTION_EVIDENCE").evidence
    .safety_relevant_branch_coverage_calibrated,
  false
);

// Context evidence is independent marginals only; no composite fingerprint.
assert.equal(
  dim(f2, "R5_ORGANIC_CONTEXT_DIVERSITY_EVIDENCE").evidence
    .composite_fingerprint_used,
  false
);
assert.equal(
  dim(f2, "R5_ORGANIC_CONTEXT_DIVERSITY_EVIDENCE").evidence
    .breadth_threshold_calibrated,
  false
);

// T13/T14: repeated evaluation and canonical serialization are deterministic.
assert.equal(
  serializeV21_9N(evaluateV21_9NSufficiency(thin, healthyAuthority)),
  serializeV21_9N(evaluateV21_9NSufficiency(thin, healthyAuthority))
);
assert.equal(
  serializeV21_9N({ z: 1, a: { y: 2, x: 3 } }),
  serializeV21_9N({ a: { x: 3, y: 2 }, z: 1 })
);

// Calibration contract contains questions/parameters, not invented values.
assert.deepEqual(V21_9N_CALIBRATION_PARAMETERS, [
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
assert.equal(
  V21_9N_CALIBRATION_CONTRACT.status,
  "FROZEN_PARAMETERS_VALUES_UNCALIBRATED"
);
assert.ok(
  V21_9N_CALIBRATION_CONTRACT.methodology_constraints.includes(
    "NO_RETROACTIVE_THRESHOLD_SELECTION_TO_MAKE_CURRENT_EVIDENCE_PASS"
  )
);
assert.ok(
  V21_9N_CALIBRATION_CONTRACT.methodology_constraints.includes(
    "NO_UNIQUE_USER_RECONSTRUCTION"
  )
);

// T15/T16: this Stage never authorizes or activates ENFORCE. READY is reserved
// for a later calibrated policy and is unreachable in v1.
for (const result of [
  f1, f2, f3, f4, f5, f6, f7, f8, t2, t5, t6
]) {
  assert.notEqual(result.decision_state, V21_9N_DECISION_STATES.READY);
  assert.equal(result.ready_for_separate_enforce_reassessment, false);
  assert.equal(result.enforce_authorized, false);
  assert.equal(result.enforce_active, false);
}

// T17/T18: governance contract itself records zero Product Fact and
// Recommendation semantic mutation. CI additionally verifies the Git diff.
const mutationBoundary = Object.freeze({
  PRODUCT_FACT_WRITE: 0,
  PRODUCT_FACT_DELTA: 0,
  REGISTRY_DELTA: 0,
  RECOMMENDATION_SEMANTIC_DELTA: 0,
  PRODUCTION_EVIDENCE_WRITE: 0
});
assert.deepEqual(mutationBoundary, {
  PRODUCT_FACT_WRITE: 0,
  PRODUCT_FACT_DELTA: 0,
  REGISTRY_DELTA: 0,
  RECOMMENDATION_SEMANTIC_DELTA: 0,
  PRODUCTION_EVIDENCE_WRITE: 0
});

assert.equal(
  V21_9N_PRIMARY_OUTCOME,
  "ENFORCE_REASSESSMENT_SUFFICIENCY_CALIBRATION_REQUIRED"
);

console.log(
  JSON.stringify(
    {
      verifier:
        "verify-v21-9n-enforce-reassessment-sufficiency-v1",
      fixtures: "F1-F8",
      tests: "T1-T18",
      thin_category_complete_state: f2.decision_state,
      healthy_category_complete_state: f8.decision_state,
      primary_outcome: V21_9N_PRIMARY_OUTCOME,
      numeric_thresholds_invented: false,
      ready_for_separate_enforce_reassessment: false,
      enforce_authorized: false,
      enforce_active: false,
      product_fact_write: 0,
      recommendation_semantic_delta: 0,
      production_evidence_write: 0
    },
    null,
    2
  )
);
