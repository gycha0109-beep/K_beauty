import {
  BLIND_JUDGMENT_ASSIGNMENT_SCHEMA_VERSION,
  BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION,
  JUDGMENT_AXIS_KEYS,
  JUDGMENT_AXIS_REGISTRY
} from "./constants.js";
import {
  ASSIGNMENT_ID,
  CANDIDATE_ID,
  HEX64,
  JUDGE_ID,
  OBSERVATION_RUN_ID,
  SAFE_RELATIVE_PATH,
  SUBMISSION_ID,
  contractError,
  exactKeys,
  isIso,
  isObject,
  validateAxisDecision,
  validateObservationPaths,
  validateReasonList
} from "./helpers.js";

export function validateBlindJudgmentInput(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "candidateId", "observationRunId", "observationDigest", "canonicalAsset", "observation"])) {
    return Object.freeze({ ok: false, errors: Object.freeze([contractError("blind_judgment_input_unavailable", "$")]) });
  }
  if (value.schemaVersion !== "blind-judgment-input-v1" || !CANDIDATE_ID.test(value.candidateId || "") || !OBSERVATION_RUN_ID.test(value.observationRunId || "") || !HEX64.test(value.observationDigest || "")) {
    errors.push(contractError("blind_judgment_input_unavailable", "$"));
  }
  if (!exactKeys(value.canonicalAsset, ["sha256", "objectRelativePath"]) || !HEX64.test(value.canonicalAsset?.sha256 || "") || typeof value.canonicalAsset?.objectRelativePath !== "string" || !SAFE_RELATIVE_PATH.test(value.canonicalAsset.objectRelativePath)) {
    errors.push(contractError("blind_judgment_input_unavailable", "canonicalAsset"));
  }
  if (!isObject(value.observation) || value.observation.status !== "available" || value.observation.privacy?.sourceImagePersisted !== false || value.observation.privacy?.rawProviderResponsePersisted !== false) {
    errors.push(contractError("blind_judgment_input_unavailable", "observation"));
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateBlindJudgmentAssignment(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "assignmentId", "candidateId", "observationRunId", "observationDigest", "canonicalAsset", "registry", "issuedAt", "assignmentDigest"])) {
    return Object.freeze({ ok: false, errors: Object.freeze([contractError("judgment_assignment_invalid", "$")]) });
  }
  if (value.schemaVersion !== BLIND_JUDGMENT_ASSIGNMENT_SCHEMA_VERSION || !ASSIGNMENT_ID.test(value.assignmentId || "") || !CANDIDATE_ID.test(value.candidateId || "") || !OBSERVATION_RUN_ID.test(value.observationRunId || "") || !HEX64.test(value.observationDigest || "") || !HEX64.test(value.assignmentDigest || "") || !isIso(value.issuedAt)) {
    errors.push(contractError("judgment_assignment_invalid", "$"));
  }
  if (!exactKeys(value.canonicalAsset, ["sha256", "objectRelativePath"]) || !HEX64.test(value.canonicalAsset?.sha256 || "") || typeof value.canonicalAsset?.objectRelativePath !== "string" || !SAFE_RELATIVE_PATH.test(value.canonicalAsset.objectRelativePath)) {
    errors.push(contractError("judgment_assignment_invalid", "canonicalAsset"));
  }
  if (!exactKeys(value.registry, ["id", "version"]) || value.registry.id !== JUDGMENT_AXIS_REGISTRY.registryId || value.registry.version !== JUDGMENT_AXIS_REGISTRY.registryVersion) {
    errors.push(contractError("judgment_axis_registry_unsupported", "registry"));
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

export function validateDraftBlindJudgmentSubmission(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "assignment", "judge", "registry", "reviewability", "axes", "observationReview", "completedAt"])) {
    return Object.freeze({ ok: false, errors: Object.freeze([contractError("judgment_submission_invalid", "$")]) });
  }
  if (value.schemaVersion !== BLIND_JUDGMENT_SUBMISSION_SCHEMA_VERSION || !isIso(value.completedAt)) {
    errors.push(contractError("judgment_submission_invalid", "schemaVersion"));
  }
  if (!exactKeys(value.assignment, ["assignmentId", "assignmentDigest", "candidateId", "observationRunId", "observationDigest"]) || !ASSIGNMENT_ID.test(value.assignment?.assignmentId || "") || !HEX64.test(value.assignment?.assignmentDigest || "") || !CANDIDATE_ID.test(value.assignment?.candidateId || "") || !OBSERVATION_RUN_ID.test(value.assignment?.observationRunId || "") || !HEX64.test(value.assignment?.observationDigest || "")) {
    errors.push(contractError("judgment_submission_invalid", "assignment"));
  }
  if (!exactKeys(value.judge, ["judgeId", "judgeType"]) || !JUDGE_ID.test(value.judge?.judgeId || "") || !["human_reviewer", "human_adjudicator"].includes(value.judge?.judgeType)) {
    errors.push(contractError("judge_identity_invalid", "judge"));
  }
  if (!exactKeys(value.registry, ["id", "version"]) || value.registry.id !== JUDGMENT_AXIS_REGISTRY.registryId || value.registry.version !== JUDGMENT_AXIS_REGISTRY.registryVersion) {
    errors.push(contractError("judgment_axis_registry_unsupported", "registry"));
  }
  if (!exactKeys(value.reviewability, ["status", "reasons"]) || !["reviewable", "unreviewable"].includes(value.reviewability?.status)) {
    errors.push(contractError("judgment_submission_invalid", "reviewability"));
  } else {
    validateReasonList(value.reviewability.reasons, "reviewability.reasons", errors, { allowEmpty: value.reviewability.status === "reviewable" });
  }
  if (!isObject(value.axes) || Object.keys(value.axes).length !== JUDGMENT_AXIS_KEYS.length || !JUDGMENT_AXIS_KEYS.every((axis) => Object.prototype.hasOwnProperty.call(value.axes, axis))) {
    errors.push(contractError("judgment_submission_invalid", "axes"));
  } else {
    for (const axis of JUDGMENT_AXIS_KEYS) validateAxisDecision(axis, value.axes[axis], errors);
  }
  validateSkinCrossRules(value.axes, errors);
  if (!exactKeys(value.observationReview, ["agreement", "disputedObservationPaths", "reasons"]) || !["agree", "partial_disagreement", "disagree", "unreviewable"].includes(value.observationReview?.agreement)) {
    errors.push(contractError("judgment_submission_invalid", "observationReview"));
  } else {
    validateObservationPaths(value.observationReview.disputedObservationPaths, "observationReview.disputedObservationPaths", errors);
    validateReasonList(value.observationReview.reasons, "observationReview.reasons", errors);
  }
  if (value.reviewability?.status === "unreviewable" && value.observationReview?.agreement !== "unreviewable") {
    errors.push(contractError("judgment_submission_invalid", "observationReview.agreement"));
  }
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function validateSkinCrossRules(axes, errors) {
  if (!isObject(axes)) return;
  const rednessPresence = axes["skin.redness.presence"];
  const rednessRegions = axes["skin.redness.regions"];
  if (rednessPresence?.status === "observed" && rednessRegions?.status === "observed") {
    const none = rednessPresence.value === "none" && rednessRegions.value.length === 0;
    const visible = rednessPresence.value !== "none" && rednessRegions.value.length > 0;
    if (!none && !visible) errors.push(contractError("judgment_submission_invalid", "axes.skin.redness"));
  }
  const blemishPresence = axes["skin.blemishes.presence"];
  const blemishCount = axes["skin.blemishes.countBand"];
  const blemishRegions = axes["skin.blemishes.regions"];
  if (blemishPresence?.status === "observed" && blemishCount?.status === "observed" && blemishRegions?.status === "observed") {
    const none = blemishPresence.value === "none" && blemishCount.value === "none" && blemishRegions.value.length === 0;
    const visible = blemishPresence.value !== "none" && blemishCount.value !== "none" && blemishRegions.value.length > 0;
    if (!none && !visible) errors.push(contractError("judgment_submission_invalid", "axes.skin.blemishes"));
  }
}

export function validateFinalJudgmentSubmission(value) {
  if (!isObject(value) || !SUBMISSION_ID.test(value.submissionId || "") || !HEX64.test(value.submissionDigest || "")) {
    return Object.freeze({ ok: false, errors: Object.freeze([contractError("judgment_submission_invalid", "$")]) });
  }
  const { submissionId, submissionDigest, ...draft } = value;
  const result = validateDraftBlindJudgmentSubmission(draft);
  return Object.freeze({ ok: result.ok, errors: result.errors });
}
