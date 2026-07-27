import {
  FACE_CONDITIONAL_FIELD_DEFINITIONS,
  FACE_CORE_FIELD_DEFINITIONS,
  QUALITY_ENUMS,
  RECOMMENDATION_FEATURE_SCHEMA_VERSION,
  RECOMMENDATION_FEATURE_SHADOW_VERSION,
  SKIN_CONDITIONAL_FIELDS,
  SKIN_CORE_FIELDS,
  createAvailableObservation,
  createInsufficientObservation,
  createUnavailableObservation,
  normalizeObservationConfidence
} from "./recommendation-feature-contract.js";

const SKIN_CUE_DEFINITIONS = Object.freeze({
  visibleSurfaceShine: Object.freeze({ cues: ["surface_shine"], keys: ["oiliness"] }),
  visibleDryTexture: Object.freeze({ cues: ["dry_texture"], keys: ["dehydration"] }),
  visibleRedness: Object.freeze({ cues: ["red_appearance"], keys: ["redness"] }),
  visibleToneVariation: Object.freeze({ cues: ["tone_variation"], keys: ["uneven_tone"] }),
  visibleFlaking: Object.freeze({ cues: ["visible_flaking"], keys: ["dehydration", "barrier"] }),
  visibleLocalizedSpots: Object.freeze({ cues: ["active_spots"], keys: ["acne"] }),
  visiblePores: Object.freeze({ cues: ["pore_visibility"], keys: ["pores"] })
});

const LEGACY_TO_CANONICAL_LEVEL = Object.freeze({
  low: "mild",
  mild: "mild",
  moderate: "moderate",
  high: "high"
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function resolvePath(value, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, part) => (current && typeof current === "object" ? current[part] : null), value);
}

function uniqueStrings(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim().replace(/\s+/g, " "))
    .filter(Boolean))].slice(0, limit);
}

function canonicalizeExistingField(field, allowedValues) {
  if (!isPlainObject(field)) {
    return createInsufficientObservation("field_missing");
  }

  if (field.status === "available") {
    const confidence = normalizeObservationConfidence(field.confidence);
    const evidence = uniqueStrings(field.evidence);
    if (
      allowedValues.includes(field.value) &&
      Number.isFinite(confidence.score) &&
      evidence.length
    ) {
      return createAvailableObservation(field.value, {
        confidence,
        evidence
      });
    }
    return createInsufficientObservation(
      !allowedValues.includes(field.value)
        ? "value_invalid"
        : !Number.isFinite(confidence.score)
          ? "numeric_confidence_missing"
          : "evidence_missing",
      {
        confidence,
        evidence,
        source: field.source === "vision" ? "vision" : null
      }
    );
  }

  if (field.status === "unavailable") {
    return createUnavailableObservation(field.unavailableReason || "unavailable");
  }

  return createInsufficientObservation(field.unavailableReason || "insufficient_evidence", {
    confidence: field.confidence,
    evidence: field.evidence,
    source: field.source === "vision" ? "vision" : null
  });
}

function qualityObservation(value, allowedValues, qualityField, name) {
  if (qualityField?.status !== "available" || !isPlainObject(qualityField.value)) {
    return createInsufficientObservation("quality_response_invalid");
  }
  if (!allowedValues.includes(value) || value === "unknown") {
    return createInsufficientObservation(`${name}_uncertain`, {
      confidence: qualityField.confidence,
      evidence: qualityField.evidence,
      source: "vision"
    });
  }
  return createAvailableObservation(value, {
    confidence: qualityField.confidence,
    evidence: qualityField.evidence
  });
}

function buildQualityAtomic(faceAnalysis) {
  const qualityField = faceAnalysis?.quality;
  const quality = qualityField?.value || {};
  const pose = quality.pose || {};
  const occlusion = quality.occlusion || {};

  return {
    faceVisibility: qualityObservation(quality.faceVisibility, QUALITY_ENUMS.faceVisibility, qualityField, "face_visibility"),
    faceScale: qualityObservation(quality.faceScale, QUALITY_ENUMS.faceScale, qualityField, "face_scale"),
    pose: {
      yaw: qualityObservation(pose.yaw, QUALITY_ENUMS.yaw, qualityField, "yaw"),
      pitch: qualityObservation(pose.pitch, QUALITY_ENUMS.pitch, qualityField, "pitch"),
      roll: qualityObservation(pose.roll, QUALITY_ENUMS.roll, qualityField, "roll")
    },
    occlusion: {
      forehead: qualityObservation(occlusion.forehead, QUALITY_ENUMS.occlusion, qualityField, "forehead_occlusion"),
      brows: qualityObservation(occlusion.brows, QUALITY_ENUMS.occlusion, qualityField, "brow_occlusion"),
      eyes: qualityObservation(occlusion.eyes, QUALITY_ENUMS.occlusion, qualityField, "eye_occlusion"),
      cheeks: qualityObservation(occlusion.cheeks, QUALITY_ENUMS.occlusion, qualityField, "cheek_occlusion"),
      jawline: qualityObservation(occlusion.jawline, QUALITY_ENUMS.occlusion, qualityField, "jawline_occlusion")
    },
    sharpness: qualityObservation(quality.sharpness, QUALITY_ENUMS.sharpness, qualityField, "sharpness"),
    exposure: qualityObservation(quality.exposure, QUALITY_ENUMS.exposure, qualityField, "exposure"),
    lightingUniformity: qualityObservation(quality.lightingUniformity, QUALITY_ENUMS.lightingUniformity, qualityField, "lighting_uniformity"),
    whiteBalance: qualityObservation(quality.whiteBalance, QUALITY_ENUMS.whiteBalance, qualityField, "white_balance"),
    filterOrEditing: qualityObservation(quality.filterOrEditing, QUALITY_ENUMS.filterOrEditing, qualityField, "filter_or_editing"),
    makeupCoverage: qualityObservation(quality.makeupCoverage, QUALITY_ENUMS.makeupCoverage, qualityField, "makeup_coverage")
  };
}

