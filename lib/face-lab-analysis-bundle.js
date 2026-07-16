import { FACE_LAB_OBSERVATION_SCHEMA_VERSION } from "@/lib/face-lab-observation-contract";

const ANALYSIS_STATUSES = new Set(["available", "partial", "insufficient_evidence", "unavailable"]);
const FIELD_STATUSES = new Set(["available", "insufficient_evidence", "unavailable"]);
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
  return Object.entries(value).some(([key, item]) => FORBIDDEN_KEYS.has(normalizeKey(key)) || hasForbiddenImagePayload(item, seen));
}

function isValidField(field) {
  if (!isObject(field) || !FIELD_STATUSES.has(field.status)) {
    return false;
  }
  if (field.status === "available") {
    return field.source === "vision" && typeof field.confidence === "number" && field.confidence >= 0 && field.confidence <= 1 && Array.isArray(field.evidence) && field.evidence.length > 0 && field.value !== null && field.unavailableReason === null;
  }
  return field.source === null && field.confidence === null && field.value === null && typeof field.unavailableReason === "string" && field.unavailableReason.length > 0;
}

function areObservationGroupsValid(observations) {
  if (!isObject(observations)) {
    return false;
  }
  return Object.values(observations).every((group) => isObject(group) && Object.values(group).every(isValidField));
}

export function isFaceLabObservationAnalysis(value) {
  return Boolean(
    isObject(value) &&
      value.schemaVersion === FACE_LAB_OBSERVATION_SCHEMA_VERSION &&
      ANALYSIS_STATUSES.has(value.status) &&
      isObject(value.model) &&
      isValidField(value.quality) &&
      areObservationGroupsValid(value.observations) &&
      isObject(value.coverage) &&
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
    analyzedAt: typeof analyzedAt === "string" && analyzedAt.trim() ? analyzedAt : new Date().toISOString(),
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
  if (!isObject(value) || value.schemaVersion !== "face-lab-canonical-v1" || hasForbiddenImagePayload(value)) {
    return null;
  }
  const analysis = getFaceLabObservationAnalysis(value.analysis);
  if (!analysis) {
    return null;
  }
  return createCanonicalFaceLabBundle({ analysis, analyzedAt: value.analyzedAt });
}
