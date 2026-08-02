import assert from "node:assert/strict";
import test from "node:test";
import {
  buildJudgmentConsensus,
  verifyJudgmentConsensusIntegrity
} from "../../src/judgment/consensus.js";
import { finalizeJudgmentSubmission } from "../../src/judgment/submission.js";
import {
  createAssignment,
  createCandidateArtifacts,
  createSubmissionDraft
} from "./helpers.mjs";

function finalized(assignment, spec, judgeId, overrides = {}, judgeType = "human_reviewer") {
  const result = finalizeJudgmentSubmission({
    assignment,
    draft: createSubmissionDraft({ assignment, spec, judgeId, overrides, judgeType })
  });
  if (!result.ok) throw new Error(`submission_failed:${result.errors[0]?.code}`);
  return result.submission;
}

test("two independent identical reviewers create intent-free complete consensus", () => {
  const artifacts = createCandidateArtifacts({ fixture: "D" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const result = buildJudgmentConsensus({
    assignment,
    submissions: [
      finalized(assignment, artifacts.finalizedSpec, "judge_alpha"),
      finalized(assignment, artifacts.finalizedSpec, "judge_beta")
    ],
    sealedAt: "2026-08-02T02:00:00.000Z"
  });
  assert.equal(result.ok, true);
  assert.equal(result.consensus.status, "sealed_complete");
  assert.equal("purpose" in result.consensus, false);
  assert.equal("specDigest" in result.consensus, false);
  assert.equal(verifyJudgmentConsensusIntegrity(result.consensus), true);
});

test("duplicate reviewer identity is not independent evidence", () => {
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const one = finalized(assignment, artifacts.finalizedSpec, "judge_alpha");
  const result = buildJudgmentConsensus({ assignment, submissions: [one, one] });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "insufficient_independent_reviewers");
});

test("conflicting axis requires an intent-blind adjudicator", () => {
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const reviewers = [
    finalized(assignment, artifacts.finalizedSpec, "judge_alpha"),
    finalized(assignment, artifacts.finalizedSpec, "judge_beta", {
      "face.eyeDirection": { value: "upturned" }
    })
  ];
  const unresolved = buildJudgmentConsensus({ assignment, submissions: reviewers });
  assert.equal(unresolved.ok, true);
  assert.equal(unresolved.consensus.status, "needs_adjudication");
  assert.equal(unresolved.consensus.axes["face.eyeDirection"].status, "unresolved");

  const adjudicator = finalized(
    assignment,
    artifacts.finalizedSpec,
    "judge_gamma",
    {},
    "human_adjudicator"
  );
  const resolved = buildJudgmentConsensus({ assignment, submissions: reviewers, adjudicatorSubmission: adjudicator });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.consensus.status, "sealed_complete");
  assert.equal(resolved.consensus.axes["face.eyeDirection"].value, "level");
});

test("irrelevant unavailable face axis seals partial consensus without purpose leakage", () => {
  const artifacts = createCandidateArtifacts({ fixture: "B" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const unavailable = {
    "face.featureContrast": {
      status: "unavailable",
      value: null,
      reasons: ["axis_evidence_insufficient"]
    }
  };
  const result = buildJudgmentConsensus({
    assignment,
    submissions: [
      finalized(assignment, artifacts.finalizedSpec, "judge_alpha", unavailable),
      finalized(assignment, artifacts.finalizedSpec, "judge_beta", unavailable)
    ]
  });
  assert.equal(result.ok, true);
  assert.equal(result.consensus.status, "sealed_partial");
  assert.equal(result.consensus.axes["face.featureContrast"].status, "unavailable");
});
