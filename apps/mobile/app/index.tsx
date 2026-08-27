import { FACE_CAPTURE_STATES, SUPPORTED_LOCALES } from "@bejewely/shared";
import { StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

export default function HomeScreen() {
  const { locale, palette, themeMode } = useMobileShell();
  const copy = MOBILE_COPY[locale];

  return (
    <ScreenShell eyebrow={copy.home.eyebrow} title={copy.home.title} description={copy.home.description}>
      <View style={[styles.card, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.home.cardTitle}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>{copy.home.routes}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>
          {copy.home.localeLabel} · {locale.toUpperCase()} ({SUPPORTED_LOCALES.join(" / ")})
        </Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>
          {copy.theme.label} · {copy.theme[themeMode]}
        </Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>{copy.home.nativeGate}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>Face capture states · {FACE_CAPTURE_STATES.length}</Text>
      </View>
      <Text style={[styles.note, { color: palette.textMuted }]}>{copy.home.note}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    gap: 8,
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
  note: {
    fontSize: 14,
    lineHeight: 20
  }
});
