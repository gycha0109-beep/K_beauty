import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(label) {
  console.error(`MOBILE_9_NATIVE_FREE_PUBLIC_SHARE=FAIL ${label}`);
  process.exit(1);
}

function assert(condition, label) {
  if (!condition) fail(label);
}

const shareClient = read("apps/mobile/features/reports/public-share-client.ts");
const reentryClient = read("apps/mobile/features/reports/saved-report-client.ts");
const screen = read("apps/mobile/app/saved-report.tsx");
const resultCreateRoute = read("app/api/results/route.js");
const resultReadRoute = read("app/api/results/[shareId]/route.js");
const analysisAccess = read("lib/analysis-result-access.js");
const analyzeScreen = read("apps/mobile/app/analyze.tsx");
const androidSmoke = read("scripts/verify-mobile-android-smoke.sh");
const appConfig = read("apps/mobile/app.json");

assert(shareClient.includes('`${getMobileApiBaseUrl()}/api/results`'), "existing-publication-endpoint");
assert(shareClient.includes('method: "POST"'), "publication-post");
assert(shareClient.includes('Authorization: `Bearer ${session.access_token}`'), "native-bearer-owner-auth");
assert(shareClient.includes('credentials: "include"'), "cookie-continuity");
assert(shareClient.includes('share: true'), "explicit-share-confirmation");
assert(shareClient.includes('shareId'), "share-id-request");
assert(shareClient.includes('payload?.publicShared !== true'), "public-shared-response-guard");
assert(shareClient.includes('publishedShareId !== shareId'), "exact-share-id-response-guard");
assert(shareClient.includes('canonicalShareId !== shareId'), "canonical-share-path-guard");
assert(shareClient.includes('process.env.NODE_ENV === "production"'), "production-mode-check");
assert(shareClient.includes('shareUrl.protocol !== "https:"'), "production-https-guard");
assert(shareClient.includes('shareUrl.origin !== apiUrl.origin'), "same-origin-guard");

assert(reentryClient.includes('shareId: string;'), "free-reentry-exposes-authoritative-share-id");
assert(reentryClient.includes('kind: "free"'), "free-reentry-kind");
assert(!reentryClient.includes('method: "POST"') || reentryClient.includes('/api/full-report'), "m8-reentry-publication-separation");
assert(!reentryClient.includes('publicShared'), "m8-read-only-client-no-publication-response");

assert(screen.includes('state.value.kind !== "free"'), "free-only-action-guard");
assert(screen.includes('testID="native-free-public-share"'), "public-share-card-marker");
assert(screen.includes('testID="native-free-public-share-button"'), "public-share-button-marker");
assert(screen.includes('Sharing publishes this free report at a public web link.'), "explicit-publication-disclosure");
assert(screen.includes('await Share.share({'), "native-os-share-sheet");
assert(screen.includes('published.shareUrl'), "canonical-url-share-sheet");
assert(screen.includes('share-sheet-error'), "post-publication-share-sheet-error-state");

assert(resultCreateRoute.includes('if (share && requestedShareId)'), "existing-server-publication-branch");
assert(resultCreateRoute.includes('publishExistingShare'), "existing-server-publication-function");
assert(resultCreateRoute.includes('.update({ is_public: true })'), "server-publication-mutation");
assert(resultCreateRoute.includes('.eq("share_id", shareId)'), "server-share-id-scope");
assert(resultCreateRoute.includes('.eq("user_id", userId)'), "server-owner-scope");
assert(resultCreateRoute.includes('publicShared: Boolean(published.is_public)'), "server-publication-confirmation");
assert(resultReadRoute.includes('guardPublicResultRead'), "public-read-guard-preserved");
assert(analysisAccess.includes('readAnalysisResultForShare'), "public-read-authority-preserved");

const shareBranchIndex = resultCreateRoute.indexOf('if (share && requestedShareId)');
const newResultValidationIndex = resultCreateRoute.indexOf('if (!result || !submission?.form');
assert(shareBranchIndex >= 0 && newResultValidationIndex > shareBranchIndex, "existing-result-publication-precedes-create-validation");

for (const forbidden of [
  "/api/analyze",
  "/api/full-report",
  "/api/premium/access",
  "/api/my/save-report",
  "createPremiumReportSession",
  "persistPremiumSavedReport",
  "createSupabaseAdminClient",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "@/lib/skin-match-decision-engine",
  "@/lib/premium-decision-state",
  "@/lib/product-source"
]) {
  assert(!shareClient.includes(forbidden), `share-client-forbidden:${forbidden}`);
}

assert(!screen.includes('Linking.addEventListener'), "no-inbound-deep-link-scope");
assert(!appConfig.includes('associatedDomains'), "no-ios-universal-link-scope");
assert(!appConfig.includes('intentFilters'), "no-android-app-link-scope");
assert(androidSmoke.includes('MOBILE_ANDROID_SAVED_REPORT_ROUTE_SMOKE=PASS'), "m8-native-route-runtime-regression");
assert(analyzeScreen.includes('onPhotoChange={setCapturedPhoto}'), "mobile5-camera-regression-contract");

console.log("MOBILE_PUBLIC_SHARE_SERVER_AUTHORITY=PASS");
console.log("MOBILE_PUBLIC_SHARE_OWNER_SCOPE=PASS");
console.log("MOBILE_PUBLIC_SHARE_EXPLICIT_CONSENT=PASS");
console.log("MOBILE_PUBLIC_SHARE_CANONICAL_URL=PASS");
console.log("MOBILE_PUBLIC_SHARE_OS_SHEET=PASS");
console.log("MOBILE_PUBLIC_SHARE_PREMIUM_EXCLUDED=PASS");
console.log("MOBILE_PUBLIC_SHARE_DEEP_LINK_EXCLUDED=PASS");
console.log("MOBILE_PUBLIC_SHARE_M8_SEPARATION=PASS");
console.log("MOBILE_PUBLIC_SHARE_CAMERA_REGRESSION=PASS");
console.log("MOBILE_9_NATIVE_FREE_PUBLIC_SHARE=PASS");
