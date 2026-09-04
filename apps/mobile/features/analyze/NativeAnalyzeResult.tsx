import type { SupportedLocale } from "@bejewely/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeAnalyzeProduct, NativeAnalyzeResult } from "./analyze-client";

type Palette = Readonly<{
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}>;

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    for (const key of ["text", "label", "title", "summary", "body", "description"]) {
      if (typeof candidate[key] === "string" && candidate[key].trim()) {
        return candidate[key].trim();
      }
    }
  }
  return "";
}

function ResultProduct({
  product,
  title,
  palette
}: {
  product: NativeAnalyzeProduct | null | undefined;
  title: string;
  palette: Palette;
}) {
  if (!product) return null;
  const productName = [product.brand, product.name].filter(Boolean).join(" · ");
  if (!productName && !product.reason) return null;

  return (
    <View style={[styles.productCard, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}>
      <Text style={[styles.kicker, { color: palette.accent }]}>{title}</Text>
      {productName ? <Text style={[styles.productName, { color: palette.text }]}>{productName}</Text> : null}
      {product.reason ? <Text style={[styles.body, { color: palette.textMuted }]}>{product.reason}</Text> : null}
      {product.comparison_reason ? (
        <Text style={[styles.comparison, { color: palette.textMuted }]}>{product.comparison_reason}</Text>
      ) : null}
    </View>
  );
}

function RoutineList({
  title,
  items,
  palette
}: {
  title: string;
  items: unknown[];
  palette: Palette;
}) {
  const rows = items.map(textValue).filter(Boolean).slice(0, 3);
  if (!rows.length) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {rows.map((row, index) => (
        <Text key={`${title}-${index}-${row}`} style={[styles.body, { color: palette.textMuted }]}>
          {index + 1}. {row}
        </Text>
      ))}
    </View>
  );
}

export function NativeAnalyzeResultView({
  result,
  locale,
  palette,
  onStartOver,
  onOpenPremium
}: {
  result: NativeAnalyzeResult;
  locale: SupportedLocale;
  palette: Palette;
  onStartOver: () => void;
  onOpenPremium: () => void;
}) {
  const warning = (result.warnings || []).map(textValue).find(Boolean) || "";
  const notice = result.meta?.notice?.trim() || "";

  return (
    <View
      testID="native-analyze-result"
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <Text style={[styles.kicker, { color: palette.accent }]}>
        {locale === "ko" ? "맞춤 스킨케어 루틴" : "PERSONALIZED SKIN-CARE ROUTINE"}
      </Text>
      <Text style={[styles.title, { color: palette.text }]}>
        {locale === "ko" ? "피부 분석 결과" : "Skin analysis result"}
      </Text>
      <Text testID="native-analyze-result-summary" style={[styles.summary, { color: palette.text }]}>
        {result.summary}
      </Text>

      {notice ? <Text style={[styles.notice, { color: palette.textMuted }]}>{notice}</Text> : null}
      {warning ? <Text style={[styles.warning, { color: palette.textMuted }]}>{warning}</Text> : null}

      <ResultProduct
        product={result.topPick}
        title={locale === "ko" ? "우선 추천" : "Top pick"}
        palette={palette}
      />
      <ResultProduct
        product={result.alternative}
        title={locale === "ko" ? "대안" : "Alternative"}
        palette={palette}
      />

      {result.amFocus ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{locale === "ko" ? "아침 포커스" : "AM focus"}</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>{result.amFocus}</Text>
        </View>
      ) : null}
      {result.pmFocus ? (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{locale === "ko" ? "저녁 포커스" : "PM focus"}</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>{result.pmFocus}</Text>
        </View>
      ) : null}

      <RoutineList
        title={locale === "ko" ? "아침 루틴" : "Morning routine"}
        items={result.morning}
        palette={palette}
      />
      <RoutineList
        title={locale === "ko" ? "저녁 루틴" : "Night routine"}
        items={result.night}
        palette={palette}
      />

      <Text style={[styles.boundary, { color: palette.textMuted }]}>
        {locale === "ko"
          ? "추천은 현재 피부 상태와 선호를 바탕으로 한 일상적인 화장품·스킨케어 가이드입니다."
          : "Recommendations are everyday cosmetic skin-care guidance based on your current skin profile and preferences."}
      </Text>

      <Pressable
        testID="native-analyze-premium-entry"
        accessibilityRole="button"
        onPress={onOpenPremium}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: palette.accent, opacity: pressed ? 0.72 : 1 }
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {locale === "ko" ? "Premium 루틴 리포트" : "Open Premium report"}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={onStartOver}
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }
        ]}
      >
        <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
          {locale === "ko" ? "새 분석 시작" : "Start a new analysis"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 14
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800"
  },
  summary: {
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "600"
  },
  notice: {
    fontSize: 13,
    lineHeight: 20
  },
  warning: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  },
  productCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 7
  },
  productName: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: "800"
  },
  comparison: {
    fontSize: 13,
    lineHeight: 19
  },
  section: {
    gap: 6
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800"
  },
  body: {
    fontSize: 14,
    lineHeight: 21
  },
  boundary: {
    fontSize: 12,
    lineHeight: 18
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800"
  },
  secondaryButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "700"
  }
});
