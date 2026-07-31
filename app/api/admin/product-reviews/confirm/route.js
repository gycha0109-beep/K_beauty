import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import {
  confirmProductReview,
  ProductReviewOperationError
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
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw new ProductReviewOperationError("product_review_invalid_request", 413);
  }

  const reader = request.body?.getReader();
  const chunks = [];
  let receivedBytes = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new ProductReviewOperationError(
          "product_review_invalid_request",
          413
        );
      }
      chunks.push(Buffer.from(value));
    }
  }

  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    const body = JSON.parse(raw || "{}");

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ProductReviewOperationError("product_review_invalid_request", 400);
    }

    return body;
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
    const result = await confirmProductReview({
      actorUserId: access.userId,
      candidateId: body.candidateId,
      decision: body.decision,
      reason: body.reason,
      candidateUpdatedAt: body.candidateUpdatedAt,
      reviewUpdatedAt: body.reviewUpdatedAt,
      evidenceHash: body.evidenceHash,
      preflightHash: body.preflightHash,
      requestId: body.requestId
    });

    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof ProductReviewOperationError) {
      return json({ ok: false, error: error.code }, error.status);
    }

    return json({ ok: false, error: "product_review_operation_failed" }, 500);
  }
}
