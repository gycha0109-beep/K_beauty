import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { upsertProfileForUser } from "@/lib/auth/profile-upsert";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";

export const dynamic = "force-dynamic";

function getSafeRedirectPath(value, origin) {
  if (!value) {
    return "/my";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const url = new URL(value);

    if (url.origin === origin) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return "/my";
  }

  return "/my";
}

function logAuthCallbackError(event, category) {
  writeSafeLog("error", {
    event,
    category,
    operation: "auth_callback",
    dependency: category === "internal_error" ? "application" : "supabase",
    retryable: category !== "internal_error"
  });
}

function createAuthRedirect(url) {
  return NextResponse.redirect(url, { headers: createNoStoreHeaders() });
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const redirectPath = getSafeRedirectPath(next, requestUrl.origin);
  const redirectUrl = new URL(redirectPath, requestUrl.origin);

  if (!code) {
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "missing_code");
    return createAuthRedirect(redirectUrl);
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logAuthCallbackError("auth_callback_failed", "session_unavailable");
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "exchange_failed");
    return createAuthRedirect(redirectUrl);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logAuthCallbackError("auth_callback_failed", "session_unavailable");
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "user_lookup_failed");
    return createAuthRedirect(redirectUrl);
  }

  const profileUpsertResult = await upsertProfileForUser({
    supabase,
    user,
    preferAdmin: true
  });
  const profilePayload = profileUpsertResult.profilePayload;

  if (!profilePayload?.id || profilePayload.id !== user.id) {
    logAuthCallbackError("auth_callback_profile_sync_failed", "internal_error");

    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "user_lookup_failed");
    return createAuthRedirect(redirectUrl);
  }

  const profileError = profileUpsertResult.error;

  if (profileError) {
    logAuthCallbackError("auth_callback_profile_sync_failed", "database_unavailable");

    const warningUrl = new URL("/my", requestUrl.origin);
    warningUrl.searchParams.set("auth_warning", "profile_upsert_failed");
    return createAuthRedirect(warningUrl);
  }

  return createAuthRedirect(redirectUrl);
}
