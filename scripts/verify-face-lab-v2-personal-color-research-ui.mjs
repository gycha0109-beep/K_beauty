import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  buildFaceLabObservationAnalysis
} from "../lib/face-lab-observation-contract.js";
import {
  buildPersonalColorObservation
} from "../lib/face-lab-v2/personal-color/observation.js";
import {
  buildPersonalColorPaletteCandidate
} from "../lib/face-lab-v2/personal-color/palette-candidate.js";

function sample(qualityOverrides = {}) {
  const observations = Object.fromEntries(
    Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS).map(([group, fields]) => [
      group,
      Object.fromEntries(
        Object.entries(fields).map(([key, allowed]) => [
          key,
          { value: group === "featureLayout" && key === "focalFeatures"
            ? [allowed[0]] : allowed[0],
            visibility: "clear",
            evidence: [`fixture:${group}.${key}`],
            unavailableReason: null }
        ])
      )
    ])
  );

  return buildFaceLabObservationAnalysis({
    quality: {
      faceVisibility: "clear",
      faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: {
        forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none"
      },
      sharpness: "clear",
      exposure: "balanced",
      lightingUniformity: "even",
      whiteBalance: "stable",
      filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable",
      colorSuitability: "suitable",
      evidence: ["fixture:quality"],
      ...qualityOverrides
    },
    observations
  }, { eligibility: { faceLabEligible: true }, provider: "fixture" });
}

const photo = sample();
const before = JSON.stringify(photo);
const candidate = buildPersonalColorPaletteCandidate(buildPersonalColorObservation(photo));
assert.equal(candidate.status, "exploratory");
assert.equal(candidate.paletteCandidate.familyTokens.length, 3);
assert.equal(candidate.paletteCandidate.authority, "photo_appearance_reference_only");
assert.equal(candidate.executionPreview.authority, "not_product_or_shade_advice");
assert.deepEqual(candidate.productOrShadeMatches, []);
assert.equal(candidate.seasonCandidate, null);
assert.equal(candidate.undertone, null);
assert.equal(candidate.suitability, null);
assert.equal(JSON.stringify(photo), before);

for (const flags of [
  { whiteBalance: "warm_cast" },
  { filterOrEditing: "heavy" },
  { makeupCoverage: "heavy" },
  { lightingUniformity: "uneven" },
  { colorSuitability: "unsuitable" }
]) {
  const held = buildPersonalColorPaletteCandidate(buildPersonalColorObservation(sample(flags)));
  assert.equal(held.status, "insufficient_evidence", JSON.stringify(flags));
  assert.equal(held.paletteCandidate, null);
  assert.equal(held.executionPreview, null);
  assert.deepEqual(held.productOrShadeMatches, []);
}

const page = readFileSync("app/face-lab-test/FaceLabTestClient.jsx", "utf8");
const ui = readFileSync("components/face-lab-test/FaceLabPersonalColorResearchPreview.jsx", "utf8");
assert.ok(page.includes('process.env.NODE_ENV === "development" ? ('));
assert.ok(page.includes("<FaceLabPersonalColorResearchPreview"));
assert.ok(ui.includes('data-testid="face-lab-personal-color-research"'));
assert.ok(ui.includes('data-palette-status={available ? "exploratory" : "insufficient_evidence"}'));
assert.ok(ui.includes('palette.sourceImagePersisted === false'));
assert.ok(ui.includes('palette.seasonCandidate === null'));
assert.ok(ui.includes('palette.undertone === null'));
assert.ok(ui.includes('palette.suitability === null'));
assert.ok(!ui.includes("executionPreview.lipColorFamily"));
assert.ok(!ui.includes("executionPreview.blushColorFamily"));
assert.ok(!ui.includes("executionPreview.hairColorFamily"));
assert.ok(!ui.includes("src={"));
assert.ok(!ui.includes("localStorage"));
assert.ok(!ui.includes("fetch("));

console.log("FACE_LAB_PERSONAL_COLOR_RESEARCH_UI=PASS");
