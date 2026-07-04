import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { reviewFunctionalExposureReadiness } from "../lib/functional-exposure-readiness-review.js";

const TEST_DIR = path.join(process.cwd(), "tmp", "functional-exposure-readiness-verify");

function candidate(overrides = {}) {
  return {
    productId: overrides.productId || "candidate-a",
    category: overrides.category || "treatment",
    exposureStatus: overrides.exposureStatus || "hidden_candidate",
    safetyMetadataProfile: overrides.safetyMetadataProfile || "safe_low_risk",
    functionalProfile: overrides.functionalProfile || "mixed",
    candidateConfidence: "high",
    evaluatorHardFilterStatus: overrides.evaluatorHardFilterStatus || "blocked",
    evaluatorHardFilterReasons: overrides.evaluatorHardFilterReasons || ["recent_instability_active_limited"],
    recentInstabilityGuardDecision: overrides.recentInstabilityGuardDecision || "collapsed_exposure_candidate",
    recentInstabilityGuardLevel: overrides.recentInstabilityGuardLevel || "low",
    recentInstabilityGuardReasons: overrides.recentInstabilityGuardReasons || [
      "active_functional_axis",
      "recent_instability_detected",
      "sensitivity_safe_true",
      "low_irritation_risk"
    ],
    exposurePolicyReasons: overrides.exposurePolicyReasons || ["candidate_evaluator_blocked"],
    blockedBy: overrides.blockedBy || { evaluator: true, guardHardBlock: false },
    safetyContext: overrides.safetyContext || { highSensitivity: true, recentInstability: true },
    currentProductRelation: overrides.currentProductRelation || null,
    currentProductSourceState: overrides.currentProductSourceState || null
  };
}

function fixture({ captureId, confidence = "high", candidateReviews = [] }) {
  const counts = { primary: 0, contextual: 0, collapsed: 0, hidden: 0, insufficientEvidence: 0 };

  for (const item of candidateReviews) {
    if (item.exposureStatus === "primary_candidate") counts.primary += 1;
    if (item.exposureStatus === "contextual_candidate") counts.contextual += 1;
    if (item.exposureStatus === "collapsed_candidate") counts.collapsed += 1;
    if (item.exposureStatus === "hidden_candidate") counts.hidden += 1;
    if (item.exposureStatus === "insufficient_evidence_candidate") counts.insufficientEvidence += 1;
  }

  return {
    captureId,
    comparisonConfidence: confidence,
    sourceStage: "post_score",
    sourceCount: candidateReviews.length,
    rankingContext: { rankingGoal: "acne", safetyGoal: "redness", recommendationGuard: "stabilize_first" },
    counts,
    candidateReviews
  };
}

