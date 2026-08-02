import assert from "node:assert/strict";
import test from "node:test";
import {
  finalizeRegressionBaselineRequest,
  finalizeRegressionBaselineReview,
  verifyRegressionBaselineReviewIntegrity
} from "../../src/dataset/baseline.js";

test("baseline request binds only immutable external evidence references", () => {
  const result = finalizeRegressionBaselineRequest({
    datasetVersionDigest: "a".repeat(64),
    holdoutG5IndexDigest: "b".repeat(64),
    modelArtifactDigest: "c".repeat(64),
    evaluationHarnessDigest: "d".repeat(64),
    metricContractDigest: "e".repeat(64),
    resultPackageDigest: "f".repeat(64),
    requestedAt: "2026-08-03T05:00:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.equal("score" in result.request, false);
  assert.equal("threshold" in result.request, false);
  assert.equal("holdoutMembers" in result.request, false);
});

test("baseline activation review requires explicit evidence confirmations", () => {
  const request = finalizeRegressionBaselineRequest({
    datasetVersionDigest: "a".repeat(64),
    holdoutG5IndexDigest: "b".repeat(64),
    modelArtifactDigest: "c".repeat(64),
    evaluationHarnessDigest: "d".repeat(64),
    metricContractDigest: "e".repeat(64),
    resultPackageDigest: "f".repeat(64),
    requestedAt: "2026-08-03T05:00:00.000Z"
  }).request;
  const rejected = finalizeRegressionBaselineReview({
    request,
    draft: {
      reviewerId: "reviewer_baseline",
      datasetAndG5CurrentReviewed: true,
      resultPackageIntegrityReviewed: false,
      metricContractReviewed: true,
      decision: "approve",
      completedAt: "2026-08-03T05:10:00.000Z"
    }
  });
  assert.equal(rejected.ok, false);

  const approved = finalizeRegressionBaselineReview({
    request,
    draft: {
      reviewerId: "reviewer_baseline",
      datasetAndG5CurrentReviewed: true,
      resultPackageIntegrityReviewed: true,
      metricContractReviewed: true,
      decision: "approve",
      completedAt: "2026-08-03T05:10:00.000Z"
    }
  });
  assert.equal(approved.ok, true);
  assert.equal(verifyRegressionBaselineReviewIntegrity(approved.review), true);
  const tampered = { ...approved.review, decision: "reject" };
  assert.equal(verifyRegressionBaselineReviewIntegrity(tampered), false);
});
