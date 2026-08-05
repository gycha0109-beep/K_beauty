import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANDIDATE_EXPOSURES,
  CANDIDATE_EXPOSURE_LANES,
  CANDIDATE_EXPOSURE_POLICY_VERSION,
  validateCandidateExposureDecision
} from "../lib/candidate-exposure-policy-contract.js";
import { evaluateCandidateExposurePolicy } from "../lib/candidate-exposure-policy.js";
import {
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES,
  validateCandidateExposurePolicyShadowTelemetry
} from "../lib/candidate-exposure-policy-observability.js";
import {
  resolveCandidateExposurePolicyShadowControl,
  runCandidateExposurePolicyShadow
} from "../lib/candidate-exposure-policy-shadow.js";

let assertions = 0;
const check = {
  equal(actual, expected, message) {
    assertions += 1;
    assert.equal(actual, expected, message);
  },
  deepEqual(actual, expected, message) {
    assertions += 1;
    assert.deepEqual(actual, expected, message);
  },
  ok(value, message) {
    assertions += 1;
    assert.ok(value, message);
  }
};

function candidate(id, {
  category = "serum",
  label = "Whitening",
  count = 4,
  irritationRisk = "low",
  sensitivitySafe = true,
  sunscreenComplete = true
} = {}) {
  return {
    id,
    name: `Candidate ${id}`,
    brand: "Fixture",
    category,
    irritation_risk: irritationRisk,
    sensitivity_safe: sensitivitySafe,
    skin_types: ["normal"],
    concerns: ["tone"],
    ingredient_signals: {
      functional: label ? [{ label, count }] : []
    },
    ...(category === "sunscreen" && sunscreenComplete
      ? { spf_value: 50, uva_label: "PA++++", uv_filter_type: "mixed" }
      : {})
  };
}

function finding(overrides = {}) {
  return {
    sourceState: "selected",
    category: "serum",
    productId: "current-1",
    canEvaluate: true,
    relationToPlan: "different_goal",
    matchedAxes: [],
    profile: null,
    ...overrides
  };
}

function findings(items = []) {
  return {
    findings: items,
    summary: {
      evaluableSelectedCount: items.filter((item) => item.sourceState === "selected").length,
      notInDbCount: items.filter((item) => item.sourceState === "not_in_db").length,
      notUsingCount: items.filter((item) => item.sourceState === "not_using").length,
      unansweredCount: items.filter((item) => item.sourceState === "unanswered").length
    }
  };
}

function canonicalState({
  currentProductFindings = findings([]),
  contextValid = true,
  stabilize = false,
  activeExpansionAllowed = !stabilize,
  protectionMustMaintain = true,
  locale = "ko"
} = {}) {
  return {
    decisionBundle: {
      locale,
      context: {
        version: contextValid ? "shared-skin-decision-context-v4" : null,
        skinState: { priorityAxis: "uneven_tone", concernScores: { uneven_tone: 20 } },
        survey: {
          answers: {
            skinType: "normal",
            sensitivity: stabilize ? "high" : "low",
            recentSkinChange: stabilize ? "yes" : "no",
            recentlyChangedProduct: "no"
          },
          completeness: "available"
        },
        safetyState: {
          level: stabilize ? "stabilize_first" : "stable",
          sensitiveBurden: stabilize,
          recentSkinChange: stabilize ? "yes" : "no",
          recentlyChangedProduct: "no"
        }
      }
    },
    functionalPolicy: {
      version: "functional-policy-v1",
      locale,
      priorityAxis: "uneven_tone",
      primaryGoal: "tone_spot",
      functionalDirection: "tone_care",
      planMode: stabilize ? "HOLD" : "START",
      allowedIntensity: stabilize ? "hold" : "low_to_moderate",
      recommendationSuppressed: stabilize,
      safety: {
        level: stabilize ? "stabilize_first" : "stable",
        activeExpansionAllowed,
        protectionMustMaintain
      }
    },
    consistency: {
      version: "cross-domain-consistency-v1",
      verdict: stabilize ? "blocked" : "consistent",
      effectivePolicySource: stabilize ? "stabilization_fallback" : "raw"
    },
    currentProductFindings
  };
}

