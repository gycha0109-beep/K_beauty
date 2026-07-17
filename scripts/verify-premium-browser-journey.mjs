import assert from "node:assert/strict";
import { chromium } from "playwright";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES,
  JourneyFailure,
  PREMIUM_COOKIE_NAME,
  buildPersistenceEvidence,
  countDuplicateSourceTuples,
  createRunId,
  fetchAuthUser,
  fetchPremiumSessionRows,
  fetchSavedReportById,
  getArtifactDir,
  getFixtureMetadata,
  hashIdentifier,
  inspectStorageState,
  loadImageFixture,
  loadJsonFile,
  normalizeBaseUrl,
  parseApiResponse,
  requireCondition,
  resolveConflictBody,
  safeErrorCode,
  safeResponseContract,
  scanArtifactDirectoryForSecrets,
  validateEnvironmentGuard,
  writeArtifactSet
} from "./premium-browser-journey-core.mjs";

const { buildPremiumReportSnapshot } = await import(
  pathToFileURL(resolve(process.cwd(), "lib/premium-report-snapshot.js")).href
);

const startedAt = new Date();
const runId = createRunId(process.env.PREMIUM_E2E_RUN_ID);
const baseUrl = normalizeBaseUrl(process.env.PREMIUM_E2E_BASE_URL);
const environment = String(process.env.PREMIUM_E2E_ENVIRONMENT || "").trim();
const expectedHost = String(process.env.PREMIUM_E2E_EXPECTED_HOST || "").trim();
const expectedSha = String(process.env.PREMIUM_E2E_EXPECTED_SHA || "").trim();
const deploymentSha = String(process.env.PREMIUM_E2E_DEPLOYMENT_SHA || "").trim();
const accessToken = String(process.env.PREMIUM_E2E_ACCESS_TOKEN || "").trim();
const conflictAccessToken = String(process.env.PREMIUM_E2E_CONFLICT_ACCESS_TOKEN || "").trim();
const expectedUserHash = String(process.env.PREMIUM_E2E_EXPECTED_USER_ID_HASH || "").trim();
const expectedConflictUserHash = String(process.env.PREMIUM_E2E_EXPECTED_CONFLICT_USER_ID_HASH || "").trim();
const supabaseUrl = String(process.env.PREMIUM_E2E_SUPABASE_URL || "").trim();
const anonKey = String(process.env.PREMIUM_E2E_SUPABASE_ANON_KEY || "").trim();
const storageStatePath = String(process.env.PREMIUM_E2E_STORAGE_STATE_PATH || "").trim();
const imagePath = String(process.env.PREMIUM_E2E_IMAGE_PATH || "").trim();
const conflictBodyPath = String(process.env.PREMIUM_E2E_CONFLICT_BODY_PATH || "").trim();
const previewBypassToken = String(process.env.PREMIUM_E2E_PREVIEW_BYPASS_TOKEN || "").trim();
const headless = process.env.PREMIUM_E2E_HEADLESS !== "0";
const artifactDir = getArtifactDir(process.env.PREMIUM_E2E_ARTIFACT_ROOT, runId);

requireCondition(accessToken, FAILURE_CATEGORIES.PRECONDITION, "configuration", "access_token_missing");
requireCondition(expectedUserHash, FAILURE_CATEGORIES.PRECONDITION, "configuration", "expected_user_hash_missing");
requireCondition(supabaseUrl && anonKey, FAILURE_CATEGORIES.PRECONDITION, "configuration", "supabase_public_config_missing");
requireCondition(storageStatePath && imagePath && conflictBodyPath, FAILURE_CATEGORIES.PRECONDITION, "configuration", "fixture_configuration_missing");
requireCondition(
  process.env.PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION === DEDICATED_ACCOUNT_CONFIRMATION,
  FAILURE_CATEGORIES.PRECONDITION,
  "configuration",
  "dedicated_test_account_not_confirmed"
);
validateEnvironmentGuard({
  baseUrl,
  environment,
  expectedHost,
  expectedSha,
  deploymentSha,
  productionConfirmation: process.env.PREMIUM_E2E_ALLOW_PRODUCTION
});

