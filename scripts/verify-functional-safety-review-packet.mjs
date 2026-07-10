import assert from "node:assert/strict";
import { buildFunctionalSafetyReviewPacket } from "../lib/functional-safety-review-packet.js";

function blockedDivergence(overrides = {}) {
  return {
    type: "existing_selected_but_blocked",
    productId: overrides.productId || "blocked-product",
    category: overrides.category || "treatment",
    existingSource: overrides.existingSource || "supporting",
    functionalStatus: "blocked",
    functionalRank: null,
    functionalScore: null,
    functionalConfidence: "high",
    reasons: overrides.reasons || [
      "Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."
    ]
  };
}

function safetyContext(overrides = {}) {
  return {
    userContext: {
      rankingGoal: "acne",
      safetyGoal: "redness",
      recommendationGuard: "stabilize_first",
      hasTension: true,
      sensitivityRisk: "high",
      drynessRisk: "low",
      rednessRisk: "high",
      recentSkinChange: "yes",
      recentlyChangedProduct: "yes",
      sunscreenSourceCompleteness: "answered",
      ...(overrides.userContext || {})
    },
    productContext: {
      categoryRole: "functional_leave_on",
      functionalAxes: [{ axis: "acne_care", strength: "high", confidence: "high" }],
      cautionTags: ["irritation_risk_watch"],
      irritationRisk: "high",
      sensitivitySafe: false,
      texture: "gel",
      finish: "natural",
      evidenceQuality: { score: 5, max: 5 },
      profileEvaluable: true,
      ...(overrides.productContext || {})
    },
    filterDecision: {
      hardFilterReasons: [
        "High sensitivity and high product irritation risk should not be treated as a normal candidate."
      ],
      evaluatorReasons: [],
      evaluatorPenalties: [],
      scoreBreakdownSummary: {
        functionalFit: { score: 0, max: 30 },
        skinFit: { score: 0, max: 20 },
        safetyFit: { score: 0, max: 20 },
        preferenceFit: { score: 0, max: 10 },
        routineFit: { score: 0, max: 10 },
        evidenceQuality: { score: 0, max: 5 },
        reviewSignal: { score: 0, max: 5 },
        penalties: { score: 0 }
      },
      ...(overrides.filterDecision || {})
    },
    existingRecommendationContext: {
      source: "supporting",
      existingResultMembership: [{ source: "supporting", rank: 1, category: "treatment" }],
      existingTopPick: false,
      existingSupporting: true,
      existingBudgetAlternative: false,
      ...(overrides.existingRecommendationContext || {})
    }
  };
}

function result({ captureId, confidence = "high", productId = "blocked-product", divergence, context } = {}) {
  return {
    captureId,
    fileName: `${captureId}.json`,
    candidateSourceCompleteness: confidence === "high" ? "complete" : "final_results_only",
    comparison: {
      comparisonSummary: {
        comparisonConfidence: confidence
      },
      divergences: [divergence || blockedDivergence({ productId })]
    },
    safetyReviewContextByProductId: {
      [productId]: context || safetyContext()
    }
  };
}

function replay(results) {
  return {
    replayedCount: results.length,
    results,
    limitations: []
  };
}

