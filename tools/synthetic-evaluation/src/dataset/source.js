import { createHash } from "node:crypto";
import { readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import {
  DATASET_SOURCE_REQUEST_SCHEMA_VERSION,
  DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION,
  DATASET_USE_SCOPE,
  validateDatasetSourceRequestShape,
  validateDatasetSourceSnapshotShape
} from "@bejewely/face-contracts";
import { readJson } from "../campaign/storage.js";
import { verifyG4GradeRecordAgainstSources, verifyG4GradeRecordIntegrity, verifyPromotionStatusEventIntegrity, projectPromotionStatus } from "../promotion/decision.js";
import { verifyPromotionEvidenceBundleIntegrity } from "../promotion/evidence.js";
import { verifyPromotionReviewSubmissionIntegrity } from "../promotion/promotion-review.js";
import { verifyPromotionAssetPolicyReviewIntegrity, verifyPromotionLeakageReviewIntegrity, verifyPromotionOperatorReattestationIntegrity, verifyUsageRightsReviewIntegrity } from "../promotion/reviews.js";
import { verifyPromotionSourceSnapshotIntegrity } from "../promotion/source-snapshot.js";
import {
  promotionAssetReviewRelativePath,
  promotionEvidenceBundleRelativePath,
  promotionLeakageReviewRelativePath,
  promotionReattestationRelativePath,
  promotionReviewRelativePath,
  promotionRightsReviewRelativePath,
  promotionSourceSnapshotRelativePath,
  toNativePromotionPath
} from "../promotion/storage-layout.js";
import { preflightCampaignReportSource } from "../reporting/source-preflight.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { DATASET_SOURCE_POLICY_RECORD } from "./policy.js";

const RUN_ID = /^crun_[a-f0-9]{24}$/;

function failure(code, pathName, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) });
}

async function readContainedJson(dataRoot, relativePath) {
  const absolute = path.join(dataRoot, ...relativePath.split("/"));
  const [rootReal, fileReal] = await Promise.all([realpath(dataRoot), realpath(absolute)]);
  const relative = path.relative(rootReal, fileReal);
  if (relative === "" || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw Object.assign(new Error("source_evidence_integrity_invalid"), { code: "source_evidence_integrity_invalid" });
  return readJson(fileReal);
}

async function listJson(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const values = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw Object.assign(new Error("source_evidence_integrity_invalid"), { code: "source_evidence_integrity_invalid" });
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await listJson(absolute));
    else if (entry.isFile() && entry.name.endsWith(".json")) values.push(await readJson(absolute));
  }
  return values;
}

async function currentPromotionStatus(dataRoot, promotionKey, gradeRecordDigest) {
  const events = await listJson(path.join(dataRoot, "promotion", "status-events", promotionKey));
  const relevant = events.filter((event) => event.gradeRecordDigest === gradeRecordDigest);
  if (relevant.length === 0 || !relevant.every(verifyPromotionStatusEventIntegrity)) return failure("g4_status_chain_invalid", "promotionStatus");
  const projected = projectPromotionStatus(relevant);
  if (!projected.ok || projected.gradeRecordDigest !== gradeRecordDigest || projected.promotionKey !== promotionKey) return failure("g4_status_chain_invalid", "promotionStatus");
  return Object.freeze({ ok: true, events: relevant, status: projected, headDigest: projected.latestEvent.eventDigest });
}

