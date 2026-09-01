import { useEffect, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useRouter } from "expo-router";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { NativeAccountDeletionCard } from "../components/NativeAccountDeletionCard";
import { ScreenShell } from "../components/ScreenShell";
import { getNativeSession, subscribeNativeAuth } from "../lib/auth";
import { useMobileShell } from "../lib/mobile-shell";

const COPY = {
  ko: {
    eyebrow: "MY · PRIVACY",
    title: "개인정보 · 계정",
    description: "개인정보 처리 기준과 계정 삭제를 관리합니다.",
    loading: "계정 확인 중…",
    signedOut: "현재 로그인된 계정이 없습니다.",
    back: "My로 돌아가기",
    deletedTitle: "계정 삭제 완료",
    deletedBody: "계정과 연결된 삭제 대상 데이터가 삭제되었습니다."
  },
  en: {
    eyebrow: "MY · PRIVACY",
    title: "Privacy · Account",
    description: "Manage the privacy policy and account deletion.",
    loading: "Checking your account…",
    signedOut: "There is no signed-in account.",
    back: "Back to My",
    deletedTitle: "Account deleted",
    deletedBody: "The account and data covered by the deletion flow have been deleted."
  }
} as const;

export default function PrivacyAccountScreen() {
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    getNativeSession()
      .then((nextSession) => {
        if (active) setSession(nextSession);
      })
      .catch(() => {
        if (active) setSession(null);
      });

    const subscription = subscribeNativeAuth((nextSession) => {
      if (active) setSession(nextSession);
    });

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  function handleDeleted() {
    setSession(null);
    Alert.alert(copy.deletedTitle, copy.deletedBody, [
      { text: "OK", onPress: () => router.replace("/my") }
    ]);
  }

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      {session === undefined ? (
        <Text style={[styles.body, { color: palette.textMuted }]}>{copy.loading}</Text>
      ) : null}

      {session ? (
        <NativeAccountDeletionCard session={session} onDeleted={handleDeleted} />
      ) : null}

      {session === null ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.body, { color: palette.textMuted }]}>{copy.signedOut}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/my")}
            style={[styles.button, { borderColor: palette.border }]}
          >
            <Text style={[styles.buttonText, { color: palette.text }]}>{copy.back}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  body: { fontSize: 14, lineHeight: 21 },
  button: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18
  },
  buttonText: { fontSize: 14, fontWeight: "700" }
});
