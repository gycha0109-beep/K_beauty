import { PERSONAL_COLOR_OBSERVATION_VERSION } from "./observation.js";
import { comparePersonalColorPhotoMeasurements } from "./photo-capture-comparison.js";

// Offline M2 color repeatability evidence: never an undertone, skin diagnosis,
// season, shade match, calibration claim or clinical accuracy statistic.
export const PERSONAL_COLOR_REPEATABILITY_AUDIT_VERSION =
  "face-lab-personal-color-repeatability-audit-v1";

const AXES = ["apparentTemperature", "apparentBrightness", "apparentSaturation"];
const MAX_PAIRS = 100;
const SCENARIOS = [
  "controlled_repeat",
  "lighting_stress",
  "device_stress",
  "combined_stress"
];

function plain(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(object, allowed) {
  return plain(object) &&
    Object.keys(object).every((key) => allowed.includes(key)) &&
    allowed.every((key) => Object.hasOwn(object, key));
}

function hold(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_REPEATABILITY_AUDIT_VERSION,
    status: "insufficient_evidence",
    reason,
    scenario: null,
    colorDifference: null,
    calibratedColorAccuracy: null,
    repeatabilityVerdict: null,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    sameSubjectVerified: false,
    sourceImagePersisted: false
  };
}

function validObservation(value) {
  return value?.schemaVersion === PERSONAL_COLOR_OBSERVATION_VERSION &&
    value.status === "available" &&
    value.source === "vision_observation" &&
    value.colorSuitability === "suitable" &&
    value.observedColorCount === 3 &&
    value.sourceImagePersisted === false &&
    Array.isArray(value.qualityFlags) &&
    value.qualityFlags.length === 0 &&
    AXES.every((key) => value.channels?.[key]?.status === "available");
}

function validCapture(value) {
  // Reject unexpected image/crop/identity/EXIF fields rather than merely
  // ignoring them. Only the canonical derived, non-image summaries enter.
  return exactKeys(value, ["observation", "measurement"]) &&
    validObservation(value.observation);
}

function validContext(value) {
  return exactKeys(value, [
    "subjectReview", "roiReview", "orientation",
    "lightingRelation", "deviceRelation"
  ]);
}

/**
 * Pair two already derived appearance measurements with independently
 * documented photographic comparability. Inputs are never copied to output,
 * cached, logged, serialized or persisted by this module.
 *
 * "independently_reviewed" is an external assertion, not identity proof by
 * software; even accepted pairs remain evaluation_only, never accuracy PASS.
 */
export function evaluatePersonalColorCapturePair({
  baseline, followup, context
} = {}) {
  if (!validCapture(baseline) || !validCapture(followup)) {
    return hold("photo_observation_not_eligible");
  }
  if (!validContext(context)) return hold("capture_metadata_not_verified");
  if (context.subjectReview !== "independently_reviewed_same_subject") {
    return hold("subject_pair_not_reviewed");
  }
  if (context.roiReview !== "both_independently_approved") {
    return hold("skin_roi_not_independently_reviewed");
  }
  if (context.orientation !== "both_original_image") {
    return hold("original_image_orientation_not_verified");
  }
  if (!["same_device", "different_device"].includes(context.deviceRelation) ||
      !["same_controlled_light", "changed_controlled_light"].includes(context.lightingRelation)) {
    return hold("capture_conditions_unknown");
  }

  const comparison = comparePersonalColorPhotoMeasurements(
    baseline.measurement, followup.measurement
  );
  if (comparison.status !== "evaluation_only") {
    return hold("measurement_pair_not_eligible");
  }

  const lightChanged = context.lightingRelation === "changed_controlled_light";
  const deviceChanged = context.deviceRelation === "different_device";
  const scenario = lightChanged && deviceChanged
    ? "combined_stress"
    : lightChanged ? "lighting_stress"
      : deviceChanged ? "device_stress" : "controlled_repeat";

  return {
    schemaVersion: PERSONAL_COLOR_REPEATABILITY_AUDIT_VERSION,
    status: "evaluation_only",
    reason: null,
    scenario,
    // ΔE76 is a pixel-derived difference, not an objective color accuracy
    // score or a change in the person's actual skin reflectance.
    colorDifference: comparison.comparison,
    calibratedColorAccuracy: null,
    repeatabilityVerdict: null,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    sameSubjectVerified: false,
    sourceImagePersisted: false
  };
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return Math.round(1000 * (sorted.length % 2
    ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2)) / 1000;
}

/**
 * Bounded, metadata-only cohort summary. No per-photo IDs, skin measurements,
 * original images, face landmarks or reviewer identifiers are returned.
 * The fixed scenarios are analytical strata, NOT pass/fail thresholds.
 */
export function summarizePersonalColorCapturePairs(pairs) {
  if (!Array.isArray(pairs) || pairs.length === 0 || pairs.length > MAX_PAIRS) {
    return {
      schemaVersion: PERSONAL_COLOR_REPEATABILITY_AUDIT_VERSION,
      status: "insufficient_evidence",
      reason: "cohort_size_out_of_bounds",
      total: 0,
      accepted: 0,
      held: 0,
      scenarios: null,
      holdReasons: null,
      calibratedColorAccuracy: null,
      repeatabilityVerdict: null,
      sourceImagePersisted: false
    };
  }
  const strata = Object.fromEntries(SCENARIOS.map((name) => [name, []]));
  const holdReasons = {};
  for (const pair of pairs) {
    // No arbitrary metadata, image paths or subject IDs in benchmark rows.
    const result = exactKeys(pair, ["baseline", "followup", "context"])
      ? evaluatePersonalColorCapturePair(pair)
      : hold("capture_pair_schema_invalid");
    if (result.status === "evaluation_only") {
      strata[result.scenario].push(result.colorDifference.combined.deltaE76);
    } else {
      holdReasons[result.reason] = (holdReasons[result.reason] || 0) + 1;
    }
  }
  const scenarios = Object.fromEntries(SCENARIOS.map((name) => [name, {
    count: strata[name].length,
    medianDeltaE76: median(strata[name])
  }]));
  const accepted = Object.values(strata).reduce((total, items) => total + items.length, 0);
  return {
    schemaVersion: PERSONAL_COLOR_REPEATABILITY_AUDIT_VERSION,
    status: "evaluation_only",
    reason: null,
    total: pairs.length,
    accepted,
    held: pairs.length - accepted,
    scenarios,
    holdReasons,
    calibratedColorAccuracy: null,
    repeatabilityVerdict: null,
    sourceImagePersisted: false
  };
}