async function enumerateRunIds(dataRoot, selection) {
  if (selection.mode === "single_run") return Object.freeze({ ok: true, runIds: [selection.campaignRunId] });
  const root = path.join(dataRoot, "campaigns", "runs");
  let entries;
  try { entries = await readdir(root, { withFileTypes: true }); }
  catch (error) { return failure(error?.code === "ENOENT" ? "dataset_source_not_ready" : "source_evidence_integrity_invalid", "sourceUniverse"); }
  const runIds = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) return failure("source_evidence_integrity_invalid", "sourceUniverse", "symlink");
    if (!entry.isDirectory() || !RUN_ID.test(entry.name)) continue;
    let plan, closeouts;
    try {
      plan = await readJson(path.join(root, entry.name, "plan.json"));
      closeouts = await listJson(path.join(root, entry.name, "closeouts"));
    } catch { continue; }
    if (plan.comparisonGroupId !== selection.comparisonGroupId || closeouts.length !== 1) continue;
    const closedAt = closeouts[0].closedAt;
    if (typeof closedAt === "string" && Date.parse(closedAt) <= Date.parse(selection.cutoffAt)) runIds.push(entry.name);
  }
  runIds.sort();
  return runIds.length ? Object.freeze({ ok: true, runIds }) : failure("dataset_source_not_ready", "sourceUniverse", "no_closed_runs");
}

function canonicalCouplingKeys(leakageReview, sourceSnapshot, runId) {
  const keys = [
    { kind: "canonical_sha256", key: sourceSnapshot.candidate.canonicalSha256, sourceArtifactDigest: sourceSnapshot.sourceSnapshotDigest },
    { kind: "campaign_series", key: runId, sourceArtifactDigest: sourceSnapshot.sourceSnapshotDigest }
  ];
  for (const item of leakageReview.splitCouplingKeys) {
    const map = {
      canonical: "canonical_sha256",
      campaign_series: "campaign_series",
      reference_lineage: "reference_lineage",
      paired_edit_lineage: "paired_edit_lineage",
      reviewed_visual_similarity: "reviewed_visual_similarity",
      representative_alias: "active_representative_alias"
    };
    const kind = map[item.kind] || null;
    if (kind) keys.push({ kind, key: item.key, sourceArtifactDigest: leakageReview.reviewDigest });
  }
  const unique = new Map(keys.map((item) => [stableStringify([item.kind, item.key]), item]));
  return [...unique.values()].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
}

async function verifyCurrentG4({ dataRoot, runId, slotEvidence }) {
  const promotion = slotEvidence.evidence.promotion;
  if (!promotion?.gradeRecord || !promotion.snapshot || !promotion.evidenceBundle) return failure("source_evidence_missing", "promotion");
  const { gradeRecord, snapshot, evidenceBundle, decision } = promotion;
  const candidateId = gradeRecord.candidateId;
  let operator, rights, asset, leakage, review;
  try {
    [operator, rights, asset, leakage, review] = await Promise.all([
      readContainedJson(dataRoot, promotionReattestationRelativePath(candidateId, evidenceBundle.operatorReattestationDigest)),
      readContainedJson(dataRoot, promotionRightsReviewRelativePath(candidateId, evidenceBundle.rightsReviewDigest)),
      readContainedJson(dataRoot, promotionAssetReviewRelativePath(candidateId, evidenceBundle.assetPolicyReviewDigest)),
      readContainedJson(dataRoot, promotionLeakageReviewRelativePath(candidateId, evidenceBundle.leakageReviewDigest)),
      readContainedJson(dataRoot, promotionReviewRelativePath(snapshot.promotionKey, decision.promotionReviewDigest))
    ]);
  } catch { return failure("source_evidence_missing", "promotionEvidence"); }
  if (
    !verifyG4GradeRecordIntegrity(gradeRecord) ||
    !verifyPromotionSourceSnapshotIntegrity(snapshot) ||
    !verifyPromotionEvidenceBundleIntegrity(evidenceBundle) ||
    !verifyPromotionOperatorReattestationIntegrity(operator) ||
    !verifyUsageRightsReviewIntegrity(rights) ||
    !verifyPromotionAssetPolicyReviewIntegrity(asset) ||
    !verifyPromotionLeakageReviewIntegrity(leakage) ||
    !verifyPromotionReviewSubmissionIntegrity(review) ||
    !verifyG4GradeRecordAgainstSources({ gradeRecord, snapshot, bundle: evidenceBundle, decision, rightsReview: rights, assetPolicyReview: asset, leakageReview: leakage, operatorReattestation: operator, promotionReview: review }) ||
    rights.status !== "approved" || asset.visibleExternalMark !== "absent" || asset.prohibitedTransformationDetected !== false || !["no_review_candidates", "distinct_enough_for_internal_evaluation"].includes(leakage.perceptualDisposition)
  ) return failure("source_evidence_integrity_invalid", "promotionEvidence");
  const status = await currentPromotionStatus(dataRoot, snapshot.promotionKey, gradeRecord.gradeRecordDigest);
  if (!status.ok) return status;
  const manifest = slotEvidence.evidence.candidateManifest;
  if (!manifest || manifest.candidateId !== candidateId || manifest.asset.canonicalSha256 !== snapshot.candidate.canonicalSha256) return failure("source_evidence_integrity_invalid", "candidateManifest");
  const bytes = await readFile(path.join(dataRoot, ...manifest.asset.canonicalObjectRelativePath.split("/")));
  if (createHash("sha256").update(bytes).digest("hex") !== manifest.asset.canonicalSha256) return failure("canonical_asset_mismatch", "canonicalAsset");
  const splitCouplingKeys = canonicalCouplingKeys(leakage, snapshot, runId);
  return Object.freeze({ ok: true, active: status.status.active, headDigest: status.headDigest, gradeRecord, snapshot, evidenceBundle, leakage, manifest, splitCouplingKeys });
}

