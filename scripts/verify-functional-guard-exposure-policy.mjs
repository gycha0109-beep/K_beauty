import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveFunctionalGuardExposurePolicy } from "../lib/functional-guard-exposure-policy.js";

function candidate(overrides = {}) {
  return {
    productId: "product-a",
    eligible: true,
    hardFilterStatus: "pass",
    totalScore: 72,
    confidence: "medium",
    scoreBreakdown: {},
    reasons: [],
    penalties: [],
    rankingContext: {
      rankingGoal: "acne",
      safetyGoal: "redness",
      recommendationGuard: "stabilize_first",
      hasTension: true
    },
    ...overrides
  };
}

function guard(overrides = {}) {
  return {
    applies: true,
    guardLevel: "low",
    decision: "allow_with_context",
    reasons: ["recent_instability_detected"],
    policyContext: {
      productSafetyMetadataComplete: true,
      category: "treatment",
      categoryRole: "functional_leave_on"
    },
    implementationHint: "collect_more_evidence",
    ...overrides
  };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("evaluator blocked candidate is hidden with safety guard message", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate({ eligible: false, hardFilterStatus: "blocked" }),
    recentInstabilityGuardPolicy: guard({ decision: "allow_with_context" })
  });

  assert.equal(output.exposureStatus, "hidden_candidate");
  assert.equal(output.includeInPrimaryCandidates, false);
  assert.equal(output.includeInCollapsedCandidates, false);
  assert.equal(output.includeInHiddenCandidates, true);
  assert.equal(output.userMessageType, "hard_safety_guard_notice");
});

runCase("collapsed exposure candidate moves to collapsed group without hiding", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate({ hardFilterStatus: "pass", confidence: "medium" }),
    recentInstabilityGuardPolicy: guard({
      decision: "collapsed_exposure_candidate",
      guardLevel: "low",
      implementationHint: "future_collapsed_exposure"
    })
  });

  assert.equal(output.exposureStatus, "collapsed_candidate");
  assert.equal(output.includeInPrimaryCandidates, false);
  assert.equal(output.includeInCollapsedCandidates, true);
  assert.equal(output.includeInHiddenCandidates, false);
  assert.equal(output.userMessageType, "stabilize_first_notice");
});

runCase("no guard and eligible candidate remains primary", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate({ confidence: "high" }),
    recentInstabilityGuardPolicy: guard({
      applies: false,
      guardLevel: "none",
      decision: "no_guard",
      reasons: ["safety_context_not_triggered"]
    })
  });

  assert.equal(output.exposureStatus, "primary_candidate");
  assert.equal(output.includeInPrimaryCandidates, true);
  assert.equal(output.userMessageType, "none");
});

runCase("allow with context stays primary with contextual caution", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate(),
    recentInstabilityGuardPolicy: guard({ decision: "allow_with_context", guardLevel: "low" })
  });

  assert.equal(output.exposureStatus, "contextual_candidate");
  assert.equal(output.includeInPrimaryCandidates, true);
  assert.equal(output.userMessageType, "contextual_caution");
});

runCase("insufficient data is insufficient evidence, not hidden", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate({ eligible: false, hardFilterStatus: "insufficient_data" }),
    recentInstabilityGuardPolicy: guard({ decision: "allow_with_context" })
  });

  assert.equal(output.exposureStatus, "insufficient_evidence_candidate");
  assert.equal(output.includeInPrimaryCandidates, false);
  assert.equal(output.includeInCollapsedCandidates, false);
  assert.equal(output.includeInHiddenCandidates, false);
  assert.equal(output.userMessageType, "insufficient_evidence_notice");
});

runCase("hard block wins over collapsed exposure", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate({ eligible: false, hardFilterStatus: "blocked" }),
    recentInstabilityGuardPolicy: guard({
      decision: "collapsed_exposure_candidate",
      implementationHint: "future_collapsed_exposure"
    })
  });

  assert.equal(output.exposureStatus, "hidden_candidate");
  assert.equal(output.includeInCollapsedCandidates, false);
});

runCase("duplicate axis does not hide or promote collapsed candidate", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate(),
    recentInstabilityGuardPolicy: guard({ decision: "collapsed_exposure_candidate" }),
    currentProductFinding: { relationToPlan: "duplicate_axis", sourceState: "selected" }
  });

  assert.equal(output.exposureStatus, "collapsed_candidate");
  assert.equal(output.includeInPrimaryCandidates, false);
  assert.equal(output.includeInHiddenCandidates, false);
  assert.ok(output.reasons.includes("current_duplicate_axis_context"));
});

runCase("not-in-db and unanswered current product context do not infer negative exposure", () => {
  const output = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate(),
    recentInstabilityGuardPolicy: guard({ decision: "allow_with_context" }),
    currentProductFinding: { relationToPlan: "unknown_usage", sourceState: "not_in_db" }
  });

  assert.equal(output.exposureStatus, "contextual_candidate");
  assert.equal(output.includeInPrimaryCandidates, true);
  assert.ok(output.reasons.includes("current_product_context_neutral"));
});

runCase("output is deterministic with optional fields", () => {
  const first = resolveFunctionalGuardExposurePolicy({
    candidateEvaluation: candidate(),
    recentInstabilityGuardPolicy: guard(),
    currentProductFinding: { sourceState: "not_using", relationToPlan: "empty_slot" }
  });
  const second = resolveFunctionalGuardExposurePolicy({
    recentInstabilityGuardPolicy: guard(),
    candidateEvaluation: candidate(),
    currentProductFinding: { relationToPlan: "empty_slot", sourceState: "not_using" }
  });

  assert.deepEqual(first, second);
});

runCase("helper is not wired into route, evaluator, or existing CandidatePolicy runtime", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");

  assert.equal(route.includes("functional-guard-exposure-policy"), false);
  assert.equal(evaluator.includes("functional-guard-exposure-policy"), false);
  assert.equal(candidatePolicy.includes("functional-guard-exposure-policy"), false);
});
