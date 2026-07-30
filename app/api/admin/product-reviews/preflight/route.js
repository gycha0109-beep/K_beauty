import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import {
  ProductReviewOperationError,
  runProductReviewPreflight
} from "@/lib/admin/product-reviews";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8192;

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

async function readBody(request) {
  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new ProductReviewOperationError("product_review_invalid_request", 413);
  }

  try {
    return JSON.parse(raw || "{}");
  } catch {
    throw new ProductReviewOperationError("product_review_invalid_request", 400);
  }
}

export async function POST(request) {
  if (!isAllowedAdminMutationRequest(request)) {
    return json({ ok: false, error: "invalid_request_origin" }, 403);
  }

  const access = await requireAdminCapability(
    ADMIN_CAPABILITIES.PRODUCTS_REVIEW
  );

  if (!access.authenticated || !access.accountUser) {
    return json({ ok: false, error: "admin_login_required" }, 401);
  }

  if (!access.allowed || !access.userId) {
    return json({ ok: false, error: "admin_product_review_forbidden" }, 403);
  }

  try {
    const body = await readBody(request);
    const preflight = await runProductReviewPreflight({
      actorUserId: access.userId,
      candidateId: body.candidateId,
      decision: body.decision,
      reason: body.reason
    });

    return json({ ok: true, preflight });
  } catch (error) {
    if (error instanceof ProductReviewOperationError) {
      return json({ ok: false, error: error.code }, error.status);
    }

    return json({ ok: false, error: "product_review_operation_failed" }, 500);
  }
}
