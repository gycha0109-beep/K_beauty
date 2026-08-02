import { lstat, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyCampaignEvidenceSnapshotIntegrity, verifyCampaignMetricSetIntegrity } from "./derive.js";
import { verifyCampaignReviewPackageIntegrity } from "./review-package.js";
import { verifyCampaignReportIntegrity, verifyReportReviewSubmissionIntegrity, verifyReportRevisionLinkIntegrity } from "./claims-report.js";
import { verifyCampaignExportManifestIntegrity } from "./render.js";

const TOKEN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;

function reportsRoot(dataRoot) {
  return path.join(dataRoot, "reports");
}

function contained(root, relativePath) {
  if (!SAFE_RELATIVE_PATH.test(relativePath || "")) throw Object.assign(new Error("report_path_invalid"), { code: "report_path_invalid" });
  const absolute = path.join(root, ...relativePath.split("/"));
  const relative = path.relative(root, absolute);
  if (relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative)) throw Object.assign(new Error("report_path_invalid"), { code: "report_path_invalid" });
  return absolute;
}

async function assertNoSymlinkComponents(root, target) {
  const relative = path.relative(root, target);
  const parts = relative.split(path.sep).filter(Boolean);
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) throw Object.assign(new Error("report_path_symlink_forbidden"), { code: "report_path_symlink_forbidden" });
      if (!stat.isDirectory()) throw Object.assign(new Error("report_path_invalid"), { code: "report_path_invalid" });
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      break;
    }
  }
}

