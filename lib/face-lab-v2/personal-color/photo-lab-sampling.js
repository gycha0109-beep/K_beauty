import { PERSONAL_COLOR_OBSERVATION_VERSION } from "./observation.js";

export const PERSONAL_COLOR_LAB_SAMPLING_VERSION = "face-lab-personal-color-lab-sampling-v1";

const MAX_PIXELS = 1024 * 1024;
const MIN_PIXELS_PER_REGION = 16;
const REGIONS = ["leftCheek", "rightCheek"];

function hold(reason) {
  return {
    schemaVersion: PERSONAL_COLOR_LAB_SAMPLING_VERSION,
    status: "insufficient_evidence",
    source: null,
    reason,
    regions: null,
    combined: null,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    styleColorExecution: null,
    sourceImagePersisted: false
  };
}

function isByteArray(value, expectedLength) {
  return (
    (value instanceof Uint8Array || value instanceof Uint8ClampedArray) &&
    value.length === expectedLength
  );
}

function isBinaryMask(value, pixels) {
  if (!isByteArray(value, pixels)) return false;
  for (let index = 0; index < pixels; index += 1) {
    if (value[index] !== 0 && value[index] !== 1) return false;
  }
  return true;
}

function isEligibleObservation(observation) {
  if (
    observation?.schemaVersion !== PERSONAL_COLOR_OBSERVATION_VERSION ||
    observation.status !== "available" ||
    observation.source !== "vision_observation" ||
    observation.colorSuitability !== "suitable" ||
    observation.observedColorCount !== 3 ||
    observation.sourceImagePersisted !== false ||
    !Array.isArray(observation.qualityFlags) ||
    observation.qualityFlags.length !== 0
  ) return false;

  for (const fieldName of ["apparentTemperature", "apparentBrightness", "apparentSaturation"]) {
    const field = observation.channels?.[fieldName];
    if (
      field?.status !== "available" ||
      field.source !== "vision_observation" ||
      !Array.isArray(field.evidence) ||
      !field.evidence.some((item) => typeof item === "string" && item.trim())
    ) return false;
  }
  return true;
}

function srgbChannel(value) {
  const x = value / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function labCurve(value) {
  return value > 216 / 24389
    ? Math.cbrt(value)
    : ((24389 / 27) * value + 16) / 116;
}

// sRGB IEC 61966-2-1 -> XYZ D65 -> CIELAB (2-degree reference white).
// It measures captured pixels, not calibrated skin reflectance or undertone.
function rgbToLab(r, g, b) {
  const R = srgbChannel(r);
  const G = srgbChannel(g);
  const B = srgbChannel(b);
  const x = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
  const y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const z = (R * 0.0193339 + G * 0.1191920 + B * 0.9503041) / 1.08883;
  const fx = labCurve(x);
  const fy = labCurve(y);
  const fz = labCurve(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function median(numbers) {
  const sorted = numbers.sort((a, b) => a - b);
  const index = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[index]
    : (sorted[index - 1] + sorted[index]) / 2;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function formatLab(lab) {
  const [L, a, b] = lab;
  const chroma = Math.hypot(a, b);
  return {
    lab: { L: round(L), a: round(a), b: round(b) },
    lch: {
      L: round(L),
      C: round(chroma),
      // Hue of nearly neutral pixels is physically unstable: do not invent it.
      h: chroma < 0.5 ? null : round((Math.atan2(b, a) * 180 / Math.PI + 360) % 360)
    }
  };
}

/**
 * Offline/research-only bounded sampler. Caller must provide independently
 * segmented, non-overlapping LEFT/RIGHT CHEEK masks and an exclusion mask
 * (eyes, makeup, shadows, background etc.). We do not produce those masks,
 * persist any photo/crop/pixel array, or connect this to a production result.
 *
 * A passing sample is an appearance measurement in the photograph only.
 * Lighting, color calibration and skin suitability require separate evidence.
 */
export function measurePersonalColorPhotoLab({
  observation,
  width,
  height,
  rgba,
  skinRegionMasks,
  exclusionMask
} = {}) {
  if (!isEligibleObservation(observation)) return hold("observation_not_eligible");
  if (
    !Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
    width <= 0 || height <= 0 || width * height > MAX_PIXELS ||
    !isByteArray(rgba, width * height * 4)
  ) return hold("invalid_pixel_buffer");

  const pixels = width * height;
  if (
    !skinRegionMasks ||
    !REGIONS.every((name) => isBinaryMask(skinRegionMasks[name], pixels)) ||
    !isBinaryMask(exclusionMask, pixels)
  ) return hold("region_masks_not_ready");

  const samples = { leftCheek: [], rightCheek: [] };
  for (let i = 0; i < pixels; i += 1) {
    const left = skinRegionMasks.leftCheek[i] === 1;
    const right = skinRegionMasks.rightCheek[i] === 1;
    if (left && right) return hold("overlapping_face_regions");
    if ((!left && !right) || exclusionMask[i] === 1) continue;

    const offset = i * 4;
    if (rgba[offset + 3] < 250) continue;
    const lab = rgbToLab(rgba[offset], rgba[offset + 1], rgba[offset + 2]);
    samples[left ? "leftCheek" : "rightCheek"].push(lab);
  }

  if (REGIONS.some((name) => samples[name].length < MIN_PIXELS_PER_REGION)) {
    return hold("insufficient_skin_pixels");
  }

  const unrounded = Object.fromEntries(REGIONS.map((name) => [
    name,
    [0, 1, 2].map((component) => median(samples[name].map((pixelLab) => pixelLab[component])))
  ]));
  const regions = Object.fromEntries(REGIONS.map((name) => [
    name,
    { sampleCount: samples[name].length, ...formatLab(unrounded[name]) }
  ]));
  const combined = formatLab(
    [0, 1, 2].map((component) =>
      (unrounded.leftCheek[component] + unrounded.rightCheek[component]) / 2
    )
  );

  return {
    schemaVersion: PERSONAL_COLOR_LAB_SAMPLING_VERSION,
    status: "measurement_only",
    source: "in_memory_srgb_masked_cheek_pixels",
    reason: null,
    regions,
    combined,
    seasonCandidate: null,
    undertone: null,
    suitability: null,
    styleColorExecution: null,
    sourceImagePersisted: false
  };
}
