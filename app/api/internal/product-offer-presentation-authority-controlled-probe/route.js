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

const CONTROLLED_PRODUCT_IDS = Object.freeze([
  "009e0339-fa00-429e-a1c2-2a23eb4707f8",
  "02142b67-a50e-41b9-862c-b5a68203daf7",
  "03f5a72b-6c9a-4487-a3a9-39d1e6afa7bb",
  "06d1ad4b-2291-4b73-8bf4-f1f3c0226fea",
  "07257728-9e64-48aa-9dbd-f1239bd98d87",
  "0781dcb5-d377-44b5-aa14-01ab2c04f0b2",
  "08b85f37-b1fa-42d7-893a-0d4facb17878",
  "0b59cb66-ab03-4a0d-815e-7a94a5c7ae65",
]);
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
    CONTROLLED_PRODUCT_IDS,
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
    requestedProductCount: probe.requestedProductCount,
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
