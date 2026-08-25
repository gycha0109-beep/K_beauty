import assert from "node:assert/strict";
import { chromium } from "playwright";
import { resolve } from "node:path";
import {
  DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES,
  JourneyFailure,
  createRunId,
  fetchAuthUser,
  getArtifactDir,
  hashIdentifier,
  inspectStorageState,
  loadJsonFile,
  normalizeBaseUrl,
  parseApiResponse,
  requireCondition,
  safeResponseContract,
  scanArtifactDirectoryForSecrets,
  validateEnvironmentGuard,
  writeArtifactSet
} from "./premium-browser-journey-core.mjs";

const startedAt = new Date();
const runId = createRunId(process.env.MY_E2E_RUN_ID || "").replace(/^premium-e2e-/, "my-e2e-");
const baseUrl = normalizeBaseUrl(process.env.MY_E2E_BASE_URL);
const environment = String(process.env.MY_E2E_ENVIRONMENT || "preview").trim();
const expectedHost = String(process.env.MY_E2E_EXPECTED_HOST || "").trim();
const expectedSha = String(process.env.MY_E2E_EXPECTED_SHA || "").trim();
const deploymentSha = String(process.env.MY_E2E_DEPLOYMENT_SHA || "").trim();
const accessTokenA = String(process.env.MY_E2E_ACCESS_TOKEN_A || "").trim();
const accessTokenB = String(process.env.MY_E2E_ACCESS_TOKEN_B || "").trim();
const expectedUserHashA = String(process.env.MY_E2E_EXPECTED_USER_HASH_A || "").trim();
const expectedUserHashB = String(process.env.MY_E2E_EXPECTED_USER_HASH_B || "").trim();
const supabaseUrl = String(process.env.MY_E2E_SUPABASE_URL || "").trim().replace(/\/$/, "");
const anonKey = String(process.env.MY_E2E_SUPABASE_ANON_KEY || "").trim();
const storageStateAPath = String(process.env.MY_E2E_STORAGE_STATE_A || "").trim();
const storageStateBPath = String(process.env.MY_E2E_STORAGE_STATE_B || "").trim();
const previewBypassToken = String(process.env.MY_E2E_PREVIEW_BYPASS_TOKEN || "").trim();
const headless = process.env.MY_E2E_HEADLESS !== "0";
const artifactDir = getArtifactDir(process.env.MY_E2E_ARTIFACT_ROOT || "tmp/my-adversarial-e2e", runId);

requireCondition(accessTokenA && accessTokenB, FAILURE_CATEGORIES.PRECONDITION, "configuration", "two_access_tokens_required");
requireCondition(expectedUserHashA && expectedUserHashB, FAILURE_CATEGORIES.PRECONDITION, "configuration", "two_expected_user_hashes_required");
requireCondition(supabaseUrl && anonKey, FAILURE_CATEGORIES.PRECONDITION, "configuration", "supabase_public_config_missing");
requireCondition(storageStateAPath && storageStateBPath, FAILURE_CATEGORIES.PRECONDITION, "configuration", "two_storage_states_required");
requireCondition(
  process.env.MY_E2E_DEDICATED_ACCOUNT_CONFIRMATION === DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES.PRECONDITION,
  "configuration",
  "dedicated_test_accounts_not_confirmed"
);
validateEnvironmentGuard({
  baseUrl,
  environment,
  expectedHost,
  expectedSha,
  deploymentSha,
  productionConfirmation: process.env.MY_E2E_ALLOW_PRODUCTION
});

const [storageStateA, storageStateB] = await Promise.all([
  loadJsonFile(storageStateAPath, "my_storage_state_a"),
  loadJsonFile(storageStateBPath, "my_storage_state_b")
]);
inspectStorageState(storageStateA, baseUrl.hostname);
inspectStorageState(storageStateB, baseUrl.hostname);

const [userA, userB] = await Promise.all([
  fetchAuthUser({ supabaseUrl, anonKey, accessToken: accessTokenA }),
  fetchAuthUser({ supabaseUrl, anonKey, accessToken: accessTokenB })
]);
const userHashA = hashIdentifier(userA.id);
const userHashB = hashIdentifier(userB.id);
requireCondition(!userA.is_anonymous && !userB.is_anonymous, FAILURE_CATEGORIES.AUTH, "auth-preflight", "permanent_accounts_required");
requireCondition(userA.id !== userB.id, FAILURE_CATEGORIES.AUTH, "auth-preflight", "accounts_must_be_distinct");
requireCondition(userHashA === expectedUserHashA, FAILURE_CATEGORIES.AUTH, "auth-preflight", "unexpected_account_a");
requireCondition(userHashB === expectedUserHashB, FAILURE_CATEGORIES.AUTH, "auth-preflight", "unexpected_account_b");

