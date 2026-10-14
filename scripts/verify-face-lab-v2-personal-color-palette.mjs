import assert from "node:assert/strict";
import { PERSONAL_COLOR_OBSERVATION_VERSION } from "../lib/face-lab-v2/personal-color/observation.js";
import {
  PERSONAL_COLOR_PALETTE_CANDIDATE_VERSION,
  buildPersonalColorPaletteCandidate
} from "../lib/face-lab-v2/personal-color/palette-candidate.js";

function observation({
  temperature = "warm",
  brightness = "medium",
  saturation = "muted",
  contrast = "high"
} = {}) {
  const channel = (value, label) => ({
    status: "available",
    value,
    source: "vision_observation",
    evidence: [`fixture:${label}`],
    unavailableReason: null
  });
  return {
    schemaVersion: PERSONAL_COLOR_OBSERVATION_VERSION,
    status: "available",
    source: "vision_observation",
    colorSuitability: "suitable",
    observedColorCount: 3,
    sourceImagePersisted: false,
    qualityFlags: [],
    channels: {
      apparentTemperature: channel(temperature, "temperature"),
      apparentBrightness: channel(brightness, "brightness"),
      apparentSaturation: channel(saturation, "saturation"),
      featureContrast: channel(contrast, "contrast")
    }
  };
}

const original = observation();
const inputBefore = JSON.stringify(original);
const preview = buildPersonalColorPaletteCandidate(original);
assert.equal(preview.schemaVersion, PERSONAL_COLOR_PALETTE_CANDIDATE_VERSION);
assert.equal(preview.status, "exploratory");
assert.equal(preview.paletteCandidate.authority, "photo_appearance_reference_only");
assert.deepEqual(preview.paletteCandidate.familyTokens, ["caramel", "warm_taupe", "terracotta"]);
assert.equal(preview.paletteCandidate.chromaDirection, "softened");
assert.equal(preview.paletteCandidate.contrast, "high");
assert.equal(preview.executionPreview.authority, "not_product_or_shade_advice");
assert.equal(preview.executionPreview.hairColorFamily, "warm_brown");
assert.equal(preview.confidence, null);
assert.equal(preview.undertone, null);
assert.equal(preview.seasonCandidate, null);
assert.equal(preview.suitability, null);
assert.equal(preview.styleColorExecution, null, "must not overwrite target-based Color Engine");
assert.deepEqual(preview.productOrShadeMatches, []);
assert.equal(preview.sourceImagePersisted, false);
assert.equal(JSON.stringify(original), inputBefore, "must not mutate M2-A observation");
assert.deepEqual(buildPersonalColorPaletteCandidate(original), preview, "same observation must replay deterministically");

const cool = buildPersonalColorPaletteCandidate(observation({
  temperature: "cool", brightness: "low", saturation: "clear"
}));
assert.deepEqual(cool.paletteCandidate.familyTokens, ["navy", "plum", "slate"]);
assert.equal(cool.paletteCandidate.chromaDirection, "clearer");
assert.equal(cool.executionPreview.lipColorFamily, "berry_rose");

const neutral = buildPersonalColorPaletteCandidate(observation({
  temperature: "neutral", brightness: "high", saturation: "balanced"
}));
assert.deepEqual(neutral.paletteCandidate.familyTokens, ["soft_white", "oat", "dusty_rose"]);
assert.equal(neutral.paletteCandidate.chromaDirection, "balanced");

const missingContrast = observation();
missingContrast.channels.featureContrast.status = "insufficient_evidence";
assert.equal(buildPersonalColorPaletteCandidate(missingContrast).paletteCandidate.contrast, null);

function shouldHold(input, reason) {
  const held = buildPersonalColorPaletteCandidate(input);
  assert.equal(held.status, "insufficient_evidence");
  assert.equal(held.reason, reason);
  assert.equal(held.paletteCandidate, null);
  assert.equal(held.executionPreview, null);
  assert.equal(held.sourceImagePersisted, false);
  assert.deepEqual(held.productOrShadeMatches, []);
}

shouldHold(null, "observation_not_eligible");
shouldHold({ ...original, schemaVersion: "unknown" }, "observation_not_eligible");
shouldHold({ ...original, status: "partial" }, "observation_not_eligible");
shouldHold({ ...original, colorSuitability: "limited" }, "observation_not_eligible");
shouldHold({ ...original, sourceImagePersisted: true }, "observation_not_eligible");
shouldHold({ ...original, observedColorCount: 2 }, "observation_not_eligible");
shouldHold({ ...original, source: "target_style" }, "observation_not_eligible");
shouldHold({ ...original, qualityFlags: ["white_balance_unstable"] }, "photo_quality_uncertain");
shouldHold({ ...original, qualityFlags: [] , channels: {
  ...original.channels,
  apparentTemperature: { ...original.channels.apparentTemperature, source: "user_target" }
}}, "required_color_channel_missing");
shouldHold({ ...original, channels: {
  ...original.channels,
  apparentBrightness: { ...original.channels.apparentBrightness, evidence: [] }
}}, "required_color_channel_missing");
shouldHold({ ...original, channels: {
  ...original.channels,
  apparentSaturation: { ...original.channels.apparentSaturation, value: "fake_clear" }
}}, "required_color_channel_missing");

// Caller-supplied target preferences, simulated season labels and image data
// are deliberately ignored: the module never reflects or elevates them.
const contaminated = {
  ...original,
  targetStyle: { vector: { warmCool: 0.99 } },
  seasonCandidate: "spring",
  base64: "secret-image-data"
};
assert.deepEqual(buildPersonalColorPaletteCandidate(contaminated), preview);
assert.equal(JSON.stringify(buildPersonalColorPaletteCandidate(contaminated)).includes("secret-image-data"), false);
assert.equal(JSON.stringify(buildPersonalColorPaletteCandidate(contaminated)).includes("spring"), false);

console.log("FACE_LAB_PERSONAL_COLOR_PALETTE_CONTRACT=PASS");
