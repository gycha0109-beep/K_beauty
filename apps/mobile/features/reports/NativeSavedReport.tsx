import { StyleSheet, Text, View } from "react-native";
import { useMobileShell } from "../../lib/mobile-shell";
import { getLocalizedSkinState } from "../../lib/skin-state-i18n";
import type { NativeFreeSavedResult, NativeSavedReportRead } from "./saved-report-client";

const REPORT_COPY = {
  en: {
    free: "Free report",
    premium: "Premium report",
    summary: "Saved summary",
    topPick: "Top Pick",
    concerns: "Main concerns",
    skinType: "Skin type",
    am: "AM routine",
    pm: "PM routine",
    premiumRoutine: "Premium routine",
    functional: "Functional decisions",
    condition: "Condition guidance",
    version: "Version",
    savedAt: "Saved",
    noDetail: "This saved server snapshot has no additional displayable detail.",
    sourceNote: "Some saved guidance is shown in Korean to preserve the original result."
  },
  ko: {
    free: "무료 리포트",
    premium: "프리미엄 리포트",
    summary: "저장된 요약",
    topPick: "Top Pick",
    concerns: "주요 고민",
    skinType: "피부 타입",
    am: "아침 루틴",
    pm: "저녁 루틴",
    premiumRoutine: "프리미엄 루틴",
    functional: "기능성 판단",
    condition: "컨디션 대응",
    version: "버전",
    savedAt: "저장",
    noDetail: "저장된 서버 스냅샷에 추가로 표시할 수 있는 상세 내용이 없습니다.",
    sourceNote: "이 리포트는 한국어로 저장되어 일부 안내가 원문으로 표시됩니다."
  }
} as const;

const DISPLAY_KEYS = new Set([
  "title",
  "label",
  "summary",
  "body",
  "message",
  "reason",
  "reasons",
  "nextAction",
  "action",
  "step",
  "name",
  "instruction",
  "instructions",
  "description"
]);

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeTextArray(value: unknown, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter((item): item is string => Boolean(item)).slice(0, limit);
}

function collectDisplayLines(value: unknown, limit = 8, depth = 0, locale: "ko" | "en" = "ko"): string[] {
  if (depth > 5 || limit <= 0 || value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    const lines: string[] = [];
    for (const item of value) {
      lines.push(...collectDisplayLines(item, limit - lines.length, depth + 1, locale));
      if (lines.length >= limit) break;
    }
    return [...new Set(lines)].slice(0, limit);
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  // Bilingual report fields carry display text, not two independent statements.
  if (Object.hasOwn(record, "ko") || Object.hasOwn(record, "en")) {
    const preferred = locale === "en" ? record.en : record.ko;
    const fallback = locale === "en" ? record.ko : record.en;
    const hasDisplayText = (item: unknown) =>
      (typeof item === "string" && item.trim().length > 0)
      || (Array.isArray(item) && item.length > 0);
    const localized = hasDisplayText(preferred) ? preferred : fallback;
    return collectDisplayLines(localized, limit, depth + 1, locale);
  }
  const lines: string[] = [];
  for (const [key, item] of Object.entries(record)) {
    if (!DISPLAY_KEYS.has(key)) continue;
    lines.push(...collectDisplayLines(item, limit - lines.length, depth + 1, locale));
    if (lines.length >= limit) break;
  }
  if (lines.length) return [...new Set(lines)].slice(0, limit);

  for (const item of Object.values(record)) {
    if (!item || typeof item !== "object") continue;
    lines.push(...collectDisplayLines(item, limit - lines.length, depth + 1, locale));
    if (lines.length >= limit) break;
  }
  return [...new Set(lines)].slice(0, limit);
}

function getProduct(result: NativeFreeSavedResult | Record<string, unknown> | null | undefined, locale: "ko" | "en") {
  const raw = result && typeof result === "object" ? (result as Record<string, unknown>).topPick : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const product = raw as Record<string, unknown>;
  const name = (locale === "en" ? normalizeText(product.name_en) || normalizeText(product.nameEn) : null) || normalizeText(product.name);
  const brand = (locale === "en" ? normalizeText(product.brand_en) || normalizeText(product.brandEn) : null) || normalizeText(product.brand);
  const reason = normalizeText(product.reason);
  if (!name && !brand && !reason) return null;
  return { name, brand, reason };
}

function formatDate(value: string | null, locale: "ko" | "en") {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function Section({ title, lines }: { title: string; lines: string[] }) {
  const { palette } = useMobileShell();
  if (!lines.length) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.text }]}>{title}</Text>
      {lines.map((line, index) => (
        <Text key={`${title}-${index}`} style={[styles.body, { color: palette.textMuted }]}>• {line}</Text>
      ))}
    </View>
  );
}

