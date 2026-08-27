import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import {
  getNativeSession,
  signInNativeWithGoogle,
  signOutNative,
  subscribeNativeAuth
} from "../lib/auth";
import { MOBILE_COPY } from "../lib/copy";
import { useMobileShell } from "../lib/mobile-shell";
import { getMobileSupabaseClient } from "../lib/supabase";
import {
  CHECKIN_EVENT_KEYS,
  CHECKIN_LEVEL_KEYS,
  createNativeCheckinFromExisting,
  fetchNativeDiaryDay,
  fetchNativeMyDashboard,
  getNativeDiaryMonth,
  getNativeLocalDate,
  saveNativeCheckin,
  shiftNativeDiaryMonth,
  type CheckinEventKey,
  type CheckinLevelKey,
  type NativeCheckinInput,
  type NativeDiaryDay,
  type NativeMyDashboard,
  type NativeRoutineLog
} from "../lib/my";

type AuthStatus = "loading" | "unconfigured" | "signed-out" | "signing-in" | "signed-in" | "error";

const MY_DIARY_COPY = {
  en: {
    profile: "Active skin profile",
    skinType: "Skin type",
    concerns: "Concerns",
    sensitivity: "Sensitivity",
    noValue: "Not recorded",
    checkinTitle: "Today's check-in",
    checkinBody: "Record only what changed today. The server keeps the same diary and routine authority used by Web.",
    levels: {
      dryness_level: "Dryness",
      oiliness_level: "Oiliness",
      redness_level: "Redness",
      breakout_level: "Breakouts",
      irritation_level: "Irritation"
    },
    levelLow: "Low",
    levelHigh: "High",
    makeup: "Makeup today",
    outdoor: "Outdoor today",
    eventsTitle: "Context",
    events: {
      newProductUsed: "New product",
      activeProductUsed: "Active ingredient",
      exfoliationUsed: "Exfoliation",
      moisturizerSkipped: "Skipped moisturizer",
      sleepDeprived: "Low sleep",
      workoutOrSweat: "Workout / sweat"
    },
    memo: "Memo",
    memoPlaceholder: "Anything worth remembering today",
    save: "Save check-in",
    saving: "Saving…",
    saved: "Check-in saved",
    saveFailed: "Could not save the check-in.",
    routineTitle: "Today's routine",
    noRoutine: "A routine appears after a check-in is saved.",
    recentTitle: "Recent 7 days",
    diaryTitle: "Skin diary",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    noEntries: "No check-ins in this month.",
    dayDetail: "Diary detail",
    closeDetail: "Close detail",
    detailLoading: "Loading diary detail…",
    detailFailed: "Could not load that diary day.",
    noProfile: "Create a skin profile through Skin Match before using the diary.",
    reload: "Reload",
    dashboardFailed: "The My / Skin Diary API is unavailable.",
    routineSections: {
      am_routine: "AM",
      pm_routine: "PM",
      keep_items: "Keep",
      reduce_items: "Reduce",
      avoid_items: "Avoid",
      warnings: "Warnings"
    }
  },
  ko: {
    profile: "현재 피부 프로필",
    skinType: "피부 타입",
    concerns: "고민",
    sensitivity: "민감도",
    noValue: "기록 없음",
    checkinTitle: "오늘 체크인",
    checkinBody: "오늘 달라진 조건만 기록합니다. Web과 동일한 서버 다이어리·루틴 권한을 그대로 사용합니다.",
    levels: {
      dryness_level: "건조함",
      oiliness_level: "유분",
      redness_level: "붉음",
      breakout_level: "트러블",
      irritation_level: "자극감"
    },
    levelLow: "낮음",
    levelHigh: "높음",
    makeup: "오늘 메이크업",
    outdoor: "오늘 야외활동",
    eventsTitle: "오늘의 맥락",
    events: {
      newProductUsed: "새 제품 사용",
      activeProductUsed: "기능성 성분 사용",
      exfoliationUsed: "각질 관리",
      moisturizerSkipped: "보습제 생략",
      sleepDeprived: "수면 부족",
      workoutOrSweat: "운동 / 땀"
    },
    memo: "메모",
    memoPlaceholder: "오늘 기억해둘 변화가 있다면 적어주세요",
    save: "체크인 저장",
    saving: "저장 중…",
    saved: "체크인을 저장했습니다",
    saveFailed: "체크인을 저장하지 못했습니다.",
    routineTitle: "오늘 루틴",
    noRoutine: "체크인을 저장하면 오늘 루틴이 생성됩니다.",
    recentTitle: "최근 7일",
    diaryTitle: "스킨 다이어리",
    previousMonth: "이전 달",
    nextMonth: "다음 달",
    noEntries: "이 달에는 체크인 기록이 없습니다.",
    dayDetail: "다이어리 상세",
    closeDetail: "상세 닫기",
    detailLoading: "다이어리 상세 불러오는 중…",
    detailFailed: "해당 날짜의 다이어리를 불러오지 못했습니다.",
    noProfile: "Skin Match에서 피부 프로필을 만든 뒤 다이어리를 사용할 수 있습니다.",
    reload: "다시 불러오기",
    dashboardFailed: "My / Skin Diary API를 사용할 수 없습니다.",
    routineSections: {
      am_routine: "아침",
      pm_routine: "저녁",
      keep_items: "유지",
      reduce_items: "줄이기",
      avoid_items: "피하기",
      warnings: "주의"
    }
  }
} as const;

function toDisplayItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (!item || typeof item !== "object") return "";
      const record = item as Record<string, unknown>;
      for (const key of ["label", "name", "title", "action", "step", "product_name", "productName"]) {
        if (typeof record[key] === "string" && record[key]) return String(record[key]);
      }
      return "";
    })
    .filter(Boolean)
    .slice(0, 6);
}

function RoutineView({ routine, copy, palette }: {
  routine: NativeRoutineLog | null;
  copy: (typeof MY_DIARY_COPY)["ko"] | (typeof MY_DIARY_COPY)["en"];
  palette: ReturnType<typeof useMobileShell>["palette"];
}) {
  if (!routine) {
    return <Text style={[styles.bodyText, { color: palette.textMuted }]}>{copy.noRoutine}</Text>;
  }

  const sectionKeys = ["am_routine", "pm_routine", "keep_items", "reduce_items", "avoid_items", "warnings"] as const;
  const sections = sectionKeys
    .map((key) => ({ key, items: toDisplayItems(routine[key]) }))
    .filter((section) => section.items.length > 0);

  if (sections.length === 0) {
    return <Text style={[styles.bodyText, { color: palette.textMuted }]}>{copy.noRoutine}</Text>;
  }

  return (
    <View style={styles.stackSmall}>
      {sections.map((section) => (
        <View key={section.key}>
          <Text style={[styles.subheading, { color: palette.text }]}>{copy.routineSections[section.key]}</Text>
          {section.items.map((item, index) => (
            <Text key={`${section.key}-${index}`} style={[styles.bodyText, { color: palette.textMuted }]}>• {item}</Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export default function MyScreen() {
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].my;
  const diaryCopy = MY_DIARY_COPY[locale];
  const today = useMemo(() => getNativeLocalDate(), []);
  const currentMonth = useMemo(() => getNativeDiaryMonth(), []);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<NativeMyDashboard | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [form, setForm] = useState<NativeCheckinInput>(() => createNativeCheckinFromExisting(null));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dashboardError, setDashboardError] = useState(false);
  const [detail, setDetail] = useState<NativeDiaryDay | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");

  async function loadDashboard(activeSession: Session, month = selectedMonth) {
    setDashboardError(false);
    try {
      const nextDashboard = await fetchNativeMyDashboard(activeSession, { localDate: today, diaryMonth: month });
      setDashboard(nextDashboard);
      setForm(createNativeCheckinFromExisting(nextDashboard.todayCheckin));
    } catch {
      setDashboardError(true);
    }
  }

  useEffect(() => {
    if (!getMobileSupabaseClient()) {
      setStatus("unconfigured");
      return;
    }

    let active = true;

    async function applySession(nextSession: Session | null) {
      if (!active) return;
      setSession(nextSession);
      setDashboard(null);
      setDetail(null);
      setDashboardError(false);

      if (!nextSession) {
        setStatus("signed-out");
        return;
      }

      setStatus("signed-in");
      try {
        const nextDashboard = await fetchNativeMyDashboard(nextSession, { localDate: today, diaryMonth: currentMonth });
        if (active) {
          setSelectedMonth(currentMonth);
          setDashboard(nextDashboard);
          setForm(createNativeCheckinFromExisting(nextDashboard.todayCheckin));
        }
      } catch {
        if (active) setDashboardError(true);
      }
    }

    getNativeSession().then(applySession).catch(() => active && setStatus("error"));
    const subscription = subscribeNativeAuth((nextSession) => void applySession(nextSession));

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, [currentMonth, today]);

  async function handleSignIn() {
    setStatus("signing-in");
    try {
      await signInNativeWithGoogle();
    } catch {
      setStatus("error");
    }
  }

  async function handleSignOut() {
    try {
      await signOutNative();
      setSession(null);
      setDashboard(null);
      setDetail(null);
      setStatus("signed-out");
    } catch {
      setStatus("error");
    }
  }

  async function handleMonth(delta: number) {
    if (!session) return;
    const nextMonth = shiftNativeDiaryMonth(selectedMonth, delta);
    if (nextMonth > currentMonth) return;
    setSelectedMonth(nextMonth);
    setDetail(null);
    await loadDashboard(session, nextMonth);
  }

  function updateLevel(key: CheckinLevelKey, value: number) {
    setSaveState("idle");
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleEvent(key: CheckinEventKey) {
    setSaveState("idle");
    setForm((current) => ({
      ...current,
      checkinEvents: { ...current.checkinEvents, [key]: !current.checkinEvents[key] }
    }));
  }

  async function handleSaveCheckin() {
    if (!session || !dashboard?.hasProfile) return;
    setSaveState("saving");
    try {
      await saveNativeCheckin(session, { ...form, checkinDate: today });
      await loadDashboard(session, selectedMonth);
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  async function handleDiaryDay(date: string) {
    if (!session) return;
    setDetailState("loading");
    setDetail(null);
    try {
      const nextDetail = await fetchNativeDiaryDay(session, date);
      setDetail(nextDetail);
      setDetailState("idle");
    } catch {
      setDetailState("error");
    }
  }

  let statusText = copy.signedOut;
  if (status === "loading") statusText = copy.loading;
  else if (status === "unconfigured") statusText = copy.authUnavailable;
  else if (status === "signing-in") statusText = copy.signingIn;
  else if (status === "error") statusText = copy.authFailed;
  else if (session) statusText = session.user.email ? `${copy.signedIn} · ${session.user.email}` : copy.signedIn;

  return (
    <ScreenShell eyebrow="MY · MOBILE-3" title={copy.title} description={copy.description}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.status, { color: palette.text }]}>{statusText}</Text>
        {!session && status !== "loading" && status !== "unconfigured" ? (
          <Pressable accessibilityRole="button" accessibilityLabel="mobile-google-sign-in" disabled={status === "signing-in"} onPress={handleSignIn}
            style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent, opacity: pressed || status === "signing-in" ? 0.72 : 1 }]}>
            <Text style={[styles.primaryButtonText, { color: palette.background }]}>{status === "signing-in" ? copy.signingIn : copy.signInGoogle}</Text>
          </Pressable>
        ) : null}
        {session ? (
          <Pressable accessibilityRole="button" accessibilityLabel="mobile-sign-out" onPress={handleSignOut}
            style={({ pressed }) => [styles.secondaryButton, { borderColor: palette.border, opacity: pressed ? 0.72 : 1 }]}>
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>{copy.signOut}</Text>
          </Pressable>
        ) : null}
      </View>

      {session && dashboardError ? (
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.dashboardFailed}</Text>
          <Pressable onPress={() => void loadDashboard(session)} style={[styles.secondaryButton, { borderColor: palette.border }]}>
            <Text style={[styles.secondaryButtonText, { color: palette.text }]}>{diaryCopy.reload}</Text>
          </Pressable>
        </View>
      ) : null}

      {session && dashboard ? (
        <>
          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.profile}</Text>
            {dashboard.latestSkinProfile ? (
              <View style={styles.stackSmall}>
                <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.skinType} · {dashboard.latestSkinProfile.skin_type || diaryCopy.noValue}</Text>
                <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.concerns} · {dashboard.latestSkinProfile.concerns?.filter(Boolean).join(", ") || diaryCopy.noValue}</Text>
                <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.sensitivity} · {dashboard.latestSkinProfile.sensitivity_level || diaryCopy.noValue}</Text>
              </View>
            ) : <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.noProfile}</Text>}
          </View>

          {dashboard.hasProfile ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.checkinTitle}</Text>
              <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.checkinBody}</Text>
              {CHECKIN_LEVEL_KEYS.map((key) => (
                <View key={key} style={styles.levelBlock}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.subheading, { color: palette.text }]}>{diaryCopy.levels[key]}</Text>
                    <Text style={[styles.bodyText, { color: palette.textMuted }]}>{form[key]} / 4</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {[0, 1, 2, 3, 4].map((value) => {
                      const selected = form[key] === value;
                      return (
                        <Pressable key={value} accessibilityRole="button" onPress={() => updateLevel(key, value)}
                          style={[styles.levelChip, { borderColor: selected ? palette.accent : palette.border, backgroundColor: selected ? palette.surfaceMuted : palette.surface }]}>
                          <Text style={[styles.levelChipText, { color: selected ? palette.accent : palette.textMuted }]}>{value}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.rowBetween}><Text style={[styles.hint, { color: palette.textMuted }]}>{diaryCopy.levelLow}</Text><Text style={[styles.hint, { color: palette.textMuted }]}>{diaryCopy.levelHigh}</Text></View>
                </View>
              ))}

              <Text style={[styles.subheading, { color: palette.text }]}>{diaryCopy.eventsTitle}</Text>
              <View style={styles.chipRow}>
                <Pressable onPress={() => setForm((current) => ({ ...current, makeup_today: !current.makeup_today }))}
                  style={[styles.toggleChip, { borderColor: form.makeup_today ? palette.accent : palette.border, backgroundColor: form.makeup_today ? palette.surfaceMuted : palette.surface }]}>
                  <Text style={[styles.toggleText, { color: form.makeup_today ? palette.accent : palette.text }]}>{diaryCopy.makeup}</Text>
                </Pressable>
                <Pressable onPress={() => setForm((current) => ({ ...current, outdoor_today: !current.outdoor_today }))}
                  style={[styles.toggleChip, { borderColor: form.outdoor_today ? palette.accent : palette.border, backgroundColor: form.outdoor_today ? palette.surfaceMuted : palette.surface }]}>
                  <Text style={[styles.toggleText, { color: form.outdoor_today ? palette.accent : palette.text }]}>{diaryCopy.outdoor}</Text>
                </Pressable>
                {CHECKIN_EVENT_KEYS.map((key) => (
                  <Pressable key={key} onPress={() => toggleEvent(key)}
                    style={[styles.toggleChip, { borderColor: form.checkinEvents[key] ? palette.accent : palette.border, backgroundColor: form.checkinEvents[key] ? palette.surfaceMuted : palette.surface }]}>
                    <Text style={[styles.toggleText, { color: form.checkinEvents[key] ? palette.accent : palette.text }]}>{diaryCopy.events[key]}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.subheading, { color: palette.text }]}>{diaryCopy.memo}</Text>
              <TextInput multiline maxLength={1000} value={form.memo} placeholder={diaryCopy.memoPlaceholder} placeholderTextColor={palette.textMuted}
                onChangeText={(memo) => { setSaveState("idle"); setForm((current) => ({ ...current, memo })); }}
                style={[styles.memoInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
              <Pressable accessibilityRole="button" accessibilityLabel="mobile-checkin-save" disabled={saveState === "saving"} onPress={handleSaveCheckin}
                style={({ pressed }) => [styles.primaryButton, { backgroundColor: palette.accent, opacity: pressed || saveState === "saving" ? 0.72 : 1 }]}>
                <Text style={[styles.primaryButtonText, { color: palette.background }]}>{saveState === "saving" ? diaryCopy.saving : diaryCopy.save}</Text>
              </Pressable>
              {saveState === "saved" ? <Text style={[styles.hint, { color: palette.accent }]}>{diaryCopy.saved}</Text> : null}
              {saveState === "error" ? <Text style={[styles.hint, { color: palette.textMuted }]}>{diaryCopy.saveFailed}</Text> : null}
            </View>
          ) : null}

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.routineTitle}</Text>
            <RoutineView routine={dashboard.todayRoutine} copy={diaryCopy} palette={palette} />
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.recentTitle}</Text>
            {dashboard.recentTrendCheckins.length ? dashboard.recentTrendCheckins.map((checkin) => (
              <Text key={checkin.id} style={[styles.bodyText, { color: palette.textMuted }]}>
                {checkin.checkin_date} · {diaryCopy.levels.dryness_level} {checkin.dryness_level} · {diaryCopy.levels.redness_level} {checkin.redness_level} · {diaryCopy.levels.breakout_level} {checkin.breakout_level}
              </Text>
            )) : <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.noEntries}</Text>}
          </View>

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.rowBetween}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.diaryTitle}</Text>
              <Text style={[styles.subheading, { color: palette.textMuted }]}>{selectedMonth}</Text>
            </View>
            <View style={styles.monthControls}>
              <Pressable onPress={() => void handleMonth(-1)} style={[styles.monthButton, { borderColor: palette.border }]}><Text style={[styles.toggleText, { color: palette.text }]}>{diaryCopy.previousMonth}</Text></Pressable>
              <Pressable disabled={selectedMonth >= currentMonth} onPress={() => void handleMonth(1)} style={[styles.monthButton, { borderColor: palette.border, opacity: selectedMonth >= currentMonth ? 0.4 : 1 }]}><Text style={[styles.toggleText, { color: palette.text }]}>{diaryCopy.nextMonth}</Text></Pressable>
            </View>
            {dashboard.monthlyDiaryCheckins.length ? dashboard.monthlyDiaryCheckins.map((checkin) => (
              <Pressable key={checkin.id} accessibilityRole="button" onPress={() => void handleDiaryDay(checkin.checkin_date)}
                style={[styles.diaryRow, { borderColor: palette.border }]}>
                <Text style={[styles.subheading, { color: palette.text }]}>{checkin.checkin_date}</Text>
                <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.levels.dryness_level} {checkin.dryness_level} · {diaryCopy.levels.oiliness_level} {checkin.oiliness_level} · {diaryCopy.levels.irritation_level} {checkin.irritation_level}</Text>
              </Pressable>
            )) : <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.noEntries}</Text>}
          </View>

          {detailState === "loading" ? <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.detailLoading}</Text> : null}
          {detailState === "error" ? <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.detailFailed}</Text> : null}
          {detail ? (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.dayDetail} · {detail.date}</Text>
                <Pressable onPress={() => setDetail(null)}><Text style={[styles.toggleText, { color: palette.accent }]}>{diaryCopy.closeDetail}</Text></Pressable>
              </View>
              {CHECKIN_LEVEL_KEYS.map((key) => <Text key={key} style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.levels[key]} · {detail.checkin[key]} / 4</Text>)}
              {detail.checkin.memo ? <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.memo} · {detail.checkin.memo}</Text> : null}
              <RoutineView routine={detail.routine} copy={diaryCopy} palette={palette} />
            </View>
          ) : null}
        </>
      ) : null}

      <Text style={[styles.notice, { color: palette.textMuted }]}>{copy.notice}</Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 },
  status: { fontSize: 16, fontWeight: "700" },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  subheading: { fontSize: 14, fontWeight: "700", lineHeight: 20 },
  bodyText: { fontSize: 14, lineHeight: 21 },
  hint: { fontSize: 12, lineHeight: 18 },
  stackSmall: { gap: 8 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  primaryButton: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: 18 },
  primaryButtonText: { fontSize: 15, fontWeight: "700" },
  secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 },
  secondaryButtonText: { fontSize: 15, fontWeight: "600" },
  levelBlock: { gap: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  levelChip: { width: 42, minHeight: 38, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 },
  levelChipText: { fontSize: 14, fontWeight: "800" },
  toggleChip: { minHeight: 38, justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  toggleText: { fontSize: 13, fontWeight: "700" },
  memoInput: { minHeight: 96, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: "top" },
  monthControls: { flexDirection: "row", gap: 8 },
  monthButton: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 8 },
  diaryRow: { borderTopWidth: 1, paddingTop: 12, gap: 4 },
  notice: { fontSize: 14, lineHeight: 21 }
});
