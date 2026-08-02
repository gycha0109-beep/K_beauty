import {
  DATASET_ACTIVATION_MANIFEST_SCHEMA_VERSION,
  DATASET_LOCK_BASIS_SCHEMA_VERSION,
  DATASET_MEMBER_SCHEMA_VERSION,
  DATASET_VERSION_MANIFEST_SCHEMA_VERSION,
  DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION,
  G5_HOLDOUT_RECORD_SCHEMA_VERSION,
  G5_STATUS_EVENT_SCHEMA_VERSION,
  validateDatasetActivationManifestShape,
  validateDatasetLockBasisShape,
  validateDatasetMemberShape,
  validateDatasetVersionManifestShape,
  validateDatasetVersionStatusEventShape,
  validateG5HoldoutRecordShape,
  validateG5StatusEventShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { createExposureClaim, verifyDatasetExposureClaimIntegrity } from "./exposure.js";
import {
  DATASET_ACTIVATION_POLICY_RECORD,
  DATASET_LOCK_POLICY_RECORD,
  G5_HOLDOUT_POLICY_RECORD
} from "./policy.js";
import { verifyDatasetLockReviewIntegrity } from "./review.js";
import { verifyLeakageGraphIntegrity } from "./leakage.js";
import { verifyDatasetSourceSnapshotIntegrity } from "./source.js";
import { verifyDatasetSplitAssignmentIntegrity, verifyDatasetSplitPlanIntegrity } from "./split.js";

function failure(code, path, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) }); }
function semanticWithout(value, ...keys) { const clone = { ...value }; for (const key of keys) delete clone[key]; return clone; }

export function verifyDatasetMemberIntegrity(value) {
  return validateDatasetMemberShape(value).ok && value.memberDigest === sha256Hex(stableStringify(semanticWithout(value, "memberDigest")));
}
export function verifyDatasetLockBasisIntegrity(value) {
  return validateDatasetLockBasisShape(value).ok && value.lockPolicy.digest === DATASET_LOCK_POLICY_RECORD.digest && value.lockBasisDigest === sha256Hex(stableStringify(semanticWithout(value, "lockBasisDigest")));
}
export function verifyDatasetVersionManifestIntegrity(value) {
  if (!validateDatasetVersionManifestShape(value).ok) return false;
  const digest = sha256Hex(stableStringify(semanticWithout(value, "lockedAt", "datasetVersionDigest", "datasetVersionId")));
  return value.datasetVersionDigest === digest && value.datasetVersionId === `dsv_${digest.slice(0, 24)}`;
}
export function verifyDatasetVersionStatusEventIntegrity(value) {
  if (!validateDatasetVersionStatusEventShape(value).ok) return false;
  if (value.event === "activated" && (value.predecessorEventDigest !== null || value.reasonCodes.length !== 0)) return false;
  if (value.event !== "activated" && value.predecessorEventDigest === null) return false;
  return value.eventDigest === sha256Hex(stableStringify(semanticWithout(value, "recordedAt", "eventDigest")));
}
export function verifyG5StatusEventIntegrity(value) {
  if (!validateG5StatusEventShape(value).ok) return false;
  if (value.event === "activated" && (value.predecessorEventDigest !== null || value.reasonCodes.length !== 0)) return false;
  if (value.event !== "activated" && value.predecessorEventDigest === null) return false;
  return value.eventDigest === sha256Hex(stableStringify(semanticWithout(value, "recordedAt", "eventDigest")));
}
export function verifyG5HoldoutRecordIntegrity(value) {
  if (!validateG5HoldoutRecordShape(value).ok || value.policy.digest !== G5_HOLDOUT_POLICY_RECORD.digest) return false;
  const digest = sha256Hex(stableStringify(semanticWithout(value, "gradeRecordId", "recordedAt", "gradeRecordDigest")));
  return value.gradeRecordDigest === digest && value.gradeRecordId === `grd_${digest.slice(0, 24)}`;
}
export function verifyDatasetActivationManifestIntegrity(value) {
  return validateDatasetActivationManifestShape(value).ok && value.activationPolicyDigest === DATASET_ACTIVATION_POLICY_RECORD.digest && value.activationDigest === sha256Hex(stableStringify(semanticWithout(value, "activatedAt", "activationDigest")));
}

