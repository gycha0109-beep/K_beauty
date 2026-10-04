import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useIsFocused, useRouter } from "expo-router";
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
import { observeNativeSession } from "../lib/auth";
import { createNativeRequestScope } from "../lib/request-scope";
import { useMobileShell } from "../lib/mobile-shell";

const SAVED_REPORT_COPY = {
  en: {
    eyebrow: "MY REPORT",
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
    sharePublishError: "The publication result could not be confirmed. The link may already be public. Check your connection before trying again.",
    published: "This link is public. Closing or cancelling the share sheet does not make it private.",
    shareSheetError: "The public link was created, but the system share sheet could not open. You can try again."
  },
  ko: {
    eyebrow: "MY REPORT",
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
    sharePublishError: "공개 처리 결과를 확인하지 못했습니다. 링크가 이미 공개됐을 수 있습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    published: "이 링크는 공개 상태입니다. 공유 창을 닫거나 취소해도 비공개로 돌아가지 않습니다.",
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
  | { status: "published"; value: NativePublicShare }
  | { status: "share-sheet-error"; value: NativePublicShare };

export default function SavedReportScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale, palette } = useMobileShell();
  const copy = SAVED_REPORT_COPY[locale];
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<ScreenState>({ status: "loading" });
  const [publicShareState, setPublicShareState] = useState<PublicShareState>({ status: "idle" });
  const requests = useRef(createNativeRequestScope()).current;
  const sessionRef = useRef<Session | null>(null);
  const reportOwner = useRef<string | null>(null);
  const publishing = useRef(false);

  const load = useCallback(async (activeSession: Session) => {
    if (!requests.owns(activeSession.user.id)) return;
    const ticket = requests.begin("report");
    requests.begin("publish"); publishing.current = false;
    setState({ status: "loading" });
    reportOwner.current = null;
    setPublicShareState({ status: "idle" });
    try {
      const result = await loadLatestNativeSavedReport(activeSession, locale);
      if (!requests.isCurrent(ticket)) return;
      reportOwner.current = activeSession.user.id;
      setState(result.status === "loaded"
        ? { status: "loaded", value: result.value }
        : { status: "empty" });
    } catch {
      if (requests.isCurrent(ticket)) setState({ status: "error" });
    }
  }, [locale, requests]);

  const publishAndShare = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (!activeSession || !session || session.user.id !== activeSession.user.id ||
      reportOwner.current !== activeSession.user.id || publishing.current ||
      state.status !== "loaded" || state.value.kind !== "free") return;

    const ticket = requests.begin("publish");
    publishing.current = true;
    setPublicShareState({ status: "publishing" });
    let published: NativePublicShare;
    try {
      published = await publishNativeFreeSavedReport(activeSession, state.value.shareId);
    } catch {
      if (requests.isCurrent(ticket)) {
        publishing.current = false; setPublicShareState({ status: "publish-error" });
      }
      return;
    }
    if (!requests.isCurrent(ticket)) return;

    try {
      await Share.share({
        title: copy.shareTitle,
        message: `${copy.shareMessage}\n${published.shareUrl}`,
        url: published.shareUrl
      });
      if (requests.isCurrent(ticket)) setPublicShareState({ status: "published", value: published });
    } catch {
      if (requests.isCurrent(ticket)) setPublicShareState({ status: "share-sheet-error", value: published });
    } finally {
      if (requests.isCurrent(ticket)) publishing.current = false;
    }
  }, [copy.shareMessage, copy.shareTitle, requests, session, state]);

  useEffect(() => {
    let initial = true;
    const stop = observeNativeSession((nextSession) => {
      const changed = requests.setOwner(nextSession?.user.id ?? null);
      sessionRef.current = nextSession; setSession(nextSession);
      if (changed || !nextSession) {
        reportOwner.current = null; publishing.current = false;
        setPublicShareState({ status: "idle" });
        setState({ status: nextSession ? "loading" : "signed-out" });
      }
      if (nextSession && (changed || initial)) void load(nextSession);
      initial = false;
    });
    return () => {
      sessionRef.current = null; reportOwner.current = null;
      stop(); requests.setOwner(null); requests.invalidate();
    };
  }, [load, requests]);

  useEffect(() => {
    if (isFocused && sessionRef.current) void load(sessionRef.current);
  }, [isFocused, load]);

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
                backgroundColor: palette.action,
                opacity: publicShareState.status === "publishing" ? 0.55 : pressed ? 0.72 : 1
              }
            ]}
          >
            <Text style={[styles.shareButtonText, { color: palette.actionText }]}>
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
          {publicShareState.status === "published" || publicShareState.status === "share-sheet-error" ? (
            <Text testID="native-free-public-share-published" style={[styles.message, { color: palette.textMuted }]}>{copy.published}</Text>
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
  button: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  shareButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: 18 },
  shareButtonText: { fontSize: 14, fontWeight: "800" },
  errorText: { fontSize: 13, lineHeight: 19 },
  backButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  buttonText: { fontSize: 14, fontWeight: "700" }
});
