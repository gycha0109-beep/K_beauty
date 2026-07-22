import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const middleware = read("middleware.js");
const browserAuth = read("lib/supabase/browser-client.js");
const premiumSession = read("lib/premium-report-session.js");
const fullReportRoute = read("app/api/full-report/route.js");
const fullReportPage = read("app/result/full-report/page.js");
const authCallback = read("app/auth/callback/route.js");
const loginButtons = read("components/auth/LoginButtons.jsx");

assert.match(middleware, /getCanonicalProductionRedirectUrl\(request\.url\)/);
assert.match(middleware, /NextResponse\.redirect\(canonicalUrl, 307\)/);
assert.match(browserAuth, /createBrowserSupabaseClient/);
assert.match(browserAuth, /cookieSession\?\.access_token/);
assert.match(fullReportRoute, /error: safeReason/);
assert.match(fullReportRoute, /getUnauthorizedResponse\("login_required"\)/);
assert.match(fullReportRoute, /getUnauthorizedResponse\("premium_session_missing_or_expired"\)/);
assert.match(fullReportPage, /data\?\.error === "login_required"/);
assert.match(fullReportPage, /<LoginButtons/);
assert.match(fullReportPage, /FULL_REPORT_AUTH_FAILURE_COPY/);
assert.match(authCallback, /exchangeCodeForSession\(code\)/);
assert.match(
  loginButtons,
  /redirectTo: `\$\{window\.location\.origin\}\/auth\/callback\?next=\$\{encodeURIComponent\(nextPath\)\}`/
);
assert.match(loginButtons, /typeof next === "string" && next\.startsWith\("\/"\) \? next : "\/my"/);
assert.doesNotMatch(loginButtons, /NEXT_PUBLIC_SITE_URL|k-beauty-two\.vercel\.app/);
assert.match(authCallback, /function getSafeRedirectPath\(value, origin\)/);
assert.match(authCallback, /value\.startsWith\("\/"\) && !value\.startsWith\("\/\/"\)/);

for (const requiredCookieOption of [
  'httpOnly: true',
  'sameSite: "lax"',
  'secure: process.env.NODE_ENV === "production"',
  'path: options.path || "/api/full-report"'
]) {
  assert.ok(
    premiumSession.includes(requiredCookieOption),
    `premium cookie contract changed: ${requiredCookieOption}`
  );
}

for (const forbiddenExposure of [
  "localStorage.setItem(PREMIUM_REPORT_COOKIE",
  "searchParams.set(PREMIUM_REPORT_COOKIE",
  "premiumSessionToken:"
]) {
  assert.ok(
    !fullReportPage.includes(forbiddenExposure) &&
      !fullReportRoute.includes(forbiddenExposure),
    `premium session exposure detected: ${forbiddenExposure}`
  );
}

console.log("full-report auth/origin contract verification passed");
