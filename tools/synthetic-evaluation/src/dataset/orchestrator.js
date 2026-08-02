import { readdir } from "node:fs/promises";
import path from "node:path";
import { validateHoldoutMaterializationRequestShape } from "@bejewely/face-contracts";
import { readJson, writeSemanticAddressedJson } from "../judgment/artifact-store.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { reverifyDatasetSourceAuthority } from "./current-authority.js";
import { readExposureRegistry } from "./exposure.js";
import { buildLeakageGraph, verifyLeakageGraphIntegrity } from "./leakage.js";
import {
  prepareDatasetLockArtifacts,
  projectLinearStatus,
  verifyDatasetActivationManifestIntegrity,
  verifyDatasetMemberIntegrity,
  verifyDatasetVersionManifestIntegrity,
  verifyDatasetVersionStatusEventIntegrity,
  verifyG5HoldoutRecordIntegrity,
  verifyG5StatusEventIntegrity
} from "./lock.js";
import { finalizeDatasetLockReview } from "./review.js";
import { preflightDatasetSource, verifyDatasetSourceSnapshotIntegrity } from "./source.js";
import { assignLeakageComponents, createDatasetSplitPlan } from "./split.js";
import { readDatasetVersionBundle, registerDatasetActivation, registerLockedDataset } from "./storage.js";
import { datasetStorageLayout, nativeDatasetPath } from "./storage-layout.js";

function failure(code, pathName, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path: pathName, detail }]) }); }

async function readObjects(dataRoot, relativePaths) {
  try { return await Promise.all(relativePaths.map((relativePath) => readJson(nativeDatasetPath(dataRoot, relativePath)))); }
  catch (error) { throw Object.assign(new Error(error?.code === "ENOENT" ? "dataset_storage_missing" : "dataset_storage_invalid"), { code: error?.code === "ENOENT" ? "dataset_storage_missing" : "dataset_storage_invalid" }); }
}

async function scanObjects(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error?.code === "ENOENT") return []; throw error; }
  const values = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw Object.assign(new Error("dataset_storage_invalid"), { code: "dataset_storage_invalid" });
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await scanObjects(absolute));
    else if (entry.isFile() && entry.name.endsWith(".json")) values.push(await readJson(absolute));
  }
  return values;
}

export async function preflightDatasetLock({ dataRoot, sourceRequest, splitPlanDraft, capturedAt, assignedAt }) {
  const exposureRegistry = await readExposureRegistry(dataRoot, sourceRequest?.datasetLineageId);
  if (!exposureRegistry.ok) return exposureRegistry;
  const source = await preflightDatasetSource({ dataRoot, request: sourceRequest, priorExposureRegistryDigest: exposureRegistry.registryDigest, capturedAt });
  if (!source.ok) return source;
  const graph = buildLeakageGraph(source.sourceSnapshot);
  if (!graph.ok) return graph;
  const plan = createDatasetSplitPlan({ sourceSnapshot: source.sourceSnapshot, leakageGraph: graph.graph, draft: splitPlanDraft });
  if (!plan.ok) return plan;
  const assignment = assignLeakageComponents({ sourceSnapshot: source.sourceSnapshot, leakageGraph: graph.graph, splitPlan: plan.plan, exposureRegistry, assignedAt });
  if (!assignment.ok) return assignment;
  return Object.freeze({ ok: true, sourceSnapshot: source.sourceSnapshot, leakageGraph: graph.graph, splitPlan: plan.plan, assignment: assignment.assignment, exposureRegistry, writesPerformed: 0 });
}

export async function lockAndActivateDataset({
  dataRoot,
  sourceRequest,
  splitPlanDraft,
  lockReviewDraft,
  predecessorDatasetVersionDigest = null,
  capturedAt,
  assignedAt,
  lockedAt,
  activatedAt
}) {
  const prepared = await preflightDatasetLock({ dataRoot, sourceRequest, splitPlanDraft, capturedAt, assignedAt });
  if (!prepared.ok) return prepared;
  const reviewed = finalizeDatasetLockReview({ ...prepared, draft: lockReviewDraft });
  if (!reviewed.ok) return reviewed;
  const artifacts = prepareDatasetLockArtifacts({ ...prepared, lockReview: reviewed.submission, predecessorDatasetVersionDigest, lockedAt, activatedAt });
  if (!artifacts.ok) return artifacts;
  const locked = await registerLockedDataset({ dataRoot, ...prepared, lockReview: reviewed.submission, artifacts });
  if (!locked.ok) return locked;

  const [authority, exposureAfterLock] = await Promise.all([
    reverifyDatasetSourceAuthority({ dataRoot, sourceSnapshot: prepared.sourceSnapshot }),
    readExposureRegistry(dataRoot, sourceRequest.datasetLineageId)
  ]);
  if (!authority.ok || !exposureAfterLock.ok || exposureAfterLock.registryDigest !== prepared.exposureRegistry.registryDigest) {
    return Object.freeze({ ok: false, state: "locked_incomplete", datasetVersion: artifacts.datasetVersion, errors: Object.freeze([{ code: authority.ok ? "exposure_registry_changed" : authority.errors[0].code, path: "activationPreflight", detail: null }]) });
  }
  const activated = await registerDatasetActivation({ dataRoot, artifacts });
  if (!activated.ok) return Object.freeze({ ...activated, state: "locked_incomplete", datasetVersion: artifacts.datasetVersion });
  return Object.freeze({ ok: true, state: "active", datasetVersion: artifacts.datasetVersion, activation: artifacts.activation, g5Records: artifacts.g5Records, writesPerformed: locked.writesPerformed + activated.writesPerformed });
}

