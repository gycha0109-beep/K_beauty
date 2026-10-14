import { PERSONAL_COLOR_LAB_SAMPLING_VERSION } from "./photo-lab-sampling.js";

export const PERSONAL_COLOR_CAPTURE_COMPARISON_VERSION = "face-lab-personal-color-capture-comparison-v1";

function hold(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_CAPTURE_COMPARISON_VERSION,
    status: "insufficient_evidence",
    reason,
    comparison: null,
    sameSubjectVerified: false,
    repeatabilityVerdict: null,
    calibratedColorAccuracy: null,
    undertone: null,
    seasonCandidate: null,
    suitability: null,
    sourceImagePersisted: false
  };
}

function validLab(value) {
  return (
    value && typeof value === "object" &&
    Number.isFinite(value.L) && value.L >= 0 && value.L <= 100 &&
    Number.isFinite(value.a) && Math.abs(value.a) <= 160 &&
    Number.isFinite(value.b) && Math.abs(value.b) <= 160
  );
}

function validMeasurement(value) {
  if (
    value?.schemaVersion !== PERSONAL_COLOR_LAB_SAMPLING_VERSION ||
    value.status !== "measurement_only" ||
    value.source !== "in_memory_srgb_masked_cheek_pixels" ||
    value.sourceImagePersisted !== false ||
    !validLab(value.combined?.lab)
  ) return false;
  for (const key of ["leftCheek", "rightCheek"]) {
    if (
      !validLab(value.regions?.[key]?.lab) ||
      !Number.isSafeInteger(value.regions[key].sampleCount) ||
      value.regions[key].sampleCount < 16
    ) return false;
  }
  return true;
}

function compareLab(first, second) {
  const deltaL = second.L - first.L;
  const deltaA = second.a - first.a;
  const deltaB = second.b - first.b;
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    deltaL: round(deltaL),
    deltaA: round(deltaA),
    deltaB: round(deltaB),
    deltaE76: round(Math.hypot(deltaL, deltaA, deltaB))
  };
}

/**
 * M2-C offline evaluation primitive: compare two already sanitized in-memory
 * color summaries. The caller has NOT proven that they are from the same
 * person, controlled lighting or calibrated equipment. No fixed threshold
 * for repeatability, undertone, season or suitability is asserted.
 */
export function comparePersonalColorPhotoMeasurements(first, second) {
  if (!validMeasurement(first) || !validMeasurement(second)) {
    return hold("measurement_pair_not_eligible");
  }
  return {
    schemaVersion: PERSONAL_COLOR_CAPTURE_COMPARISON_VERSION,
    status: "evaluation_only",
    reason: null,
    comparison: {
      combined: compareLab(first.combined.lab, second.combined.lab),
      leftCheek: compareLab(first.regions.leftCheek.lab, second.regions.leftCheek.lab),
      rightCheek: compareLab(first.regions.rightCheek.lab, second.regions.rightCheek.lab)
    },
    sameSubjectVerified: false,
    repeatabilityVerdict: null,
    calibratedColorAccuracy: null,
    undertone: null,
    seasonCandidate: null,
    suitability: null,
    sourceImagePersisted: false
  };
}
