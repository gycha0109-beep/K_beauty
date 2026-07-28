import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
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
  safeErrorCode,
  safeResponseContract,
  scanArtifactDirectoryForSecrets,
  writeArtifactSet
} from "./premium-browser-journey-core.mjs";
import {
  LOCAL_ARTIFACT_ROOT,
  LOCAL_CONFIG_PATH,
  LOCAL_PROFILE_A_PATH,
  LOCAL_STORAGE_A_PATH,
  LOCAL_SYNTHETIC_IMAGE_PATH,
  assertGitWorktreeClean,
  ensureLocalRuntime,
  getGitBranch,
  getGitHead,
  loadBootstrapMetadata,
  parseCliArgs,
  readJsonIfPresent,
  writeSyntheticImageFixture
} from "./premium-browser-journey-local-auth.mjs";
import { captureAccountSessionResilient } from "./premium-e2e-session-capture.mjs";
import {
  createPremiumSessionDiagnosticId,
  PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER,
  PREMIUM_SESSION_RUNTIME_COMMIT_HEADER
} from "../lib/premium-session-payload-diagnostics.js";
import {
  PREMIUM_SNAPSHOT_REPLAY_DIFF_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_EXISTING_FINGERPRINT_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_NEXT_FINGERPRINT_HEADER,
  PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER
} from "../lib/premium-snapshot-replay-diagnostics.js";
import { buildPremiumReportSnapshot } from "../lib/premium-report-snapshot.js";

function runCleanup(env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [resolve("scripts/cleanup-premium-browser-journey.mjs")], {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: false
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => resolvePromise(typeof code === "number" ? code : 1));
  });
}

function responseHeaders(response) {
  return {
    runtimeCommit: response.headers.get(PREMIUM_SESSION_RUNTIME_COMMIT_HEADER),
    replayStatus: response.headers.get(PREMIUM_SNAPSHOT_REPLAY_STATUS_HEADER),
    diffPaths: String(response.headers.get(PREMIUM_SNAPSHOT_REPLAY_DIFF_HEADER) || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 4),
    existingFingerprint: response.headers.get(
      PREMIUM_SNAPSHOT_REPLAY_EXISTING_FINGERPRINT_HEADER
    ),
    nextFingerprint: response.headers.get(PREMIUM_SNAPSHOT_REPLAY_NEXT_FINGERPRINT_HEADER)
  };
}

const args = parseCliArgs();
await ensureLocalRuntime();
assertGitWorktreeClean();

const storedConfig = await readJsonIfPresent(LOCAL_CONFIG_PATH);
const baseUrl = normalizeBaseUrl(args.url || storedConfig?.baseUrl);
const branch = getGitBranch();
const head = getGitHead();
requireCondition(
  branch === "integration/premium-browser-journey-main-sec-baseline",
  FAILURE_CATEGORIES.PRECONDITION,
  "configuration",
  "unexpected_branch"
);
requireCondition(
  storedConfig?.branch === branch,
  FAILURE_CATEGORIES.PRECONDITION,
  "configuration",
  "current_branch_not_bootstrap_branch"
);
const bootstrapMetadata = await loadBootstrapMetadata(baseUrl);
const previewBypassToken = String(
  args["preview-bypass-token"] || process.env.PREMIUM_E2E_PREVIEW_BYPASS_TOKEN || ""
).trim();
const extraHTTPHeaders = previewBypassToken
  ? {
      "x-vercel-protection-bypass": previewBypassToken,
      "x-vercel-set-bypass-cookie": "true"
    }
  : {};

if (!existsSync(LOCAL_SYNTHETIC_IMAGE_PATH)) await writeSyntheticImageFixture();
const account = await captureAccountSessionResilient({
  label: "A",
  profilePath: LOCAL_PROFILE_A_PATH,
  storageStatePath: LOCAL_STORAGE_A_PATH,
  baseUrl,
  previewBypassToken
});
requireCondition(
  account.userHash === bootstrapMetadata.accountAHash,
  FAILURE_CATEGORIES.AUTH,
  "auth-user-lookup",
  "bootstrap_account_identity_changed"
);

const [storageState, imageFixture] = await Promise.all([
  loadJsonFile(LOCAL_STORAGE_A_PATH, "storage_state"),
  loadImageFixture(LOCAL_SYNTHETIC_IMAGE_PATH)
]);
inspectStorageState(storageState, baseUrl.hostname);

const accountUser = await fetchAuthUser({
  supabaseUrl: account.supabaseUrl,
  anonKey: account.anonKey,
  accessToken: account.accessToken
});
requireCondition(
  hashIdentifier(accountUser.id) === account.userHash && accountUser.is_anonymous === false,
  FAILURE_CATEGORIES.AUTH,
  "auth-user-lookup",
  "unexpected_test_account"
);

const diagnosticId = createPremiumSessionDiagnosticId();
const runId = createRunId(`premium-identical-retry-${Date.now()}`);
const artifactDir = getArtifactDir(LOCAL_ARTIFACT_ROOT, runId);
const reportBody = { locale: "ko", currentProducts: [] };
const steps = [];
const responses = [];
const createdSavedReportIds = [];
const persistenceRecords = [];
const checks = [];
let browser = null;
let firstId = null;
let firstFingerprint = null;
let firstRow = null;
let retryContract = null;
let finalError = null;

