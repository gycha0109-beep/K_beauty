import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import process from "node:process";

const REPO_ROOT = process.cwd();
const BASE_URL = "http://127.0.0.1:3001";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = "gpt-4o-mini";
const LANE_A_FIXTURE_ID = "subject-a-frontal-clear";
const LANE_B_FIXTURE_ID = "subject-a-lower-face-occluded";
const MAX_IMAGE_ATTEMPTS = 2;
const AUTOMATIC_RETRY_COUNT = 0;
const OUTPUT_DIR = path.join(REPO_ROOT, "tmp", "face-lab-provider-e2e");
const REPORT_JSON_PATH = path.join(OUTPUT_DIR, "report.json");
const REPORT_MD_PATH = path.join(OUTPUT_DIR, "report.md");
const DIAGNOSTICS_PATH = path.join(OUTPUT_DIR, "diagnostics.log");
const HARNESS_ROUTE_DIR = path.join(REPO_ROOT, "app", "api", "__face-lab-provider-e2e");
const HARNESS_ROUTE_PATH = path.join(HARNESS_ROUTE_DIR, "route.js");
const MAX_CAPTURED_LOG_BYTES = 1024 * 1024;

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
    .replace(/[A-Za-z0-9+/]{512,}={0,2}/g, "[REDACTED_LONG_TOKEN]");
}

function appendCapturedLog(state, chunk) {
  if (state.logBytes >= MAX_CAPTURED_LOG_BYTES) return;
  const text = String(chunk || "");
  const remaining = MAX_CAPTURED_LOG_BYTES - state.logBytes;
  const clipped = text.slice(0, remaining);
  state.logs += clipped;
  state.logBytes += Buffer.byteLength(clipped, "utf8");
}

function classifyProviderStatus(status) {
  if (status === 401) return "authentication_failed";
  if (status === 403) return "authorization_failed";
  if (status === 429) return "rate_limited";
  if (status === 402) return "billing_required";
  if (status >= 500) return "provider_server_error";
  return `provider_http_${status}`;
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

async function providerPreflight(apiKey) {
  const startedAt = Date.now();
  const response = await fetch(OPENAI_URL, {
    method: "POST",
    redirect: "manual",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: 1,
      temperature: 0,
      messages: [{ role: "user", content: "Reply with OK." }]
    })
  });
  const durationMs = Date.now() - startedAt;
  await response.arrayBuffer();
  if (!response.ok) {
    throw new Error(`provider_gate_${classifyProviderStatus(response.status)}`);
  }
  return { status: "PASS", httpStatus: response.status, durationMs };
}

function buildHarnessRouteSource() {
  return `import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { validateImageUpload } from "@/lib/upload-validation";
import { resolveOpenAiApiKey } from "@/lib/openai-env-diagnostics";
import { analyzeVisionObservation } from "@/lib/server/vision-observation-service";
import { projectSkinObservation } from "@/lib/skin-observation-projector";
import { projectFaceLabResult } from "@/lib/face-lab-observation-projector";

export const dynamic = "force-dynamic";

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""), "utf8");
  const rightBuffer = Buffer.from(String(right || ""), "utf8");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function denied(status = 404) {
  return NextResponse.json({ error: "not_found" }, { status });
}

export async function POST(request) {
  if (process.env.NODE_ENV === "production" || process.env.FACE_LAB_PROVIDER_E2E_ENABLED !== "1") {
    return denied();
  }
  if (!safeEqual(request.headers.get("x-face-lab-e2e-token"), process.env.FACE_LAB_PROVIDER_E2E_TOKEN)) {
    return denied(403);
  }

  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const validation = validateImageUpload(image);
    if (!validation.ok || typeof image?.arrayBuffer !== "function") {
      return NextResponse.json({ error: "fixture_invalid" }, { status: 400 });
    }

    const { apiKey } = resolveOpenAiApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "api_key_missing" }, { status: 503 });
    }

    const observation = await analyzeVisionObservation({
      apiKey,
      imageBuffer: Buffer.from(await image.arrayBuffer()),
      mimeType: image.type,
      model: "gpt-4o-mini"
    });
    const formInput = {
      skinType: "combination",
      sensitivity: "medium",
      mainConcern: "pores",
      mainConcerns: ["pores", "dehydration"],
      primaryConcern: "pores"
    };

    return NextResponse.json({
      ok: true,
      canonical: {
        schemaVersion: observation.bundle?.schemaVersion || null,
        status: observation.bundle?.status || null,
        skinStatus: observation.bundle?.skin?.status || null,
        faceStatus: observation.bundle?.face?.status || null,
        skinAnalysisEligible: observation.bundle?.eligibility?.skinAnalysisEligible === true,
        faceLabEligible: observation.bundle?.eligibility?.faceLabEligible === true
      },
      telemetry: observation.telemetry,
      projections: {
        skin: {
          ko: projectSkinObservation(observation.bundle, { locale: "ko", formInput }),
          en: projectSkinObservation(observation.bundle, { locale: "en", formInput })
        },
        face: {
          ko: projectFaceLabResult(observation.bundle, { locale: "ko" }),
          en: projectFaceLabResult(observation.bundle, { locale: "en" })
        }
      },
      projectionProviderCallCount: 0
    });
  } catch {
    return NextResponse.json({ error: "provider_execution_failed" }, { status: 502 });
  }
}
`;
}

