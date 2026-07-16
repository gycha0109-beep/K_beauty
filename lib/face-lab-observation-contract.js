export const FACE_LAB_OBSERVATION_SCHEMA_VERSION = "face-lab-observation-v1";
export const FACE_LAB_OBSERVATION_PROMPT_VERSION = "face-lab-observation-prompt-v1";

const FIELD_STATUSES = new Set(["available", "insufficient_evidence", "unavailable"]);
const VISIBILITY_VALUES = new Set(["clear", "partial", "uncertain"]);
const FIELD_FAILURE_REASONS = new Set([
  "not_visible",
  "occluded",
  "angle_unsupported",
  "quality_insufficient",
  "ambiguous",
  "evidence_missing",
  "value_invalid"
]);

const QUALITY_ENUMS = {
  faceVisibility: new Set(["clear", "partial", "poor"]),
  faceScale: new Set(["adequate", "small", "too_large"]),
  sharpness: new Set(["clear", "soft", "blurred"]),
  exposure: new Set(["balanced", "underexposed", "overexposed", "mixed"]),
  lightingUniformity: new Set(["even", "uneven", "harsh"]),
  whiteBalance: new Set(["stable", "warm_cast", "cool_cast", "mixed_cast", "unknown"]),
  filterOrEditing: new Set(["none_detected", "possible", "heavy", "unknown"]),
  makeupCoverage: new Set(["none_or_light", "moderate", "heavy", "unknown"]),
  structureSuitability: new Set(["suitable", "limited", "unsuitable"]),
  colorSuitability: new Set(["suitable", "limited", "unsuitable"])
};

const POSE_ENUMS = {
  yaw: new Set(["frontal", "slight_left", "slight_right", "profile_left", "profile_right", "unknown"]),
  pitch: new Set(["level", "up", "down", "unknown"]),
  roll: new Set(["level", "tilted", "unknown"])
};

const OCCLUSION_VALUES = new Set(["none", "partial", "heavy"]);

export const FACE_LAB_OBSERVATION_DEFINITIONS = {
  outline: {
    faceShape: ["oval", "round", "square", "oblong", "heart", "diamond", "triangle", "mixed"],
    foreheadWidthVsCheek: ["narrower", "similar", "wider"],
    jawWidthVsCheek: ["narrower", "similar", "wider"],
    jawlineAngularity: ["soft", "moderate", "angular"],
    jawTaper: ["tapered", "balanced", "broad"],
    cheekboneProminence: ["subtle", "moderate", "prominent"]
  },
  vertical: {
    faceLengthBalance: ["short", "balanced", "long"],
    foreheadHeight: ["low", "balanced", "high"],
    midfaceLength: ["short", "balanced", "long"],
    lowerFaceLength: ["short", "balanced", "long"]
  },
  eyes: {
    eyeDirection: ["upturned", "level", "downturned", "mixed"],
    eyeLength: ["short", "medium", "long"],
    eyeOpenness: ["narrow", "medium", "wide"]
  },
  featureLayout: {
    featureScale: ["small", "medium", "large", "mixed"],
    featureConcentration: ["spread", "balanced", "centered"],
    focalFeatures: ["eyes", "brows", "nose", "lips", "cheekbones", "jawline", "forehead"]
  },
  visualLanguage: {
    straightCurveBalance: ["curved", "balanced", "straight"],
    contourDefinition: ["soft", "moderate", "defined"],
    featureContrast: ["low", "medium", "high"]
  },
  colorAppearance: {
    apparentTemperature: ["warm", "neutral", "cool"],
    apparentBrightness: ["low", "medium", "high"],
    apparentSaturation: ["muted", "balanced", "clear"]
  }
};

const CORE_GROUP_MINIMUMS = {
  outline: 3,
  vertical: 2,
  eyes: 2,
  featureLayout: 1,
  visualLanguage: 2
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanEvidence(value) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => (typeof item === "string" ? item.trim().replace(/\s+/g, " ") : "")).filter(Boolean))].slice(0, 8)
    : [];
}

function normalizeEnum(value, allowed) {
  return typeof value === "string" && allowed.has(value) ? value : null;
}

function createUnavailableField(reason = "evidence_missing", status = "insufficient_evidence") {
  return {
    status: FIELD_STATUSES.has(status) ? status : "insufficient_evidence",
    source: null,
    confidence: null,
    evidence: [],
    unavailableReason: FIELD_FAILURE_REASONS.has(reason) ? reason : "evidence_missing",
    value: null
  };
}

function calculateConfidence(visibility, suitability) {
  const visibilityWeight = visibility === "clear" ? 1 : visibility === "partial" ? 0.75 : 0;
  const suitabilityWeight = suitability === "suitable" ? 1 : suitability === "limited" ? 0.8 : 0;
  if (!visibilityWeight || !suitabilityWeight) {
    return null;
  }
  return Number((0.9 * visibilityWeight * suitabilityWeight).toFixed(2));
}

