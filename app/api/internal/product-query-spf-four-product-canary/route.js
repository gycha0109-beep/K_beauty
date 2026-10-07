import { NextResponse } from "next/server";
import {
  getProductQuerySpfFourProductCanaryCaseIds,
  runProductQuerySpfFourProductCanaryCase,
} from "@/lib/server/product-query-spf-four-product-canary-service";
import {
  getDataAi5BearerTokenFromRequest,
  verifyDataAi5GitHubActionsOidcToken,
} from "@/lib/product-query-activation-readiness-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEPLOYMENT_REFS = new Set(["main"]);
const ALLOWED_CASE_IDS = new Set(
  getProductQuerySpfFourProductCanaryCaseIds(),
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

function classifyCanaryError(error) {
  const code =
    typeof error?.code === "string"
      ? error.code
      : "DATA_AI29C_D5E_E_RUNTIME_FAILED";

  if (
    code.includes("AUTHORITY") ||
    code.includes("PRODUCT_SOURCE")
  ) {
    return {
      code,
      failureClass: "authority_or_corpus_unavailable",
      status: 503,
    };
  }

  return {
    code,
    failureClass: "canary_runtime",
    status: 500,
  };
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
          "data_ai29c_d5e_e_four_product_internal_canary_v1",
        result: "FAIL_CLOSED",
        failureClass: "deployment_binding",
        secretValueExposed: false,
        queryTextExposed: false,
        publicActivation: false,
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
          "data_ai29c_d5e_e_four_product_internal_canary_v1",
        authResultClass: authorization.code,
        result: "FAIL_CLOSED",
        failureClass: "authorization",
        secretValueExposed: false,
        queryTextExposed: false,
        publicActivation: false,
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
          "data_ai29c_d5e_e_four_product_internal_canary_v1",
        result: "FAIL_CLOSED",
        failureClass: "input_contract",
        secretValueExposed: false,
        queryTextExposed: false,
        publicActivation: false,
      },
      400,
    );
  }

  const bodyKeys =
    body && typeof body === "object" && !Array.isArray(body)
      ? Object.keys(body).sort()
      : [];

  if (
    bodyKeys.length !== 1 ||
    bodyKeys[0] !== "caseId"
  ) {
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_e_four_product_internal_canary_v1",
        result: "FAIL_CLOSED",
        failureClass: "input_contract",
        secretValueExposed: false,
        queryTextExposed: false,
        publicActivation: false,
      },
      400,
    );
  }

  const caseId =
    typeof body.caseId === "string"
      ? body.caseId.trim()
      : "";

  if (!ALLOWED_CASE_IDS.has(caseId)) {
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_e_four_product_internal_canary_v1",
        result: "FAIL_CLOSED",
        failureClass: "input_contract",
        secretValueExposed: false,
        queryTextExposed: false,
        publicActivation: false,
      },
      400,
    );
  }

  let evaluation;
  try {
    evaluation =
      await runProductQuerySpfFourProductCanaryCase(caseId);
  } catch (error) {
    const classification = classifyCanaryError(error);
    return noStoreJson(
      {
        evidenceType:
          "data_ai29c_d5e_e_four_product_internal_canary_v1",
        workflowRunId: authorization.claims.runId,
        deploymentSha,
        deploymentRef,
        caseId,
        result: "FAIL_CLOSED",
        failureClass: classification.failureClass,
        runtimeResultClass: classification.code,
        secretValueExposed: false,
        queryTextExposed: false,
        productionWrite: false,
        recommendationLogWrite: false,
        publicActivation: false,
      },
      classification.status,
    );
  }

  return noStoreJson(
    {
      evidenceType:
        "data_ai29c_d5e_e_four_product_internal_canary_v1",
      workflowRunId: authorization.claims.runId,
      deploymentSha,
      deploymentRef,
      contractVersion: evaluation.contractVersion,
      caseId: evaluation.caseId,
      currentProductionSunscreenCount:
        evaluation.currentProductionSunscreenCount,
      canaryTargetCount: evaluation.canaryTargetCount,
      canaryGrantedCount: evaluation.canaryGrantedCount,
      combinedSunscreenCount:
        evaluation.combinedSunscreenCount,
      legacySpfEligibleCount:
        evaluation.legacySpfEligibleCount,
      canaryAdmission: evaluation.canaryAdmission,
      execution: evaluation.execution,
      rollbackReady: evaluation.rollbackReady,
      casePass: evaluation.pass,
      failures: evaluation.failures,
      persisted: evaluation.persisted,
      secretValueExposed: false,
      queryTextExposed: false,
      productionWrite: false,
      recommendationLogWrite: false,
      publicActivation: false,
      failureClass:
        evaluation.pass ? null : "canary_assertion",
      result: evaluation.pass ? "PASS" : "FAIL_CLOSED",
    },
    evaluation.pass ? 200 : 422,
  );
}
