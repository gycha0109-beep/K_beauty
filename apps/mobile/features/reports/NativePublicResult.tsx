import { StyleSheet, Text, View } from "react-native";
import { useMobileShell } from "../../lib/mobile-shell";
import type { NativeFreeSavedResult } from "./saved-report-client";

const COPY = {
  en: {
    kicker: "SHARED · MOBILE-10",
    title: "Shared result",
    summary: "Shared summary",
    skinType: "Skin type",
    concerns: "Main concerns",
    topPick: "Top Pick",
    am: "AM routine",
    pm: "PM routine"
  },
  ko: {
    kicker: "공유 · MOBILE-10",
    title: "공유 결과",
    summary: "공유된 요약",
    skinType: "피부 타입",
    concerns: "주요 고민",
    topPick: "Top Pick",
    am: "아침 루틴",
    pm: "저녁 루틴"
  }
} as const;

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function lines(value: unknown, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map(text).filter((item): item is string => Boolean(item)).slice(0, limit);
}

function topPick(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const product = value as Record<string, unknown>;
  const name = text(product.name);
  const brand = text(product.brand);
  const reason = text(product.reason);
  return name || brand || reason ? { name, brand, reason } : null;
}

function Section({ title, values }: { title: string; values: string[] }) {
  const { palette } = useMobileShell();
  if (!values.length) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {values.map((value, index) => (
        <Text key={`${title}-${index}`} style={[styles.body, { color: palette.textMuted }]}>• {value}</Text>
      ))}
    </View>
  );
}

export function NativePublicResult({ result }: { result: NativeFreeSavedResult }) {
  const { locale, palette } = useMobileShell();
  const copy = COPY[locale];
  const summary = text(result.summary);
  const skinType = text(result.skinType);
  const concerns = lines(result.mainConcerns, 5);
  const product = topPick(result.topPick);
  const am = lines(result.routineAm);
  const pm = lines(result.routinePm);

  return (
    <View testID="native-public-result" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>{copy.kicker}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{copy.title}</Text>
      </View>

      {summary ? (
        <View style={styles.section} testID="native-public-result-summary">
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.summary}</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>{summary}</Text>
        </View>
      ) : null}
      {skinType ? <Section title={copy.skinType} values={[skinType]} /> : null}
      <Section title={copy.concerns} values={concerns} />
      {product ? (
        <View style={styles.section} testID="native-public-result-top-pick">
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.topPick}</Text>
          <Text style={[styles.product, { color: palette.text }]}>{[product.brand, product.name].filter(Boolean).join(" · ")}</Text>
          {product.reason ? <Text style={[styles.body, { color: palette.textMuted }]}>{product.reason}</Text> : null}
        </View>
      ) : null}
      <Section title={copy.am} values={am} />
      <Section title={copy.pm} values={pm} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 18 },
  header: { gap: 6 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  section: { gap: 6 },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 21 },
  product: { fontSize: 15, lineHeight: 22, fontWeight: "700" }
});
