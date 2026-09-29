import { NextResponse } from "next/server";
import {
  runProductQueryProtectionShadowEvaluation
} from "@/lib/server/product-query-protection-shadow-service";
import {
  getDataAi29cBearerTokenFromRequest,
  verifyDataAi29cGitHubActionsOidcToken
} from "@/lib/product-query-protection-shadow-oidc";

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

  if (
    !/^[0-9a-f]{40}$/.test(deploymentSha) ||
    !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)
  ) {
    return noStoreJson({
      evidenceType: "data_ai29c_protection_shadow_runtime_probe_v1",
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 409);
  }

  const authorization = await verifyDataAi29cGitHubActionsOidcToken(
    getDataAi29cBearerTokenFromRequest(request),
    {
      expectedDeploymentSha: deploymentSha,
      expectedGitRef: deploymentRef
    }
  );

  if (!authorization.ok) {
    return noStoreJson({
      evidenceType: "data_ai29c_protection_shadow_runtime_probe_v1",
      authResultClass: authorization.code,
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false
    }, 401);
  }

  let evaluation;
  try {
    evaluation = await runProductQueryProtectionShadowEvaluation();
  } catch {
    return noStoreJson({
      evidenceType: "data_ai29c_protection_shadow_runtime_probe_v1",
      workflowRunId: authorization.claims.runId,
      deploymentSha,
      deploymentRef,
      result: "FAIL_CLOSED",
      secretValueExposed: false,
      queryTextExposed: false,
      productionWrite: false,
      recommendationLogWrite: false,
      publicActivation: false
    }, 503);
  }

  const pass =
    evaluation.sunscreenCorpusCount > 0 &&
    evaluation.authorityResolvedCount === evaluation.sunscreenCorpusCount &&
    evaluation.scenarioCount === 4 &&
    evaluation.allScenarioChecksPass === true &&
    evaluation.limits.productionRankingChanged === false &&
    evaluation.limits.productionCutoverAuthorized === false &&
    evaluation.limits.outdoorRankableSignalAuthorized === false &&
    evaluation.limits.persistence === false &&
    evaluation.limits.publicActivation === false;

  return noStoreJson({
    evidenceType: "data_ai29c_protection_shadow_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    contractVersion: evaluation.contractVersion,
    sunscreenCorpusCount: evaluation.sunscreenCorpusCount,
    authorityResolvedCount: evaluation.authorityResolvedCount,
    audit: evaluation.audit,
    enabledAxes: evaluation.enabledAxes,
    scenarioCount: evaluation.scenarioCount,
    allScenarioChecksPass: evaluation.allScenarioChecksPass,
    scenarios: evaluation.scenarios,
    limits: evaluation.limits,
    secretValueExposed: false,
    queryTextExposed: false,
    productionWrite: false,
    recommendationLogWrite: false,
    publicActivation: false,
    result: pass ? "PASS" : "FAIL_CLOSED"
  }, pass ? 200 : 503);
}
