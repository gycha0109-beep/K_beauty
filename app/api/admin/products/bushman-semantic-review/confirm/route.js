import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import {
  BushmanSemanticReviewError,
  confirmBushmanSemanticReview,
} from "@/lib/admin/bushman-sunscreen-semantic-review";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function response(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
    },
  });
}

export async function POST(request) {
  if (!isAllowedAdminMutationRequest(request)) {
    return response({ ok: false, error: "invalid_request_origin" }, 403);
  }
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser) {
    return response({ ok: false, error: "admin_login_required" }, 401);
  }
  if (!access.allowed || !access.userId) {
    return response({ ok: false, error: "admin_product_review_forbidden" }, 403);
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 2048) {
    return response({ ok: false, error: "semantic_review_request_too_large" }, 413);
  }
  let body;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 2048) {
      return response({ ok: false, error: "semantic_review_request_too_large" }, 413);
    }
    body = JSON.parse(raw);
  } catch {
    return response({ ok: false, error: "semantic_review_request_invalid" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).sort().join("|") !== "fieldName|requestId") {
    return response({ ok: false, error: "semantic_review_request_invalid" }, 400);
  }
  try {
    const result = await confirmBushmanSemanticReview({
      actorUserId: access.userId,
      fieldName: body.fieldName,
      requestId: body.requestId,
    });
    return response({ ok: true, result });
  } catch (error) {
    if (error instanceof BushmanSemanticReviewError) {
      return response({ ok: false, error: error.code }, error.status);
    }
    return response({ ok: false, error: "semantic_review_operation_failed" }, 500);
  }
}
