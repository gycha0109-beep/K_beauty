import {
  ALIGNMENT_POLICY_ID,
  ALIGNMENT_POLICY_VERSION,
  DERIVED_GRADE_RECORD_SCHEMA_VERSION,
  validateDerivedGradeRecordShape
} from "@bejewely/face-contracts";
import { deepFreeze, sha256Hex, stableStringify } from "../shared/canonical-json.js";
import {
  verifyObservationObjectIntegrity,
  verifyObservationRunManifestIntegrity
} from "../observation/artifact-integrity.js";
import { verifyIntentAlignmentIntegrity } from "./alignment.js";
import { verifyJudgmentConsensusIntegrity } from "./consensus.js";

function gradeSemantic(record) {
  const { gradeRecordId, gradeRecordDigest, recordedAt, ...semantic } = record;
  return semantic;
}

function finalizeGrade(semantic, recordedAt) {
  if (!Number.isFinite(Date.parse(recordedAt))) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "recordedAt", detail: null }]) });
  }
  const gradeRecordDigest = sha256Hex(stableStringify(semantic));
  return Object.freeze({
    ok: true,
    gradeRecord: deepFreeze({
      ...semantic,
      gradeRecordId: `grd_${gradeRecordDigest.slice(0, 24)}`,
      recordedAt,
      gradeRecordDigest
    })
  });
}

function hasValidGradeSemantics(record) {
  const requiredAxes = record.scope.requiredAxes;
  const sortedAxes = [...requiredAxes].sort();
  if (
    stableStringify(requiredAxes) !== stableStringify(sortedAxes) ||
    new Set(requiredAxes).size !== requiredAxes.length ||
    record.scope.requiredAxesDigest !== sha256Hex(stableStringify(requiredAxes))
  ) {
    return false;
  }
  const sortedSources = [...record.sourceDigests].sort();
  if (stableStringify(record.sourceDigests) !== stableStringify(sortedSources)) return false;
  if (record.grade === "G2_OBSERVED") {
    return record.scope.purpose === null &&
      record.scope.policyId === "authoritative-observation-v1" &&
      record.scope.policyVersion === "1.0.0" &&
      requiredAxes.length === 0;
  }
  if (record.grade === "G3_CONSENSUS_VALIDATED") {
    return typeof record.scope.purpose === "string" &&
      record.scope.purpose.length > 0 &&
      record.scope.policyId === ALIGNMENT_POLICY_ID &&
      record.scope.policyVersion === ALIGNMENT_POLICY_VERSION &&
      requiredAxes.length > 0;
  }
  return false;
}

export function deriveG2ObservedRecord({ run, observationObject, recordedAt = new Date().toISOString() }) {
  if (
    !verifyObservationRunManifestIntegrity(run) ||
    !verifyObservationObjectIntegrity(observationObject) ||
    run.outcome !== "observed_bundle" ||
    run.authority !== "observed_image" ||
    run.execution?.mode !== "provider_bounded" ||
    run.observation?.digest !== observationObject.observationDigest ||
    run.candidate?.candidateId !== observationObject.candidateId ||
    run.candidate?.canonicalSha256 !== observationObject.canonicalSha256
  ) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "observation", detail: null }]) });
  }
  return finalizeGrade({
    schemaVersion: DERIVED_GRADE_RECORD_SCHEMA_VERSION,
    candidateId: run.candidate.candidateId,
    grade: "G2_OBSERVED",
    scope: {
      purpose: null,
      policyId: "authoritative-observation-v1",
      policyVersion: "1.0.0",
      requiredAxes: [],
      requiredAxesDigest: sha256Hex(stableStringify([]))
    },
    sourceDigests: [run.manifestDigest, observationObject.observationDigest].sort()
  }, recordedAt);
}

export function deriveG3ConsensusRecord({ consensus, alignment, recordedAt = new Date().toISOString() }) {
  if (!verifyJudgmentConsensusIntegrity(consensus) || !verifyIntentAlignmentIntegrity(alignment)) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "consensus", detail: null }]) });
  }
  if (
    alignment.consensus.consensusDigest !== consensus.consensusDigest ||
    alignment.candidate.candidateId !== consensus.candidateId ||
    !["sealed_complete", "sealed_partial"].includes(consensus.status)
  ) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "alignment", detail: "source_mismatch" }]) });
  }
  const requiredAxes = alignment.policy.requiredAxes;
  if (!Array.isArray(requiredAxes) || requiredAxes.length === 0 || !requiredAxes.every((axis) => consensus.axes?.[axis]?.status === "agreed")) {
    return Object.freeze({ ok: false, errors: Object.freeze([{ code: "grade_record_invalid", path: "scope.requiredAxes", detail: "axis_consensus_incomplete" }]) });
  }
  return finalizeGrade({
    schemaVersion: DERIVED_GRADE_RECORD_SCHEMA_VERSION,
    candidateId: alignment.candidate.candidateId,
    grade: "G3_CONSENSUS_VALIDATED",
    scope: {
      purpose: alignment.generation.purpose,
      policyId: alignment.policy.id,
      policyVersion: alignment.policy.version,
      requiredAxes,
      requiredAxesDigest: alignment.policy.requiredAxesDigest
    },
    sourceDigests: [consensus.consensusDigest, alignment.alignmentDigest].sort()
  }, recordedAt);
}

export function verifyDerivedGradeRecordIntegrity(record) {
  if (!validateDerivedGradeRecordShape(record).ok || !hasValidGradeSemantics(record)) return false;
  const digest = sha256Hex(stableStringify(gradeSemantic(record)));
  return record.gradeRecordDigest === digest && record.gradeRecordId === `grd_${digest.slice(0, 24)}`;
}