function sampleData() {
  const highA = fixture({
    captureId: "capture-high-a",
    candidateReviews: [
      candidate({ productId: "hidden-safe-a", category: "treatment", functionalProfile: "mixed" }),
      candidate({
        productId: "collapsed-safe-a",
        exposureStatus: "collapsed_candidate",
        evaluatorHardFilterStatus: "pass",
        evaluatorHardFilterReasons: ["no_hard_filter"],
        exposurePolicyReasons: ["guard_policy_collapsed_exposure_candidate"],
        blockedBy: { evaluator: false, guardHardBlock: false },
        currentProductRelation: "duplicate_axis"
      }),
      candidate({
        productId: "primary-a",
        exposureStatus: "primary_candidate",
        safetyMetadataProfile: "safe_medium_risk",
        functionalProfile: "stabilizing_leaning",
        evaluatorHardFilterStatus: "pass",
        evaluatorHardFilterReasons: ["no_hard_filter"],
        recentInstabilityGuardDecision: "no_guard",
        recentInstabilityGuardReasons: ["safety_context_not_triggered"],
        exposurePolicyReasons: ["guard_policy_no_guard"],
        blockedBy: { evaluator: false, guardHardBlock: false },
        safetyContext: { highSensitivity: false, recentInstability: false }
      })
    ]
  });
  const highB = fixture({
    captureId: "capture-high-b",
    candidateReviews: [
      candidate({
        productId: "hidden-safe-b",
        category: "toner_pad",
        functionalProfile: "mixed",
        evaluatorHardFilterReasons: ["recent_instability_active_limited"]
      }),
      candidate({
        productId: "hidden-unsafe-guard",
        category: "sunscreen",
        safetyMetadataProfile: "unsafe_high_risk",
        functionalProfile: "unknown",
        evaluatorHardFilterStatus: "pass",
        evaluatorHardFilterReasons: ["no_hard_filter"],
        recentInstabilityGuardDecision: "hard_block_candidate",
        recentInstabilityGuardReasons: ["high_irritation_risk", "high_sensitivity_detected"],
        exposurePolicyReasons: ["guard_policy_hard_block_candidate"],
        blockedBy: { evaluator: false, guardHardBlock: true },
        safetyContext: { highSensitivity: true, recentInstability: false }
      }),
      candidate({
        productId: "collapsed-safe-b",
        exposureStatus: "collapsed_candidate",
        category: "moisturizer",
        safetyMetadataProfile: "safe_medium_risk",
        functionalProfile: "stabilizing_leaning",
        evaluatorHardFilterStatus: "pass",
        evaluatorHardFilterReasons: ["no_hard_filter"],
        exposurePolicyReasons: ["guard_policy_collapsed_exposure_candidate"],
        blockedBy: { evaluator: false, guardHardBlock: false },
        safetyContext: { highSensitivity: false, recentInstability: true },
        currentProductRelation: "supports_goal"
      })
    ]
  });
  const low = fixture({
    captureId: "capture-low",
    confidence: "low",
    candidateReviews: [
      candidate({
        productId: "low-confidence-hidden",
        category: "serum",
        functionalProfile: "active_leaning"
      })
    ]
  });
  const exposureAudit = {
    auditVersion: "functional-candidate-exposure-audit-v1",
    fixtureAudits: [highA, highB, low]
  };
  const replaySummary = {
    comparisonConfidenceDistribution: { high: 2, medium: 0, low: 1 },
    results: [
      { captureId: "capture-high-a", comparison: { comparisonSummary: { comparisonConfidence: "high" } } },
      { captureId: "capture-high-b", comparison: { comparisonSummary: { comparisonConfidence: "high" } } },
      { captureId: "capture-low", comparison: { comparisonSummary: { comparisonConfidence: "low" } } }
    ]
  };

  return { exposureAudit, replaySummary };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

const { exposureAudit, replaySummary } = sampleData();
const review = reviewFunctionalExposureReadiness({
  exposureAudit,
  replaySummary,
  options: {
    includedConfidence: ["high"],
    minimumCaptureCount: 2,
    minimumGroupCount: 2,
    minimumReasonRepeatCount: 2
  }
});

runCase("high confidence only is included and low confidence is excluded", () => {
  assert.equal(review.aggregate.includedCaptureCount, 2);
  assert.equal(review.aggregate.reviewedCandidateCount, 6);
  assert.equal(review.categoryReview.byCategory.serum, undefined);
});

runCase("safe_low_risk hidden reason breakdown is exact", () => {
  assert.equal(review.hiddenReasonReview.safeLowRiskHiddenCount, 2);
  assert.equal(review.hiddenReasonReview.safeLowRiskHiddenReasonDistribution.recent_instability_active_limited, 2);
  assert.equal(review.hiddenReasonReview.safeLowRiskHiddenByCategory.treatment, 1);
  assert.equal(review.hiddenReasonReview.safeLowRiskHiddenByCategory.toner_pad, 1);
});

runCase("evaluator blocked and guard hard block are separated", () => {
  assert.equal(review.hiddenReasonReview.hiddenBlockedSourceDistribution.evaluator_blocked, 2);
  assert.equal(review.hiddenReasonReview.hiddenBlockedSourceDistribution.guard_hard_block_candidate, 1);
});

runCase("collapsed and hidden do not overlap", () => {
  assert.equal(review.collapsedReview.collapsedCount, 2);
  assert.equal(review.collapsedReview.collapsedHiddenOverlapCount, 0);
});

runCase("duplicate and supports_goal context does not flip collapsed to hidden", () => {
  assert.equal(review.collapsedReview.duplicateOrSupportsGoalFlippedToHiddenCount, 0);
});

runCase("category and functional profile aggregation is exact", () => {
  assert.equal(review.categoryReview.byCategory.treatment.hidden_candidate, 1);
  assert.equal(review.categoryReview.byCategory.moisturizer.collapsed_candidate, 1);
  assert.equal(review.categoryReview.byFunctionalProfile.mixed.hidden_candidate, 2);
  assert.equal(review.categoryReview.byFunctionalProfile.stabilizing_leaning.collapsed_candidate, 1);
});

runCase("readiness enum is valid and repeated broad hidden reasons require review", () => {
  assert.equal(review.integrationReadiness.status, "needs_hidden_reason_policy_review");
  assert.ok(review.integrationReadiness.validStatuses.includes(review.integrationReadiness.status));
});

runCase("sample shortage cannot be ready", () => {
  const scarce = reviewFunctionalExposureReadiness({
    exposureAudit,
    replaySummary,
    options: { includedConfidence: ["high"], minimumCaptureCount: 5, minimumGroupCount: 1 }
  });

  assert.equal(scarce.integrationReadiness.status, "insufficient_evidence");
});

runCase("output excludes raw form, image, PII, product name, brand, URL, and review text", () => {
  const raw = JSON.stringify(review).toLowerCase();
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
  ].forEach((token) => assert.equal(raw.includes(token), false, token));
});

