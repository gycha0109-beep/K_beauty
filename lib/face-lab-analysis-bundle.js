import { FACE_LAB_OBSERVATION_SCHEMA_VERSION } from "@/lib/face-lab-observation-contract";

const ANALYSIS_STATUSES = new Set([
  "available",
  "partial",
  "insufficient_evidence",
  "unavailable"
]);
const FIELD_STATUSES = new Set([
  "available",
  "insufficient_evidence",
  "unavailable"
]);
const FORBIDDEN_KEYS = new Set([
  "image",
  "imageurl",
  "imagealt",
  "imagepreview",
  "imagepreviewdataurl",
  "imagedataurl",
  "base64",
  "buffer",
  "facecrop",
  "crop"
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function normalizeKey(value) {
  return String(value || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function hasForbiddenImagePayload(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") {
    return typeof value === "string" && /^data:image\//i.test(value.trim());
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenImagePayload(item, seen));
  }

  return Object.entries(value).some(
    ([key, item]) => FORBIDDEN_KEYS.has(normalizeKey(key)) || hasForbiddenImagePayload(item, seen)
  );
}

function isValidField(field) {
  if (!isObject(field) || !FIELD_STATUSES.has(field.status) || !Array.isArray(field.evidence)) {
    return false;
  }

  if (field.status === "available") {
    return field.source === "vision" &&
      typeof field.confidence === "number" &&
      Number.isFinite(field.confidence) &&
      field.confidence >= 0 &&
      field.confidence <= 1 &&
      isStringArray(field.evidence) &&
      field.evidence.length > 0 &&
      field.value !== null &&
      field.unavailableReason === null;
  }

  return field.source === null &&
    field.confidence === null &&
    field.value === null &&
    field.evidence.every(isNonEmptyString) &&
    isNonEmptyString(field.unavailableReason);
}

function areObservationGroupsValid(observations) {
  if (!isObject(observations) || !Object.keys(observations).length) {
    return false;
  }

  return Object.values(observations).every(
    (group) => isObject(group) &&
      Object.keys(group).length > 0 &&
      Object.values(group).every(isValidField)
  );
}

function isValidModel(model) {
  return isObject(model) &&
    isNonEmptyString(model.provider) &&
    (model.name === null || isNonEmptyString(model.name)) &&
    isNonEmptyString(model.promptVersion);
}

function isValidCoverage(coverage) {
  return isObject(coverage) &&
    isStringArray(coverage.availableGroups) &&
    isStringArray(coverage.partialGroups) &&
    isStringArray(coverage.unavailableGroups) &&
    Number.isInteger(coverage.availableFieldCount) &&
    coverage.availableFieldCount >= 0 &&
    Number.isInteger(coverage.totalCoreFieldCount) &&
    coverage.totalCoreFieldCount >= 0 &&
    coverage.availableFieldCount <= coverage.totalCoreFieldCount;
}

function isStatusFailureReasonConsistent(value) {
  if (value.status === "available" || value.status === "partial") {
    return value.failureReason === null;
  }

  return isNonEmptyString(value.failureReason);
}

export function isFaceLabObservationAnalysis(value) {
  return Boolean(
    isObject(value) &&
      value.schemaVersion === FACE_LAB_OBSERVATION_SCHEMA_VERSION &&
      ANALYSIS_STATUSES.has(value.status) &&
      isStatusFailureReasonConsistent(value) &&
      isValidModel(value.model) &&
      isValidField(value.quality) &&
      areObservationGroupsValid(value.observations) &&
      isValidCoverage(value.coverage) &&
      isStringArray(value.warnings) &&
      isObject(value.privacy) &&
      value.privacy.sourceImagePersisted === false &&
      !hasForbiddenImagePayload(value)
  );
}

export function getFaceLabObservationAnalysis(value) {
  if (!isObject(value)) {
    return null;
  }

  const candidate = value.schemaVersion === FACE_LAB_OBSERVATION_SCHEMA_VERSION
    ? value
    : value.analysis;

  return isFaceLabObservationAnalysis(candidate) ? candidate : null;
}

export function createCanonicalFaceLabBundle({ analysis, analyzedAt = null } = {}) {
  const normalizedAnalysis = getFaceLabObservationAnalysis(analysis);
  if (!normalizedAnalysis) {
    return null;
  }

  return {
    schemaVersion: "face-lab-canonical-v1",
    status: normalizedAnalysis.status,
    failureReason: normalizedAnalysis.failureReason,
    analyzedAt: isNonEmptyString(analyzedAt) ? analyzedAt.trim() : new Date().toISOString(),
    analysis: normalizedAnalysis,
    archetype: null,
    styleIdentity: null,
    strategies: null,
    color: null,
    hair: null,
    makeup: null,
    faceStyle: null,
    looks: null,
    privacy: {
      sourceImagePersisted: false,
      datasetConsentStatus: "not_requested",
      consentVersion: null
    }
  };
}

export function sanitizeCanonicalFaceLabBundle(value) {
  if (
    !isObject(value) ||
    value.schemaVersion !== "face-lab-canonical-v1" ||
    hasForbiddenImagePayload(value)
  ) {
    return null;
  }

  const analysis = getFaceLabObservationAnalysis(value.analysis);
  if (!analysis) {
    return null;
  }

  return createCanonicalFaceLabBundle({
    analysis,
    analyzedAt: value.analyzedAt
  });
}
