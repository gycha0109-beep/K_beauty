import { readJson, writeExclusiveJson, writeSemanticAddressedJson } from "../judgment/artifact-store.js";
import { stableStringify } from "../shared/canonical-json.js";
import { verifyLeakageGraphIntegrity } from "./leakage.js";
import {
  verifyDatasetActivationManifestIntegrity,
  verifyDatasetLockBasisIntegrity,
  verifyDatasetMemberIntegrity,
  verifyDatasetVersionManifestIntegrity,
  verifyDatasetVersionStatusEventIntegrity,
  verifyG5HoldoutRecordIntegrity,
  verifyG5StatusEventIntegrity
} from "./lock.js";
import { verifyDatasetExposureClaimIntegrity } from "./exposure.js";
import { verifyDatasetLockReviewIntegrity } from "./review.js";
import { verifyDatasetSourceSnapshotIntegrity } from "./source.js";
import { verifyDatasetSplitAssignmentIntegrity, verifyDatasetSplitPlanIntegrity } from "./split.js";
import { datasetStorageLayout, nativeDatasetPath } from "./storage-layout.js";

function failure(code, path, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) }); }

async function storeObject(dataRoot, relativePath, value, verifier, digestKey) {
  const result = await writeSemanticAddressedJson(nativeDatasetPath(dataRoot, relativePath), value, (existing, proposed) => verifier(existing) && existing[digestKey] === proposed[digestKey]);
  return Object.freeze({ created: result.created, value: result.value, relativePath });
}

async function claim(dataRoot, relativePath, value, code) {
  const absolute = nativeDatasetPath(dataRoot, relativePath);
  try {
    await writeExclusiveJson(absolute, value);
    return Object.freeze({ created: true, value, relativePath });
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    let existing;
    try { existing = await readJson(absolute); }
    catch { throw Object.assign(new Error(code), { code }); }
    if (stableStringify(existing) !== stableStringify(value)) throw Object.assign(new Error(code), { code });
    return Object.freeze({ created: false, value: existing, relativePath });
  }
}

function verifyMemberIndex(value, members) {
  if (!value || value.schemaVersion !== "dataset-member-index-v1" || !Array.isArray(value.memberDigests) || typeof value.memberIndexDigest !== "string") return false;
  return stableStringify(value.memberDigests) === stableStringify(members.map((member) => member.memberDigest).sort());
}
function verifyExposureIndex(value, claims) { return value?.schemaVersion === "dataset-exposure-index-v1" && stableStringify(value.claimDigests) === stableStringify(claims.map((claim) => claim.claimDigest)); }
function verifyG5Index(value, records) { return value?.schemaVersion === "g5-index-v1" && stableStringify(value.gradeRecordDigests) === stableStringify(records.map((record) => record.gradeRecordDigest)); }
function verifyG5StatusIndex(value, events) { return value?.schemaVersion === "g5-status-head-index-v1" && stableStringify(value.entries) === stableStringify(events.map((event) => ({ g5GradeRecordDigest: event.g5GradeRecordDigest, statusHeadDigest: event.eventDigest }))); }

export async function registerLockedDataset({ dataRoot, sourceSnapshot, leakageGraph, splitPlan, assignment, lockReview, artifacts }) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot) || !verifyLeakageGraphIntegrity(leakageGraph) || !verifyDatasetSplitPlanIntegrity(splitPlan) || !verifyDatasetSplitAssignmentIntegrity(assignment) || !verifyDatasetLockReviewIntegrity(lockReview) || !artifacts?.members?.every(verifyDatasetMemberIntegrity) || !verifyDatasetLockBasisIntegrity(artifacts.lockBasis) || !verifyDatasetVersionManifestIntegrity(artifacts.datasetVersion) || artifacts.datasetVersion.lockBasisDigest !== artifacts.lockBasis.lockBasisDigest) return failure("dataset_lock_invalid", "artifacts");
  const version = artifacts.datasetVersion;
  const lineageClaim = {
    schemaVersion: "dataset-lineage-successor-claim-v1",
    datasetLineageId: version.datasetLineageId,
    predecessorDatasetVersionDigest: version.predecessorDatasetVersionDigest,
    successorDatasetVersionDigest: version.datasetVersionDigest
  };
  const writes = [];
  try {
    writes.push(await claim(dataRoot, datasetStorageLayout.lineageSuccessorClaim(version.datasetLineageId, version.predecessorDatasetVersionDigest), lineageClaim, "dataset_lineage_branch_conflict"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.sourceSnapshot(sourceSnapshot.sourceSnapshotDigest), sourceSnapshot, verifyDatasetSourceSnapshotIntegrity, "sourceSnapshotDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.leakageGraph(leakageGraph.graphDigest), leakageGraph, verifyLeakageGraphIntegrity, "graphDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.splitPlan(splitPlan.planDigest), splitPlan, verifyDatasetSplitPlanIntegrity, "planDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.splitAssignment(assignment.assignmentDigest), assignment, verifyDatasetSplitAssignmentIntegrity, "assignmentDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.lockReview(lockReview.submissionDigest), lockReview, verifyDatasetLockReviewIntegrity, "submissionDigest"));
    for (const member of artifacts.members) writes.push(await storeObject(dataRoot, datasetStorageLayout.member(member.memberDigest), member, verifyDatasetMemberIntegrity, "memberDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.lockBasis(artifacts.lockBasis.lockBasisDigest), artifacts.lockBasis, verifyDatasetLockBasisIntegrity, "lockBasisDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.datasetVersion(version.datasetVersionDigest), version, verifyDatasetVersionManifestIntegrity, "datasetVersionDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.memberIndex(version.datasetLineageId, version.datasetVersionId), artifacts.memberIndex, (value) => verifyMemberIndex(value, artifacts.members), "memberIndexDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.lockedManifest(version.datasetLineageId, version.datasetVersionId), version, verifyDatasetVersionManifestIntegrity, "datasetVersionDigest"));
  } catch (error) { return failure(error?.code || "dataset_lock_storage_conflict", "storage"); }
  return Object.freeze({ ok: true, state: writes.some((item) => item.created) ? "locked_incomplete" : "existing_locked_incomplete", writesPerformed: writes.filter((item) => item.created).length, datasetVersion: version, writes });
}