function memberIndex(members) {
  const semantic = {
    schemaVersion: "dataset-member-index-v1",
    memberDigests: members.map((member) => member.memberDigest).sort(),
    countsBySplit: Object.fromEntries(["train", "development", "validation", "test", "holdout"].map((split) => [split, members.filter((member) => member.split === split).length]))
  };
  return deepFreeze({ ...semantic, memberIndexDigest: sha256Hex(stableStringify(semantic)) });
}

function memberFor({ sourceSnapshot, graph, assignment, sourceMember }) {
  const node = graph.nodes.find((item) => item.candidateId === sourceMember.candidateId);
  const component = graph.components.find((item) => item.nodeIds.includes(node.nodeId));
  const splitAssignment = assignment.componentAssignments.find((item) => item.componentId === component.componentId);
  const semantic = {
    schemaVersion: DATASET_MEMBER_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    assignmentDigest: assignment.assignmentDigest,
    candidateId: sourceMember.candidateId,
    g4GradeRecordDigest: sourceMember.g4GradeRecordDigest,
    g4StatusHeadDigest: sourceMember.g4StatusHeadDigest,
    componentDigest: component.componentDigest,
    componentFingerprint: component.componentFingerprint,
    split: splitAssignment.assignedSplit,
    claimValuesDigest: sourceMember.claimValuesDigest,
    canonicalSha256: sourceMember.canonicalSha256
  };
  return deepFreeze({ ...semantic, memberDigest: sha256Hex(stableStringify(semantic)) });
}