function FreeSnapshot({ result }: { result: NativeFreeSavedResult }) {
  const { locale, palette } = useMobileShell();
  const copy = REPORT_COPY[locale];
  const topPick = getProduct(result, locale);
  const am = normalizeTextArray(result.routineAm);
  const pm = normalizeTextArray(result.routinePm);
  const concerns = normalizeTextArray(result.mainConcerns, 5).map((value) => getLocalizedSkinState(value, "concerns", locale));

  return (
    <View style={styles.stack}>
      {normalizeText(result.summary) ? (
        <View style={styles.section} testID="native-saved-report-summary">
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.summary}</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>{normalizeText(result.summary)}</Text>
        </View>
      ) : null}
      {normalizeText(result.skinType) ? <Section title={copy.skinType} lines={[getLocalizedSkinState(result.skinType, "skinTypes", locale)]} /> : null}
      <Section title={copy.concerns} lines={concerns} />
      {topPick ? (
        <View style={styles.section} testID="native-saved-report-top-pick">
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.topPick}</Text>
          <Text style={[styles.product, { color: palette.text }]}>{[topPick.brand, topPick.name].filter(Boolean).join(" · ")}</Text>
          {topPick.reason ? <Text style={[styles.body, { color: palette.textMuted }]}>{topPick.reason}</Text> : null}
        </View>
      ) : null}
      <Section title={copy.am} lines={am} />
      <Section title={copy.pm} lines={pm} />
    </View>
  );
}

function PremiumSnapshot({ report }: { report: Record<string, unknown> }) {
  const { locale } = useMobileShell();
  const copy = REPORT_COPY[locale];
  const freeResult = report.freeResult && typeof report.freeResult === "object" && !Array.isArray(report.freeResult)
    ? report.freeResult as NativeFreeSavedResult
    : null;
  const routineLines = collectDisplayLines(report.fullRoutine, 10, 0, locale);
  const functionalLines = collectDisplayLines(report.functionalDecisions, 10, 0, locale);
  const conditionLines = collectDisplayLines(report.conditionResponses, 10, 0, locale);
  const hasPremiumDetail = routineLines.length || functionalLines.length || conditionLines.length;

  return (
    <View style={styles.stack}>
      {freeResult ? <FreeSnapshot result={freeResult} /> : null}
      <Section title={copy.premiumRoutine} lines={routineLines} />
      <Section title={copy.functional} lines={functionalLines} />
      <Section title={copy.condition} lines={conditionLines} />
      {!freeResult && !hasPremiumDetail ? <Section title={copy.premium} lines={[copy.noDetail]} /> : null}
    </View>
  );
}

export function NativeSavedReport({ value }: { value: NativeSavedReportRead }) {
  const { locale, palette } = useMobileShell();
  const copy = REPORT_COPY[locale];
  const savedDate = formatDate(value.metadata.createdAt, locale);
  const reportLabel = value.kind === "premium" ? copy.premium : copy.free;
  const premiumMeta = value.kind === "premium" && value.report.meta && typeof value.report.meta === "object"
    ? value.report.meta as Record<string, unknown>
    : null;
  const reportLocale = value.kind === "free"
    ? value.result.locale
    : typeof premiumMeta?.sourceLocale === "string"
      ? premiumMeta.sourceLocale
      : typeof premiumMeta?.locale === "string"
        ? premiumMeta.locale
        : value.kind === "premium" && typeof value.report.locale === "string"
          ? value.report.locale
          : null;

  const guidanceLines = value.kind === "free"
    ? [value.result.summary, ...(value.result.routineAm || []), ...(value.result.routinePm || [])]
    : collectDisplayLines({
        fullRoutine: value.report.fullRoutine,
        functionalDecisions: value.report.functionalDecisions,
        conditionResponses: value.report.conditionResponses
      }, 24, 0, locale);
  const containsKoreanGuidance = guidanceLines.some((line) => typeof line === "string" && /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(line));

  return (
    <View testID="native-saved-report" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>{reportLabel}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{value.metadata.title || reportLabel}</Text>
        {locale === "en" && (reportLocale === "ko" || containsKoreanGuidance) ? (
          <Text style={[styles.body, { color: palette.textMuted }]}>{copy.sourceNote}</Text>
        ) : null}
        <View style={styles.metaRow}>
          {value.metadata.reportVersion ? <Text style={[styles.meta, { color: palette.textMuted }]}>{copy.version} · {value.metadata.reportVersion}</Text> : null}
          {savedDate ? <Text style={[styles.meta, { color: palette.textMuted }]}>{copy.savedAt} · {savedDate}</Text> : null}
        </View>
      </View>
      {value.kind === "free" ? <FreeSnapshot result={value.result} /> : <PremiumSnapshot report={value.report} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 20 },
  header: { gap: 6 },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  meta: { fontSize: 12, lineHeight: 18 },
  stack: { gap: 18 },
  section: { gap: 6 },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  body: { fontSize: 14, lineHeight: 21 },
  product: { fontSize: 15, lineHeight: 22, fontWeight: "700" }
});
