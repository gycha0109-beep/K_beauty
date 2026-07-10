import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { reviewFunctionalEvaluatorHardBlocks } from "../lib/functional-evaluator-hard-block-review.js";

function row(overrides = {}) {
  return {
    productId: overrides.productId || "product-a",
    category: overrides.category || "treatment",
    exposureStatus: overrides.exposureStatus || "hidden_candidate",
    hardFilterStatus: overrides.hardFilterStatus || "blocked",
    hardFilterReasons: overrides.hardFilterReasons || [
      "recent_instability_active_limited",
      "candidate_evaluator_blocked"
    ],
    guardDecision: overrides.guardDecision || "collapsed_exposure_candidate",
    guardReasons: overrides.guardReasons || [
      "recent_instability_detected",
      "high_sensitivity_detected",
      "active_functional_axis",
      "low_irritation_risk",
      "sensitivity_safe_true"
    ],
    blockedBy: overrides.blockedBy || { evaluator: true, guardHardBlock: false },
    safetyMetadataProfile: overrides.safetyMetadataProfile || "safe_low_risk",
    functionalProfile: overrides.functionalProfile || "mixed",
    rankingGoal: overrides.rankingGoal || "acne",
    safetyGoal: overrides.safetyGoal || "redness",
    recommendationGuard: overrides.recommendationGuard || "stabilize_first",
    safetyContext: overrides.safetyContext || { highSensitivity: true, recentInstability: true },
    irritationRisk: overrides.irritationRisk || "low",
    sensitivitySafe: Object.prototype.hasOwnProperty.call(overrides, "sensitivitySafe")
      ? overrides.sensitivitySafe
      : true,
    activeAxisPresent: Object.prototype.hasOwnProperty.call(overrides, "activeAxisPresent")
      ? overrides.activeAxisPresent
      : true,
    stabilizingAxisPresent: Object.prototype.hasOwnProperty.call(overrides, "stabilizingAxisPresent")
      ? overrides.stabilizingAxisPresent
      : true,
    profileEvaluable: Object.prototype.hasOwnProperty.call(overrides, "profileEvaluable")
      ? overrides.profileEvaluable
      : true,
    cautionTags: overrides.cautionTags || []
  };
}

function fixture({ captureId, confidence = "high", rows = [] }) {
  return {
    captureId,
    comparisonConfidence: confidence,
    sourceStage: "post_score_candidate_pool",
    sourceCount: rows.length,
    rankingContext: { rankingGoal: "acne", safetyGoal: "redness", recommendationGuard: "stabilize_first" },
    candidateReviewRows: rows
  };
}

function sampleAudit() {
  return {
    auditVersion: "functional-candidate-exposure-audit-v1",
    fixtureAudits: [
      fixture({
        captureId: "high-a",
        rows: [
          row({ productId: "a", category: "treatment", functionalProfile: "mixed" }),
          row({ productId: "b", category: "toner_pad", functionalProfile: "stabilizing_leaning" }),
          row({
            productId: "not-target",
            exposureStatus: "collapsed_candidate",
            hardFilterStatus: "pass",
            hardFilterReasons: []
          })
        ]
      }),
      fixture({
        captureId: "high-b",
        rows: [
          row({ productId: "c", category: "moisturizer", functionalProfile: "mixed" }),
          row({ productId: "d", category: "essence", functionalProfile: "stabilizing_leaning" }),
          row({ productId: "e", category: "cleanser", functionalProfile: "mixed" })
        ]
      }),
      fixture({
        captureId: "low-a",
        confidence: "low",
        rows: [
          row({ productId: "low", category: "serum", functionalProfile: "active_leaning" })
        ]
      })
    ]
  };
}

function runCase(name, fn) {
  fn();
  console.log(`ok - ${name}`);
}

const review = reviewFunctionalEvaluatorHardBlocks({
  candidateExposureAudit: sampleAudit(),
  options: { minimumCaseCount: 5, minimumRepeatCount: 2 }
});

runCase("high-confidence rows only are included", () => {
  assert.equal(review.reviewScope.includedFixtureCount, 2);
  assert.equal(review.categoryBreakdown.serum, undefined);
});

