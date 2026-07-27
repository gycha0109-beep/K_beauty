import {
  FACE_CONDITIONAL_FIELD_DEFINITIONS,
  FACE_CORE_FIELD_DEFINITIONS,
  SKIN_LEGACY_AXES
} from "./recommendation-feature-contract.js";

const FACE_PATH_BY_CANONICAL = Object.freeze(Object.fromEntries(
  Object.entries({ ...FACE_CORE_FIELD_DEFINITIONS, ...FACE_CONDITIONAL_FIELD_DEFINITIONS })
    .map(([name, definition]) => [name, definition.path])
));

const SKIN_AXIS_MAPPING = Object.freeze({
  barrier: Object.freeze({ support: "visibleSurfaceStressSupport", meaning: "visible_surface_stress_support" }),
  dehydration: Object.freeze({ support: "visibleDryTextureSupport", meaning: "visible_dry_texture_support" }),
  oiliness: Object.freeze({ support: "visibleShineSupport", meaning: "visible_surface_shine_support" }),
  redness: Object.freeze({ support: "visibleRednessSupport", meaning: "visible_red_appearance_support" }),
  acne: Object.freeze({ support: "visibleLocalizedSpotSupport", meaning: "visible_localized_spot_support" }),
  pores: Object.freeze({ support: "visiblePoreSupport", meaning: "visible_pore_visibility_support" }),
  uneven_tone: Object.freeze({ support: "visibleToneVariationSupport", meaning: "visible_tone_variation_support" }),
  uv: Object.freeze({ support: "uvSupport", meaning: "unsupported_from_single_photo" })
});

function setPath(target, path, value) {
  const parts = String(path).split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
}

function faceCompatibilityField(field) {
  if (
    field?.status === "available" &&
    field.value !== null &&
    Number.isFinite(field.confidence?.score) &&
    Array.isArray(field.evidence) &&
    field.evidence.length
  ) {
    return {
      status: "available",
      source: "vision",
      confidence: field.confidence.score,
      evidence: [...field.evidence],
      unavailableReason: null,
      value: field.value
    };
  }

  if (field?.status === "unavailable" || field?.status === "unsupported") {
    return {
      status: "unavailable",
      source: null,
      confidence: null,
      evidence: [],
      unavailableReason: field.unavailableReason || (field.status === "unsupported" ? "unsupported" : "unavailable"),
      value: null
    };
  }

  return {
    status: "insufficient_evidence",
    source: null,
    confidence: null,
    evidence: [],
    unavailableReason: field?.unavailableReason || "insufficient_evidence",
    value: null
  };
}

function qualityFieldValue(field) {
  return field?.status === "available" ? field.value : null;
}

function collectQualityEvidence(quality) {
  const fields = [
    quality.faceVisibility,
    quality.faceScale,
    quality.pose?.yaw,
    quality.pose?.pitch,
    quality.pose?.roll,
    quality.occlusion?.forehead,
    quality.occlusion?.brows,
    quality.occlusion?.eyes,
    quality.occlusion?.cheeks,
    quality.occlusion?.jawline,
    quality.sharpness,
    quality.exposure,
    quality.lightingUniformity,
    quality.whiteBalance,
    quality.filterOrEditing,
    quality.makeupCoverage
  ];
  return [...new Set(fields.flatMap((field) => Array.isArray(field?.evidence) ? field.evidence : []))].slice(0, 8);
}

function buildFaceQuality(canonicalBundle, derived) {
  const quality = canonicalBundle.atomic.quality;
  const structure = derived.suitability.faceStructureSuitability;
  const color = derived.suitability.skinColourSuitability;
  const values = {
    faceVisibility: qualityFieldValue(quality.faceVisibility),
    faceScale: qualityFieldValue(quality.faceScale),
    pose: {
      yaw: qualityFieldValue(quality.pose.yaw),
      pitch: qualityFieldValue(quality.pose.pitch),
      roll: qualityFieldValue(quality.pose.roll)
    },
    occlusion: {
      forehead: qualityFieldValue(quality.occlusion.forehead),
      brows: qualityFieldValue(quality.occlusion.brows),
      eyes: qualityFieldValue(quality.occlusion.eyes),
      cheeks: qualityFieldValue(quality.occlusion.cheeks),
      jawline: qualityFieldValue(quality.occlusion.jawline)
    },
    sharpness: qualityFieldValue(quality.sharpness),
    exposure: qualityFieldValue(quality.exposure),
    lightingUniformity: qualityFieldValue(quality.lightingUniformity),
    whiteBalance: qualityFieldValue(quality.whiteBalance),
    filterOrEditing: qualityFieldValue(quality.filterOrEditing),
    makeupCoverage: qualityFieldValue(quality.makeupCoverage),
    structureSuitability: structure.status === "available" ? structure.value : null,
    colorSuitability: color.status === "available" ? color.value : "unsuitable"
  };

  const confidence = quality.faceVisibility?.confidence?.score;
  const allRequired = [
    values.faceVisibility,
    values.faceScale,
    values.pose.yaw,
    values.pose.pitch,
    values.pose.roll,
    ...Object.values(values.occlusion),
    values.sharpness,
    values.exposure,
    values.lightingUniformity,
    values.whiteBalance,
    values.filterOrEditing,
    values.makeupCoverage,
    values.structureSuitability,
    values.colorSuitability
  ].every((value) => typeof value === "string" && value.length > 0);
  const evidence = collectQualityEvidence(quality);

  if (!allRequired || !Number.isFinite(confidence) || !evidence.length) {
    return {
      status: "insufficient_evidence",
      source: null,
      confidence: null,
      evidence: [],
      unavailableReason: "canonical_quality_incomplete",
      value: null
    };
  }

  return {
    status: "available",
    source: "vision",
    confidence,
    evidence,
    unavailableReason: null,
    value: values
  };
}

