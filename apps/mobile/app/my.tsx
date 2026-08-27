import { StyleSheet, Text } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";

export default function MyScreen() {
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].my;

  return (
    <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
      <Text style={[styles.notice, { color: palette.textMuted }]}>{copy.notice}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  notice: {
    fontSize: 15,
    lineHeight: 22
  }
});
