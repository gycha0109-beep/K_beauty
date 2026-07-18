import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const checkedFiles = [];

function read(path) {
  checkedFiles.push(path);
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(source, expected, label) {
  assert(source.includes(expected), `${label} missing: ${expected}`);
}

function assertNotIncludes(source, unexpected, label) {
  assert(!source.includes(unexpected), `${label} unexpectedly contains: ${unexpected}`);
}

function assertBefore(source, first, second, label) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  assert(firstIndex >= 0, `${label} first marker missing: ${first}`);
  assert(secondIndex >= 0, `${label} second marker missing: ${second}`);
  assert(firstIndex < secondIndex, `${label} order invalid: ${first} must precede ${second}`);
}

function findMigration(namePart) {
  const file = readdirSync(resolve(root, "supabase/migrations")).find(
    (entry) => entry.includes(namePart) && entry.endsWith(".sql")
  );
  assert(file, `migration missing: ${namePart}`);
  return `supabase/migrations/${file}`;
}

function verifyMigration(source) {
  [
    "begin;",
    "alter table public.saved_reports enable row level security",
    'drop policy if exists "Users can insert own saved reports" on public.saved_reports',
    'drop policy if exists "Users can update own saved reports" on public.saved_reports',
    'create policy "Users can insert own free saved reports"',
    'create policy "Users can update own free saved report titles"',
    "(select auth.uid()) = user_id",
    "coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false",
    "report_type = 'free'",
    "premium_report is null",
    "jsonb_typeof(free_result) = 'object'",
    "not (free_result ? 'premiumReport')",
    "not (free_result ? 'premium_report')",
    "source_type = 'share'",
    "source_session_id is not null",
    "btrim(source_session_id) <> ''",
    "revoke all on table public.saved_reports from authenticated",
    "grant select, insert, delete on table public.saved_reports to authenticated",
    "grant update (title) on table public.saved_reports to authenticated",
    "grant select, insert, update, delete on table public.saved_reports to service_role",
    "commit;"
  ].forEach((pattern) => assertIncludes(source, pattern, "SEC-06 migration"));

  assertNotIncludes(source, "update public.saved_reports set", "SEC-06 migration row preservation");
  assertNotIncludes(source, "delete from public.saved_reports", "SEC-06 migration row preservation");
  assertNotIncludes(source, "insert into public.saved_reports", "SEC-06 migration row preservation");
  assert(
    (source.match(/create policy "Users can insert own free saved reports"/g) || []).length === 1,
    "SEC-06 insert policy must be created exactly once"
  );
  assert(
    (source.match(/create policy "Users can update own free saved report titles"/g) || []).length === 1,
    "SEC-06 update policy must be created exactly once"
  );
}

function verifySaveRoute(source) {
  [
    'const FREE_REPORT_TYPE = "free"',
    'const FREE_REPORT_VERSION = "free-v1"',
    "ALLOWED_SAVE_REPORT_KEYS",
    "!ALLOWED_SAVE_REPORT_KEYS.has(key)",
    "body.reportType !== FREE_REPORT_TYPE",
    "!isPlainObject(body.freeResult)",
    'hasOwn(body.freeResult, "premiumReport")',
    'hasOwn(body.freeResult, "premium_report")',
    'body.sourceType !== "session"',
    "getFreeSaveValidationError(body)",
    "report_type: FREE_REPORT_TYPE",
    'source_type: "share"',
    "source_session_id: shareId",
    "premium_report: null",
    ".insert(savedReportPayload)"
  ].forEach((pattern) => assertIncludes(source, pattern, "free-only save route"));

  const postSource = source.slice(source.indexOf("export async function POST"));
  assertBefore(postSource, "getFreeSaveValidationError(body)", "upsertProfileForUser({", "free save validation");
  assertBefore(postSource, "createPrivateShareResult({", "buildSavedReportPayload({", "free save share provenance");
  assertNotIncludes(source, 'const REPORT_TYPES = new Set(["free", "premium"])', "free-only save route");
  assertNotIncludes(source, "body.premiumReport ??", "free-only save route");
  assertNotIncludes(source, "report_type: reportType", "free-only save route");
  assertNotIncludes(source, "source_type: sourceType", "free-only save route");
}

function verifyPremiumSession(source) {
  [
    'import "server-only"',
    "export async function updatePremiumReportSession",
    '.gt("expires_at", now)',
    '.select("premium_report, locale, expires_at")',
    ".maybeSingle()",
    'code: "missing_or_expired_session"',
    "premiumReport: data.premium_report",
    "sessionId"
  ].forEach((pattern) => assertIncludes(source, pattern, "premium session authority"));

  const updateSource = source.slice(source.indexOf("export async function updatePremiumReportSession"));
  assertBefore(updateSource, "const verified = await verifyPremiumReportSession(token)", ".update({", "premium session update");
  assertBefore(updateSource, ".update({", '.select("premium_report, locale, expires_at")', "premium session readback");
}

