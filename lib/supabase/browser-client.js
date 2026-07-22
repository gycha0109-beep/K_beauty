import { createBrowserSupabaseClient } from "./browser.js";

let browserSupabaseClient = null;
let browserAnonymousSessionPromise = null;

export function getBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return null;
  }

  if (browserSupabaseClient) {
    return browserSupabaseClient;
  }

  browserSupabaseClient = createBrowserSupabaseClient();

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

  const { data: signInData, error: signInError } = await browserAnonymousSessionPromise;

  if (signInError) {
    console.error("[supabase/browser-client] anonymous sign-in failed", signInError.message);
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
    console.error("[supabase/browser-client] failed to read session after sign-in", nextSessionError.message);
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
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return null;
    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error("[supabase/browser-client] failed to read cookie session", error.message);
      return null;
    }

    return session || null;
  } catch (error) {
    console.error(
      "[supabase/browser-client] cookie session client unavailable",
      error instanceof Error ? error.message : "unknown_error"
    );
    return null;
  }
}
