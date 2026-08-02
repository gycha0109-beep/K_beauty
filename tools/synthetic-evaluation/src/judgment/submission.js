import {
  BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION,
  JUDGMENT_EXECUTION_CLAIM_SCHEMA_VERSION,
  validateDraftBlindJudgmentSubmission,
  validateFinalJudgmentSubmission
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import { verifyBlindJudgmentAssignmentIntegrity } from "./assignment.js";

function draftSemantic(draft) {
  const { completedAt, ...semantic } = draft;
  return semantic;
}

function sameAssignmentReference(draft, assignment) {
  return draft.assignment.assignmentId === assignment.assignmentId &&
    draft.assignment.assignmentDigest === assignment.assignmentDigest &&
    draft.assignment.candidateId === assignment.candidateId &&
    draft.assignment.observationRunId === assignment.observationRunId &&
    draft.assignment.observationDigest === assignment.observationDigest;
}

export function buildJudgmentExecutionClaim({ assignment, judgeId, claimedAt = new Date().toISOString() }) {
  if (!verifyBlindJudgmentAssignmentIntegrity(assignment) || !/^judge_[a-z0-9][a-z0-9._-]{2,63}$/.test(judgeId || "") || !Number.isFinite(Date.parse(claimedAt))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_claim_invalid", path: "$", detail: null }]) });
  }
  return Object.freeze({
    ok: true,
    claim: deepFreeze({
      schemaVersion: JUDGMENT_EXECUTION_CLAIM_SCHEMA_VERSION,
      assignmentId: assignment.assignmentId,
      assignmentDigest: assignment.assignmentDigest,
      candidateId: assignment.candidateId,
      observationDigest: assignment.observationDigest,
      judgeId,
      claimedAt
    })
  });
}

export function finalizeJudgmentSubmission({ assignment, draft }) {
  if (!verifyBlindJudgmentAssignmentIntegrity(assignment)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_assignment_invalid", path: "assignment", detail: null }]) });
  }
  const validation = validateDraftBlindJudgmentSubmission(draft);
  if (!validation.ok) return validation;
  if (!sameAssignmentReference(draft, assignment)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_submission_invalid", path: "assignment", detail: "assignment_reference_mismatch" }]) });
  }
  if (draft.schemaVersion !== BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_submission_invalid", path: "schemaVersion", detail: null }]) });
  }
  const semantic = draftSemantic(draft);
  const submissionDigest = sha256Hex(stableStringify(semantic));
  const submission = deepFreeze({
    ...JSON.parse(JSON.stringify(draft)),
    submissionId: `jsub_${submissionDigest.slice(0, 24)}`,
    submissionDigest
  });
  return Object.freeze({ ok: true, submission });
}

export function verifyJudgmentSubmissionIntegrity(submission) {
  const validation = validateFinalJudgmentSubmission(submission);
  if (!validation.ok) return false;
  const { submissionId, submissionDigest, ...draft } = submission;
  const digest = sha256Hex(stableStringify(draftSemantic(draft)));
  return submissionDigest === digest && submissionId === `jsub_${digest.slice(0, 24)}`;
}
