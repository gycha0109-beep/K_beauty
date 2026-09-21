import { NextResponse } from "next/server";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";
import {
  DATA_AI21_FIXED_QUERY,
  DATA_AI21_FIXED_QUERY_ID,
  evaluateProductQueryAuthenticatedBetaEvidenceCapture
} from "@/lib/product-query-authenticated-beta-evidence-capture.mjs";
import {
  evaluateProductQueryAuthenticatedBetaControlledActivation
} from "@/lib/product-query-authenticated-beta-controlled-activation.mjs";
import { executeProductQueryPreview } from "@/lib/server/product-query-preview-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECEIPT_CONTRACT =
  "product-query-authenticated-beta-evidence-receipt-v1";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: createNoStoreHeaders({
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    })
  });
}

function notFound() {
  return new Response(null, {
    status: 404,
    headers: createNoStoreHeaders()
  });
}

function hasForbiddenRuntimeField(value) {
  if (!value || typeof value !== "object") return false;
  const forbidden = new Set(["score", "matchedSignals", "provider", "model", "intent"]);

  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key) || hasForbiddenRuntimeField(child)) return true;
  }

  return false;
}

export async function GET(request) {
  const activation =
    evaluateProductQueryAuthenticatedBetaControlledActivation(process.env);

  if (!activation.allowed || activation.approvedAccountCount !== 3) {
    return notFound();
  }

  const authContext = await resolveRouteSupabaseAuth(request);

  if (
    !authContext ||
    authContext.transport !== "cookie" ||
    authContext.user?.is_anonymous !== false
  ) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const evidencePolicy = evaluateProductQueryAuthenticatedBetaEvidenceCapture({
    envLike: process.env,
    subject: authContext.user.id
  });

  if (!evidencePolicy.allowed) {
    return notFound();
  }

  try {
    const result = await executeProductQueryPreview(DATA_AI21_FIXED_QUERY);

    if (
      result?.contractVersion !== "product-query-preview-v1" ||
      result?.persisted !== false ||
      !Array.isArray(result?.results) ||
      result.results.length > 5 ||
      hasForbiddenRuntimeField(result)
    ) {
      return json({ ok: false, error: "evidence_contract_failed" }, 502);
    }

    const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();

    if (!/^[a-f0-9]{40}$/.test(deploymentSha)) {
      return json({ ok: false, error: "deployment_identity_unavailable" }, 503);
    }

    return json({
      ok: true,
      receipt: {
        contractVersion: RECEIPT_CONTRACT,
        phase: "DATA-AI21",
        cohortSlot: evidencePolicy.cohortSlot,
        fixedQueryId: DATA_AI21_FIXED_QUERY_ID,
        deploymentSha,
        nestedContractVersion: result.contractVersion,
        resultCount: result.results.length,
        resultCountWithinBound: result.results.length <= 5,
        persisted: false,
        rawAccountIdReturned: false,
        accountHashReturned: false,
        accessTokenReturned: false,
        rawQueryReturned: false,
        productResultsReturned: false,
        capturedAtUtc: new Date().toISOString()
      }
    });
  } catch {
    return json({ ok: false, error: "evidence_execution_failed" }, 503);
  }
}