export function buildFaceArchetypeCompatibilityAnalysis(canonicalBundle, derived) {
  const projected = {};
  for (const [name, path] of Object.entries(FACE_PATH_BY_CANONICAL)) {
    setPath(projected, path, faceCompatibilityField(canonicalBundle.atomic.face[name]));
  }
  const observations = projected.observations || {};

  const quality = buildFaceQuality(canonicalBundle, derived);
  const coreFields = Object.keys(FACE_CORE_FIELD_DEFINITIONS);
  const availableCoreFields = coreFields.filter((name) => canonicalBundle.atomic.face[name]?.status === "available");
  const unavailableCoreFields = coreFields.filter((name) => canonicalBundle.atomic.face[name]?.status !== "available");
  const structureValue = quality.value?.structureSuitability;

  let status = "insufficient_evidence";
  let failureReason = "observation_coverage_insufficient";
  if (canonicalBundle.eligibility?.faceLabEligible !== true) {
    status = "unavailable";
    failureReason = "eligibility_failed";
  } else if (quality.status !== "available" || structureValue === "unsuitable") {
    status = "unavailable";
    failureReason = "structure_quality_insufficient";
  } else if (availableCoreFields.length === coreFields.length) {
    status = "available";
    failureReason = null;
  } else if (availableCoreFields.length >= Math.ceil(coreFields.length / 2)) {
    status = "partial";
    failureReason = null;
  }

  return {
    schemaVersion: "face-lab-observation-v1",
    model: {
      provider: "shadow_adapter",
      name: null,
      promptVersion: canonicalBundle.shadowVersion
    },
    status,
    failureReason,
    quality,
    observations,
    coverage: {
      availableGroups: [],
      partialGroups: [],
      unavailableGroups: [],
      availableFieldCount: availableCoreFields.length,
      totalCoreFieldCount: coreFields.length,
      availableFields: availableCoreFields,
      unavailableFields: unavailableCoreFields
    },
    warnings: [],
    privacy: {
      sourceImagePersisted: false
    },
    shadow: {
      canonicalStatusByField: Object.fromEntries(
        Object.keys(FACE_PATH_BY_CANONICAL).map((name) => [name, canonicalBundle.atomic.face[name]?.status || "missing"])
      ),
      productionAuthoritative: false
    }
  };
}

function buildSkinAxisResult(axis, support) {
  const mapping = SKIN_AXIS_MAPPING[axis];
  const sourceStatus = support?.status || "unavailable";
  const level = support?.status === "available" ? support.value?.level : null;
  const noneObserved = sourceStatus === "available" && level === "none";
  const unresolvedNonZero = sourceStatus === "available" && ["mild", "moderate", "high"].includes(level);

  return {
    signal: 0,
    available: noneObserved,
    sourceStatus,
    supportMeaning: mapping.meaning,
    evidenceKeys: Array.isArray(support?.evidenceKeys) ? [...support.evidenceKeys] : [],
    quantizationStatus: noneObserved
      ? "resolved_absence"
      : unresolvedNonZero
        ? "unresolved_non_zero"
        : sourceStatus === "unsupported"
          ? "unsupported"
          : "unavailable",
    observedLevel: level,
    productionAuthoritative: false
  };
}

export function buildSkinLegacyShadowAdapter(canonicalBundle, derived) {
  const axes = Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => {
    const mapping = SKIN_AXIS_MAPPING[axis];
    return [axis, buildSkinAxisResult(axis, derived.skinSupport[mapping.support])];
  }));

  const directSignals = canonicalBundle.compatibilityInputs?.directLegacySkinSignals || {};
  const comparison = Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => {
    const direct = Number.isFinite(Number(directSignals[axis])) ? Number(directSignals[axis]) : null;
    const shadow = axes[axis];
    return [axis, {
      directLegacySignal: direct,
      shadowSignal: shadow.signal,
      shadowAvailable: shadow.available,
      quantizationStatus: shadow.quantizationStatus,
      comparable: shadow.available && direct !== null,
      equalWhenComparable: shadow.available && direct !== null ? direct === shadow.signal : null
    }];
  }));

  return {
    mode: "shadow",
    productionAuthoritative: false,
    signals: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].signal])),
    availability: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].available])),
    metadata: {
      sourceStatus: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].sourceStatus])),
      supportMeaning: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].supportMeaning])),
      evidenceKeys: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].evidenceKeys])),
      quantizationStatus: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].quantizationStatus])),
      observedLevel: Object.fromEntries(SKIN_LEGACY_AXES.map((axis) => [axis, axes[axis].observedLevel]))
    },
    comparison
  };
}
