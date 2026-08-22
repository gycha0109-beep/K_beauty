import "@/lib/server/recommendation-candidate-admission-runtime";
import { NextResponse } from "next/server";
import {
  RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION,
} from "@/lib/recommendation-candidate-admission-core.mjs";
import {
  getG3BearerTokenFromRequest,
  verifyG3GitHubActionsOidcToken,
} from "@/lib/recommendation-candidate-admission-controlled-probe-oidc.mjs";
import {
  runRecommendationCandidateAdmissionRuntimeProbe,
} from "@/lib/product-source";

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
    return noStoreJson({ error: "g3_deployment_identity_rejected" }, 409);
  }

  const authorization = await verifyG3GitHubActionsOidcToken(
    getG3BearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef },
  );
  if (!authorization.ok) {
    return noStoreJson({ error: "g3_probe_auth_rejected", code: authorization.code }, 401);
  }

  let probe;
  try {
    probe = await runRecommendationCandidateAdmissionRuntimeProbe();
  } catch {
    return noStoreJson({
      evidenceType: "v21_admission_g3_runtime_probe_v1",
      deploymentSha,
      deploymentRef,
      secretValueExposed: false,
      result: "FAIL_CLOSED",
    }, 503);
  }

  const summary = probe?.admissionSummary || null;
  const coherent = Boolean(
    summary &&
    summary.enumeratedCount === probe.productCount &&
    summary.legacyAdmittedCount + summary.nonlegacyGrantedCount === probe.productCount &&
    summary.nonlegacyCheckedCount === summary.nonlegacyGrantedCount + summary.nonlegacyRejectedCount &&
    summary.authorityFailureCount === 0
  );

  if (!coherent) {
    return noStoreJson({
      evidenceType: "v21_admission_g3_runtime_probe_v1",
      deploymentSha,
      deploymentRef,
      productCount: probe?.productCount ?? null,
      admissionSummary: summary,
      secretValueExposed: false,
      result: "FAIL_CLOSED",
    }, 503);
  }

  return noStoreJson({
    evidenceType: "v21_admission_g3_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    admissionContractVersion: RECOMMENDATION_CANDIDATE_ADMISSION_CONTRACT_VERSION,
    productCount: probe.productCount,
    admissionSummary: summary,
    secretValueExposed: false,
    result: "PASS",
  });
}
