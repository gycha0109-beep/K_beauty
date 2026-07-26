import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const workflowPath = ".github/workflows/face-lab-provider-e2e.yml";
const runnerPath = "scripts/face-lab-provider-e2e/run.mjs";
const packagePath = "package.json";
const anonymousGrantRuntimeVerifierPath = "scripts/verify-anonymous-write-grant-local-runtime.mjs";
const analyzeRoutePath = "app/api/analyze/route.js";
const visionServicePath = "lib/server/vision-observation-service.js";
const fixturePath = "private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc";
const temporaryRouteDirectories = [
  "app/api/face-lab-provider-e2e-harness",
  "app/api/__face-lab-provider-e2e"
];
const expectedFixtureSize = 3094224;
const expectedFixtureSha256 = "3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f";

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(source, marker) {
  return source.split(marker).length - 1;
}

function isTracked(relativePath) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0;
}

function hasTrackedFilesUnder(relativePath) {
  const result = spawnSync("git", ["ls-files", "--", relativePath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0 && Boolean(result.stdout.trim());
}

for (const requiredPath of [
  workflowPath,
  runnerPath,
  packagePath,
  anonymousGrantRuntimeVerifierPath,
  analyzeRoutePath,
  visionServicePath,
  fixturePath
]) {
  assert(existsSync(path.join(repoRoot, requiredPath)), `required_file_missing:${requiredPath}`);
}

for (const temporaryRouteDirectory of temporaryRouteDirectories) {
  assert(!isTracked(`${temporaryRouteDirectory}/route.js`), `temporary_route_must_not_be_tracked:${temporaryRouteDirectory}`);
  assert(!hasTrackedFilesUnder(temporaryRouteDirectory), `temporary_route_tree_must_not_be_tracked:${temporaryRouteDirectory}`);
  assert(!existsSync(path.join(repoRoot, temporaryRouteDirectory)), `temporary_route_must_not_exist:${temporaryRouteDirectory}`);
}

const workflow = read(workflowPath);
const runner = read(runnerPath);
const analyzeRoute = read(analyzeRoutePath);
const visionService = read(visionServicePath);
const packageJson = JSON.parse(read(packagePath));
const anonymousGrantRuntimeVerifier = read(anonymousGrantRuntimeVerifierPath);
const fixtureBytes = readFileSync(path.join(repoRoot, fixturePath));

assert(statSync(path.join(repoRoot, fixturePath)).size === expectedFixtureSize, "encrypted_fixture_size_invalid");
assert(
  createHash("sha256").update(fixtureBytes).digest("hex") === expectedFixtureSha256,
  "encrypted_fixture_sha256_invalid"
);

for (const marker of [
  "workflow_dispatch:",
  "private/face-lab-e2e/run.trigger",
  "permissions:\n  contents: read",
  "cancel-in-progress: false",
  "BUNDLE_PATH: private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc",
  "expected_size=3094224",
  `expected_sha256=${expectedFixtureSha256}`,
  "secrets.OPENAI_API_KEY",
  "secrets.FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "openssl enc -d -aes-256-cbc -pbkdf2 -iter 210000",
  "-pass env:FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "import tarfile",
  "archive.extractfile(member)",
  "frontal-clear.png",
  "lower-face-occluded.png",
  "remote_supabase_url_rejected",
  "Verify anonymous write-grant local runtime",
  "npm run anonymous-write-grant:runtime:verify",
  "Run single actual /api/analyze Provider smoke",
  "npm run face-lab:e2e:run",
  "retention-days: 3",
  "Mandatory cleanup"
]) {
  assert(workflow.includes(marker), `workflow_contract_missing:${marker}`);
}

for (const marker of [
  "Verify temporary harness route",
  "face-lab:e2e:verify-harness",
  "face-lab-provider-e2e-harness",
  "__face-lab-provider-e2e",
  "Lane B",
  "Lane A",
  "providerPreflight",
  "Reply with OK.",
  "pull_request:",
  "pull_request_target",
  "contents: write",
  "base64 --decode",
  "tar.extractall",
  "tar -xzf"
]) {
  assert(!workflow.includes(marker), `forbidden_workflow_marker:${marker}`);
}

const workflowSteps = [
  "Checkout",
  "Set up Node.js",
  "Install dependencies",
  "Verify Face Lab Provider E2E package",
  "Verify encrypted inputs and secrets",
  "Decrypt bounded fixture bundle",
  "Prepare isolated Local Supabase Replay",
  "Start and reset isolated Local Supabase",
  "Export masked local runtime variables",
  "Verify anonymous write-grant local runtime",
  "Run single actual /api/analyze Provider smoke",
  "Upload sanitized E2E report",
  "Mandatory cleanup"
];
let previousWorkflowStepIndex = -1;
for (const workflowStep of workflowSteps) {
  const workflowStepIndex = workflow.indexOf(`- name: ${workflowStep}`);
  assert(workflowStepIndex > previousWorkflowStepIndex, `workflow_step_order_invalid:${workflowStep}`);
  previousWorkflowStepIndex = workflowStepIndex;
}

for (const marker of [
  'ANALYZE_ROUTE = "/api/analyze"',
  'FIXTURE_ID = "subject-a-frontal-clear"',
  "MAX_IMAGE_ATTEMPTS = 1",
  "AUTOMATIC_RETRY_COUNT = 0",
  'LOCAL_HOST = "127.0.0.1"',
  "remote_supabase_url_rejected",
  'headers: { "Idempotency-Key": randomUUID() }',
  "state.requestPrepared = true",
  "state.requestDispatched = true",
  "state.imageBearingRequestsDispatched += 1",
  "state.responseReceived = true",
  "state.httpStatus = response.status",
  "state.responseReportedImageProviderAttempts",
  "state.responseContractPassed = contractPassed",
  "state.visionUsageEventCount",
  "state.providerUsageObserved",
  '"face-lab-provider-e2e-report-v2"',
  '"actual-api-analyze-single-image"',
  "x-kbeauty-result-write-token",
  "x-kbeauty-track-write-token",
  "payload.meta?.schemaVersion === 2",
  "payload.meta?.imageProviderAttemptCount",
  "payload.analysisRunId",
  "payload.faceLab",
  "payload.summary",
  '"topPick" in payload',
  "payload.morning",
  "payload.night",
  "[vision-observation-usage]",
  "SERVER_READINESS_FAILED",
  "ANALYZE_REQUEST_PREPARATION_FAILED",
  "ANALYZE_FETCH_FAILED",
  "ANALYZE_TIMEOUT",
  "ANALYZE_HTTP_FAILED",
  "ANALYZE_RESPONSE_CONTRACT_FAILED",
  "PROVIDER_USAGE_EVENT_MISSING",
  "PROVIDER_ATTEMPT_COUNT_INVALID",
  "REPORT_OR_CLEANUP_FAILED",
  "sanitizeApplicationError",
  "sanitizeDiagnosticText",
  "await stopChild(server)"
]) {
  assert(runner.includes(marker), `runner_contract_missing:${marker}`);
}

for (const marker of [
  "HARNESS_ROUTE_SEGMENT",
  "HARNESS_ROUTE_DIR",
  "HARNESS_ROUTE_PATH",
  "HARNESS_ROUTE_URL",
  "LEGACY_HARNESS_ROUTE_DIR",
  "buildHarnessRouteSource",
  "materializeHarnessRoute",
  "removeHarnessRoutes",
  "waitForHarnessRoute",
  "verifyHarnessRouteOnly",
  "--verify-harness-route",
  "runLaneB",
  "LANE_B_FIXTURE_ID",
  "providerPreflight",
  "Reply with OK.",
  "https://api.openai.com/v1/chat/completions",
  "Authorization:",
  "face-lab-provider-e2e-harness",
  "__face-lab-provider-e2e",
  "MAX_IMAGE_ATTEMPTS = 2",
  "providerGate",
  "laneB",
  "laneA",
  "retry("
]) {
  assert(!runner.includes(marker), `forbidden_runner_marker:${marker}`);
}

assert(count(runner, "await fetch(`${baseUrl}${ANALYZE_ROUTE}`") === 1, "analyze_dispatch_site_count_invalid");
const smokeStart = runner.indexOf("async function runAnalyzeProviderSmoke");
const reportStart = runner.indexOf("function buildMarkdown");
assert(smokeStart >= 0 && reportStart > smokeStart, "analyze_smoke_function_missing");
const smokeSource = runner.slice(smokeStart, reportStart);
const dispatchIndex = smokeSource.indexOf("state.requestDispatched = true");
const dispatchCountIndex = smokeSource.indexOf("state.imageBearingRequestsDispatched += 1");
const fetchIndex = smokeSource.indexOf("await fetch(`${baseUrl}${ANALYZE_ROUTE}`");
assert(
  dispatchIndex >= 0 && dispatchCountIndex > dispatchIndex && fetchIndex > dispatchCountIndex,
  "request_dispatch_accounting_order_invalid"
);

const mainStart = runner.indexOf("async function main()");
const mainSource = runner.slice(mainStart);
const serverStartIndex = mainSource.indexOf("server = startNextServer(capture, port)");
const readinessIndex = mainSource.indexOf("await waitForServerReadiness(server, baseUrl)");
const smokeIndex = mainSource.indexOf("await runAnalyzeProviderSmoke(fixture, baseUrl, state)");
assert(
  serverStartIndex >= 0 && readinessIndex > serverStartIndex && smokeIndex > readinessIndex,
  "server_readiness_analyze_order_invalid"
);

assert(analyzeRoute.includes('formData.get("image")'), "production_analyze_image_field_missing");
assert(analyzeRoute.includes("guardAnalysisRequest"), "production_analysis_guard_missing");
assert(analyzeRoute.includes("analyzeVisionObservation"), "production_vision_service_missing");
assert(analyzeRoute.includes("issueAnonymousWriteGrants"), "production_write_grant_missing");
assert(analyzeRoute.includes("ANALYZE_RESPONSE_SCHEMA_VERSION = 2"), "production_response_schema_marker_missing");
assert(
  count(visionService, "fetch(OPENAI_URL") === 1 &&
    visionService.includes('type: "image_url"') &&
    visionService.includes("imageProviderAttemptCount: 1"),
  "canonical_vision_provider_site_invalid"
);
assert(!/maxRetries|retryAfter|retryCount|attempt\s*[+]=|attempt\s*=\s*attempt\s*\+/i.test(visionService), "canonical_vision_retry_detected");

assert(
  packageJson.scripts?.["face-lab:e2e:verify"] ===
    "node scripts/face-lab-provider-e2e/verify-package.mjs",
  "package_script_face_lab_e2e_verify_invalid"
);
assert(
  packageJson.scripts?.["face-lab:e2e:run"] ===
    "node scripts/face-lab-provider-e2e/run.mjs",
  "package_script_face_lab_e2e_run_invalid"
);
assert(
  packageJson.scripts?.["anonymous-write-grant:runtime:verify"] ===
    "node scripts/verify-anonymous-write-grant-local-runtime.mjs",
  "package_script_anonymous_grant_runtime_verify_invalid"
);
assert(!Object.hasOwn(packageJson.scripts || {}, "face-lab:e2e:verify-harness"), "harness_package_script_must_be_removed");

for (const marker of [
  'supabase.rpc("create_anonymous_write_grants"',
  '.from("anonymous_write_grants")',
  '.delete()',
  'eq("resource_id", bundle.analysisRunId)',
  "randomBytes(32)",
  "canonicalizeAnonymousResultForPersistence",
  "imageEligibility",
  "remote_supabase_url_rejected",
  "anonymous_grant_canonicalization_failed",
  "anonymous_grant_rpc_failed",
  "anonymous_grant_created_count_invalid",
  "anonymous_grant_row_contract_invalid",
  "anonymous_grant_cleanup_failed",
  "[anonymous-write-grant-local-runtime] PASS"
]) {
  assert(anonymousGrantRuntimeVerifier.includes(marker), `anonymous_grant_runtime_contract_missing:${marker}`);
}
assert(!anonymousGrantRuntimeVerifier.includes("OPENAI_API_KEY"), "anonymous_grant_runtime_must_not_use_provider_secret");
assert(!anonymousGrantRuntimeVerifier.includes("/api/analyze"), "anonymous_grant_runtime_must_not_call_analyze");

console.log("[face-lab-provider-e2e-verify] PASS");