const [storageState, imageFixture, conflictDocument] = await Promise.all([
  loadJsonFile(storageStatePath, "storage_state"),
  loadImageFixture(imagePath),
  loadJsonFile(conflictBodyPath, "conflict_body")
]);
const storageInspection = inspectStorageState(storageState);
const supabaseConfig = { supabaseUrl, anonKey, accessToken };
const accountUser = await fetchAuthUser(supabaseConfig);
const accountHash = hashIdentifier(accountUser.id);
requireCondition(accountUser.is_anonymous === false, FAILURE_CATEGORIES.AUTH, "auth-user-lookup", "test_account_must_be_permanent");
requireCondition(accountHash === expectedUserHash, FAILURE_CATEGORIES.AUTH, "auth-user-lookup", "unexpected_test_account");

let conflictAccountHash = null;
if (conflictAccessToken) {
  const conflictUser = await fetchAuthUser({ supabaseUrl, anonKey, accessToken: conflictAccessToken });
  conflictAccountHash = hashIdentifier(conflictUser.id);
  requireCondition(conflictUser.is_anonymous === false && conflictUser.id !== accountUser.id, FAILURE_CATEGORIES.AUTH, "auth-conflict-precondition", "conflict_account_invalid");
  requireCondition(conflictAccountHash === expectedConflictUserHash, FAILURE_CATEGORIES.AUTH, "auth-conflict-precondition", "unexpected_conflict_account");
}

const extraHTTPHeaders = previewBypassToken
  ? { "x-vercel-protection-bypass": previewBypassToken, "x-vercel-set-bypass-cookie": "true" }
  : {};
const steps = [];
const responses = [];
const persistenceRecords = [];
const checks = [];
const createdSavedReportIds = [];
let browser = null;
let finalError = null;

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

function authHeaders(token = accessToken) {
  return { ...extraHTTPHeaders, Authorization: `Bearer ${token}` };
}

async function requestJson(context, name, path, options = {}, token = accessToken) {
  const response = await context.request.fetch(`${baseUrl.origin}${path}`, {
    ...options,
    headers: { ...authHeaders(token), ...(options.headers || {}) }
  });
  const parsed = await parseApiResponse(response);
  responses.push(safeResponseContract(name, parsed));
  return parsed;
}

async function runAnalyze(context, locale) {
  const response = await context.request.post(`${baseUrl.origin}/api/analyze`, {
    headers: authHeaders(),
    multipart: {
      image: { name: imageFixture.name, mimeType: imageFixture.mimeType, buffer: imageFixture.buffer },
      skinType: "combination",
      sensitivityLevel: "medium",
      mainConcern: "dehydration",
      mainConcerns: JSON.stringify(["dehydration", "barrier"]),
      cleansingFrequency: "twice_daily",
      texturePreference: "gel",
      postCleanseFeel: "tight",
      afternoonState: "more_oily",
      dislikedFeel: "heavy",
      environmentExposure: JSON.stringify(["outdoor"]),
      currentProducts: JSON.stringify([]),
      locale
    }
  });
  const parsed = await parseApiResponse(response);
  responses.push(safeResponseContract(`${locale}:analyze`, parsed));
  return parsed;
}

