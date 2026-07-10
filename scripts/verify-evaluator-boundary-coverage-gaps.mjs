import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolveEvaluatorRecentInstabilityBoundaryPolicy } from "../lib/evaluator-recent-instability-boundary-policy.js";

const baseCandidateEvaluation = {
  hardFilterStatus: "blocked",
  hardFilterReasons: ["recent_instability_active_limited"],
  confidence: "high"
};

const baseSurveySafety = {
  sensitivityRisk: "high",
  recentSkinChange: "yes",
  recentlyChangedProduct: "yes"
};

const baseGoalPolicy = {
  rankingGoal: "acne",
  safetyGoal: "redness",
  recommendationGuard: "stabilize_first"
};

function activeAxisOnly() {
  return [{ axis: "exfoliation" }];
}

function mixedAxes() {
  return [{ axis: "exfoliation" }, { axis: "hydration" }];
}

function product(overrides = {}) {
  const result = {
    id: "synthetic-product",
    category: "treatment"
  };

  if (!overrides.omitIrritationRisk) {
    result.irritation_risk = overrides.irritation_risk || "low";
  }

  if (!overrides.omitSensitivitySafe) {
    result.sensitivity_safe = Object.prototype.hasOwnProperty.call(overrides, "sensitivity_safe")
      ? overrides.sensitivity_safe
      : true;
  }

  return { ...result, ...overrides.extra };
}

function productProfile(overrides = {}) {
  return {
    evaluable: Object.prototype.hasOwnProperty.call(overrides, "evaluable") ? overrides.evaluable : true,
    categoryRole: overrides.categoryRole || "leave_on",
    functionalAxes: Object.prototype.hasOwnProperty.call(overrides, "functionalAxes")
      ? overrides.functionalAxes
      : mixedAxes(),
    cautionTags: Object.prototype.hasOwnProperty.call(overrides, "cautionTags") ? overrides.cautionTags : []
  };
}

