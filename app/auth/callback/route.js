import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

function getProfilePayload(user) {
  const metadata = user.user_metadata || {};
  const appMetadata = user.app_metadata || {};

  return {
    id: user.id,
    nickname:
      metadata.name ||
      metadata.full_name ||
      user.email ||
      null,
    avatar_url: metadata.avatar_url || null,
    provider: appMetadata.provider || null
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
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "exchange_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "user_lookup_failed");
    return NextResponse.redirect(redirectUrl);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(getProfilePayload(user), { onConflict: "id" });

  if (profileError) {
    redirectUrl.pathname = "/";
    redirectUrl.searchParams.set("auth_error", "profile_upsert_failed");
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.redirect(redirectUrl);
}
