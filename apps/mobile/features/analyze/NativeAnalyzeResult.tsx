import type { SupportedLocale } from "@bejewely/shared";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeAnalyzeProduct, NativeAnalyzeResult } from "./analyze-client";

type Palette = Readonly<{
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}>;

const COPY = {
  en: {
    eyebrow: "SKIN MATCH · PERSONALIZED",
    title: "Your skin routine, made clear",
    direction: "TODAY'S DIRECTION",
    am: "AM",
    pm: "PM",
    matchEyebrow: "01 · YOUR MATCH",
    matchTitle: "Products chosen for your routine",
    topPick: "TOP PICK",
    alternative: "ALTERNATIVE",
    why: "WHY IT FITS",
    compare: "HOW TO COMPARE",
    routineEyebrow: "02 · YOUR ROUTINE",
    routineTitle: "A simple rhythm for morning and night",
    morning: "MORNING",
    evening: "EVENING",
    premiumEyebrow: "GO DEEPER",
    premiumTitle: "Turn this result into a complete routine",
    premiumBody: "See the fuller routine plan and guidance built around this analysis.",
    premiumButton: "Open Premium routine",
    startOver: "Start a new analysis",
    boundary: "Everyday cosmetic skin-care guidance based on your current skin profile and preferences."
  },
  ko: {
    eyebrow: "SKIN MATCH · PERSONALIZED",
    title: "내 피부에 맞는 루틴을 한눈에",
    direction: "오늘의 관리 방향",
    am: "AM",
    pm: "PM",
    matchEyebrow: "01 · 나의 추천",
    matchTitle: "지금 루틴에 맞춘 제품",
    topPick: "우선 추천",
    alternative: "대안",
    why: "추천 이유",
    compare: "비교 포인트",
    routineEyebrow: "02 · 나의 루틴",
    routineTitle: "아침과 저녁, 필요한 것만 간결하게",
    morning: "아침",
    evening: "저녁",
    premiumEyebrow: "더 깊게 보기",
    premiumTitle: "이 결과를 전체 루틴으로 정리해보세요",
    premiumBody: "이번 분석을 바탕으로 더 자세한 루틴 구성과 사용 가이드를 확인할 수 있습니다.",
    premiumButton: "Premium 루틴 보기",
    startOver: "새 분석 시작",
    boundary: "현재 피부 상태와 선호를 바탕으로 한 일상적인 화장품·스킨케어 가이드입니다."
  }
} as const;

type Copy = (typeof COPY)[SupportedLocale];

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.trim();
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  const value = Number.parseInt(normalized.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function textValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";

  const candidate = value as Record<string, unknown>;
  for (const key of ["text", "label", "title", "summary", "body", "description"]) {
    const next = candidate[key];
    if (typeof next === "string" && next.trim()) return next.trim();
  }
  return "";
}

function cleanSummary(summary: string) {
  return summary
    .replace(/^summary\s*[·:\-]\s*/i, "")
    .replace(/^요약\s*[·:\-]\s*/, "")
    .trim();
}

