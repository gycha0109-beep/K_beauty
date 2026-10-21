import assert from "node:assert/strict";
import { buildFaceLabObservationAnalysis } from "../lib/face-lab-observation-contract.js";
import { buildPersonalColorObservation } from "../lib/face-lab-v2/personal-color/observation.js";
import { measurePersonalColorPhotoLab } from "../lib/face-lab-v2/personal-color/photo-lab-sampling.js";
import {
  evaluatePersonalColorCapturePair,
  summarizePersonalColorCapturePairs
} from "../lib/face-lab-v2/personal-color/capture-repeatability-audit.js";

const field = (value) => ({ value, visibility: "clear", evidence: ["synthetic:visible"], unavailableReason: null });
function observation(overrides = {}) {
  const analysis = buildFaceLabObservationAnalysis({
    quality: {
      faceVisibility: "clear", faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
      sharpness: "clear", exposure: "balanced",
      lightingUniformity: "even", whiteBalance: "stable",
      filterOrEditing: "none_detected", makeupCoverage: "none_or_light",
      structureSuitability: "suitable", colorSuitability: "suitable",
      evidence: ["synthetic:quality"], ...overrides
    },
    observations: { colorAppearance: {
      apparentTemperature: field("neutral"),
      apparentBrightness: field("medium"),
      apparentSaturation: field("balanced")
    } }
  }, { eligibility: { faceLabEligible: true }, provider: "fixture", model: "synthetic" });
  return buildPersonalColorObservation(analysis);
}

// Strict synthetic RGB area fixture: no participant, photo, camera, EXIF,
// face recognition, external provider or persistent identifier involved.
const width = 8, height = 8, count = width * height;
const leftCheek = new Uint8Array(count);
const rightCheek = new Uint8Array(count);
for (let i = 0; i < count; i++) {
  if (i % width < 4) leftCheek[i] = 1;
  else rightCheek[i] = 1;
}
const skinRegionMasks = { leftCheek, rightCheek };
const exclusionMask = new Uint8Array(count);
function capture(value, qualityOverride = {}) {
  const rgba = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    rgba.set([value[0], value[1], value[2], 255], i * 4);
  }
  const obs = observation(qualityOverride);
  const measurement = measurePersonalColorPhotoLab({
    observation: obs, width, height, rgba, skinRegionMasks, exclusionMask
  });
  return { observation: obs, measurement };
}

const baseline = capture([128, 128, 128]);
const secondIdentical = capture([128, 128, 128]);
const warmShift = capture([148, 128, 110]);
const deviceShift = capture([140, 140, 140]);
const bothShift = capture([165, 145, 127]);

function context(light = "same_controlled_light", device = "same_device") {
  return {
    subjectReview: "independently_reviewed_same_subject",
    roiReview: "both_independently_approved",
    orientation: "both_original_image",
    lightingRelation: light,
    deviceRelation: device
  };
}
const validPairs = [
  { baseline, followup: secondIdentical, context: context() },
  { baseline, followup: warmShift, context: context("changed_controlled_light") },
  { baseline, followup: deviceShift, context: context("same_controlled_light", "different_device") },
  { baseline, followup: bothShift, context: context("changed_controlled_light", "different_device") }
];

for (const [index, pair] of validPairs.entries()) {
  const result = evaluatePersonalColorCapturePair(pair);
  assert.equal(result.status, "evaluation_only", JSON.stringify({ index, result }));
  assert.equal(result.colorDifference.combined.deltaE76 === 0, index === 0);
  assert.equal(result.calibratedColorAccuracy, null);
  assert.equal(result.repeatabilityVerdict, null);
  assert.equal(result.sameSubjectVerified, false);
  assert.equal(result.undertone, null);
  assert.equal(result.seasonCandidate, null);
  assert.equal(result.suitability, null);
  assert.equal(result.sourceImagePersisted, false);
  assert.deepEqual(result, evaluatePersonalColorCapturePair(pair));
}
assert.deepEqual(validPairs.map((p) => evaluatePersonalColorCapturePair(p).scenario), [
  "controlled_repeat", "lighting_stress", "device_stress", "combined_stress"
]);

