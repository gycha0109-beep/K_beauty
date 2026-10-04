import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useIsFocused, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenShell } from "../components/ScreenShell";
import { NativeCurrentProductsSelector } from "../features/premium/NativeCurrentProductsSelector";
import {
  createNativePremiumReport,
  loadNativePremiumAccess,
  NativePremiumRequestError,
  type NativeCurrentProductSelection,
  type NativePremiumAccess
} from "../features/premium/premium-client";
import { observeNativeSession } from "../lib/auth";
import { createNativeRequestScope } from "../lib/request-scope";
import { useMobileShell } from "../lib/mobile-shell";

const COPY = {
  en: {
    eyebrow: "PREMIUM",
    title: "Premium report",
    description: "Create a private report from your latest analysis.",
    loading: "Checking your Premium entry…",
    signedOut: "Sign in on My to create a premium report.",
    authRequired: "Your account session could not be authorized for Premium creation.",
    unavailable: "Premium report creation is currently unavailable. Saved Premium reports remain available in My.",
    paymentRequired: "Premium creation is not available with your current access. You can still reopen saved reports.",
    accessError: "Premium access could not be checked.",
    retry: "Try again",
    goMy: "Go to My",
    backAnalyze: "Back to Analyze",
    openSaved: "Open saved report",
    privateHeading: "Private account report",
    privateBody: "Your report includes your selected products and is saved privately to your account.",
    noProductsAction: "Continue without products",
    createAction: "Create private Premium report",
    creating: "Creating private report…",
    sessionExpired: "Your analysis is missing or expired. Check your saved report first. To create a new report, start a new analysis.",
    paymentCreateBlocked: "Premium creation is not available with your current access.",
    unavailableCreateBlocked: "Premium creation is unavailable on the server right now.",
    finalized: "This Premium session was already finalized. Open the saved report instead.",
    createError: "The creation result could not be confirmed. Check your saved report before trying again."
  },
  ko: {
    eyebrow: "PREMIUM",
    title: "프리미엄 리포트",
    description: "최근 분석으로 계정 전용 비공개 리포트를 만듭니다.",
    loading: "Premium 진입 권한을 확인하는 중…",
    signedOut: "Premium 리포트를 만들려면 My에서 로그인해 주세요.",
    authRequired: "현재 계정 세션으로 Premium 생성 권한을 확인하지 못했습니다.",
    unavailable: "현재 Premium 리포트 신규 생성은 이용할 수 없습니다. 이미 저장된 Premium 리포트는 My에서 계속 볼 수 있습니다.",
    paymentRequired: "현재 이용 권한으로는 프리미엄 리포트를 만들 수 없습니다. 저장 리포트는 다시 열 수 있습니다.",
    accessError: "Premium 진입 권한을 확인하지 못했습니다.",
    retry: "다시 시도",
    goMy: "My로 이동",
    backAnalyze: "분석으로 돌아가기",
    openSaved: "저장 리포트 열기",
    privateHeading: "계정 전용 비공개 리포트",
    privateBody: "선택한 사용 제품 정보를 반영한 리포트가 계정에 비공개로 저장됩니다.",
    noProductsAction: "제품 선택 없이 계속하기",
    createAction: "비공개 Premium 리포트 생성",
    creating: "비공개 리포트 생성 중…",
    sessionExpired: "분석 정보가 없거나 만료되었습니다. 저장 리포트를 먼저 확인해 주세요. 새 리포트가 필요하면 새 분석을 시작해 주세요.",
    paymentCreateBlocked: "현재 이용 권한으로는 프리미엄 리포트를 만들 수 없습니다.",
    unavailableCreateBlocked: "현재 서버에서 Premium 신규 생성을 사용할 수 없습니다.",
    finalized: "이 Premium 세션은 이미 확정되었습니다. 저장 리포트를 열어 주세요.",
    createError: "생성 결과를 확인하지 못했습니다. 저장 리포트를 확인한 뒤 다시 시도해 주세요."
  }
} as const;

