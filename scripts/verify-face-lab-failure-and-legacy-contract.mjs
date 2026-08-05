import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function loadFunctions(path, names, dependencies = {}) {
  const source = readFileSync(path, "utf8")
    .replace(/^import .*?;\r?\n/m, "")
    .replace(/export function /g, "function ");
  const dependencyNames = Object.keys(dependencies);
  return Function(...dependencyNames, `${source}\nreturn { ${names.join(", ")} };`)(
    ...dependencyNames.map((name) => dependencies[name])
  );
}

const { buildFaceLabLaunchData } = loadFunctions(
  "lib/face-lab-launch.js",
  ["buildFaceLabLaunchData"]
);
const { getFaceLabDisplayStatus, getAvailableVisionFaceLabData } = loadFunctions(
  "lib/face-lab-result-envelope.js",
  ["getFaceLabDisplayStatus", "getAvailableVisionFaceLabData"]
);
const {
  buildPremiumFaceLabSummary,
  buildUnavailablePremiumFaceLab,
  sanitizePremiumFaceLabSummary
} = loadFunctions(
  "lib/premium-face-lab.js",
  [
    "buildPremiumFaceLabSummary",
    "buildUnavailablePremiumFaceLab",
    "sanitizePremiumFaceLabSummary"
  ],
  { buildFaceLabLaunchData }
);

const photoFailureReasons = [
  "face_not_detected",
  "multiple_faces",
  "non_photorealistic_face",
  "face_too_small",
  "face_occluded",
  "face_angle_unsupported",
  "image_quality_insufficient"
];

for (const reason of photoFailureReasons) {
  assert.equal(
    getFaceLabDisplayStatus({
      status: "unavailable",
      source: null,
      failureReason: reason,
      data: null,
      eligibility: {
        source: "vision",
        faceLabEligible: false,
        faceLabFailureReason: reason
      }
    }),
    "photo_ineligible",
    `${reason} must use the photo-ineligible display state`
  );
}

for (const reason of [
  "eligibility_response_invalid",
  "unknown",
  "api_key_missing",
  "vision_request_failed",
  "vision_response_invalid",
  "required_features_missing"
]) {
  assert.equal(
    getFaceLabDisplayStatus({
      status: "unavailable",
      source: null,
      failureReason: reason,
      data: null,
      eligibility: {
        source: reason === "unknown" ? "vision" : null,
        faceLabEligible: false,
        faceLabFailureReason: reason
      }
    }),
    "unavailable",
    `${reason} must not be labeled as photo recognition failure`
  );
}

const validEnvelope = {
  status: "available",
  source: "vision",
  failureReason: null,
  data: {
    structured: {
      mood: {
        status: "available",
        source: "vision",
        evidence: ["one real face is visible"],
        value: {
          primary: "부드러움",
          traits: ["친근함"]
        }
      }
    }
  },
  eligibility: {
    source: "vision",
    faceLabEligible: true
  }
};

assert.equal(getFaceLabDisplayStatus(validEnvelope), "available");
assert.ok(getAvailableVisionFaceLabData(validEnvelope));
assert.equal(buildPremiumFaceLabSummary(validEnvelope).status, "available");

const inlineFaceImage = "data:image/jpeg;base64,ZmFrZS1mYWNlLWltYWdl";
const premiumSummaryWithImageInput = buildPremiumFaceLabSummary(validEnvelope, {
  imageUrl: inlineFaceImage,
  imageAlt: "Face Lab analysis image"
});
assert.equal(
  premiumSummaryWithImageInput.imageUrl,
  null,
  "new premium Face Lab summaries must not persist source image data"
);
assert.equal(
  premiumSummaryWithImageInput.imageAlt,
  null,
  "new premium Face Lab summaries must not persist image metadata"
);

