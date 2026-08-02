import assert from "node:assert/strict";
import { access, mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCampaignReviewPackage } from "../../src/reporting/review-package.js";
import { buildCampaignReport, createReportReviewSubmission, createReportRevisionLink } from "../../src/reporting/claims-report.js";
import { buildExportFiles } from "../../src/reporting/render.js";
import { publishExport, saveReviewArtifacts, saveReviewedReport } from "../../src/reporting/storage.js";
import { makeDerivedBundle } from "./helpers.mjs";

const CHECKS = {
  sourceIntegrityReviewed: true,
  denominatorReviewed: true,
  claimsReviewed: true,
  holdsVisible: true,
  contactSheetsReviewed: true
};

async function fixture() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t8-storage-"));
  const bundle = await makeDerivedBundle({ dataRoot });
  const review = await buildCampaignReviewPackage({ dataRoot, sourceSnapshot: bundle.sourceSnapshot, rows: bundle.rows, artifactIndex: bundle.artifactIndex });
  assert.equal(review.ok, true);
  const reviewed = createReportReviewSubmission({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewerId: "report_reviewer", checks: CHECKS, reviewedAt: "2026-08-03T01:00:00.000Z" });
  assert.equal(reviewed.ok, true);
  const report = buildCampaignReport({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewSubmission: reviewed.submission });
  assert.equal(report.ok, true);
  return { dataRoot, ...bundle, ...review, reviewed: reviewed.submission, report: report.report };
}

test("review artifacts, report, and export are immutable and idempotent", async () => {
  const value = await fixture();
  const firstReview = await saveReviewArtifacts({ dataRoot: value.dataRoot, sourceSnapshot: value.sourceSnapshot, artifactIndex: value.artifactIndex, rows: value.rows, metricSet: value.metricSet, reviewPackage: value.reviewPackage, thumbnails: value.thumbnails, reviewFiles: value.files });
  const secondReview = await saveReviewArtifacts({ dataRoot: value.dataRoot, sourceSnapshot: value.sourceSnapshot, artifactIndex: value.artifactIndex, rows: value.rows, metricSet: value.metricSet, reviewPackage: value.reviewPackage, thumbnails: value.thumbnails, reviewFiles: value.files });
  assert.equal(firstReview.createdCount > 0, true);
  assert.equal(secondReview.createdCount, 0);

  const firstReport = await saveReviewedReport({ dataRoot: value.dataRoot, report: value.report, reviewSubmission: value.reviewed });
  const secondReport = await saveReviewedReport({ dataRoot: value.dataRoot, report: value.report, reviewSubmission: value.reviewed });
  assert.equal(firstReport.createdCount > 0, true);
  assert.equal(secondReport.createdCount, 0);

  const rendered = buildExportFiles({ sourceSnapshot: value.sourceSnapshot, artifactIndex: value.artifactIndex, rows: value.rows, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewFiles: value.files, report: value.report, generatedAt: "2026-08-03T02:00:00.000Z" });
  assert.equal(rendered.ok, true);
  const firstExport = await publishExport({ dataRoot: value.dataRoot, files: rendered.files, exportManifest: rendered.exportManifest });
  const secondExport = await publishExport({ dataRoot: value.dataRoot, files: rendered.files, exportManifest: rendered.exportManifest });
  assert.equal(firstExport.state, "published");
  assert.equal(secondExport.state, "existing");
  const manifestPath = path.join(value.dataRoot, firstExport.outputRelativePath, "manifest.json");
  await access(manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(manifest.exportDigest, rendered.exportManifest.exportDigest);
});

test("one predecessor report can have only one immutable successor", async () => {
  const value = await fixture();
  await saveReviewArtifacts({ dataRoot: value.dataRoot, sourceSnapshot: value.sourceSnapshot, artifactIndex: value.artifactIndex, rows: value.rows, metricSet: value.metricSet, reviewPackage: value.reviewPackage, thumbnails: value.thumbnails, reviewFiles: value.files });
  await saveReviewedReport({ dataRoot: value.dataRoot, report: value.report, reviewSubmission: value.reviewed });

  const reviewA = createReportReviewSubmission({ sourceSnapshot: value.sourceSnapshot, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewerId: "report_reviewer_a", checks: CHECKS, reviewedAt: "2026-08-03T03:00:00.000Z" }).submission;
  const reportA = buildCampaignReport({ sourceSnapshot: value.sourceSnapshot, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewSubmission: reviewA, predecessorReportDigest: value.report.reportDigest }).report;
  const linkA = createReportRevisionLink({ predecessorReport: value.report, successorReport: reportA, reasonCode: "typo", linkedAt: "2026-08-03T03:00:00.000Z" }).link;
  await saveReviewedReport({ dataRoot: value.dataRoot, report: reportA, reviewSubmission: reviewA, revisionLink: linkA });

  const reviewB = createReportReviewSubmission({ sourceSnapshot: value.sourceSnapshot, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewerId: "report_reviewer_b", checks: CHECKS, reviewedAt: "2026-08-03T04:00:00.000Z" }).submission;
  const reportB = buildCampaignReport({ sourceSnapshot: value.sourceSnapshot, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewSubmission: reviewB, predecessorReportDigest: value.report.reportDigest }).report;
  const linkB = createReportRevisionLink({ predecessorReport: value.report, successorReport: reportB, reasonCode: "limitation_clarification", linkedAt: "2026-08-03T04:00:00.000Z" }).link;
  await assert.rejects(saveReviewedReport({ dataRoot: value.dataRoot, report: reportB, reviewSubmission: reviewB, revisionLink: linkB }), (error) => error?.code === "immutable_report_artifact_conflict");
});
