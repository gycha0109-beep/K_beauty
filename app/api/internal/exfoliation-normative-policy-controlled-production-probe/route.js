import { NextResponse } from "next/server";
import { buildSkinMatchDecisionBundle } from "@/lib/skin-match-decision-engine";
import { buildExfoliationNormativePolicyRuntimeStateReadback } from "@/lib/exfoliation-normative-policy-runtime-state-readback";
import {
  EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES,
  assignExfoliationNormativePolicyProductionProvenance,
  resolveExfoliationNormativePolicyProductionSource
} from "@/lib/exfoliation-normative-policy-production-provenance";
import {
  getBearerTokenFromRequest,
  verifyV21_9JGitHubActionsOidcToken
} from "@/lib/exfoliation-normative-policy-controlled-probe-oidc";

export const runtime = "nodejs";

const CONTROLLED_PROBE_INPUT = Object.freeze({
  skinType: "oily",
  sensitivity: "low",
  mainConcern: "pores",
  mainConcerns: Object.freeze(["pores"]),
  recentSkinChange: "no",
  recentlyChangedProduct: "no",
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  cleansingFrequency: "twice",
  makeupUse: false
});

function noStoreJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache"
    }
  });
}

function buildProbeInput() {
  return {
    ...CONTROLLED_PROBE_INPUT,
    mainConcerns: [...CONTROLLED_PROBE_INPUT.mainConcerns]
  };
}

export async function POST(request) {
  if (
    process.env.VERCEL_ENV !== "production" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "main"
  ) {
    return noStoreJson({ error: "production_main_deployment_required" }, 409);
  }

  const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const runtimeState = buildExfoliationNormativePolicyRuntimeStateReadback(process.env);
  if (
    runtimeState.deploymentSha !== deploymentSha ||
    runtimeState.effectiveMode !== "SHADOW" ||
    runtimeState.runtimeActive !== true ||
    runtimeState.enforcementAllowed !== false ||
    runtimeState.enforceActive !== false ||
    runtimeState.restrictCanonicalExclusionActive !== false ||
    runtimeState.versionCompatible !== true ||
    runtimeState.scopeValid !== true
  ) {
    return noStoreJson(
      {
        error: "shadow_runtime_preflight_rejected",
        effectiveMode: runtimeState.effectiveMode,
        runtimeActive: runtimeState.runtimeActive,
        enforcementAllowed: runtimeState.enforcementAllowed,
        enforceActive: runtimeState.enforceActive,
        restrictCanonicalExclusionActive: runtimeState.restrictCanonicalExclusionActive,
        versionCompatible: runtimeState.versionCompatible,
        scopeValid: runtimeState.scopeValid,
        reasonCodes: runtimeState.reasonCodes
      },
      409
    );
  }

  const authorization = await verifyV21_9JGitHubActionsOidcToken(
    getBearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha }
  );
  if (!authorization.ok) {
    return noStoreJson({ error: "controlled_probe_auth_rejected", code: authorization.code }, 401);
  }

  let observation = null;
  const input = buildProbeInput();
  assignExfoliationNormativePolicyProductionProvenance(
    input,
    EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE,
    { captureObservation: (value) => { observation = value; } }
  );

  if (
    resolveExfoliationNormativePolicyProductionSource(input) !==
    EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE
  ) {
    return noStoreJson({ error: "controlled_provenance_assignment_failed" }, 500);
  }

  try {
    await buildSkinMatchDecisionBundle(input, {
      locale: "en",
      photoAnalysis: { signals: {}, evidence: [] },
      currentProducts: [],
      currentProductSnapshots: []
    });
  } catch {
    return noStoreJson({ error: "controlled_recommendation_execution_failed" }, 503);
  }

  if (!observation?.telemetry) {
    return noStoreJson({ error: "normative_observer_not_captured" }, 503);
  }

  const telemetry = observation.telemetry;
  const validControlledResult =
    observation.productionSource ===
      EXFOLIATION_NORMATIVE_POLICY_PRODUCTION_SOURCES.CONTROLLED_PRODUCTION_PROBE &&
    observation.effectiveMode === "SHADOW" &&
    observation.runtimeActive === true &&
    observation.canonicalMutationApplied === false &&
    observation.restrictCanonicalExclusionCount === 0 &&
    telemetry.controlledProductionProbeExecutionCount === 1 &&
    telemetry.organicRecommendationExecutionCount === 0 &&
    telemetry.actualNormativeExclusionCount === 0 &&
    telemetry.stopRequired === false;

  if (!validControlledResult) {
    return noStoreJson(
      {
        error: "controlled_probe_runtime_validation_failed",
        provenance: observation.productionSource,
        effectiveMode: observation.effectiveMode,
        runtimeActive: observation.runtimeActive,
        controlledProductionProbeExecutionCount:
          telemetry.controlledProductionProbeExecutionCount,
        organicRecommendationExecutionCount:
          telemetry.organicRecommendationExecutionCount,
        actualNormativeExclusionCount: telemetry.actualNormativeExclusionCount,
        canonicalMutationApplied: observation.canonicalMutationApplied,
        stopRequired: telemetry.stopRequired,
        stopReasons: telemetry.stopReasons
      },
      409
    );
  }

  return noStoreJson({
    evidenceType: "v21_9j_controlled_production_probe_result",
    provenance: observation.productionSource,
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    effectiveMode: observation.effectiveMode,
    runtimeActive: observation.runtimeActive,
    organicRecommendationExecutionCount: telemetry.organicRecommendationExecutionCount,
    controlledProductionProbeExecutionCount:
      telemetry.controlledProductionProbeExecutionCount,
    actionCounts: telemetry.controlledActionCounts,
    fallbackCount: telemetry.controlledFallbackCount,
    runtimeErrorCount: telemetry.controlledRuntimeErrorCount,
    candidateCountBefore: telemetry.candidateCountBefore,
    candidateCountAfter: telemetry.candidateCountAfter,
    hypotheticalExclusionCount: telemetry.controlledHypotheticalExclusionCount,
    actualNormativeExclusionCount: telemetry.controlledActualNormativeExclusionCount,
    canonicalMutationApplied: observation.canonicalMutationApplied,
    restrictCanonicalExclusionCount: observation.restrictCanonicalExclusionCount,
    telemetryEmitted: observation.telemetryEmitted,
    stopRequired: telemetry.stopRequired,
    stopReasons: telemetry.controlledStopReasons
  });
}
