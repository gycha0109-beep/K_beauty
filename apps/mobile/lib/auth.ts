import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as Crypto from "expo-crypto";
import type { Session } from "@supabase/auth-js";
import { getMobileApiBaseUrl } from "./env";
import { parseNativeAuthCode } from "./auth-callback";
import { fetchWithTimeout } from "./request";
import {
  clearMobileSupabaseSessionStorage,
  getMobileSupabaseClient
} from "./supabase";

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

let callbackInFlight: { code: string; promise: Promise<Session> } | null = null;
let completedCode: string | null = null;
let googleStarting = false;
let sessionMutation: Promise<unknown> = Promise.resolve();

// Serializes this app's SDK writes; it never stores or authorizes a session itself.
function mutateNativeSession<T>(work: () => Promise<T>): Promise<T> {
  const action = sessionMutation.then(work, work);
  sessionMutation = action.then(() => undefined, () => undefined);
  return action;
}

export async function completeNativeAuthFromUrl(value: string) {
  const code = parseNativeAuthCode(value, MOBILE_AUTH_REDIRECT_URL);
  const supabase = requireMobileSupabaseClient();
  if (callbackInFlight) {
    if (callbackInFlight.code === code) return callbackInFlight.promise;
    throw new Error("mobile_auth_callback_in_progress");
  }
  if (completedCode === code) {
    const session = await getNativeSession();
    if (session) return session;
    throw new Error("mobile_auth_callback_already_used");
  }
  const promise = mutateNativeSession(async () => {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      throw new Error("mobile_auth_code_exchange_failed");
    }
    completedCode = code;
    return data.session;
  });
  callbackInFlight = { code, promise };
  try { return await promise; }
  finally {
    if (callbackInFlight?.promise === promise) callbackInFlight = null;
  }
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
    throw new Error("mobile_auth_session_unavailable");
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

/** Subscribe first; a slow initial read must never overwrite a newer auth event. */
export function observeNativeSession(callback: (session: Session | null) => void) {
  let active = true;
  let revision = 0;
  let readSequence = 0;
  const subscription = subscribeNativeAuth((session) => {
    revision += 1; readSequence += 1;
    if (active) callback(session);
  });
  function refresh() {
    const startedAt = revision;
    const sequence = ++readSequence;
    void getNativeSession().then((session) => {
      if (active && startedAt === revision && sequence === readSequence) callback(session);
    }).catch(() => {
      if (active && startedAt === revision && sequence === readSequence) callback(null);
    });
  }
  const stop = () => { active = false; subscription?.unsubscribe(); };
  stop.refresh = refresh;
  refresh();
  return stop;
}

export async function signInNativeWithGoogle() {
  if (googleStarting || callbackInFlight) return;
  googleStarting = true;
  try {
    const supabase = requireMobileSupabaseClient();
    const { data, error } = await mutateNativeSession(() => supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: MOBILE_AUTH_REDIRECT_URL,
        skipBrowserRedirect: true
      }
    }));

    if (error || !data.url) {
      throw new Error("mobile_google_auth_failed");
    }

    completedCode = null;
    await Linking.openURL(data.url);
  } finally { googleStarting = false; }
}

export async function signInNativeWithApple() {
  const supabase = requireMobileSupabaseClient();
  const available = await AppleAuthentication.isAvailableAsync();

  if (!available) {
    throw new Error("mobile_apple_auth_unavailable");
  }

  const bytes = await Crypto.getRandomBytesAsync(32);
  const nonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  const credential = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });

  const identityToken = credential.identityToken;
  if (!identityToken) {
    throw new Error("mobile_apple_auth_missing_identity_token");
  }

  return mutateNativeSession(async () => {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
      nonce
    });

    if (error || !data.session) {
      throw new Error("mobile_apple_auth_failed");
    }

    const givenName = credential.fullName?.givenName?.trim() || "";
    const familyName = credential.fullName?.familyName?.trim() || "";
    const fullName = [givenName, familyName].filter(Boolean).join(" ");

    if (fullName && !data.session.user.user_metadata?.full_name) {
      await supabase.auth.updateUser({ data: { full_name: fullName } });
    }

    return data.session;
  });
}

export async function getNativeAppleDeletionAuthorizationCode() {
  const available = await AppleAuthentication.isAvailableAsync();

  if (!available) {
    throw new Error("mobile_apple_auth_unavailable");
  }

  const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  const authorizationCode = credential.authorizationCode?.trim() || "";

  if (!authorizationCode) {
    throw new Error("mobile_apple_deletion_authorization_missing");
  }

  return authorizationCode;
}

export async function signOutNative(expectedUserId?: string) {
  return mutateNativeSession(async () => {
    const supabase = requireMobileSupabaseClient();
    if (expectedUserId && (await getNativeSession())?.user.id !== expectedUserId) return;
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw new Error("mobile_signout_failed");
    }
  });
}

export async function clearNativeSessionAfterAccountDeletion(expectedUserId?: string) {
  return mutateNativeSession(async () => {
    const supabase = getMobileSupabaseClient();
    if (!supabase) {
      await clearMobileSupabaseSessionStorage();
      return true;
    }
    const session = await getNativeSession();
    if (expectedUserId && session?.user.id !== expectedUserId) return false;
    // App SDK writes are serialized above; SIGNED_OUT reaches existing observers.
    // Do not perform a second raw storage deletion: it could erase a subsequent sign-in.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new Error("mobile_account_session_clear_failed");
    return true;
  });
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchNativeDashboard(session: Session): Promise<NativeDashboardSummary> {
  const response = await fetchWithTimeout(
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
