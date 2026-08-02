import { DATASET_LOCK_REVIEW_SCHEMA_VERSION, validateDatasetLockReviewShape } from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyLeakageGraphIntegrity } from "./leakage.js";
import { verifyDatasetSourceSnapshotIntegrity } from "./source.js";
import { verifyDatasetSplitAssignmentIntegrity, verifyDatasetSplitPlanIntegrity } from "./split.js";

function failure(code, path, detail = null) { return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) }); }

function decisionSemantic(value) {
  return {
    schemaVersion: value.schemaVersion,
    sourceSnapshotDigest: value.sourceSnapshotDigest,
    leakageGraphDigest: value.leakageGraphDigest,
    splitPlanDigest: value.splitPlanDigest,
    assignmentDigest: value.assignmentDigest,
    reviewer: value.reviewer,
    confirmations: value.confirmations,
    decision: value.decision,
    reasonCodes: value.reasonCodes
  };
}

function submissionSemantic(value) {
  const { submissionDigest, ...semantic } = value;
  return semantic;
}

export function finalizeDatasetLockReview({ sourceSnapshot, leakageGraph, splitPlan, assignment, draft }) {
  if (!verifyDatasetSourceSnapshotIntegrity(sourceSnapshot) || !verifyLeakageGraphIntegrity(leakageGraph) || !verifyDatasetSplitPlanIntegrity(splitPlan) || !verifyDatasetSplitAssignmentIntegrity(assignment) || sourceSnapshot.sourceSnapshotDigest !== leakageGraph.sourceSnapshotDigest || splitPlan.sourceSnapshotDigest !== sourceSnapshot.sourceSnapshotDigest || assignment.splitPlanDigest !== splitPlan.planDigest) return failure("dataset_lock_review_invalid", "sources");
  const base = {
    schemaVersion: DATASET_LOCK_REVIEW_SCHEMA_VERSION,
    sourceSnapshotDigest: sourceSnapshot.sourceSnapshotDigest,
    leakageGraphDigest: leakageGraph.graphDigest,
    splitPlanDigest: splitPlan.planDigest,
    assignmentDigest: assignment.assignmentDigest,
    reviewer: draft?.reviewer,
    confirmations: draft?.confirmations,
    decision: draft?.decision,
    reasonCodes: [...new Set(draft?.reasonCodes || [])].sort()
  };
  const reviewDecisionDigest = sha256Hex(stableStringify(base));
  const value = { ...base, reviewDecisionDigest, completedAt: draft?.completedAt };
  const submission = deepFreeze({ ...value, submissionDigest: sha256Hex(stableStringify(value)) });
  if (!verifyDatasetLockReviewIntegrity(submission)) return failure("dataset_lock_review_invalid", "review");
  if (submission.decision !== "approve_lock") return failure("dataset_lock_rejected", "review.decision");
  return Object.freeze({ ok: true, submission });
}

export function verifyDatasetLockReviewIntegrity(value) {
  return validateDatasetLockReviewShape(value).ok &&
    value.reviewDecisionDigest === sha256Hex(stableStringify(decisionSemantic(value))) &&
    value.submissionDigest === sha256Hex(stableStringify(submissionSemantic(value)));
}
