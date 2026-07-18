import { readFileSync, writeFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function write(path, value) {
  writeFileSync(path, value, "utf8");
}

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  return source.replace(before, after);
}

function replaceRegex(source, pattern, after, label) {
  const matched = source.match(pattern);
  if (!matched || matched.length !== 1) {
    throw new Error(`${label}: expected one regex match`);
  }
  return source.replace(pattern, after);
}

let route = read("app/api/analyze/route.js");

route = replaceExact(
  route,
  'import { createPhotoEvidencePrompt, buildFallbackPhotoAnalysis, normalizePhotoAnalysis } from "@/lib/photo-evidence";',
  [
    'import { buildFallbackPhotoAnalysis } from "@/lib/photo-evidence";',
    'import { projectSkinObservation } from "@/lib/skin-observation-projector";',
    'import { projectFaceLabResult } from "@/lib/face-lab-observation-projector";',
    'import { createFaceLabUnavailable } from "@/lib/face-lab-result-envelope";',
    'import { analyzeVisionObservation } from "@/lib/server/vision-observation-service";'
  ].join("\n"),
  "analyze imports"
);
route = replaceExact(
  route,
  'import { sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";',
  'import { buildPremiumFaceLabSummary, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";',
  "premium face lab import"
);
route = replaceExact(route, 'const PHOTO_ANALYSIS_MAX_TOKENS = 900;\n', "", "legacy photo token constant");
route = replaceExact(
  route,
  "const ANALYZE_RESPONSE_SCHEMA_VERSION = 1;",
  "const ANALYZE_RESPONSE_SCHEMA_VERSION = 2;",
  "response schema version"
);

