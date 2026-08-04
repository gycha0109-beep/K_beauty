import { createHash } from "node:crypto";
import { evaluateCandidateExposurePolicy } from "./candidate-exposure-policy.js";
import { buildCandidateExposureUnexpectedDivergenceDiagnostics } from "./candidate-exposure-policy-divergence-diagnostics.js";
import {
  buildCandidateExposurePolicyShadowTelemetry,
  compareCandidateExposurePolicyWithLegacy,
  emitCandidateExposurePolicyShadowTelemetry,
  resolveCurrentFindingsTelemetryState
} from "./candidate-exposure-policy-observability.js";
import {
  RECOMMENDATION_METADATA_SHADOW_VERSION,
  buildRecommendationMetadataTransportShadow
} from "./recommendation-metadata-transport-shadow.js";

const SHADOW_FLAG = "DEV_ONLY_CANDIDATE_EXPOSURE_POLICY_SHADOW";
const KILL_SWITCH = "DISABLE_CANDIDATE_EXPOSURE_POLICY_SHADOW";

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
  );
}

export function fingerprintCandidateExposureShadowValue(value) {
  return createHash("sha256").update(JSON.stringify(stableValue(value))).digest("hex");
}

function candidateOrder(candidates) {
  return (Array.isArray(candidates) ? candidates : []).map((candidate) =>
    String(candidate?.id || candidate?.productId || candidate?.product_id || "").trim()
  );
}

function emitUnexpectedDivergenceDiagnostics({
  policyResult,
  legacyExecution,
  telemetrySink
}) {
  const diagnostics = buildCandidateExposureUnexpectedDivergenceDiagnostics({
    decisions: policyResult?.decisions,
    legacyExecution
  });

  if (diagnostics.unexpectedDivergenceCount > 0) {
    try {
      telemetrySink("[candidate-exposure-policy-shadow-divergence]", diagnostics);
    } catch {
      return diagnostics;
    }
  }

  return diagnostics;
}

function buildMetadataTransportShadow({ candidates, canonicalState }) {
  try {
    return buildRecommendationMetadataTransportShadow({ candidates, canonicalState });
  } catch {
    return {
      version: RECOMMENDATION_METADATA_SHADOW_VERSION,
      mode: "shadow_only",
      status: "execution_failed",
      actualMutation: false
    };
  }
}

export function resolveCandidateExposurePolicyShadowControl(envLike = {}) {
  const optInRequested = envLike?.[SHADOW_FLAG] === "1";
  const killSwitchRequested = envLike?.[KILL_SWITCH] === "1";
  const vercelEnvironment = String(envLike?.VERCEL_ENV || "").trim().toLowerCase();
  const nodeEnvironment = String(envLike?.NODE_ENV || "").trim().toLowerCase();

  const preview = vercelEnvironment === "preview";
  const explicitDevelopment = vercelEnvironment === "development";
  const localDevelopment = !vercelEnvironment && nodeEnvironment === "development";
  const production = vercelEnvironment === "production" ||
    (!vercelEnvironment && nodeEnvironment === "production");
  const recognizedEnvironment = preview || explicitDevelopment || localDevelopment || production;
  const allowedShadowEnvironment = preview || explicitDevelopment || localDevelopment;
  const enabled = optInRequested &&
    !killSwitchRequested &&
    !production &&
    recognizedEnvironment &&
    allowedShadowEnvironment;

  return Object.freeze({
    enabled,
    optInRequested,
    killSwitchRequested,
    productionHardDisabled: production,
    mode: enabled ? "shadow_only" : killSwitchRequested ? "kill_switched" : "disabled"
  });
}

export function runCandidateExposurePolicyShadow({
  control,
  canonicalState,
  candidates,
  legacyExecution,
  responseValue,
  snapshotValue,
  telemetrySink = console.info,
  evaluator = evaluateCandidateExposurePolicy
} = {}) {
  if (!control?.enabled) {
    return { executed: false, status: "disabled", telemetry: null };
  }

  const responseBefore = fingerprintCandidateExposureShadowValue(responseValue);
  const snapshotBefore = fingerprintCandidateExposureShadowValue(snapshotValue);
  const orderBefore = candidateOrder(candidates);

  try {
    const policyResult = evaluator({ canonicalState, candidates });
    const comparison = compareCandidateExposurePolicyWithLegacy({
      decisions: policyResult.decisions,
      legacyExecution
    });
    const divergenceDiagnostics = emitUnexpectedDivergenceDiagnostics({
      policyResult,
      legacyExecution,
      telemetrySink
    });
    const metadataTransportShadow = buildMetadataTransportShadow({
      candidates,
      canonicalState
    });
    const fingerprints = {
      responseMatch: responseBefore === fingerprintCandidateExposureShadowValue(responseValue),
      snapshotMatch: snapshotBefore === fingerprintCandidateExposureShadowValue(snapshotValue),
      candidateOrderMatch: JSON.stringify(orderBefore) === JSON.stringify(candidateOrder(candidates))
    };
    const enrichedResult = {
      ...policyResult,
      contextVersion: canonicalState?.decisionBundle?.context?.version || "unknown",
      currentFindingsState: resolveCurrentFindingsTelemetryState(canonicalState?.currentProductFindings)
    };
    const telemetry = buildCandidateExposurePolicyShadowTelemetry({
      control,
      policyResult: enrichedResult,
      comparison,
      fingerprints
    });
    const emitted = emitCandidateExposurePolicyShadowTelemetry(telemetry, telemetrySink);
    if (!emitted.emitted) {
      const serializationTelemetry = buildCandidateExposurePolicyShadowTelemetry({
        control,
        policyResult: enrichedResult,
        comparison,
        fingerprints,
        errorCategory: "observability_serialization_failed"
      });
      return {
        executed: true,
        status: "execution_failed",
        errorCategory: "observability_serialization_failed",
        policyResult,
        comparison,
        divergenceDiagnostics,
        metadataTransportShadow,
        fingerprints,
        telemetry: serializationTelemetry
      };
    }
    return {
      executed: true,
      status: policyResult.status === "invalid_canonical_input"
        ? "fail_closed"
        : "executed",
      policyResult,
      comparison,
      divergenceDiagnostics,
      metadataTransportShadow,
      fingerprints,
      telemetry
    };
  } catch {
    const fingerprints = {
      responseMatch: responseBefore === fingerprintCandidateExposureShadowValue(responseValue),
      snapshotMatch: snapshotBefore === fingerprintCandidateExposureShadowValue(snapshotValue),
      candidateOrderMatch: JSON.stringify(orderBefore) === JSON.stringify(candidateOrder(candidates))
    };
    const telemetry = buildCandidateExposurePolicyShadowTelemetry({
      control,
      policyResult: {
        policyVersion: "candidate-exposure-policy-v1",
        contextVersion: canonicalState?.decisionBundle?.context?.version || "unknown",
        currentFindingsState: resolveCurrentFindingsTelemetryState(canonicalState?.currentProductFindings),
        decisions: []
      },
      comparison: { categoryCounts: {} },
      fingerprints,
      errorCategory: "adapter_execution_failed"
    });
    emitCandidateExposurePolicyShadowTelemetry(telemetry, telemetrySink);
    return {
      executed: true,
      status: "execution_failed",
      errorCategory: "adapter_execution_failed",
      fingerprints,
      telemetry
    };
  }
}

export const CANDIDATE_EXPOSURE_POLICY_SHADOW_ENV = Object.freeze({
  optIn: SHADOW_FLAG,
  killSwitch: KILL_SWITCH
});
