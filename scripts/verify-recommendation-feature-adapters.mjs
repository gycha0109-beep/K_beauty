import assert from "node:assert/strict";
import { buildDerivedRecommendationFeatures } from "../lib/recommendation-feature-derived.js";
import {
  buildFaceArchetypeCompatibilityAnalysis,
  buildSkinLegacyShadowAdapter
} from "../lib/recommendation-feature-adapters.js";
import { buildRecommendationFeatureShadow } from "../lib/recommendation-feature-shadow.js";
import {
  createAvailableObservation,
  createUnavailableObservation
} from "../lib/recommendation-feature-contract.js";
import { normalizeRecommendationFeatureBundle } from "../lib/recommendation-feature-normalizer.js";
import { evaluateFaceLabArchetypeShadow } from "../lib/face-lab-archetype-decision.js";

function field(value, evidence, confidence = 0.9) {
  return {
    status: "available",
    source: "vision",
    confidence,
    evidence: [evidence],
    unavailableReason: null,
    value
  };
}

const directSignals = Object.freeze({
  barrier: 2,
  dehydration: 3,
  oiliness: 4,
  redness: 1,
  acne: 2,
  pores: 3,
  uneven_tone: 1,
  uv: 0
});

const faceQuality = {
  status: "available",
  source: "vision",
  confidence: 0.9,
  evidence: ["face quality evidence"],
  unavailableReason: null,
  value: {
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
    exposure: "balanced",
    lightingUniformity: "even",
    whiteBalance: "stable",
    filterOrEditing: "none_detected",
    makeupCoverage: "none_or_light",
    structureSuitability: "limited",
    colorSuitability: "limited"
  }
};

const faceAnalysis = {
  schemaVersion: "face-lab-observation-v1",
  status: "available",
  failureReason: null,
  quality: faceQuality,
  observations: {
    outline: {
      faceShape: field("oval", "oval outline"),
      jawlineAngularity: field("angular", "defined jawline"),
      jawTaper: field("tapered", "jaw narrows"),
      cheekboneProminence: field("prominent", "cheekbones visible")
    },
    vertical: {
      faceLengthBalance: field("long", "long face balance")
    },
    eyes: {
      eyeDirection: field("upturned", "outer corners elevated"),
      eyeLength: field("long", "horizontal eye length"),
      eyeOpenness: field("wide", "eye opening visible")
    },
    featureLayout: {
      featureScale: field("large", "features appear large"),
      featureConcentration: field("centered", "features centered")
    },
    visualLanguage: {
      straightCurveBalance: field("straight", "straight visual lines"),
      contourDefinition: field("defined", "defined contour"),
      featureContrast: field("high", "high visible contrast")
    }
  },
  coverage: {
    availableGroups: ["outline", "vertical", "eyes", "featureLayout", "visualLanguage"],
    partialGroups: [],
    unavailableGroups: [],
    availableFieldCount: 13,
    totalCoreFieldCount: 13
  },
  warnings: [],
  privacy: { sourceImagePersisted: false }
};

const visionBundle = {
  schemaVersion: "vision-observation-v1",
  status: "available",
  eligibility: {
    status: "eligible",
    source: "vision",
    imageType: "photorealistic_human",
    humanFaceCount: 1,
    faceLabEligible: true,
    skinAnalysisEligible: true,
    faceLabFailureReason: null,
    skinFailureReason: null,
    confidence: 0.95,
    evidence: ["one human face"]
  },
  skin: {
    status: "available",
    signals: { ...directSignals },
    observations: [
      { key: "oiliness", area: "t_zone", cue: "surface_shine", level: "moderate", confidence: "high" },
      { key: "dehydration", area: "cheeks", cue: "dry_texture", level: "mild", confidence: "medium" },
      { key: "barrier", area: "cheeks", cue: "visible_flaking", level: "low", confidence: "medium" },
      { key: "redness", area: "cheeks", cue: "red_appearance", level: "mild", confidence: "medium" },
      { key: "acne", area: "chin", cue: "active_spots", level: "moderate", confidence: "medium" },
      { key: "pores", area: "nose", cue: "pore_visibility", level: "moderate", confidence: "high" },
      { key: "uneven_tone", area: "full_face", cue: "tone_variation", level: "low", confidence: "medium" }
    ]
  },
  face: {
    status: "available",
    analysis: faceAnalysis
  },
  privacy: {
    sourceImagePersisted: false,
    rawProviderResponsePersisted: false
  }
};

