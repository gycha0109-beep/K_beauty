#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildSharedSkinDecisionContext } from "../../lib/shared-skin-decision-context-v4.js";
import { buildRoutinePolicy } from "../../lib/routine-policy.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_VERSION,
  buildExfoliationNormativePolicySkinMatchContext
} from "../../lib/exfoliation-normative-policy-skin-match-context.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION,
  observeExfoliationNormativePolicyProductionShadow
} from "../../lib/exfoliation-normative-policy-production-shadow-observer.js";
import {
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_BOUNDARY,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION
} from "../../lib/exfoliation-normative-policy-activation-runtime.js";

const FIXTURE_PATH = path.resolve(
  "evidence/product-decision-axis-non-numeric-shadow-v1/v21-9i-remediated-synthetic-contexts-v1.json"
);
const REFERENCE_ROOT = path.resolve(
  process.env.V21_9I_REFERENCE_ROOT || "_reference/recommendation"
);
const PRODUCT_FIXTURE_PATH = path.join(
  REFERENCE_ROOT,
  "fixtures/recommendation-metadata/products-v1.json"
);

const BLOCKER_CONTEXTS = new Set([
  "CTX-005", "CTX-006", "CTX-007", "CTX-008", "CTX-011",
  "CTX-022", "CTX-024", "CTX-026", "CTX-027"
]);

function activeSelection(id) {
  return {
    status: "selected",
    productId: id,
    category: "treatment",
    productSnapshot: {
      id,
      category: "treatment",
      irritation_risk: "low",
      sensitivity_safe: true,
      ingredient_signals: { functional: [{ label: "whitening", count: 1 }] }
    }
  };
}

function currentProductsForMode(mode) {
  if (mode === "active_single") {
    return { selections: [activeSelection("v21-9i-active-current-product-1")] };
  }
  if (mode === "active_double") {
    return {
      selections: [
        activeSelection("v21-9i-active-current-product-1"),
        activeSelection("v21-9i-active-current-product-2")
      ]
    };
  }
  if (mode === "unknown_selected") {
    return {
      selections: [{
        status: "selected",
        productId: "v21-9i-unknown-current-product",
        category: "treatment"
      }]
    };
  }
  return null;
}

function reportForContext(context) {
  const input = context.input || {};
  return {
    freeResult: {
      answers: input.answers || {},
      priority: { axis: input.priority_axis || null },
      scoring: { concernScores: input.score_card || {} }
    },
    currentProducts: currentProductsForMode(input.current_products_mode)
  };
}

function expectationMismatches(context, builtContext) {
  const expected = context.expected_relevant_dimensions || {};
  const safety = builtContext?.safetyState || {};
  const exposure = builtContext?.productExposureState || {};
  const mismatches = [];
  const compare = (key, actual, expectedValue) => {
    if (Object.prototype.hasOwnProperty.call(expected, key) && actual !== expectedValue) {
      mismatches.push({ key, expected: expectedValue, actual });
    }
  };

  compare("sensitive_burden", safety.sensitiveBurden, expected.sensitive_burden);
  compare("safety_level", safety.level, expected.safety_level);
  compare("active_exposure_present", exposure.activeExposurePresent, expected.active_exposure_present);
  compare("unknown_exposure_present", exposure.unknownExposurePresent, expected.unknown_exposure_present);

  if (expected.high_sensitive_axes_contains &&
      !safety.highSensitiveAxes?.includes(expected.high_sensitive_axes_contains)) {
    mismatches.push({
      key: "high_sensitive_axes_contains",
      expected: expected.high_sensitive_axes_contains,
      actual: safety.highSensitiveAxes || []
    });
  }
  if (expected.high_sensitive_axes_excludes &&
      safety.highSensitiveAxes?.includes(expected.high_sensitive_axes_excludes)) {
    mismatches.push({
      key: "high_sensitive_axes_excludes",
      expected: expected.high_sensitive_axes_excludes,
      actual: safety.highSensitiveAxes || []
    });
  }
  return mismatches;
}

