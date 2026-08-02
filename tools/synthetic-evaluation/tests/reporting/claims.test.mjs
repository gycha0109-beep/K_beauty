import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildCampaignReport,
  createReportReviewSubmission,
  createReportRevisionLink,
  deriveInterpretationClaims,
  verifyCampaignReportIntegrity,
  verifyInterpretationClaimAgainstMetrics,
  verifyReportReviewSubmissionIntegrity,
  verifyReportRevisionLinkIntegrity
} from "../../src/reporting/claims-report.js";
import { buildCampaignReviewPackage } from "../../src/reporting/review-package.js";
import { clone, makeDerivedBundle } from "./helpers.mjs";

const CHECKS = Object.freeze({
  sourceIntegrityReviewed: true,
  denominatorReviewed: true,
  claimsReviewed: true,
  holdsVisible: true,
  contactSheetsReviewed: true
});

async function reviewedFixture() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t8-claims-"));
  const bundle = await makeDerivedBundle({ dataRoot });
  const review = await buildCampaignReviewPackage({ dataRoot, sourceSnapshot: bundle.sourceSnapshot, rows: bundle.rows, artifactIndex: bundle.artifactIndex });
  assert.equal(review.ok, true);
  const submission = createReportReviewSubmission({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewerId: "report_reviewer", checks: CHECKS, reviewedAt: "2026-08-03T01:00:00.000Z" });
  assert.equal(submission.ok, true);
  return { ...bundle, reviewPackage: review.reviewPackage, submission: submission.submission };
}

test("T8 claims are deterministic and source-linked", async () => {
  const bundle = await makeDerivedBundle();
  const result = deriveInterpretationClaims(bundle.metricSet);
  assert.equal(result.ok, true);
  assert.equal(result.claims.length > 20, true);
  assert.equal(result.claims.every((claim) => verifyInterpretationClaimAgainstMetrics(claim, bundle.metricSet)), true);
  assert.equal(result.claims.some((claim) => /better|worse|because|clinical/i.test(claim.statement)), false);
});

test("report review requires explicit human checks", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t8-review-checks-"));
  const bundle = await makeDerivedBundle({ dataRoot });
  const review = await buildCampaignReviewPackage({ dataRoot, sourceSnapshot: bundle.sourceSnapshot, rows: bundle.rows, artifactIndex: bundle.artifactIndex });
  const rejected = createReportReviewSubmission({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewerId: "report_reviewer", checks: { ...CHECKS, holdsVisible: false } });
  assert.equal(rejected.ok, false);
  const accepted = createReportReviewSubmission({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewerId: "report_reviewer", checks: CHECKS, reviewedAt: "2026-08-03T01:00:00.000Z" });
  assert.equal(accepted.ok, true);
  assert.equal(verifyReportReviewSubmissionIntegrity(accepted.submission), true);
});

test("reviewed report is immutable, descriptive, and closeout-time-bound", async () => {
  const fixture = await reviewedFixture();
  const result = buildCampaignReport({ sourceSnapshot: fixture.sourceSnapshot, metricSet: fixture.metricSet, reviewPackage: fixture.reviewPackage, reviewSubmission: fixture.submission });
  assert.equal(result.ok, true);
  assert.equal(result.report.g4TimeBoundary.mode, "as_of_closeout");
  assert.equal(result.report.g4TimeBoundary.currentStatusAppendixIncluded, false);
  assert.equal(verifyCampaignReportIntegrity(result.report, fixture.metricSet), true);

  const tampered = clone(result.report);
  tampered.interpretationClaims[0].statement = "This Provider is better.";
  assert.equal(verifyCampaignReportIntegrity(tampered, fixture.metricSet), false);
});

test("report revision links require the same source lineage and exact predecessor", async () => {
  const fixture = await reviewedFixture();
  const root = buildCampaignReport({ sourceSnapshot: fixture.sourceSnapshot, metricSet: fixture.metricSet, reviewPackage: fixture.reviewPackage, reviewSubmission: fixture.submission });
  const successor = buildCampaignReport({ sourceSnapshot: fixture.sourceSnapshot, metricSet: fixture.metricSet, reviewPackage: fixture.reviewPackage, reviewSubmission: fixture.submission, predecessorReportDigest: root.report.reportDigest });
  assert.equal(successor.ok, true);
  const link = createReportRevisionLink({ predecessorReport: root.report, successorReport: successor.report, reasonCode: "limitation_clarification", linkedAt: "2026-08-03T02:00:00.000Z" });
  assert.equal(link.ok, true);
  assert.equal(verifyReportRevisionLinkIntegrity(link.link), true);

  const wrong = clone(successor.report);
  wrong.predecessorReportDigest = "a".repeat(64);
  assert.equal(createReportRevisionLink({ predecessorReport: root.report, successorReport: wrong, reasonCode: "typo" }).ok, false);
});