runCase("safe_low_risk hidden evaluator blocked cases are selected", () => {
  assert.equal(review.aggregate.reviewedCaseCount, 5);
  assert.equal(review.aggregate.safeLowRiskHiddenCount, 5);
  assert.equal(review.aggregate.recentInstabilityActiveLimitedCount, 5);
  assert.equal(review.aggregate.recentInstabilityActiveLimitedRate, 1);
});

runCase("evaluator and guard hard block are separated", () => {
  assert.equal(review.aggregate.evaluatorOnlyCount, 5);
  assert.equal(review.aggregate.guardOverlapCount, 0);
  assert.equal(review.ruleBreakdown.blockedSource.evaluator_only, 5);
});

runCase("reason, category, functional profile, and safety context breakdowns are exact", () => {
  assert.equal(review.ruleBreakdown.hardFilterReasons.recent_instability_active_limited, 5);
  assert.equal(review.categoryBreakdown.treatment, 1);
  assert.equal(review.categoryBreakdown.toner_pad, 1);
  assert.equal(review.categoryBreakdown.moisturizer, 1);
  assert.equal(review.functionalProfileBreakdown.mixed, 3);
  assert.equal(review.functionalProfileBreakdown.stabilizing_leaning, 2);
  assert.equal(review.safetyContextBreakdown.both, 5);
});

runCase("product-level metadata coverage is summarized without raw product details", () => {
  assert.equal(review.productMetadataCoverage.irritationRiskDistribution.low, 5);
  assert.equal(review.productMetadataCoverage.sensitivitySafeDistribution.true, 5);
  assert.equal(review.productMetadataCoverage.activeAxisDistribution.active_axis_present, 5);
  assert.equal(review.productMetadataCoverage.profileEvaluableDistribution.true, 5);
});

runCase("repeated safe low-risk active hard block becomes possible overblocking, not a runtime change", () => {
  assert.equal(review.policyAssessment.status, "possible_evaluator_overblocking");
  assert.equal(review.policyAssessment.runtimeChangeApproved, false);
});

runCase("sample shortage does not become overblocking conclusion", () => {
  const scarce = reviewFunctionalEvaluatorHardBlocks({
    candidateExposureAudit: sampleAudit(),
    options: { minimumCaseCount: 10, minimumRepeatCount: 2 }
  });

  assert.equal(scarce.policyAssessment.status, "insufficient_evidence");
});

runCase("metadata gaps produce metadata coverage review status", () => {
  const metadataReview = reviewFunctionalEvaluatorHardBlocks({
    candidateExposureAudit: {
      fixtureAudits: [
        fixture({
          captureId: "metadata",
          rows: Array.from({ length: 5 }, (_, index) => row({
            productId: `metadata-${index}`,
            irritationRisk: "unknown",
            sensitivitySafe: null,
            profileEvaluable: false
          }))
        })
      ]
    },
    options: { minimumCaseCount: 5, minimumRepeatCount: 2 }
  });

  assert.equal(metadataReview.policyAssessment.status, "needs_product_metadata_coverage_review");
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

runCase("output is deterministic", () => {
  const second = reviewFunctionalEvaluatorHardBlocks({
    candidateExposureAudit: sampleAudit(),
    options: { minimumCaseCount: 5, minimumRepeatCount: 2 }
  });

  assert.deepEqual(review, second);
});

runCase("runner executes against current artifact", () => {
  const stdout = execFileSync(process.execPath, ["scripts/review-functional-evaluator-hard-blocks.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8"
  });

  assert.ok(stdout.includes("functional-evaluator-hard-block-review summary"));
});

runCase("route, evaluator, UI, and CandidatePolicy runtime remain unconnected", () => {
  const route = readFileSync("app/api/analyze/route.js", "utf8");
  const evaluator = readFileSync("lib/functional-ranking-contract.js", "utf8");
  const candidatePolicy = readFileSync("lib/functional-candidate-policy.js", "utf8");
  const page = readFileSync("app/page.js", "utf8");

  assert.equal(route.includes("functional-evaluator-hard-block-review"), false);
  assert.equal(evaluator.includes("functional-evaluator-hard-block-review"), false);
  assert.equal(candidatePolicy.includes("functional-evaluator-hard-block-review"), false);
  assert.equal(page.includes("functional-evaluator-hard-block-review"), false);
});
