import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { completeNativeAuthFromUrl } from "../../lib/auth";
import { useMobileShell } from "../../lib/mobile-shell";

export default function NativeAuthCallbackScreen() {
  const authUrl = Linking.useLinkingURL();
  const { locale, palette } = useMobileShell();
  const [status, setStatus] = useState<"pending" | "complete" | "failed">("pending");
  const message = status === "complete"
    ? locale === "ko" ? "로그인했습니다." : "Sign-in complete"
    : status === "failed"
      ? locale === "ko" ? "로그인을 완료하지 못했습니다. 마이에서 다시 시도해 주세요." : "Sign-in could not be completed. Return to My and try again."
      : locale === "ko" ? "로그인 확인 중…" : "Completing sign-in…";

  useEffect(() => {
    if (!authUrl) {
      const timer = setTimeout(() => setStatus("failed"), 20_000);
      return () => clearTimeout(timer);
    }

    let active = true;
    setStatus("pending");
    const timer = setTimeout(() => { active = false; setStatus("failed"); }, 20_000);

    completeNativeAuthFromUrl(authUrl)
      .then(() => {
        if (active) {
          setStatus("complete");
          router.replace("/my");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("failed");
        }
      }).finally(() => clearTimeout(timer));

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [authUrl]);

  return (
    <View style={[styles.root, { backgroundColor: palette.background }]}>
      <Text style={[styles.title, { color: palette.text }]}>BEJEWELY</Text>
      <Text style={[styles.message, { color: palette.textMuted }]}>{message}</Text>
      {status === "failed" ? <Pressable accessibilityRole="button" onPress={() => router.replace("/my")} style={styles.back}>
        <Text style={{ color: palette.accentText }}>{locale === "ko" ? "마이로 돌아가기" : "Back to My"}</Text>
      </Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  title: {
    fontSize: 24,
    fontWeight: "700"
  },
  message: {
    marginTop: 12,
    maxWidth: 320,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22
  },
  back: { minHeight: 48, justifyContent: "center", paddingHorizontal: 18, marginTop: 16 }
});
