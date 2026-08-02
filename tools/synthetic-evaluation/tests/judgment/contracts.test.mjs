import assert from "node:assert/strict";
import test from "node:test";
import {
  validateDraftBlindJudgmentSubmission,
  validateFinalJudgmentSubmission
} from "@bejewely/face-contracts";
import {
  createBlindJudgmentAssignment,
  verifyBlindJudgmentAssignmentIntegrity
} from "../../src/judgment/assignment.js";
import {
  finalizeJudgmentSubmission,
  verifyJudgmentSubmissionIntegrity
} from "../../src/judgment/submission.js";
import {
  clone,
  createAssignment,
  createCandidateArtifacts,
  createSubmissionDraft
} from "./helpers.mjs";

test("blind assignment contains no generation intent and has deterministic identity", () => {
  const artifacts = createCandidateArtifacts({ fixture: "B" });
  const assignment = createAssignment(artifacts.candidateManifest);
  assert.equal(verifyBlindJudgmentAssignmentIntegrity(assignment), true);
  assert.equal("purpose" in assignment, false);
  assert.equal("conditionId" in assignment, false);
  assert.equal("specDigest" in assignment, false);
  assert.equal("prompt" in assignment, false);

  const rebuilt = createBlindJudgmentAssignment({
    schemaVersion: "blind-judgment-input-v1",
    candidateId: assignment.candidateId,
    observationRunId: assignment.observationRunId,
    observationDigest: assignment.observationDigest,
    canonicalAsset: assignment.canonicalAsset,
    observation: { status: "available", privacy: { sourceImagePersisted: false, rawProviderResponsePersisted: false } }
  }, { issuedAt: "2026-08-03T00:00:00.000Z" });
  assert.equal(rebuilt.ok, true);
  assert.equal(rebuilt.assignment.assignmentId, assignment.assignmentId);
  assert.equal(rebuilt.assignment.assignmentDigest, assignment.assignmentDigest);
});

test("submission contract rejects unknown fields, free text, and direct intent fields", () => {
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const source = createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId: "judge_alpha" });

  for (const mutation of [
    (draft) => { draft.note = "free text"; },
    (draft) => { draft.purpose = "skin_cue_control"; },
    (draft) => { draft.assignment.conditionId = "A"; },
    (draft) => { draft.judge.judgeId = "person@example.com"; }
  ]) {
    const draft = clone(source);
    mutation(draft);
    assert.equal(validateDraftBlindJudgmentSubmission(draft).ok, false);
  }
});

test("skin decisions enforce absence, count, and region consistency", () => {
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const invalid = createSubmissionDraft({
    assignment,
    spec: artifacts.finalizedSpec,
    judgeId: "judge_alpha",
    overrides: {
      "skin.redness.presence": { value: "none" },
      "skin.redness.regions": { value: ["left_cheek"] },
      "skin.blemishes.presence": { value: "none" },
      "skin.blemishes.countBand": { value: "three_to_five" }
    }
  });
  assert.equal(validateDraftBlindJudgmentSubmission(invalid).ok, false);
});

test("finalized submission is immutable and tampering invalidates its digest", () => {
  const artifacts = createCandidateArtifacts({ fixture: "C" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const result = finalizeJudgmentSubmission({
    assignment,
    draft: createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId: "judge_alpha" })
  });
  assert.equal(result.ok, true);
  assert.equal(validateFinalJudgmentSubmission(result.submission).ok, true);
  assert.equal(verifyJudgmentSubmissionIntegrity(result.submission), true);
  assert.equal(Object.isFrozen(result.submission.axes["skin.blemishes.countBand"]), true);

  const tampered = clone(result.submission);
  tampered.axes["skin.blemishes.countBand"].value = "six_plus";
  assert.equal(verifyJudgmentSubmissionIntegrity(tampered), false);
});