function recordStep(name, status, httpStatus = null, errorCode = null) {
  steps.push({ name, status, httpStatus, errorCode });
}

function authHeaders() {
  return {
    ...extraHTTPHeaders,
    Authorization: `Bearer ${account.accessToken}`,
    [PREMIUM_SESSION_DIAGNOSTIC_REQUEST_HEADER]: diagnosticId
  };
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState, extraHTTPHeaders });
  await context.clearCookies({ name: PREMIUM_COOKIE_NAME });

  const analyzeResponse = await context.request.post(`${baseUrl.origin}/api/analyze`, {
    headers: authHeaders(),
    multipart: {
      image: {
        name: imageFixture.name,
        mimeType: imageFixture.mimeType,
        buffer: imageFixture.buffer
      },
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
      locale: "ko"
    }
  });
  const analyze = await parseApiResponse(analyzeResponse);
  responses.push(safeResponseContract("ko:analyze", analyze));
  requireCondition(
    analyze.status === 200,
    FAILURE_CATEGORIES.INFRASTRUCTURE,
    "ko:analyze",
    safeErrorCode(analyze)
  );
  requireCondition(
    analyzeResponse.headers.get(PREMIUM_SESSION_RUNTIME_COMMIT_HEADER) === head,
    FAILURE_CATEGORIES.INFRASTRUCTURE,
    "ko:analyze",
    "runtime_commit_mismatch"
  );
  recordStep("ko:analyze", "passed", analyze.status);

  const cookies = (await context.cookies()).filter((cookie) => cookie.name === PREMIUM_COOKIE_NAME);
  requireCondition(
    cookies.length === 1 &&
      cookies[0].httpOnly &&
      cookies[0].secure &&
      cookies[0].sameSite === "Lax" &&
      cookies[0].path === "/api/full-report",
    FAILURE_CATEGORIES.SESSION,
    "ko:premium-cookie",
    "premium_cookie_contract_invalid"
  );
  recordStep("ko:premium-cookie", "passed", 200);

  const firstResponse = await context.request.post(`${baseUrl.origin}/api/full-report`, {
    headers: authHeaders(),
    data: reportBody
  });
  const first = await parseApiResponse(firstResponse);
  responses.push(safeResponseContract("ko:first-save", first));
  requireCondition(
    first.status === 200 && first.body?.meta?.persistence?.status === "saved",
    FAILURE_CATEGORIES.PERSISTENCE,
    "ko:first-save",
    safeErrorCode(first)
  );
  firstId = first.body?.meta?.persistence?.savedReportId;
  firstFingerprint = first.body?.meta?.snapshot?.fingerprint;
  requireCondition(
    typeof firstId === "string" && /^[0-9a-f]{64}$/i.test(firstFingerprint || ""),
    FAILURE_CATEGORIES.PERSISTENCE,
    "ko:first-save",
    "first_save_contract_missing"
  );
  createdSavedReportIds.push(firstId);
  firstRow = await fetchSavedReportById(
    {
      supabaseUrl: account.supabaseUrl,
      anonKey: account.anonKey,
      accessToken: account.accessToken
    },
    firstId
  );
  const firstSnapshot = buildPremiumReportSnapshot(firstRow?.premium_report);
  requireCondition(
    firstSnapshot?.fingerprint === firstFingerprint,
    FAILURE_CATEGORIES.PERSISTENCE,
    "ko:first-save",
    "response_db_fingerprint_mismatch"
  );
  persistenceRecords.push(
    buildPersistenceEvidence({
      row: firstRow,
      snapshot: firstSnapshot,
      responseFingerprint: firstFingerprint
    })
  );
  recordStep("ko:first-save", "passed", first.status);

  const retryResponse = await context.request.post(`${baseUrl.origin}/api/full-report`, {
    headers: authHeaders(),
    data: reportBody
  });
  const retry = await parseApiResponse(retryResponse);
  const replayHeaders = responseHeaders(retryResponse);
  responses.push(safeResponseContract("ko:identical-retry", retry));
  retryContract = {
    status: retry.status,
    errorCode: safeErrorCode(retry),
    persistenceStatus: retry.body?.meta?.persistence?.status || null,
    fingerprint: retry.body?.meta?.snapshot?.fingerprint || null,
    replayStatus: replayHeaders.replayStatus,
    diffPaths: replayHeaders.diffPaths,
    existingFingerprint: replayHeaders.existingFingerprint,
    nextFingerprint: replayHeaders.nextFingerprint
  };

  const afterRetry = await fetchSavedReportById(
    {
      supabaseUrl: account.supabaseUrl,
      anonKey: account.anonKey,
      accessToken: account.accessToken
    },
    firstId
  );
  assert.equal(afterRetry?.updated_at, firstRow?.updated_at);
  assert.deepEqual(afterRetry?.premium_report, firstRow?.premium_report);
  const rows = await fetchPremiumSessionRows({
    supabaseUrl: account.supabaseUrl,
    anonKey: account.anonKey,
    accessToken: account.accessToken
  });
  const duplicateSourceTupleCount = countDuplicateSourceTuples(rows);
  checks.push({ name: "saved_row_updated_at_unchanged", passed: true });
  checks.push({
    name: "source_tuple_duplicates_zero",
    passed: duplicateSourceTupleCount === 0
  });

  requireCondition(
    retry.status === 200 &&
      retry.body?.meta?.persistence?.status === "existing" &&
      retry.body?.meta?.persistence?.savedReportId === firstId &&
      retry.body?.meta?.snapshot?.fingerprint === firstFingerprint,
    FAILURE_CATEGORIES.IMMUTABILITY,
    "ko:identical-retry",
    "retry_not_existing"
  );
  requireCondition(
    duplicateSourceTupleCount === 0,
    FAILURE_CATEGORIES.PERSISTENCE,
    "ko:identical-retry",
    "duplicate_source_tuple"
  );
  recordStep("ko:identical-retry", "passed", retry.status);
} catch (error) {
  finalError =
    error instanceof JourneyFailure
      ? error
      : new JourneyFailure(
          FAILURE_CATEGORIES.HARNESS,
          "targeted-identical-retry",
          "unhandled_error",
          error?.message || "unhandled_error"
        );
  recordStep(finalError.step, "failed", retryContract?.status || null, finalError.code);
} finally {
  if (browser) await browser.close();
}

