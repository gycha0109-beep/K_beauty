import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

type ScreenShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function ScreenShell({ eyebrow, title, description, children }: ScreenShellProps) {
  const { locale, toggleLocale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]} edges={["left", "right", "bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentColumn}>
          <View style={styles.header}>
            <View style={styles.topRow}>
              <Text style={[styles.eyebrow, { color: palette.accent }]}>{eyebrow}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`locale-${copy.localeSwitch.toLowerCase()}`}
                onPress={toggleLocale}
                style={({ pressed }) => [
                  styles.localeButton,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.border,
                    opacity: pressed ? 0.72 : 1
                  }
                ]}
              >
                <Text style={[styles.localeButtonText, { color: palette.text }]}>{copy.localeSwitch}</Text>
              </Pressable>
            </View>
            <Text style={[styles.title, { color: palette.text }]}>{title}</Text>
            <Text style={[styles.description, { color: palette.textMuted }]}>{description}</Text>
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40
  },
  contentColumn: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center"
  },
  header: {
    gap: 10
  },
  topRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.2
  },
  localeButton: {
    minWidth: 48,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12
  },
  localeButtonText: {
    fontSize: 13,
    fontWeight: "800"
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800"
  },
  description: {
    maxWidth: 560,
    fontSize: 16,
    lineHeight: 24
  },
  body: {
    gap: 18,
    paddingTop: 28
  }
});
