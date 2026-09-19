import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import {
  confirmTrustManualReentry,
  TrustReentryError
} from "@/lib/admin/trust-reentry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}

export async function POST(request) {
  if (!isAllowedAdminMutationRequest(request)) {
    return json({ ok: false, error: "invalid_request_origin" }, 403);
  }

  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser) {
    return json({ ok: false, error: "admin_login_required" }, 401);
  }
  if (!access.allowed || !access.userId) {
    return json({ ok: false, error: "admin_product_review_forbidden" }, 403);
  }

  try {
    const body = await request.json();
    const requestId =
      typeof body?.requestId === "string" && body.requestId.trim()
        ? body.requestId.trim()
        : `trust-reentry-${crypto.randomUUID()}`;

    const result = await confirmTrustManualReentry({
      actorUserId: access.userId,
      taskId: body?.taskId,
      preflightHash: body?.preflightHash,
      requestId
    });
    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof TrustReentryError) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: "trust_reentry_failed" }, 500);
  }
}
