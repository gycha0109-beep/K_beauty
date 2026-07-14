import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_BRANCH,
  EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_FLAG,
  EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_RESPONSE_FIELDS,
  executeEvaluatorBoundaryPolicyPreviewProbe,
  isEvaluatorBoundaryPolicyPreviewProbeAllowed
} from "../lib/evaluator-boundary-policy-preview-kill-switch-probe.js";

const previewCanaryEnv = {
  NODE_ENV: "production",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_BRANCH,
  [EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_FLAG]: "1",
  ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE: "deployment_canary",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT: "1"
};

const emitted = [];
const enabled = executeEvaluatorBoundaryPolicyPreviewProbe({
  envLike: previewCanaryEnv,
  sink: (...args) => emitted.push(args)
});
assert.equal(enabled.status, 200);
assert.equal(enabled.response.runtimeEnabled, true);
assert.equal(enabled.response.runtimeExecuted, false);
assert.equal(enabled.response.runtimeConnected, false);
assert.equal(enabled.response.killSwitchRequested, false);
assert.equal(enabled.response.stopRequired, false);
assert.deepEqual(Object.keys(enabled.response), EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_RESPONSE_FIELDS);
assert.equal(emitted.length, 1);
assert.equal(emitted[0][0], "[candidate-policy-runtime]");
assert.deepEqual(emitted[0][1], enabled.telemetry);

const disabled = executeEvaluatorBoundaryPolicyPreviewProbe({
  envLike: {
    ...previewCanaryEnv,
    DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1"
  },
  sink: () => {}
});
assert.equal(disabled.response.runtimeEnabled, false);
assert.equal(disabled.response.runtimeExecuted, false);
assert.equal(disabled.response.runtimeConnected, false);
assert.equal(disabled.response.killSwitchRequested, true);
assert.equal(disabled.response.killSwitchSuppressedExecution, true);
assert.equal(disabled.response.scopeValidationFailed, false);
assert.equal(disabled.response.disabledExecutionViolationCount, 0);
assert.equal(disabled.response.stopRequired, false);
assert.deepEqual(disabled.response.stopReasons, []);

const unscoped = executeEvaluatorBoundaryPolicyPreviewProbe({
  envLike: {
    ...previewCanaryEnv,
    EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE: undefined,
    EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT: undefined
  },
  sink: () => {}
});
assert.equal(unscoped.response.runtimeEnabled, false);
assert.equal(unscoped.response.scopeValidationFailed, true);
assert.equal(unscoped.response.stopRequired, true);
assert.deepEqual(unscoped.response.stopReasons, ["production_canary_scope_missing"]);

const deniedEnvironments = [
  { ...previewCanaryEnv, VERCEL_ENV: "production" },
  { ...previewCanaryEnv, VERCEL_GIT_COMMIT_REF: "main" },
  { ...previewCanaryEnv, VERCEL_GIT_COMMIT_REF: "another-preview-branch" },
  { ...previewCanaryEnv, [EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_FLAG]: "0" },
  { ...previewCanaryEnv, [EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_FLAG]: undefined }
];
for (const envLike of deniedEnvironments) {
  let sinkCalled = false;
  assert.equal(isEvaluatorBoundaryPolicyPreviewProbeAllowed(envLike), false);
  const denied = executeEvaluatorBoundaryPolicyPreviewProbe({
    envLike,
    sink: () => {
      sinkCalled = true;
    }
  });
  assert.deepEqual(denied, { allowed: false, status: 404 });
  assert.equal(sinkCalled, false);
}

const responseText = JSON.stringify(enabled.response).toLowerCase();
for (const forbidden of ["product", "brand", "survey", "image", "url", "token", "secret", "rawrequest", "rawresponse"]) {
  assert.equal(responseText.includes(forbidden), false);
}

const routeSource = await readFile(
  new URL("../app/api/internal/candidate-policy-preview-kill-switch-probe/route.js", import.meta.url),
  "utf8"
);
const helperSource = await readFile(
  new URL("../lib/evaluator-boundary-policy-preview-kill-switch-probe.js", import.meta.url),
  "utf8"
);
for (const source of [routeSource, helperSource]) {
  assert.doesNotMatch(source, /(?:supabase|createClient|\bfetch\s*\(|storage\.|\/api\/analyze)/i);
  assert.doesNotMatch(source, /(?:evaluator-boundary-policy-runtime["']|candidate-policy-hint-receiver|skin-match-decision-engine)/i);
}

console.log("verify-evaluator-boundary-policy-preview-kill-switch-probe passed");
