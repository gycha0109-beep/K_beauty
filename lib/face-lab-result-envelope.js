const FACE_LAB_STATUS_AVAILABLE = "available";
const FACE_LAB_STATUS_INSUFFICIENT_EVIDENCE = "insufficient_evidence";
const FACE_LAB_STATUS_UNAVAILABLE = "unavailable";
const FACE_LAB_SOURCE_VISION = "vision";

const FACE_LAB_PHOTO_INELIGIBLE_REASONS = new Set([
  "face_not_detected",
  "multiple_faces",
  "non_photorealistic_face",
  "face_too_small",
  "face_occluded",
  "face_angle_unsupported",
  "image_quality_insufficient"
]);

const FACE_LAB_STATUSES = new Set([
  FACE_LAB_STATUS_AVAILABLE,
  FACE_LAB_STATUS_INSUFFICIENT_EVIDENCE,
  FACE_LAB_STATUS_UNAVAILABLE
]);

function getAnalyzedAt(value) {
  return typeof value === "string" && value.trim() ? value : new Date().toISOString();
}

function getObjectData(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

export function createFaceLabAvailable(data, options = {}) {
  return {
    status: FACE_LAB_STATUS_AVAILABLE,
    source: FACE_LAB_SOURCE_VISION,
    failureReason: null,
    analyzedAt: getAnalyzedAt(options.analyzedAt),
    data: getObjectData(data),
    ...(options.eligibility ? { eligibility: options.eligibility } : {})
  };
}

export function createFaceLabInsufficientEvidence(data = null, failureReason = "required_features_missing", options = {}) {
  return {
    status: FACE_LAB_STATUS_INSUFFICIENT_EVIDENCE,
    source: FACE_LAB_SOURCE_VISION,
    failureReason: failureReason || "required_features_missing",
    analyzedAt: getAnalyzedAt(options.analyzedAt),
    data: getObjectData(data),
    ...(options.eligibility ? { eligibility: options.eligibility } : {})
  };
}

export function createFaceLabUnavailable(failureReason = "unknown", options = {}) {
  return {
    status: FACE_LAB_STATUS_UNAVAILABLE,
    source: null,
    failureReason: failureReason || "unknown",
    analyzedAt: getAnalyzedAt(options.analyzedAt),
    data: null,
    ...(options.eligibility ? { eligibility: options.eligibility } : {})
  };
}

export function isFaceLabResultEnvelope(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      FACE_LAB_STATUSES.has(value.status) &&
      Object.prototype.hasOwnProperty.call(value, "data")
  );
}

export function getAvailableFaceLabData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  if (isFaceLabResultEnvelope(value)) {
    return value.status === FACE_LAB_STATUS_AVAILABLE ? getObjectData(value.data) : null;
  }

  return value;
}

export function getAvailableVisionFaceLabData(value) {
  if (!isFaceLabResultEnvelope(value)) {
    return null;
  }

  const eligibilityAllowsFaceLab = !Object.prototype.hasOwnProperty.call(value, "eligibility") ||
    value.eligibility?.faceLabEligible === true;

  return value.status === FACE_LAB_STATUS_AVAILABLE &&
    value.source === FACE_LAB_SOURCE_VISION &&
    eligibilityAllowsFaceLab
    ? getObjectData(value.data)
    : null;
}

export function getFaceLabDisplayStatus(value) {
  if (getAvailableVisionFaceLabData(value)) {
    return "available";
  }

  if (!isFaceLabResultEnvelope(value) || value.status === FACE_LAB_STATUS_AVAILABLE) {
    return "unavailable";
  }

  const eligibility = getObjectData(value.eligibility);
  const failureReason = eligibility?.faceLabFailureReason;
  const isExplicitPhotoFailure =
    eligibility?.source === FACE_LAB_SOURCE_VISION &&
    eligibility?.faceLabEligible === false &&
    FACE_LAB_PHOTO_INELIGIBLE_REASONS.has(failureReason) &&
    value.failureReason === failureReason;

  return isExplicitPhotoFailure ? "photo_ineligible" : "unavailable";
}
