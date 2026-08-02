import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  registerJudgmentConsensus,
  registerJudgmentSubmission
} from "../../src/judgment/blind-registrar.js";
import { finalizeJudgmentSubmission } from "../../src/judgment/submission.js";
import { sha256Hex, stableStringify } from "../../src/shared/canonical-json.js";
import {
  createAssignment,
  createCandidateArtifacts,
  createSubmissionDraft
} from "./helpers.mjs";

function finalize(assignment, spec, judgeId) {
  const result = finalizeJudgmentSubmission({
    assignment,
    draft: createSubmissionDraft({ assignment, spec, judgeId })
  });
  if (!result.ok) throw new Error(`submission_failed:${result.errors[0]?.code}`);
  return result.submission;
}

test("submission registration is manifest-last, idempotent, and conflicting resubmission is rejected", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t5-submission-"));
  const artifacts = createCandidateArtifacts({ fixture: "C" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const draft = createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId: "judge_alpha" });
  const first = await registerJudgmentSubmission({ dataRoot: root, assignment, draft, now: () => "2026-08-02T02:00:00.000Z" });
  assert.equal(first.ok, true);
  assert.equal(first.state, "registered");
  assert.equal(first.writesPerformed, 3);

  const second = await registerJudgmentSubmission({ dataRoot: root, assignment, draft, now: () => "2026-08-03T02:00:00.000Z" });
  assert.equal(second.ok, true);
  assert.equal(second.state, "existing");
  assert.equal(second.writesPerformed, 0);

  const changed = createSubmissionDraft({
    assignment,
    spec: artifacts.finalizedSpec,
    judgeId: "judge_alpha",
    overrides: { "face.eyeDirection": { value: "upturned" } }
  });
  const conflict = await registerJudgmentSubmission({ dataRoot: root, assignment, draft: changed });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.errors[0].code, "judgment_submission_conflict");

  const manifest = JSON.parse(await readFile(path.join(root, "judgment", "manifests", assignment.assignmentId, "judge_alpha.json"), "utf8"));
  assert.equal(manifest.submissionDigest, first.submission.submissionDigest);
});

test("orphaned immutable claim blocks hidden resubmission", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t5-claim-"));
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const claimDir = path.join(root, "judgment", "claims", assignment.assignmentId);
  await mkdir(claimDir, { recursive: true });
  await writeFile(path.join(claimDir, "judge_alpha.json"), "{}\n", "utf8");
  const result = await registerJudgmentSubmission({
    dataRoot: root,
    assignment,
    draft: createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId: "judge_alpha" })
  });
  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "judgment_claim_exists");
});

test("submission manifest cannot redirect an object reference even with a recomputed manifest digest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t5-path-"));
  const artifacts = createCandidateArtifacts({ fixture: "A" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const draft = createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId: "judge_alpha" });
  const registered = await registerJudgmentSubmission({ dataRoot: root, assignment, draft });
  assert.equal(registered.ok, true);
  const manifestPath = path.join(root, "judgment", "manifests", assignment.assignmentId, "judge_alpha.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.objectRelativePath = "judgment/submissions/00/forged.json";
  const { registeredAt, manifestDigest, ...semantic } = manifest;
  manifest.manifestDigest = sha256Hex(stableStringify(semantic));
  await writeFile(manifestPath, `${stableStringify(manifest)}\n`, "utf8");
  await assert.rejects(
    registerJudgmentSubmission({ dataRoot: root, assignment, draft }),
    (error) => error?.code === "judgment_submission_conflict"
  );
});

test("consensus semantic identity remains idempotent across different sealing timestamps", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t5-consensus-"));
  const artifacts = createCandidateArtifacts({ fixture: "D" });
  const assignment = createAssignment(artifacts.candidateManifest);
  const submissions = [
    finalize(assignment, artifacts.finalizedSpec, "judge_alpha"),
    finalize(assignment, artifacts.finalizedSpec, "judge_beta")
  ];
  const first = await registerJudgmentConsensus({
    dataRoot: root,
    assignment,
    submissions,
    sealedAt: "2026-08-02T02:00:00.000Z"
  });
  const second = await registerJudgmentConsensus({
    dataRoot: root,
    assignment,
    submissions,
    sealedAt: "2026-08-03T02:00:00.000Z"
  });
  assert.equal(first.ok, true);
  assert.equal(first.state, "registered");
  assert.equal(second.ok, true);
  assert.equal(second.state, "existing");
  assert.equal(second.consensus.consensusDigest, first.consensus.consensusDigest);
  assert.equal(second.consensus.sealedAt, first.consensus.sealedAt);
});
