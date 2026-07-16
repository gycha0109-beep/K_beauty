import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadFunctions(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import .*?;\r?\n/gm, "")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);

  return Function(
    ...dependencyNames,
    `${source}\nreturn { ${names.join(", ")} };`
  )(...dependencyNames.map((name) => dependencies[name]));
}

const structuredStub = () => ({
  mood: { status: "insufficient_evidence" },
  color: { status: "insufficient_evidence" },
  style: { status: "insufficient_evidence" }
});

const { createFaceLabLegacyInsufficientPayload } = loadFunctions(
  "lib/face-lab-route-shadow.js",
  ["createFaceLabLegacyInsufficientPayload"],
  { buildFaceLabStructuredData: structuredStub }
);

const analysis = {
  schemaVersion: "face-lab-observation-v1",
  privacy: { sourceImagePersisted: false }
};

const providerPayload = {
  eligibility: { faceLabEligible: true },
  observation_analysis: {
    rawProviderOnly: true,
    imageUrl: "data:image/jpeg;base64,ZmFrZQ=="
  },
  unknown_provider_key: "must not escape",
  base_data: {
    landmarks: ["visible jaw", "visible eyes"],
    face_shape: "oval",
    presentation_hint: "neutral",
    embedding: ["soft"],
    color_values: {
      undertone: "neutral",
      brightness: "medium",
      contrast: "medium",
      saturation: "muted"
    }
  },
  features: {
    physiognomy: {
      headline_label: "label",
      headline_result: "result",
      overall_impression: "summary",
      interpretation_axes: ["axis"],
      feature_based_interpretation: ["line"],
      real_tendency: ["legacy line"],
      strengths: ["legacy strength"],
      cautions: ["legacy caution"]
    },
    face_shape_hairstyle: {
      summary: "hair summary",
      recommendations: ["hair line"],
      avoid: ["avoid line"]
    },
    lookalike_celebrities: {
      summary: "must be removed",
      matches: [{ name: "person", reason: "reason" }]
    },
    color_tone_recommendation: {
      summary: "color summary",
      palette: ["beige"],
      recommendations: ["color line"],
      avoid: ["avoid color"]
    }
  }
};

const projected = createFaceLabLegacyInsufficientPayload(
  providerPayload,
  "ko",
  analysis
);

assert.equal(projected.analysis, analysis);
assert.equal(projected.base_data.face_shape, "oval");
assert.equal(projected.features.lookalike_celebrities.summary, "");
assert.deepEqual(projected.features.lookalike_celebrities.matches, []);
assert.equal("observation_analysis" in projected, false);
assert.equal("eligibility" in projected, false);
assert.equal("unknown_provider_key" in projected, false);
assert.equal(JSON.stringify(projected).includes("data:image/"), false);
assert.equal(JSON.stringify(projected).includes("rawProviderOnly"), false);

const contaminatedProviderPayload = structuredClone(providerPayload);
contaminatedProviderPayload.base_data.landmarks = [
  "data:image/jpeg;base64,ZmFrZQ==",
  "visible eyes"
];
const sanitized = createFaceLabLegacyInsufficientPayload(
  contaminatedProviderPayload,
  "en",
  analysis
);
assert.deepEqual(sanitized.base_data.landmarks, ["visible eyes"]);

const routeSource = readFileSync("app/api/face-reading/route.js", "utf8");
assert.ok(routeSource.includes("createFaceLabObservationPromptContract"));
assert.ok(routeSource.includes('"observation_analysis": ${JSON.stringify(observationContract, null, 2)}'));
assert.ok(routeSource.includes("buildFaceLabObservationAnalysis("));
assert.ok(routeSource.includes("createFaceLabLegacyInsufficientPayload("));
assert.ok(routeSource.includes("structured: structuredFaceLab,\n          analysis"));
assert.ok(routeSource.includes("max_tokens: 3000"));
assert.ok(routeSource.includes("Keep eligibility and observation_analysis keys, enum values, and evidence in English."));
assert.equal(routeSource.includes("...parsed,\n                structured"), false);
assert.equal(routeSource.includes("parsed?.observation_analysis"), true);

console.log("Face Lab route shadow integration checks passed.");