runCase("helper output is deterministic", () => {
  const second = reviewFunctionalExposureReadiness({
    exposureAudit,
    replaySummary,
    options: {
      includedConfidence: ["high"],
      minimumCaptureCount: 2,
      minimumGroupCount: 2,
      minimumReasonRepeatCount: 2
    }
  });

  assert.deepEqual(review, second);
});

runCase("runner output is deterministic with existing prerequisite files", () => {
  rmSync(TEST_DIR, { recursive: true, force: true });
  mkdirSync(TEST_DIR, { recursive: true });
  writeFileSync(path.join(TEST_DIR, "candidate-exposure-audit.json"), JSON.stringify(exposureAudit, null, 2), "utf8");
  writeFileSync(path.join(TEST_DIR, "replay-summary.json"), JSON.stringify(replaySummary, null, 2), "utf8");

  execFileSync(process.execPath, ["scripts/review-functional-exposure-readiness.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, FUNCTIONAL_SHADOW_CAPTURE_DIR: TEST_DIR },
    stdio: "ignore"
  });
  const first = readFileSync(path.join(TEST_DIR, "exposure-readiness-review.json"), "utf8");
  execFileSync(process.execPath, ["scripts/review-functional-exposure-readiness.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, FUNCTIONAL_SHADOW_CAPTURE_DIR: TEST_DIR },
    stdio: "ignore"
  });
  const second = readFileSync(path.join(TEST_DIR, "exposure-readiness-review.json"), "utf8");

  assert.equal(first, second);
});

runCase("route, evaluator, UI, and runtime CandidatePolicy are not wired to readiness review", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");

  assert.equal(route.includes("functional-exposure-readiness-review"), false);
  assert.equal(evaluator.includes("functional-exposure-readiness-review"), false);
  assert.equal(candidatePolicy.includes("functional-exposure-readiness-review"), false);
  assert.equal(page.includes("functional-exposure-readiness-review"), false);
});