function materializeHarnessRoute() {
  assert(!existsSync(HARNESS_ROUTE_PATH), "temporary_harness_route_already_exists");
  mkdirSync(HARNESS_ROUTE_DIR, { recursive: true });
  writeFileSync(HARNESS_ROUTE_PATH, buildHarnessRouteSource(), "utf8");
}

function removeHarnessRoute() {
  rmSync(HARNESS_ROUTE_DIR, { recursive: true, force: true });
}

function startNextServer(token, state) {
  const nextBin = path.join(REPO_ROOT, "node_modules", "next", "dist", "bin", "next");
  assert(existsSync(nextBin), "next_binary_missing");
  const child = spawn(process.execPath, [nextBin, "dev", "-H", "127.0.0.1", "-p", "3001"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      CI: "1",
      NEXT_TELEMETRY_DISABLED: "1",
      FACE_LAB_PROVIDER_E2E_ENABLED: "1",
      FACE_LAB_PROVIDER_E2E_TOKEN: token,
      LOCAL_SHADOW_PROVIDER_STUB: "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => appendCapturedLog(state, chunk));
  child.stderr.on("data", (chunk) => appendCapturedLog(state, chunk));
  return child;
}

async function waitForServer(child, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next_server_exited:${child.exitCode}`);
    try {
      const response = await fetch(`${BASE_URL}/`, { redirect: "manual" });
      await response.arrayBuffer();
      if (response.status < 500) return;
    } catch {
      // Server is still compiling.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("next_server_start_timeout");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5000))
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

function createImageForm(fixture) {
  const bytes = readFileSync(fixture.absolutePath);
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: fixture.mimeType }), path.basename(fixture.absolutePath));
  return form;
}

function assertProjectionObject(value, code) {
  assert(value && typeof value === "object" && !Array.isArray(value), code);
}

async function runLaneB(fixture, token) {
  const form = createImageForm(fixture);
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/api/__face-lab-provider-e2e`, {
    method: "POST",
    headers: { "x-face-lab-e2e-token": token },
    body: form
  });
  const durationMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => null);
  assert(response.ok && payload?.ok === true, `lane_b_http_${response.status}`);
  assert(payload.canonical?.schemaVersion === "vision-observation-v1", "lane_b_schema_invalid");
  assert(payload.telemetry?.imageProviderAttemptCount === 1, "lane_b_attempt_count_invalid");
  assert(payload.projectionProviderCallCount === 0, "lane_b_projection_provider_call_detected");
  assertProjectionObject(payload.projections?.skin?.ko, "lane_b_skin_ko_missing");
  assertProjectionObject(payload.projections?.skin?.en, "lane_b_skin_en_missing");
  assertProjectionObject(payload.projections?.face?.ko, "lane_b_face_ko_missing");
  assertProjectionObject(payload.projections?.face?.en, "lane_b_face_en_missing");
  assert(
    payload.projections.face.ko.status === payload.projections.face.en.status,
    "lane_b_face_locale_status_mismatch"
  );
  return {
    status: "PASS",
    fixtureId: fixture.fixtureId,
    durationMs,
    canonicalStatus: payload.canonical.status,
    skinStatus: payload.canonical.skinStatus,
    faceStatus: payload.canonical.faceStatus,
    inputTokens: payload.telemetry.inputTokens,
    outputTokens: payload.telemetry.outputTokens,
    imageProviderAttemptCount: 1,
    projectionProviderCallCount: 0,
    koEnProjectionPresent: true
  };
}

