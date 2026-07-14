import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_BRANCH,
  EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_FLAG,
  EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_RESPONSE_FIELDS,
  executeEvaluatorBoundaryPolicyPreviewRuntimeProbe,
  isEvaluatorBoundaryPolicyPreviewRuntimeProbeAllowed
} from "../lib/evaluator-boundary-policy-preview-runtime-probe.js";

const previewRuntimeEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_BRANCH,
  [EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_FLAG]: "1",
  ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE: "deployment_canary",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT: "1"
};

const emitted = [];
const executed = await executeEvaluatorBoundaryPolicyPreviewRuntimeProbe({
  envLike: previewRuntimeEnv,
  sink: (...args) => emitted.push(args)
});
assert.equal(executed.status, 200);
assert.equal(executed.response.runtimeEnabled, true);
assert.equal(executed.response.runtimeExecuted, true);
assert.equal(executed.response.runtimeConnected, true);
assert.equal(executed.response.inputCandidateCount, 3);
assert(Number.isInteger(executed.response.visibleCandidateCount));
assert.equal(executed.response.unexpectedReceiverExposureCount, 0);
assert.deepEqual(executed.response.safetyViolationCounts, {
  highRiskCollapsed: 0,
  sensitivityUnsafeAccepted: 0,
  metadataIncompleteAccepted: 0,
  strongCautionAccepted: 0,
  activeOnlyViolation: 0
});
assert.equal(executed.response.stopRequired, false);
assert.deepEqual(executed.response.stopReasons, []);
assert.deepEqual(Object.keys(executed.response), EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_RESPONSE_FIELDS);
assert.equal(emitted.length, 1);
assert.equal(emitted[0][0], "[candidate-policy-runtime]");
assert.deepEqual(emitted[0][1], executed.telemetry);

const deniedEnvironments = [
  { ...previewRuntimeEnv, DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1" },
  { ...previewRuntimeEnv, VERCEL_ENV: "production" },
  { ...previewRuntimeEnv, VERCEL_GIT_COMMIT_REF: "main" },
  { ...previewRuntimeEnv, VERCEL_GIT_COMMIT_REF: "another-preview-branch" },
  { ...previewRuntimeEnv, [EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_FLAG]: undefined },
  { ...previewRuntimeEnv, ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: undefined },
  { ...previewRuntimeEnv, EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE: undefined },
  { ...previewRuntimeEnv, EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT: undefined }
];

for (const envLike of deniedEnvironments) {
  let sinkCalled = false;
  assert.equal(isEvaluatorBoundaryPolicyPreviewRuntimeProbeAllowed(envLike), false);
  const denied = await executeEvaluatorBoundaryPolicyPreviewRuntimeProbe({
    envLike,
    sink: () => {
      sinkCalled = true;
    }
  });
  assert.deepEqual(denied, { allowed: false, status: 404 });
  assert.equal(sinkCalled, false);
}

const responseText = JSON.stringify(executed.response).toLowerCase();
const telemetryText = JSON.stringify(emitted[0][1]).toLowerCase();
for (const forbidden of [
  "productid",
  "productname",
  "brand",
  "userinput",
  "survey",
  "image",
  "url",
  "token",
  "apikey",
  "secret",
  "rawrequest",
  "rawresponse",
  "recommendation"
]) {
  assert.equal(responseText.includes(forbidden), false);
  assert.equal(telemetryText.includes(forbidden), false);
}

const sources = await Promise.all([
  readFile(new URL("../app/api/internal/candidate-policy-preview-runtime-probe/route.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/evaluator-boundary-policy-preview-runtime-probe.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/evaluator-boundary-policy-runtime.js", import.meta.url), "utf8"),
  readFile(new URL("../lib/evaluator-boundary-policy-shadow.js", import.meta.url), "utf8")
]);
for (const source of sources) {
  assert.doesNotMatch(source, /(?:supabase|createClient|\bfetch\s*\(|storage\.|\/api\/analyze)/i);
}

console.log("verify-evaluator-boundary-policy-preview-runtime-probe passed");
