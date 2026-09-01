import { NextResponse } from "next/server";

import {
  getCanonicalProductionOrigin,
  getNormalizedConfiguredProductionOrigin
} from "@/lib/canonical-site-origin";
import {
  AccountDeletionError,
  deleteVerifiedAccount
} from "@/lib/auth/account-deletion";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";
import {
  evaluateSignOutRequest,
  getSignOutRuntimeOriginContract
} from "@/lib/security/signout-request-policy";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

function getRuntimeOriginContract() {
  return getSignOutRuntimeOriginContract({
    vercelEnvironment: process.env.VERCEL_ENV,
    configuredProductionOrigin: getNormalizedConfiguredProductionOrigin(),
    canonicalProductionOrigin: getCanonicalProductionOrigin()
  });
}

function isAllowedCookieDeleteRequest(request) {
  let runtimeContract;

  try {
    runtimeContract = getRuntimeOriginContract();
  } catch {
    return false;
  }

  return evaluateSignOutRequest({
    requestUrl: request?.url,
    requestHeaders: request?.headers,
    isHostedProduction: runtimeContract?.isHostedProduction === true,
    canonicalProductionOrigin: runtimeContract?.canonicalProductionOrigin || null
  }).allowed;
}

function errorResponse(error) {
  if (!(error instanceof AccountDeletionError)) {
    return sensitiveJsonResponse(
      { error: "account_deletion_unavailable" },
      { status: 503, headers: { "Retry-After": "60" } }
    );
  }

  if (error.code === "account_deletion_requires_support") {
    return sensitiveJsonResponse(
      { error: error.code },
      { status: 409 }
    );
  }

  if (error.code === "account_deletion_invalid_user") {
    return sensitiveJsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  return sensitiveJsonResponse(
    { error: "account_deletion_unavailable" },
    { status: 503, headers: { "Retry-After": "60" } }
  );
}

export async function DELETE(request) {
  const authContext = await resolveRouteSupabaseAuth(request);

  if (!authContext) {
    return sensitiveJsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  if (authContext.transport === "cookie" && !isAllowedCookieDeleteRequest(request)) {
    return sensitiveJsonResponse({ error: "invalid_request_origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);

  if (body?.confirmation !== "delete_account") {
    return sensitiveJsonResponse({ error: "account_deletion_confirmation_required" }, { status: 400 });
  }

  try {
    await deleteVerifiedAccount(authContext.user.id);
  } catch (error) {
    return errorResponse(error);
  }

  return sensitiveJsonResponse({ deleted: true });
}
