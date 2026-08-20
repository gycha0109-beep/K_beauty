import fs from "node:fs";
import assert from "node:assert/strict";
import {
  V21_9M_READBACK_SCHEMA_VERSION,
  V21_9M_SUFFICIENCY_GOVERNANCE_STATUS,
  V21_9M_TRIGGER_STATES,
  evaluateV21_9MReassessmentReadiness,
  serializeV21_9M,
  validateV21_9MReadback
} from "../../lib/exfoliation-normative-policy-durable-evidence-readback.js";

const ACTIONS = ["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"];
const CONTEXT_DIMENSIONS = [
  ["PRIMARY_CONCERN_CLASS", "barrier"],
  ["SENSITIVITY_RISK_CLASS", "LOW"],
  ["CONCERN_STRUCTURE_CLASS", "SINGLE"],
  ["SURVEY_COMPLETENESS_CLASS", "COMPLETE"],
  ["RECENT_INSTABILITY_CLASS", "ABSENT"]
];

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

function readback({ organic = source(), controlled = source(), unknown = source(), versions = [], marginals = [], stops = [], observedDays = 0 } = {}) {
  return {
    readback_schema_version: V21_9M_READBACK_SCHEMA_VERSION,
    storage_schema_version: "exfoliation-normative-organic-shadow-evidence-daily-v1",
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
      UNKNOWN_PRODUCTION_SOURCE: unknown
    },
    context_marginals: marginals,
    stop_reason_distribution: stops
  };
}

const authority = Object.freeze({
  productionShadowActive: true,
  enforceInactive: true,
  canonicalRecommendationInvarianceReference: true,
  productionVersionScopeStable: true,
  hostedProductFactStable: true
});

function version(runtime = "exfoliation-non-numeric-pda-normative-production-policy-shadow-v1") {
  return {
    evidence_schema_version: "exfoliation-normative-organic-shadow-evidence-daily-v1",
    activation_version: "exfoliation-non-numeric-pda-normative-production-policy-activation-v1",
    policy_contract_version: "exfoliation-non-numeric-pda-normative-production-policy-decision-contract-v1",
    runtime_version: runtime,
    context_bucket_version: "privacy-safe-recommendation-context-bucket-v1"
  };
}

function fullOrganicMarginals(count = 1) {
  return CONTEXT_DIMENSIONS.map(([partition_key, partition_value]) => ({
    production_source: "ORGANIC_PRODUCTION",
    partition_key,
    partition_value,
    execution_count: count
  }));
}

function getDimension(result, id) {
  return result.dimensions.find((row) => row.id === id);
}

// T1 zero evidence -> NOT_READY.
const zero = readback();
assert.equal(validateV21_9MReadback(zero).valid, true);
const zeroResult = evaluateV21_9MReassessmentReadiness(zero, authority);
assert.equal(zeroResult.trigger_state, V21_9M_TRIGGER_STATES.NOT_READY);
assert.deepEqual(zeroResult.reason_codes, ["organic_traffic_absent"]);
assert.equal(getDimension(zeroResult, "R1_ORGANIC_TRAFFIC_PRESENT").state, "NOT_OBSERVED");

// T2/T3/T4 explicit provenance partitions are direct; controlled and unknown never become organic.
const partitioned = readback({
  organic: source({ execution: 2, candidate: 3, allow: 2, caution: 1 }),
  controlled: source({ execution: 7, candidate: 9, restrict: 9 }),
  unknown: source({ execution: 4, candidate: 4, defer: 4 }),
  versions: [version()],
  marginals: fullOrganicMarginals(2),
  observedDays: 1
});
const partitionedResult = evaluateV21_9MReassessmentReadiness(partitioned, authority);
assert.equal(getDimension(partitionedResult, "R1_ORGANIC_TRAFFIC_PRESENT").evidence.organic_execution_count, 2);
assert.equal(getDimension(partitionedResult, "R4_ORGANIC_ACTION_EVIDENCE").evidence.organic_action_total, 3);
assert.equal(partitionedResult.trigger_state, V21_9M_TRIGGER_STATES.NOT_READY);
assert.ok(partitionedResult.reason_codes.includes("unknown_source_evidence_present"));

// T5 all action counters remain deterministic and separately addressable.
assert.deepEqual(Object.keys(partitioned.sources.ORGANIC_PRODUCTION.actions), ACTIONS);
assert.equal(partitioned.sources.ORGANIC_PRODUCTION.actions.RESTRICT, 0);
assert.equal(partitioned.sources.CONTROLLED_PRODUCTION_PROBE.actions.RESTRICT, 9);

// T6/T7 context marginals are independent; no joined/composite fingerprint dimension is allowed.
assert.equal(fullOrganicMarginals().length, CONTEXT_DIMENSIONS.length);
for (const row of fullOrganicMarginals()) {
  assert.ok(CONTEXT_DIMENSIONS.some(([key]) => key === row.partition_key));
  assert.equal(row.partition_key.includes("+"), false);
  assert.equal(row.partition_key.includes("COMPOSITE"), false);
}

// T8 privacy leak fails closed.
const leaked = structuredClone(zero);
leaked.user_id = "forbidden";
const leakValidation = validateV21_9MReadback(leaked);
assert.equal(leakValidation.valid, false);
assert.ok(leakValidation.errors.includes("forbidden_privacy_field"));
assert.equal(
  evaluateV21_9MReassessmentReadiness(leaked, authority).trigger_state,
  V21_9M_TRIGGER_STATES.BLOCKED
);

