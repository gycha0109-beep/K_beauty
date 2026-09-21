import { NextResponse } from "next/server";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";
import {
  evaluateProductQueryProductionCanaryRuntime,
  evaluateProductQueryProductionCanaryStaticGate
} from "@/lib/product-query-production-canary-runtime.mjs";
import { executeProductQueryPreview } from "@/lib/server/product-query-preview-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTRACT_VERSION = "product-query-production-canary-v1";
const MAX_BODY_BYTES = 2048;

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

function classifyError(error) {
  const code = typeof error?.code === "string" ? error.code : "UNKNOWN";
  if (code === "PRODUCT_QUERY_PREVIEW_INPUT_INVALID") {
    return { status: 400, error: "invalid_query" };
  }
  if ([
    "PRODUCT_QUERY_AI_UNAVAILABLE",
    "PRODUCT_QUERY_AI_TIMEOUT",
    "PRODUCT_QUERY_AI_REQUEST_FAILED"
  ].includes(code)) {
    return { status: 503, error: "product_query_temporarily_unavailable" };
  }
  if ([
    "PRODUCT_QUERY_AI_RESPONSE_INVALID",
    "PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE",
    "PRODUCT_QUERY_AI_REFUSED",
    "PRODUCT_QUERY_AI_SCHEMA_REJECTED"
  ].includes(code)) {
    return { status: 502, error: "product_query_provider_protocol_error" };
  }
  return { status: 500, error: "product_query_canary_failed" };
}

export async function POST(request) {
  const nowMs = Date.now();
  const staticGate = evaluateProductQueryProductionCanaryStaticGate(process.env, nowMs);
  if (!staticGate.staticAllowed) return notFound();

  const authContext = await resolveRouteSupabaseAuth(request);
  if (!authContext) return json({ ok: false, error: "unauthorized" }, 401);

  const runtimePolicy = evaluateProductQueryProductionCanaryRuntime({
    envLike: process.env,
    subject: authContext.user.id,
    nowMs
  });
  if (!runtimePolicy.allowed) return notFound();

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "invalid_request" }, 413);
  }

  let raw;
  try {
    raw = await request.text();
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return json({ ok: false, error: "invalid_request" }, 413);
  }

  let body;
  try {
    body = JSON.parse(raw || "{}");
  } catch {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const keys = body && typeof body === "object" && !Array.isArray(body)
    ? Object.keys(body).sort()
    : [];
  if (keys.length !== 1 || keys[0] !== "query" || typeof body.query !== "string") {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  try {
    const preview = await executeProductQueryPreview(body.query);
    return json({
      ok: true,
      contractVersion: CONTRACT_VERSION,
      canary: {
        manualOnly: true,
        automaticTrafficSampling: false,
        effectiveSampleBps: runtimePolicy.effectiveSampleBps,
        expiresAtUtc: runtimePolicy.expiresAtUtc,
        persisted: false
      },
      preview
    });
  } catch (error) {
    const classified = classifyError(error);
    return json({ ok: false, error: classified.error }, classified.status);
  }
}
