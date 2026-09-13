import { NextResponse } from "next/server";
import {
  runProductOfferPresentationRuntimeSecurityProbe,
} from "@/lib/server/product-offer-read-service";
import {
  getDataOffer17BearerTokenFromRequest,
  verifyDataOffer17GitHubActionsOidcToken,
} from "@/lib/product-offer-controlled-probe-oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTROLLED_PRODUCT_ID = "08b85f37-b1fa-42d7-893a-0d4facb17878";
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
  if (!/^[0-9a-f]{40}$/.test(deploymentSha) || !ALLOWED_DEPLOYMENT_REFS.has(deploymentRef)) {
    return noStoreJson({
      evidenceType: "data_offer17_offer_runtime_probe_v1",
      secretValueExposed: false,
      result: "FAIL_CLOSED",
    }, 409);
  }

  const authorization = await verifyDataOffer17GitHubActionsOidcToken(
    getDataOffer17BearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef },
  );
  if (!authorization.ok) {
    return noStoreJson({
      evidenceType: "data_offer17_offer_runtime_probe_v1",
      authResultClass: authorization.code,
      secretValueExposed: false,
      result: "FAIL_CLOSED",
    }, 401);
  }

  const probe = await runProductOfferPresentationRuntimeSecurityProbe(
    CONTROLLED_PRODUCT_ID,
  );
  const securityBoundaryPass =
    probe.credentialAvailable &&
    probe.runtimeRoleMatch &&
    probe.rawOfferSelectDenied;
  const rpcPass = probe.rpcResultClass === "SUCCESS";

  return noStoreJson({
    evidenceType: "data_offer17_offer_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    credentialAvailable: probe.credentialAvailable,
    runtimeRoleMatch: probe.runtimeRoleMatch,
    rawOfferSelectDenied: probe.rawOfferSelectDenied,
    rpcStatus: probe.rpcStatus,
    rpcResultClass: probe.rpcResultClass,
    rowCardinality: probe.rowCardinality,
    offerCount: probe.offerCount,
    readContractVersion: probe.readContractVersion,
    controlRpcResultClass: probe.controlRpcResultClass,
    controlRowCardinality: probe.controlRowCardinality,
    controlOfferCount: probe.controlOfferCount,
    controlReadContractVersion: probe.controlReadContractVersion,
    transportDifferential: probe.transportDifferential,
    secretValueExposed: false,
    result: securityBoundaryPass && rpcPass ? "PASS" : "DIAGNOSTIC_COMPLETE",
  }, securityBoundaryPass ? 200 : 503);
}
