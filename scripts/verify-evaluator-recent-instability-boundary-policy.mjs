import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  EVALUATOR_RECENT_INSTABILITY_BOUNDARY_POLICY_VALUES,
  resolveEvaluatorRecentInstabilityBoundaryPolicy
} from "../lib/evaluator-recent-instability-boundary-policy.js";

function candidateEvaluation(overrides = {}) {
  return {
    hardFilterStatus: overrides.hardFilterStatus || "blocked",
    hardFilterReasons: overrides.hardFilterReasons || ["recent_instability_active_limited"],
    confidence: overrides.confidence || "high"
  };
}

function surveySafety(overrides = {}) {
  return {
    sensitivityRisk: overrides.sensitivityRisk || "high",
    recentSkinChange: overrides.recentSkinChange || "yes",
    recentlyChangedProduct: overrides.recentlyChangedProduct || "yes"
  };
}

function goalPolicy(overrides = {}) {
  return {
    rankingGoal: overrides.rankingGoal || "acne",
    safetyGoal: overrides.safetyGoal || "redness",
    recommendationGuard: overrides.recommendationGuard || "stabilize_first"
  };
}

function product(overrides = {}) {
  return {
    id: overrides.id || "product-a",
    category: overrides.category || "treatment",
    irritation_risk: overrides.irritation_risk || "low",
    sensitivity_safe: Object.prototype.hasOwnProperty.call(overrides, "sensitivity_safe")
      ? overrides.sensitivity_safe
      : true
  };
}

function productProfile(overrides = {}) {
  const functionalAxes = Object.prototype.hasOwnProperty.call(overrides, "functionalAxes")
    ? overrides.functionalAxes
    : [
      { axis: "exfoliation" },
      { axis: "hydration" }
    ];

  return {
    evaluable: Object.prototype.hasOwnProperty.call(overrides, "evaluable") ? overrides.evaluable : true,
    categoryRole: overrides.categoryRole || "leave_on",
    functionalAxes,
    cautionTags: Object.prototype.hasOwnProperty.call(overrides, "cautionTags") ? overrides.cautionTags : []
  };
}

function resolve(overrides = {}) {
  return resolveEvaluatorRecentInstabilityBoundaryPolicy({
    candidateEvaluation: candidateEvaluation(overrides.candidateEvaluation || {}),
    surveySafety: surveySafety(overrides.surveySafety || {}),
    goalPolicy: goalPolicy(overrides.goalPolicy || {}),
    product: product(overrides.product || {}),
    productProfile: productProfile(overrides.productProfile || {})
  });
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("high sensitivity plus recent instability with high irritation and sensitivitySafe false preserves hard block", () => {
  const result = resolve({
    product: { irritation_risk: "high", sensitivity_safe: false },
    productProfile: { cautionTags: ["strong_active_caution"] }
  });

  assert.equal(result.applies, true);
  assert.equal(result.boundaryDecision, "preserve_hard_block");
  assert.equal(result.futureIntegrationHint, "keep_evaluator_hard_block");
});

runCase("low irritation sensitivity-safe evaluable mixed profile downgrades to collapsed candidate", () => {
  const result = resolve();

  assert.equal(result.applies, true);
  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
  assert.equal(result.futureIntegrationHint, "future_evaluator_pass_with_collapsed_hint");
});

runCase("missing profile evaluability or axes requires metadata review", () => {
  const notEvaluable = resolve({
    productProfile: { evaluable: false }
  });
  const noAxes = resolve({
    productProfile: { functionalAxes: [] }
  });

  assert.equal(notEvaluable.boundaryDecision, "requires_metadata_review");
  assert.equal(noAxes.boundaryDecision, "requires_metadata_review");
  assert.equal(notEvaluable.futureIntegrationHint, "needs_product_metadata_review");
});

runCase("candidate not blocked by recent_instability_active_limited is not applicable", () => {
  const result = resolve({
    candidateEvaluation: {
      hardFilterStatus: "blocked",
      hardFilterReasons: ["sensitivity_high_irritation_conflict"]
    }
  });

  assert.equal(result.applies, false);
  assert.equal(result.boundaryDecision, "not_applicable");
  assert.equal(result.futureIntegrationHint, "no_evaluator_change");
});

runCase("active axis alone does not preserve hard block for low-risk safe product", () => {
  const result = resolve({
    productProfile: {
      functionalAxes: [{ axis: "exfoliation" }],
      cautionTags: []
    }
  });

  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
  assert.notEqual(result.boundaryDecision, "preserve_hard_block");
});

runCase("empty cautionTags alone does not force hard block or metadata review", () => {
  const result = resolve({
    productProfile: { cautionTags: [] }
  });

  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
});

runCase("unsafe high-risk product is not downgraded to collapsed", () => {
  const result = resolve({
    product: { irritation_risk: "high", sensitivity_safe: false }
  });

  assert.equal(result.boundaryDecision, "preserve_hard_block");
  assert.notEqual(result.boundaryDecision, "downgrade_to_collapsed_candidate");
});

runCase("generic evaluator blocked reason does not prevent boundary review", () => {
  const result = resolve({
    candidateEvaluation: {
      hardFilterReasons: ["recent_instability_active_limited", "candidate_evaluator_blocked"]
    }
  });

  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
});

runCase("same input produces deterministic output", () => {
  const first = resolve();
  const second = resolve();

  assert.deepEqual(first, second);
});

runCase("output enum values are fixed", () => {
  assert.deepEqual(EVALUATOR_RECENT_INSTABILITY_BOUNDARY_POLICY_VALUES.boundaryDecisions, [
    "preserve_hard_block",
    "downgrade_to_collapsed_candidate",
    "requires_metadata_review",
    "not_applicable"
  ]);
});

runCase("runner executes and writes shadow summary", () => {
  const stdout = execFileSync(process.execPath, ["scripts/run-evaluator-recent-instability-boundary-shadow.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.ok(stdout.includes("evaluator-recent-instability-boundary-shadow summary"));
});

runCase("shadow output excludes raw form, image, PII, product names, brands, URLs, and review text", () => {
  const output = readFileSync("tmp/functional-shadow-captures/evaluator-recent-instability-boundary-shadow.json", "utf8")
    .toLowerCase();

  [
    "raw form",
    "base64",
    "filename",
    "image_url",
    "email",
    "session",
    "cookie",
    "user-agent",
    "product name",
    "brand",
    "purchase url",
    "review text"
  ].forEach((token) => assert.equal(output.includes(token), false, token));
});

runCase("route, evaluator, UI, and CandidatePolicy runtime are not connected to the boundary helper", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");

  assert.equal(route.includes("evaluator-recent-instability-boundary-policy"), false);
  assert.equal(evaluator.includes("evaluator-recent-instability-boundary-policy"), false);
  assert.equal(candidatePolicy.includes("evaluator-recent-instability-boundary-policy"), false);
  assert.equal(page.includes("evaluator-recent-instability-boundary-policy"), false);
});