type AccessState =
  | Readonly<{ status: "loading"; session: null }>
  | Readonly<{ status: "signed-out"; session: null }>
  | Readonly<{ status: "checking"; session: Session }>
  | Readonly<{ status: "ready"; session: Session; access: NativePremiumAccess }>
  | Readonly<{ status: "auth-required"; session: Session; access: NativePremiumAccess }>
  | Readonly<{ status: "unavailable"; session: Session; access: NativePremiumAccess }>
  | Readonly<{ status: "payment-required"; session: Session; access: NativePremiumAccess }>
  | Readonly<{ status: "error"; session: Session | null }>;

function mapAccessState(session: Session, access: NativePremiumAccess): AccessState {
  if (access.canCreatePremium) return { status: "ready", session, access };
  if (access.reason === "premium_unavailable") return { status: "unavailable", session, access };
  if (access.reason === "payment_required") return { status: "payment-required", session, access };
  return { status: "auth-required", session, access };
}

export default function PremiumScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const [state, setState] = useState<AccessState>({ status: "loading", session: null });
  const [currentProducts, setCurrentProducts] = useState<NativeCurrentProductSelection[]>([]);
  const [creating, setCreating] = useState(false);
  const [createErrorCode, setCreateErrorCode] = useState("");
  const requests = useRef(createNativeRequestScope()).current;
  const sessionRef = useRef<Session | null>(null);
  const creationLock = useRef(false);

  const checkAccess = useCallback(async (session: Session) => {
    if (!requests.owns(session.user.id)) return;
    const ticket = requests.begin("access");
    setState({ status: "checking", session });
    try {
      const access = await loadNativePremiumAccess(session);
      if (requests.isCurrent(ticket)) setState(mapAccessState(sessionRef.current ?? session, access));
    } catch {
      if (requests.isCurrent(ticket)) setState({ status: "error", session: sessionRef.current });
    }
  }, [requests]);

  useEffect(() => {
    let initial = true;
    const stop = observeNativeSession((session) => {
      const changed = requests.setOwner(session?.user.id ?? null);
      sessionRef.current = session;
      if (changed || !session) {
        setCurrentProducts([]); setCreateErrorCode(""); setCreating(false); creationLock.current = false;
        setState(session ? { status: "checking", session } : { status: "signed-out", session: null });
      } else {
        setState((previous) => previous.session && session ? { ...previous, session } : previous);
      }
      if (session && (changed || initial)) void checkAccess(session);
      initial = false;
    });
    return () => {
      sessionRef.current = null;
      stop(); requests.setOwner(null); requests.invalidate();
    };
  }, [checkAccess, requests]);

  useEffect(() => {
    if (isFocused && sessionRef.current) void checkAccess(sessionRef.current);
  }, [isFocused, checkAccess]);

  const changeProducts = useCallback((next: NativeCurrentProductSelection[]) => {
    if (!creationLock.current && state.session && state.session.user.id === sessionRef.current?.user.id &&
      requests.owns(state.session.user.id)) setCurrentProducts(next);
  }, [requests, state.session?.user.id]);

  const finalize = useCallback(async () => {
    const activeSession = sessionRef.current;
    if (state.status !== "ready" || creating || creationLock.current || !activeSession ||
      state.session.user.id !== activeSession.user.id || !requests.owns(activeSession.user.id)) return;

    const ticket = requests.begin("create");
    creationLock.current = true;
    setCreating(true);
    setCreateErrorCode("");
    try {
      await createNativePremiumReport({
        session: activeSession,
        locale,
        currentProducts
      });
      if (requests.isCurrent(ticket)) router.replace("/saved-report");
    } catch (error) {
      if (!requests.isCurrent(ticket)) return;
      setCreateErrorCode(
        error instanceof NativePremiumRequestError
          ? error.code
          : "mobile_premium_finalize_failed"
      );
    } finally {
      if (requests.isCurrent(ticket)) { setCreating(false); creationLock.current = false; }
    }
  }, [creating, currentProducts, locale, requests, router, state]);

  const createErrorMessage =
    createErrorCode === "premium_session_missing_or_expired"
      ? copy.sessionExpired
      : createErrorCode === "premium_payment_required"
        ? copy.paymentCreateBlocked
        : createErrorCode === "premium_unavailable"
          ? copy.unavailableCreateBlocked
          : createErrorCode === "premium_snapshot_finalized"
            ? copy.finalized
            : createErrorCode
              ? copy.createError
              : "";

  const passiveMessage =
    state.status === "loading" || state.status === "checking"
      ? copy.loading
      : state.status === "signed-out"
        ? copy.signedOut
        : state.status === "auth-required"
          ? copy.authRequired
          : state.status === "unavailable"
            ? copy.unavailable
            : state.status === "payment-required"
              ? copy.paymentRequired
              : state.status === "error"
                ? copy.accessError
                : "";

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {state.status !== "ready" ? (
        <View
          testID="native-premium-state"
          style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
        >
          <Text style={[styles.message, { color: palette.textMuted }]}>{passiveMessage}</Text>

          {state.status === "error" && state.session ? (
            <Pressable
              testID="native-premium-retry"
              accessibilityRole="button"
              onPress={() => void checkAccess(state.session!)}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: palette.action, opacity: pressed ? 0.72 : 1 }
              ]}
            >
              <Text style={[styles.primaryText, { color: palette.actionText }]}>{copy.retry}</Text>
            </Pressable>
          ) : null}

          {state.status === "signed-out" || state.status === "auth-required" ? (
            <Pressable
              testID="native-premium-go-my"
              accessibilityRole="button"
              onPress={() => router.push("/my")}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: palette.action, opacity: pressed ? 0.72 : 1 }
              ]}
            >
              <Text style={[styles.primaryText, { color: palette.actionText }]}>{copy.goMy}</Text>
            </Pressable>
          ) : null}

          {state.status === "payment-required" || state.status === "unavailable" ? (
            <Pressable
              testID="native-premium-open-saved"
              accessibilityRole="button"
              onPress={() => router.push("/saved-report")}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }
              ]}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>{copy.openSaved}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <>
          <View
            testID="native-premium-ready"
            style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.heading, { color: palette.text }]}>{copy.privateHeading}</Text>
            <Text style={[styles.message, { color: palette.textMuted }]}>{copy.privateBody}</Text>
          </View>

          <NativeCurrentProductsSelector
            value={currentProducts}
            onChange={changeProducts}
            disabled={creating}
          />

          <Pressable
            testID="native-premium-create"
            accessibilityRole="button"
            accessibilityState={{ disabled: creating }}
            disabled={creating}
            onPress={() => void finalize()}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: palette.action,
                opacity: creating ? 0.55 : pressed ? 0.72 : 1
              }
            ]}
          >
            <Text style={[styles.primaryText, { color: palette.actionText }]}>
              {creating
                ? copy.creating
                : currentProducts.length
                  ? copy.createAction
                  : copy.noProductsAction}
            </Text>
          </Pressable>

          {createErrorMessage ? (
            <View
              testID="native-premium-create-error"
              style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
            >
              <Text style={[styles.message, { color: palette.textMuted }]}>{createErrorMessage}</Text>
              {createErrorCode === "premium_snapshot_finalized" ? (
                <Pressable
                  testID="native-premium-finalized-open-saved"
                  accessibilityRole="button"
                  onPress={() => router.replace("/saved-report")}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }
                  ]}
                >
                  <Text style={[styles.secondaryText, { color: palette.text }]}>{copy.openSaved}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </>
      )}

      <Pressable
        testID="native-premium-back-analyze"
        accessibilityRole="button"
        onPress={() => router.replace("/analyze")}
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }
        ]}
      >
        <Text style={[styles.secondaryText, { color: palette.text }]}>{copy.backAnalyze}</Text>
      </Pressable>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 14
  },
  heading: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800"
  },
  message: {
    fontSize: 14,
    lineHeight: 21
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryText: {
    fontSize: 14,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "700"
  }
});
