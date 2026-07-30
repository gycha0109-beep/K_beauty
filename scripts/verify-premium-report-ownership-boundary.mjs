import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), "utf8");

const fullReportRoute = read("app/api/full-report/route.js");
const fullReportPage = read("app/result/full-report/page.js");
const dashboard = read("lib/my/dashboard.js");
const dashboardRoute = read("app/api/my/dashboard/route.js");
const browserClient = read("lib/supabase/browser-client.js");
const middlewareClient = read("lib/supabase/middleware.js");
const migrationName = readdirSync(resolve(root, "supabase/migrations")).find(
  (entry) => entry.includes("restrict_anonymous_user_data_policies") && entry.endsWith(".sql")
);

assert.ok(migrationName, "saved-report RLS migration is missing");
const rlsMigration = read(`supabase/migrations/${migrationName}`);

const savedReportLookupStart = fullReportRoute.indexOf("async function loadSavedPremiumReport(");
const savedReportLookupEnd = fullReportRoute.indexOf(
  "async function loadSavedPremiumReportForSession(",
  savedReportLookupStart
);
assert.ok(
  savedReportLookupStart >= 0 && savedReportLookupEnd > savedReportLookupStart,
  "saved premium report lookup could not be isolated"
);
const savedReportLookup = fullReportRoute.slice(savedReportLookupStart, savedReportLookupEnd);

for (const fragment of [
  '.eq("id", savedReportId)',
  '.eq("user_id", userId)',
  '.eq("report_type", "premium")',
  ".maybeSingle()"
]) {
  assert.ok(savedReportLookup.includes(fragment), `saved-report lookup is missing ${fragment}`);
}
assert.ok(
  !savedReportLookup.includes("createSupabaseAdminClient"),
  "saved-report reads must use the authenticated user client"
);

for (const fragment of [
  "resolvePremiumRouteContext(request)",
  "isAccountUser(user)",
  "userId: user.id",
  "savedReportId: String(body.savedReportId)"
]) {
  assert.ok(fullReportRoute.includes(fragment), `full-report ownership boundary is missing ${fragment}`);
}

assert.ok(
  fullReportPage.includes('fetch("/api/full-report"'),
  "full-report page must use the protected full-report route"
);
assert.ok(
  fullReportPage.includes("getBrowserPermanentSupabaseAccessToken"),
  "saved-report requests must use the permanent-account token path"
);

for (const fragment of [
  '.eq("user_id", user.id)',
  "latestSavedReport",
  "getLatestReportPath(latestSavedReport)"
]) {
  assert.ok(dashboard.includes(fragment), `dashboard ownership boundary is missing ${fragment}`);
}

assert.ok(
  dashboardRoute.includes("createNoStoreHeaders"),
  "dashboard responses must use the shared no-store contract"
);
assert.ok(browserClient.includes("createBrowserSupabaseClient()"));
for (const forbidden of ["createClient(", "window.localStorage", "storageKey"]) {
  assert.ok(!browserClient.includes(forbidden), `duplicate browser auth storage remains: ${forbidden}`);
}
assert.ok(middlewareClient.includes("setAll(cookiesToSet, headersToSet = {})"));
assert.ok(middlewareClient.includes("response.headers.set(name, value)"));
assert.ok(rlsMigration.includes('create policy "Users can read own saved reports"'));
assert.ok(rlsMigration.includes("auth.uid() = user_id"));

console.log("premium report ownership boundary verification passed");
