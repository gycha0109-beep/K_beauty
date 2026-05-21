import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  serializeSupabaseError,
  upsertProfileForUser
} from "@/lib/auth/profile-upsert";

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

function logAuthCallbackError(label, error, context = {}) {
  console.error(`[auth/callback] ${label}`, {
    ...context,
    error: serializeSupabaseError(error)
  });
}

function getAuthCookieDiagnostics(request) {
  const cookieNames = request.cookies
    .getAll()
    .map((cookie) => cookie.name)
    .filter((name) => name.includes("auth-token"));

  return {
    hasCodeVerifierCookie: cookieNames.some((name) => name.endsWith("-code-verifier")),
    authCookieNames: cookieNames,
    authCookieCount: cookieNames.length
  };
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
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    logAuthCallbackError("exchange_code_for_session_failed", exchangeError, {
      codeLength: code.length,
      callbackOrigin: requestUrl.origin,
      redirectPath,
      ...getAuthCookieDiagnostics(request)
    });
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "exchange_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    logAuthCallbackError("get_user_failed_after_exchange", userError, {
      hasUser: Boolean(user)
    });
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "user_lookup_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const profileUpsertResult = await upsertProfileForUser({
    supabase,
    user,
    preferAdmin: true
  });
  const profilePayload = profileUpsertResult.profilePayload;

  if (!profilePayload?.id || profilePayload.id !== user.id) {
    console.error("[auth/callback] profile_payload_user_id_mismatch", {
      userId: user.id,
      profileId: profilePayload?.id || null,
      idMatchesUser: profilePayload?.id === user.id,
      attempts: profileUpsertResult.attempts
    });

    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "user_lookup_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const profileError = profileUpsertResult.error;

  if (profileError) {
    logAuthCallbackError("profile_upsert_failed", profileError, {
      userId: user.id,
      profileId: profilePayload.id,
      idMatchesUser: profilePayload.id === user.id,
      provider: profilePayload.provider,
      method: profileUpsertResult.method,
      payload: profileUpsertResult.payload,
      attempts: profileUpsertResult.attempts
    });

    const warningUrl = new URL("/my", requestUrl.origin);
    warningUrl.searchParams.set("auth_warning", "profile_upsert_failed");
    return NextResponse.redirect(warningUrl);
  }

  return NextResponse.redirect(redirectUrl);
}
