import {
  ALIGNMENT_POLICY_ID,
  ALIGNMENT_POLICY_VERSION,
  DERIVED_GRADE_RECORD_SCHEMA_VERSION,
  INTENT_ALIGNMENT_SCHEMA_VERSION,
  JUDGMENT_AXIS_KEYS,
  JUDGMENT_AXIS_REGISTRY,
  JUDGMENT_CONSENSUS_SCHEMA_VERSION,
  JUDGMENT_POLICY_ID,
  JUDGMENT_POLICY_VERSION
} from "./constants.js";
import {
  ALIGNMENT_ID,
  ASSIGNMENT_ID,
  CANDIDATE_ID,
  CONSENSUS_ID,
  GRADE_RECORD_ID,
  HEX64,
  OBSERVATION_RUN_ID,
  contractError,
  exactKeys,
  isIso,
  isObject,
  validateObservedValue
} from "./helpers.js";

export function validateJudgmentConsensusShape(value) {
  const errors = [];
  const expected = ["schemaVersion", "consensusId", "candidateId", "observationRunId", "observationDigest", "canonicalSha256", "assignment", "registry", "policy", "submissionDigests", "adjudicatorSubmissionDigest", "status", "axes", "sealedAt", "consensusDigest"];
  if (!exactKeys(value, expected)) return Object.freeze({ ok: false, errors: Object.freeze([contractError("judgment_consensus_integrity_invalid", "$")]) });
  if (value.schemaVersion !== JUDGMENT_CONSENSUS_SCHEMA_VERSION || !CONSENSUS_ID.test(value.consensusId || "") || !HEX64.test(value.consensusDigest || "") || !CANDIDATE_ID.test(value.candidateId || "") || !OBSERVATION_RUN_ID.test(value.observationRunId || "") || !HEX64.test(value.observationDigest || "") || !HEX64.test(value.canonicalSha256 || "") || !["sealed_complete", "sealed_partial", "needs_adjudication", "unreviewable"].includes(value.status) || !isIso(value.sealedAt)) errors.push(contractError("judgment_consensus_integrity_invalid", "$"));
  if (!exactKeys(value.assignment, ["assignmentId", "assignmentDigest"]) || !ASSIGNMENT_ID.test(value.assignment?.assignmentId || "") || !HEX64.test(value.assignment?.assignmentDigest || "")) errors.push(contractError("judgment_consensus_integrity_invalid", "assignment"));
  if (!exactKeys(value.registry, ["id", "version"]) || value.registry.id !== JUDGMENT_AXIS_REGISTRY.registryId || value.registry.version !== JUDGMENT_AXIS_REGISTRY.registryVersion) errors.push(contractError("judgment_consensus_integrity_invalid", "registry"));
  if (!exactKeys(value.policy, ["id", "version", "minimumIndependentReviewers", "automaticMajorityTieBreak", "modelTieBreak"]) || value.policy.id !== JUDGMENT_POLICY_ID || value.policy.version !== JUDGMENT_POLICY_VERSION || value.policy.minimumIndependentReviewers !== 2 || value.policy.automaticMajorityTieBreak !== false || value.policy.modelTieBreak !== false) errors.push(contractError("judgment_consensus_integrity_invalid", "policy"));
  if (!Array.isArray(value.submissionDigests) || value.submissionDigests.length < 2 || !value.submissionDigests.every((item) => HEX64.test(item)) || new Set(value.submissionDigests).size !== value.submissionDigests.length) errors.push(contractError("judgment_consensus_integrity_invalid", "submissionDigests"));
  if (!(value.adjudicatorSubmissionDigest === null || HEX64.test(value.adjudicatorSubmissionDigest || ""))) errors.push(contractError("judgment_consensus_integrity_invalid", "adjudicatorSubmissionDigest"));
  validateConsensusAxes(value.axes, errors);
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function validateConsensusAxes(axes, errors) {
  if (!isObject(axes) || Object.keys(axes).length !== JUDGMENT_AXIS_KEYS.length || !JUDGMENT_AXIS_KEYS.every((axis) => Object.prototype.hasOwnProperty.call(axes, axis))) {
    errors.push(contractError("judgment_consensus_integrity_invalid", "axes"));
    return;
  }
  for (const axis of JUDGMENT_AXIS_KEYS) {
    const result = axes[axis];
    if (!exactKeys(result, ["status", "value", "reviewerSubmissionDigests", "adjudicatorSubmissionDigest"]) || !["agreed", "unresolved", "unavailable", "not_reviewed"].includes(result?.status)) {
      errors.push(contractError("judgment_consensus_integrity_invalid", `axes.${axis}`));
      continue;
    }
    if (result.status === "agreed") {
      if (!validateObservedValue(axis, result.value)) errors.push(contractError("judgment_consensus_integrity_invalid", `axes.${axis}.value`));
    } else if (result.value !== null) errors.push(contractError("judgment_consensus_integrity_invalid", `axes.${axis}.value`));
    if (!Array.isArray(result.reviewerSubmissionDigests) || result.reviewerSubmissionDigests.length < 2 || !result.reviewerSubmissionDigests.every((item) => HEX64.test(item))) errors.push(contractError("judgment_consensus_integrity_invalid", `axes.${axis}.reviewerSubmissionDigests`));
    if (!(result.adjudicatorSubmissionDigest === null || HEX64.test(result.adjudicatorSubmissionDigest || ""))) errors.push(contractError("judgment_consensus_integrity_invalid", `axes.${axis}.adjudicatorSubmissionDigest`));
  }
}

export function validateIntentAlignmentShape(value) {
  const errors = [];
  const expected = ["schemaVersion", "alignmentId", "candidate", "observation", "consensus", "generation", "policy", "axisResults", "overallVerdict", "promotionReviewEligible", "promotionBlockReasons", "alignedAt", "alignmentDigest"];
  if (!exactKeys(value, expected)) return Object.freeze({ ok: false, errors: Object.freeze([contractError("alignment_artifact_conflict", "$")]) });
  if (value.schemaVersion !== INTENT_ALIGNMENT_SCHEMA_VERSION || !ALIGNMENT_ID.test(value.alignmentId || "") || !HEX64.test(value.alignmentDigest || "") || !["aligned", "partially_aligned", "misaligned", "unverifiable", "target_match_pair_unverified", "blocked"].includes(value.overallVerdict) || !isIso(value.alignedAt) || typeof value.promotionReviewEligible !== "boolean" || !Array.isArray(value.promotionBlockReasons) || !value.promotionBlockReasons.every((item) => typeof item === "string" && /^[a-z0-9_]+$/.test(item))) errors.push(contractError("alignment_artifact_conflict", "$"));
  if (!exactKeys(value.candidate, ["candidateId", "candidateDigest", "canonicalSha256"]) || !CANDIDATE_ID.test(value.candidate?.candidateId || "") || !HEX64.test(value.candidate?.candidateDigest || "") || !HEX64.test(value.candidate?.canonicalSha256 || "")) errors.push(contractError("alignment_artifact_conflict", "candidate"));
  if (!exactKeys(value.observation, ["runId", "observationDigest"]) || !OBSERVATION_RUN_ID.test(value.observation?.runId || "") || !HEX64.test(value.observation?.observationDigest || "")) errors.push(contractError("alignment_artifact_conflict", "observation"));
  if (!exactKeys(value.consensus, ["consensusId", "consensusDigest"]) || !CONSENSUS_ID.test(value.consensus?.consensusId || "") || !HEX64.test(value.consensus?.consensusDigest || "")) errors.push(contractError("alignment_artifact_conflict", "consensus"));
  if (!exactKeys(value.generation, ["specDigest", "promptDigest", "purpose"]) || !HEX64.test(value.generation?.specDigest || "") || !HEX64.test(value.generation?.promptDigest || "") || typeof value.generation?.purpose !== "string") errors.push(contractError("alignment_artifact_conflict", "generation"));
  if (!exactKeys(value.policy, ["id", "version", "requiredAxes", "requiredAxesDigest"]) || value.policy.id !== ALIGNMENT_POLICY_ID || value.policy.version !== ALIGNMENT_POLICY_VERSION || !Array.isArray(value.policy.requiredAxes) || value.policy.requiredAxes.length === 0 || new Set(value.policy.requiredAxes).size !== value.policy.requiredAxes.length || !value.policy.requiredAxes.every((item) => JUDGMENT_AXIS_KEYS.includes(item)) || !HEX64.test(value.policy.requiredAxesDigest || "")) errors.push(contractError("alignment_artifact_conflict", "policy"));
  if (!Array.isArray(value.axisResults) || value.axisResults.length === 0 || value.axisResults.some((result) => !exactKeys(result, ["axis", "role", "intended", "judged", "verdict", "reasonCode"]) || typeof result.axis !== "string" || !["gate", "target", "diagnostic"].includes(result.role) || !["matched", "mismatched", "unverifiable", "not_applicable"].includes(result.verdict) || typeof result.reasonCode !== "string")) errors.push(contractError("alignment_artifact_conflict", "axisResults"));
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateDerivedGradeRecordShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "gradeRecordId", "candidateId", "grade", "scope", "sourceDigests", "recordedAt", "gradeRecordDigest"])) return Object.freeze({ ok: false, errors: Object.freeze([contractError("grade_record_invalid", "$")]) });
  if (value.schemaVersion !== DERIVED_GRADE_RECORD_SCHEMA_VERSION || !GRADE_RECORD_ID.test(value.gradeRecordId || "") || !HEX64.test(value.gradeRecordDigest || "") || !["G2_OBSERVED", "G3_CONSENSUS_VALIDATED"].includes(value.grade) || !CANDIDATE_ID.test(value.candidateId || "") || !isIso(value.recordedAt)) errors.push(contractError("grade_record_invalid", "$"));
  if (!exactKeys(value.scope, ["purpose", "policyId", "policyVersion", "requiredAxes", "requiredAxesDigest"]) || !(value.scope.purpose === null || typeof value.scope.purpose === "string") || typeof value.scope.policyId !== "string" || typeof value.scope.policyVersion !== "string" || !Array.isArray(value.scope.requiredAxes) || !HEX64.test(value.scope.requiredAxesDigest || "")) errors.push(contractError("grade_record_invalid", "scope"));
  if (!Array.isArray(value.sourceDigests) || value.sourceDigests.length < 2 || !value.sourceDigests.every((item) => HEX64.test(item)) || new Set(value.sourceDigests).size !== value.sourceDigests.length) errors.push(contractError("grade_record_invalid", "sourceDigests"));
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}