function evaluateOne(state, product = candidate("candidate-1")) {
  const result = evaluateCandidateExposurePolicy({
    canonicalState: state,
    candidates: [product]
  });
  return result.decisions[0];
}

function assertDecision(decision, {
  exposure,
  reason,
  topPick,
  supporting,
  budget,
  routine,
  treatment
}, label) {
  check.equal(decision.exposure, exposure, `${label}: exposure`);
  check.ok(decision.reasonCodes.includes(reason), `${label}: reason`);
  check.equal(decision.laneEligibility.topPick, topPick, `${label}: topPick`);
  check.equal(decision.laneEligibility.supporting, supporting, `${label}: supporting`);
  check.equal(decision.laneEligibility.budget, budget, `${label}: budget`);
  check.equal(decision.laneEligibility.routine, routine, `${label}: routine`);
  check.equal(decision.laneEligibility.treatment, treatment, `${label}: treatment`);
}

check.equal(CANDIDATE_EXPOSURE_POLICY_VERSION, "candidate-exposure-policy-v1");
check.deepEqual(CANDIDATE_EXPOSURES, [
  "primary",
  "contextual",
  "collapsed",
  "hidden",
  "insufficient_evidence"
]);
check.deepEqual(CANDIDATE_EXPOSURE_LANES, [
  "topPick",
  "supporting",
  "budget",
  "routine",
  "treatment"
]);

const currentProductFixtures = [
  {
    name: "valid_empty",
    state: canonicalState(),
    expected: ["primary", "canonical_goal_match", true, true, true, true, true]
  },
  {
    name: "not_using",
    state: canonicalState({
      currentProductFindings: findings([
        finding({ sourceState: "not_using", productId: null, relationToPlan: "empty_slot", canEvaluate: false })
      ])
    }),
    expected: ["primary", "missing_step", true, true, true, true, true]
  },
  {
    name: "unanswered",
    state: canonicalState({
      currentProductFindings: findings([
        finding({ sourceState: "unanswered", productId: null, relationToPlan: "unknown_usage", canEvaluate: false })
      ])
    }),
    expected: ["insufficient_evidence", "usage_unknown", false, false, false, false, false]
  },
  {
    name: "partial_unknown",
    state: canonicalState({
      currentProductFindings: findings([
        finding(),
        finding({ sourceState: "unanswered", productId: null, relationToPlan: "unknown_usage", canEvaluate: false })
      ])
    }),
    expected: ["contextual", "partial_context", false, true, true, true, false]
  },
  {
    name: "populated",
    state: canonicalState({ currentProductFindings: findings([finding()]) }),
    expected: ["primary", "canonical_goal_match", true, true, true, true, true]
  },
  {
    name: "same_product",
    state: canonicalState({
      currentProductFindings: findings([finding({ productId: "candidate-1" })])
    }),
    expected: ["hidden", "already_using", false, false, false, false, false]
  },
  {
    name: "same_axis_replacement",
    state: canonicalState({
      currentProductFindings: findings([
        finding({ relationToPlan: "supports_goal", matchedAxes: ["tone_care"] })
      ])
    }),
    expected: ["contextual", "replacement_intent_unknown", false, true, true, true, false]
  },
  {
    name: "duplicate_axis",
    state: canonicalState({
      currentProductFindings: findings([
        finding({ relationToPlan: "duplicate_axis", matchedAxes: ["tone_care"] })
      ])
    }),
    expected: ["contextual", "duplicate_axis", false, true, true, true, false]
  },
  {
    name: "different_axis",
    state: canonicalState({ currentProductFindings: findings([finding()]) }),
    product: candidate("candidate-1", { label: "Skin Hydration", category: "moisturizer" }),
    expected: ["primary", "canonical_goal_match", true, true, true, true, false]
  },
  {
    name: "not_in_db",
    state: canonicalState({
      currentProductFindings: findings([
        finding({ sourceState: "not_in_db", productId: null, relationToPlan: "not_evaluable", canEvaluate: false })
      ])
    }),
    expected: ["insufficient_evidence", "product_not_evaluable", false, false, false, false, false]
  },
  {
    name: "selected_plus_not_in_db",
    state: canonicalState({
      currentProductFindings: findings([
        finding(),
        finding({ sourceState: "not_in_db", productId: null, relationToPlan: "not_evaluable", canEvaluate: false })
      ])
    }),
    expected: ["contextual", "partial_context", false, true, true, true, false]
  },
  {
    name: "malformed_findings",
    state: canonicalState({ currentProductFindings: { findings: "invalid" } }),
    expected: ["insufficient_evidence", "current_findings_invalid", false, false, false, false, false]
  }
];

