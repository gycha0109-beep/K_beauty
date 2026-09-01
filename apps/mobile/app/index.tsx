import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

export default function HomeScreen() {
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale];
  const steps = [copy.home.stepPhoto, copy.home.stepSurvey, copy.home.stepGuidance];

  return (
    <ScreenShell eyebrow={copy.home.eyebrow} title={copy.home.title} description={copy.home.description}>
      <View style={[styles.card, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.home.cardTitle}</Text>
        <View style={styles.steps}>
          {steps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={[styles.stepNumber, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Text style={[styles.stepNumberText, { color: palette.accent }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: palette.textMuted }]}>{step}</Text>
            </View>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="start-skin-analysis"
          onPress={() => router.push("/analyze")}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: palette.accent,
              opacity: pressed ? 0.72 : 1
            }
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: palette.background }]}>{copy.home.cta}</Text>
        </Pressable>
      </View>
      <Text style={[styles.note, { color: palette.textMuted }]}>{copy.home.note}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    gap: 20,
    padding: 20,
    borderWidth: 1,
    borderRadius: 24
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800"
  },
  steps: {
    gap: 14
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  stepNumber: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 16
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: "800"
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    paddingHorizontal: 18
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "800"
  },
  note: {
    fontSize: 13,
    lineHeight: 19
  }
});
