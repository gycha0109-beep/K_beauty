import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import {
  HOSTED_DIAGNOSTIC_AUTH_HEADERS,
  HOSTED_DIAGNOSTIC_CONTENT_TYPE,
  HOSTED_DIAGNOSTIC_PATH,
  buildDiagnosticCanonicalBytes,
  signDiagnosticCanonicalBytes,
  verifyDiagnosticAuthentication
} from "../lib/candidate-exposure-policy-hosted-diagnostic-auth.js";
import {
  HOSTED_DIAGNOSTIC_REQUEST_SCHEMA,
  buildHostedDiagnosticMatrix,
  parseStrictHostedDiagnosticRequest,
  stableDiagnosticStringify,
  validateHostedDiagnosticEnvelope,
  validateHostedDiagnosticRequest
} from "../lib/candidate-exposure-policy-hosted-diagnostic-contract.js";
import {
  executeHostedCandidatePolicyDiagnostic,
  validateHostedDiagnosticFixtureManifest
} from "../lib/candidate-exposure-policy-hosted-diagnostic-execution.js";
import {
  createHostedDiagnosticRouteHandler
} from "../app/api/internal/candidate-exposure-policy-diagnostic/route.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const manifest = require("../fixtures/candidate-exposure-policy-isolated-canary/manifest.v1.json");
const SOURCE_SHA = "a".repeat(40);
const SECRET = "stage11k-local-test-secret";
const CONTROL_HOST = "stage11k-control-abc123.vercel.app";
const CANARY_HOST = "stage11k-canary-def456.vercel.app";
const NOW = 1_775_296_800_000;
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`assertion_failed:${message}`);
}

async function expectThrow(task, message, expected = null) {
  let thrown = null;
  try { await task(); } catch (error) { thrown = error; }
  assert(Boolean(thrown), `${message}:not_thrown`);
  if (expected) assert(thrown?.message === expected, `${message}:${thrown?.message}`);
}

function env(mode = "control", overrides = {}) {
  return {
    VERCEL_ENV: "preview",
    NODE_ENV: "production",
    VERCEL_GIT_COMMIT_SHA: SOURCE_SHA,
    VERCEL_DEPLOYMENT_ID: mode === "canary" ? "dpl_canary12345678" : "dpl_control12345678",
    CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST: "b".repeat(64),
    VERCEL_AUTOMATION_BYPASS_SECRET: SECRET,
    DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW: mode === "canary" ? "1" : "0",
    DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW: "0",
    ...overrides
  };
}

const fixtureReview = validateHostedDiagnosticFixtureManifest(manifest);
assert(fixtureReview.valid, "fixture_manifest_valid");

function record(sequence = 1, overrides = {}) {
  const matrix = buildHostedDiagnosticMatrix().find((entry) => entry.sequence === sequence);
  return {
    schemaVersion: HOSTED_DIAGNOSTIC_REQUEST_SCHEMA,
    executionGrantDigest: "b".repeat(64),
    approvalIdHash: "c".repeat(64),
    approvedSourceSha: SOURCE_SHA,
    deploymentId: matrix.expectedMode === "control" ? "dpl_control12345678" : "dpl_canary12345678",
    sequence,
    locale: matrix.locale,
    scenario: matrix.scenario,
    expectedMode: matrix.expectedMode,
    fixtureSemanticFingerprint: fixtureReview.fingerprints[matrix.scenario],
    ...overrides
  };
}

