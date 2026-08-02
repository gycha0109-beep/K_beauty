import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { preflightCampaignReportSource } from "./source-preflight.js";
import { buildProviderComparisonKey } from "./comparison.js";
import {
  buildCampaignEvidenceSnapshot,
  deriveCampaignMetricSet,
  deriveCampaignSlotRows,
  verifyCampaignEvidenceSnapshotIntegrity,
  verifyCampaignMetricSetIntegrity
} from "./derive.js";
import { buildCampaignReviewPackage, verifyCampaignReviewPackageIntegrity } from "./review-package.js";
import {
  buildCampaignReport,
  createReportRevisionLink,
  createReportReviewSubmission,
  verifyCampaignReportIntegrity
} from "./claims-report.js";
import { buildExportFiles } from "./render.js";
import {
  publishExport,
  reportingStorageLayout,
  saveReviewArtifacts,
  saveReviewedReport,
  withReportWriterClaim
} from "./storage.js";

function failure(code, pathName, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) });
}

async function preflightSources({ dataRoot, campaignRunIds, closeoutDigests = [] }) {
  if (!Array.isArray(campaignRunIds) || ![1,2].includes(campaignRunIds.length) || new Set(campaignRunIds).size !== campaignRunIds.length) return failure("report_not_ready", "campaignRunIds");
  const sources = [];
  for (let index = 0; index < campaignRunIds.length; index += 1) {
    const result = await preflightCampaignReportSource({ dataRoot, campaignRunId: campaignRunIds[index], closeoutDigest: closeoutDigests[index] || null });
    if (!result.ok) return result;
    sources.push(result.source);
  }
  return Object.freeze({ ok: true, sources });
}

export async function preflightCampaignReport({ dataRoot, campaignRunIds, closeoutDigests = [], capturedAt = new Date().toISOString() }) {
  const sourceResult = await preflightSources({ dataRoot, campaignRunIds, closeoutDigests });
  if (!sourceResult.ok) return sourceResult;
  let comparisonKey = null;
  if (sourceResult.sources.length === 2) {
    const compared = buildProviderComparisonKey(sourceResult.sources[0], sourceResult.sources[1]);
    if (!compared.ok) return compared;
    comparisonKey = compared.comparisonKey;
  }
  const rowGroups = [];
  for (const source of sourceResult.sources) {
    const derived = deriveCampaignSlotRows(source);
    if (!derived.ok) return derived;
    rowGroups.push(...derived.rows);
  }
  rowGroups.sort((left, right) => `${left.campaignRunId}:${left.conditionId}:${left.conditionOrdinal}:${left.slotId}`.localeCompare(`${right.campaignRunId}:${right.conditionId}:${right.conditionOrdinal}:${right.slotId}`));
  const snapshotResult = buildCampaignEvidenceSnapshot({ sources: sourceResult.sources, rows: rowGroups, comparisonKey, capturedAt });
  if (!snapshotResult.ok) return snapshotResult;
  const metrics = deriveCampaignMetricSet({ sourceSnapshot: snapshotResult.snapshot, rows: rowGroups });
  if (!metrics.ok) return metrics;
  return Object.freeze({
    ok: true,
    sources: sourceResult.sources,
    sourceSnapshot: snapshotResult.snapshot,
    artifactIndex: snapshotResult.artifactIndex,
    rows: rowGroups,
    metricSet: metrics.metricSet,
    comparisonKey,
    writesPerformed: 0
  });
}

function scopeId(runIds) {
  return runIds.length === 1 ? runIds[0] : `comparison-${runIds.slice().sort().join("-")}`;
}

export async function buildAndStoreCampaignReviewPackage({ dataRoot, campaignRunIds, closeoutDigests = [], actorId = "report_operator" }) {
  return withReportWriterClaim(dataRoot, scopeId(campaignRunIds), actorId, "build-review-package", async () => {
    const prepared = await preflightCampaignReport({ dataRoot, campaignRunIds, closeoutDigests });
    if (!prepared.ok) return prepared;
    const review = await buildCampaignReviewPackage({ dataRoot, sourceSnapshot: prepared.sourceSnapshot, rows: prepared.rows, artifactIndex: prepared.artifactIndex });
    if (!review.ok) return review;
    const stored = await saveReviewArtifacts({
      dataRoot,
      sourceSnapshot: prepared.sourceSnapshot,
      artifactIndex: prepared.artifactIndex,
      rows: prepared.rows,
      metricSet: prepared.metricSet,
      reviewPackage: review.reviewPackage,
      thumbnails: review.thumbnails,
      reviewFiles: review.files
    });
    return Object.freeze({ ok: true, ...prepared, reviewPackage: review.reviewPackage, thumbnails: review.thumbnails, reviewFiles: review.files, writesPerformed: stored.createdCount });
  });
}

async function readJsonObject(dataRoot, type, digest) {
  const root = reportingStorageLayout.reportsRoot(dataRoot);
  const objectPath = reportingStorageLayout.objectPath(type, digest);
  return JSON.parse(await readFile(reportingStorageLayout.contained(root, objectPath), "utf8"));
}

async function readReviewFiles(dataRoot, packageDigest) {
  const root = reportingStorageLayout.reportsRoot(dataRoot);
  const assetRoot = reportingStorageLayout.contained(root, `objects/review-assets/${packageDigest}`);
  const files = new Map();
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const item of entries) {
      if (item.isSymbolicLink()) throw Object.assign(new Error("report_path_symlink_forbidden"), { code: "report_path_symlink_forbidden" });
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) await walk(absolute);
      else if (item.isFile()) files.set(path.relative(assetRoot, absolute).split(path.sep).join("/"), await readFile(absolute));
    }
  }
  await walk(assetRoot);
  return files;
}

