#!/usr/bin/env node
import {
  buildAndStoreCampaignReviewPackage,
  confirmCampaignReport,
  preflightCampaignReport
} from "../orchestrator.js";
import { fail, parseArgs, print, readRequest, resolveDataRoot } from "./helpers.js";

function parseRuns(args) {
  const single = args.values.get("--campaign-run");
  const comparison = args.values.get("--compare");
  if (Boolean(single) === Boolean(comparison)) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const runs = single ? [single] : comparison.split(",").map((item) => item.trim()).filter(Boolean);
  if (![1,2].includes(runs.length) || new Set(runs).size !== runs.length) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  const closeouts = (args.values.get("--closeout-digests") || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (closeouts.length && closeouts.length !== runs.length) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  return { runs, closeouts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dataRoot = resolveDataRoot();
  const { runs, closeouts } = parseRuns(args);
  const actions = ["--source-preflight", "--build-review-package", "--confirm"].filter((flag) => args.flags.has(flag));
  if (actions.length !== 1) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
  let result;
  if (actions[0] === "--source-preflight") {
    result = await preflightCampaignReport({ dataRoot, campaignRunIds: runs, closeoutDigests: closeouts });
    if (result.ok) result = { ok: true, sourceSnapshotDigest: result.sourceSnapshot.sourceSnapshotDigest, artifactIndexDigest: result.sourceSnapshot.artifactIndexDigest, slotEvidenceDigest: result.sourceSnapshot.slotEvidenceDigest, metricSetDigest: result.metricSet.metricSetDigest, reportScope: result.sourceSnapshot.reportScope, writesPerformed: 0 };
  } else if (actions[0] === "--build-review-package") {
    result = await buildAndStoreCampaignReviewPackage({ dataRoot, campaignRunIds: runs, closeoutDigests: closeouts, actorId: args.values.get("--actor") || "report_operator" });
    if (result.ok) result = { ok: true, sourceSnapshotDigest: result.sourceSnapshot.sourceSnapshotDigest, metricSetDigest: result.metricSet.metricSetDigest, reviewPackageDigest: result.reviewPackage.packageDigest, thumbnailCount: result.thumbnails.length, writesPerformed: result.writesPerformed };
  } else {
    const reviewPath = args.values.get("--review");
    if (!reviewPath) throw Object.assign(new Error("cli_argument_invalid"), { code: "cli_argument_invalid" });
    const review = await readRequest(dataRoot, reviewPath);
    const allowed = ["reviewerId", "checks", "reviewedAt", "predecessorReportDigest", "revisionReasonCode"].sort();
    if (!review || typeof review !== "object" || Array.isArray(review) || Object.keys(review).sort().join(",") !== allowed.join(",")) throw Object.assign(new Error("request_file_invalid"), { code: "request_file_invalid" });
    result = await confirmCampaignReport({
      dataRoot,
      campaignRunIds: runs,
      closeoutDigests: closeouts,
      reviewerId: review.reviewerId,
      reviewChecks: review.checks,
      reviewedAt: review.reviewedAt,
      predecessorReportDigest: review.predecessorReportDigest,
      revisionReasonCode: review.revisionReasonCode,
      actorId: args.values.get("--actor") || "report_operator"
    });
    if (result.ok) result = { ok: true, state: result.state, reportDigest: result.report.reportDigest, sourceSnapshotDigest: result.report.sourceSnapshotDigest, metricSetDigest: result.report.metricSetDigest, reportReviewDigest: result.report.reportReviewDigest, writesPerformed: result.writesPerformed };
  }
  print(result);
  if (!result.ok) process.exitCode = 1;
}

main().catch(fail);