const canonical = normalizeRecommendationFeatureBundle(visionBundle);
const derived = buildDerivedRecommendationFeatures(canonical);
assert.equal(derived.suitability.faceStructureSuitability.value, "suitable");
assert.equal(derived.suitabilityComparison.providerStructureSuitability, "limited");
assert.equal(derived.suitabilityComparison.structureAgreement, false);
assert.equal(derived.suitabilityComparison.productionAffecting, false);

const adaptedAnalysis = buildFaceArchetypeCompatibilityAnalysis(canonical, derived);
assert.equal(adaptedAnalysis.observations.eyes.eyeLength.status, "available");
assert.equal(adaptedAnalysis.observations.eyes.eyeLength.value, "long");
assert.equal(adaptedAnalysis.observations.eyes.eyeLength.confidence, 0.9);
assert.deepEqual(adaptedAnalysis.observations.eyes.eyeLength.evidence, ["horizontal eye length"]);
assert.equal(adaptedAnalysis.status, "available");

const adaptedDecision = evaluateFaceLabArchetypeShadow(adaptedAnalysis);
assert.equal(adaptedDecision.status, "held");
assert.equal(adaptedDecision.productionEligible, false);
assert.equal(adaptedDecision.decision, null);
assert.equal(adaptedDecision.holdReasons.includes("calibration_not_ready"), true);
assert.equal(adaptedDecision.holdReasons.includes("taxonomy_not_ready"), true);

const confidenceMissing = structuredClone(canonical);
confidenceMissing.atomic.face.observedEyeLength.confidence = { level: "high", score: null };
const missingConfidenceAnalysis = buildFaceArchetypeCompatibilityAnalysis(
  confidenceMissing,
  buildDerivedRecommendationFeatures(confidenceMissing)
);
assert.equal(missingConfidenceAnalysis.observations.eyes.eyeLength.status, "insufficient_evidence");

const cheekboneUnavailable = structuredClone(canonical);
cheekboneUnavailable.atomic.face.observedCheekboneProminence = createUnavailableObservation("lighting_interference");
const conditionalAnalysis = buildFaceArchetypeCompatibilityAnalysis(
  cheekboneUnavailable,
  buildDerivedRecommendationFeatures(cheekboneUnavailable)
);
assert.equal(conditionalAnalysis.observations.outline.cheekboneProminence.status, "unavailable");
assert.equal(evaluateFaceLabArchetypeShadow(conditionalAnalysis).productionEligible, false);

const skinShadow = buildSkinLegacyShadowAdapter(canonical, derived);
assert.equal(skinShadow.productionAuthoritative, false);
assert.equal(skinShadow.observationAvailability.oiliness, true);
assert.equal(skinShadow.quantizationResolved.oiliness, false);
assert.equal(skinShadow.legacySignalAvailability.oiliness, false);
assert.equal(skinShadow.availability.oiliness, false);
assert.equal(skinShadow.metadata.availabilityMeaning, "legacy_numeric_signal_available");
assert.equal(skinShadow.signals.oiliness, 0);
assert.equal(skinShadow.metadata.quantizationStatus.oiliness, "unresolved_non_zero");
assert.equal(skinShadow.metadata.unresolvedReason.oiliness, "unresolved_non_zero");
assert.equal(skinShadow.comparison.oiliness.shadowObservationAvailable, true);
assert.equal(skinShadow.comparison.oiliness.shadowQuantizationResolved, false);
assert.equal(skinShadow.comparison.oiliness.shadowLegacySignalAvailable, false);
assert.equal(skinShadow.comparison.oiliness.comparable, false);
assert.equal(skinShadow.observationAvailability.uv, false);
assert.equal(skinShadow.quantizationResolved.uv, false);
assert.equal(skinShadow.legacySignalAvailability.uv, false);
assert.equal(skinShadow.availability.uv, false);
assert.equal(skinShadow.metadata.sourceStatus.uv, "unsupported");
assert.equal(skinShadow.comparison.oiliness.directLegacySignal, 4);
assert.deepEqual(visionBundle.skin.signals, directSignals);

