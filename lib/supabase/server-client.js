import "server-only";
import { createClient } from "@supabase/supabase-js";
import { writeSafeLog } from "@/lib/security/error-redaction";

function getSupabaseServerConfig() {
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

export function createRouteSupabaseAuthClient(accessToken = null) {
  const config = getSupabaseServerConfig();

  if (!config) {
    return null;
  }

  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  };

  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    };
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, options);
}

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim() || null;
}

export async function getRouteSupabaseUser(request) {
  const accessToken = getBearerToken(request);

  if (!accessToken) {
    return null;
  }

  const supabase = createRouteSupabaseAuthClient(accessToken);

  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error) {
    writeSafeLog("warn", {
      event: "supabase_auth_failed",
      category: "session_unavailable",
      operation: "supabase_auth",
      dependency: "supabase",
      retryable: true
    });
    return null;
  }

  return user || null;
}
