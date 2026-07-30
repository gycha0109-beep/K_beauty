import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const reentryModule = await import(
  pathToFileURL(resolve(root, "lib/premium-report-reentry.js")).href
);
const sessionRoute = read("app/api/full-report/session/route.js");
const resultPage = read("app/result/page.js");
const previewStep = read("components/result/free-v2/FreeResultV2PremiumPreviewStep.jsx");
const fullReportRoute = read("app/api/full-report/route.js");
const premiumSession = read("lib/premium-report-session.js");

function assertBefore(text, earlier, later, label) {
  const earlierIndex = text.indexOf(earlier);
  const laterIndex = text.indexOf(later);
  assert.ok(earlierIndex >= 0, `${label} is missing: ${earlier}`);
  assert.ok(laterIndex >= 0, `${label} is missing: ${later}`);
  assert.ok(earlierIndex < laterIndex, `${label} must keep ${earlier} before ${later}`);
}

const rotatedPayload = reentryModule.buildRotatedPremiumReportPayload({
  freeResult: { summary: "current analysis" },
  fullRoutine: { morning: ["base routine"] },
  faceLabSummary: { status: "available" },
  currentProducts: { selections: [{ productId: "old-product" }] },
  currentProductVerdicts: [{ status: "hold" }]
});

assert.deepEqual(rotatedPayload, {
  freeResult: { summary: "current analysis" },
  fullRoutine: { morning: ["base routine"] },
  faceLabSummary: { status: "available" }
});
assert.equal(reentryModule.buildRotatedPremiumReportPayload(null), null);

for (const requiredFragment of [
  'request.cookies.get(PREMIUM_REPORT_COOKIE)?.value',
  "verifyPremiumReportSession(premiumCookie, {",
  "userId: routeContext.user.id",
  '.eq("user_id", userId)',
  '.eq("report_type", "premium")',
  '.eq("source_type", "premium_report_session")',
  '.eq("source_session_id", sessionId)',
  '.not("premium_report", "is", null)',
  '.order("created_at", { ascending: false })',
  "createPremiumReportSession(",
  "{ userId: context.user.id }",
  "buildRotatedPremiumReportPayload",
  "getPremiumReportCookieOptions()",
  "resolvePremiumRouteContext(request)",
  'reason: "new_session_created"'
]) {
  assert.ok(sessionRoute.includes(requiredFragment), `missing current-session contract: ${requiredFragment}`);
}

assert.ok(!sessionRoute.includes(".update("), "session rotation must not update saved reports");
assert.ok(!sessionRoute.includes(".delete("), "session rotation must not delete saved reports");
for (const forbiddenResponseFragment of [
  "{ rotated: true, sessionId",
  "{ rotated: true, premiumSessionToken",
  "{ rotated: true, accessToken",
  "{ rotated: false, sessionId",
  "{ rotated: false, premiumSessionToken",
  "{ rotated: false, accessToken"
]) {
  assert.ok(!sessionRoute.includes(forbiddenResponseFragment), `re-entry response exposes sensitive data: ${forbiddenResponseFragment}`);
}

for (const requiredFragment of [
  'fetch("/api/full-report/session"',
  "savedReportId=${encodeURIComponent(premiumSavedReportId)}",
  "data?.rotated !== true",
  "router.push(targetPath)",
  'isSavedReportChecking={premiumSavedReportStatus === "checking"}'
]) {
  assert.ok(resultPage.includes(requiredFragment), `missing result-page re-entry flow: ${requiredFragment}`);
}

const openSavedHandler = resultPage.slice(
  resultPage.indexOf("const openSavedFullReport"),
  resultPage.indexOf("const startNewFullReport")
);
const newFullReportHandler = resultPage.slice(
  resultPage.indexOf("const startNewFullReport"),
  resultPage.indexOf("const handleTryAgainClick")
);
assert.ok(!openSavedHandler.includes('fetch("/api/full-report/session"'), "reopen must not rotate a session");
assert.ok(!openSavedHandler.includes('fetch("/api/full-report"'), "reopen must not start full-report generation");
assert.ok(newFullReportHandler.includes('method: "POST"'), "new-report flow must explicitly request session rotation");

for (const requiredFragment of [
  "완성된 Skin Match 플랜이 있어요",
  "풀리포트 다시 보기",
  "새 풀리포트 만들기",
  "onSavedReportClick",
  "onNewPremiumClick"
]) {
  assert.ok(previewStep.includes(requiredFragment), `missing re-entry CTA: ${requiredFragment}`);
}

assert.ok(fullReportRoute.includes('.eq("id", savedReportId)'), "saved report read must remain ID-scoped");
assert.ok(fullReportRoute.includes('.eq("user_id", userId)'), "saved report read must retain user ownership verification");
assertBefore(
  fullReportRoute,
  "if (body?.savedReportId)",
  "const currentProductsResult = await applyCurrentProductsToReport",
  "saved-report re-read"
);
assert.ok(!fullReportRoute.includes("body?.topPick || savedFreeResult?.topPick"), "saved report reentry must ignore request topPick");
assert.ok(fullReportRoute.includes("savedFreeResult?.topPick || null"), "saved report gauges must derive from the stored snapshot");

for (const requiredCookieOption of [
  "httpOnly: true",
  'sameSite: "lax"',
  'secure: process.env.NODE_ENV === "production"',
  'path: options.path || "/api/full-report"'
]) {
  assert.ok(premiumSession.includes(requiredCookieOption), `premium cookie contract changed: ${requiredCookieOption}`);
}

console.log("premium report re-entry contract verification passed");
