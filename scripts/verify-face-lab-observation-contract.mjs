import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadModule(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import .*?;\r?\n/gm, "")
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);

  return Function(
    ...dependencyNames,
    `${source}\nreturn { ${names.join(", ")} };`
  )(...dependencyNames.map((name) => dependencies[name]));
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
  [
    "isFaceLabObservationAnalysis",
    "getFaceLabObservationAnalysis",
    "createCanonicalFaceLabBundle",
    "sanitizeCanonicalFaceLabBundle"
  ],
  {
    FACE_LAB_OBSERVATION_SCHEMA_VERSION:
      observation.FACE_LAB_OBSERVATION_SCHEMA_VERSION
  }
);

const quality = {
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
  structureSuitability: "suitable",
  colorSuitability: "limited",
  evidence: ["one frontal face is clearly visible"]
};

const values = {
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
  return {
    value,
    visibility: "clear",
    evidence: ["visible structure supports this field"],
    unavailableReason: null
  };
}

function buildRawObservations() {
  return Object.fromEntries(
    Object.entries(values).map(([group, fields]) => [
      group,
      Object.fromEntries(
        Object.entries(fields).map(([key, value]) => [key, rawField(value)])
      )
    ])
  );
}

const eligibility = { source: "vision", faceLabEligible: true };
const analysis = observation.buildFaceLabObservationAnalysis(
  { quality, observations: buildRawObservations() },
  { eligibility, model: "gpt-4o-mini" }
);

assert.equal(analysis.status, "available");
assert.equal(analysis.failureReason, null);
assert.equal(analysis.schemaVersion, "face-lab-observation-v1");
assert.equal(analysis.privacy.sourceImagePersisted, false);
assert.equal(analysis.observations.outline.faceShape.value, "oval");
assert.equal(analysis.observations.outline.faceShape.confidence, 0.9);
assert.equal(
  analysis.observations.colorAppearance.apparentTemperature.confidence,
  0.72
);
assert.deepEqual(
  analysis.observations.featureLayout.focalFeatures.value,
  ["eyes", "jawline"]
);
assert.ok(bundle.isFaceLabObservationAnalysis(analysis));

const canonical = bundle.createCanonicalFaceLabBundle({
  analysis,
  analyzedAt: "2026-07-16T00:00:00.000Z"
});
assert.equal(canonical.schemaVersion, "face-lab-canonical-v1");
assert.equal(canonical.privacy.sourceImagePersisted, false);
assert.ok(bundle.sanitizeCanonicalFaceLabBundle(canonical));
assert.equal(bundle.getFaceLabObservationAnalysis({ analysis }), analysis);

const invalidEnum = buildRawObservations();
invalidEnum.outline.faceShape.value = "beautiful";
const invalidEnumAnalysis = observation.buildFaceLabObservationAnalysis(
  { quality, observations: invalidEnum },
  { eligibility }
);
assert.equal(
  invalidEnumAnalysis.observations.outline.faceShape.status,
  "insufficient_evidence"
);
assert.equal(invalidEnumAnalysis.observations.outline.faceShape.value, null);
assert.notEqual(invalidEnumAnalysis.status, "unavailable");

const missingEvidence = buildRawObservations();
missingEvidence.eyes.eyeDirection.evidence = [];
const missingEvidenceAnalysis = observation.buildFaceLabObservationAnalysis(
  { quality, observations: missingEvidence },
  { eligibility }
);
assert.equal(
  missingEvidenceAnalysis.observations.eyes.eyeDirection.unavailableReason,
  "evidence_missing"
);

const colorBlocked = observation.buildFaceLabObservationAnalysis(
  {
    quality: { ...quality, colorSuitability: "unsuitable" },
    observations: buildRawObservations()
  },
  { eligibility }
);
assert.equal(colorBlocked.status, "available");
assert.deepEqual(colorBlocked.warnings, ["color_observations_unavailable"]);
assert.equal(
  colorBlocked.observations.colorAppearance.apparentTemperature.status,
  "unavailable"
);
assert.equal(colorBlocked.observations.outline.faceShape.status, "available");
assert.ok(bundle.isFaceLabObservationAnalysis(colorBlocked));

const structureBlocked = observation.buildFaceLabObservationAnalysis(
  {
    quality: { ...quality, structureSuitability: "unsuitable" },
    observations: buildRawObservations()
  },
  { eligibility }
);
assert.equal(structureBlocked.status, "unavailable");
assert.equal(
  structureBlocked.failureReason,
  "structure_quality_insufficient"
);
assert.equal(
  structureBlocked.observations.outline.faceShape.status,
  "unavailable"
);
assert.ok(bundle.isFaceLabObservationAnalysis(structureBlocked));

const contradictoryQuality = observation.buildFaceLabObservationAnalysis(
  {
    quality: {
      ...quality,
      faceVisibility: "poor",
      structureSuitability: "suitable"
    },
    observations: buildRawObservations()
  },
  { eligibility }
);
assert.equal(contradictoryQuality.status, "insufficient_evidence");
assert.equal(contradictoryQuality.failureReason, "quality_response_invalid");
assert.ok(bundle.isFaceLabObservationAnalysis(contradictoryQuality));

const ineligible = observation.buildFaceLabObservationAnalysis(
  { quality, observations: buildRawObservations() },
  { eligibility: { source: "vision", faceLabEligible: false } }
);
assert.equal(ineligible.status, "unavailable");
assert.equal(ineligible.failureReason, "eligibility_failed");
assert.ok(bundle.isFaceLabObservationAnalysis(ineligible));

const contaminated = structuredClone(canonical);
contaminated.imagePreviewDataUrl = "data:image/jpeg;base64,ZmFrZQ==";
assert.equal(bundle.sanitizeCanonicalFaceLabBundle(contaminated), null);

const inconsistentStatus = structuredClone(analysis);
inconsistentStatus.failureReason = "should_not_exist";
assert.equal(bundle.isFaceLabObservationAnalysis(inconsistentStatus), false);

const invalidCoverage = structuredClone(analysis);
invalidCoverage.coverage.availableFieldCount = 999;
assert.equal(bundle.isFaceLabObservationAnalysis(invalidCoverage), false);

const promptContract = observation.createFaceLabObservationPromptContract();
const promptRules = observation.createFaceLabObservationPromptRules();
assert.equal(JSON.stringify(promptContract).includes("presentation_hint"), false);
assert.equal(
  Array.isArray(promptContract.observations.featureLayout.focalFeatures.value),
  true
);
assert.equal(promptRules.includes("Do not generate archetypes"), true);
assert.equal(promptRules.includes("base64"), true);
assert.equal(
  promptRules.includes("focalFeatures.value must be an array"),
  true
);

const routeSource = readFileSync("app/api/face-reading/route.js", "utf8");
const serviceSource = readFileSync("lib/server/vision-observation-service.js", "utf8");
const normalizerSource = readFileSync("lib/vision-observation-normalizer.js", "utf8");
assert.equal(
  routeSource.includes("analyzeVisionObservation"),
  true,
  "route must delegate to the canonical Vision service"
);
assert.equal(
  normalizerSource.includes("buildFaceLabObservationAnalysis"),
  true,
  "canonical normalizer must build the bounded observation analysis"
);
assert.equal(serviceSource.includes("max_tokens: maxTokens"), true);
assert.equal(
  serviceSource.includes("...parsed,\n                structured"),
  false
);

console.log(
  "Face Lab observation contract and canonical boundary checks passed."
);
