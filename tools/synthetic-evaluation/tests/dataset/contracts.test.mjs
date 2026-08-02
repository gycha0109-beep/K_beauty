import assert from "node:assert/strict";
import test from "node:test";
import { validateDatasetSourceSnapshotShape } from "@bejewely/face-contracts";
import { buildLeakageGraph } from "../../src/dataset/leakage.js";
import { finalizeDatasetLockReview, verifyDatasetLockReviewIntegrity } from "../../src/dataset/review.js";
import { createDatasetSplitPlan, assignLeakageComponents } from "../../src/dataset/split.js";
import { verifyDatasetSourceSnapshotIntegrity } from "../../src/dataset/source.js";
import { approvedLockReviewDraft, createSourceSnapshot, splitPlanDraft } from "./helpers.mjs";

test("source snapshot contract and digest fail closed on unknown fields", () => {
  const { snapshot } = createSourceSnapshot();
  assert.equal(validateDatasetSourceSnapshotShape(snapshot).ok, true);
  assert.equal(verifyDatasetSourceSnapshotIntegrity(snapshot), true);
  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.members[0].unexpected = true;
  assert.equal(validateDatasetSourceSnapshotShape(tampered).ok, false);
  assert.equal(verifyDatasetSourceSnapshotIntegrity(tampered), false);
});

test("dataset lock review requires six explicit human confirmations", () => {
  const { snapshot, exposure } = createSourceSnapshot({ count: 5 });
  const graph = buildLeakageGraph(snapshot).graph;
  const plan = createDatasetSplitPlan({ sourceSnapshot: snapshot, leakageGraph: graph, draft: splitPlanDraft(5), authoredAt: "2026-08-03T00:10:00.000Z" }).plan;
  const assignment = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, exposureRegistry: exposure, assignedAt: "2026-08-03T00:20:00.000Z" }).assignment;
  const draft = approvedLockReviewDraft();
  draft.confirmations.holdoutIsolationReviewed = false;
  assert.equal(finalizeDatasetLockReview({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, assignment, draft }).ok, false);

  const approved = finalizeDatasetLockReview({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, assignment, draft: approvedLockReviewDraft() });
  assert.equal(approved.ok, true);
  assert.equal(verifyDatasetLockReviewIntegrity(approved.submission), true);
  const tampered = JSON.parse(JSON.stringify(approved.submission));
  tampered.decision = "reject_lock";
  assert.equal(verifyDatasetLockReviewIntegrity(tampered), false);
});
