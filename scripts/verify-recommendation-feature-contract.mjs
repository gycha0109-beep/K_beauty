import assert from "node:assert/strict";
import {
  FACE_CONDITIONAL_FIELD_DEFINITIONS,
  FACE_CORE_FIELD_DEFINITIONS,
  IMAGE_TYPE_VALUES,
  OBSERVATION_STATUSES,
  QUALITY_ENUMS,
  RECOMMENDATION_FEATURE_SCHEMA_VERSION,
  SKIN_AREA_VALUES,
  createAvailableObservation,
  createUnavailableObservation,
  createUnsupportedObservation,
  validateObservationField,
  validateRecommendationFeatureBundle,
  validateVisibleSkinCueValue
} from "../lib/recommendation-feature-contract.js";
import { FACE_LAB_OBSERVATION_DEFINITIONS } from "../lib/face-lab-observation-contract.js";
import { VISION_SKIN_AREAS } from "../lib/vision-observation-contract.js";

function expectFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.errors.includes(code), true, `${code} was not reported: ${result.errors.join(", ")}`);
}

assert.deepEqual(OBSERVATION_STATUSES, [
  "available",
  "insufficient_evidence",
  "unavailable",
  "unsupported"
]);
assert.deepEqual(IMAGE_TYPE_VALUES, [
  "photorealistic_human",
  "non_photorealistic_human",
  "product",
  "animal",
  "document",
  "landscape",
  "other",
  "unknown"
]);
assert.deepEqual(SKIN_AREA_VALUES, VISION_SKIN_AREAS);
assert.deepEqual(FACE_CORE_FIELD_DEFINITIONS.observedFaceShape.values, FACE_LAB_OBSERVATION_DEFINITIONS.outline.faceShape);
assert.deepEqual(FACE_CONDITIONAL_FIELD_DEFINITIONS.observedCheekboneProminence.values, FACE_LAB_OBSERVATION_DEFINITIONS.outline.cheekboneProminence);
assert.deepEqual(QUALITY_ENUMS.yaw, ["frontal", "slight_left", "slight_right", "profile_left", "profile_right", "unknown"]);

const validAvailable = createAvailableObservation("clear", {
  confidence: 0.9,
  evidence: ["visible face boundary"]
});
assert.equal(validateObservationField(validAvailable, { allowedValues: ["clear"] }).ok, true);

expectFailure(validateObservationField({
  ...validAvailable,
  value: null
}), "available_value_missing");
expectFailure(validateObservationField({
  ...validAvailable,
  confidence: { level: null, score: null }
}), "available_confidence_missing");
expectFailure(validateObservationField({
  ...validAvailable,
  evidence: []
}), "available_evidence_missing");
expectFailure(validateObservationField({
  ...createUnavailableObservation("quality_insufficient"),
  value: "clear"
}), "unavailable_value_present");
expectFailure(validateObservationField({
  ...createUnsupportedObservation(),
  evidence: ["should not exist"]
}), "unsupported_evidence_present");

assert.equal(validateVisibleSkinCueValue({
  level: "none",
  observedAreas: ["cheeks", "chin"],
  affectedAreas: []
}).ok, true);
expectFailure(validateVisibleSkinCueValue({
  level: "none",
  observedAreas: ["cheeks", "chin"],
  affectedAreas: ["cheeks"]
}), "none_with_affected_areas");
expectFailure(validateVisibleSkinCueValue({
  level: "mild",
  observedAreas: ["cheeks"],
  affectedAreas: ["chin"]
}), "affected_area_not_observed");
expectFailure(validateVisibleSkinCueValue({
  level: "moderate",
  observedAreas: ["cheeks"],
  affectedAreas: []
}), "non_none_without_affected_area");

const face = Object.fromEntries([
  ...Object.entries(FACE_CORE_FIELD_DEFINITIONS),
  ...Object.entries(FACE_CONDITIONAL_FIELD_DEFINITIONS)
].map(([name, definition]) => [name, createAvailableObservation(definition.values[0], {
  confidence: 0.9,
  evidence: [`face:${name}`]
})]));
const skin = Object.fromEntries([
  "visibleSurfaceShine",
  "visibleDryTexture",
  "visibleRedness",
  "visibleToneVariation",
  "visibleFlaking",
  "visibleLocalizedSpots",
  "visiblePores"
].map((name) => [name, createAvailableObservation({
  level: "none",
  observedAreas: ["full_face"],
  affectedAreas: []
}, {
  confidence: "medium",
  evidence: [`skin:${name}`]
})]));

const validBundle = {
  schemaVersion: RECOMMENDATION_FEATURE_SCHEMA_VERSION,
  mode: "shadow",
  productionAuthoritative: false,
  atomic: { face, skin },
  privacy: {
    sourceImagePersisted: false,
    faceCropPersisted: false,
    rawProviderResponsePersisted: false
  }
};
assert.deepEqual(validateRecommendationFeatureBundle(validBundle), { ok: true, errors: [] });

const unavailableIsNotZero = createUnavailableObservation("quality_insufficient");
assert.equal(unavailableIsNotZero.value, null);
assert.equal(unavailableIsNotZero.status, "unavailable");
const unsupportedUv = createUnsupportedObservation("unsupported_from_single_photo");
assert.equal(unsupportedUv.value, null);
assert.equal(unsupportedUv.status, "unsupported");

console.log(JSON.stringify({
  ok: true,
  schemaVersion: RECOMMENDATION_FEATURE_SCHEMA_VERSION,
  checks: 22,
  exactEnumGroups: 17,
  observationStatuses: OBSERVATION_STATUSES,
  privacy: {
    sourceImagePersisted: false,
    faceCropPersisted: false,
    rawProviderResponsePersisted: false
  }
}, null, 2));
