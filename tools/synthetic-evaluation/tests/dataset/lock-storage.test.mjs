import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildLeakageGraph } from "../../src/dataset/leakage.js";
import {
  prepareDatasetLockArtifacts,
  projectLinearStatus,
  verifyDatasetActivationManifestIntegrity,
  verifyDatasetVersionManifestIntegrity,
  verifyDatasetVersionStatusEventIntegrity,
  verifyG5HoldoutRecordIntegrity
} from "../../src/dataset/lock.js";
import { finalizeDatasetLockReview } from "../../src/dataset/review.js";
import { assignLeakageComponents, createDatasetSplitPlan } from "../../src/dataset/split.js";
import { appendDatasetVersionStatus, appendG5Status } from "../../src/dataset/status.js";
import { registerDatasetActivation, registerLockedDataset } from "../../src/dataset/storage.js";
import { datasetStorageLayout, nativeDatasetPath } from "../../src/dataset/storage-layout.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import { approvedLockReviewDraft, createSourceSnapshot, splitPlanDraft } from "./helpers.mjs";

function preparedCase() {
  const { snapshot, exposure } = createSourceSnapshot({ count: 5 });
  const graph = buildLeakageGraph(snapshot).graph;
  const plan = createDatasetSplitPlan({ sourceSnapshot: snapshot, leakageGraph: graph, draft: splitPlanDraft(5), authoredAt: "2026-08-03T00:10:00.000Z" }).plan;
  const assignment = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, exposureRegistry: exposure, assignedAt: "2026-08-03T00:20:00.000Z" }).assignment;
  const review = finalizeDatasetLockReview({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, assignment, draft: approvedLockReviewDraft() }).submission;
  const artifacts = prepareDatasetLockArtifacts({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, assignment, lockReview: review, exposureRegistry: exposure, lockedAt: "2026-08-03T02:00:00.000Z", activatedAt: "2026-08-03T02:10:00.000Z" });
  return { snapshot, exposure, graph, plan, assignment, review, artifacts };
}

function sealStatusEvent(value) {
  const { recordedAt, eventDigest, ...semantic } = value;
  return { ...semantic, recordedAt, eventDigest: sha256Hex(stableStringify(semantic)) };
}

async function publish(dataRoot, prepared) {
  const locked = await registerLockedDataset({ dataRoot, sourceSnapshot: prepared.snapshot, leakageGraph: prepared.graph, splitPlan: prepared.plan, assignment: prepared.assignment, lockReview: prepared.review, artifacts: prepared.artifacts });
  assert.equal(locked.ok, true);
  const activated = await registerDatasetActivation({ dataRoot, artifacts: prepared.artifacts });
  assert.equal(activated.ok, true);
}

test("locked version and G5 records have separate immutable identities", () => {
  const prepared = preparedCase();
  assert.equal(prepared.artifacts.ok, true);
  assert.equal(verifyDatasetVersionManifestIntegrity(prepared.artifacts.datasetVersion), true);
  assert.equal(verifyDatasetActivationManifestIntegrity(prepared.artifacts.activation), true);
  assert.equal(prepared.artifacts.g5Records.length, 1);
  assert.equal(prepared.artifacts.g5Records.every(verifyG5HoldoutRecordIntegrity), true);
  assert.notEqual(prepared.artifacts.datasetVersion.datasetVersionDigest, prepared.artifacts.g5Records[0].gradeRecordDigest);
});

test("dataset status chains reject branches and preserve append-only state", () => {
  const prepared = preparedCase();
  const root = prepared.artifacts.datasetStatusEvent;
  const valid = projectLinearStatus([root], verifyDatasetVersionStatusEventIntegrity, "datasetVersionDigest");
  assert.equal(valid.ok, true);
  assert.equal(valid.active, true);
  const branchA = sealStatusEvent({ ...root, event: "retired", reasonCodes: ["manual_retirement"], predecessorEventDigest: root.eventDigest, recordedAt: "2026-08-03T03:00:00.000Z" });
  const branchB = sealStatusEvent({ ...root, event: "invalidated", reasonCodes: ["leakage_conflict"], predecessorEventDigest: root.eventDigest, recordedAt: "2026-08-03T03:01:00.000Z" });
  const projected = projectLinearStatus([root, branchA, branchB], verifyDatasetVersionStatusEventIntegrity, "datasetVersionDigest");
  assert.equal(projected.ok, false);
  assert.equal(projected.errors[0].detail, "branched");
});

