import { useIsFocused, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { getNativeSession } from "../lib/auth";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";
import { fetchNativeMyDashboard } from "../lib/my";
import { MOBILE_READ_TIMEOUT_MS } from "../lib/request";

let initialEntryResolvedForRuntime = false;
const storeCaptureInitialHomeBypass =
  __DEV__ === true && process.env.EXPO_PUBLIC_STORE_CAPTURE_MODE === "1";

async function shouldOpenHomeOnInitialEntry(signal: AbortSignal) {
  try {
    const session = await getNativeSession();

    if (!session) {
      return false;
    }

    const dashboard = await fetchNativeMyDashboard(session, { signal });
    if ((await getNativeSession())?.user.id !== session.user.id) return null;
    return Boolean(dashboard.latestSavedReport?.id);
  } catch {
    // Failure is unknown, not evidence that this user has no saved report.
    return null;
  }
}

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale];
  const [entryResolved, setEntryResolved] = useState(
    initialEntryResolvedForRuntime || storeCaptureInitialHomeBypass
  );
  const homeReady = entryResolved || (isFocused && initialEntryResolvedForRuntime);
  const [entryError, setEntryError] = useState(false);
  const [entryAttempt, setEntryAttempt] = useState(0);

  useEffect(() => {
    if (storeCaptureInitialHomeBypass) {
      initialEntryResolvedForRuntime = true;
      return;
    }

    if (initialEntryResolvedForRuntime) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    setEntryError(false);
    const timer = setTimeout(() => {
      active = false; controller.abort(); setEntryError(true);
    }, MOBILE_READ_TIMEOUT_MS);

    void shouldOpenHomeOnInitialEntry(controller.signal).then((shouldOpenHome) => {
      if (!active) {
        return;
      }
      clearTimeout(timer);
      if (shouldOpenHome === null) { setEntryError(true); return; }

      initialEntryResolvedForRuntime = true;

      if (!shouldOpenHome) {
        router.replace("/analyze");
        return;
      }

      setEntryResolved(true);
    });

    return () => {
      active = false;
      clearTimeout(timer); controller.abort();
    };
  }, [router, entryAttempt]);

  if (!homeReady) {
    return (
      <View
        testID="mobile-initial-entry-gate"
        style={[styles.entryGate, { backgroundColor: palette.background }]}
      >
        {entryError ? <View style={styles.entryError}>
          <Text style={{ color: palette.text, textAlign: "center" }}>{locale === "ko"
            ? "저장 리포트가 있는지 확인하지 못했습니다. 연결 상태를 확인하고 다시 시도하거나 분석 화면으로 이동할 수 있습니다."
            : "We could not check for a saved report. Check your connection and retry, or continue to analysis."}</Text>
          <Pressable accessibilityRole="button" onPress={() => setEntryAttempt((current) => current + 1)} style={styles.entryAction}>
            <Text style={{ color: palette.accentText }}>{locale === "ko" ? "다시 확인" : "Try again"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => {
            initialEntryResolvedForRuntime = true; router.replace("/analyze");
          }} style={styles.entryAction}><Text style={{ color: palette.text }}>{locale === "ko" ? "분석 화면으로 이동" : "Continue to analysis"}</Text></Pressable>
        </View> : <ActivityIndicator color={palette.accent} />}
      </View>
    );
  }

  return (
    <ScreenShell eyebrow={copy.home.eyebrow} title={copy.home.title} description={copy.home.description}>
      <View style={[styles.heroCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.home.cardTitle}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>{copy.home.cardBody}</Text>
        <Pressable
          testID="mobile-home-start-analysis"
          accessibilityRole="button"
          accessibilityLabel={copy.home.cta}
          onPress={() => router.push("/analyze")}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: palette.action,
              opacity: pressed ? 0.72 : 1
            }
          ]}
        >
          <Text style={styles.primaryButtonText}>{copy.home.cta}</Text>
        </Pressable>
      </View>

      <View style={styles.benefitList}>
        {copy.home.benefits.map((benefit) => (
          <View
            key={benefit.title}
            style={[styles.benefitCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.benefitTitle, { color: palette.text }]}>{benefit.title}</Text>
            <Text style={[styles.benefitBody, { color: palette.textMuted }]}>{benefit.body}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  entryError: { maxWidth: 420, padding: 24, gap: 12 },
  entryAction: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  entryGate: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  heroCard: {
    width: "100%",
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderRadius: 24
  },
  cardTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800"
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 23
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    paddingHorizontal: 18,
    marginTop: 2
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  benefitList: {
    gap: 12
  },
  benefitCard: {
    gap: 6,
    padding: 18,
    borderWidth: 1,
    borderRadius: 20
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  benefitBody: {
    fontSize: 14,
    lineHeight: 21
  }
});
