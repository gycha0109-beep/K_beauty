import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = process.cwd();
const LOCAL_HOST = "127.0.0.1";
const DEFAULT_E2E_PORT = 3001;
const ANALYZE_ROUTE = "/api/analyze";
const FIXTURE_ID = "subject-a-frontal-clear";
const MAX_IMAGE_ATTEMPTS = 1;
const AUTOMATIC_RETRY_COUNT = 0;
const SERVER_READINESS_TIMEOUT_MS = 120_000;
const ANALYZE_TIMEOUT_MS = 300_000;
const MAX_CAPTURED_LOG_BYTES = 1024 * 1024;
const REPORT_SCHEMA_VERSION = "face-lab-provider-e2e-report-v2";
const REPORT_MODE = "actual-api-analyze-single-image";
const OUTPUT_DIR = path.join(REPO_ROOT, "tmp", "face-lab-provider-e2e");
const REPORT_JSON_PATH = path.join(OUTPUT_DIR, "report.json");
const REPORT_MD_PATH = path.join(OUTPUT_DIR, "report.md");
const DIAGNOSTICS_PATH = path.join(OUTPUT_DIR, "diagnostics.log");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`unexpected_argument:${token}`);
    const key = token.slice(2);
    const next = argv[index + 1];
    result[key] = next && !next.startsWith("--") ? argv[++index] : true;
  }
  return result;
}

function assert(condition, code) {
  if (!condition) throw new Error(code);
}

function resolvePort(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  const text = String(value).trim();
  assert(/^\d+$/.test(text), "invalid_local_port");
  const port = Number(text);
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535, "invalid_local_port");
  return port;
}

function localBaseUrl(port) {
  return `http://${LOCAL_HOST}:${port}`;
}

function isLocalUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function sanitizeDiagnosticText(value) {
  return String(value || "")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED_OPENAI_KEY]")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, "$1[REDACTED]")
    .replace(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/g, "[REDACTED_JWT]")
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, "[REDACTED_IMAGE_DATA]")
    .replace(/(postgres(?:ql)?:\/\/[^:/\s]+:)[^@\s]+@/gi, "$1[REDACTED]@")
    .replace(/[A-Za-z0-9+/]{512,}={0,2}/g, "[REDACTED_LONG_TOKEN]")
    .replace(/[A-Za-z]:\\[^\r\n]+/g, "[REDACTED_LOCAL_PATH]")
    .replace(/\/home\/runner\/work\/[^\s]+/g, "[REDACTED_RUNNER_PATH]");
}

function sanitizeApplicationError(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  for (const key of ["code", "error", "status", "reason"]) {
    const value = payload[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, 120);
    if (/^[A-Za-z0-9_.:-]{1,120}$/.test(trimmed)) return trimmed;
  }
  return null;
}

function appendCapturedLog(capture, chunk) {
  if (capture.logBytes >= MAX_CAPTURED_LOG_BYTES) return;
  const text = String(chunk || "");
  const remaining = MAX_CAPTURED_LOG_BYTES - capture.logBytes;
  const clipped = text.slice(0, remaining);
  capture.logs += clipped;
  capture.logBytes += Buffer.byteLength(clipped, "utf8");
}

function resolveFixture(manifest, fixtureId) {
  assert(manifest?.schemaVersion === "face-lab-hosted-eval-manifest-v1", "manifest_schema_invalid");
  assert(Array.isArray(manifest.fixtures), "manifest_fixtures_invalid");
  const fixture = manifest.fixtures.find((item) => item?.fixtureId === fixtureId);
  assert(fixture, `fixture_missing:${fixtureId}`);
  assert(fixture.consentConfirmed === true, `fixture_consent_missing:${fixtureId}`);
  const portablePath = String(fixture.imagePath || "").replaceAll("\\", "/");
  assert(portablePath.startsWith("private/face-lab-fixtures/"), `fixture_path_invalid:${fixtureId}`);
  const absolutePath = path.resolve(REPO_ROOT, portablePath);
  const fixtureRoot = path.resolve(REPO_ROOT, "private", "face-lab-fixtures") + path.sep;
  assert(absolutePath.startsWith(fixtureRoot), `fixture_path_escape:${fixtureId}`);
  assert(existsSync(absolutePath), `fixture_file_missing:${fixtureId}`);
  return {
    fixtureId,
    absolutePath,
    mimeType: fixture.declaredMime || (portablePath.endsWith(".png") ? "image/png" : "image/jpeg")
  };
}

