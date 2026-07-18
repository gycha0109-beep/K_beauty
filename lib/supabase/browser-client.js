import { createClient } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "./browser.js";
import { writeSafeLog } from "../security/error-redaction.js";

let browserSupabaseClient = null;
let browserAnonymousSessionPromise = null;
let browserSupabaseStorageKey = null;

function getSupabaseStorageKey(supabaseUrl) {
  try {
    const hostname = new URL(supabaseUrl).hostname;
    const projectRef = hostname.split(".")[0];
    return projectRef ? `sb-${projectRef}-auth-token` : undefined;
  } catch {
    return undefined;
  }
}

function getSupabaseBrowserConfig() {
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

  browserSupabaseStorageKey = getSupabaseStorageKey(config.supabaseUrl);

  browserSupabaseClient = createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: browserSupabaseStorageKey
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
    writeSafeLog("warn", {
      event: "client_operation_failed",
      category: "session_unavailable",
      operation: "client",
      dependency: "supabase",
      retryable: true
    });
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

  const { data: signInData, error: signInError } = await browserAnonymousSessionPromise;

  if (signInError) {
    writeSafeLog("warn", {
      event: "client_operation_failed",
      category: "session_unavailable",
      operation: "client",
      dependency: "supabase",
      retryable: true
    });
    return null;
  }

  if (signInData?.session?.access_token) {
    return signInData.session;
  }

  const {
    data: { session: nextSession },
    error: nextSessionError
  } = await supabase.auth.getSession();

  if (nextSessionError) {
    writeSafeLog("warn", {
      event: "client_operation_failed",
      category: "session_unavailable",
      operation: "client",
      dependency: "supabase",
      retryable: true
    });
    return null;
  }

  return nextSession || null;
}

export async function getBrowserSupabaseAccessToken() {
  const cookieSession = await getCookieBackedBrowserSession();

  if (cookieSession?.access_token) {
    return cookieSession.access_token;
  }

  const session = await ensureBrowserSupabaseSession();
  return session?.access_token || null;
}

export function isPermanentBrowserSupabaseUser(user) {
  return Boolean(user) && user.is_anonymous === false;
}

export async function getBrowserPermanentSupabaseAccessToken() {
  const cookieSession = await getCookieBackedBrowserSession();

  if (isPermanentBrowserSupabaseUser(cookieSession?.user)) {
    return cookieSession.access_token || null;
  }

  const session = await ensureBrowserSupabaseSession();

  return isPermanentBrowserSupabaseUser(session?.user)
    ? session.access_token || null
    : null;
}

async function getCookieBackedBrowserSession() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const supabase = createBrowserSupabaseClient();
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      writeSafeLog("warn", {
        event: "client_operation_failed",
        category: "session_unavailable",
        operation: "client",
        dependency: "supabase",
        retryable: true
      });
      return null;
    }

    return session || null;
  } catch {
    writeSafeLog("warn", {
      event: "client_operation_failed",
      category: "session_unavailable",
      operation: "client",
      dependency: "supabase",
      retryable: true
    });
    return null;
  }
}
