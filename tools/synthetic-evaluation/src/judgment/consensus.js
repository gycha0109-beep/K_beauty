import {
  JUDGMENT_AXIS_KEYS,
  JUDGMENT_AXIS_REGISTRY,
  JUDGMENT_CONSENSUS_SCHEMA_VERSION,
  JUDGMENT_POLICY_ID,
  JUDGMENT_POLICY_VERSION,
  validateJudgmentConsensusShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyBlindJudgmentAssignmentIntegrity } from "./assignment.js";
import { verifyJudgmentSubmissionIntegrity } from "./submission.js";

function normalizedAxisValue(value) {
  return Array.isArray(value) ? [...value].sort() : value;
}

function canonicalValue(value) {
  return stableStringify(normalizedAxisValue(value));
}

function baseReferences(submissions) {
  const first = submissions[0];
  return {
    assignmentId: first.assignment.assignmentId,
    assignmentDigest: first.assignment.assignmentDigest,
    candidateId: first.assignment.candidateId,
    observationRunId: first.assignment.observationRunId,
    observationDigest: first.assignment.observationDigest,
    registryId: first.registry.id,
    registryVersion: first.registry.version
  };
}

function sameReferences(submission, base) {
  return submission.assignment.assignmentId === base.assignmentId &&
    submission.assignment.assignmentDigest === base.assignmentDigest &&
    submission.assignment.candidateId === base.candidateId &&
    submission.assignment.observationRunId === base.observationRunId &&
    submission.assignment.observationDigest === base.observationDigest &&
    submission.registry.id === base.registryId &&
    submission.registry.version === base.registryVersion;
}

function summarizeAxis(reviewerSubmissions, axis, adjudicatorSubmission) {
  const decisions = reviewerSubmissions.map((submission) => ({
    digest: submission.submissionDigest,
    decision: submission.axes[axis]
  }));
  const observed = decisions.filter(({ decision }) => decision.status === "observed");
  const nonObserved = decisions.filter(({ decision }) => decision.status !== "observed");
  let result;

  if (observed.length === decisions.length) {
    const values = new Map();
    for (const item of observed) {
      const normalized = normalizedAxisValue(item.decision.value);
      values.set(canonicalValue(normalized), normalized);
    }
    result = values.size === 1
      ? { status: "agreed", value: [...values.values()][0] }
      : { status: "unresolved", value: null };
  } else if (observed.length > 0) {
    result = { status: "unresolved", value: null };
  } else {
    const statuses = new Set(nonObserved.map(({ decision }) => decision.status));
    result = statuses.size === 1 && statuses.has("not_reviewed")
      ? { status: "not_reviewed", value: null }
      : { status: "unavailable", value: null };
  }

  if (result.status === "unresolved" && adjudicatorSubmission) {
    const decision = adjudicatorSubmission.axes[axis];
    if (decision.status === "observed") result = { status: "agreed", value: normalizedAxisValue(decision.value) };
    else if (decision.status === "not_reviewed") result = { status: "not_reviewed", value: null };
    else result = { status: "unavailable", value: null };
  }

  return deepFreeze({
    ...result,
    reviewerSubmissionDigests: decisions.map((item) => item.digest).sort(),
    adjudicatorSubmissionDigest: adjudicatorSubmission?.submissionDigest || null
  });
}

function consensusSemantic(consensus) {
  const { consensusId, consensusDigest, sealedAt, ...semantic } = consensus;
  return semantic;
}

function statusMatchesAxes(consensus) {
  const statuses = Object.values(consensus.axes || {}).map((axis) => axis.status);
  if (statuses.length !== JUDGMENT_AXIS_KEYS.length) return false;
  if (consensus.status === "sealed_complete") return statuses.every((status) => status === "agreed");
  if (consensus.status === "sealed_partial") {
    return !statuses.includes("unresolved") && statuses.includes("agreed") && statuses.some((status) => status !== "agreed");
  }
  if (consensus.status === "needs_adjudication") {
    return statuses.includes("unresolved") && consensus.adjudicatorSubmissionDigest === null;
  }
  if (consensus.status === "unreviewable") {
    return statuses.every((status) => status === "unavailable" || status === "not_reviewed");
  }
  return false;
}