function boundaryReport(value) {
  return {
    freeResult: {
      answers: {
        skinType: "oily",
        sensitivity: "low",
        mainConcern: "pores",
        mainConcerns: ["pores"],
        recentSkinChange: "no",
        recentlyChangedProduct: "no"
      },
      priority: { axis: "pores" },
      scoring: {
        concernScores: {
          barrier: value,
          redness: 2,
          acne: 3,
          dehydration: 4,
          oiliness: 12,
          pores: 80,
          uneven_tone: 3,
          uv: 4
        }
      }
    },
    currentProducts: null
  };
}

function addActionCounts(target, source) {
  for (const action of ["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"]) {
    target[action] += Number(source?.[action] || 0);
  }
}

const [fixtureText, productsText] = await Promise.all([
  readFile(FIXTURE_PATH, "utf8"),
  readFile(PRODUCT_FIXTURE_PATH, "utf8")
]);
const fixture = JSON.parse(fixtureText);
const productFixture = JSON.parse(productsText);

assert.equal(fixture.fixture_lineage, "REMEDIATED_FIXTURE_VERSION");
assert.equal(fixture.original_worker_fixture_recovered, false);
assert.equal(fixture.context_count, 28);
assert.equal(fixture.contexts.length, 28);
assert.equal(productFixture.productCount, 164);
assert.equal(productFixture.products.length, 164);

// Raw skin-match source boundary: unrelated high axes must not change 17/18/19 meaning.
const boundary17 = buildExfoliationNormativePolicySkinMatchContext(boundaryReport(17));
const boundary18 = buildExfoliationNormativePolicySkinMatchContext(boundaryReport(18));
const boundary19 = buildExfoliationNormativePolicySkinMatchContext(boundaryReport(19));
assert.equal(boundary17.safetyState.sensitiveBurden, false);
assert.equal(boundary17.safetyState.highSensitiveAxes.includes("barrier"), false);
assert.equal(boundary18.safetyState.sensitiveBurden, true);
assert.equal(boundary18.safetyState.highSensitiveAxes.includes("barrier"), true);
assert.equal(boundary19.safetyState.sensitiveBurden, true);
assert.equal(boundary19.safetyState.highSensitiveAxes.includes("barrier"), true);
assert.equal(boundary18.metadata.concernScoreScale, "skin_match_raw");
assert.equal(boundary18.metadata.concernScoreHighThreshold, 18);
assert.equal(
  boundary18.metadata.contextAdapterVersion,
  EXFOLIATION_NORMATIVE_POLICY_SKIN_MATCH_CONTEXT_VERSION
);

// The domain boundary must delegate safety semantics to the shared implementation, not fork them.
const directRawBoundary18 = buildSharedSkinDecisionContext(boundaryReport(18), {
  source: "v21_9i_source_scale_no_fork_assertion",
  concernScoreScale: "skin_match_raw"
}).context;
assert.deepEqual(boundary18.safetyState, directRawBoundary18.safetyState);
assert.deepEqual(boundary18.productExposureState, directRawBoundary18.productExposureState);

// Generic shared/premium compatibility must remain unchanged: default dynamic scale still exists.
const genericBoundary18 = buildSharedSkinDecisionContext(boundaryReport(18)).context;
assert.equal(genericBoundary18.safetyState.sensitiveBurden, false);
const scale100Routine = buildRoutinePolicy({
  sharedContext: {
    skinState: {
      priorityAxis: "barrier",
      concernScores: { barrier: 82, redness: 74, dehydration: 70, oiliness: 30 }
    },
    survey: { completeness: "available", answers: {} },
    productExposureState: { rows: [], unknownProductCount: 0, duplicateActiveAxes: [] },
    safetyState: {
      level: "caution",
      sensitiveBurden: true,
      reasonCodes: ["high_sensitive_axis"],
      protectionMustMaintain: true
    },
    evidenceLedger: []
  }
});
assert.equal(scale100Routine.weeklySchedule.activeDaysMax, 1);

const semanticMismatches = [];
const blockerResults = [];
for (const context of fixture.contexts) {
  const built = buildExfoliationNormativePolicySkinMatchContext(reportForContext(context));
  const directRaw = buildSharedSkinDecisionContext(reportForContext(context), {
    source: "v21_9i_source_scale_no_fork_assertion",
    concernScoreScale: "skin_match_raw"
  }).context;
  assert.deepEqual(built.safetyState, directRaw.safetyState);
  const mismatches = expectationMismatches(context, built);
  if (mismatches.length) {
    semanticMismatches.push({ context_id: context.context_id, mismatches });
  }
  if (BLOCKER_CONTEXTS.has(context.context_id)) {
    blockerResults.push({
      context_id: context.context_id,
      safety_level: built.safetyState.level,
      sensitive_burden: built.safetyState.sensitiveBurden,
      high_sensitive_axes: built.safetyState.highSensitiveAxes,
      pass: mismatches.length === 0
    });
  }
}
assert.equal(blockerResults.length, 9);
assert.ok(blockerResults.every((row) => row.pass));
assert.equal(semanticMismatches.length, 0);