export async function verifyCurrentDataset({ dataRoot, datasetLineageId, datasetVersionId }) {
  const bundle = await readDatasetVersionBundle(dataRoot, datasetLineageId, datasetVersionId);
  if (!bundle.ok) return bundle;
  if (!verifyDatasetVersionManifestIntegrity(bundle.version) || !verifyDatasetActivationManifestIntegrity(bundle.activation) || bundle.activation.datasetVersionDigest !== bundle.version.datasetVersionDigest) return failure("dataset_current_invalid", "manifests");
  let sourceSnapshot, members, exposureClaims, g5Records, g5Events, datasetEvents;
  try {
    sourceSnapshot = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.sourceSnapshot(bundle.version.sourceSnapshotDigest)));
    members = await readObjects(dataRoot, bundle.memberIndex.memberDigests.map(datasetStorageLayout.member));
    exposureClaims = await readObjects(dataRoot, bundle.exposureIndex.claimDigests.map(datasetStorageLayout.exposureClaim));
    g5Records = await readObjects(dataRoot, bundle.g5Index.gradeRecordDigests.map(datasetStorageLayout.g5Record));
    const allG5Events = await scanObjects(path.join(dataRoot, "objects", "g5-status-events", "sha256"));
    g5Events = allG5Events.filter((event) => bundle.g5Index.gradeRecordDigests.includes(event.g5GradeRecordDigest));
    const allDatasetEvents = await scanObjects(path.join(dataRoot, "objects", "dataset-status-events", "sha256"));
    datasetEvents = allDatasetEvents.filter((event) => event.datasetVersionDigest === bundle.version.datasetVersionDigest);
  } catch (error) { return failure(error?.code || "dataset_storage_invalid", "objects"); }
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot) || !members.every(verifyDatasetMemberIntegrity) || !g5Records.every(verifyG5HoldoutRecordIntegrity) || !g5Events.every(verifyG5StatusEventIntegrity) || !datasetEvents.every(verifyDatasetVersionStatusEventIntegrity)) return failure("dataset_current_invalid", "objects");
  const authority = await reverifyDatasetSourceAuthority({ dataRoot, sourceSnapshot });
  if (!authority.ok) return failure(authority.errors[0].code, "sourceAuthority");
  const datasetStatus = projectLinearStatus(datasetEvents, verifyDatasetVersionStatusEventIntegrity, "datasetVersionDigest");
  if (!datasetStatus.ok || !datasetStatus.active || datasetStatus.latestEvent.eventDigest !== bundle.activation.datasetStatusHeadDigest) return failure("dataset_current_inactive", "datasetStatus");
  for (const record of g5Records) {
    const chain = g5Events.filter((event) => event.g5GradeRecordDigest === record.gradeRecordDigest);
    const projected = projectLinearStatus(chain, verifyG5StatusEventIntegrity, "g5GradeRecordDigest");
    const expectedHead = bundle.g5StatusIndex.entries.find((entry) => entry.g5GradeRecordDigest === record.gradeRecordDigest)?.statusHeadDigest;
    if (!projected.ok || !projected.active || projected.latestEvent.eventDigest !== expectedHead) return failure("g5_current_inactive", `g5:${record.gradeRecordDigest}`);
  }
  if (members.length !== sourceSnapshot.members.length || exposureClaims.length !== bundle.exposureIndex.claimDigests.length || bundle.activation.exposureClaimIndexDigest !== bundle.exposureIndex.exposureClaimIndexDigest || bundle.activation.g5IndexDigest !== bundle.g5Index.g5IndexDigest || bundle.activation.g5StatusHeadIndexDigest !== bundle.g5StatusIndex.g5StatusHeadIndexDigest) return failure("dataset_current_invalid", "indexes");
  return Object.freeze({ ok: true, state: "active", version: bundle.version, activation: bundle.activation, sourceSnapshot, members, exposureClaims, g5Records });
}

export async function materializeHoldoutReferences({ dataRoot, datasetLineageId, datasetVersionId, request }) {
  if (!validateHoldoutMaterializationRequestShape(request).ok) return failure("holdout_materialization_request_invalid", "request");
  const current = await verifyCurrentDataset({ dataRoot, datasetLineageId, datasetVersionId });
  if (!current.ok || request.datasetVersionDigest !== current.version.datasetVersionDigest) return failure("holdout_materialization_denied", "dataset");
  const holdoutMembers = current.members.filter((member) => member.split === "holdout");
  const byCandidate = new Map(current.sourceSnapshot.members.map((member) => [member.candidateId, member]));
  const semantic = {
    schemaVersion: "holdout-materialization-manifest-v1",
    datasetVersionDigest: current.version.datasetVersionDigest,
    purpose: request.purpose,
    authorizationDigest: request.authorizationDigest,
    entries: holdoutMembers.map((member) => ({ candidateId: member.candidateId, datasetMemberDigest: member.memberDigest, g5GradeRecordDigest: current.g5Records.find((record) => record.candidateId === member.candidateId)?.gradeRecordDigest || null, canonicalSha256: member.canonicalSha256, canonicalObjectRelativePath: byCandidate.get(member.candidateId).canonicalObjectRelativePath })).sort((a, b) => a.datasetMemberDigest.localeCompare(b.datasetMemberDigest))
  };
  const manifest = deepFreeze({ ...semantic, materializedAt: request.requestedAt, materializationDigest: sha256Hex(stableStringify(semantic)) });
  const relativePath = datasetStorageLayout.holdoutMaterialization(current.version.datasetVersionDigest, request.authorizationDigest);
  const stored = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, relativePath), manifest, (existing, proposed) => existing.materializationDigest === proposed.materializationDigest);
  return Object.freeze({ ok: true, state: stored.created ? "registered" : "existing", manifest: stored.value, writesPerformed: Number(stored.created) });
}