async function premiumCookie(context, previous = null) {
  const cookies = (await context.cookies()).filter((cookie) => cookie.name === PREMIUM_COOKIE_NAME);
  requireCondition(cookies.length === 1, FAILURE_CATEGORIES.SESSION, "premium-cookie", "premium_cookie_count_invalid");
  const cookie = cookies[0];
  requireCondition(cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax" && cookie.path === "/api/full-report", FAILURE_CATEGORIES.SESSION, "premium-cookie", "premium_cookie_contract_invalid");
  if (previous) requireCondition(cookie.value !== previous, FAILURE_CATEGORIES.SESSION, "premium-cookie", "premium_cookie_not_rotated");
  return cookie;
}

async function verifySavedRow(savedReportId, responseFingerprint) {
  const row = await fetchSavedReportById(supabaseConfig, savedReportId);
  requireCondition(row?.id === savedReportId, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "saved_report_not_readable");
  requireCondition(row.user_id === accountUser.id, FAILURE_CATEGORIES.AUTH, "persistence-read", "saved_report_owner_mismatch");
  requireCondition(row.report_type === "premium" && row.source_type === "premium_report_session", FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "saved_report_source_invalid");
  const snapshot = buildPremiumReportSnapshot(row.premium_report);
  requireCondition(snapshot?.fingerprint === responseFingerprint, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "response_db_fingerprint_mismatch");
  requireCondition(row.report_version === snapshot.reportVersion, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "report_version_mismatch");
  requireCondition(new Set([snapshot.version, snapshot.reportVersion, snapshot.decisionBundleVersion]).size === 3, FAILURE_CATEGORIES.PERSISTENCE, "persistence-read", "version_contract_not_separated");
  return { row, snapshot };
}

async function runLocaleJourney(locale) {
  const context = await browser.newContext({ storageState, extraHTTPHeaders });
  await context.clearCookies({ name: PREMIUM_COOKIE_NAME });
  try {
    await runStep(`${locale}:navigation`, FAILURE_CATEGORIES.INFRASTRUCTURE, async () => {
      const page = await context.newPage();
      const response = await page.goto(baseUrl.origin, { waitUntil: "domcontentloaded" });
      requireCondition(response && response.status() < 400, FAILURE_CATEGORIES.INFRASTRUCTURE, `${locale}:navigation`, "preview_navigation_failed");
      await page.close();
      return { status: response.status() };
    });

    const analyze = await runStep(`${locale}:analyze`, FAILURE_CATEGORIES.SESSION, async () => {
      const result = await runAnalyze(context, locale);
      requireCondition(result.status === 200, FAILURE_CATEGORIES.INFRASTRUCTURE, `${locale}:analyze`, safeErrorCode(result));
      requireCondition(!("premiumReport" in (result.body || {})), FAILURE_CATEGORIES.AUTH, `${locale}:analyze`, "premium_report_exposed_in_free_response");
      return result;
    });
    const firstCookie = await runStep(`${locale}:premium-cookie`, FAILURE_CATEGORIES.SESSION, async () => premiumCookie(context));

    const before = await runStep(`${locale}:session-before-save`, FAILURE_CATEGORIES.SESSION, async () => {
      const result = await requestJson(context, `${locale}:session-before-save`, "/api/full-report/session", { method: "GET" });
      requireCondition(result.status === 200 && result.body?.hasSavedReport === false, FAILURE_CATEGORIES.SESSION, `${locale}:session-before-save`, "session_unexpectedly_finalized");
      return result;
    });
    assert.equal(before.body.hasSavedReport, false);

    const reportBody = { locale, currentProducts: [] };
    const first = await runStep(`${locale}:first-save`, FAILURE_CATEGORIES.PERSISTENCE, async () => {
      const result = await requestJson(context, `${locale}:first-save`, "/api/full-report", { method: "POST", data: reportBody });
      requireCondition(result.status === 200 && result.body?.meta?.persistence?.status === "saved", FAILURE_CATEGORIES.PERSISTENCE, `${locale}:first-save`, safeErrorCode(result));
      requireCondition(typeof result.body?.meta?.persistence?.savedReportId === "string", FAILURE_CATEGORIES.PERSISTENCE, `${locale}:first-save`, "saved_report_id_missing");
      requireCondition(/^[0-9a-f]{64}$/i.test(result.body?.meta?.snapshot?.fingerprint || ""), FAILURE_CATEGORIES.PERSISTENCE, `${locale}:first-save`, "snapshot_fingerprint_missing");
      return result;
    });
    const firstId = first.body.meta.persistence.savedReportId;
    const firstFingerprint = first.body.meta.snapshot.fingerprint;
    createdSavedReportIds.push(firstId);
    const firstSaved = await verifySavedRow(firstId, firstFingerprint);
    persistenceRecords.push(buildPersistenceEvidence({ row: firstSaved.row, snapshot: firstSaved.snapshot, responseFingerprint: firstFingerprint }));

    const retry = await runStep(`${locale}:identical-retry`, FAILURE_CATEGORIES.IMMUTABILITY, async () => {
      const result = await requestJson(context, `${locale}:identical-retry`, "/api/full-report", { method: "POST", data: reportBody });
      requireCondition(result.status === 200 && result.body?.meta?.persistence?.status === "existing", FAILURE_CATEGORIES.IMMUTABILITY, `${locale}:identical-retry`, "retry_not_existing");
      assert.equal(result.body?.meta?.persistence?.savedReportId, firstId);
      assert.equal(result.body?.meta?.snapshot?.fingerprint, firstFingerprint);
      return result;
    });

    const reopened = await runStep(`${locale}:saved-reopen`, FAILURE_CATEGORIES.REENTRY, async () => {
      const result = await requestJson(context, `${locale}:saved-reopen`, "/api/full-report", {
        method: "POST",
        data: { savedReportId: firstId, locale: locale === "ko" ? "en" : "ko", topPick: { id: "tamper" } }
      });
      requireCondition(result.status === 200 && result.body?.meta?.source === "saved-report", FAILURE_CATEGORIES.REENTRY, `${locale}:saved-reopen`, safeErrorCode(result));
      requireCondition(result.body?.meta?.locale === locale, FAILURE_CATEGORIES.LOCALE, `${locale}:saved-reopen`, "saved_locale_changed_by_request");
      assert.equal(result.body?.meta?.snapshot?.fingerprint, firstFingerprint);
      assert.deepEqual(result.body?.freeResult?.topPick || null, firstSaved.row.premium_report?.freeResult?.topPick || null);
      return result;
    });

    await runStep(`${locale}:finalized-conflict`, FAILURE_CATEGORIES.IMMUTABILITY, async () => {
      const result = await requestJson(context, `${locale}:finalized-conflict`, "/api/full-report", {
        method: "POST",
        data: resolveConflictBody(conflictDocument, locale)
      });
      requireCondition(result.status === 409 && result.body?.error === "premium_snapshot_finalized", FAILURE_CATEGORIES.IMMUTABILITY, `${locale}:finalized-conflict`, "finalized_change_not_rejected");
      return result;
    });

    const afterConflict = await fetchSavedReportById(supabaseConfig, firstId);
    assert.deepEqual(afterConflict?.premium_report, firstSaved.row.premium_report);
    assert.equal(afterConflict?.updated_at, firstSaved.row.updated_at);

    const after = await runStep(`${locale}:session-after-save`, FAILURE_CATEGORIES.SESSION, async () => {
      const result = await requestJson(context, `${locale}:session-after-save`, "/api/full-report/session", { method: "GET" });
      requireCondition(result.status === 200 && result.body?.hasSavedReport === true, FAILURE_CATEGORIES.SESSION, `${locale}:session-after-save`, "saved_session_not_discovered");
      assert.equal(result.body?.savedReportId, firstId);
      return result;
    });

    if (conflictAccessToken) {
      const rowsBefore = await fetchPremiumSessionRows(supabaseConfig);
      await runStep(`${locale}:principal-conflict`, FAILURE_CATEGORIES.AUTH, async () => {
        const result = await requestJson(context, `${locale}:principal-conflict`, "/api/full-report", { method: "POST", data: reportBody }, conflictAccessToken);
        requireCondition(result.status === 401 && result.body?.error === "premium_principal_conflict", FAILURE_CATEGORIES.AUTH, `${locale}:principal-conflict`, "principal_conflict_not_rejected");
        return result;
      });
      const rowsAfter = await fetchPremiumSessionRows(supabaseConfig);
      assert.equal(rowsAfter.length, rowsBefore.length);
    }

    const rotation = await runStep(`${locale}:rotation`, FAILURE_CATEGORIES.SESSION, async () => {
      const result = await requestJson(context, `${locale}:rotation`, "/api/full-report/session", { method: "POST" });
      requireCondition(result.status === 200 && result.body?.rotated === true && result.body?.reason === "new_session_created", FAILURE_CATEGORIES.SESSION, `${locale}:rotation`, safeErrorCode(result));
      const serialized = JSON.stringify(result.body || {});
      for (const forbidden of ["sessionId", "premiumSessionToken", "accessToken"]) assert.equal(serialized.includes(forbidden), false);
      return result;
    });
    assert.equal(rotation.body.rotated, true);
    await premiumCookie(context, firstCookie.value);

    const second = await runStep(`${locale}:second-save`, FAILURE_CATEGORIES.PERSISTENCE, async () => {
      const result = await requestJson(context, `${locale}:second-save`, "/api/full-report", { method: "POST", data: reportBody });
      requireCondition(result.status === 200 && result.body?.meta?.persistence?.status === "saved", FAILURE_CATEGORIES.PERSISTENCE, `${locale}:second-save`, safeErrorCode(result));
      assert.notEqual(result.body?.meta?.persistence?.savedReportId, firstId);
      return result;
    });
    const secondId = second.body.meta.persistence.savedReportId;
    const secondFingerprint = second.body.meta.snapshot.fingerprint;
    createdSavedReportIds.push(secondId);
    const secondSaved = await verifySavedRow(secondId, secondFingerprint);
    requireCondition(secondSaved.row.source_session_id !== firstSaved.row.source_session_id, FAILURE_CATEGORIES.PERSISTENCE, `${locale}:second-save`, "rotated_session_source_not_distinct");
    const originalAgain = await fetchSavedReportById(supabaseConfig, firstId);
    assert.deepEqual(originalAgain?.premium_report, firstSaved.row.premium_report);
    assert.equal(originalAgain?.updated_at, firstSaved.row.updated_at);
    persistenceRecords.push(buildPersistenceEvidence({ row: secondSaved.row, snapshot: secondSaved.snapshot, responseFingerprint: secondFingerprint }));

    return { locale, firstId, secondId, savedLocale: reopened.body.meta.locale, sessionLookupId: after.body.savedReportId, retryStatus: retry.body.meta.persistence.status, analyzeSchemaVersion: analyze.body?.meta?.schemaVersion || null };
  } finally {
    await context.close();
  }
}

try {
  browser = await chromium.launch({ headless });
  await runStep("anonymous-premium-boundary", FAILURE_CATEGORIES.AUTH, async () => {
    const context = await browser.newContext({ extraHTTPHeaders });
    try {
      const response = await context.request.post(`${baseUrl.origin}/api/full-report`, { headers: extraHTTPHeaders, data: { locale: "ko" } });
      const parsed = await parseApiResponse(response);
      responses.push(safeResponseContract("anonymous-premium-boundary", parsed));
      requireCondition(parsed.status === 401 && parsed.body?.error === "login_required", FAILURE_CATEGORIES.AUTH, "anonymous-premium-boundary", "anonymous_premium_request_not_rejected");
      requireCondition((await context.cookies()).every((cookie) => cookie.name !== PREMIUM_COOKIE_NAME), FAILURE_CATEGORIES.AUTH, "anonymous-premium-boundary", "anonymous_premium_cookie_created");
      return parsed;
    } finally {
      await context.close();
    }
  });

  const localeResults = [];
  for (const locale of ["ko", "en"]) localeResults.push(await runLocaleJourney(locale));
  const allRows = await fetchPremiumSessionRows(supabaseConfig);
  requireCondition(countDuplicateSourceTuples(allRows) === 0, FAILURE_CATEGORIES.PERSISTENCE, "duplicate-source-tuple-check", "duplicate_premium_session_tuple_detected");

  recordCheck("ko_full_journey", localeResults.some((item) => item.locale === "ko"));
  recordCheck("en_full_journey", localeResults.some((item) => item.locale === "en"));
  recordCheck("finalized_conflict_rejected", steps.filter((step) => step.name.endsWith(":finalized-conflict")).every((step) => step.status === "passed"));
  recordCheck("saved_locale_authoritative", localeResults.every((item) => item.savedLocale === item.locale));
  recordCheck("rotation_created_distinct_reports", localeResults.every((item) => item.firstId !== item.secondId));
  recordCheck("source_tuple_duplicates_zero", true);
  recordCheck("principal_conflict_checked", Boolean(conflictAccessToken), conflictAccessToken ? null : "optional_second_account_not_supplied");
} catch (error) {
  finalError = error instanceof JourneyFailure ? error : new JourneyFailure(FAILURE_CATEGORIES.HARNESS, "unhandled", "unhandled_error", error?.message || "unhandled_error");
} finally {
  if (browser) await browser.close();
  const passed = !finalError && checks.filter((item) => item.name !== "principal_conflict_checked").every((item) => item.passed);
  const manifest = {
    runId,
    environment,
    targetHost: baseUrl.hostname,
    targetGitSha: deploymentSha,
    expectedGitSha: expectedSha,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    locales: ["ko", "en"],
    accountHash,
    conflictAccountHash,
    fixture: getFixtureMetadata(imageFixture),
    storageState: { authCookieCount: storageInspection.authCookieCount, stalePremiumCookieRemovedBeforeEachLocale: true }
  };
  const persistence = { createdSavedReportIds, records: persistenceRecords, duplicateSourceTupleCount: checks.find((item) => item.name === "source_tuple_duplicates_zero")?.passed ? 0 : null, cleanupRequired: createdSavedReportIds.length > 0 };
  let verdict = { passed, failure: finalError ? { category: finalError.category, step: finalError.step, code: finalError.code } : null, checks };
  let summary = `# Premium authenticated runtime journey\n\n- Run ID: \`${runId}\`\n- Environment: \`${environment}\`\n- Target host: \`${baseUrl.hostname}\`\n- Target SHA: \`${deploymentSha}\`\n- Result: **${passed ? "PASS" : "FAIL"}**\n- Created test reports: ${createdSavedReportIds.length}\n- Cleanup: ${createdSavedReportIds.length ? "required through the separate cleanup command" : "not required"}\n${finalError ? `- Failure: \`${finalError.category}/${finalError.step}/${finalError.code}\`` : ""}\n`;
  await writeArtifactSet({ artifactDir, manifest, steps, responses, persistence, verdict, summary });
  try {
    await scanArtifactDirectoryForSecrets(artifactDir, [accessToken, conflictAccessToken, previewBypassToken]);
  } catch (scanError) {
    finalError = scanError;
    verdict = { ...verdict, passed: false, failure: { category: scanError.category, step: scanError.step, code: scanError.code } };
    summary += "- Artifact secret scan: **FAIL**\n";
    await writeArtifactSet({ artifactDir, manifest, steps, responses, persistence, verdict, summary });
  }
  console.log(JSON.stringify({ ok: !finalError && passed, runId, artifactDir, createdReportCount: createdSavedReportIds.length, failure: finalError ? { category: finalError.category, step: finalError.step, code: finalError.code } : null }, null, 2));
}

if (finalError) process.exitCode = 1;
