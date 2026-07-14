import {
  buildEvaluatorBoundaryPolicyRuntimeTelemetry,
  emitEvaluatorBoundaryPolicyRuntimeTelemetry,
  resolveEvaluatorBoundaryPolicyRuntimeControl,
  validateEvaluatorBoundaryPolicyRuntimeTelemetry
} from "./evaluator-boundary-policy-runtime-observability.js";

export const EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_FLAG =
  "ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_PREVIEW_KILL_SWITCH_PROBE";
export const EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_BRANCH =
  "codex/local-shadow-runtime-validation";
export const EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_RESPONSE_FIELDS = Object.freeze([
  "runtimeEnabled",
  "runtimeExecuted",
  "runtimeConnected",
  "killSwitchRequested",
  "killSwitchSuppressedExecution",
  "scopeValidationFailed",
  "disabledExecutionViolationCount",
  "stopRequired",
  "stopReasons"
]);

export function isEvaluatorBoundaryPolicyPreviewProbeAllowed(envLike = {}) {
  return (
    envLike.VERCEL_ENV === "preview" &&
    envLike.VERCEL_GIT_COMMIT_REF === EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_BRANCH &&
    envLike[EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_FLAG] === "1"
  );
}

export function buildEvaluatorBoundaryPolicyPreviewProbe(envLike = {}) {
  if (!isEvaluatorBoundaryPolicyPreviewProbeAllowed(envLike)) {
    return { allowed: false, status: 404 };
  }

  const control = resolveEvaluatorBoundaryPolicyRuntimeControl(envLike);
  const telemetry = buildEvaluatorBoundaryPolicyRuntimeTelemetry({ control });
  const validation = validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry);
  if (!validation.valid) {
    return { allowed: true, status: 500 };
  }

  return {
    allowed: true,
    status: 200,
    telemetry,
    response: Object.fromEntries(
      EVALUATOR_BOUNDARY_POLICY_PREVIEW_PROBE_RESPONSE_FIELDS.map((field) => [field, telemetry[field]])
    )
  };
}

export function executeEvaluatorBoundaryPolicyPreviewProbe({ envLike = {}, sink = console.info } = {}) {
  const probe = buildEvaluatorBoundaryPolicyPreviewProbe(envLike);
  if (probe.status !== 200) return probe;

  return {
    ...probe,
    telemetryEmission: emitEvaluatorBoundaryPolicyRuntimeTelemetry(probe.telemetry, sink)
  };
}
