import assert from "node:assert/strict";
import { reviewFunctionalDivergencePolicy } from "../lib/functional-divergence-policy-review.js";

function result({
  captureId,
  confidence = "high",
  rankingGoal = "dehydration",
  safetyGoal = "dehydration",
  recommendationGuard = "normal",
  hasTension = false,
  divergences = [],
  categoryComparison = {}
} = {}) {
  return {
    captureId,
    fileName: `${captureId}.json`,
    candidateSourceCompleteness: confidence === "low" ? "final_results_only" : "complete",
    candidateSourceStage: confidence === "low" ? "final_results_only" : "post_score_candidate_pool",
    candidateIdentityMode: confidence === "low" ? "unknown" : "product_row",
    rankingContext: {
      rankingGoal,
      safetyGoal,
      recommendationGuard,
      hasTension
    },
    comparison: {
      comparisonSummary: {
        comparisonConfidence: confidence,
        existingUniqueCount: 3,
        functionalRankedCount: 10,
        functionalBlockedCount: divergences.filter((item) => item.type === "existing_selected_but_blocked").length,
        functionalInsufficientDataCount: divergences.filter((item) => item.type === "existing_selected_but_insufficient_data").length,
        topPickMatch: !divergences.some((item) => item.type === "top_pick_mismatch")
      },
      divergences,
      categoryComparison: {
        existing: {},
        functionalRanked: {},
        functionalBlocked: {},
        functionalInsufficientData: {},
        ...categoryComparison
      }
    }
  };
}

function divergence(type, overrides = {}) {
  return {
    type,
    productId: overrides.productId || `${type}-product`,
    category: overrides.category || "serum",
    existingSource: overrides.existingSource || "top_pick",
    functionalStatus: overrides.functionalStatus || "ranked",
    functionalRank: overrides.functionalRank ?? 5,
    functionalScore: overrides.functionalScore ?? 60,
    functionalConfidence: overrides.functionalConfidence || "high",
    reasons: overrides.reasons || ["review fixture reason"]
  };
}

function replay(results) {
  return {
    totalCaptureCount: results.length,
    replayedCount: results.length,
    results,
    limitations: []
  };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

runCase("repeated high-confidence topPick mismatch becomes threshold-based policy review candidate", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "a", divergences: [divergence("top_pick_mismatch")] }),
      result({ captureId: "b", divergences: [divergence("top_pick_mismatch")] }),
      result({ captureId: "c", divergences: [] })
    ]),
    options: {
      minimumComparableCases: 3,
      minimumRepeatCount: 2,
      minimumRepeatRate: 0.5
    }
  });

  assert.equal(review.aggregate.topPickMismatchCount, 2);
  assert.ok(review.policyCandidates.some((item) => item.type === "top_pick_mismatch_review"));
});

runCase("single high-confidence blocked case requires safety review without automatic policy change", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({
        captureId: "blocked-a",
        divergences: [
          divergence("existing_selected_but_blocked", {
            reasons: ["High sensitivity and high product irritation risk should not be treated as a normal candidate."]
          })
        ]
      }),
      result({ captureId: "normal-a", divergences: [] }),
      result({ captureId: "normal-b", divergences: [] })
    ]),
    options: {
      minimumComparableCases: 3,
      minimumRepeatCount: 2
    }
  });

  assert.equal(review.safetyReviews.reviewStatus, "safety_review_required");
  assert.equal(review.safetyReviews.totalSafetyConflicts, 1);
  assert.equal(review.policyCandidates.some((item) => item.type === "hard_filter_review"), false);
});

runCase("repeated same hardFilterReason can create manual hard-filter policy review candidate", () => {
  const reason = "Recent instability and high skin risk make this active direction too aggressive for Phase 1 ranking.";
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "a", divergences: [divergence("existing_selected_but_blocked", { reasons: [reason] })] }),
      result({ captureId: "b", divergences: [divergence("existing_selected_but_blocked", { reasons: [reason] })] }),
      result({ captureId: "c", divergences: [] }),
      result({ captureId: "d", divergences: [] })
    ]),
    options: {
      minimumComparableCases: 4,
      minimumRepeatCount: 2,
      minimumRepeatRate: 0.5
    }
  });
  const candidate = review.policyCandidates.find((item) => item.type === "hard_filter_review");

  assert.ok(candidate);
  assert.equal(["manual_review_required", null].includes(candidate.changeRecommendation), true);
});