export async function confirmCampaignReport({
  dataRoot,
  campaignRunIds,
  closeoutDigests = [],
  reviewerId,
  reviewedAt = new Date().toISOString(),
  predecessorReportDigest = null,
  revisionReasonCode = null,
  actorId = "report_operator"
}) {
  return withReportWriterClaim(dataRoot, scopeId(campaignRunIds), actorId, "confirm-report", async () => {
    const prepared = await preflightCampaignReport({ dataRoot, campaignRunIds, closeoutDigests });
    if (!prepared.ok) return prepared;
    const review = await buildCampaignReviewPackage({ dataRoot, sourceSnapshot: prepared.sourceSnapshot, rows: prepared.rows, artifactIndex: prepared.artifactIndex });
    if (!review.ok) return review;
    await saveReviewArtifacts({ dataRoot, sourceSnapshot: prepared.sourceSnapshot, artifactIndex: prepared.artifactIndex, rows: prepared.rows, metricSet: prepared.metricSet, reviewPackage: review.reviewPackage, thumbnails: review.thumbnails, reviewFiles: review.files });
    const reviewed = createReportReviewSubmission({ sourceSnapshot: prepared.sourceSnapshot, metricSet: prepared.metricSet, reviewPackage: review.reviewPackage, reviewerId, reviewedAt });
    if (!reviewed.ok) return reviewed;
    const built = buildCampaignReport({ sourceSnapshot: prepared.sourceSnapshot, metricSet: prepared.metricSet, reviewPackage: review.reviewPackage, reviewSubmission: reviewed.submission, predecessorReportDigest });
    if (!built.ok) return built;
    let revisionLink = null;
    if (predecessorReportDigest) {
      let predecessor;
      try { predecessor = await readJsonObject(dataRoot, "reports", predecessorReportDigest); }
      catch { return failure("report_revision_link_invalid", "predecessorReportDigest", "missing"); }
      const linked = createReportRevisionLink({ predecessorReport: predecessor, successorReport: built.report, reasonCode: revisionReasonCode, linkedAt: reviewedAt });
      if (!linked.ok) return linked;
      revisionLink = linked.link;
    } else if (revisionReasonCode !== null) return failure("report_revision_link_invalid", "revisionReasonCode", "root_report_has_no_revision_reason");
    const stored = await saveReviewedReport({ dataRoot, report: built.report, reviewSubmission: reviewed.submission, revisionLink });
    return Object.freeze({ ok: true, state: stored.createdCount > 0 ? "registered" : "existing", report: stored.report, reviewSubmission: reviewed.submission, reviewPackage: review.reviewPackage, metricSet: prepared.metricSet, sourceSnapshot: prepared.sourceSnapshot, revisionLink, writesPerformed: stored.createdCount });
  });
}

export async function exportCampaignReport({ dataRoot, reportDigest, generatedAt = new Date().toISOString(), actorId = "report_operator" }) {
  if (!/^[a-f0-9]{64}$/.test(reportDigest || "")) return failure("campaign_export_invalid", "reportDigest");
  return withReportWriterClaim(dataRoot, `report-${reportDigest.slice(0, 24)}`, actorId, "publish-export", async () => {
    let report;
    let sourceSnapshot;
    let metricSet;
    let reviewPackage;
    let indexObject;
    let slotObject;
    try {
      report = await readJsonObject(dataRoot, "reports", reportDigest);
      if (!verifyCampaignReportIntegrity(report)) return failure("campaign_export_invalid", "report");
      sourceSnapshot = await readJsonObject(dataRoot, "source-snapshots", report.sourceSnapshotDigest);
      metricSet = await readJsonObject(dataRoot, "metric-sets", report.metricSetDigest);
      reviewPackage = await readJsonObject(dataRoot, "review-packages", report.reviewPackageDigest);
      indexObject = await readJsonObject(dataRoot, "artifact-indexes", sourceSnapshot.artifactIndexDigest);
      slotObject = await readJsonObject(dataRoot, "slot-tables", sourceSnapshot.slotEvidenceDigest);
    } catch (error) {
      return failure(error?.code || "source_artifact_missing", "reportBundle");
    }
    if (!verifyCampaignEvidenceSnapshotIntegrity(sourceSnapshot) || !verifyCampaignMetricSetIntegrity(metricSet) || !verifyCampaignReviewPackageIntegrity(reviewPackage) || !verifyCampaignReportIntegrity(report, metricSet) || indexObject.artifactIndexDigest !== sourceSnapshot.artifactIndexDigest || slotObject.slotEvidenceDigest !== sourceSnapshot.slotEvidenceDigest) return failure("campaign_export_invalid", "reportBundle", "integrity");
    const reviewFiles = await readReviewFiles(dataRoot, reviewPackage.packageDigest);
    const rendered = buildExportFiles({ sourceSnapshot, artifactIndex: indexObject.entries, rows: slotObject.rows, metricSet, reviewPackage, reviewFiles, report, generatedAt });
    if (!rendered.ok) return rendered;
    const published = await publishExport({ dataRoot, files: rendered.files, exportManifest: rendered.exportManifest });
    return Object.freeze({ ok: true, ...published });
  });
}