function shouldHold(pair, reason) {
  const result = evaluatePersonalColorCapturePair(pair);
  assert.equal(result.status, "insufficient_evidence", JSON.stringify(result));
  assert.equal(result.reason, reason);
  assert.equal(result.colorDifference, null);
  assert.equal(result.calibratedColorAccuracy, null);
  assert.equal(result.repeatabilityVerdict, null);
}
shouldHold({ ...validPairs[0], followup: capture([130,130,130], { whiteBalance: "warm_cast" }) },
  "photo_observation_not_eligible");
shouldHold({ ...validPairs[0], followup: capture([130,130,130], { filterOrEditing: "possible" }) },
  "photo_observation_not_eligible");
shouldHold({ ...validPairs[0], followup: capture([130,130,130], { makeupCoverage: "moderate" }) },
  "photo_observation_not_eligible");
shouldHold({ ...validPairs[0], followup: capture([130,130,130], { lightingUniformity: "uneven" }) },
  "photo_observation_not_eligible");
shouldHold({ ...validPairs[0], followup: capture([130,130,130], { sharpness: "blurred" }) },
  "photo_observation_not_eligible");
shouldHold({ ...validPairs[0], context: { ...context(), roiReview: "not_reviewed" } },
  "skin_roi_not_independently_reviewed");
shouldHold({ ...validPairs[0], context: { ...context(), orientation: "mirrored_preview" } },
  "original_image_orientation_not_verified");
shouldHold({ ...validPairs[0], context: { ...context(), subjectReview: "unverified" } },
  "subject_pair_not_reviewed");
shouldHold({ ...validPairs[0], context: { ...context(), lightingRelation: "uncontrolled" } },
  "capture_conditions_unknown");
shouldHold({ ...validPairs[0], followup: {
  ...secondIdentical, measurement: { ...secondIdentical.measurement, status: "insufficient_evidence" }
} }, "measurement_pair_not_eligible");
shouldHold({ ...validPairs[0], baseline: { ...baseline, photoBytes: "do-not-accept" } },
  "photo_observation_not_eligible");
shouldHold({ ...validPairs[0], context: { ...context(), deviceSerial: "DO_NOT_STORE" } },
  "capture_metadata_not_verified");

const summary = summarizePersonalColorCapturePairs([
  ...validPairs,
  { ...validPairs[0], context: { ...context(), roiReview: "not_reviewed" } },
  { ...validPairs[0], followup: capture([130,130,130], { whiteBalance: "warm_cast" }) },
  { ...validPairs[0], capturedImagePath: "NEVER_ACCEPT_RAW_FILES" }
]);
assert.equal(summary.status, "evaluation_only");
assert.equal(summary.total, 7);
assert.equal(summary.accepted, 4);
assert.equal(summary.held, 3);
for (const scenario of ["controlled_repeat", "lighting_stress", "device_stress", "combined_stress"]) {
  assert.equal(summary.scenarios[scenario].count, 1);
}
assert.equal(summary.scenarios.controlled_repeat.medianDeltaE76, 0);
assert.ok(summary.scenarios.lighting_stress.medianDeltaE76 > 0);
assert.ok(summary.scenarios.device_stress.medianDeltaE76 > 0);
assert.deepEqual(summary.holdReasons, {
  skin_roi_not_independently_reviewed: 1,
  photo_observation_not_eligible: 1,
  capture_pair_schema_invalid: 1
});
assert.equal(JSON.stringify(summary).includes("DO_NOT_STORE"), false);
assert.equal(JSON.stringify(summary).includes("NEVER_ACCEPT_RAW_FILES"), false);
assert.equal(summary.calibratedColorAccuracy, null);
assert.equal(summary.repeatabilityVerdict, null);
assert.equal(summary.sourceImagePersisted, false);
for (const input of [[], Array.from({ length: 101 }, () => validPairs[0]), null]) {
  const held = summarizePersonalColorCapturePairs(input);
  assert.equal(held.status, "insufficient_evidence");
  assert.equal(held.reason, "cohort_size_out_of_bounds");
}

console.log(JSON.stringify({
  ok: true,
  syntheticPairs: 7,
  accepted: summary.accepted,
  held: summary.held,
  scenarios: summary.scenarios,
  holdReasons: summary.holdReasons,
  realPhotos: 0,
  calibrationReferences: 0,
  actualAccuracyValidated: false,
  realDeviceValidated: false
}, null, 2));