export function prepareDatasetLockArtifacts({
  sourceSnapshot,
  leakageGraph,
  splitPlan,
  assignment,
  lockReview,
  exposureRegistry,
  predecessorDatasetVersionDigest = null,
  lockedAt = new Date().toISOString(),
  activatedAt = lockedAt
}) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot) || !verifyLeakageGraphIntegrity(leakageGraph) || !verifyDatasetSplitPlanIntegrity(splitPlan) || !verifyDatasetSplitAssignmentIntegrity(assignment) || !verifyDatasetLockReviewIntegrity(lockReview) || lockReview.decision !== "approve_lock" || exposureRegistry.registryDigest !== sourceSnapshot.priorExposureRegistryDigest) return failure("dataset_lock_invalid", "sources");
  const members = sourceSnapshot.members.map((sourceMember) => memberFor({ sourceSnapshot, graph: leakageGraph, assignment, sourceMember })).sort((a, b) => a.memberDigest.localeCompare(b.memberDigest));
  if (!members.every(verifyDatasetMemberIntegrity) || members.length !== sourceSnapshot.members.length) return failure("dataset_member_invalid", "members");
  const index = memberIndex(members);
  const lockBasisSemantic = {
    schemaVersion: DATASET_LOCK_BASIS_SCHEMA_VERSION,
    datasetId: sourceSnapshot.datasetId,
    datasetLineageId: sourceSnapshot.datasetLineageId,
    predecessorDatasetVersionDigest,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    leakageGraphDigest: leakageGraph.graphDigest,
    splitPlanDigest: splitPlan.planDigest,
    assignmentDigest: assignment.assignmentDigest,
    lockReviewDecisionDigest: lockReview.reviewDecisionDigest,
    lockReviewSubmissionDigest: lockReview.submissionDigest,
    labelSchemaDigest: sourceSnapshot.labelSchema.labelSchemaDigest,
    memberIndexDigest: index.memberIndexDigest,
    lockPolicy: DATASET_LOCK_POLICY_RECORD
  };
  const lockBasis = deepFreeze({ ...lockBasisSemantic, lockBasisDigest: sha256Hex(stableStringify(lockBasisSemantic)) });
  if (!verifyDatasetLockBasisIntegrity(lockBasis)) return failure("dataset_lock_basis_invalid", "lockBasis");
  const versionSemantic = {
    schemaVersion: DATASET_VERSION_MANIFEST_SCHEMA_VERSION,
    datasetId: sourceSnapshot.datasetId,
    datasetLineageId: sourceSnapshot.datasetLineageId,
    predecessorDatasetVersionDigest,
    lockBasisDigest: lockBasis.lockBasisDigest,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    leakageGraphDigest: leakageGraph.graphDigest,
    splitPlanDigest: splitPlan.planDigest,
    assignmentDigest: assignment.assignmentDigest,
    lockReviewDecisionDigest: lockReview.reviewDecisionDigest,
    lockReviewSubmissionDigest: lockReview.submissionDigest,
    labelSchemaDigest: sourceSnapshot.labelSchema.labelSchemaDigest,
    memberIndexDigest: index.memberIndexDigest
  };
  const datasetVersionDigest = sha256Hex(stableStringify(versionSemantic));
  const datasetVersion = deepFreeze({ ...versionSemantic, datasetVersionId: `dsv_${datasetVersionDigest.slice(0, 24)}`, lockedAt, datasetVersionDigest });
  if (!verifyDatasetVersionManifestIntegrity(datasetVersion)) return failure("dataset_version_manifest_invalid", "datasetVersion");

  const headByFingerprint = new Map((exposureRegistry.heads || []).map((head) => [head.componentFingerprint, head]));
  const exposureClaims = [];
  for (const componentAssignment of assignment.componentAssignments) {
    const component = leakageGraph.components.find((item) => item.componentId === componentAssignment.componentId);
    const prior = headByFingerprint.get(component.componentFingerprint) || null;
    const claimResult = createExposureClaim({
      datasetLineageId: sourceSnapshot.datasetLineageId,
      componentFingerprint: component.componentFingerprint,
      datasetVersionDigest,
      assignedSplit: componentAssignment.assignedSplit,
      predecessorClaimDigest: prior?.headClaimDigest || null,
      firstExposedAt: activatedAt
    });
    if (!claimResult.ok || (prior && prior.assignedSplit !== componentAssignment.assignedSplit)) return failure("exposure_registry_invalid", "exposureClaims");
    exposureClaims.push(claimResult.claim);
  }
  exposureClaims.sort((a, b) => a.claimDigest.localeCompare(b.claimDigest));
  const exposureClaimIndex = deepFreeze({ schemaVersion: "dataset-exposure-index-v1", claimDigests: exposureClaims.map((claim) => claim.claimDigest), exposureClaimIndexDigest: sha256Hex(stableStringify(exposureClaims.map((claim) => claim.claimDigest))) });

  const exposureByFingerprint = new Map(exposureClaims.map((claim) => [claim.componentFingerprint, claim]));
  const g5Records = members.filter((member) => member.split === "holdout").map((member) => {
    const sourceMember = sourceSnapshot.members.find((item) => item.candidateId === member.candidateId);
    const claim = exposureByFingerprint.get(member.componentFingerprint);
    const semantic = {
      schemaVersion: G5_HOLDOUT_RECORD_SCHEMA_VERSION,
      candidateId: member.candidateId,
      grade: "G5_LEAKAGE_LOCKED_HOLDOUT",
      sourceG4GradeRecordDigest: member.g4GradeRecordDigest,
      sourceG4StatusHeadDigest: sourceMember.g4StatusHeadDigest,
      datasetVersionDigest,
      datasetMemberDigest: member.memberDigest,
      leakageComponentDigest: member.componentDigest,
      split: "holdout",
      labelSchemaDigest: sourceSnapshot.labelSchema.labelSchemaDigest,
      exposureClaimDigest: claim.claimDigest,
      policy: G5_HOLDOUT_POLICY_RECORD
    };
    const digest = sha256Hex(stableStringify(semantic));
    return deepFreeze({ ...semantic, gradeRecordId: `grd_${digest.slice(0, 24)}`, recordedAt: activatedAt, gradeRecordDigest: digest });
  }).sort((a, b) => a.gradeRecordDigest.localeCompare(b.gradeRecordDigest));
  if (!g5Records.every(verifyG5HoldoutRecordIntegrity)) return failure("g5_holdout_record_invalid", "g5Records");
  const g5Index = deepFreeze({ schemaVersion: "g5-index-v1", gradeRecordDigests: g5Records.map((record) => record.gradeRecordDigest), g5IndexDigest: sha256Hex(stableStringify(g5Records.map((record) => record.gradeRecordDigest))) });

  const datasetStatusSemantic = { schemaVersion: DATASET_VERSION_STATUS_EVENT_SCHEMA_VERSION, datasetVersionDigest, event: "activated", reasonCodes: [], predecessorEventDigest: null };
  const datasetStatusEvent = deepFreeze({ ...datasetStatusSemantic, recordedAt: activatedAt, eventDigest: sha256Hex(stableStringify(datasetStatusSemantic)) });
  const g5StatusEvents = g5Records.map((record) => {
    const semantic = { schemaVersion: G5_STATUS_EVENT_SCHEMA_VERSION, g5GradeRecordDigest: record.gradeRecordDigest, event: "activated", reasonCodes: [], predecessorEventDigest: null };
    return deepFreeze({ ...semantic, recordedAt: activatedAt, eventDigest: sha256Hex(stableStringify(semantic)) });
  }).sort((a, b) => a.eventDigest.localeCompare(b.eventDigest));
  if (!verifyDatasetVersionStatusEventIntegrity(datasetStatusEvent) || !g5StatusEvents.every(verifyG5StatusEventIntegrity)) return failure("dataset_status_event_invalid", "statusEvents");
  const g5StatusHeadIndex = deepFreeze({ schemaVersion: "g5-status-head-index-v1", entries: g5StatusEvents.map((event) => ({ g5GradeRecordDigest: event.g5GradeRecordDigest, statusHeadDigest: event.eventDigest })), g5StatusHeadIndexDigest: sha256Hex(stableStringify(g5StatusEvents.map((event) => [event.g5GradeRecordDigest, event.eventDigest]))) });
  const activationSemantic = {
    schemaVersion: DATASET_ACTIVATION_MANIFEST_SCHEMA_VERSION,
    datasetVersionDigest,
    datasetStatusHeadDigest: datasetStatusEvent.eventDigest,
    exposureClaimIndexDigest: exposureClaimIndex.exposureClaimIndexDigest,
    g5IndexDigest: g5Index.g5IndexDigest,
    g5StatusHeadIndexDigest: g5StatusHeadIndex.g5StatusHeadIndexDigest,
    activationPolicyDigest: DATASET_ACTIVATION_POLICY_RECORD.digest
  };
  const activation = deepFreeze({ ...activationSemantic, activatedAt, activationDigest: sha256Hex(stableStringify(activationSemantic)) });
  if (!verifyDatasetActivationManifestIntegrity(activation)) return failure("dataset_activation_manifest_invalid", "activation");
  return Object.freeze({ ok: true, members, memberIndex: index, lockBasis, datasetVersion, exposureClaims, exposureClaimIndex, g5Records, g5Index, datasetStatusEvent, g5StatusEvents, g5StatusHeadIndex, activation });
}

