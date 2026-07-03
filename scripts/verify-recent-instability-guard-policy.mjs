import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveRecentInstabilityGuardPolicy } from "../lib/recent-instability-guard-policy.js";

function baseInput(overrides = {}) {
  return {
    surveySafety: {
      sensitivityRisk: "high",
      drynessRisk: "low",
      rednessRisk: "high",
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes",
      ...(overrides.surveySafety || {})
    },
    goalPolicy: {
      rankingGoal: "acne",
      safetyGoal: "redness",
      recommendationGuard: "stabilize_first",
      ...(overrides.goalPolicy || {})
    },
    product: {
      id: "product-a",
      category: "treatment",
      irritation_risk: "low",
      sensitivity_safe: true,
      ...(overrides.product || {})
    },
    productProfile: {
      evaluable: true,
      categoryRole: "functional_leave_on",
      functionalAxes: [
        { axis: "hydration", strength: "high", confidence: "high" },
        { axis: "barrier_support", strength: "medium", confidence: "high" },
        { axis: "tone_care", strength: "low", confidence: "medium" }
      ],
      cautionTags: [],
      ...(overrides.productProfile || {})
    }
  };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("high sensitivity with high irritation and sensitivitySafe false remains a hard-block candidate", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    product: { irritation_risk: "high", sensitivity_safe: false },
    productProfile: { cautionTags: ["irritation_risk_watch"] }
  }));

  assert.equal(output.applies, true);
  assert.equal(output.decision, "hard_block_candidate");
  assert.equal(output.guardLevel, "high");
  assert.equal(output.implementationHint, "keep_hard_block");
});

runCase("recent instability with low irritation and sensitivitySafe true is not a hard block", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    product: { irritation_risk: "low", sensitivity_safe: true }
  }));

  assert.equal(output.applies, true);
  assert.notEqual(output.decision, "hard_block_candidate");
  assert.ok(["soft_penalty_candidate", "collapsed_exposure_candidate"].includes(output.decision));
  assert.equal(output.implementationHint, "future_collapsed_exposure");
});

runCase("recent instability with medium irritation and sensitivitySafe true is medium-or-lower guard", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    product: { irritation_risk: "medium", sensitivity_safe: true }
  }));

  assert.notEqual(output.decision, "hard_block_candidate");
  assert.ok(["low", "medium"].includes(output.guardLevel));
});

runCase("recent instability with missing safety metadata is insufficient data and not a hard block", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    product: { irritation_risk: undefined, sensitivity_safe: undefined },
    productProfile: { functionalAxes: [], cautionTags: undefined }
  }));

  assert.equal(output.decision, "insufficient_data");
  assert.notEqual(output.decision, "hard_block_candidate");
  assert.ok(["collect_more_evidence", "needs_metadata_review"].includes(output.implementationHint));
  assert.ok(output.reasons.includes("safety_metadata_incomplete"));
});

runCase("no recent instability, no high sensitivity, and no stabilize-first guard produces no guard", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    surveySafety: {
      sensitivityRisk: "low",
      recentSkinChange: "no",
      recentlyChangedProduct: "no",
      rednessRisk: "low"
    },
    goalPolicy: {
      safetyGoal: "oiliness",
      recommendationGuard: "normal"
    }
  }));

  assert.equal(output.applies, false);
  assert.equal(output.decision, "no_guard");
  assert.equal(output.guardLevel, "none");
});

runCase("high sensitivity alone with low irritation and sensitivitySafe true is not a broad hard block", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    surveySafety: {
      sensitivityRisk: "high",
      recentSkinChange: "no",
      recentlyChangedProduct: "no"
    },
    goalPolicy: {
      recommendationGuard: "normal"
    },
    product: { irritation_risk: "low", sensitivity_safe: true }
  }));

  assert.notEqual(output.decision, "hard_block_candidate");
  assert.ok(output.reasons.includes("high_sensitivity_detected"));
});

runCase("active axis with hydration and barrier support does not hard block by category or active axis alone", () => {
  const output = resolveRecentInstabilityGuardPolicy(baseInput({
    product: { category: "toner_pad", irritation_risk: "low", sensitivity_safe: true },
    productProfile: {
      categoryRole: "hydration_base",
      functionalAxes: [
        { axis: "hydration", strength: "high", confidence: "high" },
        { axis: "barrier_support", strength: "medium", confidence: "high" },
        { axis: "tone_care", strength: "low", confidence: "low" }
      ]
    }
  }));

  assert.equal(output.policyContext.activeAxisPresent, true);
  assert.equal(output.policyContext.stabilizingAxisPresent, true);
  assert.notEqual(output.decision, "hard_block_candidate");
});

runCase("output is deterministic", () => {
  const first = resolveRecentInstabilityGuardPolicy(baseInput());
  const second = resolveRecentInstabilityGuardPolicy(baseInput());

  assert.deepEqual(first, second);
});

runCase("missing product/profile does not throw and returns a stable policy state", () => {
  const output = resolveRecentInstabilityGuardPolicy({
    surveySafety: { recentSkinChange: "yes", sensitivityRisk: "high" },
    goalPolicy: { recommendationGuard: "stabilize_first", safetyGoal: "redness" }
  });

  assert.ok(["insufficient_data", "no_guard"].includes(output.decision));
});

runCase("policy helper is not wired into route or functional evaluator runtime", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const uiPolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");

  assert.equal(route.includes("recent-instability-guard-policy"), false);
  assert.equal(evaluator.includes("recent-instability-guard-policy"), false);
  assert.equal(uiPolicy.includes("recent-instability-guard-policy"), false);
});