export function buildJudgmentConsensus({ assignment, submissions, adjudicatorSubmission = null, sealedAt = new Date().toISOString() }) {
  if (!verifyBlindJudgmentAssignmentIntegrity(assignment)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_assignment_invalid", path: "assignment", detail: null }]) });
  }
  if (!Array.isArray(submissions) || submissions.length < 2 || !Number.isFinite(Date.parse(sealedAt))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "insufficient_independent_reviewers", path: "submissions", detail: null }]) });
  }
  if (!submissions.every(verifyJudgmentSubmissionIntegrity)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_submission_invalid", path: "submissions", detail: null }]) });
  }
  const reviewerSubmissions = submissions.filter((submission) => submission.judge.judgeType === "human_reviewer");
  if (reviewerSubmissions.length < 2 || reviewerSubmissions.length !== submissions.length) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "insufficient_independent_reviewers", path: "submissions", detail: null }]) });
  }
  const judgeIds = reviewerSubmissions.map((submission) => submission.judge.judgeId);
  if (new Set(judgeIds).size !== judgeIds.length) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "insufficient_independent_reviewers", path: "submissions", detail: "duplicate_judge" }]) });
  }
  const base = baseReferences(reviewerSubmissions);
  if (base.assignmentId !== assignment.assignmentId || base.assignmentDigest !== assignment.assignmentDigest || base.candidateId !== assignment.candidateId || base.observationRunId !== assignment.observationRunId || base.observationDigest !== assignment.observationDigest) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_consensus_integrity_invalid", path: "assignment", detail: "reference_mismatch" }]) });
  }
  if (!reviewerSubmissions.every((submission) => sameReferences(submission, base))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_consensus_integrity_invalid", path: "submissions", detail: "reference_mismatch" }]) });
  }

  if (adjudicatorSubmission) {
    if (!verifyJudgmentSubmissionIntegrity(adjudicatorSubmission) || adjudicatorSubmission.judge.judgeType !== "human_adjudicator" || !sameReferences(adjudicatorSubmission, base) || judgeIds.includes(adjudicatorSubmission.judge.judgeId)) {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_consensus_integrity_invalid", path: "adjudicatorSubmission", detail: null }]) });
    }
  }

  const reviewerOnlyAxes = Object.fromEntries(JUDGMENT_AXIS_KEYS.map((axis) => [axis, summarizeAxis(reviewerSubmissions, axis, null)]));
  const hasUnresolvedAxis = Object.values(reviewerOnlyAxes).some((axis) => axis.status === "unresolved");
  if (adjudicatorSubmission && !hasUnresolvedAxis) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_consensus_integrity_invalid", path: "adjudicatorSubmission", detail: "adjudicator_not_required" }]) });
  }
  const axes = adjudicatorSubmission
    ? Object.fromEntries(JUDGMENT_AXIS_KEYS.map((axis) => [axis, summarizeAxis(reviewerSubmissions, axis, adjudicatorSubmission)]))
    : reviewerOnlyAxes;
  const axisStatuses = Object.values(axes).map((axis) => axis.status);
  const allUnreviewable = reviewerSubmissions.every((submission) => submission.reviewability.status === "unreviewable");
  let status;
  if (allUnreviewable) status = "unreviewable";
  else if (axisStatuses.includes("unresolved")) status = "needs_adjudication";
  else if (axisStatuses.every((item) => item === "agreed")) status = "sealed_complete";
  else status = "sealed_partial";

  const semantic = {
    schemaVersion: JUDGMENT_CONSENSUS_SCHEMA_VERSION,
    candidateId: base.candidateId,
    observationRunId: base.observationRunId,
    observationDigest: base.observationDigest,
    canonicalSha256: assignment.canonicalAsset.sha256,
    assignment: {
      assignmentId: base.assignmentId,
      assignmentDigest: base.assignmentDigest
    },
    registry: {
      id: JUDGMENT_AXIS_REGISTRY.registryId,
      version: JUDGMENT_AXIS_REGISTRY.registryVersion
    },
    policy: {
      id: JUDGMENT_POLICY_ID,
      version: JUDGMENT_POLICY_VERSION,
      minimumIndependentReviewers: 2,
      automaticMajorityTieBreak: false,
      modelTieBreak: false
    },
    submissionDigests: reviewerSubmissions.map((submission) => submission.submissionDigest).sort(),
    adjudicatorSubmissionDigest: adjudicatorSubmission?.submissionDigest || null,
    status,
    axes
  };
  const consensusDigest = sha256Hex(stableStringify(semantic));
  const consensus = deepFreeze({
    ...semantic,
    consensusId: `jcon_${consensusDigest.slice(0, 24)}`,
    sealedAt,
    consensusDigest
  });
  return Object.freeze({ ok: true, consensus });
}

export function verifyJudgmentConsensusIntegrity(consensus) {
  if (!validateJudgmentConsensusShape(consensus).ok || !statusMatchesAxes(consensus)) return false;
  const digest = sha256Hex(stableStringify(consensusSemantic(consensus)));
  return consensus.consensusDigest === digest && consensus.consensusId === `jcon_${digest.slice(0, 24)}`;
}