const extraHTTPHeaders = previewBypassToken
  ? { "x-vercel-protection-bypass": previewBypassToken, "x-vercel-set-bypass-cookie": "true" }
  : {};

const steps = [];
const responses = [];
const checks = [];
const fixtureIds = {
  profileA: [],
  savedReportA: [],
  checkinA: [],
  routineA: []
};
let previousActiveProfileIds = [];
let browser = null;
let finalError = null;
let selectedDate = null;

function recordCheck(name, passed, detail = null) {
  checks.push({ name, passed: Boolean(passed), detail });
}

async function runStep(name, category, fn) {
  const started = Date.now();
  try {
    const result = await fn();
    steps.push({ name, status: "passed", durationMs: Date.now() - started, httpStatus: result?.status ?? null, errorCode: null });
    return result;
  } catch (error) {
    const normalized = error instanceof JourneyFailure
      ? error
      : new JourneyFailure(category, name, "assertion_failed", error?.message || "assertion_failed");
    steps.push({ name, status: "failed", durationMs: Date.now() - started, httpStatus: null, errorCode: normalized.code });
    throw normalized;
  }
}

function appUrl(path) {
  return `${baseUrl.origin}${path}`;
}

async function requestJson(context, name, path, options = {}) {
  const response = await context.request.fetch(appUrl(path), {
    ...options,
    headers: { ...extraHTTPHeaders, ...(options.headers || {}) }
  });
  const parsed = await parseApiResponse(response);
  responses.push(safeResponseContract(name, parsed));
  return parsed;
}

