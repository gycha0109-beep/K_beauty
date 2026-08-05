import { readFileSync } from "node:fs";

function stripImports(source) {
  return source.replace(/^import[\s\S]*?;\r?\n/gm, "");
}

function stripExports(source) {
  return source
    .replace(/export const /g, "const ")
    .replace(/export function /g, "function ");
}

function loadEligibilityExports() {
  const source = stripExports(
    stripImports(readFileSync("lib/image-analysis-eligibility.js", "utf8"))
  );
  return Function(`${source}\nreturn { createInvalidImageAnalysisEligibility, normalizeImageAnalysisEligibility };`)();
}

function loadPhotoEvidenceExports() {
  const helperSource = stripExports(
    stripImports(readFileSync("lib/image-analysis-eligibility.js", "utf8"))
  );
  const photoSource = stripExports(
    stripImports(readFileSync("lib/photo-evidence.js", "utf8"))
  );

  return Function(`${helperSource}\n${photoSource}\nreturn { buildFallbackPhotoAnalysis, normalizePhotoAnalysis };`)();
}

function loadFaceLabEnvelopeExports() {
  const source = stripExports(
    stripImports(readFileSync("lib/face-lab-result-envelope.js", "utf8"))
  );
  return Function(`${source}\nreturn { createFaceLabAvailable, getAvailableVisionFaceLabData };`)();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nexpected: ${JSON.stringify(expected)}\nactual: ${JSON.stringify(actual)}`);
  }
}

const { normalizeImageAnalysisEligibility } = loadEligibilityExports();
const { buildFallbackPhotoAnalysis, normalizePhotoAnalysis } = loadPhotoEvidenceExports();
const { createFaceLabAvailable, getAvailableVisionFaceLabData } = loadFaceLabEnvelopeExports();

const eligibleHuman = {
  status: "eligible",
  source: "vision",
  imageType: "photorealistic_human",
  humanFaceCount: 1,
  faceLabEligible: true,
  skinAnalysisEligible: true,
  faceLabFailureReason: null,
  skinFailureReason: null,
  confidence: 0.96,
  evidence: ["One unobstructed real human face is visible."]
};

const productImage = {
  status: "ineligible",
  source: "vision",
  imageType: "product",
  humanFaceCount: 0,
  faceLabEligible: false,
  skinAnalysisEligible: false,
  faceLabFailureReason: "face_not_detected",
  skinFailureReason: "face_not_detected",
  confidence: 0.99,
  evidence: ["Only cosmetic packaging is visible."]
};

const nonPhotorealisticHuman = {
  status: "ineligible",
  source: "vision",
  imageType: "non_photorealistic_human",
  humanFaceCount: 1,
  faceLabEligible: false,
  skinAnalysisEligible: false,
  faceLabFailureReason: "non_photorealistic_face",
  skinFailureReason: "non_photorealistic_face",
  confidence: 0.94,
  evidence: ["The visible character is an illustration."]
};

const multipleFaces = {
  status: "ineligible",
  source: "vision",
  imageType: "photorealistic_human",
  humanFaceCount: 2,
  faceLabEligible: false,
  skinAnalysisEligible: false,
  faceLabFailureReason: "multiple_faces",
  skinFailureReason: "multiple_faces",
  confidence: 0.93,
  evidence: ["Two real human faces are visible."]
};

const faceOnlyEligibility = {
  status: "eligible",
  source: "vision",
  imageType: "photorealistic_human",
  humanFaceCount: 1,
  faceLabEligible: true,
  skinAnalysisEligible: false,
  faceLabFailureReason: null,
  skinFailureReason: "heavy_filter_or_editing",
  confidence: 0.84,
  evidence: ["Facial structure is visible, but the skin texture is heavily filtered."]
};

assertEqual(normalizeImageAnalysisEligibility(eligibleHuman), eligibleHuman, "eligible human remains eligible");
assertEqual(normalizeImageAnalysisEligibility(productImage), productImage, "product image remains ineligible");
assertEqual(normalizeImageAnalysisEligibility(nonPhotorealisticHuman), nonPhotorealisticHuman, "illustration remains ineligible");
assertEqual(normalizeImageAnalysisEligibility(multipleFaces), multipleFaces, "multiple faces remain ineligible");
assertEqual(normalizeImageAnalysisEligibility(faceOnlyEligibility), faceOnlyEligibility, "Face Lab and skin eligibility remain independent");
assertEqual(
  getAvailableVisionFaceLabData(createFaceLabAvailable({ mood: "visible" }, { eligibility: eligibleHuman })),
  { mood: "visible" },
  "explicit Face Lab eligibility allows an available envelope"
);
assertEqual(
  getAvailableVisionFaceLabData(createFaceLabAvailable({ mood: "must not render" }, { eligibility: productImage })),
  null,
  "explicit ineligibility blocks an otherwise available-looking Face Lab envelope"
);

const invalidEligibility = normalizeImageAnalysisEligibility({
  ...eligibleHuman,
  evidence: []
});
assertEqual(
  {
    status: invalidEligibility.status,
    source: invalidEligibility.source,
    faceLabEligible: invalidEligibility.faceLabEligible,
    skinAnalysisEligible: invalidEligibility.skinAnalysisEligible,
    faceLabFailureReason: invalidEligibility.faceLabFailureReason,
    skinFailureReason: invalidEligibility.skinFailureReason
  },
  {
    status: "insufficient_evidence",
    source: null,
    faceLabEligible: false,
    skinAnalysisEligible: false,
    faceLabFailureReason: "eligibility_response_invalid",
    skinFailureReason: "eligibility_response_invalid"
  },
  "missing eligibility evidence fails closed"
);

const hallucinatedProductAnalysis = normalizePhotoAnalysis({
  eligibility: productImage,
  signals: { barrier: 5, dehydration: 5, acne: 5 },
  evidence: [{ axis: "acne", label: "Acne", detail: "The product package looks like acne." }],
  photoObservations: {
    summary: "This is an animation, so it cannot be analyzed.",
    signals: [{ key: "acne", label: "Cannot analyze", description: "This is an animation." }]
  }
}, "en");

assert(
  Object.values(hallucinatedProductAnalysis.signals).every((value) => value === 0),
  "ineligible product signals must be zero"
);
assertEqual(hallucinatedProductAnalysis.evidence, [], "ineligible product evidence must be empty");
assertEqual(hallucinatedProductAnalysis.photoObservations.signals, [], "ineligible product observations must be empty");
assert(
  !JSON.stringify(hallucinatedProductAnalysis).includes("animation, so it cannot be analyzed"),
  "model refusal text must not enter the normalized result"
);

const eligiblePhotoAnalysis = normalizePhotoAnalysis({
  eligibility: eligibleHuman,
  signals: { dehydration: 3 },
  evidence: [{ axis: "dehydration", label: "Dryness", detail: "The cheeks appear dry." }],
  photoObservations: {
    summary: "The cheeks appear dry.",
    signals: [{ key: "dehydration", label: "Dryness", area: "cheeks", confidence: "medium", description: "The cheeks appear dry." }],
    surveyAlignment: { status: "aligned", note: "The photo and survey align." }
  }
}, "en");
assert(eligiblePhotoAnalysis.signals.dehydration === 3, "eligible skin signals must be retained");
assert(eligiblePhotoAnalysis.evidence.length === 1, "eligible skin evidence must be retained");

const fallback = buildFallbackPhotoAnalysis("en");
assertEqual(fallback.evidence, [], "provider fallback must not synthesize photo evidence");
assert(fallback.imageEligibility.skinAnalysisEligible === false, "provider fallback must fail closed");

const faceRouteSource = readFileSync("app/api/face-reading/route.js", "utf8");
const analyzeRouteSource = readFileSync("app/api/analyze/route.js", "utf8");
const normalizerSource = readFileSync("lib/vision-observation-normalizer.js", "utf8");
const faceProjectorSource = readFileSync("lib/face-lab-observation-projector.js", "utf8");
const decisionEngineSource = readFileSync("lib/skin-match-decision-engine.js", "utf8");
const resultPageSource = readFileSync("app/result/page.js", "utf8");

assert(
  faceRouteSource.includes("analyzeVisionObservation"),
  "Face Lab compatibility route must use the canonical Vision service"
);
assert(
  normalizerSource.includes("normalizeImageAnalysisEligibility(parsed.eligibility)"),
  "canonical Vision normalization must fail closed before projection"
);
assert(
  faceProjectorSource.includes("eligibility.faceLabEligible !== true"),
  "Face Lab projection must hard-gate unavailable images"
);
assert(analyzeRouteSource.includes("imageEligibility: normalizeImageAnalysisEligibility"), "Skin Match response must preserve eligibility");
assert(
  decisionEngineSource.includes("photoAnalysis?.imageEligibility?.skinAnalysisEligible !== true"),
  "Skin Match scoring must reject photo weights without explicit eligibility"
);
assert(
  !resultPageSource.includes('photoSignals.push(locale === "en" ? "photo cues were limited"'),
  "free result must not synthesize a photo-signal placeholder"
);

console.log("Image analysis eligibility hard-gate contract checks passed.");