function packet(results, options = {}) {
  return buildFunctionalSafetyReviewPacket({
    replaySummary: replay(results),
    divergencePolicyReview: {
      safetyReviews: { totalSafetyConflicts: results.length }
    },
    options
  });
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("high-confidence blocked case is included with deterministic caseId and reasons", () => {
  const output = packet([result({ captureId: "cap-a", productId: "prod-a" })]);
  const item = output.cases[0];

  assert.equal(output.cases.length, 1);
  assert.ok(item.caseId.includes("high_sensitivity"));
  assert.deepEqual(item.filterDecision.hardFilterReasons, [
    "High sensitivity and high product irritation risk should not be treated as a normal candidate."
  ]);
});

runCase("low-confidence blocked case is excluded", () => {
  const output = packet([result({ captureId: "low-a", confidence: "low" })]);

  assert.equal(output.cases.length, 0);
});

runCase("product context coverage includes available fields and unknown/null for missing fields", () => {
  const output = packet([
    result({
      captureId: "missing-a",
      productId: "missing-product",
      context: safetyContext({
        productContext: {
          functionalAxes: [],
          cautionTags: [],
          irritationRisk: null,
          sensitivitySafe: null,
          profileEvaluable: false
        }
      })
    })
  ]);
  const item = output.cases[0];

  assert.deepEqual(item.productContext.functionalAxes, []);
  assert.deepEqual(item.productContext.cautionTags, []);
  assert.equal(item.productContext.irritationRisk, null);
  assert.equal(item.productContext.sensitivitySafe, null);
  assert.equal(item.productContext.profileEvaluable, false);
  assert.equal(output.aggregate.reviewReadiness.ready, false);
  assert.ok(output.aggregate.reviewReadiness.blockers.length >= 3);
});

runCase("packet has no raw data leakage", () => {
  const output = packet([result({ captureId: "safe-a", productId: "safe-product" })]);
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
    "purchase_url",
    "buy_link",
    "review text"
  ].forEach((token) => assert.equal(raw.includes(token), false, token));
});

runCase("allowed outcomes are fixed and initial outcome is null", () => {
  const output = packet([result({ captureId: "outcome-a" })]);
  const item = output.cases[0];

  assert.deepEqual(item.allowedReviewOutcomes, [
    "guard_appears_appropriate",
    "possible_overblocking",
    "insufficient_product_metadata",
    "goal_function_difference",
    "insufficient_sample",
    "needs_domain_review"
  ]);
  assert.equal(item.outcome, null);
});

runCase("review questions are prompts and do not auto-conclude", () => {
  const output = packet([result({ captureId: "questions-a" })]);
  const item = output.cases[0];

  assert.ok(item.reviewQuestions.length >= 5);
  assert.equal(item.reviewQuestions.some((question) => question.includes("therefore change")), false);
});

runCase("aggregate counts reasons, categories, goals, and safety context", () => {
  const output = packet([
    result({ captureId: "a", productId: "p1" }),
    result({
      captureId: "b",
      productId: "p2",
      divergence: blockedDivergence({
        productId: "p2",
        category: "toner_pad",
        reasons: ["Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."]
      }),
      context: safetyContext({
        productContext: { categoryRole: "hydration_base" },
        filterDecision: {
          hardFilterReasons: ["Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."]
        }
      })
    })
  ]);

  assert.equal(output.aggregate.casesByHardFilterReason.high_sensitivity, 1);
  assert.equal(output.aggregate.casesByHardFilterReason.recent_instability, 1);
  assert.equal(output.aggregate.casesByCategory.treatment, 1);
  assert.equal(output.aggregate.casesByCategory.toner_pad, 1);
  assert.equal(output.aggregate.casesByRankingGoal.acne, 2);
  assert.equal(output.aggregate.casesWithHighSensitivity, 2);
});

runCase("no eligible cases produces stable empty packet", () => {
  const output = packet([]);

  assert.equal(output.cases.length, 0);
  assert.equal(output.aggregate.totalEligibleSafetyCases, 0);
  assert.equal(output.aggregate.reviewReadiness.ready, false);
});

runCase("output ordering is deterministic", () => {
  const first = packet([
    result({ captureId: "b", productId: "b-product" }),
    result({
      captureId: "a",
      productId: "a-product",
      divergence: blockedDivergence({
        productId: "a-product",
        category: "toner_pad",
        reasons: ["Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."]
      }),
      context: safetyContext({
        filterDecision: {
          hardFilterReasons: ["Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."]
        }
      })
    })
  ]);
  const second = packet([
    result({
      captureId: "a",
      productId: "a-product",
      divergence: blockedDivergence({
        productId: "a-product",
        category: "toner_pad",
        reasons: ["Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."]
      }),
      context: safetyContext({
        filterDecision: {
          hardFilterReasons: ["Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking."]
        }
      })
    }),
    result({ captureId: "b", productId: "b-product" })
  ]);

  assert.deepEqual(
    first.cases.map((item) => item.caseId),
    second.cases.map((item) => item.caseId)
  );
});