function startNextServer(capture, port) {
  const nextBin = path.join(REPO_ROOT, "node_modules", "next", "dist", "bin", "next");
  assert(existsSync(nextBin), "next_binary_missing");
  const child = spawn(process.execPath, [nextBin, "dev", "-H", LOCAL_HOST, "-p", String(port)], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CI: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      LOCAL_SHADOW_PROVIDER_STUB: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => appendCapturedLog(capture, chunk));
  child.stderr.on("data", (chunk) => appendCapturedLog(capture, chunk));
  return child;
}

async function waitForServerReadiness(child, baseUrl, timeoutMs = SERVER_READINESS_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("SERVER_READINESS_FAILED");
    }
    try {
      const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
      await response.arrayBuffer();
      lastStatus = response.status;
      if (response.status < 500) return;
    } catch {
      // The existing public application route is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  void lastStatus;
  throw new Error("SERVER_READINESS_FAILED");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return true;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000))
    ]);
  }
  return child.exitCode !== null || child.signalCode !== null;
}

function createAnalyzeForm(fixture) {
  const bytes = readFileSync(fixture.absolutePath);
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: fixture.mimeType }), path.basename(fixture.absolutePath));
  const fields = {
    skinType: "combination",
    sensitivity: "medium",
    mainConcern: "pores",
    mainConcerns: JSON.stringify(["pores", "dehydration"]),
    primaryConcern: "pores",
    recentSkinChange: "unknown",
    recentlyChangedProduct: "unknown",
    cleansingFrequency: "twice",
    preferredTexture: "lotion",
    postWashFeeling: "comfortable",
    afternoonSkinChange: "mostly_same",
    environmentExposure: JSON.stringify([]),
    mostDislikedFeel: "sticky",
    genderPreference: "unspecified",
    whiteCastHate: "false",
    toneUpWanted: "false",
    makeupUse: "false",
    eyeSensitive: "false",
    sunscreenPreferenceState: "unknown",
    outdoorExposure: "false",
    verySensitivePeriod: "false",
    locale: "ko"
  };
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

function extractUsageEvents(logText) {
  const segments = String(logText || "").split("[vision-observation-usage]").slice(1);
  return segments.map((segment) => {
    const sample = segment.slice(0, 1200);
    const matched = sample.match(/imageProviderAttemptCount:\s*(\d+|null)/);
    return {
      imageProviderAttemptCount:
        matched && matched[1] !== "null" ? Number(matched[1]) : null
    };
  });
}

