import { FACE_LAB_OBSERVATION_DEFINITIONS } from "./face-lab-observation-contract.js";
import { VISION_SKIN_AREAS } from "./vision-observation-contract.js";

export const RECOMMENDATION_FEATURE_SCHEMA_VERSION = "recommendation-feature-v1";
export const RECOMMENDATION_FEATURE_SHADOW_VERSION = "recommendation-feature-shadow-20260727";

export const OBSERVATION_STATUSES = Object.freeze([
  "available",
  "insufficient_evidence",
  "unavailable",
  "unsupported"
]);

export const OBSERVATION_CONFIDENCE_LEVELS = Object.freeze([
  "low",
  "medium",
  "high"
]);

export const IMAGE_TYPE_VALUES = Object.freeze([
  "photorealistic_human",
  "non_photorealistic_human",
  "product",
  "animal",
  "document",
  "landscape",
  "other",
  "unknown"
]);

export const QUALITY_ENUMS = Object.freeze({
  faceVisibility: Object.freeze(["clear", "partial", "poor"]),
  faceScale: Object.freeze(["adequate", "small", "too_large"]),
  yaw: Object.freeze(["frontal", "slight_left", "slight_right", "profile_left", "profile_right", "unknown"]),
  pitch: Object.freeze(["level", "up", "down", "unknown"]),
  roll: Object.freeze(["level", "tilted", "unknown"]),
  occlusion: Object.freeze(["none", "partial", "heavy"]),
  sharpness: Object.freeze(["clear", "soft", "blurred"]),
  exposure: Object.freeze(["balanced", "underexposed", "overexposed", "mixed"]),
  lightingUniformity: Object.freeze(["even", "uneven", "harsh"]),
  whiteBalance: Object.freeze(["stable", "warm_cast", "cool_cast", "mixed_cast", "unknown"]),
  filterOrEditing: Object.freeze(["none_detected", "possible", "heavy", "unknown"]),
  makeupCoverage: Object.freeze(["none_or_light", "moderate", "heavy", "unknown"]),
  suitability: Object.freeze(["suitable", "limited", "unsuitable"])
});

export const SKIN_AREA_VALUES = Object.freeze([...VISION_SKIN_AREAS]);
export const VISIBLE_SKIN_CUE_LEVELS = Object.freeze(["none", "mild", "moderate", "high"]);

export const FACE_CORE_FIELD_DEFINITIONS = Object.freeze({
  observedFaceShape: Object.freeze({ path: "observations.outline.faceShape", values: FACE_LAB_OBSERVATION_DEFINITIONS.outline.faceShape }),
  observedFaceLengthBalance: Object.freeze({ path: "observations.vertical.faceLengthBalance", values: FACE_LAB_OBSERVATION_DEFINITIONS.vertical.faceLengthBalance }),
  observedEyeDirection: Object.freeze({ path: "observations.eyes.eyeDirection", values: FACE_LAB_OBSERVATION_DEFINITIONS.eyes.eyeDirection }),
  observedEyeLength: Object.freeze({ path: "observations.eyes.eyeLength", values: FACE_LAB_OBSERVATION_DEFINITIONS.eyes.eyeLength }),
  observedEyeOpenness: Object.freeze({ path: "observations.eyes.eyeOpenness", values: FACE_LAB_OBSERVATION_DEFINITIONS.eyes.eyeOpenness }),
  observedJawlineAngularity: Object.freeze({ path: "observations.outline.jawlineAngularity", values: FACE_LAB_OBSERVATION_DEFINITIONS.outline.jawlineAngularity }),
  observedJawTaper: Object.freeze({ path: "observations.outline.jawTaper", values: FACE_LAB_OBSERVATION_DEFINITIONS.outline.jawTaper }),
  observedFeatureScale: Object.freeze({ path: "observations.featureLayout.featureScale", values: FACE_LAB_OBSERVATION_DEFINITIONS.featureLayout.featureScale }),
  observedFeatureConcentration: Object.freeze({ path: "observations.featureLayout.featureConcentration", values: FACE_LAB_OBSERVATION_DEFINITIONS.featureLayout.featureConcentration }),
  observedStraightCurveBalance: Object.freeze({ path: "observations.visualLanguage.straightCurveBalance", values: FACE_LAB_OBSERVATION_DEFINITIONS.visualLanguage.straightCurveBalance }),
  observedContourDefinition: Object.freeze({ path: "observations.visualLanguage.contourDefinition", values: FACE_LAB_OBSERVATION_DEFINITIONS.visualLanguage.contourDefinition }),
  observedFeatureContrast: Object.freeze({ path: "observations.visualLanguage.featureContrast", values: FACE_LAB_OBSERVATION_DEFINITIONS.visualLanguage.featureContrast })
});

export const FACE_CONDITIONAL_FIELD_DEFINITIONS = Object.freeze({
  observedCheekboneProminence: Object.freeze({ path: "observations.outline.cheekboneProminence", values: FACE_LAB_OBSERVATION_DEFINITIONS.outline.cheekboneProminence })
});

