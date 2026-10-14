import assert from "node:assert/strict";
import { buildFaceLabObservationAnalysis } from "../lib/face-lab-observation-contract.js";
import {
  buildPersonalColorObservation,
  PERSONAL_COLOR_OBSERVATION_VERSION
} from "../lib/face-lab-v2/personal-color/observation.js";

function rawObservation({
  whiteBalance = "stable",
  lightingUniformity = "even",
  colorSuitability = "suitable",
  filterOrEditing = "none_detected",
  makeupCoverage = "none_or_light",
  exposure = "balanced"
} = {}) {
  const sample = (value, evidence) => ({
    value,
    visibility: "clear",
    evidence: [evidence],
    unavailableReason: null
  });

  return {
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: {
        forehead: "none",
        brows: "none",
        eyes: "none",
        cheeks: "none",
        jawline: "none"
      },
      sharpness: "clear",
      exposure,
      lightingUniformity,
      whiteBalance,
      filterOrEditing,
      makeupCoverage,
      structureSuitability: "suitable",
      colorSuitability,
      evidence: ["fixture:photo-quality"]
    },
    observations: {
      colorAppearance: {
        apparentTemperature: sample("warm", "fixture:apparent-color-cast"),
        apparentBrightness: sample("medium", "fixture:apparent-brightness"),
        apparentSaturation: sample("muted", "fixture:apparent-saturation")
      },
      visualLanguage: {
        featureContrast: sample("high", "fixture:feature-contrast")
      }
    }
  };
}

function analysisWith(changes) {
  return buildFaceLabObservationAnalysis(rawObservation(changes), {
    eligibility: { faceLabEligible: true },
    provider: "fixture",
    model: "fixture"
  });
}

const baseline = analysisWith();
const observed = buildPersonalColorObservation(baseline);
assert.equal(observed.schemaVersion, PERSONAL_COLOR_OBSERVATION_VERSION);
assert.equal(observed.status, "available");
assert.equal(observed.colorSuitability, "suitable");
assert.equal(observed.observedColorCount, 3);
assert.deepEqual(Object.keys(observed.channels), [
  "apparentTemperature", "apparentBrightness", "apparentSaturation", "featureContrast"
]);
assert.deepEqual([
  observed.channels.apparentTemperature.value,
  observed.channels.apparentBrightness.value,
  observed.channels.apparentSaturation.value,
  observed.channels.featureContrast.value
], ["warm", "medium", "muted", "high"]);
assert.deepEqual(observed.channels.apparentTemperature.evidence, ["fixture:apparent-color-cast"]);
assert.deepEqual(observed.qualityFlags, []);
assert.equal(observed.sourceImagePersisted, false);
assert.equal(observed.seasonCandidate, null);
assert.equal(observed.paletteCandidate, null);
assert.equal(observed.styleColorExecution, null);
assert.equal(observed.confidence, null);
assert.equal(JSON.stringify(observed).includes("spring"), false);
assert.deepEqual(
  buildPersonalColorObservation({ analysis: baseline }),
  observed,
  "canonical analysis wrappers must preserve the same color observation"
);

const cast = buildPersonalColorObservation(analysisWith({ whiteBalance: "warm_cast" }));
assert.equal(cast.status, "partial");
assert.equal(cast.observedColorCount, 1);
assert.equal(cast.channels.apparentTemperature.status, "insufficient_evidence");
assert.equal(cast.channels.apparentTemperature.unavailableReason, "white_balance_unstable");
assert.equal(cast.channels.apparentSaturation.value, null);
assert.equal(cast.channels.apparentBrightness.value, "medium");
assert.ok(cast.qualityFlags.includes("white_balance_unstable"));

const dim = buildPersonalColorObservation(analysisWith({ exposure: "underexposed" }));
assert.equal(dim.channels.apparentBrightness.status, "insufficient_evidence");
assert.equal(dim.channels.apparentTemperature.value, "warm");

const uneven = buildPersonalColorObservation(analysisWith({ lightingUniformity: "uneven" }));
assert.equal(uneven.status, "insufficient_evidence");
assert.equal(uneven.observedColorCount, 0);
assert.equal(uneven.channels.apparentTemperature.unavailableReason, "lighting_not_even");

const filtered = buildPersonalColorObservation(analysisWith({ filterOrEditing: "heavy" }));
assert.equal(filtered.status, "insufficient_evidence");
assert.equal(filtered.observedColorCount, 0);
assert.ok(filtered.qualityFlags.includes("filter_uncertain"));
assert.equal(filtered.channels.featureContrast.status, "available");

const covered = buildPersonalColorObservation(analysisWith({ makeupCoverage: "heavy" }));
assert.equal(covered.observedColorCount, 0);
assert.ok(covered.qualityFlags.includes("makeup_coverage"));

const limited = buildPersonalColorObservation(analysisWith({ colorSuitability: "limited" }));
assert.equal(limited.status, "partial");
assert.equal(limited.observedColorCount, 3);
assert.ok(limited.qualityFlags.includes("color_quality_limited"));

const unsuitable = buildPersonalColorObservation(analysisWith({ colorSuitability: "unsuitable" }));
assert.equal(unsuitable.status, "insufficient_evidence");
assert.equal(unsuitable.observedColorCount, 0);
assert.equal(unsuitable.channels.apparentTemperature.value, null);
assert.ok(unsuitable.qualityFlags.includes("color_quality_unsuitable"));

const none = buildPersonalColorObservation(null);
assert.equal(none.status, "insufficient_evidence");
assert.equal(none.source, null);
assert.equal(none.observedColorCount, 0);
assert.deepEqual(none.qualityFlags, ["quality_unknown"]);
assert.equal(none.seasonCandidate, null);
assert.equal(none.sourceImagePersisted, false);

const injected = { ...baseline, imageBase64: "should-never-be-persisted" };
assert.equal(
  buildPersonalColorObservation(injected).status,
  "insufficient_evidence",
  "raw image payload must not become a valid observation authority"
);

console.log("FACE_LAB_PERSONAL_COLOR_OBSERVATION=PASS");
