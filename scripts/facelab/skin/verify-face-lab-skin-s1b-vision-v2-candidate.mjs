import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FACE_LAB_OBSERVATION_DEFINITIONS,
  createFaceLabObservationPromptContract
} from "../../../lib/face-lab-observation-contract.js";
import { createVisionObservationPrompt } from "../../../lib/vision-observation-contract.js";
import { normalizeVisionObservationBundle } from "../../../lib/vision-observation-normalizer.js";
import {
  SKIN_VISIBLE_AXES,
  assessSkinAxisEvidence
} from "./skin-axis-evidence-contract-core.mjs";
import {
  createSkinVisionV2CandidatePrompt,
  evaluateSkinVisionV2Candidate,
  measureSkinVisionV2CandidateFootprint
} from "./skin-vision-v2-candidate-core.mjs";

function faceFixture() {
  const observations = {};
  for (const [group, fields] of Object.entries(FACE_LAB_OBSERVATION_DEFINITIONS)) {
    observations[group] = {};
    for (const [field, values] of Object.entries(fields)) {
      observations[group][field] = {
        value: group === "featureLayout" && field === "focalFeatures"
          ? [values[0]] : values[0],
        visibility: "clear",
        evidence: ["synthetic:" + group + "." + field],
        unavailableReason: null
      };
    }
  }
  return {
    quality: {
      faceVisibility: "clear", faceScale: "adequate",
      pose: { yaw: "frontal", pitch: "level", roll: "level" },
      occlusion: {
        forehead: "none", brows: "none", eyes: "none",
        cheeks: "none", jawline: "none"
      },
      sharpness: "clear", exposure: "balanced", lightingUniformity: "even",
      whiteBalance: "stable", filterOrEditing: "none_detected",
      makeupCoverage: "none_or_light",
      structureSuitability: "suitable", colorSuitability: "suitable",
      evidence: ["synthetic:quality"]
    },
    observations
  };
}
const eligibility = {
  status: "eligible", source: "vision", imageType: "photorealistic_human",
  humanFaceCount: 1, faceLabEligible: true, skinAnalysisEligible: true,
  faceLabFailureReason: null, skinFailureReason: null, confidence: 0.91,
  evidence: ["synthetic:one visible face"]
};
const CUE = {
  oiliness: "surface_shine", dehydration: "dry_texture", acne: "active_spots",
  uneven_tone: "tone_variation", pores: "pore_visibility",
  redness: "red_appearance", barrier: "surface_stress"
};
const rows = SKIN_VISIBLE_AXES.map(axis => ({
  axis, state: "not_seen", value: 0, confidence: "medium",
  cue: CUE[axis], area: "cheeks", reason: "none"
}));
const clone = x => structuredClone(x);
const envelope = (skin, override = {}) => ({
  schemaVersion: "vision-observation-v2",
  eligibility: clone(eligibility), skin, face: faceFixture(), ...override
});
const skin = { axisEvidence: clone(rows) };
const original = envelope(skin);
const a = evaluateSkinVisionV2Candidate(original);
assert.equal(a.evaluationOnly, true);
assert.equal(a.classification, "candidate_parsed");
assert.equal(a.skinEvidence.status, "ready");
assert.equal(a.skinEvidence.axes.pores.value, 0);
assert.equal(a.skinEvidence.axes.pores.state, "not_seen");
assert.equal(a.face.status, "available");
assert.equal(a.face.analysis.quality.status, "available");
assert.equal(a.authority.recommendationScoringActivated, false);
assert.equal(a.authority.liveProviderEnabled, false);
assert.equal(a.privacy.rawProviderResponsePersisted, false);

// Compare the exact existing Face normalizer, without using its Skin decision.
const oldEquivalent = normalizeVisionObservationBundle({
  schemaVersion: "vision-observation-v1",
  eligibility: clone(eligibility),
  face: faceFixture(),
  skin: { signals: {}, observations: [] }
});
assert.equal(oldEquivalent.face.status, "available");
assert.deepEqual(a.face, oldEquivalent.face, "Face normalization must remain byte-semantically identical");

// Each wrong or missing Skin field must HOLD without changing Face.
for (const testSkin of [
  { axisEvidence: rows.filter(x => x.axis !== "pores") },
  { axisEvidence: [...rows, clone(rows[0])] },
  { axisEvidence: rows.map(x => x.axis === "redness" ? { ...x, cue: "active_spots" } : x) },
  { axisEvidence: rows.map(x => x.axis === "redness" ? { ...x, value: null } : x) },
  { axisEvidence: rows.map(x => x.axis === "redness" ? { ...x, confidence: "low" } : x) },
  { axisEvidence: "bad" },
  { signals: { redness: 4 } },
  null
]) {
  const result = evaluateSkinVisionV2Candidate(envelope(testSkin));
  assert.notEqual(result.classification, "candidate_parsed");
  assert.deepEqual(result.face, a.face);
  assert.equal(result.authority.recommendationScoringActivated, false);
}
const topExtra = evaluateSkinVisionV2Candidate(envelope(skin, { fingerprint: "PRIVATE_SYNTHETIC" }));
assert.equal(topExtra.classification, "skin_partial_or_invalid");
assert(!JSON.stringify(topExtra).includes("PRIVATE_SYNTHETIC"));
assert.deepEqual(topExtra.face, a.face);