export const SKIN_CORE_FIELDS = Object.freeze([
  "visibleSurfaceShine",
  "visibleDryTexture",
  "visibleRedness",
  "visibleToneVariation"
]);

export const SKIN_CONDITIONAL_FIELDS = Object.freeze([
  "visibleFlaking",
  "visibleLocalizedSpots",
  "visiblePores"
]);

export const SKIN_LEGACY_AXES = Object.freeze([
  "barrier",
  "dehydration",
  "oiliness",
  "redness",
  "acne",
  "pores",
  "uneven_tone",
  "uv"
]);

const STATUS_VALUES = new Set(OBSERVATION_STATUSES);
const CONFIDENCE_VALUES = new Set(OBSERVATION_CONFIDENCE_LEVELS);
const SKIN_AREAS = new Set(SKIN_AREA_VALUES);
const SKIN_LEVELS = new Set(VISIBLE_SKIN_CUE_LEVELS);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function uniqueStrings(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean))].slice(0, limit);
}

export function confidenceLevelFromScore(score) {
  if (!Number.isFinite(score)) return null;
  if (score >= 0.8) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

export function normalizeObservationConfidence(value) {
  if (value === null || value === undefined) {
    return { level: null, score: null };
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1) {
    return { level: confidenceLevelFromScore(value), score: value };
  }

  if (typeof value === "string" && CONFIDENCE_VALUES.has(value)) {
    return { level: value, score: null };
  }

  if (isPlainObject(value)) {
    const score = Number.isFinite(value.score) && value.score >= 0 && value.score <= 1
      ? value.score
      : null;
    const level = CONFIDENCE_VALUES.has(value.level)
      ? value.level
      : confidenceLevelFromScore(score);
    return { level: level || null, score };
  }

  return { level: null, score: null };
}

export function createAvailableObservation(value, options = {}) {
  return {
    status: "available",
    value,
    confidence: normalizeObservationConfidence(options.confidence),
    evidence: uniqueStrings(options.evidence),
    unavailableReason: null,
    source: "vision"
  };
}

export function createInsufficientObservation(reason = "insufficient_evidence", options = {}) {
  return {
    status: "insufficient_evidence",
    value: null,
    confidence: normalizeObservationConfidence(options.confidence),
    evidence: uniqueStrings(options.evidence),
    unavailableReason: typeof reason === "string" && reason.trim() ? reason.trim() : "insufficient_evidence",
    source: options.source === "vision" ? "vision" : null
  };
}

export function createUnavailableObservation(reason = "unavailable") {
  return {
    status: "unavailable",
    value: null,
    confidence: { level: null, score: null },
    evidence: [],
    unavailableReason: typeof reason === "string" && reason.trim() ? reason.trim() : "unavailable",
    source: null
  };
}

export function createUnsupportedObservation(reason = "unsupported_from_single_photo") {
  return {
    status: "unsupported",
    value: null,
    confidence: { level: null, score: null },
    evidence: [],
    unavailableReason: typeof reason === "string" && reason.trim() ? reason.trim() : "unsupported_from_single_photo",
    source: null
  };
}

export function validateObservationField(field, options = {}) {
  const errors = [];
  if (!isPlainObject(field)) return { ok: false, errors: ["field_not_object"] };
  if (!STATUS_VALUES.has(field.status)) errors.push("status_invalid");
  if (!isPlainObject(field.confidence)) errors.push("confidence_not_object");

  const confidence = normalizeObservationConfidence(field.confidence);
  const evidence = uniqueStrings(field.evidence);

  if (field.status === "available") {
    if (field.value === null || field.value === undefined) errors.push("available_value_missing");
    if (!confidence.level) errors.push("available_confidence_missing");
    if (!evidence.length) errors.push("available_evidence_missing");
    if (field.source !== "vision") errors.push("available_source_invalid");
    if (Array.isArray(options.allowedValues) && !options.allowedValues.includes(field.value)) {
      errors.push("available_value_invalid");
    }
  }

  if (field.status === "insufficient_evidence") {
    if (field.value !== null) errors.push("insufficient_value_present");
  }

  if (field.status === "unavailable" || field.status === "unsupported") {
    if (field.value !== null) errors.push(`${field.status}_value_present`);
    if (confidence.level !== null || confidence.score !== null) errors.push(`${field.status}_confidence_present`);
    if (evidence.length) errors.push(`${field.status}_evidence_present`);
    if (field.source !== null) errors.push(`${field.status}_source_present`);
  }

  return { ok: errors.length === 0, errors };
}

export function validateVisibleSkinCueValue(value) {
  const errors = [];
  if (!isPlainObject(value)) return { ok: false, errors: ["skin_cue_not_object"] };
  if (!SKIN_LEVELS.has(value.level)) errors.push("skin_cue_level_invalid");

  const observedAreas = Array.isArray(value.observedAreas) ? [...new Set(value.observedAreas)] : null;
  const affectedAreas = Array.isArray(value.affectedAreas) ? [...new Set(value.affectedAreas)] : null;
  if (!observedAreas) errors.push("observed_areas_invalid");
  if (!affectedAreas) errors.push("affected_areas_invalid");

  for (const area of observedAreas || []) {
    if (!SKIN_AREAS.has(area)) errors.push("observed_area_invalid");
  }
  for (const area of affectedAreas || []) {
    if (!SKIN_AREAS.has(area)) errors.push("affected_area_invalid");
    if (!observedAreas?.includes(area)) errors.push("affected_area_not_observed");
  }

  if (value.level === "none" && affectedAreas?.length) {
    errors.push("none_with_affected_areas");
  }
  if (value.level !== "none" && affectedAreas && affectedAreas.length === 0) {
    errors.push("non_none_without_affected_area");
  }
  if (value.level === "none" && observedAreas && observedAreas.length === 0) {
    errors.push("none_without_observed_area");
  }

  return { ok: errors.length === 0, errors };
}

function validateQualityFields(quality) {
  const entries = [
    ["faceVisibility", quality?.faceVisibility, QUALITY_ENUMS.faceVisibility],
    ["faceScale", quality?.faceScale, QUALITY_ENUMS.faceScale],
    ["pose.yaw", quality?.pose?.yaw, QUALITY_ENUMS.yaw],
    ["pose.pitch", quality?.pose?.pitch, QUALITY_ENUMS.pitch],
    ["pose.roll", quality?.pose?.roll, QUALITY_ENUMS.roll],
    ["occlusion.forehead", quality?.occlusion?.forehead, QUALITY_ENUMS.occlusion],
    ["occlusion.brows", quality?.occlusion?.brows, QUALITY_ENUMS.occlusion],
    ["occlusion.eyes", quality?.occlusion?.eyes, QUALITY_ENUMS.occlusion],
    ["occlusion.cheeks", quality?.occlusion?.cheeks, QUALITY_ENUMS.occlusion],
    ["occlusion.jawline", quality?.occlusion?.jawline, QUALITY_ENUMS.occlusion],
    ["sharpness", quality?.sharpness, QUALITY_ENUMS.sharpness],
    ["exposure", quality?.exposure, QUALITY_ENUMS.exposure],
    ["lightingUniformity", quality?.lightingUniformity, QUALITY_ENUMS.lightingUniformity],
    ["whiteBalance", quality?.whiteBalance, QUALITY_ENUMS.whiteBalance],
    ["filterOrEditing", quality?.filterOrEditing, QUALITY_ENUMS.filterOrEditing],
    ["makeupCoverage", quality?.makeupCoverage, QUALITY_ENUMS.makeupCoverage]
  ];

  return entries.flatMap(([path, field, allowedValues]) => {
    const result = validateObservationField(field, { allowedValues });
    return result.ok ? [] : result.errors.map((error) => `quality.${path}.${error}`);
  });
}

export function validateRecommendationFeatureBundle(bundle) {
  const errors = [];
  if (!isPlainObject(bundle)) return { ok: false, errors: ["bundle_not_object"] };
  if (bundle.schemaVersion !== RECOMMENDATION_FEATURE_SCHEMA_VERSION) errors.push("schema_version_invalid");
  if (bundle.mode !== "shadow") errors.push("mode_invalid");
  if (bundle.productionAuthoritative !== false) errors.push("production_authoritative_must_be_false");

  errors.push(...validateQualityFields(bundle.atomic?.quality));

  for (const [name, definition] of Object.entries({
    ...FACE_CORE_FIELD_DEFINITIONS,
    ...FACE_CONDITIONAL_FIELD_DEFINITIONS
  })) {
    const result = validateObservationField(bundle.atomic?.face?.[name], { allowedValues: definition.values });
    if (!result.ok) errors.push(...result.errors.map((error) => `face.${name}.${error}`));
  }

  for (const name of [...SKIN_CORE_FIELDS, ...SKIN_CONDITIONAL_FIELDS]) {
    const field = bundle.atomic?.skin?.[name];
    const result = validateObservationField(field);
    if (!result.ok) errors.push(...result.errors.map((error) => `skin.${name}.${error}`));
    if (field?.status === "available") {
      const cueResult = validateVisibleSkinCueValue(field.value);
      if (!cueResult.ok) errors.push(...cueResult.errors.map((error) => `skin.${name}.${error}`));
    }
  }

  if (bundle.privacy?.sourceImagePersisted !== false) errors.push("source_image_persisted");
  if (bundle.privacy?.rawProviderResponsePersisted !== false) errors.push("raw_provider_response_persisted");
  if (bundle.privacy?.faceCropPersisted !== false) errors.push("face_crop_persisted");

  return { ok: errors.length === 0, errors };
}
