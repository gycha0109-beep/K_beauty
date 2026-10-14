import { StyleSheet, Text, View } from "react-native";
import { useMobileShell } from "../../lib/mobile-shell";
import type { NativeFreeSavedResult, NativeSavedReportRead } from "./saved-report-client";
import { resolveSkinPhotoDisplayState } from "./skin-photo-evidence-status";

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
    photoEvidence: "Photo evidence",
    version: "Version",
    savedAt: "Saved",
    noDetail: "This saved server snapshot has no additional displayable detail."
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
    photoEvidence: "사진 관찰 근거",
    version: "버전",
    savedAt: "저장",
    noDetail: "저장된 서버 스냅샷에 추가로 표시할 수 있는 상세 내용이 없습니다."
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

function collectDisplayLines(value: unknown, limit = 8, depth = 0): string[] {
  if (depth > 5 || limit <= 0 || value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) {
    const lines: string[] = [];
    for (const item of value) {
      lines.push(...collectDisplayLines(item, limit - lines.length, depth + 1));
      if (lines.length >= limit) break;
    }
    return [...new Set(lines)].slice(0, limit);
  }
  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const lines: string[] = [];
  for (const [key, item] of Object.entries(record)) {
    if (!DISPLAY_KEYS.has(key)) continue;
    lines.push(...collectDisplayLines(item, limit - lines.length, depth + 1));
    if (lines.length >= limit) break;
  }
  if (lines.length) return [...new Set(lines)].slice(0, limit);

  for (const item of Object.values(record)) {
    if (!item || typeof item !== "object") continue;
    lines.push(...collectDisplayLines(item, limit - lines.length, depth + 1));
    if (lines.length >= limit) break;
  }
  return [...new Set(lines)].slice(0, limit);
}

function getProduct(result: NativeFreeSavedResult | Record<string, unknown> | null | undefined) {
  const raw = result && typeof result === "object" ? (result as Record<string, unknown>).topPick : null;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const product = raw as Record<string, unknown>;
  const name = normalizeText(product.name);
  const brand = normalizeText(product.brand);
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
  const topPick = getProduct(result);
  const am = normalizeTextArray(result.routineAm);
  const pm = normalizeTextArray(result.routinePm);
  const concerns = normalizeTextArray(result.mainConcerns, 5);

  return (
    <View style={styles.stack}>
      {normalizeText(result.summary) ? (
        <View style={styles.section} testID="native-saved-report-summary">
          <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.summary}</Text>
          <Text style={[styles.body, { color: palette.textMuted }]}>{normalizeText(result.summary)}</Text>
        </View>
      ) : null}
      {normalizeText(result.skinType) ? <Section title={copy.skinType} lines={[normalizeText(result.skinType)!]} /> : null}
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

function getSkinPhotoEvidenceLines(report: Record<string, unknown>, locale: "ko" | "en") {
  const state = resolveSkinPhotoDisplayState(report);
  const copy = locale === "en"
    ? {
        available: "Photo observations were considered as supporting visual cues, not a skin diagnosis.",
        not_provided: "There is no photo evidence in this report. Survey and product-use context are primary.",
        unavailable: "Photo processing did not complete. Do not treat survey-only fallback text as photo evidence.",
        ineligible: "The image was not suitable for skin observation. Photo-based judgment is on hold.",
        insufficient_evidence: "The photo did not support a reliable skin observation. Survey evidence is prioritized.",
        unknown: "Photo evidence status cannot be verified from this saved report.",
        conflict: "Saved photo-status records disagree. Photo interpretation should be held pending recheck.",
        limited: "Individual photo cues have insufficient confidence detail for a stronger claim."
      }
    : {
        available: "사진에서 관찰한 시각적 단서는 보조 근거이며 피부 상태를 진단한 결과가 아닙니다.",
        not_provided: "이 리포트에는 사진 근거가 없습니다. 설문과 현재 사용 정보가 우선입니다.",
        unavailable: "사진 분석이 완료되지 않았습니다. 설문용 대체 문구를 사진 관찰 결과로 보지 않습니다.",
        ineligible: "피부를 관찰하기에 적합하지 않은 사진이어서 사진 기반 판단을 보류했습니다.",
        insufficient_evidence: "사진에서 신뢰할 만한 피부 단서가 부족해 설문 근거를 우선했습니다.",
        unknown: "이 저장 리포트에서 사진 분석 상태를 확인할 수 없습니다.",
        conflict: "저장된 사진 상태 기록이 서로 일치하지 않아 사진 판단을 보류하고 재확인해야 합니다.",
        limited: "개별 피부 관찰 신호의 신뢰도 근거가 부족하므로 단정할 수 없습니다."
      };
  if (state.statusConflict) return [copy.conflict];
  return [
    copy[state.status],
    ...(state.status === "available" && state.highOrMediumObservationCount === 0 ? [copy.limited] : [])
  ];
}

function PremiumSnapshot({ report }: { report: Record<string, unknown> }) {
  const { locale } = useMobileShell();
  const copy = REPORT_COPY[locale];
  const freeResult = report.freeResult && typeof report.freeResult === "object" && !Array.isArray(report.freeResult)
    ? report.freeResult as NativeFreeSavedResult
    : null;
  const routineLines = collectDisplayLines(report.fullRoutine, 10);
  const functionalLines = collectDisplayLines(report.functionalDecisions, 10);
  const conditionLines = collectDisplayLines(report.conditionResponses, 10);
  const hasPremiumDetail = routineLines.length || functionalLines.length || conditionLines.length;

  return (
    <View style={styles.stack}>
      {freeResult ? <FreeSnapshot result={freeResult} /> : null}
      <Section title={copy.photoEvidence} lines={getSkinPhotoEvidenceLines(report, locale)} />
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

  return (
    <View testID="native-saved-report" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.kicker, { color: palette.accent }]}>{reportLabel}</Text>
        <Text style={[styles.title, { color: palette.text }]}>{value.metadata.title || reportLabel}</Text>
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
