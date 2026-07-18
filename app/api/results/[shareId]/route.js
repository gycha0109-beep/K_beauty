import { NextResponse } from "next/server";
import {
  getAnalysisResultOwnerUserId,
  readAnalysisResultForShare,
  unpublishAnalysisResultForOwner
} from "@/lib/analysis-result-access";
import {
  createPublicResultReadDescriptor,
  executeOwnerUnpublishCore,
  executePublicResultReadAccessCore,
  parsePublicResultShareIdFromUrl,
  PUBLIC_RESULT_READ_HEADERS
} from "@/lib/security/public-result-read-guard-core";
import { guardPublicResultRead } from "@/lib/security/public-result-read-guard";

async function resolveShareId(params) {
  const resolved = typeof params?.then === "function" ? await params : params;
  return resolved?.shareId;
}

function applyCookies(response, cookiesToSet = []) {
  cookiesToSet.forEach((cookie) => response.cookies.set(cookie.name, cookie.value, cookie.options));
  return response;
}

function descriptorResponse(descriptor, { head = false, cookiesToSet = [] } = {}) {
  const response = head
    ? new NextResponse(null, { status: descriptor.status, headers: descriptor.headers })
    : NextResponse.json(descriptor.body, { status: descriptor.status, headers: descriptor.headers });
  return applyCookies(response, cookiesToSet);
}

async function handleRead(request, context, { head = false } = {}) {
  const requestedShareId = await resolveShareId(context?.params);
  const guard = await guardPublicResultRead({ request, shareId: requestedShareId });

  if (!guard.ok) {
    return descriptorResponse(
      createPublicResultReadDescriptor(guard.code, null, guard.retryAfterSeconds),
      { head, cookiesToSet: guard.cookiesToSet }
    );
  }

  const descriptor = await executePublicResultReadAccessCore({
    guardResult: guard,
    read: ({ shareId, viewerUserId }) => readAnalysisResultForShare({
      shareId,
      supabase: guard.supabase,
      viewerUserId
    })
  });
  return descriptorResponse(descriptor, { head, cookiesToSet: guard.cookiesToSet });
}

export async function GET(request, context) {
  return handleRead(request, context);
}

export async function HEAD(request, context) {
  return handleRead(request, context, { head: true });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...PUBLIC_RESULT_READ_HEADERS, Allow: "GET, HEAD, OPTIONS, PATCH" } });
}

export async function PATCH(request, { params }) {
  const userId = await getAnalysisResultOwnerUserId(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Result not found." }, { status: 404, headers: PUBLIC_RESULT_READ_HEADERS });
  }

  const shareId = await resolveShareId(params);
  const parsed = parsePublicResultShareIdFromUrl(shareId, request.url);
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400, headers: PUBLIC_RESULT_READ_HEADERS });
  }
  const keys = body && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : [];
  if (keys.length !== 1 || keys[0] !== "isPublic" || body.isPublic !== false) {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400, headers: PUBLIC_RESULT_READ_HEADERS });
  }

  if (parsed.kind === "invalid") {
    return NextResponse.json({ success: false, error: "Result not found." }, { status: 404, headers: PUBLIC_RESULT_READ_HEADERS });
  }

  const outcome = await executeOwnerUnpublishCore({
    parsedShareId: parsed,
    userId,
    update: unpublishAnalysisResultForOwner
  });
  if (!outcome.ok) {
    return NextResponse.json({ success: false, error: "Failed to update result." }, { status: 500, headers: PUBLIC_RESULT_READ_HEADERS });
  }
  if (outcome.state !== "unpublished") {
    return NextResponse.json({ success: false, error: "Result not found." }, { status: 404, headers: PUBLIC_RESULT_READ_HEADERS });
  }
  return NextResponse.json({ success: true, unpublished: true }, { headers: PUBLIC_RESULT_READ_HEADERS });
}