function ProductArtwork({ product, palette }: { product: NativeAnalyzeProduct; palette: Palette }) {
  const initial = (product.brand || product.name || "B").trim().slice(0, 1).toUpperCase();

  return (
    <View
      style={[
        styles.productArtwork,
        {
          backgroundColor: colorWithAlpha(palette.accent, 0.1),
          borderColor: colorWithAlpha(palette.accent, 0.18)
        }
      ]}
    >
      <View
        pointerEvents="none"
        style={[styles.productHalo, { backgroundColor: colorWithAlpha(palette.accent, 0.08) }]}
      />
      {product.image_url ? (
        <Image resizeMode="contain" source={{ uri: product.image_url }} style={styles.productImage} />
      ) : (
        <View style={[styles.monogram, { backgroundColor: palette.surface }]}>
          <Text style={[styles.monogramText, { color: palette.accent }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

function PrimaryProduct({
  product,
  copy,
  palette
}: {
  product: NativeAnalyzeProduct;
  copy: Copy;
  palette: Palette;
}) {
  return (
    <View style={[styles.primaryProduct, { backgroundColor: palette.surface }]}>
      <View style={styles.rankRow}>
        <View style={[styles.rankBadge, { backgroundColor: palette.accent }]}>
          <Text style={styles.rankText}>01</Text>
        </View>
        <Text style={[styles.microLabel, { color: palette.accent }]}>{copy.topPick}</Text>
      </View>

      <View style={styles.productIdentity}>
        <ProductArtwork product={product} palette={palette} />
        <View style={styles.productCopy}>
          {product.brand ? <Text style={[styles.brand, { color: palette.textMuted }]}>{product.brand}</Text> : null}
          {product.name ? <Text style={[styles.productName, { color: palette.text }]}>{product.name}</Text> : null}
        </View>
      </View>

      {product.reason ? (
        <View style={[styles.reasonPanel, { backgroundColor: palette.surfaceMuted }]}>
          <Text style={[styles.detailLabel, { color: palette.text }]}>{copy.why}</Text>
          <Text style={[styles.detailText, { color: palette.textMuted }]}>{product.reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

function AlternativeProduct({
  product,
  copy,
  palette
}: {
  product: NativeAnalyzeProduct;
  copy: Copy;
  palette: Palette;
}) {
  const name = [product.brand, product.name].filter((value): value is string => Boolean(value)).join(" · ");

  return (
    <View style={[styles.alternativeRow, { borderTopColor: palette.border }]}>
      <View style={[styles.secondaryRank, { backgroundColor: colorWithAlpha(palette.accent, 0.1) }]}>
        <Text style={[styles.secondaryRankText, { color: palette.accent }]}>02</Text>
      </View>
      <View style={styles.alternativeCopy}>
        <Text style={[styles.microLabel, { color: palette.accent }]}>{copy.alternative}</Text>
        {name ? <Text style={[styles.alternativeName, { color: palette.text }]}>{name}</Text> : null}
        {product.reason ? <Text style={[styles.body, { color: palette.textMuted }]}>{product.reason}</Text> : null}
        {product.comparison_reason ? (
          <View style={styles.compareBlock}>
            <Text style={[styles.detailLabel, { color: palette.text }]}>{copy.compare}</Text>
            <Text style={[styles.detailText, { color: palette.textMuted }]}>{product.comparison_reason}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function DirectionRow({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return (
    <View style={styles.directionRow}>
      <View style={[styles.timePill, { backgroundColor: colorWithAlpha(palette.accent, 0.11) }]}>
        <Text style={[styles.timeText, { color: palette.accent }]}>{label}</Text>
      </View>
      <Text style={[styles.directionText, { color: palette.text }]}>{value}</Text>
    </View>
  );
}

function RoutineTimeline({ title, items, palette }: { title: string; items: unknown[]; palette: Palette }) {
  const rows = items.map(textValue).filter((value) => value.length > 0).slice(0, 5);
  if (!rows.length) return null;

  return (
    <View style={styles.routineLane}>
      <Text style={[styles.routineLaneTitle, { color: palette.text }]}>{title}</Text>
      {rows.map((row, index) => (
        <View key={`${title}-${index}-${row}`} style={styles.timelineRow}>
          <View style={styles.markerColumn}>
            <View
              style={[
                styles.marker,
                {
                  backgroundColor: index === 0 ? palette.accent : palette.surface,
                  borderColor: index === 0 ? palette.accent : palette.border
                }
              ]}
            >
              <Text style={[styles.markerText, { color: index === 0 ? "#FFFFFF" : palette.textMuted }]}>
                {index + 1}
              </Text>
            </View>
            {index < rows.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: palette.border }]} /> : null}
          </View>
          <Text style={[styles.timelineText, { color: palette.text }]}>{row}</Text>
        </View>
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
  const copy = COPY[locale];
  const warning = (result.warnings || []).map(textValue).find((value) => value.length > 0) || "";
  const notice = result.meta?.notice?.trim() || "";
  const priority = textValue(result.priority);
  const summary = cleanSummary(result.summary);
  const hasDirection = Boolean(result.amFocus || result.pmFocus);
  const hasRoutine = result.morning.length > 0 || result.night.length > 0;

  return (
    <View testID="native-analyze-result" style={styles.report}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: palette.surfaceMuted,
            borderColor: colorWithAlpha(palette.accent, 0.14)
          }
        ]}
      >
        <View pointerEvents="none" style={[styles.heroOrbLarge, { backgroundColor: colorWithAlpha(palette.accent, 0.08) }]} />
        <View pointerEvents="none" style={[styles.heroOrbSmall, { borderColor: colorWithAlpha(palette.accent, 0.2) }]} />
        <Text style={[styles.eyebrow, { color: palette.accent }]}>{copy.eyebrow}</Text>
        <Text style={[styles.heroTitle, { color: palette.text }]}>{copy.title}</Text>
        <Text testID="native-analyze-result-summary" style={[styles.summary, { color: palette.text }]}>{summary}</Text>
        {priority ? (
          <View style={[styles.priorityPill, { backgroundColor: palette.surface }]}>
            <View style={[styles.priorityDot, { backgroundColor: palette.accent }]} />
            <Text style={[styles.priorityText, { color: palette.text }]}>{priority}</Text>
          </View>
        ) : null}
        {notice ? <Text style={[styles.notice, { color: palette.textMuted }]}>{notice}</Text> : null}
      </View>

      {hasDirection ? (
        <View style={styles.directionSection}>
          <Text style={[styles.sectionMicroTitle, { color: palette.textMuted }]}>{copy.direction}</Text>
          <View style={[styles.directionPanel, { borderColor: palette.border }]}>
            {result.amFocus ? <DirectionRow label={copy.am} value={result.amFocus} palette={palette} /> : null}
            {result.amFocus && result.pmFocus ? <View style={[styles.directionDivider, { backgroundColor: palette.border }]} /> : null}
            {result.pmFocus ? <DirectionRow label={copy.pm} value={result.pmFocus} palette={palette} /> : null}
          </View>
        </View>
      ) : null}

      {warning ? (
        <View style={[styles.warning, { backgroundColor: colorWithAlpha(palette.accent, 0.07), borderColor: colorWithAlpha(palette.accent, 0.18) }]}>
          <View style={[styles.warningDot, { backgroundColor: palette.accent }]} />
          <Text style={[styles.warningText, { color: palette.textMuted }]}>{warning}</Text>
        </View>
      ) : null}

      {result.topPick || result.alternative ? (
        <View style={styles.editorialSection}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>{copy.matchEyebrow}</Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.matchTitle}</Text>
          <View style={[styles.productStage, { borderColor: palette.border }]}>
            {result.topPick ? <PrimaryProduct product={result.topPick} copy={copy} palette={palette} /> : null}
            {result.alternative ? <AlternativeProduct product={result.alternative} copy={copy} palette={palette} /> : null}
          </View>
        </View>
      ) : null}

      {hasRoutine ? (
        <View style={styles.editorialSection}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>{copy.routineEyebrow}</Text>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.routineTitle}</Text>
          <View style={[styles.routinePanel, { backgroundColor: palette.surfaceMuted }]}>
            <RoutineTimeline title={copy.morning} items={result.morning} palette={palette} />
            {result.morning.length > 0 && result.night.length > 0 ? <View style={[styles.routineDivider, { backgroundColor: palette.border }]} /> : null}
            <RoutineTimeline title={copy.evening} items={result.night} palette={palette} />
          </View>
        </View>
      ) : null}

      <View style={[styles.premiumPanel, { backgroundColor: colorWithAlpha(palette.accent, 0.09), borderColor: colorWithAlpha(palette.accent, 0.18) }]}>
        <Text style={[styles.eyebrow, { color: palette.accent }]}>{copy.premiumEyebrow}</Text>
        <Text style={[styles.premiumTitle, { color: palette.text }]}>{copy.premiumTitle}</Text>
        <Text style={[styles.body, { color: palette.textMuted }]}>{copy.premiumBody}</Text>
        <Pressable
          testID="native-analyze-premium-entry"
          accessibilityRole="button"
          onPress={onOpenPremium}
          style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent, opacity: pressed ? 0.72 : 1 }]}
        >
          <Text style={styles.primaryButtonText}>{copy.premiumButton}</Text>
        </Pressable>
      </View>

      <Text style={[styles.boundary, { color: palette.textMuted }]}>{copy.boundary}</Text>
      <Pressable accessibilityRole="button" onPress={onStartOver} style={({ pressed }) => [styles.startOver, { opacity: pressed ? 0.6 : 1 }]}>
        <Text style={[styles.startOverText, { color: palette.text }]}>{copy.startOver}</Text>
        <Text style={[styles.startOverArrow, { color: palette.accent }]}>↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  report: { gap: 28 },
  hero: { position: "relative", overflow: "hidden", borderWidth: 1, borderRadius: 30, paddingHorizontal: 22, paddingTop: 26, paddingBottom: 24, gap: 12 },
  heroOrbLarge: { position: "absolute", width: 230, height: 230, borderRadius: 115, right: -92, top: -84 },
  heroOrbSmall: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 1, right: 34, bottom: -56 },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 1.15 },
  heroTitle: { maxWidth: 300, fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.6 },
  summary: { maxWidth: 520, fontSize: 18, lineHeight: 27, fontWeight: "600", letterSpacing: -0.15 },
  notice: { maxWidth: 500, fontSize: 12, lineHeight: 18 },
  priorityPill: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { flexShrink: 1, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  directionSection: { gap: 9 },
  sectionMicroTitle: { fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 1 },
  directionPanel: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 4 },
  directionRow: { flexDirection: "row", alignItems: "flex-start", gap: 13, paddingVertical: 13 },
  timePill: { minWidth: 42, minHeight: 26, alignItems: "center", justifyContent: "center", borderRadius: 13, paddingHorizontal: 9 },
  timeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.7 },
  directionText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  directionDivider: { height: StyleSheet.hairlineWidth, marginLeft: 55 },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 16, padding: 14 },
  warningDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  warningText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "600" },
  editorialSection: { gap: 10 },
  sectionTitle: { maxWidth: 520, fontSize: 24, lineHeight: 31, fontWeight: "800", letterSpacing: -0.35, marginBottom: 4 },
  productStage: { overflow: "hidden", borderWidth: 1, borderRadius: 26 },
  primaryProduct: { padding: 18, gap: 16 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rankText: { color: "#FFFFFF", fontSize: 11, fontWeight: "900", letterSpacing: 0.4 },
  microLabel: { fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1 },
  productIdentity: { flexDirection: "row", alignItems: "center", gap: 16 },
  productArtwork: { position: "relative", overflow: "hidden", width: 98, height: 112, borderWidth: 1, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  productHalo: { position: "absolute", width: 100, height: 100, borderRadius: 50, right: -48, top: -40 },
  productImage: { width: 82, height: 96 },
  monogram: { width: 52, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  monogramText: { fontSize: 24, fontWeight: "800" },
  productCopy: { flex: 1, gap: 5 },
  brand: { fontSize: 11, lineHeight: 16, fontWeight: "800", letterSpacing: 0.5 },
  productName: { fontSize: 19, lineHeight: 25, fontWeight: "800", letterSpacing: -0.25 },
  reasonPanel: { borderRadius: 17, padding: 14, gap: 5 },
  detailLabel: { fontSize: 10, lineHeight: 15, fontWeight: "900", letterSpacing: 0.9 },
  detailText: { fontSize: 13, lineHeight: 20 },
  alternativeRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 17 },
  secondaryRank: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  secondaryRankText: { fontSize: 10, fontWeight: "900" },
  alternativeCopy: { flex: 1, gap: 6 },
  alternativeName: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 21 },
  compareBlock: { gap: 3, marginTop: 3 },
  routinePanel: { borderRadius: 26, padding: 18, gap: 18 },
  routineLane: { gap: 12 },
  routineLaneTitle: { fontSize: 12, lineHeight: 17, fontWeight: "900", letterSpacing: 1 },
  timelineRow: { minHeight: 42, flexDirection: "row", alignItems: "flex-start", gap: 12 },
  markerColumn: { width: 28, alignItems: "center", alignSelf: "stretch" },
  marker: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  markerText: { fontSize: 10, fontWeight: "900" },
  timelineLine: { width: 1, flex: 1, minHeight: 16 },
  timelineText: { flex: 1, fontSize: 14, lineHeight: 21, fontWeight: "600", paddingTop: 2, paddingBottom: 12 },
  routineDivider: { height: StyleSheet.hairlineWidth },
  premiumPanel: { overflow: "hidden", borderWidth: 1, borderRadius: 28, padding: 20, gap: 9 },
  premiumTitle: { maxWidth: 480, fontSize: 22, lineHeight: 29, fontWeight: "800", letterSpacing: -0.3 },
  primaryButton: { minHeight: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 7 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  boundary: { fontSize: 11, lineHeight: 17, textAlign: "center", paddingHorizontal: 10 },
  startOver: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 8 },
  startOverText: { fontSize: 13, fontWeight: "800" },
  startOverArrow: { fontSize: 14, fontWeight: "900" }
});
