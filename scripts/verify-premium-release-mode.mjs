import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertBefore(text, earlier, later, label) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);

  assert(earlierIndex >= 0, `${label} missing earlier marker: ${earlier}`);
  assert(laterIndex >= 0, `${label} missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, `${label} expected ${earlier} before ${later}`);
}

async function loadPremiumAccessPureModule() {
  const source = read("lib/premium-access.js");
  const authBoundary = source.indexOf("function getBearerToken");
  assert(authBoundary > 0, "premium access auth boundary missing");

  const pureSource = source
    .slice(0, authBoundary)
    .replace(/^import .*?;\r?\n/gm, "");
  const encoded = Buffer.from(pureSource, "utf8").toString("base64");

  return import(`data:text/javascript;base64,${encoded}`);
}

const premiumAccess = await loadPremiumAccessPureModule();
const accountUser = { is_anonymous: false, app_metadata: {} };
const paidUser = {
  is_anonymous: false,
  app_metadata: { premium_entitlement: "paid" }
};

const originalReleaseMode = process.env.PREMIUM_RELEASE_MODE;
try {
  delete process.env.PREMIUM_RELEASE_MODE;
  const missingModeAccess = premiumAccess.resolvePremiumAccessForUser(accountUser);
  assert(!missingModeAccess.canCreatePremium, "missing environment mode should block premium creation");
  assert(missingModeAccess.reason === "premium_unavailable", "missing environment mode should not become beta_open");
} finally {
  if (originalReleaseMode === undefined) {
    delete process.env.PREMIUM_RELEASE_MODE;
  } else {
    process.env.PREMIUM_RELEASE_MODE = originalReleaseMode;
  }
}

[undefined, null, "", "   ", "unexpected_mode"].forEach((raw) => {
  const config = premiumAccess.resolvePremiumReleaseMode(raw);
  assert(config.releaseMode === "coming_soon", "invalid release mode should close premium access");
  assert(config.configurationInvalid, "invalid release mode should be marked invalid");
});

const comingSoon = premiumAccess.resolvePremiumAccessForUser(accountUser, {
  releaseMode: "coming_soon"
});
assert(!comingSoon.canCreatePremium, "coming_soon should block premium creation");
assert(comingSoon.reason === "premium_unavailable", "coming_soon should return premium_unavailable");

const betaOpen = premiumAccess.resolvePremiumAccessForUser(accountUser, {
  releaseMode: "beta_open"
});
assert(betaOpen.canCreatePremium, "beta_open should preserve account-user access");
assert(betaOpen.reason === "beta_open", "beta_open reason should be preserved");

const paidWithoutEntitlement = premiumAccess.resolvePremiumAccessForUser(accountUser, {
  releaseMode: "paid_only"
});
assert(!paidWithoutEntitlement.canCreatePremium, "paid_only should block users without entitlement");
assert(paidWithoutEntitlement.reason === "payment_required", "paid_only should preserve payment_required");

const paidWithEntitlement = premiumAccess.resolvePremiumAccessForUser(paidUser, {
  releaseMode: "paid_only"
});
assert(paidWithEntitlement.canCreatePremium, "paid_only should allow paid entitlement");
assert(paidWithEntitlement.reason === "paid", "paid entitlement reason should be preserved");

const invalidAccess = premiumAccess.resolvePremiumAccessForUser(accountUser, {
  releaseMode: "typo_mode"
});
assert(!invalidAccess.canCreatePremium, "unknown mode should block premium creation");
assert(invalidAccess.reason === "premium_unavailable", "unknown mode should not become beta_open");
assert(invalidAccess.configurationInvalid, "unknown mode should be marked invalid");
assert(!premiumAccess.canPreparePremiumReportSession(invalidAccess), "invalid mode should not create a premium session");
assert(!premiumAccess.canPreparePremiumReportSession(paidWithoutEntitlement), "paid_only without entitlement should not create a premium session");
assert(premiumAccess.canPreparePremiumReportSession(betaOpen), "beta_open should preserve premium session preparation");

const accessSource = read("lib/premium-access.js");
const fullReportRoute = read("app/api/full-report/route.js");
const analyzeRoute = read("app/api/analyze/route.js");
const resultPage = read("app/result/page.js");
const fullReportPage = read("app/result/full-report/page.js");
const fullReportPost = fullReportRoute.slice(fullReportRoute.indexOf("export async function POST"));
const premiumUnavailableResponse = fullReportRoute.slice(
  fullReportRoute.indexOf("function getPremiumUnavailableResponse"),
  fullReportRoute.indexOf("function getBearerToken")
);

assert(accessSource.includes('const RELEASE_MODES = new Set(["coming_soon", "beta_open", "paid_only"])'), "explicit release modes missing");
assert(accessSource.includes('console.warn("[premium-access] premium_release_mode_invalid")'), "sanitized invalid-mode log missing");
assert(!accessSource.includes('return RELEASE_MODES.has(raw) ? raw : "beta_open"'), "beta_open fail-open fallback remains");
assert(fullReportRoute.includes('error: "premium_unavailable"'), "full-report unavailable response missing");
assert(!premiumUnavailableResponse.includes("releaseMode"), "unavailable response must not expose release mode");
assertBefore(fullReportPost, 'if (access.reason === "premium_unavailable")', "const premiumSession = await verifyPremiumReportSession", "full-report fail-closed guard");

const analyzeSessionBlock = analyzeRoute.slice(analyzeRoute.indexOf("const premiumReport ="));
assertBefore(analyzeSessionBlock, "canPreparePremiumReportSession(premiumAccess)", "createPremiumReportSession({", "analyze premium session guard");
assert(resultPage.includes('setPremiumAvailability(access?.reason === "premium_unavailable" ? "unavailable" : "available")'), "result UI availability check missing");
assert(resultPage.includes('premiumAvailability={premiumAvailability}'), "result UI availability prop missing");
assert(fullReportPage.includes('accessReason === "premium_unavailable"'), "full-report unavailable UI route handling missing");
assert(fullReportPage.includes('data?.error === "premium_unavailable"'), "full-report 403 handling missing");
assert(!fullReportRoute.includes("body?.releaseMode"), "full-report must not accept client release mode");
assert(!analyzeRoute.includes("body?.releaseMode"), "analyze must not accept client release mode");

console.log("premium release mode verification passed");
