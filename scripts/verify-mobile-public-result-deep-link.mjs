import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(label) {
  console.error(`MOBILE_10_PUBLIC_RESULT_DEEP_LINK=FAIL ${label}`);
  process.exit(1);
}

function assert(condition, label) {
  if (!condition) fail(label);
}

const appConfigSource = read("apps/mobile/app.json");
const appConfig = JSON.parse(appConfigSource);
const readiness = JSON.parse(read("apps/mobile/store-readiness.json"));
const mobileSliceMatch = /^MOBILE-(\d+)$/.exec(readiness.slice || "");
const mobile14OrLater = Number(mobileSliceMatch?.[1] || 0) >= 14;
const layout = read("apps/mobile/app/_layout.tsx");
const screen = read("apps/mobile/app/r/[shareId].tsx");
const client = read("apps/mobile/features/reports/public-result-client.ts");
const renderer = read("apps/mobile/features/reports/NativePublicResult.tsx");
const m9Client = read("apps/mobile/features/reports/public-share-client.ts");
const resultRoute = read("app/api/results/[shareId]/route.js");
const resultGuard = read("lib/security/public-result-read-guard.js");
const resultGuardCore = read("lib/security/public-result-read-guard-core.js");
const resultAccess = read("lib/analysis-result-access.js");
const analysisResults = read("lib/analysis-results.js");
const analyzeScreen = read("apps/mobile/app/analyze.tsx");
const androidSmoke = read("scripts/verify-mobile-android-smoke.sh");

assert(appConfigSource.includes('"scheme": "bejewely"'), "existing-custom-scheme");
if (mobile14OrLater) {
  const expo = appConfig.expo || {};
  assert(
    Array.isArray(expo.ios?.associatedDomains) &&
      expo.ios.associatedDomains.length === 1 &&
      expo.ios.associatedDomains[0] === "applinks:k-beauty-two.vercel.app",
    "mobile14-ios-hosted-result-link"
  );
  const appLink = (expo.android?.intentFilters || []).find((entry) =>
    entry?.action === "VIEW" &&
    entry?.autoVerify === true &&
    (entry?.data || []).some((item) =>
      item?.scheme === "https" &&
      item?.host === "k-beauty-two.vercel.app" &&
      item?.pathPrefix === "/r/"
    )
  );
  assert(Boolean(appLink), "mobile14-android-hosted-result-link");
  console.log("MOBILE_PUBLIC_RESULT_HOSTED_LINKS_ENABLED=PASS");
} else {
  assert(!appConfigSource.includes("intentFilters"), "android-https-app-links-excluded");
  assert(!appConfigSource.includes("associatedDomains"), "ios-universal-links-excluded");
  console.log("MOBILE_PUBLIC_RESULT_HOSTED_LINKS_EXCLUDED=PASS");
}
assert(layout.includes('name="r/[shareId]"'), "hidden-public-result-route");
assert(layout.includes('name="r/[shareId]" options={{ href: null'), "public-result-hidden-from-tabs");

assert(screen.includes("useLocalSearchParams"), "router-param-consumption");
assert(screen.includes("parseNativePublicResultShareId"), "local-share-id-validation");
assert(screen.includes("loadNativePublicResult"), "public-result-loader-wiring");
assert(screen.includes('testID="native-public-result-state"'), "public-result-state-marker");
assert(screen.includes('testID="native-public-result-back"'), "public-result-back-marker");
assert(screen.includes("Invalid shared result link."), "invalid-link-runtime-copy");
assert(renderer.includes('testID="native-public-result"'), "public-result-render-marker");
assert(renderer.includes('testID="native-public-result-summary"'), "public-result-summary-marker");
assert(renderer.includes('testID="native-public-result-top-pick"'), "public-result-top-pick-marker");

