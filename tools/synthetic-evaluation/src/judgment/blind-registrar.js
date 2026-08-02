import {
  deepFreeze,
  sha256Hex,
  stableStringify
} from "../shared/canonical-json.js";
import { buildJudgmentConsensus, verifyJudgmentConsensusIntegrity } from "./consensus.js";
import { buildJudgmentExecutionClaim, finalizeJudgmentSubmission, verifyJudgmentSubmissionIntegrity } from "./submission.js";
import { readJson, writeContentAddressedJson, writeExclusiveJson } from "./artifact-store.js";
import {
  judgmentClaimRelativePath,
  judgmentConsensusRelativePath,
  judgmentSubmissionManifestRelativePath,
  judgmentSubmissionObjectRelativePath,
  toNativePath
} from "./storage-layout.js";

function submissionManifestSemantic(manifest) {
  const { registeredAt, manifestDigest, ...semantic } = manifest;
  return semantic;
}

function verifySubmissionManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== "judgment-submission-manifest-v1" || !/^[a-f0-9]{64}$/.test(manifest.manifestDigest || "")) return false;
  return sha256Hex(stableStringify(submissionManifestSemantic(manifest))) === manifest.manifestDigest;
}

async function readExistingSubmission(dataRoot, assignment, judgeId) {
  const manifestPath = toNativePath(dataRoot, judgmentSubmissionManifestRelativePath(assignment.assignmentId, judgeId));
  let manifest;
  try {
    manifest = await readJson(manifestPath);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  if (!verifySubmissionManifest(manifest) || manifest.assignmentId !== assignment.assignmentId || manifest.assignmentDigest !== assignment.assignmentDigest || manifest.judgeId !== judgeId) {
    throw Object.assign(new Error("judgment_submission_conflict"), { code: "judgment_submission_conflict" });
  }
  const submission = await readJson(toNativePath(dataRoot, manifest.objectRelativePath));
  if (!verifyJudgmentSubmissionIntegrity(submission) || submission.submissionDigest !== manifest.submissionDigest) {
    throw Object.assign(new Error("judgment_submission_conflict"), { code: "judgment_submission_conflict" });
  }
  return { manifest, submission };
}

export async function registerJudgmentSubmission({ dataRoot, assignment, draft, now = () => new Date().toISOString() }) {
  const finalized = finalizeJudgmentSubmission({ assignment, draft });
  if (!finalized.ok) return finalized;
  const submission = finalized.submission;
  const judgeId = submission.judge.judgeId;
  const existing = await readExistingSubmission(dataRoot, assignment, judgeId);
  if (existing) {
    if (existing.submission.submissionDigest !== submission.submissionDigest) {
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_submission_conflict", path: "submission", detail: null }]) });
    }
    return Object.freeze({ ok: true, state: "existing", submission: existing.submission, manifest: existing.manifest, writesPerformed: 0 });
  }

  const claimResult = buildJudgmentExecutionClaim({ assignment, judgeId, claimedAt: now() });
  if (!claimResult.ok) return claimResult;
  const claimPath = toNativePath(dataRoot, judgmentClaimRelativePath(assignment.assignmentId, judgeId));
  try {
    await writeExclusiveJson(claimPath, claimResult.claim);
  } catch (error) {
    if (error?.code === "EEXIST") {
      const afterRace = await readExistingSubmission(dataRoot, assignment, judgeId);
      if (afterRace?.submission.submissionDigest === submission.submissionDigest) {
        return Object.freeze({ ok: true, state: "existing", submission: afterRace.submission, manifest: afterRace.manifest, writesPerformed: 0 });
      }
      return Object.freeze({ ok: false, errors: Object.freeze([{ code: "judgment_claim_exists", path: "claim", detail: null }]) });
    }
    throw error;
  }

  const objectRelativePath = judgmentSubmissionObjectRelativePath(submission.submissionDigest);
  await writeContentAddressedJson(toNativePath(dataRoot, objectRelativePath), submission);
  const semantic = {
    schemaVersion: "judgment-submission-manifest-v1",
    assignmentId: assignment.assignmentId,
    assignmentDigest: assignment.assignmentDigest,
    candidateId: assignment.candidateId,
    observationDigest: assignment.observationDigest,
    judgeId,
    submissionDigest: submission.submissionDigest,
    objectRelativePath
  };
  const manifest = deepFreeze({ ...semantic, registeredAt: now(), manifestDigest: sha256Hex(stableStringify(semantic)) });
  const manifestPath = toNativePath(dataRoot, judgmentSubmissionManifestRelativePath(assignment.assignmentId, judgeId));
  try {
    await writeExclusiveJson(manifestPath, manifest);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const raced = await readExistingSubmission(dataRoot, assignment, judgeId);
    if (!raced || raced.submission.submissionDigest !== submission.submissionDigest) {
      throw Object.assign(new Error("judgment_submission_conflict"), { code: "judgment_submission_conflict" });
    }
    return Object.freeze({ ok: true, state: "existing", submission: raced.submission, manifest: raced.manifest, writesPerformed: 0 });
  }
  return Object.freeze({ ok: true, state: "registered", submission, manifest, writesPerformed: 3 });
}

export async function registerJudgmentConsensus({ dataRoot, assignment, submissions, adjudicatorSubmission = null, sealedAt }) {
  const built = buildJudgmentConsensus({ assignment, submissions, adjudicatorSubmission, sealedAt });
  if (!built.ok) return built;
  const consensus = built.consensus;
  const relativePath = judgmentConsensusRelativePath(consensus.candidateId, consensus.consensusDigest);
  const result = await writeContentAddressedJson(toNativePath(dataRoot, relativePath), consensus);
  return Object.freeze({ ok: true, state: result.created ? "registered" : "existing", consensus, objectRelativePath: relativePath, writesPerformed: result.created ? 1 : 0 });
}

export async function readJudgmentSubmissionByDigest(dataRoot, submissionDigest) {
  if (!/^[a-f0-9]{64}$/.test(submissionDigest || "")) throw Object.assign(new Error("judgment_submission_invalid"), { code: "judgment_submission_invalid" });
  const submission = await readJson(toNativePath(dataRoot, judgmentSubmissionObjectRelativePath(submissionDigest)));
  if (!verifyJudgmentSubmissionIntegrity(submission) || submission.submissionDigest !== submissionDigest) {
    throw Object.assign(new Error("judgment_submission_conflict"), { code: "judgment_submission_conflict" });
  }
  return submission;
}

export async function readJudgmentConsensus(dataRoot, candidateId, consensusDigest) {
  const consensus = await readJson(toNativePath(dataRoot, judgmentConsensusRelativePath(candidateId, consensusDigest)));
  if (!verifyJudgmentConsensusIntegrity(consensus) || consensus.candidateId !== candidateId || consensus.consensusDigest !== consensusDigest) {
    throw Object.assign(new Error("judgment_consensus_integrity_invalid"), { code: "judgment_consensus_integrity_invalid" });
  }
  return consensus;
}
