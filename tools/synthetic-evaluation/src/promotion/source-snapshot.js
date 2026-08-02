import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  PROMOTION_POLICY_ID,
  PROMOTION_POLICY_VERSION,
  PROMOTION_SOURCE_SNAPSHOT_SCHEMA_VERSION,
  immutableCandidateProjection,
  validatePromotionSourceSnapshotShape
} from "@bejewely/face-contracts";
import { resolveSafeContainedFile } from "../import/resolve-safe-path.js";
import { readJson } from "../judgment/artifact-store.js";
import { verifyIntentAlignmentIntegrity } from "../judgment/alignment.js";
import { readJudgmentConsensus, readJudgmentSubmissionByDigest } from "../judgment/blind-registrar.js";
import { verifyDerivedGradeRecordIntegrity } from "../judgment/grades.js";
import { readAndResolveCandidateIntent } from "../judgment/read-intent-artifacts.js";
import { prepareStoredJudgmentAlignment } from "../judgment/stored-alignment.js";
import {
  derivedGradeRecordRelativePath,
  intentAlignmentObjectRelativePath,
  toNativePath
} from "../judgment/storage-layout.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import {
  PROMOTION_POLICY_DIGEST,
  buildConsensusClaimProjection,
  buildPromotionKey
} from "./policy.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function semanticOf(snapshot) {
  const { assembledAt, sourceSnapshotDigest, ...semantic } = snapshot;
  return semantic;
}

async function readStoredAlignment(dataRoot, alignmentDigest) {
  if (!/^[a-f0-9]{64}$/.test(alignmentDigest || "")) throw Object.assign(new Error("alignment_artifact_conflict"), { code: "alignment_artifact_conflict" });
  const alignment = await readJson(toNativePath(dataRoot, intentAlignmentObjectRelativePath(alignmentDigest)));
  if (!verifyIntentAlignmentIntegrity(alignment) || alignment.alignmentDigest !== alignmentDigest) {
    throw Object.assign(new Error("alignment_artifact_conflict"), { code: "alignment_artifact_conflict" });
  }
  return alignment;
}

async function readStoredGrade(dataRoot, expected) {
  const record = await readJson(toNativePath(dataRoot, derivedGradeRecordRelativePath(expected.candidateId, expected.gradeRecordId)));
  if (!verifyDerivedGradeRecordIntegrity(record) || record.gradeRecordDigest !== expected.gradeRecordDigest || record.gradeRecordId !== expected.gradeRecordId) {
    throw Object.assign(new Error("grade_record_invalid"), { code: "grade_record_invalid" });
  }
  return record;
}

async function verifyCanonicalObject(dataRoot, manifest) {
  const expectedPath = manifest.asset.canonicalObjectRelativePath;
  const resolved = await resolveSafeContainedFile(dataRoot, expectedPath, "canonicalAsset");
  if (!resolved.ok) return false;
  try {
    const bytes = await readFile(resolved.absolutePath);
    return createHash("sha256").update(bytes).digest("hex") === manifest.asset.canonicalSha256;
  } catch {
    return false;
  }
}

async function reconstructJudgmentActors(dataRoot, consensus) {
  const digests = [...consensus.submissionDigests];
  if (consensus.adjudicatorSubmissionDigest) digests.push(consensus.adjudicatorSubmissionDigest);
  const submissions = await Promise.all(digests.map((digest) => readJudgmentSubmissionByDigest(dataRoot, digest)));
  const actorIds = [...new Set(submissions.map((submission) => submission.judge.judgeId))].sort();
  return Object.freeze({
    submissionDigests: [...digests].sort(),
    judgmentActorIds: actorIds,
    judgmentActorSetDigest: sha256Hex(stableStringify(actorIds))
  });
}

