import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildCampaignReviewPackage, verifyCampaignReviewPackageIntegrity } from "../../src/reporting/review-package.js";
import { buildExportFiles, csvInternals, verifyCampaignExportManifestIntegrity } from "../../src/reporting/render.js";
import { buildCampaignReport, createReportReviewSubmission } from "../../src/reporting/claims-report.js";
import { makeDerivedBundle } from "./helpers.mjs";

const CHECKS = {
  sourceIntegrityReviewed: true,
  denominatorReviewed: true,
  claimsReviewed: true,
  holdsVisible: true,
  contactSheetsReviewed: true
};

async function fixture() {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t8-render-"));
  const bundle = await makeDerivedBundle({ dataRoot, withCandidates: true });
  const review = await buildCampaignReviewPackage({ dataRoot, sourceSnapshot: bundle.sourceSnapshot, rows: bundle.rows, artifactIndex: bundle.artifactIndex });
  assert.equal(review.ok, true);
  const reviewed = createReportReviewSubmission({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewerId: "report_reviewer", checks: CHECKS, reviewedAt: "2026-08-03T01:00:00.000Z" });
  const report = buildCampaignReport({ sourceSnapshot: bundle.sourceSnapshot, metricSet: bundle.metricSet, reviewPackage: review.reviewPackage, reviewSubmission: reviewed.submission });
  return { dataRoot, ...bundle, ...review, report: report.report };
}

test("blind sheet hides condition, outcomes, and cross-reference identifiers", async () => {
  const value = await fixture();
  assert.equal(verifyCampaignReviewPackageIntegrity(value.reviewPackage), true);
  const blind = value.files.get("review/blind-contact-sheet.html").toString("utf8");
  const annotated = value.files.get("review/annotated-contact-sheet.html").toString("utf8");
  assert.doesNotMatch(blind, /condition [ABCD]|terminal (?:promoted|promotion|observation|cancelled|generation|judgment|candidate)/i);
  assert.doesNotMatch(blind, /skin-control|redness|blemish|intent-alignment/i);
  assert.doesNotMatch(blind, /crun_[a-f0-9]{24}|slot_[a-f0-9]{24}|cand_[a-f0-9]{24}/i);
  assert.match(blind, /blind_[a-f0-9]{24}/i);
  assert.match(annotated, /condition [ABCD]/);
  assert.match(annotated, /terminal/);
  assert.match(annotated, /warnings:/);
  assert.equal(value.thumbnails.length > 0, true);
  assert.equal(value.thumbnails.every((thumbnail) => thumbnail.transformPolicyId === "t8-thumbnail-display-v1"), true);
  assert.equal(value.thumbnails.every((thumbnail) => thumbnail.blindRelativePath.includes(thumbnail.blindReviewItemId)), true);
  for (const thumbnail of value.thumbnails) {
    assert.match(blind, new RegExp(`src="blind-thumbnails/${thumbnail.blindReviewItemId}\\.png"`));
    assert.match(annotated, new RegExp(`src="annotated-thumbnails/${thumbnail.campaignRunId}-${thumbnail.slotId}\\.png"`));
    assert.equal(value.files.has(thumbnail.blindRelativePath), true);
    assert.equal(value.files.has(thumbnail.annotatedRelativePath), true);
  }
});

test("T8 JSON CSV and HTML rendering is deterministic and internal-only", async () => {
  const value = await fixture();
  const first = buildExportFiles({ sourceSnapshot: value.sourceSnapshot, artifactIndex: value.artifactIndex, rows: value.rows, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewFiles: value.files, report: value.report, generatedAt: "2026-08-03T02:00:00.000Z" });
  const second = buildExportFiles({ sourceSnapshot: value.sourceSnapshot, artifactIndex: value.artifactIndex, rows: value.rows, metricSet: value.metricSet, reviewPackage: value.reviewPackage, reviewFiles: value.files, report: value.report, generatedAt: "2026-08-04T02:00:00.000Z" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.exportManifest.exportDigest, second.exportManifest.exportDigest);
  assert.equal(first.exportManifest.audience, "internal_review");
  assert.equal(verifyCampaignExportManifestIntegrity(first.exportManifest), true);
  assert.equal(first.files.has("report/report.html"), true);
  assert.equal(first.files.has("slots.csv"), true);
  assert.equal([...first.files.keys()].some((name) => /canonical.*\.png/i.test(name)), false);

  const csv = first.files.get("slots.csv").bytes;
  assert.equal(csv[0] === 0xef && csv[1] === 0xbb && csv[2] === 0xbf, false);
  assert.equal(csv.toString("utf8").includes("\r\n"), false);
  assert.equal(csv.toString("utf8").endsWith("\n"), true);
});

test("CSV canonicalization quotes commas, quotes, and newlines", () => {
  const bytes = csvInternals.csvBytes(["a", "b"], [{ a: "x,y", b: "a\"b\nc" }]);
  assert.equal(bytes.toString("utf8"), 'a,b\n"x,y","a""b\nc"\n');
});