route = replaceRegex(
  route,
  /function buildAnalyzeMeta\(\{[\s\S]*?\n\}\n\nfunction parseBooleanField/,
  `function buildAnalyzeMeta({
  locale,
  photoNotice,
  explanationNotice,
  apiKey,
  visionTelemetry,
  imageProviderAttemptCount
}) {
  return {
    schemaVersion: ANALYZE_RESPONSE_SCHEMA_VERSION,
    source: "skin-match-v2",
    locale,
    generatedAt: new Date().toISOString(),
    notice: [photoNotice, explanationNotice].filter(Boolean).join(" ").trim(),
    explanationSource: apiKey && !explanationNotice ? "openai" : "deterministic",
    photoEvidenceSource: apiKey && !photoNotice ? "openai" : "fallback",
    photoObservationsSource: apiKey && !photoNotice ? "openai" : "fallback",
    visionObservationSchemaVersion: visionTelemetry?.schemaVersion || null,
    visionObservationPromptVersion: visionTelemetry?.promptVersion || null,
    imageProviderAttemptCount
  };
}

function parseBooleanField`,
  "analyze meta"
);

route = replaceRegex(
  route,
  /async function extractPhotoAnalysis\([\s\S]*?\n\}\n\nasync function generateProductExplanations/,
  "async function generateProductExplanations",
  "remove legacy image analysis"
);

route = replaceRegex(
  route,
  /    let imageDataUrl = null;[\s\S]*?    const currentProductSnapshots = await fetchCurrentProductSnapshotsByIds\(/,
  `    const imageBuffer = typeof image.arrayBuffer === "function"
      ? Buffer.from(await image.arrayBuffer())
      : null;

    if (process.env.NODE_ENV !== "production") {
      logAnalyze(
        "openai-env:diagnostic",
        localShadowProviderStub.enabled
          ? {
              route: "analyze",
              routeUsesOpenAi: false,
              routeUsesOpenRouter: false,
              providerIsolation: localShadowProviderStub.reasonCode
            }
          : getOpenAiEnvDiagnostics({
              route: "analyze",
              routeUsesOpenAi: true,
              routeUsesOpenRouter: false
            })
      );
    }

    let photoAnalysis = buildFallbackPhotoAnalysis(locale);
    let faceLabResult = createFaceLabUnavailable("vision_request_failed");
    let visionTelemetry = null;
    let photoNotice = "";
    const imageProviderAttemptCount = apiKey && imageBuffer ? 1 : 0;

    if (apiKey && imageBuffer) {
      try {
        const observationResult = await analyzeVisionObservation({
          apiKey,
          imageBuffer,
          mimeType: image.type,
          model
        });
        visionTelemetry = observationResult.telemetry;
        photoAnalysis = projectSkinObservation(observationResult.bundle, {
          locale,
          formInput
        });
        faceLabResult = projectFaceLabResult(observationResult.bundle, { locale });

        if (observationResult.bundle.skin?.status !== "available") {
          photoNotice = copy.photoFallbackNotice;
        }
      } catch {
        photoAnalysis = buildFallbackPhotoAnalysis(locale);
        faceLabResult = createFaceLabUnavailable("vision_request_failed");
        photoNotice = copy.photoFallbackNotice;
        logAnalyze("vision-observation:fallback", {
          ok: false,
          errorCategory: "fallback_used"
        });
      }
    } else {
      photoNotice = copy.photoFallbackNotice;
      faceLabResult = createFaceLabUnavailable(apiKey ? "vision_request_failed" : "api_key_missing");
    }

    const currentProductSnapshots = await fetchCurrentProductSnapshotsByIds(`,
  "canonical observation integration"
);

route = replaceExact(
  route,
  '    let explanationNotice = "";\n\n    if (apiKey) {',
  '    let explanationNotice = "";\n\n    if (apiKey && visionTelemetry) {',
  "product explanation success gate"
);
route = replaceExact(
  route,
  `    } else {
      explanationNotice = copy.missingApiKeyNotice;
    }

    decision = appendTopPickReviewEvidence(decision, locale);

    const publicDecision = buildFreeDecisionPayload(decision);`,
  `    } else {
      explanationNotice = apiKey
        ? copy.explanationFallbackNotice
        : copy.missingApiKeyNotice;
    }

    decision = appendTopPickReviewEvidence(decision, locale);

    if (decision.premiumReport) {
      decision = {
        ...decision,
        premiumReport: {
          ...decision.premiumReport,
          faceLabSummary: buildPremiumFaceLabSummary(faceLabResult, { locale })
        }
      };
    }

    const publicDecision = buildFreeDecisionPayload(decision);`,
  "premium Face Lab projection"
);
route = replaceExact(
  route,
  `    const responsePayload = {
      ...publicDecision,
      meta: buildAnalyzeMeta({
        locale,
        photoNotice,
        explanationNotice,
        apiKey
      }),`,
  `    const responsePayload = {
      ...publicDecision,
      faceLab: faceLabResult,
      meta: buildAnalyzeMeta({
        locale,
        photoNotice,
        explanationNotice,
        apiKey,
        visionTelemetry,
        imageProviderAttemptCount
      }),`,
  "additive Face Lab response"
);

write("app/api/analyze/route.js", route);

let client = read("app/page.js");
client = replaceRegex(
  client,
  /async function requestFaceLabResult\([\s\S]*?\n\}\n\nexport default function HomePage/,
  "export default function HomePage",
  "remove client Face Lab request"
);
client = replaceExact(
  client,
  `        const analyzeIdempotencyKey = createClientIdempotencyKey();
        const faceLabIdempotencyKey = createClientIdempotencyKey();`,
  "        const analyzeIdempotencyKey = createClientIdempotencyKey();",
  "single client idempotency key"
);
client = replaceExact(
  client,
  `        const faceLabPromise = requestFaceLabResult(imageFile, locale, faceLabIdempotencyKey);
        const response = await fetch("/api/analyze", {`,
  `        const response = await fetch("/api/analyze", {`,
  "remove parallel Face Lab request"
);
client = replaceExact(
  client,
  `        const [imagePreviewDataUrl, faceLabResult] = await Promise.all([
          imagePreviewDataUrlPromise,
          faceLabPromise
        ]);`,
  `        const imagePreviewDataUrl = await imagePreviewDataUrlPromise;
        const faceLabResult = isFaceLabResultEnvelope(data.faceLab)
          ? data.faceLab
          : createFaceLabUnavailable("vision_response_invalid");`,
  "consume unified response"
);
write("app/page.js", client);

const packagePath = "package.json";
const packageJson = JSON.parse(read(packagePath));
packageJson.scripts["verify:unified-vision-pipeline"] = "node scripts/verify-unified-vision-pipeline.mjs";
write(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);

console.log("unified Vision route patch applied");
