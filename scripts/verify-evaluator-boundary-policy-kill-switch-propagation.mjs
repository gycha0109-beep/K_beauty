import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateEvaluatorBoundaryPolicyKillSwitchPropagation,
  validateEvaluatorBoundaryPolicyRuntimeTelemetry
} from "../lib/evaluator-boundary-policy-runtime-observability.js";
import { resolveSyntheticCanaryEvidencePath } from "./lib/evaluator-boundary-policy-synthetic-canary-evidence.mjs";

const [runIdFlag, runId, ...unexpectedArguments] = process.argv.slice(2);
if (runIdFlag !== "--run-id" || !runId || unexpectedArguments.length > 0) {
  throw new Error("synthetic_canary_run_id_required");
}
const evidencePath = resolveSyntheticCanaryEvidencePath(runId);
const evidence = JSON.parse(await readFile(evidencePath, "utf8"));

const forbiddenKeys = new Set([
  "productid", "productids", "productname", "name", "brand", "userinput", "survey",
  "image", "imagedata", "url", "token", "apikey", "key", "secret", "rawrequest",
  "rawresponse", "requestbody", "responsebody", "recommendation"
]);

function containsForbiddenField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsForbiddenField);
  return Object.entries(value).some(([key, nested]) =>
    forbiddenKeys.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase()) || containsForbiddenField(nested)
  );
}

assert.equal(evidence.evidenceType, "candidate_policy_synthetic_canary_probe");
for (const field of [
  "schemaVersion", "fixtureContractId", "sameSyntheticFixture", "baseline", "canary", "comparison",
  "canaryRuntimeExecuted", "killSwitchPropagation", "stopRequired", "stopReasons", "rollbackVerdict",
  "verdict", "productionRuntimeActivated", "hostedEnvironmentChanged", "forbiddenFieldDetected"
]) {
  assert(Object.hasOwn(evidence, field), `missing evidence field: ${field}`);
}
assert.equal(evidence.productionRuntimeActivated, false);
assert.equal(evidence.hostedEnvironmentChanged, false);
assert.equal(evidence.forbiddenFieldDetected, false);
assert.equal(containsForbiddenField(evidence), false);
assert.equal(validateEvaluatorBoundaryPolicyRuntimeTelemetry(evidence.baseline.runtimeTelemetry).valid, true);
assert.equal(validateEvaluatorBoundaryPolicyRuntimeTelemetry(evidence.canary.runtimeTelemetry).valid, true);
assert.equal(evidence.baseline.runtimeTelemetry.runtimeEnabled, false);
assert.equal(evidence.baseline.runtimeTelemetry.runtimeExecuted, false);
assert.equal(evidence.baseline.runtimeTelemetry.runtimeConnected, false);
assert.equal(evidence.canary.runtimeTelemetry.runtimeEnabled, true);
assert.equal(evidence.canary.runtimeTelemetry.runtimeExecuted, true);
assert.equal(evidence.canary.runtimeTelemetry.runtimeConnected, true);
assert.equal(evidence.sameSyntheticFixture, true);
assert(Number.isFinite(evidence.comparison.baselineErrorRate));
assert(Number.isFinite(evidence.comparison.canaryErrorRate));
assert(Number.isInteger(evidence.comparison.baselineP95LatencyMs));
assert(Number.isInteger(evidence.comparison.canaryP95LatencyMs));

const propagation = evaluateEvaluatorBoundaryPolicyKillSwitchPropagation({
  timeoutMs: evidence.killSwitchPropagation.propagationTimeoutMs,
  observations: evidence.killSwitchPropagation.observations
});
assert.equal(propagation.propagated, evidence.killSwitchPropagation.propagated);
assert.equal(propagation.observationWindowComplete, evidence.killSwitchPropagation.observationWindowComplete);
assert.equal(propagation.runtimeStillActiveAfterTimeout, evidence.killSwitchPropagation.runtimeStillActiveAfterTimeout);
assert.equal(evidence.killSwitchPropagation.propagated, true);
assert.equal(evidence.stopRequired, false);
assert.deepEqual(evidence.stopReasons, []);
assert.equal(evidence.verdict, "synthetic_canary_probe_contract_passed");
assert.equal(evidence.comparison.responseSchemaChanged, false);
assert.equal(evidence.comparison.unexpectedRecommendationDelta, false);
assert.equal(evidence.comparison.shadowAddedDbMutationDelta, 0);
assert.equal(evidence.comparison.shadowAddedStorageMutationDelta, 0);
assert(["rollback_verified", "rollback_capability_verified"].includes(evidence.rollbackVerdict));
assert.notEqual(evidence.verdict, "blocked_kill_switch_not_propagated");

console.log("verify-evaluator-boundary-policy-kill-switch-propagation passed");
