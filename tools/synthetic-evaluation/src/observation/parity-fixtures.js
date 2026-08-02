import { deepFreeze } from "../generation/canonicalize-generation-spec.js";
import { OBSERVATION_SEMANTIC_EXPORT, OBSERVATION_VERSIONS } from "./snapshot/canonical-v1.js";

function choose(values, index = 0) {
  return values[index % values.length];
}

function createRawObservations({ available = true } = {}) {
  return Object.fromEntries(Object.entries(OBSERVATION_SEMANTIC_EXPORT.face.definitions).map(([group, fields]) => [
    group,
    Object.fromEntries(Object.entries(fields).map(([name, values], index) => [
      name,
      available
        ? {
            value: group === "featureLayout" && name === "focalFeatures" ? [choose(values)] : choose(values, index),
            visibility: "clear",
            evidence: [`visible ${group} ${name}`],
            unavailableReason: null
          }
        : { value: null, visibility: "uncertain", evidence: [], unavailableReason: "not_visible" }
    ]))
  ]));
}

function quality({ suitable = true } = {}) {
  return {
    faceVisibility: suitable ? "clear" : "poor",
    faceScale: "adequate",
    pose: { yaw: "frontal", pitch: "level", roll: "level" },
    occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
    sharpness: suitable ? "clear" : "blurred",
    exposure: "balanced",
    lightingUniformity: "even",
    whiteBalance: "stable",
    filterOrEditing: "none_detected",
    makeupCoverage: "none_or_light",
    structureSuitability: suitable ? "suitable" : "unsuitable",
    colorSuitability: suitable ? "suitable" : "unsuitable",
    evidence: [suitable ? "one clear frontal synthetic face" : "no usable human face"]
  };
}

const zeroSignals = Object.fromEntries(OBSERVATION_SEMANTIC_EXPORT.skin.signalAxes.map((axis) => [axis, 0]));

export const ELIGIBLE_PARITY_FIXTURE = deepFreeze({
  schemaVersion: OBSERVATION_VERSIONS.visionSchemaVersion,
  eligibility: {
    status: "eligible",
    source: "vision",
    imageType: "photorealistic_human",
    humanFaceCount: 1,
    faceLabEligible: true,
    skinAnalysisEligible: true,
    faceLabFailureReason: null,
    skinFailureReason: null,
    confidence: 0.96,
    evidence: ["one clear frontal synthetic human face"]
  },
  skin: {
    signals: { ...zeroSignals, redness: 2, pores: 1 },
    observations: [
      { key: "redness", area: "cheeks", cue: "red_appearance", level: "mild", confidence: "high" }
    ]
  },
  face: {
    quality: quality({ suitable: true }),
    observations: createRawObservations({ available: true })
  }
});

export const INELIGIBLE_PARITY_FIXTURE = deepFreeze({
  schemaVersion: OBSERVATION_VERSIONS.visionSchemaVersion,
  eligibility: {
    status: "ineligible",
    source: "vision",
    imageType: "product",
    humanFaceCount: 0,
    faceLabEligible: false,
    skinAnalysisEligible: false,
    faceLabFailureReason: "face_not_detected",
    skinFailureReason: "face_not_detected",
    confidence: 0.99,
    evidence: ["no human face is visible"]
  },
  skin: { signals: zeroSignals, observations: [] },
  face: {
    quality: quality({ suitable: false }),
    observations: createRawObservations({ available: false })
  }
});

export const INVALID_PARITY_FIXTURE = deepFreeze({
  ...ELIGIBLE_PARITY_FIXTURE,
  unexpectedIntent: "redness_only"
});
