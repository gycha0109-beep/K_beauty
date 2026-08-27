import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

export function getBearerToken(request) {
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

async function getVerifiedUser(supabase, { logFailure = false } = {}) {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    if (logFailure) {
      writeSafeLog("warn", {
        event: "supabase_auth_failed",
        category: "session_unavailable",
        operation: "supabase_auth",
        dependency: "supabase",
        retryable: true
      });
    }
    return null;
  }

  return user;
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

  return getVerifiedUser(supabase, { logFailure: true });
}

export async function resolveRouteSupabaseAuth(request) {
  const accessToken = getBearerToken(request);

  if (accessToken) {
    const supabase = createRouteSupabaseAuthClient(accessToken);

    if (!supabase) {
      return null;
    }

    const user = await getVerifiedUser(supabase, { logFailure: true });

    return user
      ? { supabase, user, transport: "bearer" }
      : null;
  }

  const supabase = await createServerSupabaseClient();
  const user = await getVerifiedUser(supabase);

  return user
    ? { supabase, user, transport: "cookie" }
    : null;
}
