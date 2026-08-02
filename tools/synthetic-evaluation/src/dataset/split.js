import {
  DATASET_SPLIT_ASSIGNMENT_SCHEMA_VERSION,
  DATASET_SPLIT_ORDER,
  DATASET_SPLIT_PLAN_SCHEMA_VERSION,
  DATASET_SPLITS,
  validateDatasetSplitAssignmentShape,
  validateDatasetSplitPlanShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyLeakageGraphIntegrity } from "./leakage.js";
import { DATASET_SPLIT_POLICY_RECORD } from "./policy.js";
import { verifyDatasetSourceSnapshotIntegrity } from "./source.js";

function failure(code, path, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) }); }
function without(value, ...keys) { const clone = { ...value }; for (const key of keys) delete clone[key]; return clone; }

export function createDatasetSplitPlan({ sourceSnapshot, leakageGraph, draft, authoredAt = new Date().toISOString() }) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot) || !verifyLeakageGraphIntegrity(leakageGraph) || leakageGraph.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest) return failure("dataset_split_plan_invalid", "sources");
  const semantic = {
    schemaVersion: DATASET_SPLIT_PLAN_SCHEMA_VERSION,
    datasetId: sourceSnapshot.datasetId,
    datasetLineageId: sourceSnapshot.datasetLineageId,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    leakageGraphDigest: leakageGraph.graphDigest,
    splits: [...DATASET_SPLITS],
    targets: draft?.targets,
    minimumComponents: draft?.minimumComponents,
    balancePolicy: draft?.balancePolicy,
    assignmentPolicy: { ...DATASET_SPLIT_POLICY_RECORD, callerSeedAllowed: false, splitOrder: [...DATASET_SPLIT_ORDER] },
    authoredBy: draft?.authoredBy
  };
  const planDigest = sha256Hex(stableStringify(semantic));
  const plan = deepFreeze({ ...semantic, authoredAt, planDigest });
  if (!validateDatasetSplitPlanShape(plan).ok) return failure("dataset_split_plan_invalid", "plan");
  const total = DATASET_SPLITS.reduce((sum, split) => sum + plan.targets[split], 0);
  if (total !== sourceSnapshot.members.length) return failure("dataset_split_plan_invalid", "targets", "denominator_mismatch");
  return Object.freeze({ ok: true, plan });
}

export function verifyDatasetSplitPlanIntegrity(plan) {
  if (!validateDatasetSplitPlanShape(plan).ok || plan.assignmentPolicy.digest !== DATASET_SPLIT_POLICY_RECORD.digest) return false;
  return plan.planDigest === sha256Hex(stableStringify(without(plan, "authoredAt", "planDigest")));
}

function componentMemberKeys(graph, component) {
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  return component.nodeIds.map((id) => {
    const node = nodeById.get(id);
    return sha256Hex(stableStringify([node.canonicalSha256, node.claimValuesDigest]));
  }).sort();
}

function inheritedSplit(graph, component, exposureHeads) {
  const keys = new Set(componentMemberKeys(graph, component));
  const matching = exposureHeads.filter((head) => Array.isArray(head.memberKeyDigests) && head.memberKeyDigests.some((key) => keys.has(key)));
  const splits = [...new Set(matching.map((head) => head.assignedSplit))];
  if (splits.length > 1) return failure("cross_split_leakage_conflict", `component:${component.componentId}`);
  if (splits.length === 0) return Object.freeze({ ok: true, split: null, claimDigest: null });
  const exact = matching.find((head) => head.componentFingerprint === component.componentFingerprint);
  return Object.freeze({ ok: true, split: splits[0], claimDigest: exact?.headClaimDigest || matching.map((head) => head.headClaimDigest).sort()[0] });
}

function labelCountsForComponent(graph, component) {
  const nodeById = new Map(graph.nodes.map((node) => [node.nodeId, node]));
  const counts = {};
  for (const id of component.nodeIds) {
    const label = nodeById.get(id).claimValuesDigest;
    counts[label] = (counts[label] || 0) + 1;
  }
  return counts;
}

function evaluateAssignment(plan, graph, assignments) {
  const counts = Object.fromEntries(DATASET_SPLITS.map((split) => [split, 0]));
  const componentCounts = Object.fromEntries(DATASET_SPLITS.map((split) => [split, 0]));
  const labelCounts = Object.fromEntries(DATASET_SPLITS.map((split) => [split, {}]));
  const componentById = new Map(graph.components.map((component) => [component.componentId, component]));
  for (const assignment of assignments) {
    const component = componentById.get(assignment.componentId);
    counts[assignment.assignedSplit] += component.candidateIds.length;
    componentCounts[assignment.assignedSplit] += 1;
    const labels = labelCountsForComponent(graph, component);
    for (const [label, count] of Object.entries(labels)) labelCounts[assignment.assignedSplit][label] = (labelCounts[assignment.assignedSplit][label] || 0) + count;
  }
  const deviation = Object.fromEntries(DATASET_SPLITS.map((split) => [split, counts[split] - plan.targets[split]]));
  const totalAbsoluteDeviation = Object.values(deviation).reduce((sum, value) => sum + Math.abs(value), 0);
  for (const split of DATASET_SPLITS) if (Math.abs(deviation[split]) > plan.balancePolicy.allowedAbsoluteDeviation) return null;
  for (const split of ["validation", "test", "holdout"]) if (componentCounts[split] < plan.minimumComponents[split]) return null;
  const labels = [...new Set(graph.nodes.map((node) => node.claimValuesDigest))];
  if (plan.balancePolicy.hardMinimumPerLabel > 0) {
    for (const split of DATASET_SPLITS) {
      if (plan.targets[split] === 0) continue;
      for (const label of labels) if ((labelCounts[split][label] || 0) < plan.balancePolicy.hardMinimumPerLabel) return null;
    }
  }
  const perLabel = {};
  for (const label of labels) perLabel[label] = DATASET_SPLITS.reduce((sum, split) => sum + Math.abs((labelCounts[split][label] || 0) - (plan.targets[split] ? Math.round((graph.nodes.filter((node) => node.claimValuesDigest === label).length * plan.targets[split]) / graph.nodes.length) : 0)), 0);
  return { counts, componentCounts, labelCounts, deviation, totalAbsoluteDeviation, perLabel };
}

