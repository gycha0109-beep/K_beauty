import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = process.cwd();
const checkedFiles = [];
const deploymentVerification = [];
const notes = [];

function pathFromRoot(path) {
  return resolve(root, path);
}

function read(path) {
  const absolutePath = pathFromRoot(path);
  checkedFiles.push(path);
  return readFileSync(absolutePath, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(text, pattern, label) {
  assert(text.includes(pattern), `${label} missing: ${pattern}`);
}

function assertNotIncludes(text, pattern, label) {
  assert(!text.includes(pattern), `${label} unexpectedly contains: ${pattern}`);
}

function listFiles(dir, predicate = () => true) {
  const absoluteDir = pathFromRoot(dir);

  if (!existsSync(absoluteDir)) {
    return [];
  }

  return readdirSync(absoluteDir).flatMap((entry) => {
    const absoluteEntry = join(absoluteDir, entry);
    const relativeEntry = join(dir, entry).replaceAll("\\", "/");
    const stats = statSync(absoluteEntry);

    if (stats.isDirectory()) {
      return listFiles(relativeEntry, predicate);
    }

    return predicate(relativeEntry) ? [relativeEntry] : [];
  });
}

function findMigration(namePart) {
  const migrations = listFiles("supabase/migrations", (path) => path.endsWith(".sql"));
  return migrations.find((path) => path.includes(namePart)) || null;
}

function hasBroadPolicyForTable(sql, tableName) {
  const escapedTable = tableName.replace(".", "\\.");
  const policyPattern = new RegExp(
    `create\\s+policy[\\s\\S]{0,500}on\\s+${escapedTable}[\\s\\S]{0,500}(using\\s*\\(\\s*true\\s*\\)|with\\s+check\\s*\\(\\s*true\\s*\\))`,
    "i"
  );

  return policyPattern.test(sql);
}

function hasBroadGrantForTable(sql, tableName) {
  const escapedTable = tableName.replace(".", "\\.");
  const grantPattern = new RegExp(
    `grant\\s+(all|select|insert|update|delete|truncate|references|trigger|[\\s,]+)+\\s+on\\s+table\\s+${escapedTable}\\s+to\\s+(anon|authenticated|public)\\b`,
    "i"
  );

  return grantPattern.test(sql);
}

const analysisMigrationPath = findMigration("align_analysis_results_share_schema");
assert(analysisMigrationPath, "analysis results migration should exist");
const analysisMigration = read(analysisMigrationPath);

[
  "create table if not exists public.analysis_requests",
  "create table if not exists public.analysis_results",
  "survey_json jsonb",
  "result_json jsonb",
  "user_id uuid",
  "image_url text",
  "share_id text",
  "is_public boolean not null default false"
].forEach((pattern) => assertIncludes(analysisMigration, pattern, "analysis migration"));

if (
  !analysisMigration.includes("alter table public.analysis_requests enable row level security") ||
  !analysisMigration.includes("alter table public.analysis_results enable row level security")
) {
  deploymentVerification.push(
    "analysis_requests/analysis_results RLS is not self-contained in the repository migration; verify deployed metadata before writing any correction migration."
  );
}

["public.analysis_requests", "public.analysis_results"].forEach((tableName) => {
  assert(
    !hasBroadPolicyForTable(analysisMigration, tableName),
    `${tableName} should not have a broad true policy in analysis migration`
  );
  assert(
    !hasBroadGrantForTable(analysisMigration, tableName),
    `${tableName} should not grant broad browser-role privileges in analysis migration`
  );
});

const revisitMigrationPath = findMigration("add_revisit_core_tables");
assert(revisitMigrationPath, "revisit core table migration should exist");
const revisitMigration = read(revisitMigrationPath);

[
  "alter table public.skin_profiles enable row level security",
  "alter table public.saved_reports enable row level security",
  "alter table public.daily_checkins enable row level security",
  "alter table public.routine_logs enable row level security",
  "revoke all on table public.skin_profiles from anon",
  "revoke all on table public.saved_reports from anon",
  "revoke all on table public.daily_checkins from anon",
  "revoke all on table public.routine_logs from anon",
  "grant select, insert, update, delete on table public.skin_profiles to authenticated",
  "grant select, insert, update, delete on table public.saved_reports to authenticated",
  "grant select, insert, update, delete on table public.daily_checkins to authenticated",
  "grant select, insert, update, delete on table public.routine_logs to authenticated"
].forEach((pattern) => assertIncludes(revisitMigration, pattern, "revisit migration"));

const anonymousRestrictionPath = findMigration("restrict_anonymous_user_data_policies");
assert(anonymousRestrictionPath, "anonymous user restriction migration should exist");
const anonymousRestriction = read(anonymousRestrictionPath);

[
  "auth.uid() = user_id",
  "is_anonymous",
  "Users can read own skin profiles",
  "Users can read own saved reports",
  "Users can read own daily checkins",
  "Users can read own routine logs"
].forEach((pattern) => assertIncludes(anonymousRestriction, pattern, "anonymous restriction migration"));

const premiumSessionMigrationPath = findMigration("create_premium_report_sessions");
assert(premiumSessionMigrationPath, "premium report session migration should exist");
const premiumSessionMigration = read(premiumSessionMigrationPath);

[
  "create table if not exists public.premium_report_sessions",
  "premium_report jsonb not null",
  "alter table public.premium_report_sessions enable row level security"
].forEach((pattern) => assertIncludes(premiumSessionMigration, pattern, "premium session migration"));

const guardMigrationPath = findMigration("sec_01_analysis_request_guard");
if (guardMigrationPath) {
  const guardMigration = read(guardMigrationPath);
  [
    "alter table public.analysis_request_rate_windows enable row level security",
    "alter table public.analysis_request_idempotency enable row level security",
    "revoke all on table public.analysis_request_rate_windows from anon, authenticated",
    "revoke all on table public.analysis_request_idempotency from anon, authenticated",
    "grant select, insert, update, delete on table public.analysis_request_rate_windows to service_role",
    "grant select, insert, update, delete on table public.analysis_request_idempotency to service_role",
    "set search_path = public",
    "revoke all on function public.consume_analysis_rate_limits(jsonb) from public",
    "grant execute on function public.consume_analysis_rate_limits(jsonb) to service_role"
  ].forEach((pattern) => assertIncludes(guardMigration, pattern, "SEC-01 guard migration"));
  deploymentVerification.push(
    "SEC-01 guard migration exists in the repository; verify that the target Supabase environment has applied it before relying on guard tables/RPCs."
  );
} else {
  deploymentVerification.push("SEC-01 guard migration is not present in this checkout.");
}

const allMigrationSql = listFiles("supabase/migrations", (path) => path.endsWith(".sql"))
  .map((path) => read(path))
  .join("\n");

["public.analysis_requests", "public.analysis_results"].forEach((tableName) => {
  assert(
    !hasBroadPolicyForTable(allMigrationSql, tableName),
    `${tableName} should not have broad true policies in migrations`
  );
  assert(
    !hasBroadGrantForTable(allMigrationSql, tableName),
    `${tableName} should not grant broad browser-role privileges in migrations`
  );
});

assert(
  !/grant\s+execute\s+on\s+function\s+public\.[^(;\n]*analysis[^(;\n]*\([^;]*\)\s+to\s+(public|anon|authenticated)\b/i.test(allMigrationSql),
  "analysis-related privileged functions should not grant execute to public/anon/authenticated"
);

const shareHelper = read("lib/analysis-result-access.js");
[
  "createSupabaseAdminClient",
  '.from("analysis_results")',
  '.eq("share_id", shareId)',
  "if (!data.is_public)",
  "currentUser.id !== data.user_id"
].forEach((pattern) => assertIncludes(shareHelper, pattern, "share access helper"));

const publicResultApi = read("app/api/results/[shareId]/route.js");
assertIncludes(publicResultApi, "getAnalysisResultForShare({ shareId, request })", "public result API");

const resultsRoute = read("app/api/results/route.js");
[
  "verifyWriteAccessToken",
  "createSupabaseAdminClient",
  '.from("analysis_requests")',
  '.from("analysis_results")',
  '.eq("share_id", shareId)',
  '.eq("user_id", userId)',
  "resolvedUserId"
].forEach((pattern) => assertIncludes(resultsRoute, pattern, "results save route"));

const saveReportRoute = read("app/api/my/save-report/route.js");
[
  "!isAccountUser(user)",
  "userId: user.id",
  '.from("skin_profiles")',
  '.from("saved_reports")',
  "createPrivateShareResult",
  "isPublic: false"
].forEach((pattern) => assertIncludes(saveReportRoute, pattern, "my save report route"));

const fullReportRoute = read("app/api/full-report/route.js");
[
  "loadSavedPremiumReport",
  '.eq("id", savedReportId)',
  '.eq("user_id", userId)',
  '.eq("report_type", "premium")',
  "isAccountUser(user)"
].forEach((pattern) => assertIncludes(fullReportRoute, pattern, "full report route"));

const checkInRoute = read("app/api/my/check-in/route.js");
[
  ".auth.getUser()",
  '.eq("user_id", user.id)',
  "user_id: user.id",
  '.from("daily_checkins")',
  '.from("routine_logs")'
].forEach((pattern) => assertIncludes(checkInRoute, pattern, "my check-in route"));

const dashboard = read("lib/my/dashboard.js");
[
  ".auth.getUser()",
  '.from("skin_profiles")',
  '.from("saved_reports")',
  '.from("daily_checkins")',
  '.from("routine_logs")',
  '.eq("user_id", user.id)'
].forEach((pattern) => assertIncludes(dashboard, pattern, "my dashboard"));

const appAndLibFiles = [
  ...listFiles("app", (path) => /\.(js|jsx|ts|tsx|mjs)$/.test(path)),
  ...listFiles("lib", (path) => /\.(js|jsx|ts|tsx|mjs)$/.test(path))
];
const storageReferences = appAndLibFiles.filter((path) => {
  const content = read(path);
  return /storage\.from|createSignedUrl|getPublicUrl|\.upload\(/.test(content);
});

if (storageReferences.length === 0) {
  notes.push("No Supabase Storage upload/read path was found in app/lib for analysis images.");
  deploymentVerification.push(
    "No current analysis Storage bucket path was found; if a face-image bucket is introduced, verify private bucket and storage.objects policies before release."
  );
} else {
  deploymentVerification.push(
    `Supabase Storage usage was found and must be manually reviewed: ${storageReferences.join(", ")}`
  );
}

const report = {
  status: "passed",
  checkedFiles: [...new Set(checkedFiles)].sort(),
  confirmedFindings: 0,
  likelyFindings: 0,
  deploymentVerification,
  notes
};

console.log(JSON.stringify(report, null, 2));
