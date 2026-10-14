import assert from "node:assert/strict";
import { buildFaceLabObservationAnalysis } from "../lib/face-lab-observation-contract.js";
import { buildPersonalColorObservation } from "../lib/face-lab-v2/personal-color/observation.js";
import { buildPersonalColorCheekMasks } from "../lib/face-lab-v2/personal-color/cheek-mask-geometry.js";
import { comparePersonalColorPhotoMeasurements } from "../lib/face-lab-v2/personal-color/photo-capture-comparison.js";
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


// Synthetic, normalized image-coordinate polygons -> in-memory binary masks
// -> the same independently gated CIELAB sampler. No face detector, file IO,
// skin/illumination classifier or user-facing recommendation is involved.
const rect = (x0, y0, x1, y1) => [
  { x: x0, y: y0 }, { x: x1, y: y0 },
  { x: x1, y: y1 }, { x: x0, y: y1 }
];
const left = rect(0.1, 0.2, 0.4, 0.8);
const right = rect(0.6, 0.2, 0.9, 0.8);
const excluded = [rect(0.1, 0.2, 0.4, 0.35), rect(0.45, 0.45, 0.55, 0.55)];
const masksInput = {
  width: 32, height: 32,
  cheekPolygons: { leftCheek: left, rightCheek: right },
  exclusionPolygons: excluded
};
const masks = buildPersonalColorCheekMasks(masksInput);
assert.equal(masks.status, "masks_ready");
assert.equal(masks.sourceImagePersisted, false);
assert.ok(masks.sampleCount.leftCheek >= 16);
assert.ok(masks.sampleCount.rightCheek >= 16);
assert.deepEqual(buildPersonalColorCheekMasks(masksInput), masks);
assert.equal(masks.skinRegionMasks.leftCheek.length, 1024);
assert.equal(masks.exclusionMask.length, 1024);
assert.ok(masks.exclusionMask.some((value) => value === 1));
const fixturePixels = new Uint8ClampedArray(32 * 32 * 4);
for (let p = 0; p < 32 * 32; p += 1) {
  fixturePixels[p * 4] = 128;
  fixturePixels[p * 4 + 1] = 128;
  fixturePixels[p * 4 + 2] = 128;
  fixturePixels[p * 4 + 3] = 255;
}
const pipeline = measurePersonalColorPhotoLab({
  observation: observation(),
  width: 32, height: 32,
  rgba: fixturePixels,
  skinRegionMasks: masks.skinRegionMasks,
  exclusionMask: masks.exclusionMask
});
assert.equal(pipeline.status, "measurement_only");
assert.equal(pipeline.regions.leftCheek.sampleCount, masks.sampleCount.leftCheek);
assert.equal(pipeline.regions.rightCheek.sampleCount, masks.sampleCount.rightCheek);
assert.equal(pipeline.undertone, null);
assert.equal(pipeline.seasonCandidate, null);

function masksHold(candidate, reason) {
  const value = buildPersonalColorCheekMasks(candidate);
  assert.equal(value.status, "insufficient_evidence");
  assert.equal(value.reason, reason);
  assert.equal(value.skinRegionMasks, null);
  assert.equal(value.exclusionMask, null);
  assert.equal(value.sourceImagePersisted, false);
}
masksHold({ ...masksInput, width: 0 }, "invalid_pixel_dimensions");
masksHold({ ...masksInput, height: 0 }, "invalid_pixel_dimensions");
masksHold({ ...masksInput, width: 5000, height: 5000 }, "invalid_pixel_dimensions");
masksHold({ ...masksInput, cheekPolygons: null }, "cheek_geometry_unverified");
masksHold({ ...masksInput, exclusionPolygons: [] }, "exclusion_geometry_unverified");
masksHold({
  ...masksInput, cheekPolygons: {
    leftCheek: rect(-0.1, 0.2, 0.3, 0.8), rightCheek: right
  }
}, "cheek_geometry_unverified");
masksHold({
  ...masksInput, cheekPolygons: {
    leftCheek: [
      { x: 0.1, y: 0.2 }, { x: 0.4, y: 0.8 },
      { x: 0.4, y: 0.2 }, { x: 0.1, y: 0.8 }
    ], rightCheek: right
  }
}, "cheek_geometry_unverified");
masksHold({
  ...masksInput, cheekPolygons: { leftCheek: right, rightCheek: left }
}, "cheek_orientation_mismatch");
masksHold({
  ...masksInput, cheekPolygons: { leftCheek: rect(0.1, 0.2, 0.66, 0.8), rightCheek: rect(0.6, 0.2, 0.9, 0.8) }
}, "overlapping_cheek_regions");
masksHold({
  ...masksInput, exclusionPolygons: [left, right]
}, "insufficient_unexcluded_cheek_pixels");
masksHold({
  ...masksInput, cheekPolygons: {
    leftCheek: rect(0.1, 0.2, 0.105, 0.21), rightCheek: right
  }
}, "insufficient_unexcluded_cheek_pixels");

