import { NextResponse } from "next/server";
import { isCanonicalRecommendationUuid } from "@/lib/recommendation-admission-authority-contract.mjs";
import { readRecommendationAdmissionAuthority } from "@/lib/recommendation-admission-authority-reader";
import {
  RECOMMENDATION_CATEGORY_AUTHORITY_STATUS,
  runRecommendationCategoryAuthorityRuntimeSecurityProbe,
} from "@/lib/recommendation-category-authority-reader";
import {
  getG3ABearerTokenFromRequest,
  verifyG3AGitHubActionsOidcToken,
} from "@/lib/recommendation-admission-authority-controlled-probe-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FATION_PRODUCT_ID = "da5df70c-8cdd-4eb2-93b6-ede46c2f171d";
const ALLOWED_DEPLOYMENT_REFS = new Set(["main"]);

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
  if (
    !/^[0-9a-f]{40}$/.test(deploymentSha) ||
    !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)
  ) {
    return noStoreJson({ error: "g4f2_deployment_identity_rejected" }, 409);
  }

  const authorization = await verifyG3AGitHubActionsOidcToken(
    getG3ABearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef },
  );
  if (!authorization.ok) {
    return noStoreJson(
      { error: "g4f2_probe_auth_rejected", code: authorization.code },
      401,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "g4f2_probe_body_invalid" }, 400);
  }

  const productId =
    typeof body?.productId === "string" ? body.productId.trim() : "";
  if (
    !isCanonicalRecommendationUuid(productId) ||
    productId !== FATION_PRODUCT_ID
  ) {
    return noStoreJson({ error: "g4f2_probe_product_id_not_allowed" }, 400);
  }

  const [pfAuthority, categoryProbe] = await Promise.all([
    readRecommendationAdmissionAuthority(productId),
    runRecommendationCategoryAuthorityRuntimeSecurityProbe(productId),
  ]);

  const categoryAuthority = categoryProbe.authority;
  const pass =
    categoryProbe.credentialAvailable === true &&
    categoryProbe.runtimeRoleMatch === true &&
    categoryProbe.rawCategoryReviewSelectDenied === true &&
    categoryProbe.rawTaxonomySelectDenied === true &&
    categoryProbe.rawTaxonomyVersionSelectDenied === true &&
    categoryAuthority?.status ===
      RECOMMENDATION_CATEGORY_AUTHORITY_STATUS.RESOLVED &&
    categoryAuthority?.authority?.productId === productId &&
    categoryAuthority?.authority?.category === "treatment" &&
    categoryAuthority?.recommendationAdmissionMutated === false &&
    categoryAuthority?.productionCutoverAuthorized === false;

  const evidence = {
    evidenceType: "v21_admission_g4_f2_category_authority_shadow_dual_read_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    credentialAvailable: categoryProbe.credentialAvailable,
    runtimeRoleMatch: categoryProbe.runtimeRoleMatch,
    rawCategoryReviewSelectDenied:
      categoryProbe.rawCategoryReviewSelectDenied,
    rawTaxonomySelectDenied: categoryProbe.rawTaxonomySelectDenied,
    rawTaxonomyVersionSelectDenied:
      categoryProbe.rawTaxonomyVersionSelectDenied,
    pfAuthorityStatus: pfAuthority?.status || "NO_AUTHORITY",
    pfAuthorityReason: pfAuthority?.reason || null,
    categoryAuthorityStatus:
      categoryAuthority?.status || "NO_AUTHORITY",
    categoryAuthorityReason: categoryAuthority?.reason || null,
    categoryAuthorityReadContractVersion:
      categoryAuthority?.readContractVersion || null,
    category: categoryAuthority?.authority?.category || null,
    assignmentSnapshotDigest:
      categoryAuthority?.authority?.assignmentSnapshotDigest || null,
    productionDecisionSource: "G3_PF_AUTHORITY_ONLY",
    categoryAuthorityObservationalOnly: true,
    recommendationAdmissionMutated: false,
    productionCutoverAuthorized: false,
    secretValueExposed: false,
    result: pass ? "PASS" : "FAIL_CLOSED",
  };

  return noStoreJson(evidence, pass ? 200 : 503);
}
