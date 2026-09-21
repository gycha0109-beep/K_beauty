import { NextResponse } from "next/server";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";
import { hashProductQueryBetaSubject } from "@/lib/product-query-authenticated-beta-runtime.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request) {
  if (
    String(process.env.VERCEL_ENV || "").trim().toLowerCase() !== "production" ||
    String(process.env.BEJEWELY_PRODUCT_QUERY_BETA_RUNTIME_AUTHORIZED || "")
      .trim()
      .toLowerCase() !== "true"
  ) {
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

  const accountHash = hashProductQueryBetaSubject(authContext.user.id);

  if (!accountHash) {
    return json({ ok: false, error: "account_hash_unavailable" }, 500);
  }

  return json({
    ok: true,
    phase: "DATA-AI20",
    accountHash,
    source: "current_cookie_authenticated_user",
    temporaryEnrollmentOnly: true,
    rawAccountIdReturned: false,
    persisted: false
  });
}
