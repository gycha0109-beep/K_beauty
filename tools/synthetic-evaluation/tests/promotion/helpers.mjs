import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CANONICAL_OBSERVATION_PROFILE } from "@bejewely/face-contracts";
import { candidateManifestRelativePath } from "../../src/import/storage-layout.js";
import { observeCandidate } from "../../src/observation/observe-candidate.js";
import { ELIGIBLE_PARITY_FIXTURE } from "../../src/observation/parity-fixtures.js";
import { CANONICAL_OBSERVATION_SNAPSHOT } from "../../src/observation/snapshot/canonical-v1.js";
import { registerDerivedGradeRecord, registerIntentAlignment } from "../../src/judgment/alignment-registrar.js";
import { registerJudgmentConsensus, registerJudgmentSubmission } from "../../src/judgment/blind-registrar.js";
import { prepareBlindJudgmentAssignment } from "../../src/judgment/prepare-assignment.js";
import { prepareStoredJudgmentAlignment } from "../../src/judgment/stored-alignment.js";
import { createCandidateArtifacts, createSubmissionDraft } from "../judgment/helpers.mjs";

async function writeJson(root, relativePath, value) {
  const absolute = path.join(root, ...relativePath.split("/"));
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value)}\n`, "utf8");
}

function advancingClock() {
  let tick = Date.parse("2026-08-02T00:00:00.000Z");
  return () => new Date(tick += 1000);
}

export async function setupStoredPromotionCase({
  fixture = "D",
  purpose = null,
  markStatus = "absent",
  overrides = {},
  exactDuplicates = [],
  perceptualNeighbors = []
} = {}) {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "t6-promotion-"));
  const bytes = Buffer.from(`authoritative-synthetic-canonical-image:${fixture}:${purpose || "skin"}`);
  const canonicalSha256 = createHash("sha256").update(bytes).digest("hex");
  const canonicalObjectRelativePath = `objects/canonical/sha256/${canonicalSha256.slice(0, 2)}/${canonicalSha256}.png`;
  const artifacts = createCandidateArtifacts({ fixture, purpose, markStatus });
  const candidateManifest = JSON.parse(JSON.stringify(artifacts.candidateManifest));
  candidateManifest.asset.canonicalSha256 = canonicalSha256;
  candidateManifest.asset.canonicalObjectRelativePath = canonicalObjectRelativePath;
  candidateManifest.duplicateReferences.exactCanonicalDuplicateOf = [...exactDuplicates];
  candidateManifest.duplicateReferences.nearestPerceptualCandidates = [...perceptualNeighbors];

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
  const registeredSubmissions = [];
  for (const judgeId of ["judge_alpha", "judge_beta"]) {
    const registered = await registerJudgmentSubmission({
      dataRoot,
      assignment,
      draft: createSubmissionDraft({ assignment, spec: artifacts.finalizedSpec, judgeId, overrides }),
      now: () => "2026-08-02T01:30:00.000Z"
    });
    assert.equal(registered.ok, true);
    registeredSubmissions.push(registered.submission);
  }
  const registeredConsensus = await registerJudgmentConsensus({
    dataRoot,
    assignment,
    submissions: registeredSubmissions,
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
  const alignmentRegistration = await registerIntentAlignment({
    dataRoot,
    alignment: prepared.alignment,
    registeredAt: "2026-08-02T04:10:00.000Z"
  });
  assert.equal(alignmentRegistration.ok, true);
  assert.equal((await registerDerivedGradeRecord({ dataRoot, gradeRecord: prepared.g2 })).ok, true);
  assert.equal((await registerDerivedGradeRecord({ dataRoot, gradeRecord: prepared.g3 })).ok, true);

  return {
    dataRoot,
    artifacts,
    candidateManifest,
    alignment: prepared.alignment,
    consensus: registeredConsensus.consensus,
    g2: prepared.g2,
    g3: prepared.g3
  };
}

export function approvedPolicyReviewDrafts(snapshot, overrides = {}) {
  const base = {
    operatorReattestation: {
      operatorId: "operator_alpha",
      syntheticOnlyConfirmed: true,
      realPersonReferenceUsedConfirmed: false,
      currentManifestReviewed: true,
      attestedAt: "2026-08-02T05:00:00.000Z"
    },
    rightsReview: {
      reviewerId: "reviewer_rights",
      status: "approved",
      sourcePolicy: { id: "provider-internal-eval-policy", version: "1.0.0" },
      sourcePolicyEvidenceDigest: "1".repeat(64),
      reviewedAt: "2026-08-02T05:10:00.000Z"
    },
    assetPolicyReview: {
      reviewerId: "reviewer_asset",
      visibleExternalMark: "absent",
      prohibitedTransformationDetected: false,
      canonicalImageReviewed: true,
      reviewedAt: "2026-08-02T05:20:00.000Z"
    },
    leakageReview: {
      exactCanonicalDisposition: snapshot.leakageInputs.exactCanonicalDuplicateOf.length ? "representative_selected" : "unique",
      perceptualDisposition: snapshot.leakageInputs.nearestPerceptualCandidates.length ? "distinct_enough_for_internal_evaluation" : "no_review_candidates",
      splitCouplingKeys: snapshot.leakageInputs.exactCanonicalDuplicateOf.length
        ? [{ kind: "canonical", key: snapshot.candidate.canonicalSha256 }]
        : [],
      reviewerId: "reviewer_leakage",
      reviewedAt: "2026-08-02T05:30:00.000Z"
    }
  };
  return {
    ...base,
    ...overrides,
    operatorReattestation: { ...base.operatorReattestation, ...(overrides.operatorReattestation || {}) },
    rightsReview: { ...base.rightsReview, ...(overrides.rightsReview || {}) },
    assetPolicyReview: { ...base.assetPolicyReview, ...(overrides.assetPolicyReview || {}) },
    leakageReview: { ...base.leakageReview, ...(overrides.leakageReview || {}) }
  };
}

export function approvedPromotionReviewDraft(snapshot, reasonCodes = []) {
  return {
    reviewer: {
      reviewerId: "reviewer_promotion",
      roleSeparationAttested: true
    },
    decision: "approve_g4",
    confirmedScope: {
      purpose: snapshot.generation.purpose,
      claimValuesDigest: snapshot.claims.claimValuesDigest,
      useScope: "internal_evaluation_only",
      excludedClaimsDigest: createHash("sha256").update(JSON.stringify([...snapshot.claims.excludedClaims].sort())).digest("hex")
    },
    reasonCodes,
    completedAt: "2026-08-02T06:00:00.000Z"
  };
}