function signedRequest({
  requestRecord = record(),
  bodyText = null,
  host = CONTROL_HOST,
  timestamp = String(NOW),
  nonce = randomBytes(32).toString("base64url"),
  secret = SECRET,
  signature = null,
  headers = {},
  method = "POST"
} = {}) {
  const text = bodyText ?? stableDiagnosticStringify(requestRecord);
  const bodyBytes = Buffer.from(text, "utf8");
  const canonical = buildDiagnosticCanonicalBytes({
    method,
    path: HOSTED_DIAGNOSTIC_PATH,
    host,
    contentType: HOSTED_DIAGNOSTIC_CONTENT_TYPE,
    timestamp,
    nonce,
    bodyBytes
  });
  const resolvedSignature = signature ?? signDiagnosticCanonicalBytes(canonical, secret);
  return new Request(`https://${host}${HOSTED_DIAGNOSTIC_PATH}`, {
    method,
    headers: {
      "content-type": HOSTED_DIAGNOSTIC_CONTENT_TYPE,
      [HOSTED_DIAGNOSTIC_AUTH_HEADERS.timestamp]: timestamp,
      [HOSTED_DIAGNOSTIC_AUTH_HEADERS.nonce]: nonce,
      [HOSTED_DIAGNOSTIC_AUTH_HEADERS.signature]: resolvedSignature,
      ...headers
    },
    body: text
  });
}

async function responseJson(response) {
  return JSON.parse(await response.text());
}

const canonical = buildDiagnosticCanonicalBytes({
  host: CONTROL_HOST,
  timestamp: String(NOW),
  nonce: randomBytes(32).toString("base64url"),
  bodyBytes: Buffer.from("{}")
});
const signature = signDiagnosticCanonicalBytes(canonical, SECRET);
assert(/^[0-9a-f]{64}$/.test(signature), "hmac_signature_shape");
const authReview = verifyDiagnosticAuthentication({
  method: "POST",
  path: HOSTED_DIAGNOSTIC_PATH,
  host: CONTROL_HOST,
  contentType: HOSTED_DIAGNOSTIC_CONTENT_TYPE,
  timestamp: String(NOW),
  nonce: canonical.toString().split("\n")[5],
  signature,
  bodyBytes: Buffer.from("{}"),
  secret: SECRET,
  nowMs: NOW
});
assert(authReview.valid, "auth_valid");
assert(createHmac("sha256", SECRET).update(canonical).digest("hex") === signature, "hmac_exact");

let bodyTouched = false;
const unreachableRequest = {
  get body() { bodyTouched = true; throw new Error("body_touched"); }
};
for (const badEnv of [
  env("control", { VERCEL_ENV: "production" }),
  env("control", { VERCEL_ENV: "development" }),
  env("control", { VERCEL_ENV: undefined }),
  env("control", { VERCEL_GIT_COMMIT_SHA: undefined }),
  env("control", { VERCEL_DEPLOYMENT_ID: undefined }),
  env("control", { CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST: undefined }),
  env("control", { VERCEL_AUTOMATION_BYPASS_SECRET: undefined })
]) {
  const res = await createHostedDiagnosticRouteHandler({ env: badEnv })(unreachableRequest);
  assert(res.status === 404, "environment_hard_disable");
}
assert(bodyTouched === false, "environment_rejects_before_body_read");

let res = await createHostedDiagnosticRouteHandler({ env: env() })(
  signedRequest({ signature: "0".repeat(64) })
);
assert(res.status === 404, "invalid_signature_404");

res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ timestamp: String(NOW - 60_001) })
);
assert(res.status === 404, "stale_timestamp_404");
res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ timestamp: String(NOW + 15_001) })
);
assert(res.status === 404, "future_timestamp_404");

await expectThrow(
  () => Promise.resolve(parseStrictHostedDiagnosticRequest('{"sequence":1,"sequence":2}')),
  "duplicate_json_key",
  "request_duplicate_key"
);
await expectThrow(
  () => Promise.resolve(parseStrictHostedDiagnosticRequest('{"canonicalState":{}}')),
  "nested_fixture_rejected",
  "json_nested_value_forbidden"
);

const validRequestReview = validateHostedDiagnosticRequest(record(1));
assert(validRequestReview.valid, "request_contract_valid");
assert(!validateHostedDiagnosticRequest({ ...record(1), unknown: true }).valid, "unknown_request_field");
assert(!validateHostedDiagnosticRequest({ ...record(1), sequence: 2 }).valid, "matrix_sequence_enforced");

res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ bodyText: `${stableDiagnosticStringify(record(1)).slice(0, -1)},"sequence":1}` })
);
assert(res.status === 400, "duplicate_key_route_rejected");

