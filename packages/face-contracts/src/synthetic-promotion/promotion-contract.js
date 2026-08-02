import {
  G4_GRADE_RECORD_SCHEMA_VERSION,
  PROMOTION_ASSET_POLICY_REVIEW_SCHEMA_VERSION,
  PROMOTION_COUPLING_KINDS,
  PROMOTION_DECISION_OUTCOMES,
  PROMOTION_DECISION_SCHEMA_VERSION,
  PROMOTION_EVIDENCE_BUNDLE_SCHEMA_VERSION,
  PROMOTION_EXACT_DUPLICATE_DISPOSITIONS,
  PROMOTION_LEAKAGE_REVIEW_SCHEMA_VERSION,
  PROMOTION_MARK_STATUSES,
  PROMOTION_OPERATOR_REATTESTATION_SCHEMA_VERSION,
  PROMOTION_PERCEPTUAL_DISPOSITIONS,
  PROMOTION_POLICY_ID,
  PROMOTION_POLICY_VERSION,
  PROMOTION_REASON_CODES,
  PROMOTION_REVIEW_DECISIONS,
  PROMOTION_REVIEW_SUBMISSION_SCHEMA_VERSION,
  PROMOTION_RIGHTS_STATUSES,
  PROMOTION_SOURCE_SNAPSHOT_SCHEMA_VERSION,
  PROMOTION_STATUS_EVENT_SCHEMA_VERSION,
  PROMOTION_STATUS_EVENTS,
  PROMOTION_USE_SCOPE,
  USAGE_RIGHTS_REVIEW_SCHEMA_VERSION
} from "./constants.js";

const HEX64 = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^cand_[a-f0-9]{24}$/;
const PROMOTION_KEY = /^prom_[a-f0-9]{24}$/;
const GRADE_RECORD_ID = /^grd_[a-f0-9]{24}$/;
const ACTOR_ID = /^(?:operator|reviewer)_[a-z0-9][a-z0-9._-]{2,63}$/;
const TOKEN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const SAFE_RELATIVE_PATH = /^(?![A-Za-z]:)(?!\\\\)(?!\/)(?!.*(?:^|[\\/])\.\.(?:[\\/]|$))(?!.*\0).+$/;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isIso(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function uniqueStrings(value, pattern = null) {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string" && (!pattern || pattern.test(item))) &&
    new Set(value).size === value.length;
}

function enumValue(value, values) {
  return values.includes(value);
}

function result(errors) {
  return Object.freeze({ ok: errors.length === 0, errors: Object.freeze(errors) });
}

function push(errors, code, path, detail = null) {
  errors.push(Object.freeze({ code, path, detail }));
}

function validatePolicy(value, errors, path = "policy") {
  if (!exactKeys(value, ["id", "version", "digest"]) || value.id !== PROMOTION_POLICY_ID || value.version !== PROMOTION_POLICY_VERSION || !HEX64.test(value.digest || "")) {
    push(errors, "promotion_policy_invalid", path);
  }
}

function validateClaimValue(value) {
  return exactKeys(value, ["axis", "value"]) && typeof value.axis === "string" && value.axis.length > 0 && value.value !== undefined;
}

export function validatePromotionSourceSnapshotShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "promotionKey", "candidate", "generation", "observation", "judgment", "claims", "provenanceProjection", "leakageInputs", "policy", "assembledAt", "sourceSnapshotDigest"])) {
    return result([Object.freeze({ code: "promotion_source_snapshot_invalid", path: "$", detail: null })]);
  }
  if (value.schemaVersion !== PROMOTION_SOURCE_SNAPSHOT_SCHEMA_VERSION || !PROMOTION_KEY.test(value.promotionKey || "") || !isIso(value.assembledAt) || !HEX64.test(value.sourceSnapshotDigest || "")) push(errors, "promotion_source_snapshot_invalid", "$" );
  if (!exactKeys(value.candidate, ["candidateId", "candidateDigest", "fullProjectionDigest", "canonicalSha256", "canonicalObjectRelativePath"]) || !CANDIDATE_ID.test(value.candidate?.candidateId || "") || !HEX64.test(value.candidate?.candidateDigest || "") || !HEX64.test(value.candidate?.fullProjectionDigest || "") || !HEX64.test(value.candidate?.canonicalSha256 || "") || !SAFE_RELATIVE_PATH.test(value.candidate?.canonicalObjectRelativePath || "")) push(errors, "promotion_source_snapshot_invalid", "candidate");
  if (!exactKeys(value.generation, ["purpose", "specDigest", "promptDigest", "providerProfileId", "providerProfileVersion", "exactReproductionAvailable"]) || typeof value.generation?.purpose !== "string" || !HEX64.test(value.generation?.specDigest || "") || !HEX64.test(value.generation?.promptDigest || "") || !TOKEN.test(value.generation?.providerProfileId || "") || !TOKEN.test(value.generation?.providerProfileVersion || "") || typeof value.generation?.exactReproductionAvailable !== "boolean") push(errors, "promotion_source_snapshot_invalid", "generation");
  if (!exactKeys(value.observation, ["runId", "observationDigest", "g2RecordDigest"]) || typeof value.observation?.runId !== "string" || !HEX64.test(value.observation?.observationDigest || "") || !HEX64.test(value.observation?.g2RecordDigest || "")) push(errors, "promotion_source_snapshot_invalid", "observation");
  if (!exactKeys(value.judgment, ["consensusDigest", "alignmentDigest", "g3RecordDigest", "submissionDigests", "judgmentActorIds", "judgmentActorSetDigest"]) || !HEX64.test(value.judgment?.consensusDigest || "") || !HEX64.test(value.judgment?.alignmentDigest || "") || !HEX64.test(value.judgment?.g3RecordDigest || "") || !uniqueStrings(value.judgment?.submissionDigests, HEX64) || !uniqueStrings(value.judgment?.judgmentActorIds) || !HEX64.test(value.judgment?.judgmentActorSetDigest || "")) push(errors, "promotion_source_snapshot_invalid", "judgment");
  if (!exactKeys(value.claims, ["requiredAxes", "claimValues", "claimValuesDigest", "excludedClaims"]) || !uniqueStrings(value.claims?.requiredAxes) || !Array.isArray(value.claims?.claimValues) || !value.claims.claimValues.every(validateClaimValue) || !HEX64.test(value.claims?.claimValuesDigest || "") || !uniqueStrings(value.claims?.excludedClaims)) push(errors, "promotion_source_snapshot_invalid", "claims");
  if (!isObject(value.provenanceProjection) || !isObject(value.leakageInputs)) push(errors, "promotion_source_snapshot_invalid", "projection");
  validatePolicy(value.policy, errors);
  return result(errors);
}

export function validatePromotionOperatorReattestationShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "candidateId", "sourceSnapshotDigest", "fullProjectionDigest", "operatorId", "syntheticOnlyConfirmed", "realPersonReferenceUsedConfirmed", "currentManifestReviewed", "attestedAt", "attestationDigest"])) return result([Object.freeze({ code: "promotion_reattestation_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== PROMOTION_OPERATOR_REATTESTATION_SCHEMA_VERSION || !CANDIDATE_ID.test(value.candidateId || "") || !HEX64.test(value.sourceSnapshotDigest || "") || !HEX64.test(value.fullProjectionDigest || "") || !ACTOR_ID.test(value.operatorId || "") || value.syntheticOnlyConfirmed !== true || value.realPersonReferenceUsedConfirmed !== false || value.currentManifestReviewed !== true || !isIso(value.attestedAt) || !HEX64.test(value.attestationDigest || "")) push(errors, "promotion_reattestation_invalid", "$" );
  return result(errors);
}

export function validateUsageRightsReviewShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "candidateId", "sourceSnapshotDigest", "providerProfileId", "reviewScope", "status", "reviewerId", "sourcePolicy", "sourcePolicyEvidenceDigest", "reviewedAt", "reviewDigest"])) return result([Object.freeze({ code: "promotion_rights_review_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== USAGE_RIGHTS_REVIEW_SCHEMA_VERSION || !CANDIDATE_ID.test(value.candidateId || "") || !HEX64.test(value.sourceSnapshotDigest || "") || !TOKEN.test(value.providerProfileId || "") || value.reviewScope !== PROMOTION_USE_SCOPE || !enumValue(value.status, PROMOTION_RIGHTS_STATUSES) || !ACTOR_ID.test(value.reviewerId || "") || !exactKeys(value.sourcePolicy, ["id", "version"]) || !TOKEN.test(value.sourcePolicy?.id || "") || !TOKEN.test(value.sourcePolicy?.version || "") || !HEX64.test(value.sourcePolicyEvidenceDigest || "") || !isIso(value.reviewedAt) || !HEX64.test(value.reviewDigest || "")) push(errors, "promotion_rights_review_invalid", "$" );
  return result(errors);
}

export function validatePromotionAssetPolicyReviewShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "candidateId", "sourceSnapshotDigest", "canonicalSha256", "reviewerId", "visibleExternalMark", "prohibitedTransformationDetected", "canonicalImageReviewed", "reviewedAt", "reviewDigest"])) return result([Object.freeze({ code: "promotion_asset_review_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== PROMOTION_ASSET_POLICY_REVIEW_SCHEMA_VERSION || !CANDIDATE_ID.test(value.candidateId || "") || !HEX64.test(value.sourceSnapshotDigest || "") || !HEX64.test(value.canonicalSha256 || "") || !ACTOR_ID.test(value.reviewerId || "") || !enumValue(value.visibleExternalMark, PROMOTION_MARK_STATUSES) || typeof value.prohibitedTransformationDetected !== "boolean" || value.canonicalImageReviewed !== true || !isIso(value.reviewedAt) || !HEX64.test(value.reviewDigest || "")) push(errors, "promotion_asset_review_invalid", "$" );
  return result(errors);
}

export function validatePromotionLeakageReviewShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "candidateId", "sourceSnapshotDigest", "exactCanonicalDisposition", "perceptualDisposition", "splitCouplingKeys", "reviewerId", "reviewedAt", "reviewDigest"])) return result([Object.freeze({ code: "promotion_leakage_review_invalid", path: "$", detail: null })]);
  const keys = value.splitCouplingKeys;
  if (value.schemaVersion !== PROMOTION_LEAKAGE_REVIEW_SCHEMA_VERSION || !CANDIDATE_ID.test(value.candidateId || "") || !HEX64.test(value.sourceSnapshotDigest || "") || !enumValue(value.exactCanonicalDisposition, PROMOTION_EXACT_DUPLICATE_DISPOSITIONS) || !enumValue(value.perceptualDisposition, PROMOTION_PERCEPTUAL_DISPOSITIONS) || !Array.isArray(keys) || !keys.every((item) => exactKeys(item, ["kind", "key"]) && enumValue(item.kind, PROMOTION_COUPLING_KINDS) && typeof item.key === "string" && item.key.length > 0) || !ACTOR_ID.test(value.reviewerId || "") || !isIso(value.reviewedAt) || !HEX64.test(value.reviewDigest || "")) push(errors, "promotion_leakage_review_invalid", "$" );
  return result(errors);
}

export function validatePromotionEvidenceBundleShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "promotionKey", "sourceSnapshotDigest", "operatorReattestationDigest", "rightsReviewDigest", "assetPolicyReviewDigest", "leakageReviewDigest", "policyDigest", "assembledAt", "bundleDigest"])) return result([Object.freeze({ code: "promotion_evidence_bundle_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== PROMOTION_EVIDENCE_BUNDLE_SCHEMA_VERSION || !PROMOTION_KEY.test(value.promotionKey || "") || !["sourceSnapshotDigest", "operatorReattestationDigest", "rightsReviewDigest", "assetPolicyReviewDigest", "leakageReviewDigest", "policyDigest", "bundleDigest"].every((key) => HEX64.test(value[key] || "")) || !isIso(value.assembledAt)) push(errors, "promotion_evidence_bundle_invalid", "$" );
  return result(errors);
}

export function validatePromotionReviewSubmissionShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "promotionKey", "evidenceBundleDigest", "reviewer", "decision", "confirmedScope", "reasonCodes", "completedAt", "submissionDigest"])) return result([Object.freeze({ code: "promotion_review_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== PROMOTION_REVIEW_SUBMISSION_SCHEMA_VERSION || !PROMOTION_KEY.test(value.promotionKey || "") || !HEX64.test(value.evidenceBundleDigest || "") || !exactKeys(value.reviewer, ["reviewerId", "role", "roleSeparationAttested"]) || !ACTOR_ID.test(value.reviewer?.reviewerId || "") || value.reviewer?.role !== "promotion_reviewer" || value.reviewer?.roleSeparationAttested !== true || !enumValue(value.decision, PROMOTION_REVIEW_DECISIONS) || !exactKeys(value.confirmedScope, ["purpose", "claimValuesDigest", "useScope", "excludedClaimsDigest"]) || typeof value.confirmedScope?.purpose !== "string" || !HEX64.test(value.confirmedScope?.claimValuesDigest || "") || value.confirmedScope?.useScope !== PROMOTION_USE_SCOPE || !HEX64.test(value.confirmedScope?.excludedClaimsDigest || "") || !uniqueStrings(value.reasonCodes) || !value.reasonCodes.every((code) => PROMOTION_REASON_CODES.includes(code)) || !isIso(value.completedAt) || !HEX64.test(value.submissionDigest || "")) push(errors, "promotion_review_invalid", "$" );
  return result(errors);
}

export function validatePromotionDecisionShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "promotionKey", "candidateId", "purpose", "policyId", "policyVersion", "evidenceBundleDigest", "rightsReviewDigest", "leakageReviewDigest", "operatorReattestationDigest", "promotionReviewDigest", "outcome", "predecessorDecisionDigest", "decidedAt", "decisionDigest"])) return result([Object.freeze({ code: "promotion_decision_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== PROMOTION_DECISION_SCHEMA_VERSION || !PROMOTION_KEY.test(value.promotionKey || "") || !CANDIDATE_ID.test(value.candidateId || "") || typeof value.purpose !== "string" || value.policyId !== PROMOTION_POLICY_ID || value.policyVersion !== PROMOTION_POLICY_VERSION || !["evidenceBundleDigest", "rightsReviewDigest", "leakageReviewDigest", "operatorReattestationDigest", "promotionReviewDigest", "decisionDigest"].every((key) => HEX64.test(value[key] || "")) || !(value.predecessorDecisionDigest === null || HEX64.test(value.predecessorDecisionDigest || "")) || !enumValue(value.outcome, PROMOTION_DECISION_OUTCOMES) || !isIso(value.decidedAt)) push(errors, "promotion_decision_invalid", "$" );
  return result(errors);
}

export function validateG4GradeRecordShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "gradeRecordId", "candidateId", "grade", "scope", "policy", "sourceDigests", "splitCouplingKeysDigest", "recordedAt", "gradeRecordDigest"])) return result([Object.freeze({ code: "g4_grade_record_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== G4_GRADE_RECORD_SCHEMA_VERSION || !GRADE_RECORD_ID.test(value.gradeRecordId || "") || !CANDIDATE_ID.test(value.candidateId || "") || value.grade !== "G4_SYNTHETIC_GOLD" || !exactKeys(value.scope, ["purpose", "claimAxes", "claimValuesDigest", "useScope", "excludedClaims"]) || typeof value.scope?.purpose !== "string" || !uniqueStrings(value.scope?.claimAxes) || !HEX64.test(value.scope?.claimValuesDigest || "") || value.scope?.useScope !== PROMOTION_USE_SCOPE || !uniqueStrings(value.scope?.excludedClaims) || !exactKeys(value.policy, ["id", "version", "digest"]) || !uniqueStrings(value.sourceDigests, HEX64) || !HEX64.test(value.splitCouplingKeysDigest || "") || !isIso(value.recordedAt) || !HEX64.test(value.gradeRecordDigest || "")) push(errors, "g4_grade_record_invalid", "$" );
  validatePolicy(value.policy, errors);
  return result(errors);
}

export function validatePromotionStatusEventShape(value) {
  const errors = [];
  if (!exactKeys(value, ["schemaVersion", "promotionKey", "gradeRecordDigest", "event", "reasonCodes", "predecessorEventDigest", "recordedAt", "eventDigest"])) return result([Object.freeze({ code: "promotion_status_event_invalid", path: "$", detail: null })]);
  if (value.schemaVersion !== PROMOTION_STATUS_EVENT_SCHEMA_VERSION || !PROMOTION_KEY.test(value.promotionKey || "") || !HEX64.test(value.gradeRecordDigest || "") || !enumValue(value.event, PROMOTION_STATUS_EVENTS) || !uniqueStrings(value.reasonCodes) || !value.reasonCodes.every((code) => PROMOTION_REASON_CODES.includes(code)) || !(value.predecessorEventDigest === null || HEX64.test(value.predecessorEventDigest || "")) || !isIso(value.recordedAt) || !HEX64.test(value.eventDigest || "")) push(errors, "promotion_status_event_invalid", "$" );
  return result(errors);
}
