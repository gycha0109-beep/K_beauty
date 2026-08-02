import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import securityHeaderPolicy from "@/lib/security/security-headers";
import { shouldBypassSupabaseSessionRefresh } from "@/lib/security/signout-request-policy";

const { mergeForwardedRequestHeaders } = securityHeaderPolicy;

function getSupabaseMiddlewareConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.startsWith("http")
      ? supabaseUrl
      : `https://${supabaseUrl}`,
    supabaseAnonKey
  };
}

function isPhaseOneProtectedPath(pathname) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/my" ||
    pathname === "/my/check-in" ||
    pathname.startsWith("/my/check-in/") ||
    pathname === "/en/my" ||
    pathname === "/en/my/check-in" ||
    pathname.startsWith("/en/my/check-in/")
  );
}

function getProtectedRedirectPath(pathname) {
  return pathname === "/en/my" || pathname.startsWith("/en/my/")
    ? "/en"
    : "/";
}

export async function updateSession(request, { requestHeaders } = {}) {
  function createPassThroughResponse() {
    if (!requestHeaders) {
      return NextResponse.next({ request });
    }

    const forwardedHeaders = mergeForwardedRequestHeaders(
      request.headers,
      requestHeaders
    );

    return NextResponse.next({
      request: {
        headers: forwardedHeaders
      }
    });
  }

  if (shouldBypassSupabaseSessionRefresh(request.nextUrl.pathname)) {
    return createPassThroughResponse();
  }

  let response = createPassThroughResponse();
  const isProtectedPath = isPhaseOneProtectedPath(request.nextUrl.pathname);
  const config = getSupabaseMiddlewareConfig();

  if (!config) {
    if (isProtectedPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = getProtectedRedirectPath(request.nextUrl.pathname);
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }

  const supabase = createServerClient(config.supabaseUrl, config.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = createPassThroughResponse();

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      }
    }
  });

  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims || null;

  if (isProtectedPath && (error || !claims)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = getProtectedRedirectPath(request.nextUrl.pathname);
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
