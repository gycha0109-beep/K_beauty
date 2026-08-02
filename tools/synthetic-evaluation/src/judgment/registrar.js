import { readFile } from "node:fs/promises";
import {
  deepFreeze,
  sha256Hex,
  stableStringify
} from "../shared/canonical-json.js";
import { buildJudgmentConsensus, verifyJudgmentConsensusIntegrity } from "./consensus.js";
import { verifyIntentAlignmentIntegrity } from "./alignment.js";
import { verifyDerivedGradeRecordIntegrity } from "./grades.js";
import { buildJudgmentExecutionClaim, finalizeJudgmentSubmission, verifyJudgmentSubmissionIntegrity } from "./submission.js";
import { readJson, writeContentAddressedJson, writeExclusiveJson } from "./artifact-store.js";
import {
  derivedGradeRecordRelativePath,
  intentAlignmentManifestRelativePath,
  intentAlignmentObjectRelativePath,
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
  const objectPath = toNativePath(dataRoot, manifest.objectRelativePath);
  const submission = await readJson(objectPath);
  if (!verifyJudgmentSubmissionIntegrity(submission) || submission.submissionDigest !== manifest.submissionDigest) {
    throw Object.assign(new Error("judgment_submission_conflict"), { code: "judgment_submission_conflict" });
  }
  return { manifest, submission };
}

export async function registerJudgmentSubmission({
  dataRoot,
  assignment,
  draft,
  now = () => new Date().toISOString()
}) {
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

  const claimedAt = now();
  const claimResult = buildJudgmentExecutionClaim({ assignment, judgeId, claimedAt });
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
  const objectPath = toNativePath(dataRoot, objectRelativePath);
  await writeContentAddressedJson(objectPath, submission);
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
  const manifest = deepFreeze({
    ...semantic,
    registeredAt: now(),
    manifestDigest: sha256Hex(stableStringify(semantic))
  });
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

export async function registerIntentAlignment({ dataRoot, alignment, registeredAt = new Date().toISOString() }) {
  if (!verifyIntentAlignmentIntegrity(alignment)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "alignment_artifact_conflict", path: "alignment", detail: null }]) });
  }
  const objectRelativePath = intentAlignmentObjectRelativePath(alignment.alignmentDigest);
  const objectResult = await writeContentAddressedJson(toNativePath(dataRoot, objectRelativePath), alignment);
  const semantic = {
    schemaVersion: "intent-alignment-manifest-v1",
    alignmentId: alignment.alignmentId,
    alignmentDigest: alignment.alignmentDigest,
    candidateId: alignment.candidate.candidateId,
    consensusDigest: alignment.consensus.consensusDigest,
    objectRelativePath
  };
  const manifest = deepFreeze({
    ...semantic,
    registeredAt,
    manifestDigest: sha256Hex(stableStringify(semantic))
  });
  const manifestPath = toNativePath(dataRoot, intentAlignmentManifestRelativePath(alignment.candidate.candidateId, alignment.alignmentId));
  try {
    await writeExclusiveJson(manifestPath, manifest);
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
    const existing = JSON.parse(await readFile(manifestPath, "utf8"));
    if (existing.manifestDigest !== manifest.manifestDigest) {
      throw Object.assign(new Error("alignment_artifact_conflict"), { code: "alignment_artifact_conflict" });
    }
    return Object.freeze({ ok: true, state: "existing", alignment, manifest: existing, writesPerformed: objectResult.created ? 1 : 0 });
  }
  return Object.freeze({ ok: true, state: "registered", alignment, manifest, writesPerformed: (objectResult.created ? 1 : 0) + 1 });
}

export async function registerDerivedGradeRecord({ dataRoot, gradeRecord }) {
  if (!verifyDerivedGradeRecordIntegrity(gradeRecord)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "gradeRecord", detail: null }]) });
  }
  const relativePath = derivedGradeRecordRelativePath(gradeRecord.candidateId, gradeRecord.gradeRecordId);
  const result = await writeContentAddressedJson(toNativePath(dataRoot, relativePath), gradeRecord);
  return Object.freeze({ ok: true, state: result.created ? "registered" : "existing", gradeRecord, objectRelativePath: relativePath, writesPerformed: result.created ? 1 : 0 });
}

export async function readJudgmentSubmissionByDigest(dataRoot, submissionDigest) {
  if (!/^[a-f0-9]{64}$/.test(submissionDigest || "")) {
    throw Object.assign(new Error("judgment_submission_invalid"), { code: "judgment_submission_invalid" });
  }
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
