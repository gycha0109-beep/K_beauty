import { NextResponse } from "next/server";
import { runCatalogTaxonomyRecommendationShadowReplay } from "@/lib/catalog-taxonomy-recommendation-shadow-replay";
import {
  getDataTaxonomy5BearerTokenFromRequest,
  verifyDataTaxonomy5GitHubActionsOidcToken,
} from "@/lib/catalog-taxonomy-recommendation-shadow-probe-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}

export async function POST(request) {
  const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
  const deploymentRef = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
  if (!/^[0-9a-f]{40}$/.test(deploymentSha) || deploymentRef !== "main") {
    return noStoreJson({ error: "data_taxonomy5_deployment_identity_rejected" }, 409);
  }

  const authorization = await verifyDataTaxonomy5GitHubActionsOidcToken(
    getDataTaxonomy5BearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef },
  );
  if (!authorization.ok) {
    return noStoreJson({ error: "data_taxonomy5_probe_auth_rejected", code: authorization.code }, 401);
  }

  const replay = await runCatalogTaxonomyRecommendationShadowReplay();
  const body = {
    evidenceType: "data_taxonomy5_production_recommendation_parity_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    ...replay,
    secretValueExposed: false,
  };
  return noStoreJson(body, replay.result === "PASS" ? 200 : 503);
}