import {
  buildEvaluatorBoundaryPolicyRuntimeTelemetry,
  emitEvaluatorBoundaryPolicyRuntimeTelemetry,
  resolveEvaluatorBoundaryPolicyRuntimeControl,
  validateEvaluatorBoundaryPolicyRuntimeTelemetry
} from "./evaluator-boundary-policy-runtime-observability.js";
import { buildCandidatePolicyRuntimeSafetyContext } from "./candidate-policy-runtime-safety.js";
import { buildCandidatePolicyGoalContext } from "./candidate-policy-goal-context.js";

export const EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_FLAG =
  "ENABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_PREVIEW_RUNTIME_PROBE";
export const EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_BRANCH =
  "codex/local-shadow-runtime-validation";
export const EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_RESPONSE_FIELDS = Object.freeze([
  "runtimeEnabled",
  "runtimeExecuted",
  "runtimeConnected",
  "inputCandidateCount",
  "visibleCandidateCount",
  "unexpectedReceiverExposureCount",
  "safetyViolationCounts",
  "stopRequired",
  "stopReasons"
]);

function syntheticRuntimeInput() {
  const sharedContext = {
    version: "shared-skin-decision-context-v3",
    skinState: {
      priorityAxis: "acne"
    },
    safetyState: {
      level: "stabilize_first",
      activeExpansionAllowed: false,
      protectionMustMaintain: true
    }
  };
  const functionalPolicy = {
    version: "functional-policy-v1",
    priorityAxis: "acne",
    planMode: "HOLD",
    recommendationSuppressed: true,
    reasonCodes: ["synthetic_probe_stabilization"],
    safety: {
      level: "stabilize_first",
      activeExpansionAllowed: false,
      protectionMustMaintain: true
    }
  };
  const candidateSafetyContext = buildCandidatePolicyRuntimeSafetyContext({
    sharedContext,
    functionalPolicy
  });
  const candidateGoalContext = buildCandidatePolicyGoalContext({
    surveyContract: {
      goals: {
        primaryConcern: "acne"
      }
    },
    sharedContext,
    functionalPolicy,
    effectivePolicySource: "raw"
  });
  return {
    products: [
      {
        id: "preview-probe-active-safe",
        category: "treatment",
        irritation_risk: "low",
        sensitivity_safe: true,
        concerns: ["acne"],
        ingredient_signals: {
          functional: [{ label: "acne relief", count: 3 }]
        }
      },
      {
        id: "preview-probe-active-unsafe",
        category: "treatment",
        irritation_risk: "high",
        sensitivity_safe: false,
        concerns: ["acne"],
        ingredient_signals: {
          functional: [{ label: "acne relief", count: 3 }]
        }
      },
      {
        id: "preview-probe-metadata-incomplete",
        category: "serum",
        concerns: ["acne"],
        ingredient_signals: {
          functional: [{ label: "acne relief", count: 3 }]
        }
      }
    ],
    surveyContract: {
      safety: {
        recentSkinChange: "yes",
        sensitivityRisk: "high",
        rednessRisk: "high"
      }
    },
    goalPolicy: {
      rankingGoal: "acne",
      safetyGoal: "stabilize",
      recommendationGuard: "stabilize_first",
      recentInstability: true,
      highSensitivity: true
    },
    candidateSafetyContext,
    candidateGoalContext
  };
}

export function isEvaluatorBoundaryPolicyPreviewRuntimeProbeAllowed(envLike = {}) {
  if (
    envLike.VERCEL_ENV !== "preview" ||
    envLike.VERCEL_GIT_COMMIT_REF !== EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_BRANCH ||
    envLike[EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_FLAG] !== "1" ||
    envLike.DISABLE_EVALUATOR_BOUNDARY_CANDIDATE_POLICY_RUNTIME === "1"
  ) {
    return false;
  }

  return resolveEvaluatorBoundaryPolicyRuntimeControl(envLike).runtimeEnabled === true;
}

export async function executeEvaluatorBoundaryPolicyPreviewRuntimeProbe({
  envLike = {},
  sink = console.info
} = {}) {
  if (!isEvaluatorBoundaryPolicyPreviewRuntimeProbeAllowed(envLike)) {
    return { allowed: false, status: 404 };
  }

  const control = resolveEvaluatorBoundaryPolicyRuntimeControl(envLike);
  const startedAt = Date.now();
  let runtimeResult = null;
  let runtimeError = false;

  try {
    const runtimeModule = await import("./evaluator-boundary-policy-runtime.js");
    runtimeResult = runtimeModule.buildEvaluatorBoundaryPolicyRuntime(syntheticRuntimeInput());
  } catch {
    runtimeError = true;
  }

  const telemetry = buildEvaluatorBoundaryPolicyRuntimeTelemetry({
    control,
    runtimeResult,
    runtimeError,
    latencyMs: Date.now() - startedAt
  });
  const validation = validateEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry);
  if (!validation.valid) return { allowed: true, status: 500 };

  const response = Object.fromEntries(
    EVALUATOR_BOUNDARY_POLICY_PREVIEW_RUNTIME_PROBE_RESPONSE_FIELDS.map((field) => [field, telemetry[field]])
  );

  return {
    allowed: true,
    status: 200,
    response,
    telemetry,
    telemetryEmission: emitEvaluatorBoundaryPolicyRuntimeTelemetry(telemetry, sink)
  };
}
