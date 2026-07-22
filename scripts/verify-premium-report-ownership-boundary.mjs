import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const accessModule = await import(
  pathToFileURL(path.join(root, "lib/premium-saved-report-access.js")).href
);

const ownerId = "owner-user";
const otherId = "other-user";
const reportId = "premium-report";
const paidAccess = { entitlement: "paid" };
const noAccess = { entitlement: "none" };
const ownedReport = {
  id: reportId,
  user_id: ownerId,
  report_type: "premium",
  premium_report: { freeResult: {}, fullRoutine: {} }
};

assert.equal(
  accessModule.canReadSavedPremiumReport({
    access: paidAccess,
    report: ownedReport,
    requestedReportId: reportId,
    userId: ownerId
  }),
  true,
  "an entitled owner must be able to read the saved premium report"
);

for (const [label, input] of [
  ["different owner", { access: paidAccess, report: ownedReport, requestedReportId: reportId, userId: otherId }],
  ["missing entitlement", { access: noAccess, report: ownedReport, requestedReportId: reportId, userId: ownerId }],
  ["anonymous", { access: noAccess, report: ownedReport, requestedReportId: reportId, userId: null }],
  ["missing report", { access: paidAccess, report: null, requestedReportId: reportId, userId: ownerId }],
  ["different id", { access: paidAccess, report: ownedReport, requestedReportId: "other-report", userId: ownerId }],
  ["non-premium row", { access: paidAccess, report: { ...ownedReport, report_type: "free" }, requestedReportId: reportId, userId: ownerId }],
  ["missing payload", { access: paidAccess, report: { ...ownedReport, premium_report: null }, requestedReportId: reportId, userId: ownerId }]
]) {
  assert.equal(
    accessModule.canReadSavedPremiumReport(input),
    false,
    `${label} must fail closed`
  );
}

const fullReportRoute = read("app/api/full-report/route.js");
const fullReportPage = read("app/result/full-report/page.js");
const dashboard = read("lib/my/dashboard.js");
const dashboardRoute = read("app/api/my/dashboard/route.js");
const browserClient = read("lib/supabase/browser-client.js");
const middlewareClient = read("lib/supabase/middleware.js");
const rlsMigration = read("supabase/migrations/20260531123349_restrict_anonymous_user_data_policies.sql");

for (const fragment of [
  'export const dynamic = "force-dynamic"',
  'export const fetchCache = "force-no-store"',
  '"Cache-Control": "private, no-store, max-age=0, must-revalidate"',
  'Vary: "Cookie, Authorization"',
  '.select("id, user_id, report_type, report_version, premium_report, free_result, face_lab, created_at")',
  '.eq("id", savedReportId)',
  '.eq("user_id", userId)',
  '.eq("report_type", "premium")',
  '.not("premium_report", "is", null)',
  "canReadSavedPremiumReport({",
  'error: "premium_report_not_found"',
  '{ status: 404 }'
]) {
  assert.ok(fullReportRoute.includes(fragment), `full-report boundary is missing ${fragment}`);
}

assert.ok(
  fullReportRoute.indexOf("if (!hasSavedPremiumReportEntitlement(access))") <
    fullReportRoute.indexOf("const { data: savedReport, error } = await loadSavedPremiumReport"),
  "entitlement must be checked before reading a saved premium report"
);
assert.ok(!fullReportRoute.includes("createSupabaseAdminClient"), "saved reports must not use service-role reads");

for (const fragment of ['cache: "no-store"', 'credentials: "same-origin"']) {
  assert.ok(fullReportPage.includes(fragment), `full-report fetch is missing ${fragment}`);
}
assert.ok(
  !fullReportPage.includes("getBrowserSupabaseAccessToken"),
  "full-report reads must not select a principal from a second browser auth store"
);

assert.ok(browserClient.includes("createBrowserSupabaseClient()"));
for (const forbidden of ["createClient(", "window.localStorage", "storageKey"]) {
  assert.ok(!browserClient.includes(forbidden), `duplicate browser auth storage remains: ${forbidden}`);
}

for (const fragment of [
  "resolvePremiumAccessForUser(user)",
  "hasSavedPremiumReportEntitlement(premiumAccess)",
  "latestSavedReport: visibleLatestSavedReport"
]) {
  assert.ok(dashboard.includes(fragment), `dashboard boundary is missing ${fragment}`);
}

for (const fragment of [
  '"Cache-Control": "private, no-store, max-age=0, must-revalidate"',
  'Vary: "Cookie"'
]) {
  assert.ok(dashboardRoute.includes(fragment), `dashboard cache isolation is missing ${fragment}`);
}

assert.ok(middlewareClient.includes("setAll(cookiesToSet, headersToSet = {})"));
assert.ok(middlewareClient.includes("response.headers.set(name, value)"));
assert.ok(rlsMigration.includes('create policy "Users can read own saved reports"'));
assert.ok(rlsMigration.includes("auth.uid() = user_id"));

console.log("premium report ownership boundary verification passed");
