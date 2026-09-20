import { NextResponse } from "next/server";
import {
  getProductQueryActivationReadinessCaseIds,
  runProductQueryActivationReadinessCase
} from "@/lib/server/product-query-activation-readiness-service";
import {
  getDataAi5BearerTokenFromRequest,
  verifyDataAi5GitHubActionsOidcToken
} from "@/lib/product-query-activation-readiness-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEPLOYMENT_REFS = new Set(["main"]);
const ALLOWED_CASE_IDS = new Set(getProductQueryActivationReadinessCaseIds());

function noStoreJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache"
    }
  });
}

function classifyProviderError(error) {
  const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
  if ([
    "PRODUCT_QUERY_AI_UNAVAILABLE",
    "PRODUCT_QUERY_AI_TIMEOUT",
    "PRODUCT_QUERY_AI_REQUEST_FAILED"
  ].includes(code)) {
    return { failureClass: "provider_availability", status: 503, code };
  }
  if ([
    "PRODUCT_QUERY_AI_RESPONSE_INVALID",
    "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
    "PRODUCT_QUERY_AI_REFUSED",
    "PRODUCT_QUERY_AI_SCHEMA_REJECTED"
  ].includes(code)) {
    return { failureClass: "provider_protocol", status: 502, code };
  }
  return { failureClass: "evaluation_runtime", status: 500, code };
}

export async function POST(request) {
  const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const deploymentRef = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();

  if (
    !/^[0-9a-f]{40}$/.test(deploymentSha) ||
    !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)
  ) {
    return noStoreJson({
      evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
      result: "FAIL_CLOSED",
      failureClass: "deployment_binding",
      secretValueExposed: false,
      queryTextExposed: false
    }, 409);
  }

  const authorization = await verifyDataAi5GitHubActionsOidcToken(
    getDataAi5BearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef }
  );

  if (!authorization.ok) {
    return noStoreJson({
      evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
      authResultClass: authorization.code,
      result: "FAIL_CLOSED",
      failureClass: "authorization",
      secretValueExposed: false,
      queryTextExposed: false
    }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({
      evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
      result: "FAIL_CLOSED",
      failureClass: "input_contract",
      secretValueExposed: false,
      queryTextExposed: false
    }, 400);
  }

  const bodyKeys =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body).sort()
      : [];
  if (bodyKeys.length !== 1 || bodyKeys[0] !== "caseId") {
    return noStoreJson({
      evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
      result: "FAIL_CLOSED",
      failureClass: "input_contract",
      secretValueExposed: false,
      queryTextExposed: false
    }, 400);
  }

  const caseId = typeof body.caseId === "string" ? body.caseId.trim() : "";
  if (!ALLOWED_CASE_IDS.has(caseId)) {
    return noStoreJson({
      evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
      result: "FAIL_CLOSED",
      failureClass: "input_contract",
      secretValueExposed: false,
      queryTextExposed: false
    }, 400);
  }

  let evaluation;
  try {
    evaluation = await runProductQueryActivationReadinessCase(caseId);
  } catch (error) {
    const classification = classifyProviderError(error);
    return noStoreJson({
      evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
      workflowRunId: authorization.claims.runId,
      deploymentSha,
      deploymentRef,
      caseId,
      providerResultClass: classification.code,
      result: "FAIL_CLOSED",
      failureClass: classification.failureClass,
      secretValueExposed: false,
      queryTextExposed: false,
      productionWrite: false,
      recommendationLogWrite: false,
      publicActivation: false
    }, classification.status);
  }

  return noStoreJson({
    evidenceType: "data_ai5_activation_readiness_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    contractVersion: evaluation.contractVersion,
    caseId: evaluation.caseId,
    family: evaluation.family,
    querySha256: evaluation.querySha256,
    provider: evaluation.provider,
    model: evaluation.model,
    latencyMs: evaluation.latencyMs,
    intent: evaluation.intent,
    execution: evaluation.execution,
    casePass: evaluation.pass,
    failures: evaluation.failures,
    persisted: evaluation.persisted,
    secretValueExposed: false,
    queryTextExposed: false,
    productionWrite: false,
    recommendationLogWrite: false,
    publicActivation: false,
    failureClass: evaluation.pass ? null : "semantic_assertion",
    result: evaluation.pass ? "PASS" : "FAIL_CLOSED"
  }, evaluation.pass ? 200 : 422);
}
