import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

export default function HomeScreen() {
  const router = useRouter();
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale];

  return (
    <ScreenShell eyebrow={copy.home.eyebrow} title={copy.home.title} description={copy.home.description}>
      <View style={[styles.heroCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
        <Text style={[styles.cardTitle, { color: palette.text }]}>{copy.home.cardTitle}</Text>
        <Text style={[styles.cardBody, { color: palette.textMuted }]}>{copy.home.cardBody}</Text>
        <Pressable
          testID="mobile-home-start-analysis"
          accessibilityRole="button"
          accessibilityLabel={copy.home.cta}
          onPress={() => router.push("/analyze")}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: palette.accent,
              opacity: pressed ? 0.72 : 1
            }
          ]}
        >
          <Text style={styles.primaryButtonText}>{copy.home.cta}</Text>
        </Pressable>
      </View>

      <View style={styles.benefitList}>
        {copy.home.benefits.map((benefit) => (
          <View
            key={benefit.title}
            style={[styles.benefitCard, { backgroundColor: palette.surface, borderColor: palette.border }]}
          >
            <Text style={[styles.benefitTitle, { color: palette.text }]}>{benefit.title}</Text>
            <Text style={[styles.benefitBody, { color: palette.textMuted }]}>{benefit.body}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    width: "100%",
    gap: 14,
    padding: 20,
    borderWidth: 1,
    borderRadius: 24
  },
  cardTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "800"
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 23
  },
  primaryButton: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    paddingHorizontal: 18,
    marginTop: 2
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800"
  },
  benefitList: {
    gap: 12
  },
  benefitCard: {
    gap: 6,
    padding: 18,
    borderWidth: 1,
    borderRadius: 20
  },
  benefitTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  benefitBody: {
    fontSize: 14,
    lineHeight: 21
  }
});
