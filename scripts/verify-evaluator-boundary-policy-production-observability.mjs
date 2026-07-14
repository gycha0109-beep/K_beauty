import assert from "node:assert/strict";
import {
  buildEvaluatorBoundaryPolicyRuntimeTelemetry,
  evaluateEvaluatorBoundaryPolicyCanaryGate,
  resolveEvaluatorBoundaryPolicyRuntimeControl,
  validateEvaluatorBoundaryPolicyRuntimeTelemetry
} from "../lib/evaluator-boundary-policy-runtime-observability.js";

const defaultOff = resolveEvaluatorBoundaryPolicyRuntimeControl({ NODE_ENV: "production" });
assert.equal(defaultOff.runtimeEnabled, false);

const unscopedProduction = resolveEvaluatorBoundaryPolicyRuntimeControl({
  NODE_ENV: "production",
  ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1"
});
assert.equal(unscopedProduction.runtimeEnabled, false);
assert.equal(unscopedProduction.canaryScope, "unscoped_production");
assert.equal(unscopedProduction.scopeValidationFailed, true);
assert.equal(buildEvaluatorBoundaryPolicyRuntimeTelemetry({ control: unscopedProduction }).stopRequired, true);

const productionCanary = resolveEvaluatorBoundaryPolicyRuntimeControl({
  NODE_ENV: "production",
  ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE: "deployment_canary",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT: "1"
});
assert.equal(productionCanary.runtimeEnabled, true);

const killed = resolveEvaluatorBoundaryPolicyRuntimeControl({
  NODE_ENV: "production",
  ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1",
  DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME: "1",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_SCOPE: "deployment_canary",
  EVALUATOR_BOUNDARY_CANDIDATE_POLICY_CANARY_DEPLOYMENT: "1"
});
assert.equal(killed.runtimeEnabled, false);
assert.equal(killed.killSwitchSuppressedExecution, true);

const telemetry = buildEvaluatorBoundaryPolicyRuntimeTelemetry({
  control: productionCanary,
  runtimeResult: {
    runtimeConnected: true,
    candidateCounts: { before: 3, after: 2 },
    unexpectedReceiverCount: 0,
    violationCounts: {}
  },
  latencyMs: 8
});
assert.equal(validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry).valid, true);
assert.equal(telemetry.stopRequired, false);

const forbiddenTelemetry = { ...telemetry, productIds: ["test-only-id"] };
assert.equal(validateEvaluatorBoundaryPolicyRuntimeTelemetry(forbiddenTelemetry).valid, false);

const stopped = evaluateEvaluatorBoundaryPolicyCanaryGate({
  telemetry,
  comparison: { unexpectedRecommendationDelta: true },
  slo: {
    baselineErrorRate: 0,
    canaryErrorRate: 0,
    maxErrorRateIncrease: 0,
    baselineP95LatencyMs: 10,
    canaryP95LatencyMs: 10,
    maxP95LatencyIncreaseMs: 0
  }
});
assert.equal(stopped.stopRequired, true);
assert(stopped.stopReasons.includes("unexpected_recommendation_delta"));

console.log("verify-evaluator-boundary-policy-production-observability passed");