function appendAnalyzeFields(form) {
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
}

async function runLaneA(fixture) {
  const form = createImageForm(fixture);
  appendAnalyzeFields(form);
  const startedAt = Date.now();
  const response = await fetch(`${BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "Idempotency-Key": randomUUID() },
    body: form
  });
  const durationMs = Date.now() - startedAt;
  const payload = await response.json().catch(() => null);
  assert(response.ok && payload, `lane_a_http_${response.status}`);
  assert(payload.meta?.schemaVersion !== 2 ? false : true, "lane_a_response_schema_invalid");
  assert(payload.meta?.imageProviderAttemptCount === 1, "lane_a_attempt_count_invalid");
  assert(payload.faceLab && typeof payload.faceLab === "object", "lane_a_face_lab_missing");
  assert(typeof payload.summary === "string", "lane_a_summary_missing");
  assert("topPick" in payload, "lane_a_top_pick_contract_missing");
  assert(Array.isArray(payload.morning), "lane_a_morning_contract_missing");
  assert(Array.isArray(payload.night), "lane_a_night_contract_missing");
  assert(response.headers.get("x-kbeauty-result-write-token"), "lane_a_result_write_grant_missing");
  assert(response.headers.get("x-kbeauty-track-write-token"), "lane_a_track_write_grant_missing");
  assert(typeof payload.analysisRunId === "string" && payload.analysisRunId, "lane_a_analysis_run_id_missing");
  return {
    status: "PASS",
    fixtureId: fixture.fixtureId,
    durationMs,
    schemaVersion: payload.meta.schemaVersion,
    imageProviderAttemptCount: 1,
    faceLabStatus: payload.faceLab.status || null,
    anonymousWriteGrant: "PASS",
    analysisGuard: "PASS",
    responseContract: "PASS"
  };
}

function extractUsageEvents(logText) {
  const segments = String(logText || "").split("[vision-observation-usage]").slice(1);
  return segments.map((segment) => {
    const sample = segment.slice(0, 1200);
    const number = (name) => {
      const matched = sample.match(new RegExp(`${name}:\\s*(\\d+|null)`));
      return matched && matched[1] !== "null" ? Number(matched[1]) : null;
    };
    return {
      inputTokens: number("inputTokens"),
      outputTokens: number("outputTokens"),
      imageProviderAttemptCount: number("imageProviderAttemptCount")
    };
  });
}

function buildMarkdown(report) {
  return [
    "# Face Lab Provider E2E Report",
    "",
    `- HEAD: ${report.head}`,
    `- Provider Gate: ${report.providerGate.status}`,
    `- Lane B: ${report.laneB.status}`,
    `- Lane A: ${report.laneA.status}`,
    `- Image-bearing attempts: ${report.imageBearingAttempts}`,
    `- Automatic retries: ${report.automaticRetries}`,
    `- Final verdict: ${report.finalVerdict}`,
    "",
    "## Metrics",
    "",
    `- Provider preflight latency: ${report.providerGate.durationMs ?? "N/A"} ms`,
    `- Lane B latency: ${report.laneB.durationMs ?? "N/A"} ms`,
    `- Lane A latency: ${report.laneA.durationMs ?? "N/A"} ms`,
    `- Lane B input/output tokens: ${report.laneB.inputTokens ?? "N/A"}/${report.laneB.outputTokens ?? "N/A"}`,
    `- Captured Vision usage events: ${report.visionUsageEventCount}`,
    "",
    "## Safety",
    "",
    "- Production deployment: 0",
    "- Hosted Supabase access: 0",
    "- Remote schema mutation: 0",
    "- Raw Provider response persisted: 0",
    "- Plaintext fixture artifact uploaded: 0",
    ""
  ].join("\n");
}

function writeReport(report, diagnostics = "") {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MD_PATH, buildMarkdown(report), "utf8");
  if (diagnostics) {
    const sanitized = sanitizeDiagnosticText(diagnostics).split(/\r?\n/).slice(-250).join("\n");
    writeFileSync(DIAGNOSTICS_PATH, `${sanitized}\n`, "utf8");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifestPath = path.resolve(REPO_ROOT, String(args.manifest || "manifest.local.json"));
  const state = {
    head: process.env.GITHUB_SHA || "local",
    providerGate: { status: "NOT_RUN" },
    laneB: { status: "NOT_RUN" },
    laneA: { status: "NOT_RUN" },
    imageBearingAttempts: 0,
    automaticRetries: AUTOMATIC_RETRY_COUNT,
    visionUsageEventCount: 0,
    finalVerdict: "FAIL",
    logs: "",
    logBytes: 0
  };
  let server = null;

  try {
    assert(MAX_IMAGE_ATTEMPTS === 2, "image_attempt_budget_invalid");
    assert(typeof process.env.OPENAI_API_KEY === "string" && process.env.OPENAI_API_KEY.trim(), "openai_secret_missing");
    assert(isLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL), "remote_supabase_url_rejected");
    assert(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "local_supabase_anon_key_missing");
    assert(process.env.SUPABASE_SERVICE_ROLE_KEY, "local_supabase_service_role_key_missing");
    assert(process.env.ANALYSIS_REQUEST_GUARD_SECRET, "analysis_guard_secret_missing");
    assert(process.env.ANONYMOUS_WRITE_GRANT_SECRET, "anonymous_write_grant_secret_missing");
    assert(existsSync(manifestPath), "manifest_missing");

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const laneAFixture = resolveFixture(manifest, LANE_A_FIXTURE_ID);
    const laneBFixture = resolveFixture(manifest, LANE_B_FIXTURE_ID);

    state.providerGate = await providerPreflight(process.env.OPENAI_API_KEY.trim());
    const token = randomBytes(32).toString("hex");
    materializeHarnessRoute();
    server = startNextServer(token, state);
    await waitForServer(server);

    state.laneB = await runLaneB(laneBFixture, token);
    state.imageBearingAttempts += 1;

    state.laneA = await runLaneA(laneAFixture);
    state.imageBearingAttempts += 1;

    const usageEvents = extractUsageEvents(state.logs);
    state.visionUsageEventCount = usageEvents.length;
    assert(state.imageBearingAttempts === MAX_IMAGE_ATTEMPTS, "image_attempt_count_invalid");
    assert(usageEvents.length === MAX_IMAGE_ATTEMPTS, `vision_usage_event_count_invalid:${usageEvents.length}`);
    assert(usageEvents.every((event) => event.imageProviderAttemptCount === 1), "vision_usage_attempt_marker_invalid");
    assert(AUTOMATIC_RETRY_COUNT === 0, "automatic_retry_budget_invalid");

    state.finalVerdict = "PASS";
    writeReport(state);
    console.log("[face-lab-provider-e2e] PASS");
  } catch (error) {
    state.finalVerdict = "FAIL";
    state.failureCode = error instanceof Error ? error.message : String(error);
    if (state.laneB.status === "NOT_RUN" && state.imageBearingAttempts > 0) state.laneB.status = "FAIL";
    if (state.laneA.status === "NOT_RUN" && state.imageBearingAttempts > 1) state.laneA.status = "FAIL";
    state.visionUsageEventCount = extractUsageEvents(state.logs).length;
    writeReport(state, state.logs);
    console.error(`[face-lab-provider-e2e] failed=${state.failureCode}`);
    process.exitCode = 1;
  } finally {
    await stopChild(server);
    removeHarnessRoute();
  }
}

await main();
