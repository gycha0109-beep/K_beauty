#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { buildSharedSkinDecisionContext } from "../../lib/shared-skin-decision-context-v4.js";
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
const EXPECTED_BASE_MAIN_SHA =
  process.env.V21_9I_BASE_MAIN_SHA || "7a8e964a833e08047b3fda02ebef40b6f19e5979";

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
      ingredient_signals: {
        functional: [{ label: "whitening", count: 1 }]
      }
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
      selections: [
        {
          status: "selected",
          productId: "v21-9i-unknown-current-product",
          category: "treatment"
        }
      ]
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

function contextExpectationMismatches(context, builtContext) {
  const expected = context.expected_relevant_dimensions || {};
  const mismatches = [];
  const safety = builtContext?.safetyState || {};
  const exposure = builtContext?.productExposureState || {};

  if (Object.prototype.hasOwnProperty.call(expected, "sensitive_burden")) {
    if (safety.sensitiveBurden !== expected.sensitive_burden) {
      mismatches.push({
        field: "safetyState.sensitiveBurden",
        expected: expected.sensitive_burden,
        actual: safety.sensitiveBurden
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(expected, "safety_level")) {
    if (safety.level !== expected.safety_level) {
      mismatches.push({
        field: "safetyState.level",
        expected: expected.safety_level,
        actual: safety.level
      });
    }
  }
  if (expected.high_sensitive_axes_contains) {
    if (!Array.isArray(safety.highSensitiveAxes) || !safety.highSensitiveAxes.includes(expected.high_sensitive_axes_contains)) {
      mismatches.push({
        field: "safetyState.highSensitiveAxes",
        expected_contains: expected.high_sensitive_axes_contains,
        actual: safety.highSensitiveAxes || []
      });
    }
  }
  if (expected.high_sensitive_axes_excludes) {
    if (Array.isArray(safety.highSensitiveAxes) && safety.highSensitiveAxes.includes(expected.high_sensitive_axes_excludes)) {
      mismatches.push({
        field: "safetyState.highSensitiveAxes",
        expected_excludes: expected.high_sensitive_axes_excludes,
        actual: safety.highSensitiveAxes
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(expected, "active_exposure_present")) {
    if (exposure.activeExposurePresent !== expected.active_exposure_present) {
      mismatches.push({
        field: "productExposureState.activeExposurePresent",
        expected: expected.active_exposure_present,
        actual: exposure.activeExposurePresent
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(expected, "unknown_exposure_present")) {
    if (exposure.unknownExposurePresent !== expected.unknown_exposure_present) {
      mismatches.push({
        field: "productExposureState.unknownExposurePresent",
        expected: expected.unknown_exposure_present,
        actual: exposure.unknownExposurePresent
      });
    }
  }
  return mismatches;
}

function addActionCounts(target, source) {
  for (const action of ["ALLOW", "CAUTION", "RESTRICT", "DEFER", "NOT_APPLICABLE"]) {
    target[action] += Number(source?.[action] || 0);
  }
}

const [fixtureText, productsText, skinMatchEngineSource, sharedContextSource, observerSource] =
  await Promise.all([
    readFile(FIXTURE_PATH, "utf8"),
    readFile(PRODUCT_FIXTURE_PATH, "utf8"),
    readFile("lib/skin-match-decision-engine.js", "utf8"),
    readFile("lib/shared-skin-decision-context.js", "utf8"),
    readFile("lib/exfoliation-normative-policy-production-shadow-observer.js", "utf8")
  ]);

const fixture = JSON.parse(fixtureText);
const productFixture = JSON.parse(productsText);

assert.equal(fixture.fixture_lineage, "REMEDIATED_FIXTURE_VERSION");
assert.equal(fixture.original_worker_fixture_recovered, false);
assert.equal(fixture.privacy_classification, "CONTROLLED_SYNTHETIC_NO_PERSONAL_DATA");
assert.equal(fixture.context_count, 28);
assert.equal(fixture.contexts.length, 28);
assert.deepEqual(
  fixture.contexts.map((row) => row.context_id),
  Array.from({ length: 28 }, (_, index) => `CTX-${String(index + 1).padStart(3, "0")}`)
);
assert.equal(productFixture.productCount, 164);
assert.equal(productFixture.products.length, 164);

// This is an authority guard, not a reimplementation: the current production skin-match
// recommendation engine uses the raw concern-score >= 18 boundary while the shared context
// auto-switches to 70 whenever any concern score exceeds 40.
assert.match(skinMatchEngineSource, /getConcernTotal\(scoreCard, "barrier"\) >= 18/);
assert.match(skinMatchEngineSource, /getConcernTotal\(scoreCard, "redness"\) >= 18/);
assert.match(sharedContextSource, /Math\.max\([^\n]+\) > 40 \? 70 : 18/);
assert.match(observerSource, /buildSharedSkinDecisionContext/);
assert.doesNotMatch(observerSource, /buildExfoliationNormativePolicySkinMatchContext/);

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

const aggregateActionCounts = {
  ALLOW: 0,
  CAUTION: 0,
  RESTRICT: 0,
  DEFER: 0,
  NOT_APPLICABLE: 0
};
let replayCaseCount = 0;
let runtimeExecutionCount = 0;
let actualNormativeExclusionCount = 0;
let fallbackCount = 0;
const stopReasons = new Set();
const perContext = [];

// Execute the complete 28 x 164 exact observer replay before semantic gate assertions.
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
  const telemetry = result.telemetry;
  assert.equal(result.observerVersion, EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION);
  assert.equal(result.effectiveMode, "SHADOW");
  assert.equal(result.runtimeActive, true);
  assert.equal(result.canonicalMutationApplied, false);
  assert.equal(result.legacyPathPreserved, true);
  assert.equal(result.restrictCanonicalExclusionCount, 0);
  assert.equal(telemetry.candidateCountBefore, 164);
  assert.equal(telemetry.candidateCountAfter, 164);
  addActionCounts(aggregateActionCounts, telemetry.actionCounts);
  replayCaseCount += telemetry.candidateCountBefore;
  runtimeExecutionCount += telemetry.runtimeExecutionCount;
  actualNormativeExclusionCount += telemetry.actualNormativeExclusionCount;
  fallbackCount += telemetry.fallbackCount;
  for (const reason of telemetry.stopReasons || []) stopReasons.add(reason);
  perContext.push({
    context_id: context.context_id,
    action_counts: telemetry.actionCounts,
    runtime_execution_count: telemetry.runtimeExecutionCount,
    fallback_count: telemetry.fallbackCount,
    stop_reasons: telemetry.stopReasons
  });
}

assert.equal(replayCaseCount, 164 * 28);
assert.equal(runtimeExecutionCount, 164 * 28);
assert.equal(
  Object.values(aggregateActionCounts).reduce((sum, value) => sum + value, 0),
  164 * 28
);
assert.equal(actualNormativeExclusionCount, 0);

const semanticMismatches = [];
for (const context of fixture.contexts) {
  const built = buildSharedSkinDecisionContext(reportForContext(context));
  const mismatches = contextExpectationMismatches(context, built.context);
  if (mismatches.length) {
    semanticMismatches.push({
      context_id: context.context_id,
      dimensions: context.dimensions,
      mismatches
    });
  }
}

const summary = {
  verifier: "verify-v21-9i-exact-main-replay-gate-v1",
  expected_base_main_sha: EXPECTED_BASE_MAIN_SHA,
  fixture_version: fixture.fixture_version,
  fixture_lineage: fixture.fixture_lineage,
  original_worker_fixture_recovered: fixture.original_worker_fixture_recovered,
  observer_version: EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SHADOW_OBSERVER_VERSION,
  product_count: productFixture.productCount,
  context_count: fixture.context_count,
  replay_case_count: replayCaseCount,
  runtime_execution_count: runtimeExecutionCount,
  action_counts: aggregateActionCounts,
  fallback_count: fallbackCount,
  actual_normative_exclusion_count: actualNormativeExclusionCount,
  stop_reasons: [...stopReasons].sort(),
  semantic_mismatch_count: semanticMismatches.length,
  semantic_mismatches: semanticMismatches,
  production_source_modified_for_gate: false,
  enforce_requested: false,
  gate: semanticMismatches.length || stopReasons.size
    ? "BLOCKED_V21_9I_REMEDIATION_REQUIRES_SEMANTIC_RUNTIME_CHANGE"
    : "PASS"
};

console.log(JSON.stringify(summary, null, 2));

if (stopReasons.size > 0) {
  throw new Error(
    `EXACT_MAIN_9I_REPLAY_GATE runtime stop reasons: ${[...stopReasons].join(",")}`
  );
}
if (semanticMismatches.length > 0) {
  throw new Error(
    "BLOCKED_V21_9I_REMEDIATION_REQUIRES_SEMANTIC_RUNTIME_CHANGE"
  );
}

console.log("EXACT_MAIN_9I_REPLAY_GATE = PASS");
