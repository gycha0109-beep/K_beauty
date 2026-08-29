import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { NativeSavedReport } from "../features/reports/NativeSavedReport";
import {
  loadLatestNativeSavedReport,
  type NativeSavedReportLoadResult
} from "../features/reports/saved-report-client";
import { getNativeSession } from "../lib/auth";
import { useMobileShell } from "../lib/mobile-shell";

const SAVED_REPORT_COPY = {
  en: {
    eyebrow: "MY · MOBILE-8",
    title: "Saved report",
    description: "Reopen the latest server-saved free or premium report without running analysis again.",
    loading: "Loading your latest saved report…",
    empty: "No saved report is available yet.",
    signedOut: "Sign in on My to reopen a saved report.",
    error: "The saved report could not be reopened.",
    retry: "Try again",
    back: "Back to My"
  },
  ko: {
    eyebrow: "MY · MOBILE-8",
    title: "저장 리포트",
    description: "분석을 다시 실행하지 않고 서버에 저장된 최신 무료·프리미엄 리포트를 다시 엽니다.",
    loading: "최신 저장 리포트를 불러오는 중…",
    empty: "아직 다시 열 수 있는 저장 리포트가 없습니다.",
    signedOut: "My에서 로그인하면 저장 리포트를 다시 열 수 있습니다.",
    error: "저장 리포트를 다시 열지 못했습니다.",
    retry: "다시 시도",
    back: "My로 돌아가기"
  }
} as const;

type ScreenState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "empty" }
  | { status: "loaded"; value: Extract<NativeSavedReportLoadResult, { status: "loaded" }>["value"] }
  | { status: "error" };

export default function SavedReportScreen() {
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = SAVED_REPORT_COPY[locale];
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ScreenState>({ status: "loading" });

  const load = useCallback(async (activeSession: Session) => {
    setState({ status: "loading" });
    try {
      const result = await loadLatestNativeSavedReport(activeSession, locale);
      setState(result.status === "loaded"
        ? { status: "loaded", value: result.value }
        : { status: "empty" });
    } catch {
      setState({ status: "error" });
    }
  }, [locale]);

  useEffect(() => {
    let active = true;
    getNativeSession()
      .then((nextSession) => {
        if (!active) return;
        setSession(nextSession);
        if (!nextSession) {
          setState({ status: "signed-out" });
          return;
        }
        void load(nextSession);
      })
      .catch(() => active && setState({ status: "error" }));

    return () => {
      active = false;
    };
  }, [load]);

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {state.status === "loaded" ? <NativeSavedReport value={state.value} /> : (
        <View testID="native-saved-report-state" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.message, { color: palette.textMuted }]}>
            {state.status === "loading"
              ? copy.loading
              : state.status === "signed-out"
                ? copy.signedOut
                : state.status === "empty"
                  ? copy.empty
                  : copy.error}
          </Text>
          {state.status === "error" && session ? (
            <Pressable
              testID="native-saved-report-retry"
              accessibilityRole="button"
              onPress={() => void load(session)}
              style={({ pressed }) => [styles.button, { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: palette.text }]}>{copy.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      <Pressable
        testID="native-saved-report-back"
        accessibilityRole="button"
        onPress={() => router.replace("/my")}
        style={({ pressed }) => [styles.backButton, { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}
      >
        <Text style={[styles.buttonText, { color: palette.text }]}>{copy.back}</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  message: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  backButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  buttonText: { fontSize: 14, fontWeight: "700" }
});