assert(client.includes('`${getMobileApiBaseUrl()}/api/results/${encodeURIComponent(canonicalShareId)}`'), "existing-public-read-endpoint");
assert(client.includes('method: "GET"'), "public-read-get-only");
assert(client.includes('credentials: "include"'), "anonymous-principal-cookie-continuity");
assert(client.includes("[A-Za-z0-9_-]{8}"), "legacy-share-id-shape");
assert(client.includes("[A-Za-z0-9_-]{22}"), "current-share-id-shape");
assert(client.includes("payload.result.shareId !== canonicalShareId"), "exact-share-id-response-guard");
assert(client.includes('response.status === 404'), "not-found-state");
assert(client.includes('response.status === 429'), "rate-limited-state");
assert(client.includes('response.status === 503'), "unavailable-state");
assert(!client.includes("Authorization"), "no-owner-auth-required");
assert(!client.includes('method: "POST"'), "no-publication-mutation");
assert(!client.includes('method: "PATCH"'), "no-unpublish-mutation");
assert(!client.includes("share: true"), "no-publication-body");

assert(resultRoute.includes("guardPublicResultRead"), "server-public-read-guard");
assert(resultRoute.includes("readAnalysisResultForShare"), "server-public-read-authority");
assert(resultGuard.includes('["user", "anonymous"].includes(principal.scope)'), "anonymous-public-principal-supported");
assert(resultGuardCore.includes('anonymous: Object.freeze(['), "anonymous-rate-policy-preserved");
assert(resultAccess.includes('publicAudience === "public"'), "server-public-visibility-authority");
assert(resultAccess.includes("serializePublicAnalysisResult(data)"), "server-public-dto-projection");
assert(analysisResults.includes("export function serializePublicAnalysisResult"), "public-serializer-present");
assert(analysisResults.includes("export function serializeOwnerAnalysisResult"), "owner-serializer-separate");
const publicSerializer = analysisResults.slice(
  analysisResults.indexOf("export function serializePublicAnalysisResult"),
  analysisResults.indexOf("export function serializeOwnerAnalysisResult")
);
assert(publicSerializer.includes("shareId:"), "public-dto-share-id");
assert(publicSerializer.includes("summary:"), "public-dto-summary");
assert(!publicSerializer.includes("isPublic:"), "owner-public-flag-excluded-from-public-dto");

for (const forbidden of [
  "/api/analyze",
  "/api/full-report",
  "/api/premium/access",
  "/api/my/save-report",
  "createSupabaseAdminClient",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "@/lib/skin-match-decision-engine",
  "@/lib/premium-decision-state",
  "@/lib/product-source",
  "from \"server-only\""
]) {
  assert(!client.includes(forbidden), `public-client-forbidden:${forbidden}`);
  assert(!renderer.includes(forbidden), `public-renderer-forbidden:${forbidden}`);
}

assert(m9Client.includes('method: "POST"'), "m9-publication-remains-separate");
assert(m9Client.includes("publicShared"), "m9-publication-response-remains-separate");
assert(androidSmoke.includes('android.intent.action.VIEW'), "android-custom-scheme-action-view");
assert(androidSmoke.includes('bejewely://r/invalid'), "android-custom-scheme-invalid-fixture");
assert(androidSmoke.includes('wait_for_text "Invalid shared result link."'), "android-deep-link-route-assertion");
assert(androidSmoke.includes('public-result-deep-link-invalid-en.png'), "android-deep-link-screenshot");
assert(androidSmoke.includes("MOBILE_ANDROID_PUBLIC_RESULT_DEEP_LINK_SMOKE=PASS"), "android-deep-link-smoke-marker");
assert(analyzeScreen.includes("onPhotoChange={setCapturedPhoto}"), "mobile5-camera-regression-contract");

console.log("MOBILE_PUBLIC_RESULT_EXISTING_SCHEME=PASS");
console.log("MOBILE_PUBLIC_RESULT_ROUTER_REENTRY=PASS");
console.log("MOBILE_PUBLIC_RESULT_ANONYMOUS_READ=PASS");
console.log("MOBILE_PUBLIC_RESULT_SERVER_VISIBILITY_AUTHORITY=PASS");
console.log("MOBILE_PUBLIC_RESULT_SERVER_DTO_AUTHORITY=PASS");
console.log("MOBILE_PUBLIC_RESULT_READ_ONLY_BOUNDARY=PASS");
console.log("MOBILE_PUBLIC_RESULT_M9_SEPARATION=PASS");
console.log("MOBILE_PUBLIC_RESULT_ANDROID_DEEP_LINK_SMOKE=PASS");
console.log("MOBILE_PUBLIC_RESULT_CAMERA_REGRESSION=PASS");
console.log("MOBILE_10_PUBLIC_RESULT_DEEP_LINK=PASS");