// Valid Face can persist even if only Skin is ineligible in the shared photo.
const skinIneligible = clone(eligibility);
skinIneligible.skinAnalysisEligible = false;
skinIneligible.skinFailureReason = "image_quality_insufficient";
const faceOnly = evaluateSkinVisionV2Candidate(envelope(skin, { eligibility: skinIneligible }));
assert.equal(faceOnly.eligibility.faceLabEligible, true);
assert.equal(faceOnly.skinEvidence.photoGate, "blocked");
assert.equal(faceOnly.skinEvidence.axes.oiliness.value, null);
assert.equal(faceOnly.face.status, "available");

// Valid Skin metadata can survive when Face structure is unobservable.
const faceIneligible = clone(eligibility);
faceIneligible.faceLabEligible = false;
faceIneligible.faceLabFailureReason = "image_quality_insufficient";
const skinOnly = evaluateSkinVisionV2Candidate(envelope(skin, { eligibility: faceIneligible }));
assert.equal(skinOnly.skinEvidence.status, "ready");
assert.equal(skinOnly.face.status, "unavailable");

// Only v2 can claim explicitly observed zero. Legacy v1 must preserve uncertainty.
const legacy = evaluateSkinVisionV2Candidate({
  schemaVersion: "vision-observation-v1",
  eligibility: clone(eligibility),
  face: faceFixture(),
  skin: { signals: { pores: 0, redness: 5 }, observations: [] }
});
assert.equal(legacy.classification, "legacy_v1_unverifiable");
assert.equal(legacy.skinEvidence.axes.pores.state, "unknown");
assert.equal(legacy.skinEvidence.axes.pores.value, null);
assert.equal(legacy.skinEvidence.axes.redness.value, null);
assert.deepEqual(legacy.face, a.face);
assert.equal(legacy.authority.legacyPhotoZerosRecovered, false);

// Unknown/truncated envelope is explicitly unavailable, not a valid Face or Skin.
for (const invalid of [null, "bad", {}, { schemaVersion: "vision-observation-v3" }]) {
  const invalidResult = evaluateSkinVisionV2Candidate(invalid);
  assert.equal(invalidResult.classification, "unknown_version_or_invalid_input");
  assert.equal(invalidResult.skinEvidence.photoGate, "blocked");
  assert.notEqual(invalidResult.face.status, "available");
}
assert.equal(assessSkinAxisEvidence(null, { photoStatus: "available", skinAnalysisEligible: true }).status, "unsupported_schema");

// Verify prompt uses exactly the production Face contract and a single Skin list,
// with NO second provider call, v1 prompt mutation or unsupported UV photo axis.
const v1PromptBefore = createVisionObservationPrompt();
const candidatePrompt = createSkinVisionV2CandidatePrompt();
const v1PromptAfter = createVisionObservationPrompt();
const faceJson = JSON.stringify(createFaceLabObservationPromptContract(), null, 2);
assert.equal(v1PromptBefore, v1PromptAfter);
assert(candidatePrompt.includes('"schemaVersion": "vision-observation-v2"'));
assert(candidatePrompt.includes('"face": ' + faceJson));
assert(v1PromptBefore.includes('"face": ' + faceJson));
assert.equal(candidatePrompt.split('"axisEvidence"').length - 1, 1);
assert(!candidatePrompt.includes('"signals"'));
assert(candidatePrompt.includes("Face and Skin are independent"));
assert(candidatePrompt.includes("If eligibility.skinAnalysisEligible is true, provide exactly seven Skin axes"));
assert(candidatePrompt.includes("If eligibility.skinAnalysisEligible is false, set skin.axisEvidence to []"));
assert(candidatePrompt.includes("overrides the seven-row instruction ONLY when Skin analysis is ineligible"));
for (const axis of SKIN_VISIBLE_AXES) {
  assert(candidatePrompt.includes('"axis": "' + axis + '"'));
}
const footprint = measureSkinVisionV2CandidateFootprint();
assert(footprint.candidatePromptCharacters > 0);
assert(footprint.existingPromptCharacters > 0);
assert(footprint.minimalSyntheticV2SkinCharacters > footprint.minimalSyntheticV1SkinCharacters);
assert.equal(footprint.currentProviderMaxCompletionTokens, 2200);
assert.equal(footprint.actualProviderTokensMeasured, false);
assert.equal(footprint.safeToEnableProvider, false);

// Explicit separation from production Provider, scoring and API consumers.
for (const path of [
  "lib/server/vision-observation-service.js",
  "app/api/analyze/route.js",
  "app/api/face-reading/route.js",
  "lib/vision-observation-contract.js",
  "lib/vision-observation-normalizer.js",
  "lib/skin-match-decision-engine-core.js"
]) {
  const src = readFileSync(path, "utf8");
  assert(!src.includes("skin-vision-v2-candidate-core.mjs"), path + " must remain unmodified");
}
console.log(JSON.stringify({
  test: "skin-vision-v2-candidate-preflight",
  result: "PASS",
  classification: "SYNTHETIC_OFFLINE_ONLY",
  axes: SKIN_VISIBLE_AXES.length,
  faceV1Parity: true,
  absentZeroSeparated: true,
  liveProviderCalls: 0,
  productionScoreChanges: 0,
  ...footprint
}, null, 2));
