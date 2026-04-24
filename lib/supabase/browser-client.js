import { createClient } from "@supabase/supabase-js";

let browserSupabaseClient = null;
let browserAnonymousSessionPromise = null;

function getSupabaseBrowserConfig() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

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

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  const config = getSupabaseBrowserConfig();

  if (!config) {
    return null;
  }

  browserSupabaseClient = createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );

  return browserSupabaseClient;
}

export async function ensureBrowserSupabaseSession() {
  const supabase = getBrowserSupabaseClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("[supabase/browser-client] failed to read session", sessionError.message);
    return null;
  }

  if (session?.user) {
    return session;
  }

  if (!browserAnonymousSessionPromise) {
    browserAnonymousSessionPromise = supabase.auth.signInAnonymously()
      .finally(() => {
        browserAnonymousSessionPromise = null;
      });
  }

  const { error: signInError } = await browserAnonymousSessionPromise;

  if (signInError) {
    console.error("[supabase/browser-client] anonymous sign-in failed", signInError.message);
    return null;
  }

  const {
    data: { session: nextSession },
    error: nextSessionError
  } = await supabase.auth.getSession();

  if (nextSessionError) {
    console.error("[supabase/browser-client] failed to read session after sign-in", nextSessionError.message);
    return null;
  }

  return nextSession || null;
}

export async function getBrowserSupabaseAccessToken() {
  const session = await ensureBrowserSupabaseSession();
  return session?.access_token || null;
}
