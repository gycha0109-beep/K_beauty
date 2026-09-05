import type { SupportedLocale } from "@bejewely/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { NativeMyDashboard } from "../../lib/my";

type Palette = Readonly<{
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}>;

const COPY = {
  en: { profile: "Active skin profile", skinType: "Skin type", concerns: "Concerns", sensitivity: "Sensitivity", recent: "Recent 7 days", diary: "Skin diary", saved: "Latest saved report", noValue: "Not recorded", noEntries: "No check-ins in this month.", dryness: "Dryness", redness: "Redness", breakout: "Breakouts", signedIn: "Signed in", previous: "Previous month", next: "Next month" },
  ko: { profile: "현재 피부 프로필", skinType: "피부 타입", concerns: "고민", sensitivity: "민감도", recent: "최근 7일", diary: "스킨 다이어리", saved: "최근 저장 리포트", noValue: "기록 없음", noEntries: "이 달에는 체크인 기록이 없습니다.", dryness: "건조함", redness: "붉음", breakout: "트러블", signedIn: "로그인 상태", previous: "이전 달", next: "다음 달" }
} as const;

export function NativeMyDiaryView({ locale, dashboard, palette, showSignedInState = false, onDiaryDay, onPreviousMonth, onNextMonth, canNextMonth = false }: {
  locale: SupportedLocale;
  dashboard: NativeMyDashboard;
  palette: Palette;
  showSignedInState?: boolean;
  onDiaryDay?: (date: string) => void;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  canNextMonth?: boolean;
}) {
  const copy = COPY[locale];
  const profile = dashboard.latestSkinProfile;
  const recent = dashboard.recentTrendCheckins.slice(0, 3);
  const diary = dashboard.monthlyDiaryCheckins.slice(0, 4);
  const report = dashboard.latestSavedReport;
  const diaryRow = (checkin: NativeMyDashboard["monthlyDiaryCheckins"][number]) => (
    <View style={[styles.diaryRow, { borderColor: palette.border }]}>
      <Text style={[styles.diaryDate, { color: palette.text }]}>{checkin.checkin_date}</Text>
      <Text style={[styles.body, { color: palette.textMuted }]}>{checkin.memo || `${copy.dryness} ${checkin.dryness_level} · ${copy.redness} ${checkin.redness_level}`}</Text>
    </View>
  );

  return (
    <View testID="native-my-diary-view" style={styles.stack}>
      {showSignedInState ? <View style={[styles.statusPill, { backgroundColor: palette.surfaceMuted, borderColor: palette.border }]}><Text style={[styles.statusText, { color: palette.accent }]}>{copy.signedIn}</Text></View> : null}
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.profile}</Text>
        <Text style={[styles.body, { color: palette.textMuted }]}>{copy.skinType} · {profile?.skin_type || copy.noValue}</Text>
        <Text style={[styles.body, { color: palette.textMuted }]}>{copy.concerns} · {profile?.concerns?.filter(Boolean).join(", ") || copy.noValue}</Text>
        <Text style={[styles.body, { color: palette.textMuted }]}>{copy.sensitivity} · {profile?.sensitivity_level || copy.noValue}</Text>
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.recent}</Text>
        {recent.length ? recent.map((checkin) => <Text key={checkin.id} style={[styles.body, { color: palette.textMuted }]}>{checkin.checkin_date} · {copy.dryness} {checkin.dryness_level} · {copy.redness} {checkin.redness_level} · {copy.breakout} {checkin.breakout_level}</Text>) : <Text style={[styles.body, { color: palette.textMuted }]}>{copy.noEntries}</Text>}
      </View>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.diary}</Text><Text style={[styles.meta, { color: palette.textMuted }]}>{dashboard.diaryMonth}</Text></View>
        {onPreviousMonth || onNextMonth ? <View style={styles.monthControls}>
          <Pressable disabled={!onPreviousMonth} onPress={onPreviousMonth} style={[styles.monthButton, { borderColor: palette.border }]}><Text style={[styles.buttonText, { color: palette.text }]}>{copy.previous}</Text></Pressable>
          <Pressable disabled={!onNextMonth || !canNextMonth} onPress={onNextMonth} style={[styles.monthButton, { borderColor: palette.border, opacity: canNextMonth ? 1 : 0.4 }]}><Text style={[styles.buttonText, { color: palette.text }]}>{copy.next}</Text></Pressable>
        </View> : null}
        {diary.length ? diary.map((checkin) => onDiaryDay ? <Pressable key={checkin.id} onPress={() => onDiaryDay(checkin.checkin_date)}>{diaryRow(checkin)}</Pressable> : <View key={checkin.id}>{diaryRow(checkin)}</View>) : <Text style={[styles.body, { color: palette.textMuted }]}>{copy.noEntries}</Text>}
      </View>
      {report ? <View testID="native-my-latest-saved-report" style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.sectionTitle, { color: palette.text }]}>{copy.saved}</Text><Text style={[styles.reportTitle, { color: palette.text }]}>{report.title || report.report_type || "Skin Match"}</Text>{report.created_at ? <Text style={[styles.meta, { color: palette.textMuted }]}>{report.created_at.slice(0, 10)}</Text> : null}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 }, statusPill: { alignSelf: "flex-start", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }, statusText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 7 }, sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: "800" }, body: { fontSize: 13, lineHeight: 19 }, rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, meta: { fontSize: 12, lineHeight: 18 }, diaryRow: { borderTopWidth: 1, paddingTop: 8, gap: 2 }, diaryDate: { fontSize: 13, lineHeight: 18, fontWeight: "700" }, reportTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" }, monthControls: { flexDirection: "row", gap: 8 }, monthButton: { flex: 1, minHeight: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 8 }, buttonText: { fontSize: 12, fontWeight: "700" }
});
