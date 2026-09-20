import { NextResponse } from "next/server";
import {
  getProductQueryProviderShadowScenarioIds,
  runProductQueryProviderShadowScenario
} from "@/lib/server/product-query-provider-shadow-service";
import {
  getDataAi4BearerTokenFromRequest,
  verifyDataAi4GitHubActionsOidcToken
} from "@/lib/product-query-provider-shadow-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEPLOYMENT_REFS = new Set(["main"]);
const ALLOWED_SCENARIO_IDS = new Set(getProductQueryProviderShadowScenarioIds());

function noStoreJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache"
    }
  });
}

export async function POST(request) {
  const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const deploymentRef = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();

  if (
    !/^[0-9a-f]{40}$/.test(deploymentSha) ||
    !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)
  ) {
    return noStoreJson({
      evidenceType: "data_ai4_provider_shadow_runtime_probe_v1",
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 409);
  }

  const authorization = await verifyDataAi4GitHubActionsOidcToken(
    getDataAi4BearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef }
  );

  if (!authorization.ok) {
    return noStoreJson({
      evidenceType: "data_ai4_provider_shadow_runtime_probe_v1",
      authResultClass: authorization.code,
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({
      evidenceType: "data_ai4_provider_shadow_runtime_probe_v1",
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 400);
  }

  const scenarioId =
    typeof body?.scenarioId === "string" ? body.scenarioId.trim() : "";
  if (!ALLOWED_SCENARIO_IDS.has(scenarioId)) {
    return noStoreJson({
      evidenceType: "data_ai4_provider_shadow_runtime_probe_v1",
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 400);
  }

  let evaluation;
  try {
    evaluation = await runProductQueryProviderShadowScenario(scenarioId);
  } catch (error) {
    return noStoreJson({
      evidenceType: "data_ai4_provider_shadow_runtime_probe_v1",
      workflowRunId: authorization.claims.runId,
      deploymentSha,
      deploymentRef,
      scenarioId,
      providerResultClass:
        typeof error?.code === "string" ? error.code : "PROVIDER_SHADOW_FAILED",
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false,
      productionWrite: false,
      recommendationLogWrite: false,
      publicActivation: false
    }, 503);
  }

  return noStoreJson({
    evidenceType: "data_ai4_provider_shadow_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    contractVersion: evaluation.contractVersion,
    scenarioId: evaluation.scenarioId,
    querySha256: evaluation.querySha256,
    provider: evaluation.provider,
    model: evaluation.model,
    intent: evaluation.intent,
    execution: evaluation.execution,
    scenarioPass: evaluation.pass,
    failures: evaluation.failures,
    persisted: evaluation.persisted,
    secretValueExposed: false,
    queryTextExposed: false,
    productionWrite: false,
    recommendationLogWrite: false,
    publicActivation: false,
    result: evaluation.pass ? "PASS" : "FAIL_CLOSED"
  }, evaluation.pass ? 200 : 503);
}
