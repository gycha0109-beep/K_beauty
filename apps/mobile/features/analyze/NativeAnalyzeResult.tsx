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

type ResultVisual = Readonly<{
  card: string;
  cardSoft: string;
  cardMuted: string;
  text: string;
  body: string;
  muted: string;
  border: string;
  borderStrong: string;
  rose: string;
  roseSoft: string;
  coral: string;
}>;

const COPY = {
  en: {
    eyebrow: "PERSONALIZED RESULT",
    title: "Your K-Beauty Match",
    direction: "TODAY'S DIRECTION",
    am: "AM",
    pm: "PM",
    matchEyebrow: "TOP PICK",
    matchTitle: "Start with this match",
    topPick: "TOP PICK",
    alternative: "ALTERNATIVE",
    why: "WHY IT FITS",
    compare: "HOW TO COMPARE",
    routineEyebrow: "YOUR ROUTINE",
    routineTitle: "Morning and night, kept simple",
    morning: "MORNING",
    evening: "EVENING",
    premiumEyebrow: "FULL REPORT",
    premiumTitle: "Turn this match into a complete routine",
    premiumBody: "See the fuller routine plan and guidance built around this analysis.",
    premiumButton: "Open Premium routine",
    startOver: "Start a new analysis",
    imagePreparing: "Image coming soon",
    boundary: "Everyday cosmetic skin-care guidance based on your current skin profile and preferences."
  },
  ko: {
    eyebrow: "PERSONALIZED RESULT",
    title: "당신의 K-뷰티 매치",
    direction: "오늘의 관리 방향",
    am: "AM",
    pm: "PM",
    matchEyebrow: "TOP PICK",
    matchTitle: "가장 먼저 시작할 제품",
    topPick: "1순위 추천",
    alternative: "대안",
    why: "추천 이유",
    compare: "비교 포인트",
    routineEyebrow: "나의 루틴",
    routineTitle: "아침과 저녁, 필요한 것만 간결하게",
    morning: "아침",
    evening: "저녁",
    premiumEyebrow: "전체 리포트",
    premiumTitle: "이 매치를 전체 루틴으로 정리해보세요",
    premiumBody: "이번 분석을 바탕으로 더 자세한 루틴 구성과 사용 가이드를 확인할 수 있습니다.",
    premiumButton: "Premium 루틴 보기",
    startOver: "새 분석 시작",
    imagePreparing: "이미지 준비 중",
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

function isDarkHex(hex: string) {
  const normalized = hex.trim();
  if (!/^#[0-9a-f]{6}$/i.test(normalized)) return false;
  const value = Number.parseInt(normalized.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return red * 0.299 + green * 0.587 + blue * 0.114 < 110;
}

function getResultVisual(palette: Palette): ResultVisual {
  if (isDarkHex(palette.surface)) {
    return {
      card: "#241720",
      cardSoft: "#2A1B24",
      cardMuted: "#2B1C26",
      text: "#FFF8F3",
      body: "#F3E4DF",
      muted: "#C8AEB8",
      border: "#4A303C",
      borderStrong: "#5A3A48",
      rose: "#FF9AA8",
      roseSoft: "rgba(255, 154, 168, 0.10)",
      coral: "#FF8068"
    };
  }

  return {
    card: "#FFFAF6",
    cardSoft: "#FFF7F4",
    cardMuted: "#FFF3EE",
    text: "#26101A",
    body: "#3A1824",
    muted: "#7A5360",
    border: "#EAD9D6",
    borderStrong: "#EAD2CA",
    rose: "#E6507A",
    roseSoft: "#FFF4F6",
    coral: "#FF6A3D"
  };
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

function ProductArtwork({
  product,
  copy,
  visual
}: {
  product: NativeAnalyzeProduct;
  copy: Copy;
  visual: ResultVisual;
}) {
  return (
    <View
      style={[
        styles.productArtwork,
        {
          backgroundColor: visual.cardSoft,
          borderColor: visual.borderStrong,
          shadowColor: visual.text
        }
      ]}
    >
      {product.image_url ? (
        <Image resizeMode="contain" source={{ uri: product.image_url }} style={styles.productImage} />
      ) : (
        <View style={styles.imageFallback}>
          <View style={[styles.placeholderBottle, { borderColor: visual.borderStrong, backgroundColor: visual.card }]}>
            <View style={[styles.placeholderLine, { backgroundColor: visual.muted }]} />
            <View style={[styles.placeholderLine, styles.placeholderLineShort, { backgroundColor: visual.muted }]} />
            <View style={[styles.placeholderLine, { backgroundColor: visual.muted }]} />
          </View>
          {product.brand ? <Text numberOfLines={1} style={[styles.placeholderBrand, { color: visual.body }]}>{product.brand}</Text> : null}
          <Text style={[styles.placeholderHint, { color: visual.muted }]}>{copy.imagePreparing}</Text>
        </View>
      )}
    </View>
  );
}

function PrimaryProduct({
  product,
  copy,
  visual
}: {
  product: NativeAnalyzeProduct;
  copy: Copy;
  visual: ResultVisual;
}) {
  return (
    <View
      style={[
        styles.primaryProduct,
        {
          backgroundColor: visual.card,
          borderColor: visual.border,
          shadowColor: visual.text
        }
      ]}
    >
      <View style={[styles.topPickPill, { backgroundColor: visual.roseSoft, borderColor: colorWithAlpha(visual.rose, 0.34) }]}>
        <Text style={[styles.topPickCrown, { color: visual.rose }]}>◆</Text>
        <Text style={[styles.topPickPillText, { color: visual.rose }]}>{copy.topPick}</Text>
      </View>

      <View style={styles.productIdentity}>
        <ProductArtwork product={product} copy={copy} visual={visual} />
        <View style={styles.productCopy}>
          {product.name ? <Text style={[styles.productName, { color: visual.text }]}>{product.name}</Text> : null}
          {product.brand ? <Text style={[styles.brand, { color: visual.rose }]}>{product.brand}</Text> : null}
          {product.reason ? <Text style={[styles.productReason, { color: visual.body }]}>“{product.reason}”</Text> : null}
        </View>
      </View>
    </View>
  );
}

function AlternativeProduct({
  product,
  copy,
  visual
}: {
  product: NativeAnalyzeProduct;
  copy: Copy;
  visual: ResultVisual;
}) {
  const name = [product.brand, product.name].filter((value): value is string => Boolean(value)).join(" · ");

  return (
    <View style={[styles.alternativeCard, { backgroundColor: visual.card, borderColor: visual.border }]}>
      <View style={styles.alternativeHeading}>
        <View style={[styles.secondaryRank, { backgroundColor: visual.roseSoft, borderColor: colorWithAlpha(visual.rose, 0.26) }]}>
          <Text style={[styles.secondaryRankText, { color: visual.rose }]}>02</Text>
        </View>
        <Text style={[styles.microLabel, { color: visual.rose }]}>{copy.alternative}</Text>
      </View>
      {name ? <Text style={[styles.alternativeName, { color: visual.text }]}>{name}</Text> : null}
      {product.reason ? <Text style={[styles.body, { color: visual.muted }]}>{product.reason}</Text> : null}
      {product.comparison_reason ? (
        <View style={[styles.compareBlock, { borderTopColor: visual.border }]}>
          <Text style={[styles.detailLabel, { color: visual.body }]}>{copy.compare}</Text>
          <Text style={[styles.detailText, { color: visual.muted }]}>{product.comparison_reason}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DirectionRow({ label, value, visual }: { label: string; value: string; visual: ResultVisual }) {
  return (
    <View style={styles.directionRow}>
      <View style={[styles.timePill, { backgroundColor: visual.roseSoft, borderColor: colorWithAlpha(visual.rose, 0.25) }]}>
        <Text style={[styles.timeText, { color: visual.rose }]}>{label}</Text>
      </View>
      <Text style={[styles.directionText, { color: visual.body }]}>{value}</Text>
    </View>
  );
}

function RoutineTimeline({ title, items, visual }: { title: string; items: unknown[]; visual: ResultVisual }) {
  const rows = items.map(textValue).filter((value) => value.length > 0).slice(0, 5);
  if (!rows.length) return null;

  return (
    <View style={styles.routineLane}>
      <Text style={[styles.routineLaneTitle, { color: visual.text }]}>{title}</Text>
      {rows.map((row, index) => (
        <View key={`${title}-${index}-${row}`} style={styles.timelineRow}>
          <View style={styles.markerColumn}>
            <View
              style={[
                styles.marker,
                {
                  backgroundColor: index === 0 ? visual.rose : visual.card,
                  borderColor: index === 0 ? visual.rose : visual.border
                }
              ]}
            >
              <Text style={[styles.markerText, { color: index === 0 ? "#FFFFFF" : visual.muted }]}>{index + 1}</Text>
            </View>
            {index < rows.length - 1 ? <View style={[styles.timelineLine, { backgroundColor: visual.border }]} /> : null}
          </View>
          <Text style={[styles.timelineText, { color: visual.body }]}>{row}</Text>
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
  const visual = getResultVisual(palette);
  const warning = (result.warnings || []).map(textValue).find((value) => value.length > 0) || "";
  const notice = result.meta?.notice?.trim() || "";
  const priority = textValue(result.priority);
  const summary = cleanSummary(result.summary);
  const hasDirection = Boolean(result.amFocus || result.pmFocus);
  const hasRoutine = result.morning.length > 0 || result.night.length > 0;

  return (
    <View testID="native-analyze-result" style={styles.report}>
      <View style={styles.resultHeader}>
        <Text style={[styles.eyebrow, { color: visual.rose }]}>{copy.eyebrow}</Text>
        <Text style={[styles.heroTitle, { color: visual.text }]}>{copy.title}</Text>
        <Text testID="native-analyze-result-summary" style={[styles.summary, { color: visual.body }]}>{summary}</Text>
        {priority ? (
          <View style={[styles.priorityPill, { backgroundColor: visual.card, borderColor: visual.border }]}>
            <View style={[styles.priorityDot, { backgroundColor: visual.rose }]} />
            <Text style={[styles.priorityText, { color: visual.body }]}>{priority}</Text>
          </View>
        ) : null}
        {notice ? <Text style={[styles.notice, { color: visual.muted }]}>{notice}</Text> : null}
      </View>

      {result.topPick || result.alternative ? (
        <View style={styles.editorialSection}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.eyebrow, { color: visual.rose }]}>{copy.matchEyebrow}</Text>
            <View style={[styles.sectionRule, { backgroundColor: visual.border }]} />
          </View>
          <Text style={[styles.sectionTitle, { color: visual.text }]}>{copy.matchTitle}</Text>
          {result.topPick ? <PrimaryProduct product={result.topPick} copy={copy} visual={visual} /> : null}
          {result.alternative ? <AlternativeProduct product={result.alternative} copy={copy} visual={visual} /> : null}
        </View>
      ) : null}

      {hasDirection ? (
        <View style={styles.editorialSection}>
          <Text style={[styles.sectionMicroTitle, { color: visual.muted }]}>{copy.direction}</Text>
          <View
            style={[
              styles.directionPanel,
              {
                backgroundColor: visual.cardMuted,
                borderColor: visual.borderStrong
              }
            ]}
          >
            {result.amFocus ? <DirectionRow label={copy.am} value={result.amFocus} visual={visual} /> : null}
            {result.amFocus && result.pmFocus ? <View style={[styles.directionDivider, { backgroundColor: visual.border }]} /> : null}
            {result.pmFocus ? <DirectionRow label={copy.pm} value={result.pmFocus} visual={visual} /> : null}
          </View>
        </View>
      ) : null}

      {warning ? (
        <View style={[styles.warning, { backgroundColor: visual.roseSoft, borderColor: colorWithAlpha(visual.rose, 0.24) }]}>
          <View style={[styles.warningDot, { backgroundColor: visual.coral }]} />
          <Text style={[styles.warningText, { color: visual.muted }]}>{warning}</Text>
        </View>
      ) : null}

      {hasRoutine ? (
        <View style={styles.editorialSection}>
          <View style={styles.sectionHeading}>
            <Text style={[styles.eyebrow, { color: visual.rose }]}>{copy.routineEyebrow}</Text>
            <View style={[styles.sectionRule, { backgroundColor: visual.border }]} />
          </View>
          <Text style={[styles.sectionTitle, { color: visual.text }]}>{copy.routineTitle}</Text>
          <View style={[styles.routinePanel, { backgroundColor: visual.card, borderColor: visual.border }]}>
            <RoutineTimeline title={copy.morning} items={result.morning} visual={visual} />
            {result.morning.length > 0 && result.night.length > 0 ? <View style={[styles.routineDivider, { backgroundColor: visual.border }]} /> : null}
            <RoutineTimeline title={copy.evening} items={result.night} visual={visual} />
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.premiumPanel,
          {
            backgroundColor: visual.cardMuted,
            borderColor: visual.borderStrong,
            shadowColor: visual.text
          }
        ]}
      >
        <Text style={[styles.eyebrow, { color: visual.rose }]}>{copy.premiumEyebrow}</Text>
        <Text style={[styles.premiumTitle, { color: visual.text }]}>{copy.premiumTitle}</Text>
        <Text style={[styles.body, { color: visual.muted }]}>{copy.premiumBody}</Text>
        <Pressable
          testID="native-analyze-premium-entry"
          accessibilityRole="button"
          onPress={onOpenPremium}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: palette.accent,
              shadowColor: visual.rose,
              opacity: pressed ? 0.76 : 1
            }
          ]}
        >
          <View pointerEvents="none" style={[styles.buttonCoralEdge, { backgroundColor: visual.coral }]} />
          <Text style={styles.primaryButtonText}>{copy.premiumButton}</Text>
        </Pressable>
      </View>

      <Text style={[styles.boundary, { color: visual.muted }]}>{copy.boundary}</Text>
      <Pressable accessibilityRole="button" onPress={onStartOver} style={({ pressed }) => [styles.startOver, { opacity: pressed ? 0.6 : 1 }]}>
        <Text style={[styles.startOverText, { color: visual.body }]}>{copy.startOver}</Text>
        <Text style={[styles.startOverArrow, { color: visual.rose }]}>↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  report: { gap: 24 },
  resultHeader: { gap: 8, paddingHorizontal: 2 },
  eyebrow: { fontSize: 10, lineHeight: 15, fontWeight: "800", letterSpacing: 1.25 },
  heroTitle: { maxWidth: 520, fontSize: 29, lineHeight: 35, fontWeight: "800", letterSpacing: -0.65 },
  summary: { maxWidth: 560, fontSize: 15, lineHeight: 23, fontWeight: "600", letterSpacing: -0.12 },
  notice: { maxWidth: 520, fontSize: 11, lineHeight: 17 },
  priorityPill: { alignSelf: "flex-start", maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, marginTop: 2 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: "700" },
  editorialSection: { gap: 10 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth },
  sectionTitle: { maxWidth: 520, fontSize: 22, lineHeight: 28, fontWeight: "800", letterSpacing: -0.35, marginBottom: 2 },
  sectionMicroTitle: { fontSize: 10, lineHeight: 15, fontWeight: "800", letterSpacing: 1.05 },
  primaryProduct: { borderWidth: 1, borderRadius: 28, padding: 17, gap: 15, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.11, shadowRadius: 24, elevation: 4 },
  topPickPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  topPickCrown: { fontSize: 9, lineHeight: 12 },
  topPickPillText: { fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 0.75 },
  productIdentity: { flexDirection: "row", alignItems: "center", gap: 15 },
  productArtwork: { overflow: "hidden", width: 104, height: 124, borderWidth: 1, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 2 },
  productImage: { width: 88, height: 108 },
  imageFallback: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  placeholderBottle: { width: 42, height: 50, borderWidth: 1.5, borderRadius: 9, alignItems: "center", justifyContent: "center", gap: 5 },
  placeholderLine: { width: 20, height: 1.5, borderRadius: 1, opacity: 0.45 },
  placeholderLineShort: { width: 14 },
  placeholderBrand: { maxWidth: 88, marginTop: 7, fontSize: 9, lineHeight: 12, fontWeight: "700", textAlign: "center" },
  placeholderHint: { marginTop: 2, fontSize: 8, lineHeight: 11, textAlign: "center" },
  productCopy: { flex: 1, gap: 5 },
  productName: { fontSize: 19, lineHeight: 24, fontWeight: "800", letterSpacing: -0.28 },
  brand: { fontSize: 12, lineHeight: 17, fontWeight: "800" },
  productReason: { marginTop: 5, fontSize: 12, lineHeight: 19, fontWeight: "500" },
  alternativeCard: { borderWidth: 1, borderRadius: 21, padding: 15, gap: 7 },
  alternativeHeading: { flexDirection: "row", alignItems: "center", gap: 9 },
  secondaryRank: { width: 28, height: 28, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  secondaryRankText: { fontSize: 9, fontWeight: "900" },
  microLabel: { fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 0.9 },
  alternativeName: { fontSize: 15, lineHeight: 21, fontWeight: "800" },
  body: { fontSize: 13, lineHeight: 20 },
  compareBlock: { borderTopWidth: StyleSheet.hairlineWidth, gap: 3, paddingTop: 9, marginTop: 2 },
  detailLabel: { fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 0.8 },
  detailText: { fontSize: 12, lineHeight: 19 },
  directionPanel: { overflow: "hidden", borderWidth: 1, borderRadius: 22, paddingHorizontal: 15, paddingVertical: 3 },
  directionRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12 },
  timePill: { minWidth: 42, minHeight: 27, borderWidth: 1, alignItems: "center", justifyContent: "center", borderRadius: 14, paddingHorizontal: 9 },
  timeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.7 },
  directionText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "600", paddingTop: 2 },
  directionDivider: { height: StyleSheet.hairlineWidth, marginLeft: 54 },
  warning: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderRadius: 17, padding: 13 },
  warningDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 19, fontWeight: "600" },
  routinePanel: { borderWidth: 1, borderRadius: 25, padding: 17, gap: 17 },
  routineLane: { gap: 11 },
  routineLaneTitle: { fontSize: 11, lineHeight: 16, fontWeight: "900", letterSpacing: 0.9 },
  timelineRow: { minHeight: 40, flexDirection: "row", alignItems: "flex-start", gap: 11 },
  markerColumn: { width: 27, alignItems: "center", alignSelf: "stretch" },
  marker: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  markerText: { fontSize: 9, fontWeight: "900" },
  timelineLine: { width: 1, flex: 1, minHeight: 15 },
  timelineText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: "600", paddingTop: 2, paddingBottom: 11 },
  routineDivider: { height: StyleSheet.hairlineWidth },
  premiumPanel: { overflow: "hidden", borderWidth: 1, borderRadius: 26, padding: 18, gap: 8, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 2 },
  premiumTitle: { maxWidth: 480, fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.3 },
  primaryButton: { position: "relative", overflow: "hidden", minHeight: 49, borderRadius: 25, alignItems: "center", justifyContent: "center", paddingHorizontal: 18, marginTop: 7, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.22, shadowRadius: 18, elevation: 3 },
  buttonCoralEdge: { position: "absolute", top: 0, bottom: 0, right: 0, width: 44, opacity: 0.36 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  boundary: { fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 10 },
  startOver: { alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 8 },
  startOverText: { fontSize: 12, fontWeight: "800" },
  startOverArrow: { fontSize: 13, fontWeight: "900" }
});
