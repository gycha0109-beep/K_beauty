import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { getMobileApiBaseUrl } from "../lib/env";
import { useMobileShell } from "../lib/mobile-shell";

export function NativePrivacyLinks() {
  const { locale, palette } = useMobileShell();
  const [failed, setFailed] = useState(false);
  const label = locale === "ko" ? "개인정보 처리방침" : "Privacy policy";
  async function openPolicy() {
    setFailed(false);
    try {
      const base = getMobileApiBaseUrl();
      await Linking.openURL(`${base}${locale === "ko" ? "/privacy" : "/en/privacy"}`);
    } catch { setFailed(true); }
  }
  return <View testID="native-public-privacy" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
    <Text style={[styles.body, { color: palette.textMuted }]}>{locale === "ko"
      ? "로그인하지 않아도 정보 처리·보관·삭제와 외부 서비스 처리 기준을 확인할 수 있습니다."
      : "You can review data processing, retention, deletion, and external service practices without signing in."}</Text>
    <Pressable testID="mobile-privacy-policy" accessibilityRole="link" accessibilityLabel={label}
      onPress={() => void openPolicy()} style={[styles.button, { borderColor: palette.border }]}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </Pressable>
    {failed ? <Text accessibilityLiveRegion="polite" style={[styles.body, { color: palette.textMuted }]}>{locale === "ko"
      ? "개인정보 페이지를 열지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요."
      : "The privacy page could not open. Check your connection and try again."}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 12 },
  body: { fontSize: 14, lineHeight: 21 },
  button: { minHeight: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 16, borderWidth: 1, borderRadius: 24 },
  label: { fontSize: 14, fontWeight: "700" }
});