const observedNone = structuredClone(canonical);
observedNone.atomic.skin.visibleSurfaceShine = createAvailableObservation({
  level: "none",
  observedAreas: ["t_zone"],
  affectedAreas: []
}, {
  confidence: "high",
  evidence: ["vision_skin:surface_shine:oiliness:t_zone:none"]
});
const noneDerived = buildDerivedRecommendationFeatures(observedNone);
const noneAdapter = buildSkinLegacyShadowAdapter(observedNone, noneDerived);
assert.equal(noneAdapter.signals.oiliness, 0);
assert.equal(noneAdapter.observationAvailability.oiliness, true);
assert.equal(noneAdapter.quantizationResolved.oiliness, true);
assert.equal(noneAdapter.legacySignalAvailability.oiliness, true);
assert.equal(noneAdapter.availability.oiliness, true);
assert.equal(noneAdapter.metadata.quantizationStatus.oiliness, "resolved_absence");
assert.equal(noneAdapter.metadata.unresolvedReason.oiliness, null);
assert.equal(noneAdapter.comparison.oiliness.comparable, true);

const unavailableSkin = structuredClone(observedNone);
unavailableSkin.atomic.skin.visibleSurfaceShine = createUnavailableObservation("quality_insufficient");
const unavailableAdapter = buildSkinLegacyShadowAdapter(
  unavailableSkin,
  buildDerivedRecommendationFeatures(unavailableSkin)
);
assert.equal(unavailableAdapter.signals.oiliness, 0);
assert.equal(unavailableAdapter.observationAvailability.oiliness, false);
assert.equal(unavailableAdapter.quantizationResolved.oiliness, false);
assert.equal(unavailableAdapter.legacySignalAvailability.oiliness, false);
assert.equal(unavailableAdapter.availability.oiliness, false);
assert.notEqual(unavailableAdapter.metadata.quantizationStatus.oiliness, "resolved_absence");
assert.equal(unavailableAdapter.comparison.oiliness.comparable, false);

const shadow = buildRecommendationFeatureShadow(visionBundle);
assert.equal(shadow.valid, true);
assert.equal(shadow.productionAuthoritative, false);
assert.equal(shadow.adapters.face.comparison.productionEligibleUnchanged, true);
assert.equal(shadow.adapters.face.comparison.heldUnchanged, true);
assert.equal(shadow.adapters.face.comparison.decisionRemainsNull, true);
assert.equal(shadow.adapters.skin.observationAvailability.oiliness, true);
assert.equal(shadow.adapters.skin.quantizationResolved.oiliness, false);
assert.equal(shadow.adapters.skin.legacySignalAvailability.oiliness, false);
assert.equal(shadow.privacy.sourceImagePersisted, false);
assert.equal(shadow.privacy.faceCropPersisted, false);
assert.equal(shadow.privacy.rawProviderResponsePersisted, false);

const serialized = JSON.stringify(shadow);
for (const forbidden of ["data:image", "base64,", "image_url", "imageBuffer"]) {
  assert.equal(serialized.includes(forbidden), false, `forbidden shadow content: ${forbidden}`);
}

const checkCount = 67;
console.log(JSON.stringify({
  ok: true,
  checks: checkCount,
  fixtures: 6,
  faceLifecycle: {
    status: adaptedDecision.status,
    productionEligible: adaptedDecision.productionEligible,
    decision: adaptedDecision.decision,
    holdReasons: adaptedDecision.holdReasons
  },
  skinShadow: {
    productionAuthoritative: skinShadow.productionAuthoritative,
    unresolvedAxes: Object.entries(skinShadow.metadata.quantizationStatus)
      .filter(([, status]) => status === "unresolved_non_zero")
      .map(([axis]) => axis),
    observationAvailableAxes: Object.entries(skinShadow.observationAvailability)
      .filter(([, available]) => available)
      .map(([axis]) => axis),
    legacySignalAvailableAxes: Object.entries(skinShadow.legacySignalAvailability)
      .filter(([, available]) => available)
      .map(([axis]) => axis),
    uvObservationAvailable: skinShadow.observationAvailability.uv,
    uvLegacySignalAvailable: skinShadow.legacySignalAvailability.uv
  },
  productionBehaviorChanged: false,
  privacy: shadow.privacy
}, null, 2));
