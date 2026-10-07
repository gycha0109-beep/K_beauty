import { NextResponse } from "next/server";
import {
  getD5eFAuthenticatedBetaProbeCaseIds,
  runD5eFAuthenticatedBetaProbeCase,
} from "@/lib/server/product-query-spf-authenticated-beta-service";
import {
  getDataAi5BearerTokenFromRequest,
  verifyDataAi5GitHubActionsOidcToken,
} from "@/lib/product-query-activation-readiness-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEPLOYMENT_REFS = new Set(["main"]);
const ALLOWED_CASE_IDS = new Set(
  getD5eFAuthenticatedBetaProbeCaseIds(),
);

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
  const deploymentSha = String(
    process.env.VERCEL_GIT_COMMIT_SHA || "",
  ).trim();
  const deploymentRef = String(
    process.env.VERCEL_GIT_COMMIT_REF || "",
  ).trim();

  if (
    !/^[0-9a-f]{40}$/.test(deploymentSha) ||
    !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)
  ) {
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_f_authenticated_beta_allowlist_expansion_v1",
        result: "FAIL_CLOSED",
        failureClass: "deployment_binding",
        publicSearchCutover: false,
      },
      409,
    );
  }

  const authorization =
    await verifyDataAi5GitHubActionsOidcToken(
      getDataAi5BearerTokenFromRequest(request),
      {
        expectedDeploymentSha: deploymentSha,
        expectedGitRef: deploymentRef,
      },
    );

  if (!authorization.ok) {
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_f_authenticated_beta_allowlist_expansion_v1",
        result: "FAIL_CLOSED",
        failureClass: "authorization",
        authResultClass: authorization.code,
        publicSearchCutover: false,
      },
      401,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_f_authenticated_beta_allowlist_expansion_v1",
        result: "FAIL_CLOSED",
        failureClass: "input_contract",
        publicSearchCutover: false,
      },
      400,
    );
  }

  const keys =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body).sort()
      : [];

  if (
    keys.length !== 1 ||
    keys[0] !== "caseId" ||
    typeof body.caseId !== "string" ||
    !ALLOWED_CASE_IDS.has(body.caseId.trim())
  ) {
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_f_authenticated_beta_allowlist_expansion_v1",
        result: "FAIL_CLOSED",
        failureClass: "input_contract",
        publicSearchCutover: false,
      },
      400,
    );
  }

  const caseId = body.caseId.trim();
  const evaluation =
    await runD5eFAuthenticatedBetaProbeCase(caseId);

  return noStoreJson(
    {
      evidenceType:
        "data_ai29c_d5e_f_authenticated_beta_allowlist_expansion_v1",
      workflowRunId: authorization.claims.runId,
      deploymentSha,
      deploymentRef,
      ...evaluation,
      publicSearchCutover: false,
      result: evaluation.pass ? "PASS" : "FAIL_CLOSED",
      failureClass:
        evaluation.pass ? null : "authenticated_beta_expansion_assertion",
    },
    evaluation.pass ? 200 : 422,
  );
}
