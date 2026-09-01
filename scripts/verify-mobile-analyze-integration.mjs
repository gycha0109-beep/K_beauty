import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(label) {
  console.error(`MOBILE_7_ANALYZE_SERVER_INTEGRATION=FAIL ${label}`);
  process.exit(1);
}

function assert(condition, label) {
  if (!condition) fail(label);
}

const client = read("apps/mobile/features/analyze/analyze-client.ts");
const survey = read("apps/mobile/features/analyze/NativeAnalyzeSurvey.tsx");
const result = read("apps/mobile/features/analyze/NativeAnalyzeResult.tsx");
const screen = read("apps/mobile/app/analyze.tsx");
const boundary = read("apps/mobile/features/analyze/README.md");
const camera = read("apps/mobile/features/camera/NativeFaceCamera.tsx");
const sharedSurvey = read("packages/shared/src/survey-input-contract.js");
const serverRoute = read("app/api/analyze/route.js");
const analysisGuard = read("lib/security/analysis-request-guard.js");
const analysisGuardCore = read("lib/security/analysis-request-guard-core.js");
const androidSmoke = read("scripts/verify-mobile-android-smoke.sh");
const env = read("apps/mobile/lib/env.ts");

for (const marker of [
  'type: "image/jpeg"',
  "quality: 0.85",
  "skipProcessing: false"
]) {
  assert(camera.includes(marker), `mobile5-final-photo:${marker}`);
}

assert(client.includes('import { normalizeSurveyAnswers, type SurveyFormInput } from "../../lib/survey-contract"'), "shared-survey-bridge");
assert(client.includes("normalizeSurveyAnswers(form)"), "shared-survey-normalization");
assert(screen.includes("SURVEY_INITIAL_FORM"), "survey-initial-form");
assert(screen.includes("SURVEY_OPTIONAL_DEFAULTS"), "survey-optional-defaults");
assert(sharedSurvey.includes('SURVEY_INPUT_CONTRACT_VERSION = "survey-input-contract-v1"'), "survey-contract-version");

for (const requiredField of [
  "skinType",
  "sensitivity",
  "mainConcern",
  "cleansingFrequency",
  "preferredTexture",
  "postWashFeeling",
  "afternoonSkinChange",
  "mostDislikedFeel"
]) {
  assert(client.includes(`"${requiredField}"`), `client-required-field:${requiredField}`);
  assert(serverRoute.includes(requiredField), `server-required-field:${requiredField}`);
}

assert(client.includes('payload.append(\n    "image"'), "multipart-final-image");
assert(client.includes("JSON.stringify(value)"), "multipart-array-json");
assert(client.includes('return value ? "true" : "false"'), "multipart-boolean-string");
assert(client.includes('payload.append("locale", locale)'), "multipart-locale");
assert(client.includes('`${getMobileApiBaseUrl()}/api/analyze`'), "existing-api-base");
assert(env.includes('"EXPO_PUBLIC_API_BASE_URL"'), "mobile-api-env");
assert(client.includes('"Idempotency-Key": idempotencyKey'), "idempotency-header");
assert(client.includes("mobile-analyze-"), "idempotency-prefix");
assert(analysisGuardCore.includes('IDEMPOTENCY_HEADER = "Idempotency-Key"'), "server-idempotency-header");
assert(analysisGuardCore.includes("^[A-Za-z0-9._:-]{16,128}$"), "server-idempotency-pattern");
assert(!client.includes('"Content-Type": "multipart/form-data"'), "manual-multipart-content-type");
assert(!client.includes("'Content-Type': 'multipart/form-data'"), "manual-multipart-content-type-single");
assert(client.includes('Authorization = `Bearer ${session.access_token}`'), "optional-native-bearer");
assert(client.includes('credentials: "include"'), "anonymous-cookie-continuity");

for (const serverMarker of [
  'const image = formData.get("image")',
  'formData.get("sensitivityLevel") || formData.get("sensitivity")',
  'formData.get("texturePreference") || formData.get("preferredTexture")',
  'formData.get("postCleanseFeel") || formData.get("postWashFeeling")',
  'formData.get("afternoonState") || formData.get("afternoonSkinChange")',
  'formData.get("dislikedFeel") || formData.get("mostDislikedFeel")'
]) {
  assert(serverRoute.includes(serverMarker), `server-multipart-contract:${serverMarker}`);
}

