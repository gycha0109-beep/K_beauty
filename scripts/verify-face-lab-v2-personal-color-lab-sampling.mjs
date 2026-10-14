import assert from "node:assert/strict";
import { buildFaceLabObservationAnalysis } from "../lib/face-lab-observation-contract.js";
import { buildPersonalColorObservation } from "../lib/face-lab-v2/personal-color/observation.js";
import {
  PERSONAL_COLOR_LAB_SAMPLING_VERSION,
  measurePersonalColorPhotoLab
} from "../lib/face-lab-v2/personal-color/photo-lab-sampling.js";

const field = (value, key) => ({
  value, visibility: "clear", evidence: [`fixture:${key}`], unavailableReason: null
});

function observation(overrides = {}) {
  const analysis = buildFaceLabObservationAnalysis({
    quality: {
      faceVisibility: "clear", faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
      sharpness: "clear", exposure: "balanced", lightingUniformity: "even",
      whiteBalance: "stable", filterOrEditing: "none_detected", makeupCoverage: "none_or_light",
      structureSuitability: "suitable", colorSuitability: "suitable",
      evidence: ["fixture:quality"], ...overrides
    },
    observations: {
      colorAppearance: {
        apparentTemperature: field("neutral", "temperature"),
        apparentBrightness: field("medium", "brightness"),
        apparentSaturation: field("balanced", "saturation")
      },
      visualLanguage: {
        featureContrast: field("high", "contrast")
      }
    }
  }, { eligibility: { faceLabEligible: true }, provider: "fixture", model: "fixture" });
  return buildPersonalColorObservation(analysis);
}

const width = 8;
const height = 8;
const pixels = width * height;
const rgba = new Uint8ClampedArray(pixels * 4);
const leftCheek = new Uint8Array(pixels);
const rightCheek = new Uint8Array(pixels);
const exclusionMask = new Uint8Array(pixels);

for (let index = 0; index < pixels; index += 1) {
  const isLeft = index % width < width / 2;
  if (isLeft) leftCheek[index] = 1;
  else rightCheek[index] = 1;

  const offset = index * 4;
  rgba[offset] = isLeft ? 255 : 0;
  rgba[offset + 1] = 0;
  rgba[offset + 2] = isLeft ? 0 : 255;
  rgba[offset + 3] = 255;
}

const input = { observation: observation(), width, height, rgba, skinRegionMasks: { leftCheek, rightCheek }, exclusionMask };
assert.equal(input.observation.status, "available");
const rgbaBefore = Uint8ClampedArray.from(rgba);
const measurement = measurePersonalColorPhotoLab(input);
assert.equal(measurement.schemaVersion, PERSONAL_COLOR_LAB_SAMPLING_VERSION);
assert.equal(measurement.status, "measurement_only");
assert.equal(measurement.source, "in_memory_srgb_masked_cheek_pixels");
assert.equal(measurement.regions.leftCheek.sampleCount, 32);
assert.equal(measurement.regions.rightCheek.sampleCount, 32);
assert.ok(Math.abs(measurement.regions.leftCheek.lab.L - 53.241) < 0.1);
assert.ok(Math.abs(measurement.regions.leftCheek.lab.a - 80.092) < 0.1);
assert.ok(Math.abs(measurement.regions.leftCheek.lab.b - 67.203) < 0.1);
assert.ok(Math.abs(measurement.regions.rightCheek.lab.L - 32.297) < 0.1);
assert.ok(Math.abs(measurement.regions.leftCheek.lch.C - 104.55) < 0.2);
assert.ok(Math.abs(measurement.regions.leftCheek.lch.h - 40) < 1);
assert.equal(measurement.seasonCandidate, null);
assert.equal(measurement.undertone, null);
assert.equal(measurement.suitability, null);
assert.equal(measurement.styleColorExecution, null);
assert.equal(measurement.sourceImagePersisted, false);
assert.equal(JSON.stringify(measurement).includes("rgba"), false);
assert.equal(JSON.stringify(measurement).includes("mask"), true, "source identifies masked provenance only");
assert.deepEqual(rgba, rgbaBefore, "sampler must not mutate photo pixels");
assert.deepEqual(measurePersonalColorPhotoLab(input), measurement, "same masked pixels must replay exactly");

function mustHold(inputValue, reason) {
  const result = measurePersonalColorPhotoLab(inputValue);
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(result.reason, reason);
  assert.equal(result.regions, null);
  assert.equal(result.combined, null);
  assert.equal(result.sourceImagePersisted, false);
}

mustHold({ ...input, observation: observation({ whiteBalance: "warm_cast" }) }, "observation_not_eligible");
mustHold({ ...input, observation: observation({ filterOrEditing: "heavy" }) }, "observation_not_eligible");
mustHold({ ...input, observation: null }, "observation_not_eligible");
mustHold({ ...input, width: 0 }, "invalid_pixel_buffer");
mustHold({ ...input, height: 0 }, "invalid_pixel_buffer");
mustHold({ ...input, width: 5000, height: 5000 }, "invalid_pixel_buffer");
mustHold({ ...input, rgba: [] }, "invalid_pixel_buffer");
mustHold({ ...input, exclusionMask: null }, "region_masks_not_ready");
mustHold({ ...input, skinRegionMasks: { leftCheek, rightCheek: new Uint8Array(1) } }, "region_masks_not_ready");
const invalidMask = Uint8Array.from(leftCheek);
invalidMask[0] = 255;
mustHold({ ...input, skinRegionMasks: { leftCheek: invalidMask, rightCheek } }, "region_masks_not_ready");
const overlap = Uint8Array.from(rightCheek);
overlap[0] = 1;
mustHold({ ...input, skinRegionMasks: { leftCheek, rightCheek: overlap } }, "overlapping_face_regions");

const nearlyAllExcluded = Uint8Array.from(exclusionMask);
let excludedLeft = 0;
for (let index = 0; index < pixels && excludedLeft < 17; index += 1) {
  if (leftCheek[index] === 1) {
    nearlyAllExcluded[index] = 1;
    excludedLeft += 1;
  }
}
mustHold({ ...input, exclusionMask: nearlyAllExcluded }, "insufficient_skin_pixels");

const gray = Uint8ClampedArray.from(rgba);
for (let index = 0; index < pixels; index += 1) {
  const at = index * 4;
  gray[at] = 128;
  gray[at + 1] = 128;
  gray[at + 2] = 128;
}
const grayscale = measurePersonalColorPhotoLab({ ...input, rgba: gray });
assert.equal(grayscale.status, "measurement_only");
assert.ok(Math.abs(grayscale.combined.lab.L - 53.585) < 0.2);
assert.ok(Math.abs(grayscale.combined.lab.a) < 0.02);
assert.ok(Math.abs(grayscale.combined.lab.b) < 0.02);
assert.equal(grayscale.combined.lch.h, null, "neutral/near-neutral pixels must have no arbitrary hue");

console.log("FACE_LAB_PERSONAL_COLOR_LAB_SAMPLING=PASS");
