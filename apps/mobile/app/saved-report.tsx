import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useRouter } from "expo-router";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { NativeSavedReport } from "../features/reports/NativeSavedReport";
import {
  publishNativeFreeSavedReport,
  type NativePublicShare
} from "../features/reports/public-share-client";
import {
  loadLatestNativeSavedReport,
  type NativeSavedReportLoadResult
} from "../features/reports/saved-report-client";
import { getNativeSession } from "../lib/auth";
import { useMobileShell } from "../lib/mobile-shell";

const SAVED_REPORT_COPY = {
  en: {
    eyebrow: "MY · MOBILE-8/9",
    title: "Saved report",
    description: "Reopen the latest server-saved report. Free reports can be published to a public web link when you explicitly share them.",
    loading: "Loading your latest saved report…",
    empty: "No saved report is available yet.",
    signedOut: "Sign in on My to reopen a saved report.",
    error: "The saved report could not be reopened.",
    retry: "Try again",
    back: "Back to My",
    shareHeading: "Public link",
    shareDisclosure: "Sharing publishes this free report at a public web link. Anyone with the link can view it.",
    shareAction: "Publish & share",
    sharing: "Publishing…",
    shareTitle: "BEJEWELY free skin report",
    shareMessage: "View my BEJEWELY free skin report:",
    sharePublishError: "The public link could not be created. Nothing new was shared.",
    shareSheetError: "The public link was created, but the system share sheet could not open. You can try again."
  },
  ko: {
    eyebrow: "MY · MOBILE-8/9",
    title: "저장 리포트",
    description: "서버에 저장된 최신 리포트를 다시 엽니다. 무료 리포트는 명시적으로 공유할 때만 공개 웹 링크로 전환됩니다.",
    loading: "최신 저장 리포트를 불러오는 중…",
    empty: "아직 다시 열 수 있는 저장 리포트가 없습니다.",
    signedOut: "My에서 로그인하면 저장 리포트를 다시 열 수 있습니다.",
    error: "저장 리포트를 다시 열지 못했습니다.",
    retry: "다시 시도",
    back: "My로 돌아가기",
    shareHeading: "공개 링크",
    shareDisclosure: "공유하면 이 무료 리포트가 공개 웹 링크로 전환되며 링크를 아는 사람은 누구나 볼 수 있습니다.",
    shareAction: "공개 링크로 공유",
    sharing: "공개 링크 생성 중…",
    shareTitle: "BEJEWELY 무료 피부 리포트",
    shareMessage: "제 BEJEWELY 무료 피부 리포트를 확인해 보세요:",
    sharePublishError: "공개 링크를 만들지 못했습니다. 새로 공개된 내용은 없습니다.",
    shareSheetError: "공개 링크는 생성됐지만 시스템 공유 창을 열지 못했습니다. 다시 시도할 수 있습니다."
  }
} as const;

type ScreenState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "empty" }
  | { status: "loaded"; value: Extract<NativeSavedReportLoadResult, { status: "loaded" }>["value"] }
  | { status: "error" };

type PublicShareState =
  | { status: "idle" }
  | { status: "publishing" }
  | { status: "publish-error" }
  | { status: "share-sheet-error" };

export default function SavedReportScreen() {
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = SAVED_REPORT_COPY[locale];
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [publicShareState, setPublicShareState] = useState<PublicShareState>({ status: "idle" });

  const load = useCallback(async (activeSession: Session) => {
    setState({ status: "loading" });
    setPublicShareState({ status: "idle" });
    try {
      const result = await loadLatestNativeSavedReport(activeSession, locale);
      setState(result.status === "loaded"
        ? { status: "loaded", value: result.value }
        : { status: "empty" });
    } catch {
      setState({ status: "error" });
    }
  }, [locale]);

  const publishAndShare = useCallback(async () => {
    if (!session || state.status !== "loaded" || state.value.kind !== "free") return;

    setPublicShareState({ status: "publishing" });
    let published: NativePublicShare;
    try {
      published = await publishNativeFreeSavedReport(session, state.value.shareId);
    } catch {
      setPublicShareState({ status: "publish-error" });
      return;
    }

    try {
      await Share.share({
        title: copy.shareTitle,
        message: `${copy.shareMessage}\n${published.shareUrl}`,
        url: published.shareUrl
      });
      setPublicShareState({ status: "idle" });
    } catch {
      setPublicShareState({ status: "share-sheet-error" });
    }
  }, [copy.shareMessage, copy.shareTitle, session, state]);

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

  const freeSavedReport = state.status === "loaded" && state.value.kind === "free"
    ? state.value
    : null;

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

      {freeSavedReport && session ? (
        <View
          testID="native-free-public-share"
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.shareHeading, { color: palette.text }]}>{copy.shareHeading}</Text>
          <Text style={[styles.message, { color: palette.textMuted }]}>{copy.shareDisclosure}</Text>
          <Pressable
            testID="native-free-public-share-button"
            accessibilityRole="button"
            accessibilityLabel={copy.shareAction}
            disabled={publicShareState.status === "publishing"}
            onPress={() => void publishAndShare()}
            style={({ pressed }) => [
              styles.shareButton,
              {
                backgroundColor: palette.accent,
                opacity: publicShareState.status === "publishing" ? 0.55 : pressed ? 0.72 : 1
              }
            ]}
          >
            <Text style={[styles.shareButtonText, { color: palette.background }]}>
              {publicShareState.status === "publishing" ? copy.sharing : copy.shareAction}
            </Text>
          </Pressable>
          {publicShareState.status === "publish-error" || publicShareState.status === "share-sheet-error" ? (
            <Text testID="native-free-public-share-error" style={[styles.errorText, { color: palette.textMuted }]}>
              {publicShareState.status === "share-sheet-error"
                ? copy.shareSheetError
                : copy.sharePublishError}
            </Text>
          ) : null}
        </View>
      ) : null}

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
  shareHeading: { fontSize: 16, fontWeight: "800" },
  button: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  shareButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: 18 },
  shareButtonText: { fontSize: 14, fontWeight: "800" },
  errorText: { fontSize: 13, lineHeight: 19 },
  backButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  buttonText: { fontSize: 14, fontWeight: "700" }
});