function normalizeRawField(rawField, allowedValues, suitability, { array = false } = {}) {
  if (!isObject(rawField)) {
    return createUnavailableField("evidence_missing");
  }

  const visibility = normalizeEnum(rawField.visibility, VISIBILITY_VALUES);
  const evidence = cleanEvidence(rawField.evidence);
  const rawReason = normalizeEnum(rawField.unavailableReason, FIELD_FAILURE_REASONS);

  if (visibility === "uncertain") {
    return createUnavailableField(rawReason || "ambiguous");
  }

  if (suitability === "unsuitable") {
    return createUnavailableField(rawReason || "quality_insufficient", "unavailable");
  }

  let value = null;
  if (array) {
    value = Array.isArray(rawField.value)
      ? [...new Set(rawField.value.filter((item) => allowedValues.has(item)))].slice(0, 4)
      : [];
    if (!value.length) {
      value = null;
    }
  } else {
    value = normalizeEnum(rawField.value, allowedValues);
  }

  if (!value) {
    return createUnavailableField(rawReason || "value_invalid");
  }
  if (!visibility || !evidence.length) {
    return createUnavailableField(!evidence.length ? "evidence_missing" : "value_invalid");
  }

  return {
    status: "available",
    source: "vision",
    confidence: calculateConfidence(visibility, suitability),
    evidence,
    unavailableReason: null,
    value
  };
}

export function createFaceLabObservationPromptContract() {
  const field = (value) => ({ value, visibility: "clear | partial | uncertain", evidence: ["short visible fact"], unavailableReason: null });
  return {
    quality: {
      faceVisibility: "clear | partial | poor",
      faceScale: "adequate | small | too_large",
      pose: { yaw: "frontal | slight_left | slight_right | profile_left | profile_right | unknown", pitch: "level | up | down | unknown", roll: "level | tilted | unknown" },
      occlusion: { forehead: "none | partial | heavy", brows: "none | partial | heavy", eyes: "none | partial | heavy", cheeks: "none | partial | heavy", jawline: "none | partial | heavy" },
      sharpness: "clear | soft | blurred",
      exposure: "balanced | underexposed | overexposed | mixed",
      lightingUniformity: "even | uneven | harsh",
      whiteBalance: "stable | warm_cast | cool_cast | mixed_cast | unknown",
      filterOrEditing: "none_detected | possible | heavy | unknown",
      makeupCoverage: "none_or_light | moderate | heavy | unknown",
      structureSuitability: "suitable | limited | unsuitable",
      colorSuitability: "suitable | limited | unsuitable",
      evidence: ["short visible fact"]
    },
    observations: Object.fromEntries(Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS).map(([group, fields]) => [
      group,
      Object.fromEntries(Object.entries(fields).map(([key, values]) => [key, field(values.join(" | "))]))
    ]))
  };
}

export function createFaceLabObservationPromptRules() {
  return [
    "Return locale-neutral enum tokens exactly as listed.",
    "Describe only visible facial structure and image quality.",
    "Do not generate archetypes, animal types, affinity scores, personality, physiognomy, celebrity similarity, hairstyle, makeup, color palette, clothing, or final style recommendations.",
    "Every non-null observation requires at least one short visible evidence fact.",
    "Use null with uncertain visibility when the feature cannot be supported.",
    "Do not include image bytes, URLs, crops, base64 data, names, or identity claims."
  ].join("\n- ").replace(/^/, "- ");
}