// T9 fallback/error/stop facts remain raw facts; a stop is integrity-blocking.
const stopFixture = readback({
  organic: source({ execution: 1, candidate: 1, allow: 1, fallback: 1, runtimeError: 1, stop: 1 }),
  versions: [version()],
  marginals: fullOrganicMarginals(1),
  stops: [{ production_source: "ORGANIC_PRODUCTION", stop_reason: "evaluator_error", stop_required_count: 1 }],
  observedDays: 1
});
const stopResult = evaluateV21_9MReassessmentReadiness(stopFixture, authority);
assert.equal(stopResult.trigger_state, V21_9M_TRIGGER_STATES.BLOCKED);
assert.ok(stopResult.reason_codes.includes("stop_required_observed"));
assert.equal(getDimension(stopResult, "R6_FALLBACK_BEHAVIOR_EVIDENCE").evidence.organic_fallback_count, 1);
assert.equal(getDimension(stopResult, "R7_RUNTIME_ERROR_BEHAVIOR_EVIDENCE").evidence.organic_runtime_error_count, 1);

// T10 actual exclusion > 0 in SHADOW is a hard integrity failure.
const exclusionFixture = readback({
  organic: source({ execution: 1, candidate: 1, restrict: 1, actual: 1 }),
  versions: [version()],
  marginals: fullOrganicMarginals(1),
  observedDays: 1
});
const exclusionResult = evaluateV21_9MReassessmentReadiness(exclusionFixture, authority);
assert.equal(exclusionResult.trigger_state, V21_9M_TRIGGER_STATES.BLOCKED);
assert.ok(exclusionResult.reason_codes.includes("shadow_actual_exclusion_nonzero"));
assert.equal(getDimension(exclusionResult, "R8_SHADOW_ACTUAL_EXCLUSION_INVARIANT").state, "BLOCKED");

// T11 mixed runtime contract versions are explicit and fail closed for readiness.
const mixed = readback({
  organic: source({ execution: 1, candidate: 1, allow: 1 }),
  versions: [version(), version("future-incompatible-runtime-v2")],
  marginals: fullOrganicMarginals(1),
  observedDays: 1
});
const mixedResult = evaluateV21_9MReassessmentReadiness(mixed, authority);
assert.equal(mixedResult.trigger_state, V21_9M_TRIGGER_STATES.BLOCKED);
assert.ok(mixedResult.reason_codes.includes("mixed_runtime_versions_in_window"));

// T12 evidence window is explicit [start,end), bounded to durable collection start.
const migration = fs.readFileSync(
  new URL("../../supabase/migrations/20260820094500_v21_9m_shadow_evidence_readback_v1.sql", import.meta.url),
  "utf8"
);
assert.ok(migration.includes("p_window_start date"));
assert.ok(migration.includes("p_window_end_exclusive date"));
assert.ok(migration.includes("bucket_date >= p_window_start"));
assert.ok(migration.includes("bucket_date < p_window_end_exclusive"));
assert.ok(migration.includes("V21_9M_WINDOW_BEFORE_DURABLE_COLLECTION_START"));
assert.ok(!migration.toLowerCase().includes(" user_id"));
assert.ok(!migration.toLowerCase().includes(" session_id"));
assert.ok(!migration.toLowerCase().includes(" product_id"));

// T13 canonical serialization is byte-stable independent of input object key order.
const canonicalA = serializeV21_9M({ z: 1, a: { y: 2, x: 3 } });
const canonicalB = serializeV21_9M({ a: { x: 3, y: 2 }, z: 1 });
assert.equal(canonicalA, canonicalB);

// Governance fixture: category-complete evidence is still not READY without a governed sufficiency policy.
const categoryComplete = readback({
  organic: source({ execution: 1, candidate: 2, allow: 1, caution: 1 }),
  controlled: source(),
  unknown: source(),
  versions: [version()],
  marginals: fullOrganicMarginals(1),
  observedDays: 1
});
const categoryCompleteResult = evaluateV21_9MReassessmentReadiness(categoryComplete, authority);
assert.equal(categoryCompleteResult.trigger_state, V21_9M_TRIGGER_STATES.POLICY_REQUIRED);
assert.deepEqual(categoryCompleteResult.reason_codes, ["governed_reassessment_sufficiency_policy_not_defined"]);
assert.equal(categoryCompleteResult.sufficiency_governance, V21_9M_SUFFICIENCY_GOVERNANCE_STATUS);
assert.notEqual(categoryCompleteResult.trigger_state, V21_9M_TRIGGER_STATES.READY);

// T18 ENFORCE can never be authorized or activated by this evaluator.
for (const result of [zeroResult, partitionedResult, stopResult, exclusionResult, mixedResult, categoryCompleteResult]) {
  assert.equal(result.enforce_authorized, false);
  assert.equal(result.enforce_active, false);
}

console.log(JSON.stringify({
  verifier: "verify-v21-9m-durable-evidence-readback-v1",
  tests: "T1-T13,T18 + governance-policy fixture",
  zero_evidence_trigger: zeroResult.trigger_state,
  category_complete_trigger: categoryCompleteResult.trigger_state,
  primary_governance_outcome: V21_9M_SUFFICIENCY_GOVERNANCE_STATUS,
  enforce_authorized: false,
  enforce_active: false
}, null, 2));