test("locked manifest is published before activation manifest and registration is idempotent", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t9-lock-"));
  const prepared = preparedCase();
  const locked = await registerLockedDataset({ dataRoot, sourceSnapshot: prepared.snapshot, leakageGraph: prepared.graph, splitPlan: prepared.plan, assignment: prepared.assignment, lockReview: prepared.review, artifacts: prepared.artifacts });
  assert.equal(locked.ok, true);
  assert.equal(locked.state, "locked_incomplete");
  await assert.rejects(readFile(nativeDatasetPath(dataRoot, datasetStorageLayout.activationManifest(prepared.artifacts.datasetVersion.datasetLineageId, prepared.artifacts.datasetVersion.datasetVersionId)), "utf8"));
  const activated = await registerDatasetActivation({ dataRoot, artifacts: prepared.artifacts });
  assert.equal(activated.ok, true);
  const activationText = await readFile(nativeDatasetPath(dataRoot, datasetStorageLayout.activationManifest(prepared.artifacts.datasetVersion.datasetLineageId, prepared.artifacts.datasetVersion.datasetVersionId)), "utf8");
  assert.match(activationText, /dataset-activation-manifest-v1/);
  const again = await registerDatasetActivation({ dataRoot, artifacts: prepared.artifacts });
  assert.equal(again.ok, true);
  assert.equal(again.state, "existing_active");
});

test("dataset and G5 deactivation are append-only and cannot be appended twice", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t9-status-"));
  const prepared = preparedCase();
  await publish(dataRoot, prepared);
  const version = prepared.artifacts.datasetVersion;
  const datasetStatus = await appendDatasetVersionStatus({
    dataRoot,
    datasetLineageId: version.datasetLineageId,
    datasetVersionId: version.datasetVersionId,
    event: "invalidated",
    reasonCodes: ["cross_split_leakage_conflict"],
    recordedAt: "2026-08-03T04:00:00.000Z"
  });
  assert.equal(datasetStatus.ok, true);
  const secondDatasetStatus = await appendDatasetVersionStatus({
    dataRoot,
    datasetLineageId: version.datasetLineageId,
    datasetVersionId: version.datasetVersionId,
    event: "retired",
    reasonCodes: ["manual_retirement"],
    recordedAt: "2026-08-03T04:01:00.000Z"
  });
  assert.equal(secondDatasetStatus.ok, false);
  assert.equal(secondDatasetStatus.errors[0].code, "dataset_status_already_inactive");

  const g5Digest = prepared.artifacts.g5Records[0].gradeRecordDigest;
  const g5Status = await appendG5Status({
    dataRoot,
    datasetLineageId: version.datasetLineageId,
    datasetVersionId: version.datasetVersionId,
    g5GradeRecordDigest: g5Digest,
    event: "revoked",
    reasonCodes: ["source_g4_revoked"],
    recordedAt: "2026-08-03T04:02:00.000Z"
  });
  assert.equal(g5Status.ok, true);
  const secondG5Status = await appendG5Status({
    dataRoot,
    datasetLineageId: version.datasetLineageId,
    datasetVersionId: version.datasetVersionId,
    g5GradeRecordDigest: g5Digest,
    event: "superseded",
    reasonCodes: ["new_dataset_version"],
    recordedAt: "2026-08-03T04:03:00.000Z"
  });
  assert.equal(secondG5Status.ok, false);
  assert.equal(secondG5Status.errors[0].code, "g5_status_already_inactive");
});
