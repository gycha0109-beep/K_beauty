import { NextResponse } from "next/server";
import {
  runStructuredProductQueryShadowEvaluation
} from "@/lib/server/product-query-shadow-service";
import {
  getDataAi3BearerTokenFromRequest,
  verifyDataAi3GitHubActionsOidcToken
} from "@/lib/product-query-shadow-probe-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEPLOYMENT_REFS = new Set(["main"]);

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

  if (!/^[0-9a-f]{40}$/.test(deploymentSha) || !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)) {
    return noStoreJson({
      evidenceType: "data_ai3_product_query_shadow_runtime_probe_v1",
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 409);
  }

  const authorization = await verifyDataAi3GitHubActionsOidcToken(
    getDataAi3BearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef }
  );

  if (!authorization.ok) {
    return noStoreJson({
      evidenceType: "data_ai3_product_query_shadow_runtime_probe_v1",
      authResultClass: authorization.code,
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 401);
  }

  let evaluation;
  try {
    evaluation = await runStructuredProductQueryShadowEvaluation();
  } catch {
    return noStoreJson({
      evidenceType: "data_ai3_product_query_shadow_runtime_probe_v1",
      workflowRunId: authorization.claims.runId,
      deploymentSha,
      deploymentRef,
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false,
      productionWrite: false,
      publicActivation: false
    }, 503);
  }

  const pass =
    evaluation.candidateCorpusCount > 0 &&
    evaluation.scenarioCount === 4 &&
    evaluation.allParity === true &&
    evaluation.allScenarioChecksPass === true;

  return noStoreJson({
    evidenceType: "data_ai3_product_query_shadow_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    contractVersion: evaluation.contractVersion,
    candidateCorpusCount: evaluation.candidateCorpusCount,
    scenarioCount: evaluation.scenarioCount,
    allParity: evaluation.allParity,
    allScenarioChecksPass: evaluation.allScenarioChecksPass,
    scenarios: evaluation.scenarios,
    secretValueExposed: false,
    queryTextExposed: false,
    productionWrite: false,
    recommendationLogWrite: false,
    publicActivation: false,
    result: pass ? "PASS" : "FAIL_CLOSED"
  }, pass ? 200 : 503);
}