const manifest = {
  runId,
  environment: "preview",
  targetHost: baseUrl.hostname,
  targetGitSha: head,
  expectedGitSha: head,
  accountHash: account.userHash,
  fixture: getFixtureMetadata(imageFixture)
};
const persistence = {
  createdSavedReportIds,
  records: persistenceRecords,
  duplicateSourceTupleCount:
    checks.find((check) => check.name === "source_tuple_duplicates_zero")?.passed === true ? 0 : null,
  cleanupRequired: createdSavedReportIds.length > 0
};
const verdict = {
  passed: !finalError,
  failure: finalError
    ? { category: finalError.category, step: finalError.step, code: finalError.code }
    : null,
  checks,
  retryContract
};
await writeArtifactSet({
  artifactDir,
  manifest,
  steps,
  responses,
  persistence,
  verdict,
  summary: `# Premium identical retry diagnostic\n\n- Run ID: \`${runId}\`\n- Result: **${finalError ? "FAIL" : "PASS"}**\n- Created test reports: ${createdSavedReportIds.length}\n`
});
await scanArtifactDirectoryForSecrets(artifactDir, [
  account.accessToken,
  previewBypassToken
]);

let cleanupCode = 0;
if (createdSavedReportIds.length) {
  cleanupCode = await runCleanup({
    ...process.env,
    PREMIUM_E2E_BASE_URL: baseUrl.origin,
    PREMIUM_E2E_ENVIRONMENT: "preview",
    PREMIUM_E2E_EXPECTED_HOST: baseUrl.hostname,
    PREMIUM_E2E_EXPECTED_SHA: head,
    PREMIUM_E2E_DEPLOYMENT_SHA: head,
    PREMIUM_E2E_ACCESS_TOKEN: account.accessToken,
    PREMIUM_E2E_SUPABASE_URL: account.supabaseUrl,
    PREMIUM_E2E_SUPABASE_ANON_KEY: account.anonKey,
    PREMIUM_E2E_DEDICATED_ACCOUNT_CONFIRMATION: DEDICATED_ACCOUNT_CONFIRMATION,
    PREMIUM_E2E_PREVIEW_BYPASS_TOKEN: previewBypassToken,
    PREMIUM_E2E_ARTIFACT_DIR: artifactDir,
    PREMIUM_E2E_CLEANUP_CONFIRM: `DELETE_TEST_REPORTS_${runId}`
  });
}

const cleanupCompleted = cleanupCode === 0;
console.log(
  JSON.stringify(
    {
      ok: !finalError && cleanupCompleted,
      runId,
      artifactDir,
      analyzeStatus: responses.find((item) => item.name === "ko:analyze")?.status || null,
      premiumCookieCount: steps.some(
        (step) => step.name === "ko:premium-cookie" && step.status === "passed"
      )
        ? 1
        : 0,
      firstSaveStatus:
        responses.find((item) => item.name === "ko:first-save")?.persistenceStatus || null,
      retry: retryContract,
      savedRowUpdatedAtUnchanged:
        checks.find((check) => check.name === "saved_row_updated_at_unchanged")?.passed || false,
      duplicateSourceTupleCount: persistence.duplicateSourceTupleCount,
      cleanupCompleted,
      createdReportCount: createdSavedReportIds.length,
      remainingReportCount: cleanupCompleted ? 0 : null,
      failure: finalError
        ? { category: finalError.category, step: finalError.step, code: finalError.code }
        : null
    },
    null,
    2
  )
);

if (!cleanupCompleted) process.exitCode = 2;
else if (finalError) process.exitCode = 1;
