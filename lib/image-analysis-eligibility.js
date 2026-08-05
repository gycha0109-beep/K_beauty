const ELIGIBILITY_STATUSES = new Set([
  "eligible",
  "insufficient_evidence",
  "ineligible"
]);

const IMAGE_TYPES = new Set([
  "photorealistic_human",
  "non_photorealistic_human",
  "product",
  "animal",
  "document",
  "landscape",
  "other",
  "unknown"
]);

const FACE_LAB_FAILURE_REASONS = new Set([
  "face_not_detected",
  "multiple_faces",
  "non_photorealistic_face",
  "face_too_small",
  "face_occluded",
  "face_angle_unsupported",
  "image_quality_insufficient",
  "eligibility_response_invalid",
  "unknown"
]);

const SKIN_FAILURE_REASONS = new Set([
  "skin_not_visible",
  "face_not_detected",
  "multiple_faces",
  "non_photorealistic_face",
  "face_too_small",
  "skin_occluded",
  "heavy_filter_or_editing",
  "lighting_insufficient",
  "image_quality_insufficient",
  "eligibility_response_invalid",
  "unknown"
]);

function cleanEvidence(value) {
  return Array.isArray(value)
    ? value
        .map((item) => (typeof item === "string" ? item.trim().replace(/\s+/g, " ") : ""))
        .filter(Boolean)
        .slice(0, 6)
    : [];
}

export function createInvalidImageAnalysisEligibility() {
  return {
    status: "insufficient_evidence",
    source: null,
    imageType: "unknown",
    humanFaceCount: null,
    faceLabEligible: false,
    skinAnalysisEligible: false,
    faceLabFailureReason: "eligibility_response_invalid",
    skinFailureReason: "eligibility_response_invalid",
    confidence: null,
    evidence: []
  };
}

export function normalizeImageAnalysisEligibility(value) {
  const invalid = createInvalidImageAnalysisEligibility();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return invalid;
  }

  const humanFaceCount = value.humanFaceCount === null
    ? null
    : Number.isInteger(value.humanFaceCount) && value.humanFaceCount >= 0 && value.humanFaceCount <= 20
      ? value.humanFaceCount
      : undefined;
  const confidence = value.confidence === null
    ? null
    : typeof value.confidence === "number" && Number.isFinite(value.confidence) && value.confidence >= 0 && value.confidence <= 1
      ? value.confidence
      : undefined;
  const faceLabFailureReason = value.faceLabFailureReason === null
    ? null
    : FACE_LAB_FAILURE_REASONS.has(value.faceLabFailureReason)
      ? value.faceLabFailureReason
      : undefined;
  const skinFailureReason = value.skinFailureReason === null
    ? null
    : SKIN_FAILURE_REASONS.has(value.skinFailureReason)
      ? value.skinFailureReason
      : undefined;
  const evidence = cleanEvidence(value.evidence);

  if (
    !ELIGIBILITY_STATUSES.has(value.status) ||
    value.source !== "vision" ||
    !IMAGE_TYPES.has(value.imageType) ||
    humanFaceCount === undefined ||
    typeof value.faceLabEligible !== "boolean" ||
    typeof value.skinAnalysisEligible !== "boolean" ||
    faceLabFailureReason === undefined ||
    skinFailureReason === undefined ||
    confidence === undefined ||
    !evidence.length
  ) {
    return invalid;
  }

  const hasSinglePhotorealisticFace = value.imageType === "photorealistic_human" && humanFaceCount === 1;
  const eligibilityReasonsAreConsistent =
    (value.faceLabEligible ? faceLabFailureReason === null : faceLabFailureReason !== null) &&
    (value.skinAnalysisEligible ? skinFailureReason === null : skinFailureReason !== null);

  if (
    ((value.faceLabEligible || value.skinAnalysisEligible) && !hasSinglePhotorealisticFace) ||
    !eligibilityReasonsAreConsistent
  ) {
    return invalid;
  }

  const expectedStatus = value.faceLabEligible || value.skinAnalysisEligible
    ? "eligible"
    : hasSinglePhotorealisticFace
      ? "insufficient_evidence"
      : "ineligible";

  if (value.status !== expectedStatus) {
    return invalid;
  }

  return {
    status: value.status,
    source: "vision",
    imageType: value.imageType,
    humanFaceCount,
    faceLabEligible: value.faceLabEligible,
    skinAnalysisEligible: value.skinAnalysisEligible,
    faceLabFailureReason,
    skinFailureReason,
    confidence,
    evidence
  };
}

export function createImageAnalysisEligibilityPromptContract() {
  return `
"eligibility": {
  "status": "eligible | insufficient_evidence | ineligible",
  "source": "vision",
  "imageType": "photorealistic_human | non_photorealistic_human | product | animal | document | landscape | other | unknown",
  "humanFaceCount": 1,
  "faceLabEligible": true,
  "skinAnalysisEligible": true,
  "faceLabFailureReason": null,
  "skinFailureReason": null,
  "confidence": 0.95,
  "evidence": ["short visible fact supporting the eligibility decision"]
}`.trim();
}

export function createImageAnalysisEligibilityRules() {
  return `
- Decide eligibility before producing any face or skin analysis.
- Classify the actual uploaded image. Do not assume it contains a person because the task asks for a face analysis.
- A product, animal, document, landscape, illustration, animation, painting, avatar, or 3D character is not a photorealistic human.
- Both analyses require exactly one real human face. Zero faces or an uncertain face count must not be eligible. More than one face uses multiple_faces.
- Face Lab may be eligible while skin analysis is not when facial structure is visible but skin is obscured, heavily filtered, poorly lit, or too low quality.
- Set status to eligible when at least one analysis is eligible, insufficient_evidence only for one photorealistic face that is unusable for both analyses, and ineligible otherwise.
- source must be vision. confidence must be between 0 and 1. evidence must contain at least one short visible fact.
- faceLabFailureReason must be null only when faceLabEligible is true. Otherwise use exactly one of: face_not_detected, multiple_faces, non_photorealistic_face, face_too_small, face_occluded, face_angle_unsupported, image_quality_insufficient, unknown.
- skinFailureReason must be null only when skinAnalysisEligible is true. Otherwise use exactly one of: skin_not_visible, face_not_detected, multiple_faces, non_photorealistic_face, face_too_small, skin_occluded, heavy_filter_or_editing, lighting_insufficient, image_quality_insufficient, unknown.
- If an analysis is not eligible, return empty downstream text and arrays and zero skin signal scores for that analysis. Never place a refusal or failure explanation inside skin signals, evidence, observations, mood, color, hair, makeup, or style fields.
`.trim();
}
