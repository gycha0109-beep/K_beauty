import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Session } from "@supabase/supabase-js";
import { ScreenShell } from "../components/ScreenShell";
import {
  fetchNativeDashboard,
  getNativeSession,
  signInNativeWithGoogle,
  signOutNative,
  subscribeNativeAuth,
  type NativeDashboardSummary
} from "../lib/auth";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";
import { getMobileSupabaseClient } from "../lib/supabase";

type AuthStatus = "loading" | "unconfigured" | "signed-out" | "signing-in" | "signed-in" | "error";

export default function MyScreen() {
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].my;
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<NativeDashboardSummary | null>(null);
  const [dashboardUnavailable, setDashboardUnavailable] = useState(false);

  useEffect(() => {
    if (!getMobileSupabaseClient()) {
      setStatus("unconfigured");
      return;
    }

    let active = true;

    async function applySession(nextSession: Session | null) {
      if (!active) {
        return;
      }

      setSession(nextSession);
      setDashboard(null);
      setDashboardUnavailable(false);

      if (!nextSession) {
        setStatus("signed-out");
        return;
      }

      setStatus("signed-in");

      try {
        const nextDashboard = await fetchNativeDashboard(nextSession);
        if (active) {
          setDashboard(nextDashboard);
        }
      } catch {
        if (active) {
          setDashboardUnavailable(true);
        }
      }
    }

    getNativeSession()
      .then(applySession)
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    const subscription = subscribeNativeAuth((nextSession) => {
      void applySession(nextSession);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  async function handleSignIn() {
    setStatus("signing-in");

    try {
      await signInNativeWithGoogle();
    } catch {
      setStatus("error");
    }
  }

  async function handleSignOut() {
    try {
      await signOutNative();
      setSession(null);
      setDashboard(null);
      setDashboardUnavailable(false);
      setStatus("signed-out");
    } catch {
      setStatus("error");
    }
  }

  let statusText = copy.signedOut;

  if (status === "loading") {
    statusText = copy.loading;
  } else if (status === "unconfigured") {
    statusText = copy.authUnavailable;
  } else if (status === "signing-in") {
    statusText = copy.signingIn;
  } else if (status === "error") {
    statusText = copy.authFailed;
  } else if (session) {
    statusText = session.user.email ? `${copy.signedIn} · ${session.user.email}` : copy.signedIn;
  }

  let dashboardText = "";

  if (session && dashboardUnavailable) {
    dashboardText = copy.dashboardUnavailable;
  } else if (session && dashboard) {
    if (!dashboard.hasProfile) {
      dashboardText = copy.dashboardNoProfile;
    } else if (dashboard.needsCheckIn) {
      dashboardText = copy.dashboardCheckIn;
    } else {
      dashboardText = copy.dashboardReady;
    }
  }

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.status, { color: palette.text }]}>{statusText}</Text>
        {dashboardText ? (
          <Text style={[styles.dashboard, { color: palette.textMuted }]}>{dashboardText}</Text>
        ) : null}

        {!session && status !== "loading" && status !== "unconfigured" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="mobile-google-sign-in"
            disabled={status === "signing-in"}
            onPress={handleSignIn}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: palette.accent, opacity: pressed || status === "signing-in" ? 0.72 : 1 }
            ]}
          >
            <Text style={[styles.buttonText, { color: palette.background }]}>
              {status === "signing-in" ? copy.signingIn : copy.signInGoogle}
            </Text>
          </Pressable>
        ) : null}

        {session ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="mobile-sign-out"
            onPress={handleSignOut}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>{copy.signOut}</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.notice, { color: palette.textMuted }]}>{copy.notice}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18
  },
  status: {
    fontSize: 16,
    fontWeight: "700"
  },
  dashboard: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20
  },
  button: {
    minHeight: 46,
    marginTop: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 18
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "700"
  },
  secondaryButton: {
    minHeight: 44,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600"
  },
  notice: {
    fontSize: 14,
    lineHeight: 21
  }
});
