import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const workflowPath = ".github/workflows/face-lab-provider-e2e.yml";
const runnerPath = "scripts/face-lab-provider-e2e/run.mjs";
const packagePath = "package.json";
const temporaryRoutePath = "app/api/face-lab-provider-e2e-harness/route.js";
const legacyTemporaryRoutePath = "app/api/__face-lab-provider-e2e/route.js";

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isTracked(relativePath) {
  const result = spawnSync("git", ["ls-files", "--error-unmatch", relativePath], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0;
}

assert(existsSync(path.join(repoRoot, workflowPath)), "missing_face_lab_provider_e2e_workflow");
assert(existsSync(path.join(repoRoot, runnerPath)), "missing_face_lab_provider_e2e_runner");
assert(!isTracked(temporaryRoutePath), "temporary_e2e_route_must_not_be_tracked");
assert(!isTracked(legacyTemporaryRoutePath), "legacy_temporary_e2e_route_must_not_be_tracked");

const workflow = read(workflowPath);
const runner = read(runnerPath);
const packageJson = JSON.parse(read(packagePath));

for (const marker of [
  "workflow_dispatch:",
  "private/face-lab-e2e/run.trigger",
  "BUNDLE_PATH: private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc",
  "expected_size=3094224",
  "expected_sha256=3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f",
  "secrets.OPENAI_API_KEY",
  "secrets.FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "openssl enc -d -aes-256-cbc -pbkdf2 -iter 210000",
  "-pass env:FACE_LAB_E2E_FIXTURE_PASSPHRASE",
  "import tarfile",
  "expected_files = (",
  "allowed_directories = {",
  "member.isfile()",
  "member.isdir()",
  "member.issym() or member.islnk()",
  "fixture_bundle_path_contract_invalid",
  "fixture_bundle_type_contract_invalid",
  "fixture_bundle_duplicate_member",
  "fixture_bundle_member_contract_invalid",
  "fixture_bundle_extract_failed",
  "archive.extractfile(member)",
  "os.replace(temp_path, target)",
  "os.lstat(target)",
  "frontal-clear.png",
  "lower-face-occluded.png",
  "permissions:\n  contents: read",
  "npm run face-lab:e2e:verify-harness",
  "npm run face-lab:e2e:run",
  "retention-days: 3",
  "Mandatory cleanup"
]) {
  assert(workflow.includes(marker), `workflow_contract_missing:${marker}`);
}

for (const forbiddenMarker of [
  "BUNDLE_PREFIX",
  "fixture-bundle-v2",
  "fixture-bundle.tar.gz.enc.b64.part-",
  "base64 --decode",
  "tar.extractall",
  "tar -xzf",
  "pull_request:",
  "pull_request_target",
  "contents: write",
  "FACE_LAB_E2E_OPENAI_API_KEY"
]) {
  assert(!workflow.includes(forbiddenMarker), `forbidden_workflow_marker:${forbiddenMarker}`);
}

for (const marker of [
  "subject-a-frontal-clear",
  "subject-a-lower-face-occluded",
  "MAX_IMAGE_ATTEMPTS = 2",
  "AUTOMATIC_RETRY_COUNT = 0",
  "127.0.0.1",
  "FACE_LAB_PROVIDER_E2E_ENABLED",
  "FACE_LAB_PROVIDER_E2E_TOKEN",
  'HARNESS_ROUTE_SEGMENT = "face-lab-provider-e2e-harness"',
  "const HARNESS_ROUTE_URL = `/api/${HARNESS_ROUTE_SEGMENT}`",
  "export async function GET(request)",
  'status: 204',
  '"Cache-Control": "no-store"',
  "waitForHarnessRoute(child, token, baseUrl",
  '"x-face-lab-e2e-token": token',
  'args["verify-harness-route"] === true',
  "[face-lab-provider-e2e-harness] PASS",
  "FACE_LAB_PROVIDER_E2E_PORT",
  "port >= 1024 && port <= 65535",
  'rmSync(LEGACY_HARNESS_ROUTE_DIR, { recursive: true, force: true })',
  "vision-observation-v1",
  "schemaVersion !== 2",
  "x-kbeauty-result-write-token",
  "x-kbeauty-track-write-token"
]) {
  assert(runner.includes(marker), `runner_contract_missing:${marker}`);
}

assert(!/console\.(?:log|info|warn|error)\([^\n]*(?:OPENAI_API_KEY|FACE_LAB_E2E_FIXTURE_PASSPHRASE)/.test(runner), "runner_must_not_log_provider_secret");
assert(!runner.includes("Authorization: `Bearer ${process.env.OPENAI_API_KEY}`"), "runner_must_not_interpolate_secret_in_logs");
assert(!runner.includes("retry("), "runner_must_not_define_automatic_retry_helper");
assert(!runner.includes('HARNESS_ROUTE_SEGMENT = "__face-lab-provider-e2e"'), "legacy_private_segment_must_not_execute");
assert(!runner.includes("/api/__face-lab-provider-e2e"), "legacy_private_route_url_must_not_execute");

const routeSegmentMatch = runner.match(/HARNESS_ROUTE_SEGMENT = "([^"]+)"/);
assert(routeSegmentMatch, "harness_route_segment_missing");
assert(
  /^[a-z0-9][a-z0-9-]*$/.test(routeSegmentMatch[1]) &&
    !routeSegmentMatch[1].startsWith("_") &&
    !routeSegmentMatch[1].startsWith("."),
  "harness_route_segment_must_be_non_private_static_segment"
);

const readinessGetStart = runner.indexOf("export async function GET(request)");
const harnessPostStart = runner.indexOf("export async function POST(request)");
assert(
  readinessGetStart >= 0 && harnessPostStart > readinessGetStart,
  "harness_readiness_handler_missing"
);
const readinessGetSource = runner.slice(readinessGetStart, harnessPostStart);
for (const requiredReadinessMarker of [
  'process.env.NODE_ENV === "production"',
  'process.env.FACE_LAB_PROVIDER_E2E_ENABLED !== "1"',
  "safeEqual(",
  "return denied(403)",
  "status: 204",
  '"Cache-Control": "no-store"'
]) {
  assert(
    readinessGetSource.includes(requiredReadinessMarker),
    `harness_readiness_contract_missing:${requiredReadinessMarker}`
  );
}
for (const forbiddenReadinessMarker of [
  "resolveOpenAiApiKey",
  "analyzeVisionObservation",
  "request.formData",
  "readFileSync",
  "resolveFixture",
  "Supabase"
]) {
  assert(
    !readinessGetSource.includes(forbiddenReadinessMarker),
    `harness_readiness_forbidden_operation:${forbiddenReadinessMarker}`
  );
}

const verifyHarnessStart = runner.indexOf("async function verifyHarnessRouteOnly(args)");
const mainStart = runner.indexOf("async function main()");
assert(verifyHarnessStart >= 0 && mainStart > verifyHarnessStart, "harness_only_function_missing");
const verifyHarnessSource = runner.slice(verifyHarnessStart, mainStart);
for (const forbiddenHarnessOnlyMarker of [
  "providerPreflight(",
  "runLaneB(",
  "runLaneA(",
  "resolveFixture(",
  "readFileSync("
]) {
  assert(
    !verifyHarnessSource.includes(forbiddenHarnessOnlyMarker),
    `harness_only_forbidden_operation:${forbiddenHarnessOnlyMarker}`
  );
}
for (const requiredHarnessOnlyMarker of [
  "materializeHarnessRoute();",
  "startNextServer(token, state, port)",
  "await waitForHarnessRoute(server, token, baseUrl)",
  "await stopChild(server)",
  "removeHarnessRoutes();"
]) {
  assert(
    verifyHarnessSource.includes(requiredHarnessOnlyMarker),
    `harness_only_contract_missing:${requiredHarnessOnlyMarker}`
  );
}

const mainSource = runner.slice(mainStart);
const materializeIndex = mainSource.indexOf("materializeHarnessRoute();");
const readinessIndex = mainSource.indexOf("await waitForHarnessRoute(server, token, baseUrl)");
const providerPreflightIndex = mainSource.indexOf(
  "state.providerGate = await providerPreflight(process.env.OPENAI_API_KEY.trim())"
);
const laneBIndex = mainSource.indexOf("state.laneB = await runLaneB");
const laneAIndex = mainSource.indexOf("state.laneA = await runLaneA");
assert(
  materializeIndex >= 0 &&
    readinessIndex > materializeIndex &&
    providerPreflightIndex > readinessIndex &&
    laneBIndex > providerPreflightIndex &&
    laneAIndex > laneBIndex,
  "harness_readiness_provider_order_invalid"
);

const packageVerifyIndex = workflow.indexOf("npm run face-lab:e2e:verify");
const harnessVerifyIndex = workflow.indexOf("npm run face-lab:e2e:verify-harness");
const inputVerifyIndex = workflow.indexOf("- name: Verify encrypted inputs and secrets");
assert(
  packageVerifyIndex >= 0 &&
    harnessVerifyIndex > packageVerifyIndex &&
    inputVerifyIndex > harnessVerifyIndex,
  "workflow_harness_verification_order_invalid"
);
assert(
  workflow.includes("rm -rf app/api/face-lab-provider-e2e-harness") &&
    workflow.includes("rm -rf app/api/__face-lab-provider-e2e"),
  "workflow_harness_cleanup_missing"
);

assert(
  packageJson.scripts?.["face-lab:e2e:verify"] === "node scripts/face-lab-provider-e2e/verify-package.mjs",
  "package_script_face_lab_e2e_verify_invalid"
);
assert(
  packageJson.scripts?.["face-lab:e2e:run"] === "node scripts/face-lab-provider-e2e/run.mjs",
  "package_script_face_lab_e2e_run_invalid"
);
assert(
  packageJson.scripts?.["face-lab:e2e:verify-harness"] ===
    "node scripts/face-lab-provider-e2e/run.mjs --verify-harness-route",
  "package_script_face_lab_e2e_verify_harness_invalid"
);

console.log("[face-lab-provider-e2e-verify] PASS");