function restUrl(table, query = {}) {
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

async function restRequest(token, table, { method = "GET", query = {}, body, prefer = "" } = {}) {
  const response = await fetch(restUrl(table, query), {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { status: response.status, ok: response.ok, body: parsed };
}

async function ownRows(token, table, query) {
  const result = await restRequest(token, table, { query: { select: "*", ...query } });
  requireCondition(result.ok && Array.isArray(result.body), FAILURE_CATEGORIES.PERSISTENCE, `rest:${table}:select`, `rest_select_${result.status}`);
  return result.body;
}

async function insertOwn(token, table, body) {
  const result = await restRequest(token, table, {
    method: "POST",
    query: { select: "*" },
    body,
    prefer: "return=representation"
  });
  requireCondition(result.ok && Array.isArray(result.body) && result.body.length === 1, FAILURE_CATEGORIES.PERSISTENCE, `rest:${table}:insert`, `rest_insert_${result.status}`);
  return result.body[0];
}

async function patchOwn(token, table, query, body) {
  const result = await restRequest(token, table, {
    method: "PATCH",
    query: { ...query, select: "*" },
    body,
    prefer: "return=representation"
  });
  requireCondition(result.ok && Array.isArray(result.body), FAILURE_CATEGORIES.PERSISTENCE, `rest:${table}:patch`, `rest_patch_${result.status}`);
  return result.body;
}

async function deleteOwn(token, table, query) {
  const result = await restRequest(token, table, {
    method: "DELETE",
    query: { ...query, select: "id" },
    prefer: "return=representation"
  });
  requireCondition(result.ok && Array.isArray(result.body), FAILURE_CATEGORIES.PERSISTENCE, `rest:${table}:delete`, `rest_delete_${result.status}`);
  return result.body;
}

function utcDateAtOffset(offset) {
  const date = new Date(Date.now() + offset * 86400000);
  return date.toISOString().slice(0, 10);
}

async function findUnusedCheckinDate() {
  for (const offset of [0, -1, 1, -2, 2]) {
    const date = utcDateAtOffset(offset);
    const [aCheckins, bCheckins, aRoutines, bRoutines] = await Promise.all([
      ownRows(accessTokenA, "daily_checkins", { user_id: `eq.${userA.id}`, checkin_date: `eq.${date}` }),
      ownRows(accessTokenB, "daily_checkins", { user_id: `eq.${userB.id}`, checkin_date: `eq.${date}` }),
      ownRows(accessTokenA, "routine_logs", { user_id: `eq.${userA.id}`, routine_date: `eq.${date}` }),
      ownRows(accessTokenB, "routine_logs", { user_id: `eq.${userB.id}`, routine_date: `eq.${date}` })
    ]);
    if (![aCheckins, bCheckins, aRoutines, bRoutines].some((rows) => rows.length > 0)) return date;
  }
  throw new JourneyFailure(FAILURE_CATEGORIES.PRECONDITION, "fixture-date", "no_unused_checkin_date_in_server_window");
}

function validCheckinPayload(date, overrides = {}) {
  return {
    checkinDate: date,
    dryness_level: 2,
    oiliness_level: 1,
    redness_level: 1,
    breakout_level: 0,
    irritation_level: 1,
    makeup_today: false,
    outdoor_today: true,
    checkinEvents: [],
    memo: `MY_E2E:${runId}`,
    ...overrides
  };
}

async function cleanupFixtures() {
  for (const id of [...fixtureIds.routineA].reverse()) {
    await deleteOwn(accessTokenA, "routine_logs", { id: `eq.${id}` });
  }
  for (const id of [...fixtureIds.checkinA].reverse()) {
    await deleteOwn(accessTokenA, "daily_checkins", { id: `eq.${id}` });
  }
  for (const id of [...fixtureIds.savedReportA].reverse()) {
    await deleteOwn(accessTokenA, "saved_reports", { id: `eq.${id}` });
  }
  for (const id of [...fixtureIds.profileA].reverse()) {
    await deleteOwn(accessTokenA, "skin_profiles", { id: `eq.${id}` });
  }
  for (const id of previousActiveProfileIds) {
    const rows = await patchOwn(accessTokenA, "skin_profiles", { id: `eq.${id}`, user_id: `eq.${userA.id}` }, { is_active: true });
    requireCondition(rows.length === 1, FAILURE_CATEGORIES.PERSISTENCE, "cleanup", "previous_active_profile_restore_failed");
  }
}

async function assertAnonymousBoundaries(context) {
  const validDate = selectedDate;
  const cases = [
    ["anon:dashboard", "/api/my/dashboard", { method: "GET" }],
    ["anon:diary-day", `/api/my/diary-day?date=${encodeURIComponent(validDate)}`, { method: "GET" }],
    ["anon:saved-reports", "/api/my/saved-reports?limit=5&offset=0", { method: "GET" }],
    ["anon:check-in", "/api/my/check-in", { method: "POST", data: validCheckinPayload(validDate) }],
    ["anon:save-report", "/api/my/save-report", { method: "POST", data: { reportType: "free", freeResult: { e2e: true } } }]
  ];
  for (const [name, path, options] of cases) {
    const result = await requestJson(context, name, path, options);
    requireCondition(result.status === 401 && result.body?.error === "unauthorized", FAILURE_CATEGORIES.AUTH, name, "anonymous_boundary_not_enforced");
  }
}

async function assertAuthenticatedInputFuzz(context) {
  const invalidDashboardDates = ["2026-02-30", "../../etc/passwd", "<script>alert(1)</script>", "2026-1-01", "9999-99-99"];
  for (const value of invalidDashboardDates) {
    const result = await requestJson(context, "fuzz:dashboard-local-date", `/api/my/dashboard?localDate=${encodeURIComponent(value)}`);
    requireCondition(result.status === 400 && result.body?.error === "invalid_local_date", FAILURE_CATEGORIES.AUTH, "fuzz:dashboard-local-date", "invalid_local_date_not_rejected");
  }
  for (const value of ["2026-00", "2026-13", "2026-1", "<svg/onload=1>", "999999999999999999"] ) {
    const result = await requestJson(context, "fuzz:dashboard-month", `/api/my/dashboard?diaryMonth=${encodeURIComponent(value)}`);
    requireCondition(result.status === 400 && result.body?.error === "invalid_diary_month", FAILURE_CATEGORIES.AUTH, "fuzz:dashboard-month", "invalid_diary_month_not_rejected");
  }
  for (const value of ["", "2026-02-30", "../../etc/passwd", "<script>", "9999-99-99"]) {
    const result = await requestJson(context, "fuzz:diary-date", `/api/my/diary-day?date=${encodeURIComponent(value)}`);
    requireCondition(result.status === 400 && result.body?.error === "invalid_diary_date", FAILURE_CATEGORIES.AUTH, "fuzz:diary-date", "invalid_diary_date_not_rejected");
  }
  for (const [limit, offset] of [["0", "0"], ["13", "0"], ["1.5", "0"], ["1e2", "0"], ["5", "-1"], ["5", "241"], ["<script>", "0"]]) {
    const result = await requestJson(context, "fuzz:saved-report-pagination", `/api/my/saved-reports?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`);
    requireCondition(result.status === 400 && result.body?.error === "invalid_saved_report_history_query", FAILURE_CATEGORIES.AUTH, "fuzz:saved-report-pagination", "invalid_pagination_not_rejected");
  }
  const malformed = await context.request.fetch(appUrl("/api/my/check-in"), {
    method: "POST",
    headers: { ...extraHTTPHeaders, "Content-Type": "application/json" },
    data: Buffer.from("{", "utf8")
  });
  const malformedParsed = await parseApiResponse(malformed);
  responses.push(safeResponseContract("fuzz:checkin-invalid-json", malformedParsed));
  requireCondition(malformedParsed.status === 400 && malformedParsed.body?.error === "invalid_json", FAILURE_CATEGORIES.AUTH, "fuzz:checkin-invalid-json", "invalid_json_not_rejected");

  const badCheckins = [
    validCheckinPayload(selectedDate, { dryness_level: -1 }),
    validCheckinPayload(selectedDate, { oiliness_level: 5 }),
    validCheckinPayload(selectedDate, { redness_level: 1.5 }),
    validCheckinPayload(selectedDate, { breakout_level: "2" }),
    validCheckinPayload("1900-01-01")
  ];
  for (const body of badCheckins) {
    const result = await requestJson(context, "fuzz:checkin-body", "/api/my/check-in", { method: "POST", data: body });
    requireCondition(result.status === 400, FAILURE_CATEGORIES.AUTH, "fuzz:checkin-body", "invalid_checkin_not_rejected");
  }

  const badSaveReports = [
    { reportType: "premium", freeResult: { ok: true } },
    { reportType: "free", freeResult: {} },
    { reportType: "free", freeResult: { premiumReport: { forged: true } } },
    { reportType: "free", sourceType: "manual", freeResult: { ok: true } },
    { reportType: "free", reportVersion: "free-v999", freeResult: { ok: true } },
    { reportType: "free", sourceSessionId: "", freeResult: { ok: true } },
    { reportType: "free", freeResult: { ok: true }, user_id: userB.id }
  ];
  for (const body of badSaveReports) {
    const result = await requestJson(context, "fuzz:save-report-body", "/api/my/save-report", { method: "POST", data: body });
    requireCondition(result.status === 400, FAILURE_CATEGORIES.AUTH, "fuzz:save-report-body", "invalid_save_report_not_rejected");
  }
}

try {
  browser = await chromium.launch({ headless });
  selectedDate = await findUnusedCheckinDate();

  const anonymousContext = await browser.newContext({ extraHTTPHeaders });
  try {
    await runStep("anonymous-boundaries", FAILURE_CATEGORIES.AUTH, async () => {
      await assertAnonymousBoundaries(anonymousContext);
      return { status: 401 };
    });
    await runStep("csrf-signout-cross-origin", FAILURE_CATEGORIES.AUTH, async () => {
      const result = await requestJson(anonymousContext, "csrf:signout", "/api/auth/signout?locale=en", {
        method: "POST",
        headers: { Origin: "https://evil.example", "Sec-Fetch-Site": "cross-site" }
      });
      requireCondition(result.status === 403 && result.body?.error === "invalid_request_origin", FAILURE_CATEGORIES.AUTH, "csrf-signout-cross-origin", "cross_origin_signout_not_rejected");
      return result;
    });
  } finally {
    await anonymousContext.close();
  }

  const contextA = await browser.newContext({ storageState: storageStateA, extraHTTPHeaders });
  const contextB = await browser.newContext({ storageState: storageStateB, extraHTTPHeaders });
  try {
    await runStep("authenticated-input-fuzz", FAILURE_CATEGORIES.AUTH, async () => {
      await assertAuthenticatedInputFuzz(contextA);
      return { status: 400 };
    });

    previousActiveProfileIds = (await ownRows(accessTokenA, "skin_profiles", {
      user_id: `eq.${userA.id}`,
      is_active: "eq.true"
    })).map((row) => row.id);
    if (previousActiveProfileIds.length) {
      const deactivated = await patchOwn(accessTokenA, "skin_profiles", {
        user_id: `eq.${userA.id}`,
        is_active: "eq.true"
      }, { is_active: false });
      requireCondition(deactivated.length === previousActiveProfileIds.length, FAILURE_CATEGORIES.PERSISTENCE, "fixture-profile", "existing_active_profile_deactivate_failed");
    }

    const xssTitle = `MY_E2E:${runId}:<script>window.__MY_E2E_XSS=1</script>`;
    const profile = await insertOwn(accessTokenA, "skin_profiles", {
      user_id: userA.id,
      skin_type: "combination",
      concerns: ["dehydration", "barrier"],
      sensitivity_level: "medium",
      skin_summary: `MY_E2E:${runId}`,
      result_snapshot: { e2eRunId: runId },
      is_active: true
    });
    fixtureIds.profileA.push(profile.id);

    const savedReport = await insertOwn(accessTokenA, "saved_reports", {
      user_id: userA.id,
      skin_profile_id: profile.id,
      report_type: "free",
      source_type: "share",
      source_session_id: `my-e2e-${runId}`,
      title: xssTitle,
      report_version: "free-v1",
      free_result: { e2eRunId: runId }
    });
    fixtureIds.savedReportA.push(savedReport.id);

    const longMemo = `MY_E2E:${runId}:<img src=x onerror="window.__MY_E2E_XSS=2">:${"x".repeat(1200)}`;
    const firstCheckin = await runStep("checkin-create-and-truncate", FAILURE_CATEGORIES.PERSISTENCE, async () => {
      const result = await requestJson(contextA, "checkin:create", "/api/my/check-in", {
        method: "POST",
        data: validCheckinPayload(selectedDate, { memo: longMemo })
      });
      requireCondition(result.status === 200, FAILURE_CATEGORIES.PERSISTENCE, "checkin-create-and-truncate", "valid_checkin_failed");
      requireCondition(result.body?.todayCheckin?.memo?.length === 1000, FAILURE_CATEGORIES.PERSISTENCE, "checkin-create-and-truncate", "memo_not_bounded_to_1000");
      return result;
    });
    fixtureIds.checkinA.push(firstCheckin.body.todayCheckin.id);
    fixtureIds.routineA.push(firstCheckin.body.todayRoutine.id);

    await runStep("checkin-concurrency-upsert", FAILURE_CATEGORIES.PERSISTENCE, async () => {
      const attempts = await Promise.all(Array.from({ length: 6 }, (_, index) => requestJson(
        contextA,
        `checkin:concurrent:${index}`,
        "/api/my/check-in",
        { method: "POST", data: validCheckinPayload(selectedDate, { dryness_level: index % 5, memo: `MY_E2E:${runId}:concurrent:${index}` }) }
      )));
      requireCondition(attempts.every((item) => item.status === 200), FAILURE_CATEGORIES.PERSISTENCE, "checkin-concurrency-upsert", "concurrent_checkin_request_failed");
      const checkinIds = new Set(attempts.map((item) => item.body?.todayCheckin?.id));
      const routineIds = new Set(attempts.map((item) => item.body?.todayRoutine?.id));
      requireCondition(checkinIds.size === 1 && routineIds.size === 1, FAILURE_CATEGORIES.PERSISTENCE, "checkin-concurrency-upsert", "duplicate_same_day_rows_created");
      const [checkinRows, routineRows] = await Promise.all([
        ownRows(accessTokenA, "daily_checkins", { user_id: `eq.${userA.id}`, checkin_date: `eq.${selectedDate}` }),
        ownRows(accessTokenA, "routine_logs", { user_id: `eq.${userA.id}`, routine_date: `eq.${selectedDate}` })
      ]);
      requireCondition(checkinRows.length === 1 && routineRows.length === 1, FAILURE_CATEGORIES.PERSISTENCE, "checkin-concurrency-upsert", "database_same_day_uniqueness_broken");
      return { status: 200 };
    });

    const diaryBefore = await runStep("historical-snapshot-before-baseline-change", FAILURE_CATEGORIES.IMMUTABILITY, async () => {
      const result = await requestJson(contextA, "diary:before-baseline-change", `/api/my/diary-day?date=${selectedDate}`);
      requireCondition(result.status === 200 && result.body?.historicalSnapshot === true, FAILURE_CATEGORIES.IMMUTABILITY, "historical-snapshot-before-baseline-change", "historical_snapshot_unavailable");
      return result;
    });

    await patchOwn(accessTokenA, "skin_profiles", { id: `eq.${profile.id}` }, { is_active: false });
    const replacementProfile = await insertOwn(accessTokenA, "skin_profiles", {
      user_id: userA.id,
      skin_type: "dry",
      concerns: ["acne", "redness"],
      sensitivity_level: "high",
      skin_summary: `MY_E2E:${runId}:replacement`,
      result_snapshot: { e2eRunId: runId, replacement: true },
      is_active: true
    });
    fixtureIds.profileA.push(replacementProfile.id);

    await runStep("historical-routine-immutability", FAILURE_CATEGORIES.IMMUTABILITY, async () => {
      const result = await requestJson(contextA, "diary:after-baseline-change", `/api/my/diary-day?date=${selectedDate}`);
      requireCondition(result.status === 200, FAILURE_CATEGORIES.IMMUTABILITY, "historical-routine-immutability", "historical_snapshot_reopen_failed");
      assert.deepEqual(result.body?.routine, diaryBefore.body?.routine);
      return result;
    });

    await runStep("saved-history-metadata-boundary", FAILURE_CATEGORIES.AUTH, async () => {
      const result = await requestJson(contextA, "saved-history:a", "/api/my/saved-reports?limit=12&offset=0");
      requireCondition(result.status === 200, FAILURE_CATEGORIES.AUTH, "saved-history-metadata-boundary", "saved_history_read_failed");
      const row = result.body?.reports?.find((item) => item.id === savedReport.id);
      requireCondition(Boolean(row), FAILURE_CATEGORIES.AUTH, "saved-history-metadata-boundary", "fixture_saved_report_missing");
      const serialized = JSON.stringify(row);
      for (const forbidden of ["user_id", "userId", "free_result", "freeResult", "premium_report", "premiumReport", "face_lab", "faceLab", "source_session_id", "sourceSessionId"]) {
        requireCondition(!serialized.includes(forbidden), FAILURE_CATEGORIES.AUTH, "saved-history-metadata-boundary", "heavy_or_private_saved_report_field_exposed");
      }
      return result;
    });

    await runStep("cross-account-app-isolation", FAILURE_CATEGORIES.AUTH, async () => {
      const diary = await requestJson(contextB, "idor:diary:b", `/api/my/diary-day?date=${selectedDate}`);
      requireCondition(diary.status === 404 && diary.body?.error === "diary_day_not_found", FAILURE_CATEGORIES.AUTH, "cross-account-app-isolation", "foreign_diary_visible");
      const history = await requestJson(contextB, "idor:history:b", "/api/my/saved-reports?limit=12&offset=0");
      requireCondition(history.status === 200 && !(history.body?.reports || []).some((item) => item.id === savedReport.id), FAILURE_CATEGORIES.AUTH, "cross-account-app-isolation", "foreign_saved_report_visible");
      const dashboard = await requestJson(contextB, "idor:dashboard:b", `/api/my/dashboard?localDate=${selectedDate}&diaryMonth=${selectedDate.slice(0, 7)}`);
      requireCondition(dashboard.status === 200 && !JSON.stringify(dashboard.body || {}).includes(profile.id), FAILURE_CATEGORIES.AUTH, "cross-account-app-isolation", "foreign_profile_visible");
      return { status: 200 };
    });

    await runStep("cross-account-rls-select-update-delete", FAILURE_CATEGORIES.AUTH, async () => {
      const foreignSelects = await Promise.all([
        ownRows(accessTokenB, "skin_profiles", { id: `eq.${profile.id}` }),
        ownRows(accessTokenB, "saved_reports", { id: `eq.${savedReport.id}` }),
        ownRows(accessTokenB, "daily_checkins", { id: `eq.${firstCheckin.body.todayCheckin.id}` }),
        ownRows(accessTokenB, "routine_logs", { id: `eq.${firstCheckin.body.todayRoutine.id}` })
      ]);
      requireCondition(foreignSelects.every((rows) => rows.length === 0), FAILURE_CATEGORIES.AUTH, "cross-account-rls-select-update-delete", "rls_foreign_select_allowed");

      const foreignPatch = await restRequest(accessTokenB, "saved_reports", {
        method: "PATCH",
        query: { id: `eq.${savedReport.id}`, select: "id,title" },
        body: { title: "ATTACKER_OVERWRITE" },
        prefer: "return=representation"
      });
      requireCondition(foreignPatch.ok && Array.isArray(foreignPatch.body) && foreignPatch.body.length === 0, FAILURE_CATEGORIES.AUTH, "cross-account-rls-select-update-delete", "rls_foreign_update_allowed");

      const foreignDelete = await restRequest(accessTokenB, "daily_checkins", {
        method: "DELETE",
        query: { id: `eq.${firstCheckin.body.todayCheckin.id}`, select: "id" },
        prefer: "return=representation"
      });
      requireCondition(foreignDelete.ok && Array.isArray(foreignDelete.body) && foreignDelete.body.length === 0, FAILURE_CATEGORIES.AUTH, "cross-account-rls-select-update-delete", "rls_foreign_delete_allowed");

      const [ownerReport, ownerCheckin] = await Promise.all([
        ownRows(accessTokenA, "saved_reports", { id: `eq.${savedReport.id}` }),
        ownRows(accessTokenA, "daily_checkins", { id: `eq.${firstCheckin.body.todayCheckin.id}` })
      ]);
      requireCondition(ownerReport.length === 1 && ownerReport[0].title === xssTitle, FAILURE_CATEGORIES.AUTH, "cross-account-rls-select-update-delete", "owner_report_mutated_by_foreign_user");
      requireCondition(ownerCheckin.length === 1, FAILURE_CATEGORIES.AUTH, "cross-account-rls-select-update-delete", "owner_checkin_deleted_by_foreign_user");
      return { status: 200 };
    });

    await runStep("forged-user-id-insert-denied", FAILURE_CATEGORIES.AUTH, async () => {
      const forged = await restRequest(accessTokenB, "daily_checkins", {
        method: "POST",
        query: { select: "id" },
        body: {
          user_id: userA.id,
          checkin_date: selectedDate,
          dryness_level: 0,
          oiliness_level: 0,
          redness_level: 0,
          breakout_level: 0,
          irritation_level: 0
        },
        prefer: "return=representation"
      });
      requireCondition(!forged.ok && [401, 403, 409].includes(forged.status), FAILURE_CATEGORIES.AUTH, "forged-user-id-insert-denied", "forged_user_id_insert_allowed");
      return { status: forged.status };
    });

    await runStep("my-ui-xss-account-locale", FAILURE_CATEGORIES.AUTH, async () => {
      const page = await contextA.newPage();
      await page.addInitScript(() => { window.__MY_E2E_XSS = 0; });
      const response = await page.goto(appUrl("/my"), { waitUntil: "networkidle" });
      requireCondition(response && response.status() < 400, FAILURE_CATEGORIES.INFRASTRUCTURE, "my-ui-xss-account-locale", "my_page_unreachable");
      await page.getByText(xssTitle, { exact: true }).waitFor({ timeout: 15000 });
      requireCondition(await page.evaluate(() => window.__MY_E2E_XSS === 0), FAILURE_CATEGORIES.AUTH, "my-ui-xss-account-locale", "stored_xss_executed");
      const koMenuButton = page.locator('button[aria-label*="메뉴"]').first();
      await koMenuButton.click();
      await page.getByText(userA.email, { exact: true }).waitFor({ timeout: 10000 });
      requireCondition(await page.locator('a[href="/en/my"]').count() >= 1, FAILURE_CATEGORIES.LOCALE, "my-ui-xss-account-locale", "en_my_navigation_missing");
      await page.goto(appUrl("/en/my"), { waitUntil: "networkidle" });
      const enMenuButton = page.locator('button[aria-label*="menu" i]').first();
      await enMenuButton.click();
      await page.getByText(userA.email, { exact: true }).waitFor({ timeout: 10000 });
      requireCondition(await page.locator('a[href="/my"]').count() >= 1, FAILURE_CATEGORIES.LOCALE, "my-ui-xss-account-locale", "ko_my_navigation_missing");
      await page.close();
      return { status: 200 };
    });
  } finally {
    await contextA.close();
    await contextB.close();
  }

  await runStep("cleanup-fixtures", FAILURE_CATEGORIES.PERSISTENCE, async () => {
    await cleanupFixtures();
    const residual = await Promise.all([
      ...fixtureIds.profileA.map((id) => ownRows(accessTokenA, "skin_profiles", { id: `eq.${id}` })),
      ...fixtureIds.savedReportA.map((id) => ownRows(accessTokenA, "saved_reports", { id: `eq.${id}` })),
      ...fixtureIds.checkinA.map((id) => ownRows(accessTokenA, "daily_checkins", { id: `eq.${id}` })),
      ...fixtureIds.routineA.map((id) => ownRows(accessTokenA, "routine_logs", { id: `eq.${id}` }))
    ]);
    requireCondition(residual.every((rows) => rows.length === 0), FAILURE_CATEGORIES.PERSISTENCE, "cleanup-fixtures", "fixture_cleanup_incomplete");
    return { status: 200 };
  });

  await runStep("logout-session-boundary", FAILURE_CATEGORIES.SESSION, async () => {
    const logoutContext = await browser.newContext({ storageState: storageStateA, extraHTTPHeaders });
    try {
      const page = await logoutContext.newPage();
      await page.goto(appUrl("/en/my"), { waitUntil: "networkidle" });
      const menuButton = page.locator('button[aria-label*="menu" i]').first();
      await menuButton.click();
      await page.getByRole("button", { name: /sign out/i }).click();
      await page.waitForURL((url) => url.pathname === "/en", { timeout: 15000 });
      const after = await requestJson(logoutContext, "logout:dashboard-after", "/api/my/dashboard");
      requireCondition(after.status === 401 && after.body?.error === "unauthorized", FAILURE_CATEGORIES.SESSION, "logout-session-boundary", "session_still_authenticated_after_logout");
      await page.close();
      return { status: 401 };
    } finally {
      await logoutContext.close();
    }
  });

  for (const name of [
    "anonymous-boundaries",
    "csrf-signout-cross-origin",
    "authenticated-input-fuzz",
    "checkin-create-and-truncate",
    "checkin-concurrency-upsert",
    "historical-routine-immutability",
    "saved-history-metadata-boundary",
    "cross-account-app-isolation",
    "cross-account-rls-select-update-delete",
    "forged-user-id-insert-denied",
    "my-ui-xss-account-locale",
    "cleanup-fixtures",
    "logout-session-boundary"
  ]) recordCheck(name, steps.some((step) => step.name === name && step.status === "passed"));
} catch (error) {
  finalError = error instanceof JourneyFailure
    ? error
    : new JourneyFailure(FAILURE_CATEGORIES.HARNESS, "unhandled", "unhandled_error", error?.message || "unhandled_error");
  try {
    await cleanupFixtures();
    recordCheck("cleanup-after-failure", true);
  } catch {
    recordCheck("cleanup-after-failure", false);
  }
} finally {
  if (browser) await browser.close();
  const passed = !finalError && checks.every((item) => item.passed);
  const manifest = {
    schemaVersion: 1,
    runId,
    environment,
    targetHost: baseUrl.hostname,
    targetGitSha: deploymentSha,
    expectedGitSha: expectedSha,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    selectedDate,
    accountAHash: userHashA,
    accountBHash: userHashB,
    distinctAccounts: true,
    storageStateA: { authCookieCount: inspectStorageState(storageStateA, baseUrl.hostname).authCookieCount },
    storageStateB: { authCookieCount: inspectStorageState(storageStateB, baseUrl.hostname).authCookieCount }
  };
  const persistence = {
    fixtureCounts: {
      profiles: fixtureIds.profileA.length,
      savedReports: fixtureIds.savedReportA.length,
      checkins: fixtureIds.checkinA.length,
      routines: fixtureIds.routineA.length
    },
    cleanupRequired: false,
    previousActiveProfileCount: previousActiveProfileIds.length
  };
  const verdict = {
    passed,
    failure: finalError ? { category: finalError.category, step: finalError.step, code: finalError.code } : null,
    checks
  };
  const summary = `# My adversarial authenticated E2E\
\
- Run ID: \`${runId}\`\
- Environment: \`${environment}\`\
- Target host: \`${baseUrl.hostname}\`\
- Target SHA: \`${deploymentSha}\`\
- Result: **${passed ? "PASS" : "FAIL"}**\
- Two-account isolation: enabled\
- Cleanup: exact fixture IDs + prior active-profile restoration\
${finalError ? `- Failure: \`${finalError.category}/${finalError.step}/${finalError.code}\`` : ""}`;
  await writeArtifactSet({ artifactDir, manifest, steps, responses, persistence, verdict, summary });
  try {
    await scanArtifactDirectoryForSecrets(artifactDir, [accessTokenA, accessTokenB, previewBypassToken, userA.email, userB.email]);
  } catch (scanError) {
    finalError = scanError instanceof JourneyFailure
      ? scanError
      : new JourneyFailure(FAILURE_CATEGORIES.HARNESS, "artifact-secret-scan", "artifact_secret_scan_failed");
  }
  console.log(JSON.stringify({
    ok: !finalError && passed,
    runId,
    artifactDir,
    checkCount: checks.length,
    failure: finalError ? { category: finalError.category, step: finalError.step, code: finalError.code } : null
  }, null, 2));
}

if (finalError) process.exitCode = 1;
