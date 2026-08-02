import { DATASET_COUPLING_KINDS, LEAKAGE_GRAPH_SCHEMA_VERSION, validateLeakageGraphShape } from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { DATASET_GRAPH_POLICY_RECORD } from "./policy.js";
import { verifyDatasetSourceSnapshotIntegrity } from "./source.js";

function failure(code, path, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) }); }
function graphSemantic(graph) { const { graphDigest, ...semantic } = graph; return semantic; }

function unionFind(ids) {
  const parent = new Map(ids.map((id) => [id, id]));
  function find(id) {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    let cursor = id;
    while (parent.get(cursor) !== cursor) { const next = parent.get(cursor); parent.set(cursor, current); cursor = next; }
    return current;
  }
  function union(left, right) {
    const a = find(left); const b = find(right);
    if (a === b) return;
    if (a < b) parent.set(b, a); else parent.set(a, b);
  }
  return { find, union };
}

export function buildLeakageGraph(sourceSnapshot) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot)) return failure("dataset_source_snapshot_invalid", "sourceSnapshot");
  const nodes = sourceSnapshot.members.map((member) => {
    const semantic = { candidateId: member.candidateId, g4GradeRecordDigest: member.g4GradeRecordDigest, canonicalSha256: member.canonicalSha256, claimValuesDigest: member.claimValuesDigest };
    const nodeId = `ln_${sha256Hex(stableStringify(semantic)).slice(0, 24)}`;
    return deepFreeze({ nodeId, ...semantic });
  }).sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const nodeByCandidate = new Map(nodes.map((node) => [node.candidateId, node]));
  const groups = new Map();
  for (const member of sourceSnapshot.members) {
    for (const item of member.splitCouplingKeys) {
      if (!DATASET_COUPLING_KINDS.includes(item.kind) || typeof item.key !== "string" || !item.key.length || !/^[a-f0-9]{64}$/.test(item.sourceArtifactDigest || "")) return failure("leakage_graph_invalid", "splitCouplingKeys");
      const keyDigest = sha256Hex(stableStringify([item.kind, item.key]));
      const key = `${item.kind}:${keyDigest}`;
      if (!groups.has(key)) groups.set(key, { kind: item.kind, keyDigest, sourceDigests: new Set(), candidateIds: [] });
      const group = groups.get(key);
      group.sourceDigests.add(item.sourceArtifactDigest);
      group.candidateIds.push(member.candidateId);
    }
  }
  const edges = [];
  for (const group of groups.values()) {
    const candidateIds = [...new Set(group.candidateIds)].sort();
    for (let index = 1; index < candidateIds.length; index += 1) {
      const left = nodeByCandidate.get(candidateIds[0]);
      const right = nodeByCandidate.get(candidateIds[index]);
      const semantic = {
        leftNodeId: left.nodeId < right.nodeId ? left.nodeId : right.nodeId,
        rightNodeId: left.nodeId < right.nodeId ? right.nodeId : left.nodeId,
        couplingKind: group.kind,
        couplingKeyDigest: group.keyDigest,
        sourceArtifactDigest: sha256Hex(stableStringify([...group.sourceDigests].sort()))
      };
      edges.push(deepFreeze({ edgeId: `le_${sha256Hex(stableStringify(semantic)).slice(0, 24)}`, ...semantic }));
    }
  }
  const uniqueEdges = [...new Map(edges.map((edge) => [stableStringify([edge.leftNodeId, edge.rightNodeId, edge.couplingKind, edge.couplingKeyDigest]), edge])).values()].sort((a, b) => a.edgeId.localeCompare(b.edgeId));
  const uf = unionFind(nodes.map((node) => node.nodeId));
  for (const edge of uniqueEdges) uf.union(edge.leftNodeId, edge.rightNodeId);
  const componentGroups = new Map();
  for (const node of nodes) {
    const root = uf.find(node.nodeId);
    if (!componentGroups.has(root)) componentGroups.set(root, []);
    componentGroups.get(root).push(node);
  }
  const components = [...componentGroups.values()].map((componentNodes) => {
    const nodeIds = componentNodes.map((node) => node.nodeId).sort();
    const candidateIds = componentNodes.map((node) => node.candidateId).sort();
    const claimValuesDigests = [...new Set(componentNodes.map((node) => node.claimValuesDigest))].sort();
    const nodeSet = new Set(nodeIds);
    const couplingKinds = [...new Set(uniqueEdges.filter((edge) => nodeSet.has(edge.leftNodeId) && nodeSet.has(edge.rightNodeId)).map((edge) => edge.couplingKind))].sort();
    const componentFingerprint = sha256Hex(stableStringify(componentNodes.map((node) => [node.canonicalSha256, node.claimValuesDigest]).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)))));
    const semantic = { nodeIds, candidateIds, claimValuesDigests, couplingKinds, componentFingerprint };
    const componentDigest = sha256Hex(stableStringify(semantic));
    return deepFreeze({ componentId: `lc_${componentDigest.slice(0, 24)}`, ...semantic, componentDigest });
  }).sort((a, b) => a.componentId.localeCompare(b.componentId));
  const semantic = { schemaVersion: LEAKAGE_GRAPH_SCHEMA_VERSION, sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest, nodes, edges: uniqueEdges, components, graphPolicy: DATASET_GRAPH_POLICY_RECORD };
  const graph = deepFreeze({ ...semantic, graphDigest: sha256Hex(stableStringify(semantic)) });
  return verifyLeakageGraphIntegrity(graph) ? Object.freeze({ ok: true, graph }) : failure("leakage_graph_invalid", "graph");
}

export function verifyLeakageGraphIntegrity(graph) {
  if (!validateLeakageGraphShape(graph).ok || graph.graphPolicy.digest !== DATASET_GRAPH_POLICY_RECORD.digest) return false;
  const nodeIds = new Set(graph.nodes.map((node) => node.nodeId));
  if (nodeIds.size !== graph.nodes.length || graph.edges.some((edge) => !nodeIds.has(edge.leftNodeId) || !nodeIds.has(edge.rightNodeId) || edge.leftNodeId >= edge.rightNodeId)) return false;
  const componentNodeIds = graph.components.flatMap((component) => component.nodeIds);
  if (componentNodeIds.length !== graph.nodes.length || new Set(componentNodeIds).size !== graph.nodes.length || !componentNodeIds.every((id) => nodeIds.has(id))) return false;
  return graph.graphDigest === sha256Hex(stableStringify(graphSemantic(graph)));
}