async function runAnalyzeProviderSmoke(fixture, baseUrl, state) {
  let form;
  try {
    form = createAnalyzeForm(fixture);
    state.requestPrepared = true;
  } catch {
    throw new Error("ANALYZE_REQUEST_PREPARATION_FAILED");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ANALYZE_TIMEOUT_MS);
  let response;
  try {
    assert(state.imageBearingRequestsDispatched < MAX_IMAGE_ATTEMPTS, "PROVIDER_ATTEMPT_COUNT_INVALID");
    state.requestDispatched = true;
    state.imageBearingRequestsDispatched += 1;
    response = await fetch(`${baseUrl}${ANALYZE_ROUTE}`, {
      method: "POST",
      headers: { "Idempotency-Key": randomUUID() },
      body: form,
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("ANALYZE_TIMEOUT");
    throw new Error("ANALYZE_FETCH_FAILED");
  } finally {
    clearTimeout(timeout);
  }

  state.responseReceived = true;
  state.httpStatus = response.status;
  const payload = await response.json().catch(() => null);
  state.sanitizedApplicationError = sanitizeApplicationError(payload);
  if (!response.ok) throw new Error("ANALYZE_HTTP_FAILED");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("ANALYZE_RESPONSE_CONTRACT_FAILED");
  }

  state.responseReportedImageProviderAttempts =
    Number.isSafeInteger(payload.meta?.imageProviderAttemptCount)
      ? payload.meta.imageProviderAttemptCount
      : null;
  state.analysisRunIdPresent = typeof payload.analysisRunId === "string" && payload.analysisRunId.length > 0;
  state.resultWriteGrantPresent = Boolean(response.headers.get("x-kbeauty-result-write-token"));
  state.trackWriteGrantPresent = Boolean(response.headers.get("x-kbeauty-track-write-token"));
  state.faceLabPresent = Boolean(
    payload.faceLab && typeof payload.faceLab === "object" && !Array.isArray(payload.faceLab)
  );

  const contractPassed =
    payload.meta?.schemaVersion === 2 &&
    typeof payload.summary === "string" &&
    "topPick" in payload &&
    Array.isArray(payload.morning) &&
    Array.isArray(payload.night) &&
    state.analysisRunIdPresent &&
    state.resultWriteGrantPresent &&
    state.trackWriteGrantPresent &&
    state.faceLabPresent;
  state.responseContractPassed = contractPassed;
  if (!contractPassed) throw new Error("ANALYZE_RESPONSE_CONTRACT_FAILED");
  if (state.responseReportedImageProviderAttempts !== MAX_IMAGE_ATTEMPTS) {
    throw new Error("PROVIDER_ATTEMPT_COUNT_INVALID");
  }
}

function buildMarkdown(report) {
  return [
    "# Face Lab Provider E2E Report",
    "",
    `- Schema: ${report.schemaVersion}`,
    `- Mode: ${report.mode}`,
    `- Fixture: ${report.fixtureId}`,
    `- Request prepared: ${report.requestPrepared}`,
    `- Request dispatched: ${report.requestDispatched}`,
    `- Response received: ${report.responseReceived}`,
    `- HTTP status: ${report.httpStatus ?? "N/A"}`,
    `- Response contract passed: ${report.responseContractPassed}`,
    `- Image-bearing requests dispatched: ${report.imageBearingRequestsDispatched}`,
    `- Response-reported image Provider attempts: ${report.responseReportedImageProviderAttempts ?? "N/A"}`,
    `- Vision usage event count: ${report.visionUsageEventCount}`,
    `- Provider usage observed: ${report.providerUsageObserved}`,
    `- Automatic retries: ${report.automaticRetries}`,
    `- Server cleanup completed: ${report.serverCleanupCompleted}`,
    `- Final verdict: ${report.finalVerdict}`,
    `- Failure code: ${report.failureCode ?? "N/A"}`,
    "",
    "## Safety",
    "",
    "- Temporary API routes: 0",
    "- Text Provider preflight calls: 0",
    "- Production deployment: 0",
    "- Hosted Supabase access: 0",
    "- Remote schema mutation: 0",
    "- Raw Provider response persisted: 0",
    "- Plaintext fixture artifact uploaded: 0",
    ""
  ].join("\n");
}

function writeReport(report, diagnostics) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD_PATH, buildMarkdown(report), "utf8");
  const sanitized = sanitizeDiagnosticText(diagnostics).split(/\r?\n/).slice(-250).join("\n");
  if (sanitized) writeFileSync(DIAGNOSTICS_PATH, `${sanitized}\n`, "utf8");
}