for (const fixture of currentProductFixtures) {
  const input = structuredClone(fixture.state);
  const original = structuredClone(input);
  const product = fixture.product || candidate("candidate-1");
  const first = evaluateOne(input, product);
  const second = evaluateOne(input, structuredClone(product));
  assertDecision(first, {
    exposure: fixture.expected[0],
    reason: fixture.expected[1],
    topPick: fixture.expected[2],
    supporting: fixture.expected[3],
    budget: fixture.expected[4],
    routine: fixture.expected[5],
    treatment: fixture.expected[6]
  }, fixture.name);
  check.deepEqual(first, second, `${fixture.name}: deterministic`);
  check.deepEqual(input, original, `${fixture.name}: input immutable`);
  check.ok(validateCandidateExposureDecision(first).valid, `${fixture.name}: contract valid`);
}

const safetyFixtures = [
  {
    name: "stable_low_risk_goal_match",
    state: canonicalState(),
    product: candidate("s1"),
    exposure: "primary",
    reason: "canonical_goal_match"
  },
  {
    name: "stabilize_first_active",
    state: canonicalState({ stabilize: true }),
    product: candidate("s2"),
    exposure: "hidden",
    reason: "stabilization_active_block"
  },
  {
    name: "active_expansion_prohibited",
    state: canonicalState({ activeExpansionAllowed: false }),
    product: candidate("s3"),
    exposure: "hidden",
    reason: "expansion_prohibited"
  },
  {
    name: "protection_complete",
    state: canonicalState(),
    product: candidate("s4", { category: "sunscreen", label: "UV Protection" }),
    exposure: "primary",
    reason: "protection_maintained"
  },
  {
    name: "protection_incomplete",
    state: canonicalState(),
    product: candidate("s5", {
      category: "sunscreen",
      label: "UV Protection",
      sunscreenComplete: false
    }),
    exposure: "insufficient_evidence",
    reason: "protection_evidence_incomplete"
  },
  {
    name: "high_sensitivity_high_irritation",
    state: canonicalState({ stabilize: true }),
    product: candidate("s6", { irritationRisk: "high", sensitivitySafe: false }),
    exposure: "hidden",
    reason: "irritation_risk"
  },
  {
    name: "metadata_incomplete",
    state: canonicalState(),
    product: candidate("s7", { label: null }),
    exposure: "insufficient_evidence",
    reason: "metadata_incomplete"
  },
  {
    name: "unknown_functional_axis",
    state: canonicalState(),
    product: candidate("s8", { label: "Unknown Signal" }),
    exposure: "insufficient_evidence",
    reason: "metadata_incomplete"
  },
  {
    name: "invalid_canonical_context",
    state: canonicalState({ contextValid: false }),
    product: candidate("s9"),
    exposure: "insufficient_evidence",
    reason: "invalid_context"
  },
  {
    name: "missing_current_findings",
    state: canonicalState({ currentProductFindings: null }),
    product: candidate("s10"),
    exposure: "insufficient_evidence",
    reason: "current_findings_missing"
  },
  {
    name: "malformed_current_findings",
    state: canonicalState({ currentProductFindings: [] }),
    product: candidate("s11"),
    exposure: "insufficient_evidence",
    reason: "current_findings_invalid"
  }
];

