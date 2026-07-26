import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const workflowPath = ".github/workflows/face-lab-provider-e2e.yml";
const runnerPath = "scripts/face-lab-provider-e2e/run.mjs";
const packagePath = "package.json";
const replayWorkflowPath = ".github/workflows/local-supabase-replay-guard.yml";
const analyzeRoutePath = "app/api/analyze/route.js";
const visionServicePath = "lib/server/vision-observation-service.js";
const fixturePath = "private/face-lab-e2e/fixture-bundle-v3.tar.gz.enc";
const temporaryRouteDirectories = [
  "app/api/face-lab-provider-e2e-harness",
  "app/api/__face-lab-provider-e2e"
];
const removedSyntheticPreflightPaths = [
  "scripts/verify-anonymous-write-grant-local-runtime.mjs",
  "scripts/lib/anonymous-write-grant-runtime-readiness.mjs",
  "scripts/verify-anonymous-write-grant-runtime-readiness.mjs"
];
const expectedFixtureSize = 3094224;
const expectedFixtureSha256 = "3d7c888484c36b7f0293b8037d842b98cbc11ca4bcd6c28d136aef01222b935f";

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
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
  replayWorkflowPath,
  analyzeRoutePath,
  visionServicePath,
  fixturePath
]) {
  assert(existsSync(path.join(repoRoot, requiredPath)), `required_file_missing:${requiredPath}`);
}

for (const removedPath of removedSyntheticPreflightPaths) {
  assert(!existsSync(path.join(repoRoot, removedPath)), `synthetic_preflight_file_must_be_removed:${removedPath}`);
}

for (const temporaryRouteDirectory of temporaryRouteDirectories) {
  assert(!isTracked(`${temporaryRouteDirectory}/route.js`), `temporary_route_must_not_be_tracked:${temporaryRouteDirectory}`);
  assert(!hasTrackedFilesUnder(temporaryRouteDirectory), `temporary_route_tree_must_not_be_tracked:${temporaryRouteDirectory}`);
  assert(!existsSync(path.join(repoRoot, temporaryRouteDirectory)), `temporary_route_must_not_exist:${temporaryRouteDirectory}`);
}

const workflow = normalizeLineEndings(read(workflowPath));
const runner = read(runnerPath);
const analyzeRoute = read(analyzeRoutePath);
const visionService = read(visionServicePath);
const packageJson = JSON.parse(read(packagePath));
const replayWorkflow = normalizeLineEndings(read(replayWorkflowPath));
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
  "Run single actual /api/analyze Provider smoke",
  "npm run face-lab:e2e:run",
  "retention-days: 3",
  "Mandatory cleanup",
  "face-lab-provider-e2e-cleanup-v1",
  "tmp/face-lab-provider-e2e/cleanup.json",
  "workflow_cleanup_failed"
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
  "Verify anonymous write-grant local runtime",
  "anonymous-write-grant:runtime:verify",
  "anonymous-grant-preflight.json",
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
  "Run single actual /api/analyze Provider smoke",
  "Mandatory cleanup",
  "Upload sanitized E2E report"
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
  '"face-lab-provider-e2e-report-v3"',
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
  "FACE_LAB_SEMANTIC_CONTRACT_FAILED",
  "PROVIDER_CALL_ACCOUNTING_FAILED",
  "PROVIDER_USAGE_EVENT_MISSING",
  "PROVIDER_ATTEMPT_COUNT_INVALID",
  "REPORT_OR_CLEANUP_FAILED",
  "inspectFaceLabSemanticContract",
  "faceLabSemanticContractPassed",
  "faceLabEvidenceBackedAvailableFieldCount",
  "faceLabSourceImagePersistedFalse",
  "extractProviderRuntimeEvents",
  "imageProviderRuntimeCalls",
  "textExplanationProviderCalls",
  "textPreflightProviderCalls",
  "unexpectedProviderStageCount",
  "totalProviderRequestsObserved",
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