function verifyFullReportRoute(source) {
  [
    'import { createSupabaseAdminClient } from "@/lib/supabase-admin"',
    "authoritativePremiumReport",
    "adminSupabase",
    "createSupabaseAdminClient()",
    "premiumSession.payload.premiumReport",
    "updateResult.payload?.premiumReport",
    "premium_session_update_failed",
    "persistPremiumSavedReport({",
    "if (!persistResult.ok)",
    "premium_save_failed",
    '.eq("source_type", "premium_report_session")',
    '.eq("source_session_id", sessionId)'
  ].forEach((pattern) => assertIncludes(source, pattern, "server-only premium persistence"));

  const postSource = source.slice(source.indexOf("export async function POST"));
  assertBefore(
    postSource,
    "const premiumSession = await verifyPremiumReportSession(premiumCookie)",
    "const adminSupabase = createSupabaseAdminClient()",
    "premium persistence authorization"
  );
  assertBefore(
    postSource,
    "authoritativePremiumReport = sanitizePremiumReportForBoundary(",
    "persistPremiumSavedReport({",
    "premium persistence authority"
  );
  assertBefore(
    postSource,
    "updateResult.payload.premiumReport",
    "persistPremiumSavedReport({",
    "premium persistence verified session payload"
  );
  assertNotIncludes(
    postSource,
    "authoritativePremiumReport = updateResult.payload.premiumReport",
    "premium persistence sanitizer boundary"
  );
  assertNotIncludes(source, "supabase: userSupabase,\n      user,\n      sessionId", "premium persistence client boundary");
  assertNotIncludes(source, "premiumReport: responsePremiumReport", "premium persistence payload source");
}

const migrationPath = findMigration("sec_06_saved_reports_premium_write_boundary");
const migration = read(migrationPath);
const saveRoute = read("app/api/my/save-report/route.js");
const fullReportRoute = read("app/api/full-report/route.js");
const premiumSession = read("lib/premium-report-session.js");
const adminClient = read("lib/supabase-admin.js");

verifyMigration(migration);
verifySaveRoute(saveRoute);
verifyPremiumSession(premiumSession);
verifyFullReportRoute(fullReportRoute);

const validationStart = saveRoute.indexOf("const FREE_REPORT_TYPE");
const validationEnd = saveRoute.indexOf("function getPath");
assert(validationStart >= 0 && validationEnd > validationStart, "free save validation block could not be isolated");
const validationFactory = new Function(
  `${saveRoute.slice(validationStart, validationEnd)}\nreturn { getFreeSaveValidationError };`
);
const { getFreeSaveValidationError } = validationFactory();
const validFreeRequest = {
  reportType: "free",
  locale: "en",
  sourceType: "session",
  sourceSessionId: "client-session-ignored",
  reportVersion: "free-v1",
  freeResult: { summary: "ok" },
  faceLab: {},
  surveySnapshot: { form: { skinType: "combination" } },
  photoAnalysis: null
};

assert(getFreeSaveValidationError(validFreeRequest) === null, "valid free save request should pass validation");

const routeAttackCases = [
  [{ ...validFreeRequest, reportType: "premium" }, "invalid_report_type"],
  [{ ...validFreeRequest, premiumReport: { forged: true } }, "unsupported_save_report_field"],
  [{ ...validFreeRequest, premium_report: { forged: true } }, "unsupported_save_report_field"],
  [{ ...validFreeRequest, freeResult: { premiumReport: { forged: true } } }, "premium_payload_not_allowed"],
  [{ ...validFreeRequest, freeResult: { premium_report: { forged: true } } }, "premium_payload_not_allowed"],
  [{ ...validFreeRequest, freeResult: null }, "invalid_free_result"],
  [{ ...validFreeRequest, freeResult: [] }, "invalid_free_result"],
  [{ ...validFreeRequest, freeResult: "invalid" }, "invalid_free_result"],
  [{ ...validFreeRequest, sourceType: "premium_report_session" }, "invalid_source_type"],
  [{ ...validFreeRequest, sourceSessionId: null }, "invalid_source_session_id"],
  [{ ...validFreeRequest, reportVersion: "premium-v1" }, "invalid_report_version"],
  [{ ...validFreeRequest, source_type: "share" }, "unsupported_save_report_field"],
  [{ ...validFreeRequest, unknownPremiumControl: true }, "unsupported_save_report_field"]
];

for (const [payload, expected] of routeAttackCases) {
  assert(
    getFreeSaveValidationError(payload) === expected,
    `free save attack case expected ${expected}`
  );
}

assertIncludes(adminClient, 'import "server-only"', "Supabase admin client");
assertIncludes(adminClient, "SUPABASE_SERVICE_ROLE_KEY", "Supabase admin client");
assertNotIncludes(adminClient, "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY", "Supabase admin client");

const negativeControls = [
  () => verifyMigration(migration.replace("grant update (title)", "grant update")),
  () => verifySaveRoute(saveRoute.replace("premium_report: null", "premium_report: body.premiumReport")),
  () => verifyPremiumSession(premiumSession.replace('.gt("expires_at", now)', "")),
  () => verifyFullReportRoute(fullReportRoute.replace("const adminSupabase = createSupabaseAdminClient()", "const adminSupabase = userSupabase")),
  () => verifyFullReportRoute(fullReportRoute.replace(
    "authoritativePremiumReport = sanitizePremiumReportForBoundary(\n      updateResult.payload.premiumReport\n    )",
    "authoritativePremiumReport = updateResult.payload.premiumReport"
  ))
];

for (const [index, run] of negativeControls.entries()) {
  let rejected = false;
  try {
    run();
  } catch {
    rejected = true;
  }
  assert(rejected, `negative control ${index + 1} was not rejected`);
}

console.log(
  JSON.stringify(
    {
      status: "passed",
      checkedFiles,
      negativeControls: negativeControls.length,
      routeAttackCases: routeAttackCases.length,
      contract: {
        authenticatedInsert: "owner permanent free share only",
        authenticatedUpdate: "owner free title only",
        premiumPersistence: "verified session DB payload through server-only admin client"
      }
    },
    null,
    2
  )
);