for (const fixture of safetyFixtures) {
  const decision = evaluateOne(fixture.state, fixture.product);
  check.equal(decision.exposure, fixture.exposure, `${fixture.name}: exposure`);
  check.ok(decision.reasonCodes.includes(fixture.reason), `${fixture.name}: reason`);
  if (["hidden", "insufficient_evidence"].includes(fixture.exposure)) {
    check.equal(
      Object.values(decision.laneEligibility).filter(Boolean).length,
      0,
      `${fixture.name}: all lanes blocked`
    );
  }
}

const duplicateProduct = candidate("duplicate");
const duplicateResult = evaluateCandidateExposurePolicy({
  canonicalState: canonicalState(),
  candidates: [duplicateProduct, structuredClone(duplicateProduct)]
});
check.equal(duplicateResult.decisions.length, 2, "duplicate candidate count retained for audit");
check.ok(
  duplicateResult.decisions.every((decision) =>
    decision.exposure === "insufficient_evidence" &&
    decision.reasonCodes.includes("invalid_context")
  ),
  "duplicate candidate IDs fail closed"
);
check.ok(
  duplicateResult.decisions.every((decision) =>
    Object.values(decision.laneEligibility).every((eligible) => eligible === false)
  ),
  "same candidate repeated across lanes cannot become eligible"
);

const ko = evaluateOne(canonicalState({ locale: "ko" }), candidate("locale"));
const en = evaluateOne(canonicalState({ locale: "en" }), candidate("locale"));
check.deepEqual(
  {
    exposure: ko.exposure,
    reasonCodes: ko.reasonCodes,
    laneEligibility: ko.laneEligibility,
    currentProductRelation: ko.currentProductRelation
  },
  {
    exposure: en.exposure,
    reasonCodes: en.reasonCodes,
    laneEligibility: en.laneEligibility,
    currentProductRelation: en.currentProductRelation
  },
  "KO/EN decision keys are locale independent"
);