function resolveCase({ candidateEvaluation, surveySafety, goalPolicy, productInput, productProfileInput } = {}) {
  return resolveEvaluatorRecentInstabilityBoundaryPolicy({
    candidateEvaluation: candidateEvaluation || baseCandidateEvaluation,
    surveySafety: surveySafety || baseSurveySafety,
    goalPolicy: goalPolicy || baseGoalPolicy,
    product: productInput || product(),
    productProfile: productProfileInput || productProfile()
  });
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

const results = {};

runCase("active_leaning only with safe metadata is not automatically preserved as hard block", () => {
  const result = resolveCase({
    productInput: product({ irritation_risk: "low", sensitivity_safe: true }),
    productProfileInput: productProfile({ functionalAxes: activeAxisOnly(), cautionTags: [] })
  });

  results.activeLeaningSafe = result.boundaryDecision;
  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
  assert.notEqual(result.boundaryDecision, "preserve_hard_block");
  assert.equal(result.futureIntegrationHint, "future_evaluator_pass_with_collapsed_hint");
});

runCase("active_leaning only with unsafe metadata preserves hard block", () => {
  const result = resolveCase({
    productInput: product({ irritation_risk: "high", sensitivity_safe: false }),
    productProfileInput: productProfile({ functionalAxes: activeAxisOnly(), cautionTags: [] })
  });

  results.activeLeaningUnsafe = result.boundaryDecision;
  assert.equal(result.boundaryDecision, "preserve_hard_block");
  assert.notEqual(result.boundaryDecision, "downgrade_to_collapsed_candidate");
});

runCase("metadata incomplete uses metadata review, not hard block or collapsed", () => {
  const missingIrritation = resolveCase({
    productInput: product({ omitIrritationRisk: true }),
    productProfileInput: productProfile()
  });
  const missingSensitivitySafe = resolveCase({
    productInput: product({ omitSensitivitySafe: true }),
    productProfileInput: productProfile()
  });
  const notEvaluable = resolveCase({
    productInput: product(),
    productProfileInput: productProfile({ evaluable: false })
  });
  const missingAxes = resolveCase({
    productInput: product(),
    productProfileInput: productProfile({ functionalAxes: [] })
  });

  results.metadataIncomplete = [
    missingIrritation.boundaryDecision,
    missingSensitivitySafe.boundaryDecision,
    notEvaluable.boundaryDecision,
    missingAxes.boundaryDecision
  ];
  assert.deepEqual(results.metadataIncomplete, [
    "requires_metadata_review",
    "requires_metadata_review",
    "requires_metadata_review",
    "requires_metadata_review"
  ]);
});

runCase("serum category with safe metadata is not preserved by category alone", () => {
  const result = resolveCase({
    productInput: product({
      irritation_risk: "low",
      sensitivity_safe: true,
      extra: { category: "serum" }
    }),
    productProfileInput: productProfile({ functionalAxes: mixedAxes(), cautionTags: [] })
  });

  results.serumSafe = result.boundaryDecision;
  assert.equal(result.policyContext.category, "serum");
  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
});

runCase("serum category with strong caution preserves hard block", () => {
  const result = resolveCase({
    productInput: product({
      irritation_risk: "high",
      sensitivity_safe: false,
      extra: { category: "serum" }
    }),
    productProfileInput: productProfile({
      functionalAxes: mixedAxes(),
      cautionTags: ["strong_active_caution"]
    })
  });

  results.serumStrongCaution = result.boundaryDecision;
  assert.equal(result.policyContext.category, "serum");
  assert.equal(result.boundaryDecision, "preserve_hard_block");
  assert.equal(result.futureIntegrationHint, "keep_evaluator_hard_block");
});

runCase("strong caution metadata preserves hard block independent of category", () => {
  const result = resolveCase({
    productInput: product({
      irritation_risk: "low",
      sensitivity_safe: true,
      extra: { category: "essence" }
    }),
    productProfileInput: productProfile({
      functionalAxes: mixedAxes(),
      cautionTags: ["strong_active_caution"]
    })
  });

  results.strongCautionLowRisk = result.boundaryDecision;
  assert.equal(result.policyContext.strongCautionSignal, true);
  assert.equal(result.boundaryDecision, "preserve_hard_block");
});

runCase("empty cautionTags does not force hard block or metadata review", () => {
  const result = resolveCase({
    productInput: product({ irritation_risk: "low", sensitivity_safe: true }),
    productProfileInput: productProfile({ functionalAxes: activeAxisOnly(), cautionTags: [] })
  });

  results.emptyCautionTags = {
    decision: result.boundaryDecision,
    confidence: result.confidence
  };
  assert.equal(result.boundaryDecision, "downgrade_to_collapsed_candidate");
  assert.notEqual(result.boundaryDecision, "preserve_hard_block");
  assert.notEqual(result.boundaryDecision, "requires_metadata_review");
  assert.equal(result.confidence, "medium");
});

runCase("deterministic output keeps decision and reason order stable", () => {
  const input = {
    productInput: product({ irritation_risk: "low", sensitivity_safe: true }),
    productProfileInput: productProfile({ functionalAxes: activeAxisOnly(), cautionTags: [] })
  };
  const first = resolveCase(input);
  const second = resolveCase(input);

  assert.deepEqual(first, second);
  assert.deepEqual(first.reasons, [...first.reasons].sort());
});

runCase("runtime isolation keeps route, evaluator, UI, and CandidatePolicy disconnected", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");
  const joined = [route, evaluator, candidatePolicy, page].join("\n");

  assert.equal(joined.includes("verify-evaluator-boundary-coverage-gaps"), false);
  assert.equal(route.includes("evaluator-recent-instability-boundary-policy"), false);
  assert.equal(evaluator.includes("evaluator-recent-instability-boundary-policy"), false);
  assert.equal(candidatePolicy.includes("evaluator-recent-instability-boundary-policy"), false);
  assert.equal(page.includes("evaluator-recent-instability-boundary-policy"), false);
});

console.log("evaluator-boundary-coverage-gaps summary");
console.log(JSON.stringify(results, null, 2));