function classifyFailure(error, state) {
  const code = error instanceof Error ? error.message : "UNKNOWN_FIRST_BLOCKER";
  const allowedCodes = new Set([
    "SERVER_READINESS_FAILED",
    "ANALYZE_REQUEST_PREPARATION_FAILED",
    "ANALYZE_FETCH_FAILED",
    "ANALYZE_TIMEOUT",
    "ANALYZE_HTTP_FAILED",
    "ANALYZE_RESPONSE_CONTRACT_FAILED",
    "PROVIDER_USAGE_EVENT_MISSING",
    "PROVIDER_ATTEMPT_COUNT_INVALID",
    "REPORT_OR_CLEANUP_FAILED",
    "POTENTIAL_SECRET_EXPOSURE_DETECTED",
    "UNKNOWN_FIRST_BLOCKER"
  ]);
  if (allowedCodes.has(code)) return code;
  if (!state.requestPrepared && /^manifest_|^fixture_/.test(code)) {
    return "ANALYZE_REQUEST_PREPARATION_FAILED";
  }
  return "UNKNOWN_FIRST_BLOCKER";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(REPO_ROOT, String(args.manifest || "manifest.local.json"));
  const capture = { logs: "", logBytes: 0 };
  const state = {
    head: process.env.GITHUB_SHA || "local",
    schemaVersion: REPORT_SCHEMA_VERSION,
    mode: REPORT_MODE,
    fixtureId: FIXTURE_ID,
    requestPrepared: false,
    requestDispatched: false,
    responseReceived: false,
    httpStatus: null,
    responseContractPassed: false,
    imageBearingRequestsDispatched: 0,
    responseReportedImageProviderAttempts: null,
    visionUsageEventCount: 0,
    providerUsageObserved: false,
    automaticRetries: AUTOMATIC_RETRY_COUNT,
    analysisRunIdPresent: false,
    resultWriteGrantPresent: false,
    trackWriteGrantPresent: false,
    faceLabPresent: false,
    serverCleanupCompleted: false,
    finalVerdict: "FAIL",
    failureCode: null,
    sanitizedApplicationError: null
  };
  let server = null;

  try {
    const port = resolvePort(
      args.port ?? process.env.FACE_LAB_PROVIDER_E2E_PORT,
      DEFAULT_E2E_PORT
    );
    const baseUrl = localBaseUrl(port);
    assert(MAX_IMAGE_ATTEMPTS === 1, "PROVIDER_ATTEMPT_COUNT_INVALID");
    assert(AUTOMATIC_RETRY_COUNT === 0, "PROVIDER_ATTEMPT_COUNT_INVALID");
    assert(typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.trim(), "openai_secret_missing");
    assert(isLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL), "remote_supabase_url_rejected");
    assert(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "local_supabase_anon_key_missing");
    assert(process.env.SUPABASE_SERVICE_ROLE_KEY, "local_supabase_service_role_key_missing");
    assert(process.env.ANALYSIS_REQUEST_GUARD_SECRET, "analysis_guard_secret_missing");
    assert(process.env.ANONYMOUS_WRITE_GRANT_SECRET, "anonymous_write_grant_secret_missing");
    assert(existsSync(manifestPath), "manifest_missing");

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const fixture = resolveFixture(manifest, FIXTURE_ID);
    server = startNextServer(capture, port);
    await waitForServerReadiness(server, baseUrl);
    await runAnalyzeProviderSmoke(fixture, baseUrl, state);

    const usageEvents = extractUsageEvents(capture.logs);
    state.visionUsageEventCount = usageEvents.length;
    state.providerUsageObserved = usageEvents.length > 0;
    if (
      usageEvents.length !== MAX_IMAGE_ATTEMPTS ||
      !usageEvents.every((event) => event.imageProviderAttemptCount === MAX_IMAGE_ATTEMPTS)
    ) {
      throw new Error("PROVIDER_USAGE_EVENT_MISSING");
    }
    assert(state.imageBearingRequestsDispatched === MAX_IMAGE_ATTEMPTS, "PROVIDER_ATTEMPT_COUNT_INVALID");
    state.finalVerdict = "FINAL_PROVIDER_E2E_PASS";
  } catch (error) {
    state.failureCode = classifyFailure(error, state);
  } finally {
    try {
      state.serverCleanupCompleted = await stopChild(server);
    } catch {
      state.serverCleanupCompleted = false;
    }
    if (!state.serverCleanupCompleted && !state.failureCode) {
      state.failureCode = "REPORT_OR_CLEANUP_FAILED";
      state.finalVerdict = "FAIL";
    }
    state.visionUsageEventCount = extractUsageEvents(capture.logs).length;
    state.providerUsageObserved = state.visionUsageEventCount > 0;
    writeReport(state, capture.logs);
  }

  if (state.finalVerdict === "FINAL_PROVIDER_E2E_PASS") {
    console.log("[face-lab-provider-e2e] PASS");
    return;
  }
  console.error(`[face-lab-provider-e2e] failed=${state.failureCode || "UNKNOWN_FIRST_BLOCKER"}`);
  process.exitCode = 1;
}

await main();
