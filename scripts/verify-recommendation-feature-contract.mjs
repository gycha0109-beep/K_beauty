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

const requestedSection = process.argv.find((item) => item.startsWith("--section="))?.split("=")[1] || "all";
const allowedSections = new Set(["all", "enums", "field", "skin", "bundle"]);
assert.equal(allowedSections.has(requestedSection), true, `unknown section: ${requestedSection}`);
const shouldRun = (section) => requestedSection === "all" || requestedSection === section;
let checks = 0;

function expectFailure(result, code) {
  assert.equal(result.ok, false);
  assert.equal(result.errors.includes(code), true, `${code} was not reported: ${result.errors.join(", ")}`);
  checks += 1;
}

if (shouldRun("enums")) {
  assert.deepEqual([...OBSERVATION_STATUSES], [
    "available",
    "insufficient_evidence",
    "unavailable",
    "unsupported"
  ]);
  assert.deepEqual([...IMAGE_TYPE_VALUES], [
    "photorealistic_human",
    "non_photorealistic_human",
    "product",
    "animal",
    "document",
    "landscape",
    "other",
    "unknown"
  ]);
  assert.deepEqual([...SKIN_AREA_VALUES], [...VISION_SKIN_AREAS]);
  assert.deepEqual(
    [...FACE_CORE_FIELD_DEFINITIONS.observedFaceShape.values],
    [...FACE_LAB_OBSERVATION_DEFINITIONS.outline.faceShape]
  );
  assert.deepEqual(
    [...FACE_CONDITIONAL_FIELD_DEFINITIONS.observedCheekboneProminence.values],
    [...FACE_LAB_OBSERVATION_DEFINITIONS.outline.cheekboneProminence]
  );
  assert.deepEqual(
    [...QUALITY_ENUMS.yaw],
    ["frontal", "slight_left", "slight_right", "profile_left", "profile_right", "unknown"]
  );
  checks += 6;
}

if (shouldRun("field")) {
  const validAvailable = createAvailableObservation("clear", {
    confidence: 0.9,
    evidence: ["visible face boundary"]
  });
  assert.equal(validateObservationField(validAvailable, { allowedValues: ["clear"] }).ok, true);
  checks += 1;

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
}

if (shouldRun("skin")) {
  assert.equal(validateVisibleSkinCueValue({
    level: "none",
    observedAreas: ["cheeks", "chin"],
    affectedAreas: []
  }).ok, true);
  checks += 1;
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
}

if (shouldRun("bundle")) {
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
  const bundleValidation = validateRecommendationFeatureBundle(validBundle);
  assert.deepEqual(bundleValidation, { ok: true, errors: [] }, bundleValidation.errors.join(", "));

  const unavailableIsNotZero = createUnavailableObservation("quality_insufficient");
  assert.equal(unavailableIsNotZero.value, null);
  assert.equal(unavailableIsNotZero.status, "unavailable");
  const unsupportedUv = createUnsupportedObservation("unsupported_from_single_photo");
  assert.equal(unsupportedUv.value, null);
  assert.equal(unsupportedUv.status, "unsupported");
  checks += 5;
}

console.log(JSON.stringify({
  ok: true,
  section: requestedSection,
  schemaVersion: RECOMMENDATION_FEATURE_SCHEMA_VERSION,
  checks,
  exactEnumGroups: 17,
  observationStatuses: OBSERVATION_STATUSES,
  privacy: {
    sourceImagePersisted: false,
    faceCropPersisted: false,
    rawProviderResponsePersisted: false
  }
}, null, 2));