// Untrusted polygon count/geometry must not cause unbounded raster work.
masksHold({
  ...masksInput,
  exclusionPolygons: Array.from({ length: 13 }, () => rect(0.45, 0.4, 0.55, 0.6))
}, "exclusion_geometry_unverified");
masksHold({
  ...masksInput,
  cheekPolygons: {
    leftCheek: Array.from({ length: 17 }, (_, i) => ({
      x: 0.25 + 0.1 * Math.cos((2 * Math.PI * i) / 17),
      y: 0.5 + 0.2 * Math.sin((2 * Math.PI * i) / 17)
    })),
    rightCheek: right
  }
}, "cheek_geometry_unverified");
masksHold({
  width: 1024,
  height: 1024,
  cheekPolygons: {
    leftCheek: rect(0, 0, 0.49, 1),
    rightCheek: rect(0.51, 0, 1, 1)
  },
  exclusionPolygons: Array.from({ length: 8 }, () => rect(0, 0, 1, 1))
}, "geometry_work_budget_exceeded");

// M2-C: numerical capture-to-capture difference is research evidence only.
// It never certifies skin-color reproducibility or same-subject identity.
const sameCapture = comparePersonalColorPhotoMeasurements(pipeline, pipeline);
assert.equal(sameCapture.status, "evaluation_only");
for (const region of ["combined", "leftCheek", "rightCheek"]) {
  assert.equal(sameCapture.comparison[region].deltaE76, 0);
  assert.equal(sameCapture.comparison[region].deltaL, 0);
}
const shiftedPixels = Uint8ClampedArray.from(fixturePixels);
for (let pixel = 0; pixel < 32 * 32; pixel += 1) {
  shiftedPixels[pixel * 4] = 168;
  shiftedPixels[pixel * 4 + 1] = 168;
  shiftedPixels[pixel * 4 + 2] = 168;
}
const shiftedMeasurement = measurePersonalColorPhotoLab({
  observation: observation(),
  width: 32, height: 32, rgba: shiftedPixels,
  skinRegionMasks: masks.skinRegionMasks,
  exclusionMask: masks.exclusionMask
});
assert.equal(shiftedMeasurement.status, "measurement_only");
const shiftedComparison = comparePersonalColorPhotoMeasurements(pipeline, shiftedMeasurement);
assert.equal(shiftedComparison.status, "evaluation_only");
assert.ok(shiftedComparison.comparison.combined.deltaE76 > 10);
assert.ok(shiftedComparison.comparison.combined.deltaL > 10);
assert.equal(shiftedComparison.sameSubjectVerified, false);
assert.equal(shiftedComparison.repeatabilityVerdict, null);
assert.equal(shiftedComparison.calibratedColorAccuracy, null);
assert.equal(shiftedComparison.undertone, null);
assert.equal(shiftedComparison.seasonCandidate, null);
assert.equal(shiftedComparison.suitability, null);
assert.equal(shiftedComparison.sourceImagePersisted, false);
assert.deepEqual(
  shiftedComparison,
  comparePersonalColorPhotoMeasurements(pipeline, shiftedMeasurement),
  "two measurement summaries must compare deterministically"
);
for (const invalidPair of [
  null,
  { ...pipeline, schemaVersion: "stale" },
  { ...pipeline, status: "insufficient_evidence" },
  { ...pipeline, sourceImagePersisted: true },
  { ...pipeline, combined: { lab: { L: NaN, a: 0, b: 0 } } },
  { ...pipeline, regions: { ...pipeline.regions, leftCheek: {
    ...pipeline.regions.leftCheek, sampleCount: 0
  } } }
]) {
  const held = comparePersonalColorPhotoMeasurements(pipeline, invalidPair);
  assert.equal(held.status, "insufficient_evidence");
  assert.equal(held.reason, "measurement_pair_not_eligible");
  assert.equal(held.comparison, null);
}

console.log("FACE_LAB_PERSONAL_COLOR_LAB_SAMPLING=PASS");
