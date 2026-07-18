import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function count(source, needle) {
  return source.split(needle).length - 1;
}

const client = read("app/page.js");
const analyzeRoute = read("app/api/analyze/route.js");
const faceRoute = read("app/api/face-reading/route.js");
const service = read("lib/server/vision-observation-service.js");
const contract = read("lib/vision-observation-contract.js");
const normalizer = read("lib/vision-observation-normalizer.js");
const skinProjector = read("lib/skin-observation-projector.js");
const faceProjector = read("lib/face-lab-observation-projector.js");
const packageJson = JSON.parse(read("package.json"));

assert.equal(client.includes("/api/face-reading"), false, "onboarding must not call /api/face-reading");
assert.equal(client.includes("faceLabPromise"), false, "onboarding must not retain a parallel Face Lab promise");
assert.equal(client.includes("faceLabIdempotencyKey"), false, "onboarding must use one idempotency key");
assert.equal(count(client, 'fetch("/api/analyze"'), 1, "onboarding must submit exactly one analyze request");
assert.ok(client.includes("data.faceLab"), "onboarding must consume Face Lab from /api/analyze");

assert.ok(analyzeRoute.includes("analyzeVisionObservation"), "analyze route must use canonical Vision service");
assert.ok(analyzeRoute.includes("projectSkinObservation"), "analyze route must project canonical skin observations");
assert.ok(analyzeRoute.includes("projectFaceLabResult"), "analyze route must project canonical Face Lab result");
assert.ok(analyzeRoute.includes("faceLab: faceLabResult"), "analyze response must include additive Face Lab envelope");
assert.equal(analyzeRoute.includes("extractPhotoAnalysis"), false, "legacy image analysis path must be removed");
assert.equal(analyzeRoute.includes("createPhotoEvidencePrompt"), false, "survey-coupled image prompt must be removed");
assert.equal(analyzeRoute.includes("normalizePhotoAnalysis"), false, "legacy Vision normalizer must be removed");
assert.ok(
  analyzeRoute.indexOf("canonicalizeAnonymousResultForPersistence(publicDecision)") <
    analyzeRoute.indexOf("faceLab: faceLabResult"),
  "Face Lab must stay outside the anonymous persistence fingerprint"
);

assert.ok(faceRoute.includes("analyzeVisionObservation"), "compatibility route must use canonical Vision service");
assert.ok(faceRoute.includes("projectFaceLabResult"), "compatibility route must use common projector");
assert.equal(faceRoute.includes("OPENAI_URL"), false, "compatibility route must not own a provider URL");
assert.equal(faceRoute.includes('type: "image_url"'), false, "compatibility route must not construct image provider payloads");

const operationalSources = [
  ["app/api/analyze/route.js", analyzeRoute],
  ["app/api/face-reading/route.js", faceRoute],
  ["lib/server/vision-observation-service.js", service]
];
const imageSites = operationalSources.filter(([, source]) => source.includes('type: "image_url"'));
assert.deepEqual(
  imageSites.map(([path]) => path),
  ["lib/server/vision-observation-service.js"],
  "only the canonical service may create an image-bearing provider request"
);
assert.equal(count(service, "fetch(OPENAI_URL"), 1, "canonical service must contain one provider execution site");
assert.equal(/\bwhile\s*\(|\bfor\s*\([^)]*attempt|retry/i.test(service), false, "canonical service must not retry image requests");
assert.ok(service.includes("redirect: \"manual\""), "provider redirects must be rejected");
assert.ok(service.includes("MAX_RESPONSE_BYTES"), "provider response size must be bounded");
assert.ok(service.includes("imageProviderAttemptCount: 1"), "provider telemetry must record one image attempt");

assert.ok(contract.includes('VISION_OBSERVATION_SCHEMA_VERSION = "vision-observation-v1"'));
assert.ok(contract.includes('VISION_OBSERVATION_PROMPT_VERSION = "vision-observation-prompt-v1"'));
assert.equal(contract.includes("surveyContext"), false, "canonical prompt must not contain survey context");
assert.equal(contract.includes("formInput"), false, "canonical prompt must not contain form input");
assert.ok(contract.includes("Do not use survey answers, locale, products"));
assert.ok(contract.includes("Skin and face sections are independent"));

assert.ok(normalizer.includes("normalizeImageAnalysisEligibility"));
assert.ok(normalizer.includes("buildFaceLabObservationAnalysis"));
assert.ok(normalizer.includes("rawProviderResponsePersisted: false"));
assert.ok(skinProjector.includes("buildAlignment"), "survey alignment must be deterministic post-processing");
assert.ok(faceProjector.includes('presentation_hint: "neutral"'));
assert.ok(faceProjector.includes("lookalike_celebrities: { summary: \"\", matches: [] }"));
assert.ok(packageJson.scripts?.["verify:unified-vision-pipeline"], "package verifier script must exist");

console.log(JSON.stringify({
  status: "passed",
  imageBearingProviderSites: imageSites.map(([path]) => path),
  onboardingAnalyzeRequests: count(client, 'fetch("/api/analyze"'),
  onboardingFaceReadingRequests: count(client, "/api/face-reading")
}, null, 2));
