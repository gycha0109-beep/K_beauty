import * as Linking from "expo-linking";
import type { Session } from "@supabase/auth-js";
import { getMobileApiBaseUrl } from "./env";
import { getMobileSupabaseClient } from "./supabase";

export const MOBILE_AUTH_REDIRECT_URL = "bejewely://auth/callback";

export type NativeDashboardSummary = {
  hasProfile: boolean;
  needsCheckIn: boolean;
  diaryMonth?: string | null;
};

function requireMobileSupabaseClient() {
  const supabase = getMobileSupabaseClient();

  if (!supabase) {
    throw new Error("mobile_auth_not_configured");
  }

  return supabase;
}

function getParam(url: URL, fragment: URLSearchParams, name: string) {
  return url.searchParams.get(name) || fragment.get(name);
}

export async function completeNativeAuthFromUrl(value: string) {
  const supabase = requireMobileSupabaseClient();
  const url = new URL(value);
  const fragment = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash);
  const errorCode = getParam(url, fragment, "error_code") || getParam(url, fragment, "error");

  if (errorCode) {
    throw new Error("mobile_auth_callback_failed");
  }

  const code = url.searchParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      throw new Error("mobile_auth_code_exchange_failed");
    }

    return data.session;
  }

  const accessToken = getParam(url, fragment, "access_token");
  const refreshToken = getParam(url, fragment, "refresh_token");

  if (!accessToken || !refreshToken) {
    throw new Error("mobile_auth_callback_missing_session");
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });

  if (error || !data.session) {
    throw new Error("mobile_auth_session_restore_failed");
  }

  return data.session;
}

export async function getNativeSession() {
  const supabase = getMobileSupabaseClient();

  if (!supabase) {
    return null;
  }

  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return session || null;
}

export function subscribeNativeAuth(callback: (session: Session | null) => void) {
  const supabase = getMobileSupabaseClient();

  if (!supabase) {
    return null;
  }

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return data.subscription;
}

export async function signInNativeWithGoogle() {
  const supabase = requireMobileSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: MOBILE_AUTH_REDIRECT_URL,
      skipBrowserRedirect: true
    }
  });

  if (error || !data.url) {
    throw new Error("mobile_google_auth_failed");
  }

  await Linking.openURL(data.url);
}

export async function signOutNative() {
  const supabase = requireMobileSupabaseClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("mobile_signout_failed");
  }
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchNativeDashboard(session: Session): Promise<NativeDashboardSummary> {
  const response = await fetch(
    `${getMobileApiBaseUrl()}/api/my/dashboard?localDate=${encodeURIComponent(getLocalDate())}`,
    {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        Accept: "application/json"
      }
    }
  );

  if (response.status === 401) {
    throw new Error("mobile_dashboard_unauthorized");
  }

  if (!response.ok) {
    throw new Error("mobile_dashboard_unavailable");
  }

  const payload = await response.json();

  return {
    hasProfile: payload?.hasProfile === true,
    needsCheckIn: payload?.needsCheckIn === true,
    diaryMonth: typeof payload?.diaryMonth === "string" ? payload.diaryMonth : null
  };
}