runCase("insufficient-data category concentration is a comparison limit", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({
        captureId: "a",
        divergences: [divergence("existing_selected_but_insufficient_data", { category: "cleanser", functionalStatus: "insufficient_data" })],
        categoryComparison: { existing: { cleanser: 1 }, functionalInsufficientData: { cleanser: 1 } }
      }),
      result({
        captureId: "b",
        divergences: [divergence("existing_selected_but_insufficient_data", { category: "cleanser", functionalStatus: "insufficient_data" })],
        categoryComparison: { existing: { cleanser: 1 }, functionalInsufficientData: { cleanser: 1 } }
      }),
      result({
        captureId: "c",
        divergences: [divergence("existing_selected_but_insufficient_data", { category: "cleanser", functionalStatus: "insufficient_data" })],
        categoryComparison: { existing: { cleanser: 1 }, functionalInsufficientData: { cleanser: 1 } }
      })
    ]),
    options: {
      minimumComparableCases: 3,
      categoryMinimumCount: 3
    }
  });
  const category = review.categoryReviews.find((item) => item.category === "cleanser");

  assert.equal(review.divergenceReviews.find((item) => item.type === "existing_selected_but_insufficient_data").reviewStatus, "comparison_limit");
  assert.equal(category.reviewStatus, "comparison_limit");
});

runCase("low-confidence divergence is excluded from policy candidates", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "low-a", confidence: "low", divergences: [divergence("top_pick_mismatch")] }),
      result({ captureId: "low-b", confidence: "low", divergences: [divergence("existing_selected_but_blocked")] })
    ]),
    options: { minimumComparableCases: 2 }
  });

  assert.equal(review.reviewScope.includedComparisonCount, 0);
  assert.equal(review.policyCandidates.length, 0);
  assert.ok(review.observationOnly.some((item) => item.type === "low_confidence_reference_only"));
});

runCase("insufficient comparable cases prevents policy candidate promotion", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "a", divergences: [divergence("top_pick_mismatch")] }),
      result({ captureId: "b", divergences: [divergence("top_pick_mismatch")] })
    ]),
    options: {
      minimumComparableCases: 5,
      minimumRepeatCount: 2,
      minimumRepeatRate: 0.2
    }
  });

  assert.equal(review.policyCandidates.length, 0);
  assert.ok(review.observationOnly.some((item) => item.type === "insufficient_comparable_cases"));
});

runCase("mixed confidence is separated and high evidence is not mixed with low", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "high-a", confidence: "high", divergences: [divergence("top_pick_mismatch")] }),
      result({ captureId: "medium-a", confidence: "medium", divergences: [divergence("top_pick_mismatch")] }),
      result({ captureId: "low-a", confidence: "low", divergences: [divergence("top_pick_mismatch")] })
    ]),
    options: { minimumComparableCases: 1 }
  });

  assert.equal(review.reviewScope.includedComparisonCount, 1);
  assert.equal(review.reviewScope.mediumComparisonCount, 1);
  assert.equal(review.reviewScope.excludedLowConfidenceCount, 1);
});

runCase("output is deterministic for reordered input", () => {
  const first = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "b", divergences: [divergence("functional_top_candidate_missing_from_existing", { productId: "p2" })] }),
      result({ captureId: "a", divergences: [divergence("top_pick_mismatch", { productId: "p1" })] })
    ]),
    options: { minimumComparableCases: 1 }
  });
  const second = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({ captureId: "a", divergences: [divergence("top_pick_mismatch", { productId: "p1" })] }),
      result({ captureId: "b", divergences: [divergence("functional_top_candidate_missing_from_existing", { productId: "p2" })] })
    ]),
    options: { minimumComparableCases: 1 }
  });

  assert.deepEqual(first.divergenceReviews, second.divergenceReviews);
  assert.deepEqual(first.policyCandidates, second.policyCandidates);
});

runCase("empty replay result returns limitations without throwing", () => {
  const review = reviewFunctionalDivergencePolicy({ replaySummary: replay([]) });

  assert.equal(review.reviewScope.includedComparisonCount, 0);
  assert.equal(review.policyCandidates.length, 0);
  assert.ok(review.limitations.length > 0);
});

runCase("review output excludes raw and identifying text", () => {
  const review = reviewFunctionalDivergencePolicy({
    replaySummary: replay([
      result({
        captureId: "safe-capture",
        divergences: [divergence("top_pick_mismatch", { productId: "safe-product-id" })]
      })
    ]),
    options: { minimumComparableCases: 1 }
  });
  const raw = JSON.stringify(review).toLowerCase();

  ["base64", "filename", "raw form", "image data", "brand", "purchase_url", "buy_link"].forEach((token) => {
    assert.equal(raw.includes(token), false, token);
  });
});