function objective(evaluation, assignments) {
  const labelDeviation = Object.values(evaluation.perLabel).reduce((sum, value) => sum + value, 0);
  const nonzeroComponentCounts = Object.values(evaluation.componentCounts).filter((value) => value > 0);
  const imbalance = nonzeroComponentCounts.length ? Math.max(...nonzeroComponentCounts) - Math.min(...nonzeroComponentCounts) : 0;
  return [evaluation.totalAbsoluteDeviation, labelDeviation, imbalance, sha256Hex(stableStringify(assignments.map((item) => [item.componentId, item.assignedSplit]).sort()))];
}

function compareObjective(left, right) {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] < right[index]) return -1;
    if (left[index] > right[index]) return 1;
  }
  return 0;
}

export function assignLeakageComponents({ sourceSnapshot, leakageGraph, splitPlan, exposureRegistry, assignedAt = new Date().toISOString(), maxSearchStates = 500000 }) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot) || !verifyLeakageGraphIntegrity(leakageGraph) || !verifyDatasetSplitPlanIntegrity(splitPlan) || splitPlan.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest || splitPlan.leakageGraphDigest !== leakageGraph.graphDigest || exposureRegistry?.registryDigest !== sourceSnapshot.priorExposureRegistryDigest) return failure("dataset_split_assignment_invalid", "sources");
  const assignmentEntropyDigest = sha256Hex(stableStringify(["bejewely-t9-assignment-v1", sourceSnapshot.sourceSnapshotDigest, leakageGraph.graphDigest, splitPlan.planDigest]));
  const components = leakageGraph.components.map((component) => ({ component, order: sha256Hex(stableStringify([assignmentEntropyDigest, component.componentDigest])) })).sort((a, b) => a.order.localeCompare(b.order));
  const inherited = new Map();
  for (const { component } of components) {
    const resolved = inheritedSplit(leakageGraph, component, exposureRegistry.heads || []);
    if (!resolved.ok) return resolved;
    inherited.set(component.componentId, resolved);
  }
  let states = 0;
  let best = null;
  function search(index, current) {
    states += 1;
    if (states > maxSearchStates) return;
    if (index === components.length) {
      const evaluation = evaluateAssignment(splitPlan, leakageGraph, current);
      if (!evaluation) return;
      const score = objective(evaluation, current);
      if (!best || compareObjective(score, best.score) < 0) best = { assignments: current.map((item) => ({ ...item })), evaluation, score };
      return;
    }
    const { component } = components[index];
    const inheritedValue = inherited.get(component.componentId);
    const splits = inheritedValue.split ? [inheritedValue.split] : DATASET_SPLIT_ORDER;
    for (const assignedSplit of splits) {
      const currentCount = current.filter((item) => item.assignedSplit === assignedSplit).reduce((sum, item) => sum + leakageGraph.components.find((candidate) => candidate.componentId === item.componentId).candidateIds.length, 0);
      if (currentCount + component.candidateIds.length > splitPlan.targets[assignedSplit] + splitPlan.balancePolicy.allowedAbsoluteDeviation) continue;
      current.push({ componentId: component.componentId, componentDigest: component.componentDigest, componentFingerprint: component.componentFingerprint, assignedSplit, inheritedFromExposureClaimDigest: inheritedValue.claimDigest });
      search(index + 1, current);
      current.pop();
    }
  }
  search(0, []);
  if (!best) return failure(states > maxSearchStates ? "split_search_exhausted" : "split_infeasible", "assignment");
  const componentAssignments = best.assignments.sort((a, b) => a.componentId.localeCompare(b.componentId));
  const semantic = {
    schemaVersion: DATASET_SPLIT_ASSIGNMENT_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    leakageGraphDigest: leakageGraph.graphDigest,
    splitPlanDigest: splitPlan.planDigest,
    assignmentEntropyDigest,
    componentAssignments,
    achievedCounts: best.evaluation.counts,
    deviations: { totalAbsoluteDeviation: best.evaluation.totalAbsoluteDeviation, perSplit: best.evaluation.deviation, perLabel: best.evaluation.perLabel },
    assignmentPolicyDigest: DATASET_SPLIT_POLICY_RECORD.digest
  };
  const assignment = deepFreeze({ ...semantic, assignedAt, assignmentDigest: sha256Hex(stableStringify(semantic)) });
  return verifyDatasetSplitAssignmentIntegrity(assignment) ? Object.freeze({ ok: true, assignment, searchStates: states }) : failure("dataset_split_assignment_invalid", "assignment");
}

export function verifyDatasetSplitAssignmentIntegrity(assignment) {
  return validateDatasetSplitAssignmentShape(assignment).ok && assignment.assignmentPolicyDigest === DATASET_SPLIT_POLICY_RECORD.digest && assignment.assignmentDigest === sha256Hex(stableStringify(without(assignment, "assignedAt", "assignmentDigest")));
}
