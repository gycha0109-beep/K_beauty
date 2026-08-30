import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fail(label) {
  console.error(`MOBILE_11_PREMIUM_ENTRY=FAIL ${label}`);
  process.exit(1);
}

function assert(condition, label) {
  if (!condition) fail(label);
}

const layout = read("apps/mobile/app/_layout.tsx");
const analyzeScreen = read("apps/mobile/app/analyze.tsx");
const analyzeResult = read("apps/mobile/features/analyze/NativeAnalyzeResult.tsx");
const premiumScreen = read("apps/mobile/app/premium.tsx");
const premiumClient = read("apps/mobile/features/premium/premium-client.ts");
const currentProductsSelector = read("apps/mobile/features/premium/NativeCurrentProductsSelector.tsx");
const savedReportClient = read("apps/mobile/features/reports/saved-report-client.ts");
const accessRoute = read("app/api/premium/access/route.js");
const premiumAccess = read("lib/premium-access.js");
const analyzeRoute = read("app/api/analyze/route.js");
const fullReportRoute = read("app/api/full-report/route.js");
const currentProductsRoute = read("app/api/current-products/products/route.js");
const currentProductsAuthority = read("lib/current-products.js");
const architecture = read("docs/architecture/mobile-11-native-premium-beta-entry.md");
const androidSmoke = read("scripts/verify-mobile-android-smoke.sh");

assert(layout.includes('name="premium" options={{ href: null'), "hidden-premium-route");
assert(analyzeResult.includes('testID="native-analyze-premium-entry"'), "free-result-premium-entry-marker");
assert(analyzeResult.includes("onOpenPremium"), "free-result-premium-callback");
assert(analyzeScreen.includes('onOpenPremium={() => router.push("/premium")}'), "premium-route-navigation");
assert(analyzeScreen.includes("onPhotoChange={setCapturedPhoto}"), "mobile5-camera-regression-contract");

assert(premiumScreen.includes("getNativeSession()"), "native-session-presence-check");
assert(premiumScreen.includes('status: "signed-out"'), "signed-out-local-gate");
assert(premiumScreen.includes("Sign in on My to create a premium report."), "signed-out-runtime-copy");
assert(premiumScreen.includes("loadNativePremiumAccess"), "server-access-loader-wiring");
assert(premiumScreen.includes("createNativePremiumReport"), "server-finalization-wiring");
assert(premiumScreen.includes("NativeCurrentProductsSelector"), "current-products-selector-wiring");
assert(premiumScreen.includes('router.replace("/saved-report")'), "mobile8-private-reentry-after-finalize");
assert(premiumScreen.includes("This mobile slice does not add or change a payment flow."), "payment-boundary-copy");
assert(premiumScreen.includes('testID="native-premium-create"'), "premium-create-marker");
assert(premiumScreen.includes('testID="native-premium-state"'), "premium-state-marker");

assert(premiumClient.includes('`${getMobileApiBaseUrl()}/api/premium/access`'), "existing-premium-access-endpoint");
assert(premiumClient.includes('method: "GET"'), "access-get-method");
assert(premiumClient.includes('Authorization: `Bearer ${session.access_token}`'), "access-bearer");
assert(premiumClient.includes('credentials: "include"'), "premium-cookie-continuity");
assert(premiumClient.includes('/api/current-products/products?category='), "existing-current-products-read-endpoint");
assert(premiumClient.includes('`${getMobileApiBaseUrl()}/api/full-report`'), "existing-full-report-endpoint");
assert(premiumClient.includes('method: "POST"'), "full-report-post-method");
assert(premiumClient.includes('"Content-Type": "application/json"'), "full-report-json-content");
assert(premiumClient.includes("locale: input.locale"), "full-report-locale-only-context");
assert(premiumClient.includes("currentProducts: input.currentProducts"), "full-report-current-products-context");
assert(premiumClient.includes('source !== "premium-session" && source !== "saved-report"'), "full-report-source-guard");
assert(premiumClient.includes("payload?.meta?.persistence?.savedReportId"), "saved-report-id-required");

for (const status of ["selected", "not_in_db", "not_using"]) {
  assert(premiumClient.includes(`"${status}"`), `current-product-status:${status}`);
  assert(currentProductsAuthority.includes(`"${status}"`), `server-current-product-status:${status}`);
}
for (const group of ["cleanser", "toner_essence", "treatment", "moisturizer", "sunscreen"]) {
  assert(premiumClient.includes(`"${group}"`), `current-product-group:${group}`);
}
assert(currentProductsSelector.includes("loadNativeCurrentProductOptions"), "selector-server-product-options");
assert(currentProductsSelector.includes('testID="native-premium-current-products"'), "selector-render-marker");