async function writeExclusiveBytes(root, relativePath, bytes) {
  const absolute = contained(root, relativePath);
  await assertNoSymlinkComponents(root, absolute);
  await mkdir(path.dirname(absolute), { recursive: true });
  try {
    const handle = await open(absolute, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return Object.freeze({ created: true, absolutePath: absolute });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = await readFile(absolute);
    if (!existing.equals(bytes)) throw Object.assign(new Error("immutable_report_artifact_conflict"), { code: "immutable_report_artifact_conflict" });
    return Object.freeze({ created: false, absolutePath: absolute });
  }
}

async function writeSemanticJson(root, relativePath, value, verify, digestKey) {
  const bytes = Buffer.from(`${stableStringify(value)}\n`, "utf8");
  const absolute = contained(root, relativePath);
  await assertNoSymlinkComponents(root, absolute);
  await mkdir(path.dirname(absolute), { recursive: true });
  try {
    const handle = await open(absolute, "wx", 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return Object.freeze({ created: true, value, relativePath });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try {
      existing = JSON.parse(await readFile(absolute, "utf8"));
    } catch {
      throw Object.assign(new Error("immutable_report_artifact_conflict"), { code: "immutable_report_artifact_conflict" });
    }
    if (!verify(existing) || existing[digestKey] !== value[digestKey]) throw Object.assign(new Error("immutable_report_artifact_conflict"), { code: "immutable_report_artifact_conflict" });
    return Object.freeze({ created: false, value: existing, relativePath });
  }
}

function objectPath(type, digest) {
  return `objects/${type}/${digest.slice(0, 2)}/${digest}.json`;
}

export async function saveReviewArtifacts({ dataRoot, sourceSnapshot, artifactIndex, rows, metricSet, reviewPackage, thumbnails, reviewFiles }) {
  const root = reportsRoot(dataRoot);
  if (!verifyCampaignEvidenceSnapshotIntegrity(sourceSnapshot) || !verifyCampaignMetricSetIntegrity(metricSet) || !verifyCampaignReviewPackageIntegrity(reviewPackage)) throw Object.assign(new Error("report_bundle_invalid"), { code: "report_bundle_invalid" });
  const writes = [];
  writes.push(await writeSemanticJson(root, objectPath("source-snapshots", sourceSnapshot.sourceSnapshotDigest), sourceSnapshot, verifyCampaignEvidenceSnapshotIntegrity, "sourceSnapshotDigest"));
  const indexObject = { schemaVersion: "campaign-artifact-index-v1", sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest, entries: artifactIndex, artifactIndexDigest: sourceSnapshot.artifactIndexDigest };
  writes.push(await writeSemanticJson(root, objectPath("artifact-indexes", sourceSnapshot.artifactIndexDigest), indexObject, (value) => value?.artifactIndexDigest === sha256Hex(stableStringify(value.entries)) && value.sourceSnapshotDigest === sourceSnapshot.sourceSnapshotDigest, "artifactIndexDigest"));
  const slotObject = { schemaVersion: "campaign-slot-table-v1", sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest, rows, slotEvidenceDigest: sourceSnapshot.slotEvidenceDigest };
  writes.push(await writeSemanticJson(root, objectPath("slot-tables", sourceSnapshot.slotEvidenceDigest), slotObject, (value) => value?.slotEvidenceDigest === sha256Hex(stableStringify(value.rows)) && value.sourceSnapshotDigest === sourceSnapshot.sourceSnapshotDigest, "slotEvidenceDigest"));
  writes.push(await writeSemanticJson(root, objectPath("metric-sets", metricSet.metricSetDigest), metricSet, verifyCampaignMetricSetIntegrity, "metricSetDigest"));
  writes.push(await writeSemanticJson(root, objectPath("review-packages", reviewPackage.packageDigest), reviewPackage, verifyCampaignReviewPackageIntegrity, "packageDigest"));
  for (const thumbnail of thumbnails) {
    const bytes = reviewFiles.get(thumbnail.relativePath);
    if (!bytes || sha256Hex(bytes) !== thumbnail.sha256) throw Object.assign(new Error("report_thumbnail_invalid"), { code: "report_thumbnail_invalid" });
    writes.push(await writeExclusiveBytes(root, `objects/review-assets/${reviewPackage.packageDigest}/${thumbnail.relativePath}`, bytes));
  }
  for (const relativePath of ["review/blind-contact-sheet.html", "review/annotated-contact-sheet.html"]) {
    const bytes = reviewFiles.get(relativePath);
    if (!bytes) throw Object.assign(new Error("report_review_package_invalid"), { code: "report_review_package_invalid" });
    writes.push(await writeExclusiveBytes(root, `objects/review-assets/${reviewPackage.packageDigest}/${relativePath}`, bytes));
  }
  return Object.freeze({ createdCount: writes.filter((item) => item.created).length });
}

export async function saveReviewedReport({ dataRoot, report, reviewSubmission, revisionLink = null }) {
  const root = reportsRoot(dataRoot);
  if (!verifyCampaignReportIntegrity(report) || !verifyReportReviewSubmissionIntegrity(reviewSubmission) || report.reportReviewDigest !== reviewSubmission.submissionDigest) throw Object.assign(new Error("report_bundle_invalid"), { code: "report_bundle_invalid" });
  if (revisionLink && !verifyReportRevisionLinkIntegrity(revisionLink)) throw Object.assign(new Error("report_revision_link_invalid"), { code: "report_revision_link_invalid" });
  const writes = [];
  writes.push(await writeSemanticJson(root, objectPath("report-reviews", reviewSubmission.submissionDigest), reviewSubmission, verifyReportReviewSubmissionIntegrity, "submissionDigest"));
  writes.push(await writeSemanticJson(root, objectPath("reports", report.reportDigest), report, verifyCampaignReportIntegrity, "reportDigest"));
  if (revisionLink) writes.push(await writeSemanticJson(root, objectPath("revision-links", revisionLink.linkDigest), revisionLink, verifyReportRevisionLinkIntegrity, "linkDigest"));
  const rootManifest = {
    schemaVersion: "campaign-report-root-v1",
    sourceSnapshotDigest: report.sourceSnapshotDigest,
    reportDigest: report.reportDigest,
    predecessorReportDigest: report.predecessorReportDigest,
    reportReviewDigest: reviewSubmission.submissionDigest,
    revisionLinkDigest: revisionLink?.linkDigest || null
  };
  rootManifest.rootDigest = sha256Hex(stableStringify(rootManifest));
  for (const runId of report.scope.campaignRunIds) writes.push(await writeSemanticJson(root, `runs/${runId}/report-roots/${report.reportDigest}.json`, rootManifest, (value) => {
    const { rootDigest, ...semantic } = value;
    return rootDigest === sha256Hex(stableStringify(semantic));
  }, "rootDigest"));
  return Object.freeze({ createdCount: writes.filter((item) => item.created).length, report });
}

export async function publishExport({ dataRoot, files, exportManifest }) {
  if (!verifyCampaignExportManifestIntegrity(exportManifest)) throw Object.assign(new Error("campaign_export_manifest_invalid"), { code: "campaign_export_manifest_invalid" });
  const root = reportsRoot(dataRoot);
  const operationId = `export-${exportManifest.exportDigest.slice(0, 24)}`;
  const staging = contained(root, `staging/${operationId}`);
  const final = contained(root, `exports/${exportManifest.exportDigest}`);
  await assertNoSymlinkComponents(root, staging);
  await rm(staging, { recursive: true, force: true });
  await mkdir(staging, { recursive: false });
  try {
    for (const descriptor of exportManifest.files) {
      const file = files.get(descriptor.relativePath);
      if (!file || sha256Hex(file.bytes) !== descriptor.sha256 || file.bytes.length !== descriptor.byteLength) throw Object.assign(new Error("campaign_export_file_invalid"), { code: "campaign_export_file_invalid" });
      const target = contained(staging, descriptor.relativePath);
      await assertNoSymlinkComponents(staging, target);
      await mkdir(path.dirname(target), { recursive: true });
      const handle = await open(target, "wx", 0o600);
      try { await handle.writeFile(file.bytes); await handle.sync(); } finally { await handle.close(); }
    }
    try {
      await rename(staging, final);
    } catch (error) {
      if (error?.code !== "EEXIST" && error?.code !== "ENOTEMPTY") throw error;
      await rm(staging, { recursive: true, force: true });
      const existingManifestPath = path.join(final, "manifest.json");
      const existing = JSON.parse(await readFile(existingManifestPath, "utf8"));
      if (!verifyCampaignExportManifestIntegrity(existing) || existing.exportDigest !== exportManifest.exportDigest) throw Object.assign(new Error("immutable_report_artifact_conflict"), { code: "immutable_report_artifact_conflict" });
      return Object.freeze({ state: "existing", exportManifest: existing, outputRelativePath: `reports/exports/${exportManifest.exportDigest}`, writesPerformed: 0 });
    }
    const manifestBytes = Buffer.from(`${stableStringify(exportManifest)}\n`, "utf8");
    await writeExclusiveBytes(final, "manifest.json", manifestBytes);
    return Object.freeze({ state: "published", exportManifest, outputRelativePath: `reports/exports/${exportManifest.exportDigest}`, writesPerformed: exportManifest.files.length + 1 });
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

export async function withReportWriterClaim(dataRoot, scopeId, actorId, operation, fn) {
  if (!TOKEN.test(scopeId || "") || !TOKEN.test(actorId || "") || !TOKEN.test(operation || "")) throw Object.assign(new Error("report_writer_claim_invalid"), { code: "report_writer_claim_invalid" });
  const root = reportsRoot(dataRoot);
  const claimPath = contained(root, `claims/${scopeId}.lock`);
  await assertNoSymlinkComponents(root, claimPath);
  await mkdir(path.dirname(claimPath), { recursive: true });
  const claim = { schemaVersion: "report-writer-claim-v1", scopeId, actorId, operation, claimedAt: new Date().toISOString() };
  claim.claimDigest = sha256Hex(stableStringify(claim));
  let handle;
  try {
    handle = await open(claimPath, "wx", 0o600);
    await handle.writeFile(`${stableStringify(claim)}\n`, "utf8");
    await handle.sync();
  } catch (error) {
    await handle?.close();
    if (error?.code === "EEXIST") throw Object.assign(new Error("report_writer_claim_exists"), { code: "report_writer_claim_exists" });
    throw error;
  }
  await handle.close();
  try {
    return await fn(claim);
  } finally {
    await rm(claimPath, { force: true });
  }
}

export const reportingStorageLayout = Object.freeze({ reportsRoot, objectPath, contained });