export async function assemblePromotionSourceSnapshot({
  dataRoot,
  candidateId,
  alignmentDigest,
  assembledAt = new Date().toISOString()
}) {
  if (!Number.isFinite(Date.parse(assembledAt))) return failure("promotion_source_snapshot_invalid", "assembledAt");
  let storedAlignment;
  try {
    storedAlignment = await readStoredAlignment(dataRoot, alignmentDigest);
  } catch (error) {
    return failure(error?.code || "alignment_artifact_conflict", "alignment");
  }
  if (storedAlignment.candidate.candidateId !== candidateId) return failure("candidate_alignment_mismatch", "alignment.candidate");

  const artifacts = await readAndResolveCandidateIntent({ dataRoot, candidateId });
  if (!artifacts.ok) return artifacts;
  if (!(await verifyCanonicalObject(dataRoot, artifacts.candidateManifest))) return failure("artifact_integrity_invalid", "candidate.canonicalAsset");

  let consensus;
  try {
    consensus = await readJudgmentConsensus(dataRoot, candidateId, storedAlignment.consensus.consensusDigest);
  } catch (error) {
    return failure(error?.code || "judgment_consensus_integrity_invalid", "consensus");
  }
  const regenerated = await prepareStoredJudgmentAlignment({
    dataRoot,
    candidateId,
    consensusDigest: consensus.consensusDigest,
    alignedAt: storedAlignment.alignedAt,
    recordedAt: assembledAt
  });
  if (!regenerated.ok) return regenerated;
  if (regenerated.alignment.alignmentDigest !== alignmentDigest) return failure("candidate_alignment_mismatch", "alignment", "stored_alignment_not_current");

  let g2;
  let g3;
  let actors;
  try {
    [g2, g3, actors] = await Promise.all([
      readStoredGrade(dataRoot, regenerated.g2),
      readStoredGrade(dataRoot, regenerated.g3),
      reconstructJudgmentActors(dataRoot, consensus)
    ]);
  } catch (error) {
    return failure(error?.code || "artifact_integrity_invalid", "storedEvidence");
  }

  const claimResult = buildConsensusClaimProjection({ consensus, alignment: storedAlignment });
  if (!claimResult.ok) return claimResult;
  const fullProjection = immutableCandidateProjection(artifacts.candidateManifest);
  const fullProjectionDigest = sha256Hex(stableStringify(fullProjection));
  const promotionKey = buildPromotionKey(candidateId, storedAlignment.generation.purpose, storedAlignment.policy.requiredAxesDigest);
  const semantic = {
    schemaVersion: PROMOTION_SOURCE_SNAPSHOT_SCHEMA_VERSION,
    promotionKey,
    candidate: {
      candidateId,
      candidateDigest: artifacts.candidateManifest.candidateDigest,
      fullProjectionDigest,
      canonicalSha256: artifacts.candidateManifest.asset.canonicalSha256,
      canonicalObjectRelativePath: artifacts.candidateManifest.asset.canonicalObjectRelativePath
    },
    generation: {
      purpose: storedAlignment.generation.purpose,
      specDigest: artifacts.candidateManifest.generation.specDigest,
      promptDigest: artifacts.candidateManifest.generation.promptDigest,
      providerProfileId: artifacts.candidateManifest.generation.providerProfileId,
      providerProfileVersion: artifacts.candidateManifest.generation.providerProfileVersion,
      exactReproductionAvailable: artifacts.candidateManifest.generation.providerRun.exactReproductionAvailable
    },
    observation: {
      runId: consensus.observationRunId,
      observationDigest: consensus.observationDigest,
      g2RecordDigest: g2.gradeRecordDigest
    },
    judgment: {
      consensusDigest: consensus.consensusDigest,
      alignmentDigest: storedAlignment.alignmentDigest,
      g3RecordDigest: g3.gradeRecordDigest,
      submissionDigests: actors.submissionDigests,
      judgmentActorIds: actors.judgmentActorIds,
      judgmentActorSetDigest: actors.judgmentActorSetDigest
    },
    claims: claimResult.claims,
    provenanceProjection: fullProjection,
    leakageInputs: {
      canonicalSha256: artifacts.candidateManifest.asset.canonicalSha256,
      campaignSeriesId: artifacts.candidateManifest.grouping.campaignSeriesId,
      lineage: artifacts.candidateManifest.grouping.lineage,
      exactCanonicalDuplicateOf: [...artifacts.candidateManifest.duplicateReferences.exactCanonicalDuplicateOf].sort(),
      nearestPerceptualCandidates: [...artifacts.candidateManifest.duplicateReferences.nearestPerceptualCandidates]
    },
    policy: {
      id: PROMOTION_POLICY_ID,
      version: PROMOTION_POLICY_VERSION,
      digest: PROMOTION_POLICY_DIGEST
    }
  };
  const sourceSnapshotDigest = sha256Hex(stableStringify(semantic));
  const snapshot = deepFreeze({ ...semantic, assembledAt, sourceSnapshotDigest });
  if (!verifyPromotionSourceSnapshotIntegrity(snapshot)) return failure("promotion_source_snapshot_invalid", "snapshot");
  return Object.freeze({
    ok: true,
    snapshot,
    context: Object.freeze({ alignment: storedAlignment, consensus, g2, g3 })
  });
}

export function verifyPromotionSourceSnapshotIntegrity(snapshot) {
  if (!validatePromotionSourceSnapshotShape(snapshot).ok) return false;
  if (snapshot.policy.digest !== PROMOTION_POLICY_DIGEST) return false;
  if (snapshot.candidate.fullProjectionDigest !== sha256Hex(stableStringify(snapshot.provenanceProjection))) return false;
  const actorIds = [...snapshot.judgment.judgmentActorIds].sort();
  if (stableStringify(actorIds) !== stableStringify(snapshot.judgment.judgmentActorIds)) return false;
  if (snapshot.judgment.judgmentActorSetDigest !== sha256Hex(stableStringify(actorIds))) return false;
  const requiredAxes = [...snapshot.claims.requiredAxes].sort();
  if (stableStringify(requiredAxes) !== stableStringify(snapshot.claims.requiredAxes)) return false;
  const claimValues = [...snapshot.claims.claimValues].sort((left, right) => left.axis.localeCompare(right.axis));
  if (stableStringify(claimValues) !== stableStringify(snapshot.claims.claimValues)) return false;
  if (snapshot.claims.claimValuesDigest !== sha256Hex(stableStringify(claimValues))) return false;
  if (snapshot.promotionKey !== buildPromotionKey(snapshot.candidate.candidateId, snapshot.generation.purpose, sha256Hex(stableStringify(requiredAxes)))) {
    return false;
  }
  return snapshot.sourceSnapshotDigest === sha256Hex(stableStringify(semanticOf(snapshot)));
}