const payloadObjectValidationIndex = smokeSource.indexOf(
  'if (!payload || typeof payload !== "object" || Array.isArray(payload))'
);
const baseResponseContractIndex = smokeSource.indexOf(
  "state.responseContractPassed = contractPassed"
);
const faceLabInspectionIndex = smokeSource.indexOf(
  "inspectFaceLabSemanticContract(payload.faceLab)"
);
const faceLabFailureIndex = smokeSource.indexOf(
  'throw new Error("FACE_LAB_SEMANTIC_CONTRACT_FAILED")'
);
const providerAttemptValidationIndex = smokeSource.indexOf(
  "state.responseReportedImageProviderAttempts !== MAX_IMAGE_ATTEMPTS"
);
assert(
  payloadObjectValidationIndex >= 0 &&
    baseResponseContractIndex > payloadObjectValidationIndex &&
    faceLabInspectionIndex > baseResponseContractIndex &&
    faceLabFailureIndex > faceLabInspectionIndex &&
    providerAttemptValidationIndex > faceLabFailureIndex,
  "face_lab_semantic_validation_order_invalid"
);
assert(
  !/Boolean\s*\(\s*payload\.faceLab\s*\)/.test(smokeSource),
  "face_lab_presence_only_contract_forbidden"
);

const mainStart = runner.indexOf("async function main()");
const mainSource = runner.slice(mainStart);
for (const marker of [
  "state.imageProviderRuntimeCalls !== MAX_IMAGE_ATTEMPTS",
  "state.textExplanationProviderCalls > 1",
  "state.textPreflightProviderCalls !== 0",
  "state.unexpectedProviderStageCount !== 0",
  "state.totalProviderRequestsObserved > 2"
]) {
  assert(mainSource.includes(marker), `provider_call_accounting_contract_missing:${marker}`);
}

const serverStartIndex = mainSource.indexOf("server = startNextServer(capture, port)");
const readinessIndex = mainSource.indexOf("await waitForServerReadiness(server, baseUrl)");
const smokeIndex = mainSource.indexOf("await runAnalyzeProviderSmoke(fixture, baseUrl, state)");
assert(
  serverStartIndex >= 0 && readinessIndex > serverStartIndex && smokeIndex > readinessIndex,
  "server_readiness_analyze_order_invalid"
);

const cleanupStepIndex = workflow.indexOf("- name: Mandatory cleanup");
const uploadStepIndex = workflow.indexOf("- name: Upload sanitized E2E report");
const cleanupStepSource = workflow.slice(cleanupStepIndex, uploadStepIndex);
const uploadStepSource = workflow.slice(uploadStepIndex);
assert(cleanupStepIndex >= 0 && uploadStepIndex > cleanupStepIndex, "cleanup_upload_order_invalid");
assert(cleanupStepSource.includes("if: always()"), "cleanup_always_contract_missing");
assert(uploadStepSource.includes("if: always()"), "upload_always_contract_missing");
assert(
  !cleanupStepSource.includes("continue-on-error: true"),
  "cleanup_continue_on_error_forbidden"
);
for (const marker of [
  "cleanup_failed=0",
  "manifest_absent",
  "plaintext_fixture_directory_absent",
  "decrypted_input_directory_absent",
  "encrypted_bundle_absent",
  "local_supabase_stopped",
  "supabase@2.82.0 stop",
  "face-lab-provider-e2e-cleanup-v1",
  "workflow_cleanup_failed",
  'if [ "${cleanup_failed}" -ne 0 ]',
  "exit 1"
]) {
  assert(cleanupStepSource.includes(marker), `cleanup_fail_closed_contract_missing:${marker}`);
}
assert(
  uploadStepSource.includes("tmp/face-lab-provider-e2e/cleanup.json"),
  "cleanup_artifact_upload_missing"
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
  !Object.hasOwn(packageJson.scripts || {}, "anonymous-write-grant:runtime:verify"),
  "synthetic_anonymous_grant_runtime_script_must_be_removed"
);
assert(
  !Object.hasOwn(packageJson.scripts || {}, "anonymous-write-grant:runtime-readiness:verify"),
  "synthetic_anonymous_grant_readiness_script_must_be_removed"
);
assert(!Object.hasOwn(packageJson.scripts || {}, "face-lab:e2e:verify-harness"), "harness_package_script_must_be_removed");

