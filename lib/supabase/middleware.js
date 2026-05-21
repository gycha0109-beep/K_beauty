import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

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
    pathname === "/my" ||
    pathname === "/my/check-in" ||
    pathname.startsWith("/my/check-in/")
  );
}

export async function updateSession(request) {
  if (request.nextUrl.pathname === "/auth/callback") {
    return NextResponse.next({
      request
    });
  }

  let response = NextResponse.next({
    request
  });
  const isProtectedPath = isPhaseOneProtectedPath(request.nextUrl.pathname);
  const config = getSupabaseMiddlewareConfig();

  if (!config) {
    if (isProtectedPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
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

        response = NextResponse.next({
          request
        });

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
    redirectUrl.pathname = "/";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