res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ requestRecord: { ...record(1), unknown: "x" } })
);
assert(res.status === 400, "unknown_field_route_rejected");

res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ requestRecord: { ...record(1), approvedSourceSha: "d".repeat(40) } })
);
assert(res.status === 400 && (await responseJson(res)).error === "source_sha_mismatch", "source_sha_route_rejected");

res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ requestRecord: { ...record(1), deploymentId: "dpl_other123456789" } })
);
assert(res.status === 400, "deployment_id_env_binding");
res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ requestRecord: { ...record(1), executionGrantDigest: "e".repeat(64) } })
);
assert(res.status === 400, "grant_digest_env_binding");

res = await createHostedDiagnosticRouteHandler({ env: env() })(new Request(
  `https://${CONTROL_HOST}${HOSTED_DIAGNOSTIC_PATH}`,
  { method: "POST", headers: { "content-type": "text/plain" }, body: "{}" }
));
assert(res.status === 404, "non_json_rejected");

for (const header of ["cookie", "authorization", "origin", "sec-fetch-site"] ) {
  res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
    signedRequest({ headers: { [header]: "blocked" } })
  );
  assert(res.status === 404, `browser_state_rejected:${header}`);
}

res = await createHostedDiagnosticRouteHandler({ env: env(), nowMs: () => NOW })(
  signedRequest({ bodyText: "x".repeat(8193) })
);
assert(res.status === 404, "oversized_body_rejected");

let controlCalls = 0;
const controlHandler = createHostedDiagnosticRouteHandler({
  env: env("control"),
  manifest,
  nowMs: () => NOW,
  executeDiagnostic: (input) => executeHostedCandidatePolicyDiagnostic({
    ...input,
    evaluator: (...args) => { controlCalls += 1; return args; }
  })
});
res = await controlHandler(signedRequest({ requestRecord: record(1), host: CONTROL_HOST }));
assert(res.status === 200, "control_success");
const controlEnvelope = await responseJson(res);
assert(validateHostedDiagnosticEnvelope(controlEnvelope).valid, "control_envelope_valid");
assert(controlEnvelope.shadowExecution === false, "control_shadow_false");
assert(controlCalls === 0, "control_evaluator_zero");
assert(controlEnvelope.aggregate.candidateCount === 0, "control_candidate_zero");
assert(controlEnvelope.aggregate.projectionFingerprintPresent === false, "control_projection_absent");
assert(res.headers.get("cache-control")?.includes("no-store"), "control_no_store");
assert(!res.headers.has("set-cookie"), "control_no_cookie");

let canaryCalls = 0;
const canaryHandler = createHostedDiagnosticRouteHandler({
  env: env("canary"),
  manifest,
  nowMs: () => NOW,
  executeDiagnostic: (input) => executeHostedCandidatePolicyDiagnostic({
    ...input,
    evaluator: (args) => {
      canaryCalls += 1;
      const decisions = args.candidates.map((candidate, index) => ({
        candidateRef: String(candidate.id),
        exposure: index === 0 ? "primary" : "contextual",
        laneEligibility: { topPick: true, supporting: true, budget: false, routine: true, treatment: false },
        reasonCodes: candidate.expectedReasonCodes || manifest.scenarios[0].expectedReasonCodes
      }));
      return { status: "evaluated", decisions, evaluatorExecution: { receivers: decisions.map((d) => ({ productId: d.candidateRef })) } };
    }
  })
});
res = await canaryHandler(signedRequest({ requestRecord: record(2), host: CANARY_HOST }));
assert(res.status === 200, "canary_success");
const canaryEnvelope = await responseJson(res);
assert(validateHostedDiagnosticEnvelope(canaryEnvelope).valid, "canary_envelope_valid");
assert(canaryEnvelope.shadowExecution === true, "canary_shadow_true");
assert(canaryCalls === 1, "canary_evaluator_once");
assert(canaryEnvelope.aggregate.projectionFingerprintPresent === true, "canary_projection_present");
assert(Buffer.byteLength(JSON.stringify(canaryEnvelope)) < 65_536, "response_under_cap");

