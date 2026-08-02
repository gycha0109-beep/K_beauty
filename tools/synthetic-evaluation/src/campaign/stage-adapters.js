import { createBlindJudgmentInput } from "@bejewely/face-contracts";
import { resolveCandidateIntent } from "../judgment/intent-resolver.js";
import { verifyJudgmentConsensusIntegrity } from "../judgment/consensus.js";
import { verifyIntentAlignmentIntegrity } from "../judgment/alignment.js";
import {
  verifyObservationObjectIntegrity,
  verifyObservationRunManifestIntegrity
} from "../observation/artifact-integrity.js";
import {
  verifyG4GradeRecordIntegrity,
  verifyPromotionDecisionIntegrity,
  verifyPromotionStatusEventIntegrity
} from "../promotion/decision.js";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";

function failure(code, path, detail = null) {
  return Object.freeze({ ok: false, errors: Object.freeze([{ code, path, detail }]) });
}

function ref(track, artifactType, artifactDigest) {
  return Object.freeze({ track, artifactType, artifactDigest });
}

export function verifyCandidateStageArtifacts({ candidateManifest, finalizedSpec, compiledPrompt }) {
  const resolved = resolveCandidateIntent({ candidateManifest, finalizedSpec, compiledPrompt });
  if (!resolved.ok) return failure("source_artifact_integrity_invalid", "candidate", resolved.errors?.[0]?.code || null);
  return Object.freeze({
    ok: true,
    candidateId: candidateManifest.candidateId,
    canonicalSha256: candidateManifest.asset.canonicalSha256,
    sourceRefs: Object.freeze([
      ref("T3", "candidate-manifest", candidateManifest.candidateDigest),
      ref("T7", `candidate-id-${candidateManifest.candidateId}`, sha256Hex(candidateManifest.candidateId))
    ])
  });
}

export function verifyObservationStageArtifacts({ run, observationObject, candidateManifest }) {
  if (!verifyObservationRunManifestIntegrity(run) || !verifyObservationObjectIntegrity(observationObject) || run.observation?.digest !== observationObject.observationDigest || run.candidate?.candidateId !== candidateManifest?.candidateId || run.candidate?.canonicalSha256 !== candidateManifest?.asset?.canonicalSha256) return failure("source_artifact_integrity_invalid", "observation", null);
  try {
    createBlindJudgmentInput({
      run,
      observationObject,
      blindCandidate: {
        candidateId: candidateManifest.candidateId,
        canonicalAsset: {
          sha256: candidateManifest.asset.canonicalSha256,
          objectRelativePath: candidateManifest.asset.canonicalObjectRelativePath,
          transformPolicyVersion: candidateManifest.asset.canonicalTransformPolicyVersion
        }
      }
    });
  } catch {
    return failure("source_artifact_integrity_invalid", "observation", "blind_handoff_invalid");
  }
  const validIneligible = run.outcome === "observed_bundle" && observationObject.bundle?.eligibility?.eligible === false;
  return Object.freeze({
    ok: true,
    validIneligible,
    sourceRefs: Object.freeze([
      ref("T4", "observation-run", run.manifestDigest),
      ref("T4", "observation-object", observationObject.observationDigest)
    ])
  });
}

export function verifyConsensusStageArtifact({ consensus, candidateId, observationDigest }) {
  if (!verifyJudgmentConsensusIntegrity(consensus) || consensus.candidateId !== candidateId || consensus.observationDigest !== observationDigest || !["sealed_complete", "sealed_partial"].includes(consensus.status)) return failure("source_artifact_integrity_invalid", "consensus", null);
  return Object.freeze({ ok: true, sourceRefs: Object.freeze([ref("T5", "judgment-consensus", consensus.consensusDigest)]) });
}

export function verifyAlignmentStageArtifact({ alignment, candidateId, consensusDigest }) {
  if (!verifyIntentAlignmentIntegrity(alignment) || alignment.candidate.candidateId !== candidateId || alignment.consensus.consensusDigest !== consensusDigest) return failure("source_artifact_integrity_invalid", "alignment", null);
  return Object.freeze({ ok: true, sourceRefs: Object.freeze([ref("T5", "intent-alignment", alignment.alignmentDigest)]) });
}

export function verifyPromotionStageArtifacts({ decision, gradeRecord = null, statusEvent = null, candidateId }) {
  if (!verifyPromotionDecisionIntegrity(decision) || decision.candidateId !== candidateId) return failure("source_artifact_integrity_invalid", "promotionDecision", null);
  const sourceRefs = [ref("T6", "promotion-decision", decision.decisionDigest)];
  const reasonCodes = [];
  if (decision.outcome === "promoted_g4") {
    if (!verifyG4GradeRecordIntegrity(gradeRecord) || gradeRecord.candidateId !== candidateId || !verifyPromotionStatusEventIntegrity(statusEvent) || statusEvent.gradeRecordDigest !== gradeRecord.gradeRecordDigest || statusEvent.promotionKey !== decision.promotionKey || statusEvent.event !== "activated") return failure("source_artifact_integrity_invalid", "g4", null);
    sourceRefs.push(
      ref("T6", "g4-grade-record", gradeRecord.gradeRecordDigest),
      ref("T6", "promotion-key", sha256Hex(decision.promotionKey)),
      ref("T6", "split-coupling-keys", gradeRecord.splitCouplingKeysDigest),
      ref("T6", "promotion-status-event", statusEvent.eventDigest)
    );
    reasonCodes.push("promoted_g4");
  } else if (decision.outcome === "retained_g3_negative_control") reasonCodes.push("retained_g3_negative_control");
  else if (decision.outcome === "held") reasonCodes.push("promotion_held");
  else reasonCodes.push("promotion_rejected");
  return Object.freeze({ ok: true, sourceRefs: deepFreeze(sourceRefs), reasonCodes: Object.freeze(reasonCodes), bindingDigest: sha256Hex(stableStringify(sourceRefs)) });
}