export function projectLinearStatus(events, verifier, idKey) {
  if (!Array.isArray(events) || events.length === 0 || !events.every(verifier)) return failure("status_chain_invalid", "events");
  const ids = new Set(events.map((event) => event[idKey]));
  if (ids.size !== 1) return failure("status_chain_invalid", "events", "mixed_subject");
  const byDigest = new Map(events.map((event) => [event.eventDigest, event]));
  if (byDigest.size !== events.length) return failure("status_chain_invalid", "events", "duplicate");
  const roots = events.filter((event) => event.predecessorEventDigest === null);
  if (roots.length !== 1 || roots[0].event !== "activated") return failure("status_chain_invalid", "events", "invalid_root");
  const childCount = new Map();
  for (const event of events) {
    if (!event.predecessorEventDigest) continue;
    if (!byDigest.has(event.predecessorEventDigest)) return failure("status_chain_invalid", "events", "broken");
    childCount.set(event.predecessorEventDigest, (childCount.get(event.predecessorEventDigest) || 0) + 1);
  }
  if ([...childCount.values()].some((count) => count !== 1)) return failure("status_chain_invalid", "events", "branched");
  const leaves = events.filter((event) => !childCount.has(event.eventDigest));
  if (leaves.length !== 1) return failure("status_chain_invalid", "events", "ambiguous");
  let current = leaves[0]; const seen = new Set();
  while (current) { if (seen.has(current.eventDigest)) return failure("status_chain_invalid", "events", "cycle"); seen.add(current.eventDigest); current = current.predecessorEventDigest ? byDigest.get(current.predecessorEventDigest) : null; }
  if (seen.size !== events.length) return failure("status_chain_invalid", "events", "disconnected");
  return Object.freeze({ ok: true, latestEvent: leaves[0], active: leaves[0].event === "activated" });
}
