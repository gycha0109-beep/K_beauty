import { NextResponse } from "next/server";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";
import {
  evaluateProductQueryAuthenticatedBetaRuntime,
  evaluateProductQueryAuthenticatedBetaStaticGate
} from "@/lib/product-query-authenticated-beta-runtime.mjs";
import {
  DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED,
  evaluateProductQueryAuthenticatedBetaControlledActivation
} from "@/lib/product-query-authenticated-beta-controlled-activation.mjs";
import {
  DATA_AI22_LIVE_BATCH_COUNT,
  runDataAi22LiveAcceptanceBatch
} from "@/lib/server/product-query-beta-quality-live-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CONTRACT_VERSION = "data-ai22-live-provider-acceptance-route-v1";

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

function parseBatch(request) {
  const url = new URL(request.url);
  const keys = [...url.searchParams.keys()];
  if (
    keys.length !== 1 ||
    keys[0] !== "batch" ||
    url.searchParams.getAll("batch").length !== 1
  ) {
    return null;
  }

  const value = url.searchParams.get("batch");
  if (!/^[1-6]$/.test(value || "")) return null;
  const batch = Number(value);
  return batch >= 1 && batch <= DATA_AI22_LIVE_BATCH_COUNT ? batch : null;
}

export async function GET(request) {
  const activationGate =
    evaluateProductQueryAuthenticatedBetaControlledActivation(process.env);
  if (!activationGate.allowed) return notFound();

  const staticGate = evaluateProductQueryAuthenticatedBetaStaticGate(
    process.env,
    { phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED }
  );
  if (!staticGate.staticAllowed) return notFound();

  const authContext = await resolveRouteSupabaseAuth(request);
  if (
    !authContext ||
    authContext.transport !== "cookie" ||
    authContext.user?.is_anonymous !== false
  ) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const runtimePolicy = evaluateProductQueryAuthenticatedBetaRuntime({
    envLike: process.env,
    subject: authContext.user.id,
    phaseRuntimeAuthorized: DATA_AI20_BETA_RUNTIME_PHASE_AUTHORIZED
  });
  if (!runtimePolicy.allowed) return notFound();

  const batch = parseBatch(request);
  if (batch === null) {
    return json({ ok: false, error: "invalid_batch" }, 400);
  }

  try {
    const acceptance = await runDataAi22LiveAcceptanceBatch(batch);
    const deploymentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();

    if (!/^[0-9a-f]{40}$/.test(deploymentSha)) {
      return json({ ok: false, error: "deployment_identity_unavailable" }, 503);
    }

    return json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      phase: "DATA-AI22",
      deploymentSha,
      batch,
      batchCount: DATA_AI22_LIVE_BATCH_COUNT,
      acceptance,
      privacy: {
        fixedSyntheticCorpusOnly: true,
        userQueryAccepted: false,
        rawAccountIdReturned: false,
        accountHashReturned: false,
        accessTokenReturned: false,
        productResultsReturned: false,
        persisted: false
      },
      capturedAtUtc: new Date().toISOString()
    });
  } catch {
    return json({ ok: false, error: "quality_evaluation_failed" }, 500);
  }
}