const controls = [
  [{}, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "0" }, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "true" }, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "yes" }, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "production" }, false],
  [{
    DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    VERCEL_ENV: "preview"
  }, false],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "preview" }, true],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "development" }, true],
  [{ DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1", VERCEL_ENV: "malformed" }, false]
];
for (const [env, enabled] of controls) {
  check.equal(resolveCandidateExposurePolicyShadowControl(env).enabled, enabled);
}

const responseValue = { topPick: { id: "response-id" }, alternatives: [{ id: "alt-id" }] };
const snapshotValue = { version: "snapshot-v1", topPick: { id: "response-id" } };
const responseBefore = structuredClone(responseValue);
const snapshotBefore = structuredClone(snapshotValue);
const inputCandidates = [candidate("shadow-1")];
const candidatesBefore = structuredClone(inputCandidates);
const emitted = [];
const shadowResult = runCandidateExposurePolicyShadow({
  control: resolveCandidateExposurePolicyShadowControl({
    DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    VERCEL_ENV: "preview"
  }),
  canonicalState: canonicalState(),
  candidates: inputCandidates,
  responseValue,
  snapshotValue,
  telemetrySink: (...args) => emitted.push(args)
});
check.equal(shadowResult.executed, true);
check.equal(shadowResult.fingerprints.responseMatch, true);
check.equal(shadowResult.fingerprints.snapshotMatch, true);
check.equal(shadowResult.fingerprints.candidateOrderMatch, true);
check.deepEqual(responseValue, responseBefore, "response invariant");
check.deepEqual(snapshotValue, snapshotBefore, "snapshot invariant");
check.deepEqual(inputCandidates, candidatesBefore, "candidate order and input invariant");
check.equal(shadowResult.comparison.unexpectedDivergenceCount, 0);
check.equal(shadowResult.comparison.unclassifiedDivergenceCount, 0);
check.equal(emitted.length, 1, "aggregate telemetry emitted once");
check.ok(validateCandidateExposurePolicyShadowTelemetry(shadowResult.telemetry).valid);
const currentProductSemanticTelemetry = structuredClone(shadowResult.telemetry);
currentProductSemanticTelemetry.divergenceCategoryCounts = {
  expected_current_product_semantics: currentProductSemanticTelemetry.candidateCount
};
check.ok(
  validateCandidateExposurePolicyShadowTelemetry(currentProductSemanticTelemetry).valid,
  "enumerated aggregate category names must not be mistaken for identifier fields"
);
const identifierLeakTelemetry = structuredClone(currentProductSemanticTelemetry);
identifierLeakTelemetry.productId = "forbidden";
check.equal(
  validateCandidateExposurePolicyShadowTelemetry(identifierLeakTelemetry).valid,
  false,
  "actual product identifiers remain forbidden"
);
check.ok(
  Object.keys(shadowResult.telemetry).every((key) =>
    !/(productId|productName|brand|url|userId|survey|cookie|jwt|sessionId|reportId|token)/i.test(key)
  ),
  "telemetry has no raw identifier fields"
);
check.ok(
  CANDIDATE_EXPOSURE_DIVERGENCE_CATEGORIES.every((category) =>
    category !== "unclassified_divergence"
  ),
  "divergence vocabulary is bounded"
);

const fallbackResponse = { stable: true };
const fallbackSnapshot = { stable: true };
const failureResult = runCandidateExposurePolicyShadow({
  control: resolveCandidateExposurePolicyShadowControl({
    DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1",
    VERCEL_ENV: "preview"
  }),
  canonicalState: canonicalState(),
  candidates: [candidate("failure")],
  responseValue: fallbackResponse,
  snapshotValue: fallbackSnapshot,
  telemetrySink: () => {},
  evaluator() {
    throw new Error("raw candidate details must not escape");
  }
});
check.equal(failureResult.status, "execution_failed");
check.equal(failureResult.errorCategory, "adapter_execution_failed");
check.equal(failureResult.telemetry.fallbackCount, 1);
check.equal(failureResult.telemetry.shadowExceptionCount, 1);
check.deepEqual(fallbackResponse, { stable: true }, "exception preserves response");
check.deepEqual(fallbackSnapshot, { stable: true }, "exception preserves snapshot");
check.equal(validateCandidateExposurePolicyShadowTelemetry(failureResult.telemetry).valid, true);

const routeSource = readFileSync("app/api/analyze/route.js", "utf8");
const engineSource = readFileSync("lib/skin-match-decision-engine.js", "utf8");
const reentrySource = readFileSync("lib/premium-report-reentry.js", "utf8");
const packageSource = JSON.parse(readFileSync("package.json", "utf8"));
check.ok(
  routeSource.indexOf("rebuildPremiumDecisionState(premiumDecisionSource") <
    routeSource.indexOf("runCandidateExposurePolicyShadow({"),
  "shadow executes after canonical rebuild"
);
check.ok(
  routeSource.includes("candidates: decision?.diagnostics?.candidateSource?.products"),
  "shadow consumes the existing normalized candidate pool"
);
check.ok(
  !routeSource.includes("candidateExposurePolicyShadowResult"),
  "shadow output is not connected to response serialization"
);
check.ok(
  !engineSource.includes("candidate-exposure-policy"),
  "runtime candidate filtering is not connected"
);
check.ok(
  !reentrySource.includes("candidate-exposure-policy"),
  "saved-report reentry does not recalculate exposure"
);
check.equal(
  packageSource.scripts["verify:candidate-exposure-policy-shadow"],
  "node scripts/verify-candidate-exposure-policy-shadow-runtime.mjs"
);

console.log(
  `verify-candidate-exposure-policy-shadow-runtime: PASS (${assertions} assertions, ` +
  `${currentProductFixtures.length} current-product fixtures, ${safetyFixtures.length + 2} safety fixtures)`
);