const candidates = [...productFixture.products].sort((left, right) =>
  String(left?.id || "").localeCompare(String(right?.id || ""), "en")
);
const envLike = {
  EXFOLIATION_NORMATIVE_POLICY_ENABLED: "1",
  EXFOLIATION_NORMATIVE_POLICY_KILL_SWITCH: "0",
  EXFOLIATION_NORMATIVE_POLICY_MODE: "SHADOW",
  EXFOLIATION_NORMATIVE_POLICY_ACTIVATION_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_CONTRACT_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_RUNTIME_VERSION,
  EXFOLIATION_NORMATIVE_POLICY_SCOPE: EXFOLIATION_NORMATIVE_POLICY_BOUNDARY
};
const actionCounts = { ALLOW: 0, CAUTION: 0, RESTRICT: 0, DEFER: 0, NOT_APPLICABLE: 0 };
let replayCaseCount = 0;
let runtimeExecutionCount = 0;
let fallbackCount = 0;
let actualNormativeExclusionCount = 0;
const stopReasons = new Set();

for (const context of fixture.contexts) {
  const input = context.input || {};
  const result = await observeExfoliationNormativePolicyProductionShadow({
    input: input.answers || {},
    candidates,
    priorityAxis: input.priority_axis || null,
    scoreCard: input.score_card || {},
    currentProductsReport: currentProductsForMode(input.current_products_mode),
    envLike,
    telemetrySink: () => {}
  });
  assert.equal(result.observerVersion, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION);
  assert.equal(result.effectiveMode, "SHADOW");
  assert.equal(result.runtimeActive, true);
  assert.equal(result.canonicalMutationApplied, false);
  assert.equal(result.legacyPathPreserved, true);
  assert.equal(result.restrictCanonicalExclusionCount, 0);
  assert.equal(result.telemetry.candidateCountBefore, 164);
  assert.equal(result.telemetry.candidateCountAfter, 164);
  addActionCounts(actionCounts, result.telemetry.actionCounts);
  replayCaseCount += result.telemetry.candidateCountBefore;
  runtimeExecutionCount += result.telemetry.runtimeExecutionCount;
  fallbackCount += result.telemetry.fallbackCount;
  actualNormativeExclusionCount += result.telemetry.actualNormativeExclusionCount;
  for (const reason of result.telemetry.stopReasons || []) stopReasons.add(reason);
}

assert.equal(replayCaseCount, 28 * 164);
assert.equal(runtimeExecutionCount, 28 * 164);
assert.equal(Object.values(actionCounts).reduce((sum, value) => sum + value, 0), 28 * 164);
assert.equal(fallbackCount, 0);
assert.equal(actualNormativeExclusionCount, 0);
assert.deepEqual([...stopReasons], []);

console.log(JSON.stringify({
  stage: "V2.1-9I-SR",
  semantic_outcome: "RAW_SKIN_MATCH_SCALE_IS_AUTHORITATIVE",
  architecture: "SOURCE_AWARE_SHARED_CONTEXT_WITH_DOMAIN_SCOPED_BOUNDARY",
  fixture_lineage: fixture.fixture_lineage,
  product_count: 164,
  context_count: 28,
  replay_case_count: replayCaseCount,
  runtime_execution_count: runtimeExecutionCount,
  action_counts: actionCounts,
  fallback_count: fallbackCount,
  actual_normative_exclusion_count: actualNormativeExclusionCount,
  semantic_mismatch_count: semanticMismatches.length,
  blocker_contexts_passed: blockerResults.length,
  boundary_17_18_19: "PASS",
  source_scale_no_semantic_fork: "PASS",
  generic_dynamic_scale_regression: "PASS",
  generic_scale100_routine_regression: "PASS",
  enforce_requested: false,
  status: "PASS"
}, null, 2));
