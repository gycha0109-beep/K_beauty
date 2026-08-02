import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { CANONICAL_OBSERVATION_PROFILE } from "@bejewely/face-contracts";
import { observeCandidate } from "../../src/observation/observe-candidate.js";
import { ELIGIBLE_PARITY_FIXTURE } from "../../src/observation/parity-fixtures.js";
import { CANONICAL_OBSERVATION_SNAPSHOT } from "../../src/observation/snapshot/canonical-v1.js";
import { candidateManifestRelativePath } from "../../src/import/storage-layout.js";
import { prepareBlindJudgmentAssignment } from "../../src/judgment/prepare-assignment.js";
import { finalizeJudgmentSubmission } from "../../src/judgment/submission.js";
import { registerJudgmentConsensus } from "../../src/judgment/blind-registrar.js";
import { prepareStoredJudgmentAlignment } from "../../src/judgment/stored-alignment.js";
import { createCandidateArtifacts, createSubmissionDraft } from "./helpers.mjs";

async function writeJson(root, relativePath, value) {
  const absolute = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value)}\n`, "utf8");
}

function advancingClock() {
  let tick = Date.parse("2026-08-02T00:00:00.000Z");
  return () => new Date(tick += 1000);
}

test("stored alignment re-verifies authoritative T4 artifacts before G2 and G3 derivation", async () => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t5-stored-align-"));
  const bytes = Buffer.from("authoritative-synthetic-canonical-image");
  const canonicalSha256 = createHash("sha256").update(bytes).digest("hex");
  const canonicalObjectRelativePath = `objects/canonical/sha256/${canonicalSha256.slice(0, 2)}/${canonicalSha256}.png`;
  const artifacts = createCandidateArtifacts({ fixture: "D" });
  const candidateManifest = JSON.parse(JSON.stringify(artifacts.candidateManifest));
  candidateManifest.asset.canonicalSha256 = canonicalSha256;
  candidateManifest.asset.canonicalObjectRelativePath = canonicalObjectRelativePath;

  await writeJson(dataRoot, candidateManifestRelativePath(candidateManifest.candidateId), candidateManifest);
  await writeJson(dataRoot, candidateManifest.generation.artifactReferences.spec.objectRelativePath, artifacts.finalizedSpec);
  await writeJson(dataRoot, candidateManifest.generation.artifactReferences.compiledPrompt.objectRelativePath, artifacts.compiledPrompt);
  const canonicalAbsolutePath = path.join(dataRoot, ...canonicalObjectRelativePath.split("/"));
  await mkdir(path.dirname(canonicalAbsolutePath), { recursive: true });
  await writeFile(canonicalAbsolutePath, bytes);

  const blindCandidate = {
    candidateId: candidateManifest.candidateId,
    canonicalAsset: {
      sha256: canonicalSha256,
      objectRelativePath: canonicalObjectRelativePath,
      transformPolicyVersion: "canonical-image-v1"
    }
  };
  const observationRequest = {
    schemaVersion: "observation-run-request-v1",
    candidate: blindCandidate,
    adapterProfile: {
      id: CANONICAL_OBSERVATION_PROFILE.id,
      version: CANONICAL_OBSERVATION_PROFILE.version
    },
    contractSnapshotId: CANONICAL_OBSERVATION_SNAPSHOT.snapshotId,
    execution: {
      mode: "provider_bounded",
      requestedModel: CANONICAL_OBSERVATION_PROFILE.providerModel,
      replicateOrdinal: 1
    }
  };
  const fakeFetch = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify(ELIGIBLE_PARITY_FIXTURE) } }],
    usage: { prompt_tokens: 10, completion_tokens: 20 }
  }), { status: 200, headers: { "content-type": "application/json" } });
  const observed = await observeCandidate({
    request: observationRequest,
    action: "execute",
    dataRoot,
    apiKey: "test-key",
    fetchImpl: fakeFetch,
    now: advancingClock()
  });
  assert.equal(observed.ok, true);

  const assignmentResult = await prepareBlindJudgmentAssignment({
    dataRoot,
    blindCandidate,
    observationRunId: observed.run.runId,
    issuedAt: "2026-08-02T01:00:00.000Z"
  });
  assert.equal(assignmentResult.ok, true);
  const assignment = assignmentResult.assignment;
  const submissions = ["judge_alpha", "judge_beta"].map((judgeId) => {
    const result = finalizeJudgmentSubmission({
      assignment,
      draft: createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId })
    });
    assert.equal(result.ok, true);
    return result.submission;
  });
  const registeredConsensus = await registerJudgmentConsensus({
    dataRoot,
    assignment,
    submissions,
    sealedAt: "2026-08-02T02:00:00.000Z"
  });
  assert.equal(registeredConsensus.ok, true);

  const prepared = await prepareStoredJudgmentAlignment({
    dataRoot,
    candidateId: candidateManifest.candidateId,
    consensusDigest: registeredConsensus.consensus.consensusDigest,
    alignedAt: "2026-08-02T03:00:00.000Z",
    recordedAt: "2026-08-02T04:00:00.000Z"
  });
  assert.equal(prepared.ok, true);
  assert.equal(prepared.alignment.overallVerdict, "aligned");
  assert.equal(prepared.g2.grade, "G2_OBSERVED");
  assert.equal(prepared.g3.grade, "G3_CONSENSUS_VALIDATED");
});
