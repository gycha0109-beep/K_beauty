import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadModule(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import .*?;\r?\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
  return Function(...dependencyNames, `${source}\nreturn { ${names.join(", ")} };`)(
    ...dependencyNames.map((name) => dependencies[name])
  );
}

const observation = loadModule(
  "lib/face-lab-observation-contract.js",
  [
    "FACE_LAB_OBSERVATION_SCHEMA_VERSION",
    "buildFaceLabObservationAnalysis",
    "createFaceLabObservationPromptContract",
    "createFaceLabObservationPromptRules"
  ]
);
const bundle = loadModule(
  "lib/face-lab-analysis-bundle.js",
  ["isFaceLabObservationAnalysis", "getFaceLabObservationAnalysis", "createCanonicalFaceLabBundle", "sanitizeCanonicalFaceLabBundle"],
  { FACE_LAB_OBSERVATION_SCHEMA_VERSION: observation.FACE_LAB_OBSERVATION_SCHEMA_VERSION }
);

const quality = {
  faceVisibility: "clear",
  faceScale: "adequate",
  pose: { yaw: "frontal", pitch: "level", roll: "level" },
  occlusion: { forehead: "none", brows: "none", eyes: "none", cheeks: "none", jawline: "none" },
  sharpness: "clear",
  exposure: "balanced",
  lightingUniformity: "even",
  whiteBalance: "stable",
  filterOrEditing: "none_detected",
  makeupCoverage: "none_or_light",
  structureSuitability: "suitable",
  colorSuitability: "limited",
  evidence: ["one frontal face is clearly visible"]
};

const defs = {
  outline: {
    faceShape: "oval",
    foreheadWidthVsCheek: "similar",
    jawWidthVsCheek: "narrower",
    jawlineAngularity: "moderate",
    jawTaper: "tapered",
    cheekboneProminence: "moderate"
  },
  vertical: {
    faceLengthBalance: "balanced",
    foreheadHeight: "balanced",
    midfaceLength: "balanced",
    lowerFaceLength: "balanced"
  },
  eyes: {
    eyeDirection: "level",
    eyeLength: "medium",
    eyeOpenness: "medium"
  },
  featureLayout: {
    featureScale: "medium",
    featureConcentration: "balanced",
    focalFeatures: ["eyes", "jawline"]
  },
  visualLanguage: {
    straightCurveBalance: "balanced",
    contourDefinition: "moderate",
    featureContrast: "medium"
  },
  colorAppearance: {
    apparentTemperature: "neutral",
    apparentBrightness: "medium",
    apparentSaturation: "balanced"
  }
};

function rawField(value) {
  return { value, visibility: "clear", evidence: ["visible structure supports this field"], unavailableReason: null };
}

const rawObservations = Object.fromEntries(Object.entries(defs).map(([group, fields]) => [
  group,
  Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, rawField(value)]))
]));

const eligibility = { source: "vision", faceLabEligible: true };
const analysis = observation.buildFaceLabObservationAnalysis(
  { quality, observations: rawObservations },
  { eligibility, model: "gpt-4o-mini" }
);

assert.equal(analysis.status, "available");
assert.equal(analysis.schemaVersion, "face-lab-observation-v1");
assert.equal(analysis.privacy.sourceImagePersisted, false);
assert.equal(analysis.observations.outline.faceShape.value, "oval");
assert.equal(analysis.observations.outline.faceShape.confidence, 0.9);
assert.equal(analysis.observations.colorAppearance.apparentTemperature.confidence, 0.72);
assert.ok(bundle.isFaceLabObservationAnalysis(analysis));

const canonical = bundle.createCanonicalFaceLabBundle({ analysis, analyzedAt: "2026-07-16T00:00:00.000Z" });
assert.equal(canonical.schemaVersion, "face-lab-canonical-v1");
assert.equal(canonical.privacy.sourceImagePersisted, false);
assert.ok(bundle.sanitizeCanonicalFaceLabBundle(canonical));
assert.equal(bundle.getFaceLabObservationAnalysis({ analysis }), analysis);

const invalidEnumRaw = structuredClone(rawObservations);
invalidEnumRaw.outline.faceShape.value = "beautiful";
const invalidEnumAnalysis = observation.buildFaceLabObservationAnalysis(
  { quality, observations: invalidEnumRaw },
  { eligibility }
);
assert.equal(invalidEnumAnalysis.observations.outline.faceShape.status, "insufficient_evidence");
assert.equal(invalidEnumAnalysis.observations.outline.faceShape.value, null);
assert.notEqual(invalidEnumAnalysis.status, "unavailable");

const missingEvidenceRaw = structuredClone(rawObservations);
missingEvidenceRaw.eyes.eyeDirection.evidence = [];
const missingEvidenceAnalysis = observation.buildFaceLabObservationAnalysis(
  { quality, observations: missingEvidenceRaw },
  { eligibility }
);
assert.equal(missingEvidenceAnalysis.observations.eyes.eyeDirection.unavailableReason, "evidence_missing");

const colorBlockedQuality = { ...quality, colorSuitability: "unsuitable" };
const colorBlocked = observation.buildFaceLabObservationAnalysis(
  { quality: colorBlockedQuality, observations: rawObservations },
  { eligibility }
);
assert.equal(colorBlocked.status, "available");
assert.equal(colorBlocked.observations.colorAppearance.apparentTemperature.status, "unavailable");
assert.equal(colorBlocked.observations.outline.faceShape.status, "available");

const ineligible = observation.buildFaceLabObservationAnalysis(
  { quality, observations: rawObservations },
  { eligibility: { source: "vision", faceLabEligible: false } }
);
assert.equal(ineligible.status, "unavailable");
assert.equal(ineligible.failureReason, "eligibility_failed");

const imageContaminated = structuredClone(canonical);
imageContaminated.imagePreviewDataUrl = "data:image/jpeg;base64,ZmFrZQ==";
assert.equal(bundle.sanitizeCanonicalFaceLabBundle(imageContaminated), null);

const promptContract = JSON.stringify(observation.createFaceLabObservationPromptContract());
const promptRules = observation.createFaceLabObservationPromptRules();
assert.equal(promptContract.includes("presentation_hint"), false);
assert.equal(promptRules.includes("Do not generate archetypes"), true);
assert.equal(promptRules.includes("base64"), true);

const routeSource = readFileSync("app/api/face-reading/route.js", "utf8");
assert.equal(routeSource.includes("buildFaceLabObservationAnalysis"), false, "route shadow integration is intentionally deferred until the contract module is verified");

console.log("Face Lab observation contract and canonical boundary checks passed.");