export function normalizeFaceImageQuality(value) {
  if (!isObject(value)) {
    return { status: "insufficient_evidence", source: null, confidence: null, evidence: [], unavailableReason: "quality_response_invalid", value: null };
  }

  const pose = isObject(value.pose) ? value.pose : {};
  const occlusion = isObject(value.occlusion) ? value.occlusion : {};
  const normalized = {
    faceVisibility: normalizeEnum(value.faceVisibility, QUALITY_ENUMS.faceVisibility),
    faceScale: normalizeEnum(value.faceScale, QUALITY_ENUMS.faceScale),
    pose: {
      yaw: normalizeEnum(pose.yaw, POSE_ENUMS.yaw),
      pitch: normalizeEnum(pose.pitch, POSE_ENUMS.pitch),
      roll: normalizeEnum(pose.roll, POSE_ENUMS.roll)
    },
    occlusion: {
      forehead: normalizeEnum(occlusion.forehead, OCCLUSION_VALUES),
      brows: normalizeEnum(occlusion.brows, OCCLUSION_VALUES),
      eyes: normalizeEnum(occlusion.eyes, OCCLUSION_VALUES),
      cheeks: normalizeEnum(occlusion.cheeks, OCCLUSION_VALUES),
      jawline: normalizeEnum(occlusion.jawline, OCCLUSION_VALUES)
    },
    sharpness: normalizeEnum(value.sharpness, QUALITY_ENUMS.sharpness),
    exposure: normalizeEnum(value.exposure, QUALITY_ENUMS.exposure),
    lightingUniformity: normalizeEnum(value.lightingUniformity, QUALITY_ENUMS.lightingUniformity),
    whiteBalance: normalizeEnum(value.whiteBalance, QUALITY_ENUMS.whiteBalance),
    filterOrEditing: normalizeEnum(value.filterOrEditing, QUALITY_ENUMS.filterOrEditing),
    makeupCoverage: normalizeEnum(value.makeupCoverage, QUALITY_ENUMS.makeupCoverage),
    structureSuitability: normalizeEnum(value.structureSuitability, QUALITY_ENUMS.structureSuitability),
    colorSuitability: normalizeEnum(value.colorSuitability, QUALITY_ENUMS.colorSuitability)
  };
  const evidence = cleanEvidence(value.evidence);
  const valid = normalized.faceVisibility && normalized.faceScale && Object.values(normalized.pose).every(Boolean) && Object.values(normalized.occlusion).every(Boolean) && normalized.sharpness && normalized.exposure && normalized.lightingUniformity && normalized.whiteBalance && normalized.filterOrEditing && normalized.makeupCoverage && normalized.structureSuitability && normalized.colorSuitability && evidence.length;

  if (!valid) {
    return { status: "insufficient_evidence", source: null, confidence: null, evidence: [], unavailableReason: "quality_response_invalid", value: null };
  }

  const suitability = normalized.structureSuitability;
  return {
    status: suitability === "unsuitable" ? "unavailable" : "available",
    source: "vision",
    confidence: calculateConfidence(normalized.faceVisibility === "clear" ? "clear" : "partial", suitability),
    evidence,
    unavailableReason: suitability === "unsuitable" ? "quality_insufficient" : null,
    value: normalized
  };
}

export function normalizeFaceObservationBundle(rawObservations, qualityField) {
  const quality = qualityField?.value;
  const structureSuitability = quality?.structureSuitability || "unsuitable";
  const colorSuitability = quality?.colorSuitability || "unsuitable";
  const observations = {};

  for (const [group, definitions] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [fieldName, allowedList] of Object.entries(definitions)) {
      const isArray = group === "featureLayout" && fieldName === "focalFeatures";
      const suitability = group === "colorAppearance" ? colorSuitability : structureSuitability;
      observations[group][fieldName] = normalizeRawField(rawObservations?.[group]?.[fieldName], new Set(allowedList), suitability, { array: isArray });
    }
  }

  return observations;
}

export function calculateFaceObservationCoverage(observations) {
  const availableGroups = [];
  const partialGroups = [];
  const unavailableGroups = [];
  let availableFieldCount = 0;
  let totalCoreFieldCount = 0;

  for (const [group, fields] of Object.entries(observations || {})) {
    const fieldValues = Object.values(fields || {});
    const availableCount = fieldValues.filter((field) => field?.status === "available").length;
    if (Object.prototype.hasOwnProperty.call(CORE_GROUP_MINIMUMS, group)) {
      totalCoreFieldCount += fieldValues.length;
      availableFieldCount += availableCount;
      if (availableCount >= CORE_GROUP_MINIMUMS[group]) {
        availableGroups.push(group);
      } else if (availableCount > 0) {
        partialGroups.push(group);
      } else {
        unavailableGroups.push(group);
      }
    } else if (availableCount > 0) {
      availableGroups.push(group);
    } else {
      unavailableGroups.push(group);
    }
  }

  return { availableGroups, partialGroups, unavailableGroups, availableFieldCount, totalCoreFieldCount };
}

export function buildFaceLabObservationAnalysis(rawValue, options = {}) {
  const quality = normalizeFaceImageQuality(rawValue?.quality);
  const observations = normalizeFaceObservationBundle(rawValue?.observations, quality);
  const coverage = calculateFaceObservationCoverage(observations);
  const coreAvailableCount = Object.keys(CORE_GROUP_MINIMUMS).filter((group) => coverage.availableGroups.includes(group)).length;
  const eligibility = options.eligibility;

  let status = "insufficient_evidence";
  let failureReason = "observation_coverage_insufficient";
  if (eligibility && eligibility.faceLabEligible !== true) {
    status = "unavailable";
    failureReason = "eligibility_failed";
  } else if (quality.status === "unavailable") {
    status = "unavailable";
    failureReason = "structure_quality_insufficient";
  } else if (quality.status !== "available") {
    status = "insufficient_evidence";
    failureReason = "quality_response_invalid";
  } else if (coreAvailableCount === 5) {
    status = "available";
    failureReason = null;
  } else if (coreAvailableCount >= 3) {
    status = "partial";
    failureReason = null;
  }

  return {
    schemaVersion: FACE_LAB_OBSERVATION_SCHEMA_VERSION,
    model: {
      provider: options.provider || "openai",
      name: options.model || null,
      promptVersion: options.promptVersion || FACE_LAB_OBSERVATION_PROMPT_VERSION
    },
    status,
    failureReason,
    quality,
    observations,
    coverage,
    warnings: [],
    privacy: { sourceImagePersisted: false }
  };
}