res = await createHostedDiagnosticRouteHandler({ env: env("canary"), manifest, nowMs: () => NOW })(
  signedRequest({ requestRecord: { ...record(1), deploymentId: "dpl_canary12345678" }, host: CANARY_HOST })
);
assert(res.status === 400 && (await responseJson(res)).error === "deployment_mode_mismatch", "mode_mismatch_stops");
res = await createHostedDiagnosticRouteHandler({
  env: env("control", { DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW: "1" }),
  manifest,
  nowMs: () => NOW
})(signedRequest({ requestRecord: record(1), host: CONTROL_HOST }));
assert(res.status === 400 && (await responseJson(res)).error === "kill_switch_active", "kill_switch_stops");

await expectThrow(
  () => Promise.resolve(executeHostedCandidatePolicyDiagnostic({
    requestRecord: record(2), fixtureManifest: manifest, env: env("canary"),
    compare: () => ({ categoryCounts: { equivalent: 1, expected_canonical_evaluator_rebuild: 0, expected_canonical_goal_alignment: 0, expected_current_product_semantics: 0, expected_exposure_state_expansion: 0, expected_invalid_context_hardening: 0, unexpected_divergence: 1 }, unexpectedDivergenceCount: 1, unclassifiedDivergenceCount: 0 })
  })),
  "unexpected_divergence_stops",
  "unexpected_divergence"
);

const routeSource = readFileSync(path.join(ROOT, "app/api/internal/candidate-exposure-policy-diagnostic/route.js"), "utf8");
const authSource = readFileSync(path.join(ROOT, "lib/candidate-exposure-policy-hosted-diagnostic-auth.js"), "utf8");
const executionSource = readFileSync(path.join(ROOT, "lib/candidate-exposure-policy-hosted-diagnostic-execution.js"), "utf8");
const analyzeSource = readFileSync(path.join(ROOT, "app/api/analyze/route.js"), "utf8");
const adapterSource = readFileSync(path.join(ROOT, "lib/candidate-exposure-policy-read-only-hosted-adapter.js"), "utf8");
assert(!/console\.(?:log|info|warn|error)/.test(routeSource + authSource + executionSource), "no_console_logging");
assert(authSource.includes("timingSafeEqual"), "timing_safe_signature_compare");
assert(routeSource.includes("VERCEL_DEPLOYMENT_ID"), "system_deployment_id_binding");
assert(routeSource.includes("CANDIDATE_EXPOSURE_POLICY_DIAGNOSTIC_GRANT_DIGEST"), "grant_digest_environment_binding");
assert(!/export\s+(?:async\s+)?function\s+(?:GET|OPTIONS)|export\s+const\s+(?:GET|OPTIONS)/.test(routeSource), "no_get_or_options_export");
assert(!executionSource.includes("runCandidateExposurePolicyShadow"), "no_double_evaluation_shadow_helper");
assert(!/(openai|supabase|premium-access|premium-report-session|anonymous-write-grant|analysis-request-guard|child_process|fetch\s*\()/i.test(routeSource + authSource + executionSource), "forbidden_dependency_absent");
assert(!analyzeSource.includes("candidate-exposure-policy-hosted-diagnostic"), "analyze_route_unchanged_import_boundary");
assert(adapterSource.includes("postCandidatePolicyDiagnostic"), "adapter_capability_renamed");
assert(!adapterSource.includes("postAnalyzeDiagnostic"), "old_adapter_capability_removed");
assert(adapterSource.includes("HOSTED_DIAGNOSTIC_PATH"), "adapter_path_exact");
assert(!adapterSource.includes('path: "/api/analyze"') || adapterSource.includes("CURRENT_ANALYZE_ROUTE_CAPABILITY"), "v2_adapter_not_targeting_analyze");

console.log(`candidate-exposure-policy-hosted-diagnostic-route: PASS (${assertions} assertions)`);