export async function registerDatasetActivation({ dataRoot, artifacts }) {
  const version = artifacts?.datasetVersion;
  if (!verifyDatasetVersionManifestIntegrity(version) || !artifacts.exposureClaims.every(verifyDatasetExposureClaimIntegrity) || !artifacts.g5Records.every(verifyG5HoldoutRecordIntegrity) || !verifyDatasetVersionStatusEventIntegrity(artifacts.datasetStatusEvent) || !artifacts.g5StatusEvents.every(verifyG5StatusEventIntegrity) || !verifyDatasetActivationManifestIntegrity(artifacts.activation) || artifacts.activation.datasetVersionDigest !== version.datasetVersionDigest) return failure("dataset_activation_invalid", "artifacts");
  const writes = [];
  try {
    for (const exposure of artifacts.exposureClaims) {
      const successor = {
        schemaVersion: "dataset-exposure-successor-claim-v1",
        datasetLineageId: exposure.datasetLineageId,
        componentFingerprint: exposure.componentFingerprint,
        predecessorClaimDigest: exposure.predecessorClaimDigest,
        successorClaimDigest: exposure.claimDigest
      };
      writes.push(await claim(dataRoot, datasetStorageLayout.exposureSuccessorClaim(exposure.datasetLineageId, exposure.componentFingerprint, exposure.predecessorClaimDigest), successor, "exposure_registry_branch_conflict"));
      writes.push(await storeObject(dataRoot, datasetStorageLayout.exposureClaim(exposure.claimDigest), exposure, verifyDatasetExposureClaimIntegrity, "claimDigest"));
    }
    for (const record of artifacts.g5Records) writes.push(await storeObject(dataRoot, datasetStorageLayout.g5Record(record.gradeRecordDigest), record, verifyG5HoldoutRecordIntegrity, "gradeRecordDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.datasetStatusEvent(artifacts.datasetStatusEvent.eventDigest), artifacts.datasetStatusEvent, verifyDatasetVersionStatusEventIntegrity, "eventDigest"));
    for (const event of artifacts.g5StatusEvents) writes.push(await storeObject(dataRoot, datasetStorageLayout.g5StatusEvent(event.eventDigest), event, verifyG5StatusEventIntegrity, "eventDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.exposureIndex(version.datasetLineageId, version.datasetVersionId), artifacts.exposureClaimIndex, (value) => verifyExposureIndex(value, artifacts.exposureClaims), "exposureClaimIndexDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.g5Index(version.datasetLineageId, version.datasetVersionId), artifacts.g5Index, (value) => verifyG5Index(value, artifacts.g5Records), "g5IndexDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.g5StatusIndex(version.datasetLineageId, version.datasetVersionId), artifacts.g5StatusHeadIndex, (value) => verifyG5StatusIndex(value, artifacts.g5StatusEvents), "g5StatusHeadIndexDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.datasetStatusIndex(version.datasetLineageId, version.datasetVersionId), { schemaVersion: "dataset-status-head-index-v1", datasetVersionDigest: version.datasetVersionDigest, statusHeadDigest: artifacts.datasetStatusEvent.eventDigest }, (value) => value?.datasetVersionDigest === version.datasetVersionDigest && value?.statusHeadDigest === artifacts.datasetStatusEvent.eventDigest, "statusHeadDigest"));
    const activationClaim = { schemaVersion: "dataset-activation-claim-v1", datasetVersionDigest: version.datasetVersionDigest, activationDigest: artifacts.activation.activationDigest };
    writes.push(await claim(dataRoot, datasetStorageLayout.activationClaim(version.datasetLineageId, version.datasetVersionId), activationClaim, "dataset_activation_conflict"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.activation(artifacts.activation.activationDigest), artifacts.activation, verifyDatasetActivationManifestIntegrity, "activationDigest"));
    writes.push(await storeObject(dataRoot, datasetStorageLayout.activationManifest(version.datasetLineageId, version.datasetVersionId), artifacts.activation, verifyDatasetActivationManifestIntegrity, "activationDigest"));
  } catch (error) { return failure(error?.code || "dataset_activation_storage_conflict", "storage"); }
  return Object.freeze({ ok: true, state: writes.some((item) => item.created) ? "active" : "existing_active", writesPerformed: writes.filter((item) => item.created).length, activation: artifacts.activation, writes });
}

export async function readDatasetVersionBundle(dataRoot, datasetLineageId, datasetVersionId) {
  try {
    const version = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.lockedManifest(datasetLineageId, datasetVersionId)));
    const activation = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.activationManifest(datasetLineageId, datasetVersionId)));
    const memberIndex = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.memberIndex(datasetLineageId, datasetVersionId)));
    const exposureIndex = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.exposureIndex(datasetLineageId, datasetVersionId)));
    const g5Index = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.g5Index(datasetLineageId, datasetVersionId)));
    const g5StatusIndex = await readJson(nativeDatasetPath(dataRoot, datasetStorageLayout.g5StatusIndex(datasetLineageId, datasetVersionId)));
    return Object.freeze({ ok: true, version, activation, memberIndex, exposureIndex, g5Index, g5StatusIndex });
  } catch (error) { return failure(error?.code === "ENOENT" ? "locked_incomplete" : "dataset_storage_invalid", "datasetBundle"); }
}
