import assert from "node:assert/strict";
import test from "node:test";
import { buildLeakageGraph, verifyLeakageGraphIntegrity } from "../../src/dataset/leakage.js";
import { assignLeakageComponents, createDatasetSplitPlan, verifyDatasetSplitAssignmentIntegrity } from "../../src/dataset/split.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import { createSourceSnapshot, splitPlanDraft } from "./helpers.mjs";

function memberKey(node) { return sha256Hex(stableStringify([node.canonicalSha256, node.claimValuesDigest])); }

test("reviewed coupling forms one transitive component without identity claims", () => {
  const { snapshot } = createSourceSnapshot({ count: 6, coupledPairs: [[1, 2, "visual-group-a"], [2, 3, "visual-group-a"]] });
  const built = buildLeakageGraph(snapshot);
  assert.equal(built.ok, true);
  assert.equal(verifyLeakageGraphIntegrity(built.graph), true);
  const coupled = built.graph.components.find((component) => component.candidateIds.length === 3);
  assert.ok(coupled);
  assert.deepEqual(coupled.couplingKinds, ["reviewed_visual_similarity"]);
  assert.equal("samePerson" in coupled, false);
});

test("assignment is deterministic and never splits a leakage component", () => {
  const { snapshot, exposure } = createSourceSnapshot({ count: 10, coupledPairs: [[1, 2, "pair-a"], [3, 4, "pair-b"]] });
  const graph = buildLeakageGraph(snapshot).graph;
  const plan = createDatasetSplitPlan({ sourceSnapshot: snapshot, leakageGraph: graph, draft: splitPlanDraft(10), authoredAt: "2026-08-03T00:10:00.000Z" });
  assert.equal(plan.ok, true);
  const first = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan.plan, exposureRegistry: exposure, assignedAt: "2026-08-03T00:20:00.000Z" });
  const second = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan.plan, exposureRegistry: exposure, assignedAt: "2026-08-04T00:20:00.000Z" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.assignment.assignmentDigest, second.assignment.assignmentDigest);
  assert.equal(verifyDatasetSplitAssignmentIntegrity(first.assignment), true);
  assert.equal(first.assignment.componentAssignments.length, graph.components.length);
});

test("infeasible exact quotas fail rather than splitting a coupled component", () => {
  const { snapshot, exposure } = createSourceSnapshot({ count: 4, coupledPairs: [[1, 2, "pair-a"], [3, 4, "pair-b"]] });
  const graph = buildLeakageGraph(snapshot).graph;
  const draft = splitPlanDraft(4);
  draft.targets = { train: 1, development: 1, validation: 1, test: 1, holdout: 0 };
  draft.minimumComponents = { validation: 0, test: 0, holdout: 0 };
  const plan = createDatasetSplitPlan({ sourceSnapshot: snapshot, leakageGraph: graph, draft, authoredAt: "2026-08-03T00:10:00.000Z" });
  assert.equal(plan.ok, true);
  const assigned = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan.plan, exposureRegistry: exposure });
  assert.equal(assigned.ok, false);
  assert.equal(assigned.errors[0].code, "split_infeasible");
});

test("prior exposure overlap across different splits blocks a newly merged component", () => {
  const { snapshot, exposure } = createSourceSnapshot({ count: 4, coupledPairs: [[1, 2, "new-merged-edge"]] });
  const graph = buildLeakageGraph(snapshot).graph;
  const merged = graph.components.find((component) => component.candidateIds.length === 2);
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const keys = merged.nodeIds.map((id) => memberKey(nodeById.get(id)));
  const registry = {
    ...exposure,
    heads: [
      { componentFingerprint: "1".repeat(64), assignedSplit: "train", headClaimDigest: "2".repeat(64), memberKeyDigests: [keys[0]] },
      { componentFingerprint: "3".repeat(64), assignedSplit: "holdout", headClaimDigest: "4".repeat(64), memberKeyDigests: [keys[1]] }
    ]
  };
  const draft = splitPlanDraft(4);
  draft.targets = { train: 0, development: 0, validation: 0, test: 2, holdout: 2 };
  draft.minimumComponents = { validation: 0, test: 1, holdout: 1 };
  const plan = createDatasetSplitPlan({ sourceSnapshot: snapshot, leakageGraph: graph, draft, authoredAt: "2026-08-03T00:10:00.000Z" }).plan;
  const assigned = assignLeakageComponents({ sourceSnapshot: snapshot, leakageGraph: graph, splitPlan: plan, exposureRegistry: registry });
  assert.equal(assigned.ok, false);
  assert.equal(assigned.errors[0].code, "cross_split_leakage_conflict");
});
