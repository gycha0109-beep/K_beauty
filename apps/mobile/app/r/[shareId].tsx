import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { NativePublicResult } from "../../features/reports/NativePublicResult";
import {
  loadNativePublicResult,
  parseNativePublicResultShareId,
  type NativePublicResultLoadResult
} from "../../features/reports/public-result-client";
import { useMobileShell } from "../../lib/mobile-shell";

const COPY = {
  en: {
    kicker: "PUBLIC RESULT · MOBILE-10",
    title: "Shared result",
    description: "This read-only view opens a server-published free result from a BEJEWELY link.",
    loading: "Loading shared result…",
    invalid: "Invalid shared result link.",
    notFound: "This shared result is unavailable.",
    rateLimited: "Too many requests. Please try again later.",
    unavailable: "Shared result is temporarily unavailable.",
    retry: "Retry",
    back: "Back to Home"
  },
  ko: {
    kicker: "공개 결과 · MOBILE-10",
    title: "공유 결과",
    description: "서버에 공개된 무료 결과를 BEJEWELY 링크로 여는 읽기 전용 화면입니다.",
    loading: "공유 결과를 불러오는 중…",
    invalid: "올바르지 않은 공유 결과 링크입니다.",
    notFound: "이 공유 결과를 불러올 수 없습니다.",
    rateLimited: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
    unavailable: "공유 결과를 일시적으로 불러올 수 없습니다.",
    retry: "다시 시도",
    back: "홈으로 돌아가기"
  }
} as const;

type ScreenState = NativePublicResultLoadResult | Readonly<{ status: "loading" }>;

export default function NativePublicResultScreen() {
  const params = useLocalSearchParams<{ shareId?: string | string[] }>();
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const rawShareId = typeof params.shareId === "string" ? params.shareId : null;
  const shareId = parseNativePublicResultShareId(rawShareId);
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!shareId) {
      setState({ status: "invalid" });
      return;
    }

    let active = true;
    setState({ status: "loading" });
    loadNativePublicResult(shareId).then((next) => {
      if (active) setState(next);
    });

    return () => {
      active = false;
    };
  }, [attempt, shareId]);

  const message = state.status === "loading"
    ? copy.loading
    : state.status === "invalid"
      ? copy.invalid
      : state.status === "not_found"
        ? copy.notFound
        : state.status === "rate_limited"
          ? copy.rateLimited
          : state.status === "unavailable"
            ? copy.unavailable
            : null;

  return (
    <ScrollView
      testID="native-public-result-state"
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>{copy.kicker}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
        <Text style={[styles.description, { color: palette.textMuted }]}>{copy.description}</Text>
      </View>

      {state.status === "loaded" ? <NativePublicResult result={state.result} /> : null}

      {message ? (
        <View style={[styles.stateCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.message, { color: palette.textMuted }]}>{message}</Text>
          {state.status === "rate_limited" || state.status === "unavailable" ? (
            <Pressable
              testID="native-public-result-retry"
              accessibilityRole="button"
              onPress={() => setAttempt((value) => value + 1)}
              style={({ pressed }) => [styles.button, { backgroundColor: palette.accent, opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[styles.buttonText, { color: palette.background }]}>{copy.retry}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Pressable
        testID="native-public-result-back"
        accessibilityRole="button"
        accessibilityLabel={copy.back}
        onPress={() => router.replace("/")}
        style={({ pressed }) => [styles.backButton, { borderColor: palette.border, opacity: pressed ? 0.65 : 1 }]}
      >
        <Text style={[styles.backText, { color: palette.text }]}>{copy.back}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 42, gap: 18 },
  header: { gap: 8 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: "800" },
  description: { fontSize: 14, lineHeight: 21 },
  stateCard: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  message: { fontSize: 15, lineHeight: 22 },
  button: { minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  buttonText: { fontSize: 14, fontWeight: "800" },
  backButton: { minHeight: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  backText: { fontSize: 14, fontWeight: "700" }
});