const unavailableSummaryWithImageInput = buildUnavailablePremiumFaceLab(
  inlineFaceImage,
  "Face Lab analysis image"
);
assert.equal(unavailableSummaryWithImageInput.imageUrl, null);
assert.equal(unavailableSummaryWithImageInput.imageAlt, null);

const sanitizedSummaryWithImageInput = sanitizePremiumFaceLabSummary({
  status: "available",
  imageUrl: inlineFaceImage,
  imageAlt: "Face Lab analysis image",
  impressionTitle: "부드러움",
  impressionSummary: "근거가 있는 인상 요약",
  keywords: ["부드러움"],
  styleDirections: []
});
assert.equal(
  sanitizedSummaryWithImageInput.imageUrl,
  null,
  "sanitization must strip legacy or caller-provided image data before current persistence"
);
assert.equal(sanitizedSummaryWithImageInput.imageAlt, null);

for (const [label, value] of [
  ["flat impression", { impressionTitle: "부드러움" }],
  ["teaser mood", { faceMood: { primary: "부드러움" } }],
  ["raw keywords", { keywords: ["부드러움"] }],
  ["mock fallback", { source: "mock_fallback", impressionTitle: "부드러움" }],
  ["default fallback", { source: "default", styleKeywords: ["부드러움"] }],
  ["shape-only summary", { status: "available", impressionTitle: "부드러움" }],
  ["malformed array", []],
  ["malformed null", null]
]) {
  assert.doesNotThrow(() => buildPremiumFaceLabSummary(value), `${label} must not throw`);
  assert.equal(
    buildPremiumFaceLabSummary(value).status,
    "unavailable",
    `${label} must not become a new premium Face Lab result`
  );
}

assert.equal(
  sanitizePremiumFaceLabSummary({ status: "available", impressionTitle: "historical snapshot" }).status,
  "available",
  "historical saved snapshots must remain renderable without reclassification"
);

const resultPage = readFileSync("app/result/page.js", "utf8");
const diagnosisStep = readFileSync("components/result/free-v2/FreeResultV2DiagnosisStep.jsx", "utf8");
const fullReportPage = readFileSync("app/result/full-report/page.js", "utf8");
const fullReportRoute = readFileSync("app/api/full-report/route.js", "utf8");
const premiumFaceLabSource = readFileSync("lib/premium-face-lab.js", "utf8");

assert.ok(resultPage.includes("faceLabDisplayStatus={faceLabDisplayStatus}"));
assert.ok(diagnosisStep.includes('faceLabDisplayStatus === "photo_ineligible"'));
assert.ok(diagnosisStep.includes("We could not verify the full face in this photo."));
assert.equal(
  (diagnosisStep.match(/face-lab-photo-ineligible/g) || []).length,
  1,
  "photo-ineligible state must exist only in the dedicated display branch"
);
assert.ok(fullReportPage.includes("faceLab: parsedFaceLabEnvelope"));
assert.ok(premiumFaceLabSource.includes("imageUrl: null"));
assert.ok(premiumFaceLabSource.includes("imageAlt: null"));
assert.equal(
  premiumFaceLabSource.includes("cleanString(options.imageUrl)"),
  false,
  "premium summary construction must not retain caller-provided image data"
);

const savedReadIndex = fullReportRoute.indexOf("if (body?.savedReportId)");
const currentSessionResolveIndex = fullReportRoute.lastIndexOf("resolveFaceLabSummary({");
assert.ok(savedReadIndex >= 0 && savedReadIndex < currentSessionResolveIndex);
assert.ok(fullReportRoute.includes("...savedPremiumReport"));
assert.ok(fullReportRoute.includes("if (legacyFaceLabSummary?.status === \"available\")"));
assert.ok(fullReportRoute.includes("faceLabSummary,"));
assert.equal(
  fullReportRoute.includes("faceLab: body.faceLab"),
  false,
  "current Premium snapshot must persist the sanitized summary, not the raw Face Lab envelope"
);

console.log("Face Lab failure display, legacy compatibility, and image persistence checks passed.");
