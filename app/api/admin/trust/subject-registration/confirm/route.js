import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { isAllowedAdminMutationRequest } from "@/lib/admin/request-policy";
import {
  confirmTrustSubjectRegistration,
  TrustSubjectRegistrationError
} from "@/lib/admin/trust-subject-registration";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4096;

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
    throw new TrustSubjectRegistrationError(
      "trust_subject_registration_invalid_request",
      413
    );
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw new TrustSubjectRegistrationError(
      "trust_subject_registration_invalid_request",
      413
    );
  }

  try {
    const body = JSON.parse(raw || "{}");
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("invalid");
    }
    return body;
  } catch {
    throw new TrustSubjectRegistrationError(
      "trust_subject_registration_invalid_request",
      400
    );
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
    const result = await confirmTrustSubjectRegistration({
      actorUserId: access.userId,
      taskId: body.taskId,
      preflightHash: body.preflightHash,
      requestId: body.requestId
    });
    return json({ ok: true, result });
  } catch (error) {
    if (error instanceof TrustSubjectRegistrationError) {
      return json({ ok: false, error: error.code }, error.status);
    }
    return json({ ok: false, error: "trust_subject_registration_failed" }, 500);
  }
}