assert(accessRoute.includes("resolvePremiumAccessForRequest(request)"), "server-premium-access-authority");
assert(premiumAccess.includes("user.app_metadata"), "trusted-app-metadata-entitlement-authority");
assert(premiumAccess.includes('releaseMode === "beta_open"'), "server-beta-open-authority");
assert(premiumAccess.includes('reason: "payment_required"'), "server-payment-required-authority");
assert(premiumAccess.includes('reason: "premium_unavailable"'), "server-unavailable-authority");

assert(analyzeRoute.includes("canPreparePremiumReportSession(premiumAccess)"), "server-session-preparation-authority");
assert(analyzeRoute.includes("createPremiumReportSession("), "server-premium-session-creation");
assert(analyzeRoute.includes("response.cookies.set("), "server-premium-cookie-emission");
assert(analyzeRoute.includes("PREMIUM_REPORT_COOKIE"), "server-premium-cookie-name");
assert(fullReportRoute.includes("resolvePremiumRouteContext(request)"), "server-full-report-principal-authority");
assert(fullReportRoute.includes("if (!access.canCreatePremium)"), "server-full-report-access-recheck");
assert(fullReportRoute.includes("verifyPremiumReportSession(premiumCookie)"), "server-premium-session-verification");
assert(fullReportRoute.includes("applyCurrentProductsToReport"), "server-current-products-application");
assert(fullReportRoute.includes("persistPremiumSavedReport"), "server-private-persistence-authority");
assert(fullReportRoute.includes('.from("saved_reports")'), "server-saved-report-table-authority");
assert(fullReportRoute.includes('.insert(payload)'), "server-saved-report-insert-authority");
assert(currentProductsRoute.includes("fetchCurrentProductOptions"), "server-current-products-read-authority");

const boundedMobileSources = [
  analyzeScreen,
  analyzeResult,
  premiumScreen,
  premiumClient,
  currentProductsSelector
].join("\n");

for (const forbidden of [
  "PREMIUM_RELEASE_MODE",
  "premium_entitlement",
  "premiumEntitlement",
  "createSupabaseAdminClient",
  'from("saved_reports")',
  '.from("saved_reports")',
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "@/lib/premium-decision-state",
  "@/lib/skin-match-decision-engine",
  "@/lib/product-source",
  "payment-provider",
  "/api/checkout",
  "/api/payment",
  "from \"server-only\""
]) {
  assert(!boundedMobileSources.includes(forbidden), `forbidden-mobile-authority:${forbidden}`);
}

assert(!premiumClient.includes("/api/analyze"), "premium-client-does-not-recompute-analysis");
assert(!premiumClient.includes("saved_reports"), "premium-client-no-db-write");
assert(savedReportClient.includes('kind: "premium"'), "mobile8-premium-reentry-preserved");
assert(savedReportClient.includes('body: JSON.stringify({\n      savedReportId: metadata.id,\n      locale'), "mobile8-saved-report-contract-preserved");

assert(androidSmoke.includes('bejewely://premium'), "android-premium-custom-scheme-route");
assert(androidSmoke.includes('wait_for_text "Sign in on My to create a premium report."'), "android-premium-signed-out-state");
assert(androidSmoke.includes('premium-signed-out-en.png'), "android-premium-screenshot");
assert(androidSmoke.includes("MOBILE_ANDROID_PREMIUM_ROUTE_SMOKE=PASS"), "android-premium-smoke-marker");
assert(!androidSmoke.includes("/api/full-report"), "android-smoke-does-not-finalize-premium");

assert(architecture.includes("Authenticated Premium finalization"), "runtime-limitation-declared");
assert(architecture.includes("NOT OBSERVED"), "runtime-not-observed-contract");
assert(architecture.includes("Automated CI must never manufacture or mutate production Premium/account data."), "ci-no-production-mutation");
assert(architecture.includes("payment provider integration or checkout CTA"), "payment-out-of-scope");
assert(architecture.includes("HTTPS App Links / Universal Links / domain association"), "hosted-links-out-of-scope");

console.log("MOBILE_PREMIUM_HIDDEN_ROUTE=PASS");
console.log("MOBILE_PREMIUM_SERVER_ACCESS_AUTHORITY=PASS");
console.log("MOBILE_PREMIUM_SESSION_COOKIE_CONTINUITY=PASS");
console.log("MOBILE_PREMIUM_CURRENT_PRODUCTS_CONTEXT=PASS");
console.log("MOBILE_PREMIUM_PRIVATE_FINALIZATION=PASS");
console.log("MOBILE_PREMIUM_PAYMENT_AUTHORITY_EXCLUDED=PASS");
console.log("MOBILE_PREMIUM_ANDROID_SIGNED_OUT_SMOKE=PASS");
console.log("MOBILE_PREMIUM_M8_REENTRY=PASS");
console.log("MOBILE_PREMIUM_CAMERA_REGRESSION=PASS");
console.log("MOBILE_11_PREMIUM_ENTRY=PASS");
