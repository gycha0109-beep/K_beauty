import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useRouter } from "expo-router";
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
import { getNativeSession } from "../lib/auth";
import { useMobileShell } from "../lib/mobile-shell";

const COPY = {
  en: {
    eyebrow: "PREMIUM",
    title: "Premium report",
    description: "Create a private Premium report from your latest analysis.",
    loading: "Checking your Premium entry…",
    signedOut: "Sign in on My to create a premium report.",
    authRequired: "Your account session could not be authorized for Premium creation.",
    unavailable: "Premium report creation is temporarily unavailable. Saved Premium reports are still available in My.",
    paymentRequired: "Premium access is required to create this report. You can still open saved reports.",
    accessError: "Premium access could not be checked.",
    retry: "Try again",
    goMy: "Go to My",
    backAnalyze: "Back to Analyze",
    openSaved: "Open saved report",
    privateHeading: "Private account report",
    privateBody: "Create a detailed report from your latest analysis and save it privately to your account. It is not published or shared.",
    noProductsAction: "Continue without products",
    createAction: "Create private Premium report",
    creating: "Creating private report…",
    sessionExpired: "The Premium session is missing or expired. Return to Analyze and run a fresh analysis before trying again.",
    paymentCreateBlocked: "Premium access is required to create this report.",
    unavailableCreateBlocked: "Premium report creation is temporarily unavailable.",
    finalized: "This Premium session was already finalized. Open the saved report instead.",
    createError: "The Premium report could not be finalized."
  },
  ko: {
    eyebrow: "PREMIUM",
    title: "프리미엄 리포트",
    description: "최근 분석을 바탕으로 계정에 비공개 프리미엄 리포트를 만듭니다.",
    loading: "Premium 진입 권한을 확인하는 중…",
    signedOut: "Premium 리포트를 만들려면 My에서 로그인해 주세요.",
    authRequired: "현재 계정 세션으로 Premium 생성 권한을 확인하지 못했습니다.",
    unavailable: "지금은 프리미엄 리포트를 새로 만들 수 없습니다. 저장된 프리미엄 리포트는 My에서 계속 볼 수 있습니다.",
    paymentRequired: "이 리포트를 만들려면 프리미엄 이용 권한이 필요합니다. 저장된 리포트는 계속 확인할 수 있습니다.",
    accessError: "Premium 진입 권한을 확인하지 못했습니다.",
    retry: "다시 시도",
    goMy: "My로 이동",
    backAnalyze: "분석으로 돌아가기",
    openSaved: "저장 리포트 열기",
    privateHeading: "계정 전용 비공개 리포트",
    privateBody: "최근 분석을 바탕으로 자세한 리포트를 만들고 계정에 비공개로 저장합니다. 공개 또는 공유되지 않습니다.",
    noProductsAction: "제품 선택 없이 계속하기",
    createAction: "비공개 Premium 리포트 생성",
    creating: "비공개 리포트 생성 중…",
    sessionExpired: "Premium 세션이 없거나 만료되었습니다. Analyze에서 새 분석을 실행한 뒤 다시 시도해 주세요.",
    paymentCreateBlocked: "이 리포트를 만들려면 프리미엄 이용 권한이 필요합니다.",
    unavailableCreateBlocked: "지금은 프리미엄 리포트를 새로 만들 수 없습니다.",
    finalized: "이 Premium 세션은 이미 확정되었습니다. 저장 리포트를 열어 주세요.",
    createError: "Premium 리포트를 확정하지 못했습니다."
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
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const [state, setState] = useState<AccessState>({ status: "loading", session: null });
  const [currentProducts, setCurrentProducts] = useState<NativeCurrentProductSelection[]>([]);
  const [creating, setCreating] = useState(false);
  const [createErrorCode, setCreateErrorCode] = useState("");

  const checkAccess = useCallback(async (session: Session) => {
    setState({ status: "checking", session });
    try {
      const access = await loadNativePremiumAccess(session);
      setState(mapAccessState(session, access));
    } catch {
      setState({ status: "error", session });
    }
  }, []);

  useEffect(() => {
    let active = true;
    getNativeSession()
      .then((session) => {
        if (!active) return;
        if (!session) {
          setState({ status: "signed-out", session: null });
          return;
        }
        void checkAccess(session);
      })
      .catch(() => {
        if (active) setState({ status: "error", session: null });
      });

    return () => {
      active = false;
    };
  }, [checkAccess]);

  const finalize = useCallback(async () => {
    if (state.status !== "ready" || creating) return;

    setCreating(true);
    setCreateErrorCode("");
    try {
      await createNativePremiumReport({
        session: state.session,
        locale,
        currentProducts
      });
      router.replace("/saved-report");
    } catch (error) {
      setCreateErrorCode(
        error instanceof NativePremiumRequestError
          ? error.code
          : "mobile_premium_finalize_failed"
      );
    } finally {
      setCreating(false);
    }
  }, [creating, currentProducts, locale, router, state]);

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
                { backgroundColor: palette.accent, opacity: pressed ? 0.72 : 1 }
              ]}
            >
              <Text style={[styles.primaryText, { color: palette.background }]}>{copy.retry}</Text>
            </Pressable>
          ) : null}

          {state.status === "signed-out" || state.status === "auth-required" ? (
            <Pressable
              testID="native-premium-go-my"
              accessibilityRole="button"
              onPress={() => router.push("/my")}
              style={({ pressed }) => [
                styles.primaryButton,
                { backgroundColor: palette.accent, opacity: pressed ? 0.72 : 1 }
              ]}
            >
              <Text style={[styles.primaryText, { color: palette.background }]}>{copy.goMy}</Text>
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
            onChange={setCurrentProducts}
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
                backgroundColor: palette.accent,
                opacity: creating ? 0.55 : pressed ? 0.72 : 1
              }
            ]}
          >
            <Text style={[styles.primaryText, { color: palette.background }]}> 
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
    minHeight: 44,
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
