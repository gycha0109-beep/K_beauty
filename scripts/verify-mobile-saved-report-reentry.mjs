import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(label) {
  console.error(`MOBILE_8_SAVED_REPORT_REENTRY=FAIL ${label}`);
  process.exit(1);
}

function assert(condition, label) {
  if (!condition) fail(label);
}

const client = read("apps/mobile/features/reports/saved-report-client.ts");
const renderer = read("apps/mobile/features/reports/NativeSavedReport.tsx");
const screen = read("apps/mobile/app/saved-report.tsx");
const layout = read("apps/mobile/app/_layout.tsx");
const analyzeScreen = read("apps/mobile/app/analyze.tsx");
const dashboardClient = read("apps/mobile/lib/my.ts");
const dashboardServer = read("lib/my/dashboard.js");
const resultRoute = read("app/api/results/[shareId]/route.js");
const resultGuard = read("lib/security/public-result-read-guard.js");
const fullReportRoute = read("app/api/full-report/route.js");
const premiumContext = read("lib/premium-route-context.js");
const premiumPrincipal = read("lib/premium-route-principal.js");
const androidSmoke = read("scripts/verify-mobile-android-smoke.sh");

assert(layout.includes('name="saved-report"'), "hidden-saved-report-route");
assert(layout.includes('href: null'), "saved-report-hidden-from-tabs");
assert(layout.includes('testID="mobile-my-latest-report"'), "my-entry-test-id");
assert(layout.includes('router.push("/saved-report")'), "my-entry-route");

assert(screen.includes('testID="native-saved-report-state"'), "saved-report-state-marker");
assert(screen.includes('testID="native-saved-report-back"'), "saved-report-back-marker");
assert(screen.includes("loadLatestNativeSavedReport"), "saved-report-loader-wiring");
assert(renderer.includes('testID="native-saved-report"'), "saved-report-render-marker");
assert(renderer.includes('testID="native-saved-report-summary"'), "saved-report-summary-marker");
assert(renderer.includes('testID="native-saved-report-top-pick"'), "saved-report-top-pick-marker");

assert(client.includes("fetchNativeMyDashboard(session)"), "dashboard-authority-read");
assert(dashboardClient.includes('`${getMobileApiBaseUrl()}/api/my/dashboard?${query.toString()}`'), "dashboard-existing-endpoint");
assert(dashboardServer.includes("latestSavedReport"), "server-latest-saved-report");
assert(dashboardServer.includes("latestSharePath: getLatestReportPath(latestSavedReport)"), "server-latest-share-path");
assert(dashboardServer.includes('report.report_type === "premium"'), "server-premium-report-path");
assert(dashboardServer.includes('report.report_type === "free"'), "server-free-report-path");

assert(client.includes('`${getMobileApiBaseUrl()}/api/results/${encodeURIComponent(shareId)}`'), "free-reentry-endpoint");
assert(client.includes('`${getMobileApiBaseUrl()}/api/full-report`'), "premium-reentry-endpoint");
assert(client.includes("savedReportId: metadata.id"), "premium-saved-report-id-only");
assert(client.includes('payload?.meta?.source !== "saved-report"'), "premium-snapshot-source-guard");
assert(client.includes('Authorization: `Bearer ${session.access_token}`'), "native-bearer-auth");
assert((client.match(/credentials: "include"/g) || []).length >= 2, "cookie-continuity-read-paths");
assert(!client.includes("publicShared"), "reentry-client-no-publication-response");
assert(!client.includes("share: true"), "reentry-client-no-publication-mutation");

assert(resultRoute.includes("guardPublicResultRead"), "free-read-guard");
assert(resultRoute.includes("readAnalysisResultForShare"), "free-read-existing-authority");
assert(resultGuard.includes("resolveAnalysisGuardPrincipal"), "free-read-native-principal");
assert(fullReportRoute.includes("if (body?.savedReportId)"), "premium-existing-reentry-branch");
assert(fullReportRoute.includes("loadSavedPremiumReport"), "premium-owner-snapshot-read");
assert(fullReportRoute.includes('"saved-report"'), "premium-saved-report-response-source");
assert(premiumContext.includes("getBearerToken(request)"), "premium-bearer-token-read");
assert(premiumContext.includes("createRouteSupabaseAuthClient(bearerToken)"), "premium-bearer-auth-client");
assert(premiumContext.includes("selectPremiumRoutePrincipal"), "premium-principal-selector");
assert(premiumPrincipal.includes('authSource: "bearer"'), "premium-bearer-principal-selection");
assert(premiumPrincipal.includes("principalAligned: true"), "premium-principal-alignment");

for (const forbidden of [
  "/api/analyze",
  "/api/my/save-report",
  "/api/my/saved-reports",
  "/api/premium/access",
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
  assert(!client.includes(forbidden), `reentry-client-forbidden:${forbidden}`);
}

const boundedMobileSources = [client, renderer, screen].join("\n");
for (const forbidden of [
  "createSupabaseAdminClient",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "@/lib/skin-match-decision-engine",
  "@/lib/premium-decision-state",
  "@/lib/product-source",
  "from \"server-only\""
]) {
  assert(!boundedMobileSources.includes(forbidden), `mobile-authority-forbidden:${forbidden}`);
}

assert(androidSmoke.includes('wait_for_text "Saved report"'), "android-my-saved-report-entry");
assert(androidSmoke.includes('tap_text "Saved report"'), "android-saved-report-route-action");
assert(androidSmoke.includes('wait_for_text "Sign in on My to reopen a saved report."'), "android-signed-out-boundary");
assert(androidSmoke.includes('saved-report-signed-out-en.png'), "android-saved-report-screenshot");
assert(androidSmoke.includes("MOBILE_ANDROID_SAVED_REPORT_ROUTE_SMOKE=PASS"), "android-saved-report-smoke-marker");
assert(analyzeScreen.includes("onPhotoChange={setCapturedPhoto}"), "mobile5-camera-regression-contract");
assert(!boundedMobileSources.includes("normalizeSurveyAnswers"), "no-survey-recompute");
assert(!boundedMobileSources.includes("submitNativeAnalysis"), "no-analysis-recompute");

console.log("MOBILE_SAVED_REPORT_SERVER_AUTHORITY=PASS");
console.log("MOBILE_SAVED_REPORT_FREE_REENTRY=PASS");
console.log("MOBILE_SAVED_REPORT_PREMIUM_REENTRY=PASS");
console.log("MOBILE_SAVED_REPORT_AUTH_BOUNDARY=PASS");
console.log("MOBILE_SAVED_REPORT_REENTRY_CLIENT_READ_ONLY=PASS");
console.log("MOBILE_SAVED_REPORT_READ_ONLY_BOUNDARY=PASS");
console.log("MOBILE_SAVED_REPORT_NATIVE_ROUTE=PASS");
console.log("MOBILE_SAVED_REPORT_ANDROID_ROUTE_SMOKE=PASS");
console.log("MOBILE_SAVED_REPORT_NO_RECOMPUTE=PASS");
console.log("MOBILE_SAVED_REPORT_CAMERA_REGRESSION=PASS");
console.log("MOBILE_8_SAVED_REPORT_REENTRY=PASS");
