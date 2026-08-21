import { NextResponse } from "next/server";
import {
  buildG2Input,
  buildPdaMapperInput,
  isCanonicalRecommendationUuid,
} from "@/lib/recommendation-admission-authority-contract.mjs";
import {
  runRecommendationAdmissionRuntimeSecurityProbe,
} from "@/lib/recommendation-admission-authority-reader";
import {
  getG3ABearerTokenFromRequest,
  verifyG3AGitHubActionsOidcToken,
} from "@/lib/recommendation-admission-authority-controlled-probe-oidc";
import {
  VERSION as PDA_MAPPER_VERSION,
  materialize,
} from "@/scripts/product-evidence/exfoliation-non-numeric-pda-offline-shadow-v1.mjs";
import {
  evaluateInitialAdmissionGrant,
} from "@/scripts/product-evidence/initial-admission-grant-policy-v1.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEPLOYMENT_REFS = new Set([
  "main",
  "admission/g3a-cont-pf-authority-read",
]);

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
    return noStoreJson({ error: "g3a_deployment_identity_rejected" }, 409);
  }

  const authorization = await verifyG3AGitHubActionsOidcToken(
    getG3ABearerTokenFromRequest(request),
    { expectedDeploymentSha: deploymentSha, expectedGitRef: deploymentRef },
  );
  if (!authorization.ok) {
    return noStoreJson({ error: "g3a_probe_auth_rejected", code: authorization.code }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return noStoreJson({ error: "g3a_probe_body_invalid" }, 400);
  }
  const productId = typeof body?.productId === "string" ? body.productId.trim() : "";
  if (!isCanonicalRecommendationUuid(productId)) {
    return noStoreJson({ error: "g3a_probe_product_id_invalid" }, 400);
  }

  const probe = await runRecommendationAdmissionRuntimeSecurityProbe(productId);
  const authorityResolved = probe.authority?.status === "AUTHORITY_RESOLVED";
  if (!probe.credentialAvailable || !probe.runtimeRoleMatch || !probe.rawPfSelectDenied || !authorityResolved) {
    return noStoreJson({
      evidenceType: "v21_admission_g3a_runtime_probe_v1",
      deploymentSha,
      deploymentRef,
      credentialAvailable: probe.credentialAvailable,
      runtimeRoleMatch: probe.runtimeRoleMatch,
      rawPfSelectDenied: probe.rawPfSelectDenied,
      authorityStatus: probe.authority?.status || "NO_AUTHORITY",
      authorityReason: probe.authority?.reason || null,
      secretValueExposed: false,
      result: "FAIL_CLOSED",
    }, 503);
  }

  const mapperInput = buildPdaMapperInput(probe.authority);
  const mapperResult = materialize(mapperInput.product, mapperInput.facts, mapperInput.subject);
  const g2Input = buildG2Input(probe.authority, mapperResult, PDA_MAPPER_VERSION);
  const g2Compatibility = evaluateInitialAdmissionGrant(g2Input, { legacyIds: new Set() });

  return noStoreJson({
    evidenceType: "v21_admission_g3a_runtime_probe_v1",
    workflowRunId: authorization.claims.runId,
    deploymentSha,
    deploymentRef,
    credentialAvailable: true,
    runtimeRoleMatch: true,
    rawPfSelectDenied: true,
    authorityStatus: probe.authority.status,
    readContractVersion: probe.authority.readContractVersion,
    pdaMapperVersion: PDA_MAPPER_VERSION,
    pdaSignalStatus: mapperResult?.pda?.signal_status || null,
    g2TransportCompatibilityDecision: g2Compatibility.decision,
    secretValueExposed: false,
    result: "PASS",
  });
}
