import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

export default function HomeScreen() {
  const router = useRouter();
  const { locale, palette, themeMode } = useMobileShell();
  const copy = MOBILE_COPY[locale];

  return (
    <ScreenShell eyebrow={copy.home.eyebrow} title={copy.home.title} description={copy.home.description}>
      <View style={[styles.card, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.home.cardTitle}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>{copy.home.routes}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>
          {copy.home.localeLabel} · {locale.toUpperCase()}
        </Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>
          {copy.theme.label} · {copy.theme[themeMode]}
        </Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>{copy.home.nativeGate}</Text>
        <Pressable
          testID="mobile-home-start-analysis"
          accessibilityRole="button"
          onPress={() => router.push("/analyze")}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: palette.accent, opacity: pressed ? 0.72 : 1 }
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: palette.background }]}>
            {locale === "ko" ? "피부 분석 시작" : "Start skin analysis"}
          </Text>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: palette.textMuted }]}>{copy.home.note}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    gap: 10,
    padding: 20,
    borderWidth: 1,
    borderRadius: 20
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700"
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 21
  },
  primaryButton: {
    minHeight: 48,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: "800"
  },
  note: {
    fontSize: 14,
    lineHeight: 20
  }
});