function labelSchemaFromMember(member) {
  const semantic = {
    purpose: member.snapshot.generation.purpose,
    claimAxes: [...member.gradeRecord.scope.claimAxes].sort(),
    excludedClaims: [...member.gradeRecord.scope.excludedClaims].sort()
  };
  return deepFreeze({ ...semantic, labelSchemaDigest: sha256Hex(stableStringify(semantic)) });
}

function snapshotSemantic(snapshot) {
  const { capturedAt, sourceSnapshotDigest, ...semantic } = snapshot;
  return semantic;
}

export async function preflightDatasetSource({ dataRoot, request, priorExposureRegistryDigest = sha256Hex(stableStringify([])), capturedAt = new Date().toISOString() }) {
  if (!validateDatasetSourceRequestShape(request).ok || request.schemaVersion !== DATASET_SOURCE_REQUEST_SCHEMA_VERSION || !Number.isFinite(Date.parse(capturedAt))) return failure("dataset_source_request_invalid", "request");
  const universe = await enumerateRunIds(dataRoot, request.sourceSelection);
  if (!universe.ok) return universe;
  const sources = [];
  for (const runId of universe.runIds) {
    const source = await preflightCampaignReportSource({ dataRoot, campaignRunId: runId });
    if (!source.ok) return failure("dataset_source_not_ready", `campaignRun:${runId}`, source.errors?.[0]?.code || null);
    sources.push(source.source);
  }
  const sourceUniverseSemantic = sources.map((source) => ({ runId: source.run.campaignRunId, planDigest: source.plan.planDigest, projectionDigest: source.projection.projectionDigest, closeoutDigest: source.closeout.closeoutDigest })).sort((a, b) => a.runId.localeCompare(b.runId));
  const sourceUniverseDigest = sha256Hex(stableStringify(sourceUniverseSemantic));
  const members = [];
  const exclusions = [];
  let labelSchema = null;
  for (const source of sources) {
    for (const slotEvidence of source.slotEvidence) {
      const candidateId = slotEvidence.projection.refs.candidateId;
      if (!candidateId) continue;
      const artifactDigest = slotEvidence.projection.refs.candidateDigest || slotEvidence.slot.slotIdentityDigest;
      if (slotEvidence.projection.terminalOutcome !== "promoted_g4") {
        exclusions.push({ campaignRunId: source.run.campaignRunId, candidateId, sourceArtifactDigest: artifactDigest, disposition: "excluded", reasonCode: "not_g4_source" });
        continue;
      }
      const verified = await verifyCurrentG4({ dataRoot, runId: source.run.campaignRunId, slotEvidence });
      if (!verified.ok || !verified.active) {
        exclusions.push({ campaignRunId: source.run.campaignRunId, candidateId, sourceArtifactDigest: artifactDigest, disposition: "quarantined", reasonCode: verified.ok ? "g4_status_inactive" : verified.errors[0].code });
        continue;
      }
      if (verified.snapshot.generation.purpose !== request.purpose || verified.gradeRecord.scope.useScope !== request.useScope) {
        exclusions.push({ campaignRunId: source.run.campaignRunId, candidateId, sourceArtifactDigest: artifactDigest, disposition: "excluded", reasonCode: "purpose_scope_mismatch" });
        continue;
      }
      const schema = labelSchemaFromMember(verified);
      if (labelSchema && labelSchema.labelSchemaDigest !== schema.labelSchemaDigest) {
        exclusions.push({ campaignRunId: source.run.campaignRunId, candidateId, sourceArtifactDigest: artifactDigest, disposition: "quarantined", reasonCode: "label_schema_incompatible" });
        continue;
      }
      labelSchema ||= schema;
      members.push({
        campaignRunId: source.run.campaignRunId,
        candidateId,
        candidateDigest: verified.manifest.candidateDigest,
        canonicalSha256: verified.manifest.asset.canonicalSha256,
        canonicalObjectRelativePath: verified.manifest.asset.canonicalObjectRelativePath,
        g4GradeRecordDigest: verified.gradeRecord.gradeRecordDigest,
        g4StatusHeadDigest: verified.headDigest,
        promotionKey: verified.snapshot.promotionKey,
        promotionSourceSnapshotDigest: verified.snapshot.sourceSnapshotDigest,
        promotionEvidenceBundleDigest: verified.evidenceBundle.bundleDigest,
        leakageReviewDigest: verified.leakage.reviewDigest,
        claimValuesDigest: verified.gradeRecord.scope.claimValuesDigest,
        splitCouplingKeys: verified.splitCouplingKeys,
        splitCouplingKeysDigest: sha256Hex(stableStringify(verified.splitCouplingKeys))
      });
    }
  }
  if (!members.length || !labelSchema) return failure("dataset_source_not_ready", "members", "no_active_compatible_g4");
  members.sort((a, b) => stableStringify([a.claimValuesDigest, a.canonicalSha256, a.candidateId, a.g4GradeRecordDigest]).localeCompare(stableStringify([b.claimValuesDigest, b.canonicalSha256, b.candidateId, b.g4GradeRecordDigest])));
  exclusions.sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  const semantic = {
    schemaVersion: DATASET_SOURCE_SNAPSHOT_SCHEMA_VERSION,
    datasetId: request.datasetId,
    datasetLineageId: request.datasetLineageId,
    purpose: request.purpose,
    useScope: DATASET_USE_SCOPE,
    sourceUniverseDigest,
    members,
    exclusions,
    labelSchema,
    priorExposureRegistryDigest,
    sourcePolicy: DATASET_SOURCE_POLICY_RECORD
  };
  const sourceSnapshotDigest = sha256Hex(stableStringify(semantic));
  const snapshot = deepFreeze({ ...semantic, capturedAt, sourceSnapshotDigest });
  return validateDatasetSourceSnapshotShape(snapshot).ok ? Object.freeze({ ok: true, sourceSnapshot: snapshot, sources, writesPerformed: 0 }) : failure("dataset_source_snapshot_invalid", "sourceSnapshot");
}

export function verifyDatasetSourceSnapshotIntegrity(snapshot) {
  if (!validateDatasetSourceSnapshotShape(snapshot).ok || snapshot.sourcePolicy.digest !== DATASET_SOURCE_POLICY_RECORD.digest) return false;
  return snapshot.sourceSnapshotDigest === sha256Hex(stableStringify(snapshotSemantic(snapshot)));
}