for (const marker of [
  "waitForAnonymousGrantRpcVisibility",
  "p_grants: []",
  "anonymous-write-grant:runtime:verify",
  "anonymous-write-grant:runtime-readiness:verify",
  "anonymous-grant-preflight.json",
  "Verify anonymous write-grant runtime"
]) {
  assert(!workflow.includes(marker), `synthetic_provider_preflight_marker_must_be_removed:${marker}`);
  assert(!replayWorkflow.includes(marker), `synthetic_replay_preflight_marker_must_be_removed:${marker}`);
}

for (const marker of [
  "Lint local database",
  "Verify anonymous product boundary"
]) {
  assert(replayWorkflow.includes(marker), `replay_anonymous_grant_contract_missing:${marker}`);
}
const replayLintIndex = replayWorkflow.indexOf("- name: Lint local database");
assert(
  replayLintIndex > replayWorkflow.indexOf("- name: Reset migration chain twice"),
  "replay_existing_database_step_order_invalid"
);

const runnerModule = await import(
  pathToFileURL(path.join(repoRoot, runnerPath)).href
);
const { inspectFaceLabSemanticContract, extractProviderRuntimeEvents } = runnerModule;
assert(
  typeof inspectFaceLabSemanticContract === "function",
  "face_lab_semantic_inspector_export_missing"
);
assert(
  typeof extractProviderRuntimeEvents === "function",
  "provider_runtime_event_parser_export_missing"
);

const availableField = {
  status: "available",
  source: "vision",
  confidence: 0.91,
  evidence: ["bounded synthetic evidence"],
  value: { category: "synthetic" },
  unavailableReason: null
};
const validFaceLab = {
  status: "available",
  source: "vision",
  failureReason: null,
  eligibility: { faceLabEligible: true },
  data: {
    structured: { synthetic: true },
    analysis: {
      status: "available",
      observations: { shape: { primary: availableField } },
      coverage: { availableFieldCount: 1 },
      privacy: { sourceImagePersisted: false }
    }
  }
};
const passInspection = inspectFaceLabSemanticContract(validFaceLab);
assert(passInspection.semanticContractPassed === true, "face_lab_semantic_pass_case_failed");
assert(
  passInspection.evidenceBackedAvailableFieldCount === 1,
  "face_lab_evidence_backed_count_invalid"
);

const semanticFailureCases = [
  {},
  { ...structuredClone(validFaceLab), status: "unavailable" },
  { ...structuredClone(validFaceLab), source: "fallback" },
  {
    ...structuredClone(validFaceLab),
    eligibility: { faceLabEligible: false }
  },
  (() => {
    const value = structuredClone(validFaceLab);
    value.data.analysis.status = "unavailable";
    return value;
  })(),
  (() => {
    const value = structuredClone(validFaceLab);
    value.data.analysis.observations.shape.primary.evidence = [];
    return value;
  })(),
  (() => {
    const value = structuredClone(validFaceLab);
    value.data.analysis.observations.shape.primary.source = "derived";
    return value;
  })(),
  (() => {
    const value = structuredClone(validFaceLab);
    value.data.analysis.observations.shape.primary.value = null;
    return value;
  })(),
  (() => {
    const value = structuredClone(validFaceLab);
    delete value.data.structured;
    return value;
  })(),
  (() => {
    const value = structuredClone(validFaceLab);
    value.data.analysis.privacy.sourceImagePersisted = true;
    return value;
  })()
];
for (const [index, faceLab] of semanticFailureCases.entries()) {
  assert(
    inspectFaceLabSemanticContract(faceLab).semanticContractPassed === false,
    `face_lab_semantic_fail_case_unexpected_pass:${index + 1}`
  );
}

const providerEvents = extractProviderRuntimeEvents([
  "[provider-runtime] { stage: 'vision-observation', ok: true }",
  "[provider-runtime] { stage: 'product-explanations', ok: false }"
].join("\n"));
assert(
  providerEvents.length === 2 &&
    providerEvents[0].stage === "vision-observation" &&
    providerEvents[0].ok === true &&
    providerEvents[1].stage === "product-explanations" &&
    providerEvents[1].ok === false,
  "provider_runtime_event_parser_contract_invalid"
);

console.log("[face-lab-provider-e2e-verify] PASS");