for (const responseMarker of [
  "summary: decision.summary",
  "topPick:",
  "morning:",
  "night:",
  "faceLab: faceLabResult",
  "analysisRunId"
]) {
  assert(serverRoute.includes(responseMarker), `server-response-shape:${responseMarker}`);
}

assert(client.includes('typeof payload.summary === "string"'), "native-response-summary-guard");
assert(client.includes('Object.prototype.hasOwnProperty.call(payload, "topPick")'), "native-response-top-pick-guard");
assert(client.includes("Array.isArray(payload.morning)"), "native-response-morning-guard");
assert(client.includes("Array.isArray(payload.night)"), "native-response-night-guard");

for (const errorCode of [
  "analysis_rate_limited",
  "analysis_request_in_progress",
  "analysis_idempotency_conflict",
  "analysis_request_already_completed",
  "analysis_request_failed",
  "invalid_idempotency_key",
  "analysis_guard_unavailable"
]) {
  assert(analysisGuard.includes(errorCode), `analysis-guard-error:${errorCode}`);
}

assert(survey.includes('testID="native-analyze-survey"'), "native-survey-render-marker");
assert(screen.includes('testID="native-analyze-submit"'), "native-submit-render-marker");
assert(result.includes('testID="native-analyze-result"'), "native-result-render-marker");
assert(result.includes('testID="native-analyze-result-summary"'), "native-result-summary-marker");
assert(screen.includes("Temporary camera-guidance images are not uploaded."), "guidance-upload-boundary-copy");
assert(boundary.includes("Only the final `NativeCameraPhoto` JPEG"), "final-photo-boundary-doc");
assert(boundary.includes("MOBILE-8+"), "premium-deferred-boundary-doc");

assert(camera.includes("acceptPhoto?: string"), "camera-photo-accept-copy-contract");
assert(camera.includes('testID="native-camera-use-photo"'), "camera-photo-accept-render-marker");
assert(screen.includes('acceptPhoto: locale === "ko" ? "이 사진 사용" : "Use photo"'), "camera-photo-accept-localized-copy");
assert(androidSmoke.includes('wait_for_text "Use photo"'), "android-photo-accept-visible-smoke");
assert(androidSmoke.includes('tap_text "Use photo"'), "android-photo-accept-action-smoke");
assert(androidSmoke.includes('wait_for_text_with_scroll "Skin survey before analysis"'), "android-survey-render-smoke");
assert(androidSmoke.includes("MOBILE_ANDROID_ANALYZE_SURVEY_SMOKE=PASS"), "android-survey-smoke-marker");
assert(androidSmoke.includes('analyze-survey-en.png'), "android-survey-screenshot-artifact");

const boundedMobileSources = [client, survey, result, screen, boundary].join("\n");
for (const forbidden of [
  "@/lib/skin-match-decision-engine",
  "@/lib/product-source",
  "@/lib/face-lab-observation-projector",
  "@/lib/premium-decision-state",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "createSupabaseAdminClient",
  "from \"server-only\""
]) {
  assert(!boundedMobileSources.includes(forbidden), `forbidden-mobile-authority:${forbidden}`);
}

console.log("MOBILE_ANALYZE_SHARED_SURVEY=PASS");
console.log("MOBILE_ANALYZE_MULTIPART_TRANSPORT=PASS");
console.log("MOBILE_ANALYZE_IDEMPOTENCY_AUTH=PASS");
console.log("MOBILE_ANALYZE_FREE_RESULT_BOUNDARY=PASS");
console.log("MOBILE_ANALYZE_PHOTO_ACCEPT_HANDOFF=PASS");
console.log("MOBILE_ANALYZE_ANDROID_SURVEY_RUNTIME=PASS");
console.log("MOBILE_ANALYZE_SERVER_AUTHORITY=PASS");
console.log("MOBILE_7_ANALYZE_SERVER_INTEGRATION=PASS");
