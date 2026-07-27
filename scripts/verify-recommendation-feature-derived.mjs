import assert from "node:assert/strict";
import { buildDerivedRecommendationFeatures } from "../lib/recommendation-feature-derived.js";
import {
  createAvailableObservation,
  createUnavailableObservation
} from "../lib/recommendation-feature-contract.js";

function cue(level, area, evidence) {
  return createAvailableObservation({
    level,
    observedAreas: [area],
    affectedAreas: level === "none" ? [] : [area]
  }, {
    confidence: "high",
    evidence: [evidence]
  });
}

const canonical = {
  eligibility: {
    faceLabEligible: false,
    skinAnalysisEligible: true
  },
  atomic: {
    quality: {
      sharpness: createUnavailableObservation("not_required_for_this_fixture"),
      lightingUniformity: createUnavailableObservation("not_required_for_this_fixture"),
      filterOrEditing: createUnavailableObservation("not_required_for_this_fixture"),
      makeupCoverage: createUnavailableObservation("not_required_for_this_fixture"),
      exposure: createUnavailableObservation("not_required_for_this_fixture"),
      whiteBalance: createUnavailableObservation("not_required_for_this_fixture"),
      occlusion: { cheeks: createUnavailableObservation("not_required_for_this_fixture") },
      faceVisibility: createUnavailableObservation("not_required_for_this_fixture"),
      faceScale: createUnavailableObservation("not_required_for_this_fixture"),
      pose: {
        yaw: createUnavailableObservation("not_required_for_this_fixture"),
        pitch: createUnavailableObservation("not_required_for_this_fixture"),
        roll: createUnavailableObservation("not_required_for_this_fixture")
      }
    },
    face: {},
    skin: {
      visibleSurfaceShine: cue("none", "t_zone", "shine inspected"),
      visibleDryTexture: cue("none", "cheeks", "dry texture inspected"),
      visibleRedness: cue("none", "cheeks", "redness inspected"),
      visibleToneVariation: cue("none", "full_face", "tone inspected"),
      visibleFlaking: createUnavailableObservation("resolution_insufficient"),
      visibleLocalizedSpots: createUnavailableObservation("resolution_insufficient"),
      visiblePores: createUnavailableObservation("resolution_insufficient")
    }
  },
  compatibilityInputs: { providerSuitability: {} }
};

const derived = buildDerivedRecommendationFeatures(canonical);
assert.equal(derived.skinSupport.visibleShineSupport.status, "available");
assert.equal(derived.skinSupport.visibleShineSupport.value.level, "none");
assert.equal(derived.skinSupport.visibleDryTextureSupport.status, "insufficient_evidence");
assert.equal(derived.skinSupport.visibleDryTextureSupport.value, null);
assert.equal(derived.skinSupport.visibleSurfaceStressSupport.status, "insufficient_evidence");
assert.equal(derived.skinSupport.visibleSurfaceStressSupport.value, null);

const positiveDry = structuredClone(canonical);
positiveDry.atomic.skin.visibleDryTexture = cue("mild", "cheeks", "mild dry texture visible");
const positiveDerived = buildDerivedRecommendationFeatures(positiveDry);
assert.equal(positiveDerived.skinSupport.visibleDryTextureSupport.status, "available");
assert.equal(positiveDerived.skinSupport.visibleDryTextureSupport.value.level, "mild");
assert.equal(positiveDerived.skinSupport.visibleSurfaceStressSupport.status, "available");
assert.equal(positiveDerived.skinSupport.visibleSurfaceStressSupport.value.level, "mild");

console.log(JSON.stringify({
  ok: true,
  checks: 10,
  rule: "combined_none_requires_all_inputs_observed",
  unavailableCollapsedToNone: false
}, null, 2));
