import { getFaceLabObservationAnalysis } from "../../face-lab-analysis-bundle.js";

export const PERSONAL_COLOR_OBSERVATION_VERSION = "face-lab-personal-color-observation-v1";

const CHANNEL_FIELDS = Object.freeze({
  apparentTemperature: Object.freeze({
    group: "colorAppearance",
    field: "apparentTemperature",
    values: ["warm", "neutral", "cool"]
  }),
  apparentBrightness: Object.freeze({
    group: "colorAppearance",
    field: "apparentBrightness",
    values: ["low", "medium", "high"]
  }),
  apparentSaturation: Object.freeze({
    group: "colorAppearance",
    field: "apparentSaturation",
    values: ["muted", "balanced", "clear"]
  }),
  featureContrast: Object.freeze({
    group: "visualLanguage",
    field: "featureContrast",
    values: ["low", "medium", "high"]
  })
});

function unavailable(reason) {
  return {
    status: "insufficient_evidence",
    value: null,
    source: null,
    evidence: [],
    unavailableReason: reason
  };
}

function availableField(analysis, key) {
  const config = CHANNEL_FIELDS[key];
  const field = analysis?.observations?.[config.group]?.[config.field];
  if (
    field?.status !== "available" ||
    field.source !== "vision" ||
    !config.values.includes(field.value) ||
    !Array.isArray(field.evidence) ||
    !field.evidence.some((item) => typeof item === "string" && item.trim())
  ) {
    return unavailable("observation_missing");
  }
  return {
    status: "available",
    value: field.value,
    source: "vision_observation",
    evidence: field.evidence.filter((item) => typeof item === "string" && item.trim()).slice(0, 8),
    unavailableReason: null
  };
}

function qualityFlags(quality) {
  if (!quality) return ["quality_unknown"];

  const flags = [];
  if (quality.colorSuitability === "limited") flags.push("color_quality_limited");
  if (quality.colorSuitability === "unsuitable") flags.push("color_quality_unsuitable");
  if (quality.whiteBalance !== "stable") flags.push("white_balance_unstable");
  if (quality.lightingUniformity !== "even") flags.push("lighting_not_even");
  if (quality.exposure !== "balanced") flags.push("exposure_unbalanced");
  if (quality.filterOrEditing !== "none_detected") flags.push("filter_uncertain");
  if (quality.makeupCoverage !== "none_or_light") flags.push("makeup_coverage");
  return flags;
}

function channelQualityReason(key, quality) {
  if (!quality || quality.colorSuitability === "unsuitable") return "color_quality_insufficient";

  // Report only what is *visible* in the photograph, never true undertone,
  // season or objectively flattering palette. Avoid misleading color reads
  // from cast/lighting/retouching while keeping other channels independent.
  if (key !== "featureContrast") {
    if (quality.filterOrEditing !== "none_detected") return "filter_uncertain";
    if (quality.makeupCoverage !== "none_or_light") return "makeup_coverage";
    if (quality.lightingUniformity !== "even") return "lighting_not_even";
  }

  if (key === "apparentTemperature" || key === "apparentSaturation") {
    if (quality.whiteBalance !== "stable") return "white_balance_unstable";
  }

  if (key === "apparentBrightness" && quality.exposure !== "balanced") {
    return "exposure_unbalanced";
  }

  if (key === "featureContrast" && quality.faceVisibility === "poor") {
    return "face_not_visible";
  }
  return null;
}

/**
 * M2-A only: derive an explicitly non-diagnostic color observation from the
 * already sanitized Face Lab Vision analysis. No image pixels, crop, provider
 * payload, user target, palette, season classification or numeric confidence.
 *
 * Quality flags are for internal abstention/research, not a new result banner
 * or a reason to block the photo-upload step.
 */
export function buildPersonalColorObservation(analysisInput) {
  const analysis = getFaceLabObservationAnalysis(analysisInput);
  const quality = analysis?.quality?.status === "available"
    ? analysis.quality.value
    : null;
  const disallowed = !analysis || analysis.status === "unavailable" || !quality;

  const channels = {};
  for (const key of Object.keys(CHANNEL_FIELDS)) {
    const reason = disallowed
      ? "analysis_unavailable"
      : channelQualityReason(key, quality);
    channels[key] = reason ? unavailable(reason) : availableField(analysis, key);
  }

  const colorKeys = ["apparentTemperature", "apparentBrightness", "apparentSaturation"];
  const observedColorCount = colorKeys.filter((key) => channels[key].status === "available").length;

  let status = "insufficient_evidence";
  if (!disallowed && quality.colorSuitability !== "unsuitable" && observedColorCount) {
    status = observedColorCount === colorKeys.length && quality.colorSuitability === "suitable"
      ? "available"
      : "partial";
  }

  return {
    schemaVersion: PERSONAL_COLOR_OBSERVATION_VERSION,
    status,
    source: analysis ? "vision_observation" : null,
    colorSuitability: quality?.colorSuitability || "unknown",
    channels,
    qualityFlags: qualityFlags(quality),
    observedColorCount,
    // Deliberately absent: synthetic season labels and uncalibrated scores.
    // These separate authorities require validated evidence in later M2 work.
    seasonCandidate: null,
    paletteCandidate: null,
    styleColorExecution: null,
    confidence: null,
    sourceImagePersisted: false
  };
}
