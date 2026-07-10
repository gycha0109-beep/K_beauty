import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { buildFunctionalCandidateExposureAudit } from "../lib/functional-candidate-exposure-audit.js";

function signals(labels) {
  return {
    functional: labels.map((label, index) => ({ label, count: index === 0 ? 6 : 1 }))
  };
}

function product(overrides = {}) {
  return {
    id: overrides.id || "product-a",
    category: Object.prototype.hasOwnProperty.call(overrides, "category") ? overrides.category : "treatment",
    irritation_risk: Object.prototype.hasOwnProperty.call(overrides, "irritation_risk") ? overrides.irritation_risk : "low",
    sensitivity_safe: Object.prototype.hasOwnProperty.call(overrides, "sensitivity_safe") ? overrides.sensitivity_safe : true,
    ingredient_signals: overrides.ingredient_signals || signals(["skin hydration", "skin protection"]),
    ...overrides
  };
}

function surveySafety(overrides = {}) {
  return {
    skinState: {},
    goals: {},
    safety: {
      sensitivityRisk: "medium",
      rednessRisk: "high",
      drynessRisk: "low",
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes",
      ...overrides
    },
    preferences: {},
    sunscreen: {}
  };
}

function audit({ products, safety = {}, goalPolicy = {}, currentProductFindings = null }) {
  return buildFunctionalCandidateExposureAudit({
    products,
    surveyContract: surveySafety(safety),
    goalPolicy: {
      rankingGoal: "dehydration",
      safetyGoal: "redness",
      recommendationGuard: "stabilize_first",
      hasTension: true,
      ...goalPolicy
    },
    currentProductFindings
  });
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("primary candidate is included when eligible with no guard", () => {
  const output = audit({
    products: [product({ id: "primary" })],
    safety: { recentSkinChange: "no", recentlyChangedProduct: "no", sensitivityRisk: "low", rednessRisk: "low" },
    goalPolicy: { recommendationGuard: "normal" }
  });

  assert.equal(output.primaryCandidates.length, 1);
  assert.equal(output.primaryCandidates[0].exposurePolicy.exposureStatus, "primary_candidate");
  assert.equal(output.candidateReviewRows.length, output.summary.evaluatedCount);
  assert.equal(output.candidateReviewRows[0].productId, "primary");
  assert.equal(output.candidateReviewRows[0].exposureStatus, "primary_candidate");
  assert.equal(output.candidateReviewRows[0].visibilityPriority, "high");
  assert.equal(output.candidateReviewRows[0].hardFilterStatus, "pass");
});

runCase("contextual candidate keeps caution message", () => {
  const output = audit({
    products: [product({ id: "contextual" })],
    safety: { recentSkinChange: "no", recentlyChangedProduct: "no", sensitivityRisk: "high" },
    goalPolicy: { recommendationGuard: "normal" }
  });

  assert.equal(output.contextualCandidates.length, 1);
  assert.equal(output.contextualCandidates[0].exposurePolicy.userMessageType, "contextual_caution");
});

runCase("safe low-risk recent-instability candidate is collapsed, not primary or hidden", () => {
  const output = audit({
    products: [product({ id: "collapsed", ingredient_signals: signals(["skin hydration", "skin protection", "whitening"]) })]
  });

  assert.equal(output.collapsedCandidates.length, 1);
  assert.equal(output.primaryCandidates.length, 0);
  assert.equal(output.hiddenCandidates.length, 0);
  assert.equal(output.candidateReviewRows[0].guardDecision, "collapsed_exposure_candidate");
  assert.equal(output.candidateReviewRows[0].implementationHint, "future_collapsed_exposure");
  assert.ok(output.candidateReviewRows[0].guardReasons.includes("recent_instability_detected"));
});

runCase("blocked or hard-block candidate is hidden and not collapsed", () => {
  const output = audit({
    products: [product({
      id: "hidden",
      irritation_risk: "high",
      sensitivity_safe: false,
      ingredient_signals: signals(["whitening", "exfoliation"])
    })],
    safety: { sensitivityRisk: "high" }
  });

  assert.equal(output.hiddenCandidates.length, 1);
  assert.equal(output.collapsedCandidates.length, 0);
  assert.equal(output.candidateReviewRows[0].exposureStatus, "hidden_candidate");
  assert.equal(output.candidateReviewRows[0].hardFilterStatus, "blocked");
  assert.ok(output.candidateReviewRows[0].hardFilterReasons.length > 0);
});

runCase("insufficient evidence is not hidden", () => {
  const output = audit({
    products: [product({
      id: "insufficient",
      category: "",
      irritation_risk: undefined,
      sensitivity_safe: undefined,
      ingredient_signals: { functional: [] }
    })]
  });

  assert.equal(output.insufficientEvidenceCandidates.length, 1);
  assert.equal(output.hiddenCandidates.length, 0);
  assert.equal(output.candidateReviewRows[0].exposureStatus, "insufficient_evidence_candidate");
  assert.notEqual(output.candidateReviewRows[0].exposureStatus, "hidden_candidate");
});

runCase("evaluator hard block wins over collapsed policy candidate", () => {
  const output = audit({
    products: [product({
      id: "hard-wins",
      ingredient_signals: signals(["skin hydration", "skin protection", "whitening"])
    })],
    goalPolicy: { rankingGoal: "acne" },
    safety: { sensitivityRisk: "high" }
  });

  assert.equal(output.hiddenCandidates.length, 1);
  assert.equal(output.collapsedCandidates.length, 0);
});

runCase("duplicate axis adds context without hiding or promoting collapsed candidate", () => {
  const output = audit({
    products: [product({ id: "duplicate", ingredient_signals: signals(["skin hydration", "whitening"]) })],
    currentProductFindings: {
      findings: [{ productId: "other", relationToPlan: "duplicate_axis", sourceState: "selected" }]
    }
  });

  assert.equal(output.collapsedCandidates.length, 1);
  assert.equal(output.primaryCandidates.length, 0);
  assert.equal(output.hiddenCandidates.length, 0);
  assert.ok(output.collapsedCandidates[0].exposurePolicy.reasons.includes("current_duplicate_axis_context"));
});

runCase("category distribution keeps unknown category out of category-created hard block", () => {
  const output = audit({
    products: [product({ id: "unknown-category", category: "", ingredient_signals: signals(["skin hydration"]) })],
    safety: { recentSkinChange: "no", recentlyChangedProduct: "no", sensitivityRisk: "low", rednessRisk: "low" },
    goalPolicy: { recommendationGuard: "normal" }
  });

  assert.equal(output.hiddenCandidates.length, 0);
  assert.ok(output.summary.categoryDistribution.insufficientEvidenceCandidates.unknown >= 1);
});

runCase("output is deterministic for reordered inputs", () => {
  const products = [
    product({ id: "b", ingredient_signals: signals(["skin hydration", "whitening"]) }),
    product({ id: "a", irritation_risk: "high", sensitivity_safe: false, ingredient_signals: signals(["whitening"]) })
  ];
  const first = audit({ products });
  const second = audit({ products: [...products].reverse() });

  assert.deepEqual(
    first.hiddenCandidates.map((item) => item.productId).sort(),
    second.hiddenCandidates.map((item) => item.productId).sort()
  );
  assert.deepEqual(first.summary.exposureStatusDistribution, second.summary.exposureStatusDistribution);
});

runCase("output excludes raw and identifying data strings", () => {
  const output = audit({ products: [product({ id: "safe" })] });
  const raw = JSON.stringify(output).toLowerCase();

  [
    "raw form",
    "base64",
    "filename",
    "path",
    "email",
    "session",
    "cookie",
    "user-agent",
    "product name",
    "brand",
    "purchase url",
    "review text"
  ].forEach((token) => assert.equal(raw.includes(token), false, token));
});

runCase("complete fixture runner targets complete captures and excludes final-only fixtures", () => {
  const stdout = execFileSync("node", ["scripts/run-functional-candidate-exposure-audit.mjs"], { encoding: "utf8" });

  assert.ok(stdout.includes("functional-candidate-exposure-audit summary"));
  assert.ok(stdout.includes("\"completeCaptureCount\": 10"));
  assert.ok(stdout.includes("\"excludedFixtureCount\": 10"));
  assert.ok(stdout.includes("\"candidateReviewRowCount\": 1640"));
  const artifact = JSON.parse(readFileSync("tmp/functional-shadow-captures/candidate-exposure-audit.json", "utf8"));
  assert.equal(artifact.aggregate.candidateReviewRowCount, artifact.aggregate.totalEvaluatedProductRows);
  assert.ok(Array.isArray(artifact.fixtureAudits[0].candidateReviewRows));
  assert.equal(artifact.fixtureAudits[0].candidateReviewRows.length, 164);
  assert.ok(artifact.aggregate.hiddenReasonDistribution.candidate_evaluator_blocked >= 1);
  assert.ok(artifact.aggregate.collapsedReasonDistribution.guard_policy_collapsed_exposure_candidate >= 1);
});

runCase("helper and runner are not wired into route, evaluator, existing CandidatePolicy, or UI", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");

  assert.equal(route.includes("functional-candidate-exposure-audit"), false);
  assert.equal(evaluator.includes("functional-candidate-exposure-audit"), false);
  assert.equal(candidatePolicy.includes("functional-candidate-exposure-audit"), false);
  assert.equal(page.includes("functional-candidate-exposure-audit"), false);
});
