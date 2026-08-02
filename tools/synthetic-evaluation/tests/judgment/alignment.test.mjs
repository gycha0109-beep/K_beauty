import assert from "node:assert/strict";
import test from "node:test";
import {
  alignJudgmentToIntent,
  verifyIntentAlignmentIntegrity
} from "../../src/judgment/alignment.js";
import { buildJudgmentConsensus } from "../../src/judgment/consensus.js";
import {
  deriveG3ConsensusRecord,
  verifyDerivedGradeRecordIntegrity
} from "../../src/judgment/grades.js";
import { finalizeJudgmentSubmission } from "../../src/judgment/submission.js";
import {
  createAssignment,
  createCandidateArtifacts,
  createSubmissionDraft
} from "./helpers.mjs";

function consensusFor(artifacts, overrides = {}) {
  const assignment = createAssignment(artifacts.candidateManifest);
  const submissions = ["judge_alpha", "judge_beta"].map((judgeId) => {
    const result = finalizeJudgmentSubmission({
      assignment,
      draft: createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId, overrides })
    });
    if (!result.ok) throw new Error(`submission_failed:${result.errors[0]?.code}`);
    return result.submission;
  });
  return buildJudgmentConsensus({ assignment, submissions }).consensus;
}

test("skin-control exact consensus aligns and creates purpose-scoped G3", () => {
  const artifacts = createCandidateArtifacts({ fixture: "D" });
  const consensus = consensusFor(artifacts);
  const result = alignJudgmentToIntent({ consensus, ...artifacts, alignedAt: "2026-08-02T03:00:00.000Z" });
  assert.equal(result.ok, true);
  assert.equal(result.alignment.overallVerdict, "aligned");
  assert.equal(result.alignment.promotionReviewEligible, true);
  assert.equal(verifyIntentAlignmentIntegrity(result.alignment), true);

  const g3 = deriveG3ConsensusRecord({ consensus, alignment: result.alignment, recordedAt: "2026-08-02T04:00:00.000Z" });
  assert.equal(g3.ok, true);
  assert.equal(g3.gradeRecord.scope.purpose, "skin_cue_control");
  assert.equal(g3.gradeRecord.scope.requiredAxes.includes("skin.blemishes.countBand"), true);
  assert.equal(verifyDerivedGradeRecordIntegrity(g3.gradeRecord), true);
});

test("absence target remains unverifiable when reviewers cannot support absence", () => {
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const consensus = consensusFor(artifacts, {
    "skin.redness.presence": { status: "uncertain", value: null, reasons: ["axis_evidence_insufficient"] }
  });
  const result = alignJudgmentToIntent({ consensus, ...artifacts });
  assert.equal(result.ok, true);
  assert.equal(result.alignment.overallVerdict, "unverifiable");
  assert.equal(result.alignment.promotionReviewEligible, false);
});

test("skin overshoot is a mismatch rather than a compensable score", () => {
  const artifacts = createCandidateArtifacts({ fixture: "B" });
  const consensus = consensusFor(artifacts, {
    "skin.redness.presence": { value: "moderate_or_higher" }
  });
  const result = alignJudgmentToIntent({ consensus, ...artifacts });
  assert.equal(result.ok, true);
  assert.equal(result.alignment.overallVerdict, "misaligned");
  assert.equal(result.alignment.axisResults.find((axis) => axis.axis === "skin.redness.presence").verdict, "mismatched");
});

test("face feature value can align while strength stays explicitly unverified", () => {
  const artifacts = createCandidateArtifacts({ purpose: "face_feature_control" });
  const consensus = consensusFor(artifacts);
  const result = alignJudgmentToIntent({ consensus, ...artifacts });
  assert.equal(result.ok, true);
  assert.equal(result.alignment.overallVerdict, "aligned");
  const strength = result.alignment.axisResults.find((axis) => axis.axis === "face.eyeDirection.strength");
  assert.equal(strength.verdict, "unverifiable");
  assert.equal(strength.role, "diagnostic");
});

test("mixed pilot may align but remains promotion blocked", () => {
  const artifacts = createCandidateArtifacts({ fixture: "B", purpose: "mixed_control_pilot" });
  const consensus = consensusFor(artifacts);
  const result = alignJudgmentToIntent({ consensus, ...artifacts });
  assert.equal(result.ok, true);
  assert.equal(result.alignment.overallVerdict, "aligned");
  assert.equal(result.alignment.promotionReviewEligible, false);
  assert.equal(result.alignment.promotionBlockReasons.includes("mixed_control_pilot_promotion_disabled"), true);
});

test("external mark hold blocks promotion review without rewriting alignment truth", () => {
  const artifacts = createCandidateArtifacts({ fixture: "A", markStatus: "present" });
  const consensus = consensusFor(artifacts);
  const result = alignJudgmentToIntent({ consensus, ...artifacts });
  assert.equal(result.ok, true);
  assert.equal(result.alignment.overallVerdict, "aligned");
  assert.equal(result.alignment.promotionReviewEligible, false);
  assert.equal(result.alignment.promotionBlockReasons.includes("external_mark_provenance_unresolved"), true);
});