function buildFaceAtomic(faceAnalysis) {
  const face = {};
  for (const [name, definition] of Object.entries({
    ...FACE_CORE_FIELD_DEFINITIONS,
    ...FACE_CONDITIONAL_FIELD_DEFINITIONS
  })) {
    face[name] = canonicalizeExistingField(
      resolvePath(faceAnalysis, definition.path),
      definition.values
    );
  }
  return face;
}

function skinEvidenceKey(item) {
  return [
    "vision_skin",
    item?.cue || "uncertain",
    item?.key || "unknown",
    item?.area || "unknown",
    item?.level || "unknown"
  ].join(":");
}

function buildSkinCueField(name, observations, skinEligible) {
  if (!skinEligible) {
    return createUnavailableObservation("skin_analysis_ineligible");
  }

  const definition = SKIN_CUE_DEFINITIONS[name];
  const matches = observations.filter((item) =>
    isPlainObject(item) &&
    definition.cues.includes(item.cue) &&
    definition.keys.includes(item.key) &&
    LEGACY_TO_CANONICAL_LEVEL[item.level]
  );

  if (!matches.length) {
    return createInsufficientObservation("cue_not_reported");
  }

  const order = { mild: 1, moderate: 2, high: 3 };
  const level = matches
    .map((item) => LEGACY_TO_CANONICAL_LEVEL[item.level])
    .sort((left, right) => order[right] - order[left])[0];
  const observedAreas = [...new Set(matches.map((item) => item.area).filter(Boolean))];
  const affectedAreas = [...observedAreas];
  const confidenceLevels = matches.map((item) => item.confidence).filter(Boolean);
  const confidence = confidenceLevels.includes("high")
    ? "high"
    : confidenceLevels.includes("medium")
      ? "medium"
      : "low";

  return createAvailableObservation({
    level,
    observedAreas,
    affectedAreas
  }, {
    confidence,
    evidence: matches.map(skinEvidenceKey)
  });
}

function buildSkinAtomic(bundle) {
  const skinEligible = bundle?.eligibility?.skinAnalysisEligible === true;
  const observations = Array.isArray(bundle?.skin?.observations) ? bundle.skin.observations : [];
  const skin = {};
  for (const name of [...SKIN_CORE_FIELDS, ...SKIN_CONDITIONAL_FIELDS]) {
    skin[name] = buildSkinCueField(name, observations, skinEligible);
  }
  return skin;
}

export function normalizeRecommendationFeatureBundle(visionBundle) {
  const bundle = isPlainObject(visionBundle) ? visionBundle : {};
  const faceAnalysis = bundle?.face?.analysis || null;
  const providerQuality = faceAnalysis?.quality?.value || null;

  return {
    schemaVersion: RECOMMENDATION_FEATURE_SCHEMA_VERSION,
    shadowVersion: RECOMMENDATION_FEATURE_SHADOW_VERSION,
    mode: "shadow",
    productionAuthoritative: false,
    source: "vision_observation_bundle",
    eligibility: bundle.eligibility || null,
    atomic: {
      quality: buildQualityAtomic(faceAnalysis),
      face: buildFaceAtomic(faceAnalysis),
      skin: buildSkinAtomic(bundle)
    },
    compatibilityInputs: {
      providerSuitability: {
        structureSuitability: providerQuality?.structureSuitability || null,
        colorSuitability: providerQuality?.colorSuitability || null
      },
      directLegacySkinSignals: isPlainObject(bundle?.skin?.signals)
        ? { ...bundle.skin.signals }
        : null,
      originalFaceAnalysisStatus: faceAnalysis?.status || null
    },
    privacy: {
      sourceImagePersisted: false,
      faceCropPersisted: false,
      rawProviderResponsePersisted: false
    }
  };
}
