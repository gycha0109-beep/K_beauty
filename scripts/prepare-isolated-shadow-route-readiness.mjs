import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertNonProductionSupabaseTarget, loadEnvForTargetAssertion } from "./assert-non-production-supabase-target.mjs";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "tmp");
const JSON_OUTPUT = path.join(OUTPUT_DIR, "isolated-shadow-route-readiness.json");
const MD_OUTPUT = path.join(OUTPUT_DIR, "isolated-shadow-route-readiness.md");
const FIXTURE_DIR = path.join(ROOT, "test", "fixtures", "analyze");
const PAYLOAD_PATH = path.join(FIXTURE_DIR, "analyze-payload.fixture.json");
const IMAGE_PATH = path.join(FIXTURE_DIR, "test-face-placeholder.png");
const README_PATH = path.join(FIXTURE_DIR, "README.md");
const RUNBOOK_PATH = path.join(ROOT, "docs", "runbooks", "isolated-shadow-route-runbook-20260710.md");

const REQUIRED_FORM_FIELDS = [
  "skinType",
  "sensitivity",
  "mainConcern",
  "cleansingFrequency",
  "preferredTexture",
  "postWashFeeling",
  "afternoonSkinChange",
  "mostDislikedFeel"
];

function pngSignatureValid(buffer) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  return buffer.length >= signature.length && signature.every((value, index) => buffer[index] === value);
}

function routeSource() {
  return readFileSync(path.join(ROOT, "app", "api", "analyze", "route.js"), "utf8");
}

function isTmpWritable() {
  return existsSync(OUTPUT_DIR) || existsSync(ROOT);
}

function renderMarkdown(output) {
  return [
    "# Isolated Shadow Route Readiness",
    "",
    `- status: ${output.status}`,
    `- routeInvoked: ${output.routeInvoked}`,
    `- target safe: ${output.nonProductionTarget.safeToRunRoute}`,
    `- fixture ready: ${output.fixtureReadiness.ready}`,
    `- mutation delta status: ${output.mutationDeltaReadiness.status}`,
    "",
    "No API request, Supabase access, or route mutation was executed."
  ].join("\n");
}

const nonProductionTarget = assertNonProductionSupabaseTarget({ env: loadEnvForTargetAssertion() });
const payloadExists = existsSync(PAYLOAD_PATH);
const imageExists = existsSync(IMAGE_PATH);
const readmeExists = existsSync(README_PATH);
const runbookExists = existsSync(RUNBOOK_PATH);
let payload = null;
let payloadParseError = false;
if (payloadExists) {
  try {
    payload = JSON.parse(await readFile(PAYLOAD_PATH, "utf8"));
  } catch {
    payloadParseError = true;
  }
}
const fields = payload?.formFields && typeof payload.formFields === "object" ? payload.formFields : {};
const missingRequiredFields = REQUIRED_FORM_FIELDS.filter((field) => !fields[field]);
const payloadReferencesFixture = payload?.imageFixturePath === "test/fixtures/analyze/test-face-placeholder.png";
const imageBytes = imageExists ? await readFile(IMAGE_PATH) : Buffer.alloc(0);
const routeRequiredFieldContractPresent = REQUIRED_FORM_FIELDS.every((field) => routeSource().includes(`formData.get("${field}")`));
const fixtureContractComplete =
  payloadExists &&
  !payloadParseError &&
  missingRequiredFields.length === 0 &&
  payloadReferencesFixture &&
  imageExists &&
  pngSignatureValid(imageBytes) &&
  readmeExists;

const mutationDeltaReadiness = {
  status: "not_ready",
  reasonCode: "route_mutation_observation_harness_not_implemented",
  baselineCounterPlan: [
    "analysis_request_guard_start_complete_fail_counts",
    "premium_report_session_write_count"
  ],
  shadowCounterPlan: [
    "shadow_route_artifact_local_tmp_write_count",
    "shadow_supabase_mutation_count_must_remain_zero"
  ],
  comparisonRule: "flag_on_counter_minus_flag_off_counter_must_be_zero_for_shadow_supabase_mutations",
  existingRouteWritesAllowed: true,
  shadowAddedMutationDeltaMustEqualZero: true
};

let status = "ready_for_phase43_isolated_route_run";
if (nonProductionTarget.productionBlocked) {
  status = "blocked_by_production_target";
} else if (!fixtureContractComplete || !routeRequiredFieldContractPresent) {
  status = "fixture_contract_incomplete";
} else if (mutationDeltaReadiness.status !== "ready") {
  status = "not_ready_mutation_delta_unmeasurable";
} else if (!nonProductionTarget.safeToRunRoute) {
  status = "not_ready_environment_unverified";
}

const output = {
  generatedAt: new Date().toISOString(),
  evidenceType: "isolated_shadow_route_readiness",
  status,
  routeInvoked: false,
  runtimeConnected: false,
  supabaseWriteExecuted: false,
  runtimeMutation: false,
  nonProductionTarget,
  fixtureReadiness: {
    payloadExists,
    payloadJsonParseable: payloadExists && !payloadParseError,
    missingRequiredFields,
    payloadReferencesFixture,
    imageExists,
    imageSignatureValid: imageExists && pngSignatureValid(imageBytes),
    imageByteLength: imageExists ? imageBytes.length : 0,
    readmeExists,
    routeRequiredFieldContractPresent,
    ready: fixtureContractComplete && routeRequiredFieldContractPresent
  },
  runnerReadiness: {
    phase43InputPayloadPath: "test/fixtures/analyze/analyze-payload.fixture.json",
    phase43ImageFixturePath: "test/fixtures/analyze/test-face-placeholder.png",
    tmpOutputDirWritable: isTmpWritable(),
    runbookExists,
    actualRouteExecutionPrepared: false
  },
  mutationDeltaReadiness,
  limitations: [
    "no_actual_route_request_in_phase42",
    "nonproduction_target_requires_local_or_explicit_disposable_allowlist",
    "mutation_delta_observation_harness_required_before_phase43",
    "synthetic_placeholder_image_may_be_insufficient_for_semantic_face_analysis"
  ]
};

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(JSON_OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
await writeFile(MD_OUTPUT, `${renderMarkdown(output)}\n`, "utf8");

console.log("prepare-isolated-shadow-route-readiness summary");
console.log(JSON.stringify({
  status: output.status,
  routeInvoked: output.routeInvoked,
  targetType: output.nonProductionTarget.targetType,
  fixtureReady: output.fixtureReadiness.ready,
  mutationDeltaStatus: output.mutationDeltaReadiness.status,
  secretsPrinted: output.nonProductionTarget.secretsPrinted
}, null, 2));
