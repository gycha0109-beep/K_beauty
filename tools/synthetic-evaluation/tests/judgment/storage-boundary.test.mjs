import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  registerJudgmentSubmission
} from "../../src/judgment/blind-registrar.js";
import {
  createAssignment,
  createCandidateArtifacts,
  createSubmissionDraft
} from "./helpers.mjs";

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
