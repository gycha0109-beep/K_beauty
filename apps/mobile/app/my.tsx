import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/auth-js";
import { useIsFocused } from "expo-router";
import { Alert, AppState, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ScreenShell } from "../components/ScreenShell";
import { NativeAppleSignInButton } from "../components/NativeAppleSignInButton";
import { NativeMyDiaryView } from "../features/my/NativeMyDiaryView";
import { observeNativeSession, signInNativeWithApple, signInNativeWithGoogle, signOutNative } from "../lib/auth";
import { createNativeRequestScope } from "../lib/request-scope";
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

const MY_COPY = {
  en: {
    checkinTitle: "Today's check-in", checkinBody: "Record what changed today so you can compare your skin over time.",
    levels: { dryness_level: "Dryness", oiliness_level: "Oiliness", redness_level: "Redness", breakout_level: "Breakouts", irritation_level: "Irritation" },
    low: "Low", high: "High", context: "Context", makeup: "Makeup today", outdoor: "Outdoor today",
    events: { newProductUsed: "New product", activeProductUsed: "Active ingredient", exfoliationUsed: "Exfoliation", moisturizerSkipped: "Skipped moisturizer", sleepDeprived: "Low sleep", workoutOrSweat: "Workout / sweat" },
    memo: "Memo", memoPlaceholder: "Anything worth remembering today", save: "Save check-in", saving: "Saving…", saved: "Check-in saved", saveFailed: "Could not save the check-in.",
    routine: "Today's routine", noRoutine: "A routine appears after a check-in is saved.", dashboardFailed: "Your skin diary could not be loaded.", reload: "Reload",
    detail: "Diary detail", close: "Close detail", detailLoading: "Loading diary detail…", detailFailed: "Could not load that diary day.",
    sections: { am_routine: "AM", pm_routine: "PM", keep_items: "Keep", reduce_items: "Reduce", avoid_items: "Avoid", warnings: "Warnings" }
  },
  ko: {
    checkinTitle: "오늘 체크인", checkinBody: "오늘 달라진 피부 상태와 생활 맥락을 기록해 변화를 이어서 확인하세요.",
    levels: { dryness_level: "건조함", oiliness_level: "유분", redness_level: "붉음", breakout_level: "트러블", irritation_level: "자극감" },
    low: "낮음", high: "높음", context: "오늘의 맥락", makeup: "오늘 메이크업", outdoor: "오늘 야외활동",
    events: { newProductUsed: "새 제품 사용", activeProductUsed: "기능성 성분 사용", exfoliationUsed: "각질 관리", moisturizerSkipped: "보습제 생략", sleepDeprived: "수면 부족", workoutOrSweat: "운동 / 땀" },
    memo: "메모", memoPlaceholder: "오늘 기억해둘 변화가 있다면 적어주세요", save: "체크인 저장", saving: "저장 중…", saved: "체크인을 저장했습니다", saveFailed: "체크인을 저장하지 못했습니다.",
    routine: "오늘 루틴", noRoutine: "체크인을 저장하면 오늘 루틴이 생성됩니다.", dashboardFailed: "스킨 다이어리를 불러오지 못했습니다.", reload: "다시 불러오기",
    detail: "다이어리 상세", close: "상세 닫기", detailLoading: "다이어리 상세 불러오는 중…", detailFailed: "해당 날짜의 다이어리를 불러오지 못했습니다.",
    sections: { am_routine: "아침", pm_routine: "저녁", keep_items: "유지", reduce_items: "줄이기", avoid_items: "피하기", warnings: "주의" }
  }
} as const;

function toDisplayItems(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") return item.trim();
    if (!item || typeof item !== "object") return "";
    const record = item as Record<string, unknown>;
    for (const key of ["label", "name", "title", "message", "action", "step", "product_name", "productName"]) if (typeof record[key] === "string") return String(record[key]).trim();
    return "";
  }).filter(Boolean).slice(0, 6);
}

function RoutineView({ routine, locale, palette }: { routine: NativeRoutineLog | null; locale: "en" | "ko"; palette: ReturnType<typeof useMobileShell>["palette"] }) {
  const copy = MY_COPY[locale];
  if (!routine) return <Text style={[styles.bodyText, { color: palette.textMuted }]}>{copy.noRoutine}</Text>;
  const keys = ["am_routine", "pm_routine", "keep_items", "reduce_items", "avoid_items", "warnings"] as const;
  const sections = keys.map((key) => ({ key, items: toDisplayItems(routine[key]) })).filter((section) => section.items.length);
  if (!sections.length) return <Text style={[styles.bodyText, { color: palette.textMuted }]}>{copy.noRoutine}</Text>;
  return <View style={styles.stackSmall}>{sections.map((section) => <View key={section.key}><Text style={[styles.subheading, { color: palette.text }]}>{copy.sections[section.key]}</Text>{section.items.map((item, index) => <Text key={`${section.key}-${index}`} style={[styles.bodyText, { color: palette.textMuted }]}>• {item}</Text>)}</View>)}</View>;
}

export default function MyScreen() {
  const isFocused = useIsFocused();
  const { locale, palette } = useMobileShell();
  const copy = MOBILE_COPY[locale].my;
  const diaryCopy = MY_COPY[locale];
  const [today, setToday] = useState(getNativeLocalDate);
  const currentMonth = today.slice(0, 7);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<NativeMyDashboard | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [form, setForm] = useState<NativeCheckinInput>(() => createNativeCheckinFromExisting(null));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [dashboardError, setDashboardError] = useState(false);
  const [detail, setDetail] = useState<NativeDiaryDay | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "error">("idle");
  const requests = useRef(createNativeRequestScope()).current;
  const sessionRef = useRef<Session | null>(null);
  const selectedMonthRef = useRef(currentMonth);
  const formOwner = useRef<string | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const dateRef = useRef(today);
  const refreshSession = useRef<(() => void) | null>(null);
  const authActionPending = useRef(false);

  async function loadDashboard(activeSession: Session, month = selectedMonthRef.current) {
    if (!requests.owns(activeSession.user.id)) return;
    const ticket = requests.begin("dashboard");
    setDashboardError(false);
    try {
      const next = await fetchNativeMyDashboard(activeSession, { localDate: getNativeLocalDate(), diaryMonth: month });
      if (!requests.isCurrent(ticket)) return;
      setDashboard(next);
      if (!dirty.current) {
        setForm(createNativeCheckinFromExisting(next.todayCheckin));
        formOwner.current = activeSession.user.id;
      }
    } catch { if (requests.isCurrent(ticket)) setDashboardError(true); }
  }

  useEffect(() => {
    if (!getMobileSupabaseClient()) { setStatus("unconfigured"); return; }
    function applySession(nextSession: Session | null) {
      const changed = requests.setOwner(nextSession?.user.id ?? null);
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (changed || !nextSession) {
        setDashboard(null); setDetail(null); setDashboardError(false); setDetailState("idle");
        setForm(createNativeCheckinFromExisting(null)); setSaveState("idle");
        formOwner.current = null; dirty.current = false; saving.current = false;
      }
      if (!nextSession) { setStatus("signed-out"); return; }
      setStatus("signed-in");
      if (changed) {
        const month = getNativeDiaryMonth();
        selectedMonthRef.current = month; setSelectedMonth(month);
        void loadDashboard(nextSession, month);
      }
    }
    const stop = observeNativeSession(applySession);
    refreshSession.current = stop.refresh;
    return () => {
      refreshSession.current = null; sessionRef.current = null; formOwner.current = null;
      stop(); requests.setOwner(null); requests.invalidate();
    };
  }, [requests]);

  useEffect(() => { if (isFocused) refreshSession.current?.(); }, [isFocused]);

  useEffect(() => {
    function refreshDate() {
      const next = getNativeLocalDate();
      if (next === dateRef.current) return;
      const previousMonth = dateRef.current.slice(0, 7);
      dateRef.current = next; setToday(next);
      if (selectedMonthRef.current === previousMonth) {
        selectedMonthRef.current = next.slice(0, 7); setSelectedMonth(selectedMonthRef.current);
      }
      if (sessionRef.current) void loadDashboard(sessionRef.current);
    }
    const timer = setInterval(refreshDate, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") { refreshDate(); refreshSession.current?.(); }
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [requests]);

  async function handleSignIn(provider: "google" | "apple") {
    if (sessionRef.current || status === "signing-in" || authActionPending.current) return;
    authActionPending.current = true;
    const ticket = requests.begin("auth-action");
    setStatus("signing-in");
    try { provider === "google" ? await signInNativeWithGoogle() : await signInNativeWithApple(); }
    catch { if (requests.isCurrent(ticket)) setStatus("error"); }
    finally { authActionPending.current = false; if (requests.isCurrent(ticket)) refreshSession.current?.(); }
  }
  async function handleSignOut() {
    if (!session || session.user.id !== sessionRef.current?.user.id) return;
    const ticket = requests.begin("auth-action");
    try { await signOutNative(session.user.id); }
    catch { if (requests.isCurrent(ticket)) setStatus("error"); }
  }
  async function handleMonth(delta: number) {
    const activeSession = sessionRef.current;
    if (!activeSession) return;
    const next = shiftNativeDiaryMonth(selectedMonthRef.current, delta);
    if (next > getNativeDiaryMonth()) return;
    selectedMonthRef.current = next; setSelectedMonth(next);
    requests.begin("detail"); setDetail(null); setDetailState("idle");
    await loadDashboard(activeSession, next);
  }
  async function handleSave() {
    const activeSession = sessionRef.current;
    if (!activeSession || !dashboard?.hasProfile || saving.current ||
      formOwner.current !== activeSession.user.id || session?.user.id !== activeSession.user.id) return;
    if (form.checkinDate !== getNativeLocalDate()) {
      Alert.alert(locale === "ko" ? "날짜가 바뀌었습니다" : "The date has changed",
        locale === "ko" ? "작성 중인 기록을 새 날짜로 자동 저장하지 않습니다. 오늘 기록을 다시 불러오면 작성 중인 내용이 지워집니다." : "Your draft will not be moved to a new date. Reloading today's check-in discards this draft.",
        [{ text: locale === "ko" ? "취소" : "Cancel", style: "cancel" },
          { text: locale === "ko" ? "오늘 기록 불러오기" : "Reload today", onPress: () => {
            if (!requests.owns(activeSession.user.id)) return;
            dirty.current = false; void loadDashboard(activeSession);
          } }]);
      return;
    }
    const ticket = requests.begin("save");
    saving.current = true; setSaveState("saving");
    try {
      await saveNativeCheckin(activeSession, { ...form });
      if (!requests.isCurrent(ticket)) return;
      dirty.current = false; await loadDashboard(activeSession);
      if (requests.isCurrent(ticket)) setSaveState("saved");
    } catch { if (requests.isCurrent(ticket)) setSaveState("error"); }
    finally { if (requests.isCurrent(ticket)) saving.current = false; }
  }
  async function handleDiaryDay(date: string) {
    const activeSession = sessionRef.current;
    if (!activeSession) return;
    const ticket = requests.begin("detail");
    setDetailState("loading"); setDetail(null);
    try {
      const next = await fetchNativeDiaryDay(activeSession, date);
      if (requests.isCurrent(ticket)) { setDetail(next); setDetailState("idle"); }
    } catch { if (requests.isCurrent(ticket)) setDetailState("error"); }
  }
  function canEditForm() {
    return Boolean(session && !saving.current && session.user.id === sessionRef.current?.user.id &&
      formOwner.current === session.user.id && requests.owns(session.user.id));
  }
  function updateLevel(key: CheckinLevelKey, value: number) { if (!canEditForm()) return; dirty.current = true; setSaveState("idle"); setForm((current) => ({ ...current, [key]: value })); }
  function toggleEvent(key: CheckinEventKey) { if (!canEditForm()) return; dirty.current = true; setSaveState("idle"); setForm((current) => ({ ...current, checkinEvents: { ...current.checkinEvents, [key]: !current.checkinEvents[key] } })); }
  function toggleContext(key: "makeup_today" | "outdoor_today") { if (!canEditForm()) return; dirty.current = true; setSaveState("idle"); setForm((current) => ({ ...current, [key]: !current[key] })); }

  let statusText = copy.signedOut;
  if (status === "loading") statusText = copy.loading; else if (status === "unconfigured") statusText = copy.authUnavailable; else if (status === "signing-in") statusText = copy.signingIn; else if (status === "error") statusText = copy.authFailed; else if (session) statusText = session.user.email ? `${copy.signedIn} · ${session.user.email}` : copy.signedIn;

  return <ScreenShell eyebrow={copy.eyebrow} title={copy.title} description={copy.description}>
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.status, { color: palette.text }]}>{statusText}</Text>
      {!session && status !== "loading" && status !== "unconfigured" ? <Pressable accessibilityRole="button" testID="mobile-google-sign-in" accessibilityLabel={copy.signInGoogle} disabled={status === "signing-in"} onPress={() => void handleSignIn("google")} style={[styles.primaryButton, { backgroundColor: palette.action }]}><Text style={styles.primaryButtonText}>{status === "signing-in" ? copy.signingIn : copy.signInGoogle}</Text></Pressable> : null}
      {!session && status !== "loading" && status !== "unconfigured" ? <NativeAppleSignInButton disabled={status === "signing-in"} onPress={() => void handleSignIn("apple")} /> : null}
      {session ? <Pressable accessibilityRole="button" testID="mobile-sign-out" accessibilityLabel={copy.signOut} onPress={() => void handleSignOut()} style={[styles.secondaryButton, { borderColor: palette.border }]}><Text style={[styles.secondaryButtonText, { color: palette.text }]}>{copy.signOut}</Text></Pressable> : null}
    </View>

    {session && dashboardError ? <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.dashboardFailed}</Text><Pressable onPress={() => void loadDashboard(session)} style={[styles.secondaryButton, { borderColor: palette.border }]}><Text style={[styles.secondaryButtonText, { color: palette.text }]}>{diaryCopy.reload}</Text></Pressable></View> : null}

    {session && dashboard ? <>
      <NativeMyDiaryView locale={locale} dashboard={dashboard} palette={{ ...palette, accent: palette.accentText }} onDiaryDay={(date) => void handleDiaryDay(date)} onPreviousMonth={() => void handleMonth(-1)} onNextMonth={() => void handleMonth(1)} canNextMonth={selectedMonth < currentMonth} />

      {dashboard.hasProfile ? <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.checkinTitle}</Text><Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.checkinBody}</Text>
        <Text style={[styles.hint, { color: palette.textMuted }]}>{form.checkinDate}</Text>
        {CHECKIN_LEVEL_KEYS.map((key) => <View key={key} style={styles.levelBlock}><View style={styles.rowBetween}><Text style={[styles.subheading, { color: palette.text }]}>{diaryCopy.levels[key]}</Text><Text style={[styles.bodyText, { color: palette.textMuted }]}>{form[key]} / 4</Text></View><View style={styles.chipRow}>{[0,1,2,3,4].map((value) => { const selected = form[key] === value; return <Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${diaryCopy.levels[key]} ${value} / 4`} accessibilityState={{ selected, disabled: saveState === "saving" }} disabled={saveState === "saving"} onPress={() => updateLevel(key, value)} style={[styles.levelChip, { borderColor: selected ? palette.accent : palette.border, backgroundColor: selected ? palette.surfaceMuted : palette.surface }]}><Text style={[styles.levelChipText, { color: selected ? palette.accent : palette.textMuted }]}>{value}</Text></Pressable>; })}</View><View style={styles.rowBetween}><Text style={[styles.hint, { color: palette.textMuted }]}>{diaryCopy.low}</Text><Text style={[styles.hint, { color: palette.textMuted }]}>{diaryCopy.high}</Text></View></View>)}
        <Text style={[styles.subheading, { color: palette.text }]}>{diaryCopy.context}</Text><View style={styles.chipRow}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.makeup_today, disabled: saveState === "saving" }} disabled={saveState === "saving"} onPress={() => toggleContext("makeup_today")} style={[styles.toggleChip, { borderColor: form.makeup_today ? palette.accent : palette.border }]}><Text style={[styles.toggleText, { color: palette.text }]}>{diaryCopy.makeup}</Text></Pressable>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.outdoor_today, disabled: saveState === "saving" }} disabled={saveState === "saving"} onPress={() => toggleContext("outdoor_today")} style={[styles.toggleChip, { borderColor: form.outdoor_today ? palette.accent : palette.border }]}><Text style={[styles.toggleText, { color: palette.text }]}>{diaryCopy.outdoor}</Text></Pressable>
          {CHECKIN_EVENT_KEYS.map((key) => <Pressable key={key} accessibilityRole="checkbox" accessibilityState={{ checked: form.checkinEvents[key], disabled: saveState === "saving" }} disabled={saveState === "saving"} onPress={() => toggleEvent(key)} style={[styles.toggleChip, { borderColor: form.checkinEvents[key] ? palette.accent : palette.border }]}><Text style={[styles.toggleText, { color: palette.text }]}>{diaryCopy.events[key]}</Text></Pressable>)}
        </View>
        <Text style={[styles.subheading, { color: palette.text }]}>{diaryCopy.memo}</Text><TextInput multiline editable={saveState !== "saving"} accessibilityLabel={diaryCopy.memo} maxLength={1000} value={form.memo} placeholder={diaryCopy.memoPlaceholder} placeholderTextColor={palette.textMuted} onChangeText={(memo) => { if (!canEditForm()) return; dirty.current = true; setSaveState("idle"); setForm((c) => ({ ...c, memo })); }} style={[styles.memoInput, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surfaceMuted }]} />
        <Pressable accessibilityRole="button" testID="mobile-checkin-save" accessibilityLabel={diaryCopy.save} accessibilityState={{ disabled: saveState === "saving" }} disabled={saveState === "saving"} onPress={() => void handleSave()} style={[styles.primaryButton, { backgroundColor: palette.action }]}><Text style={styles.primaryButtonText}>{saveState === "saving" ? diaryCopy.saving : diaryCopy.save}</Text></Pressable>
        {saveState === "saved" ? <Text style={[styles.hint, { color: palette.accentText }]}>{diaryCopy.saved}</Text> : null}{saveState === "error" ? <Text style={[styles.hint, { color: palette.textMuted }]}>{diaryCopy.saveFailed}</Text> : null}
      </View> : null}

      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}><Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.routine}</Text><RoutineView routine={dashboard.todayRoutine} locale={locale} palette={palette} /></View>
      {detailState === "loading" ? <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.detailLoading}</Text> : null}{detailState === "error" ? <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.detailFailed}</Text> : null}
      {detail ? <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}><View style={styles.rowBetween}><Text style={[styles.sectionTitle, { color: palette.text }]}>{diaryCopy.detail} · {detail.date}</Text><Pressable accessibilityRole="button" style={{ minHeight: 48, justifyContent: "center" }} onPress={() => { requests.begin("detail"); setDetail(null); setDetailState("idle"); }}><Text style={[styles.toggleText, { color: palette.accentText }]}>{diaryCopy.close}</Text></Pressable></View>{CHECKIN_LEVEL_KEYS.map((key) => <Text key={key} style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.levels[key]} · {detail.checkin[key]} / 4</Text>)}{detail.checkin.memo ? <Text style={[styles.bodyText, { color: palette.textMuted }]}>{diaryCopy.memo} · {detail.checkin.memo}</Text> : null}<RoutineView routine={detail.routine} locale={locale} palette={palette} /></View> : null}
    </> : null}
    <Text style={[styles.notice, { color: palette.textMuted }]}>{copy.notice}</Text>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 18, gap: 14 }, status: { fontSize: 16, fontWeight: "700" }, sectionTitle: { fontSize: 18, fontWeight: "800" }, subheading: { fontSize: 14, fontWeight: "700", lineHeight: 20 }, bodyText: { fontSize: 14, lineHeight: 21 }, hint: { fontSize: 12, lineHeight: 18 }, stackSmall: { gap: 8 }, rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, primaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 999, paddingHorizontal: 18 }, primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" }, secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 18 }, secondaryButtonText: { fontSize: 15, fontWeight: "600" }, levelBlock: { gap: 8 }, chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, levelChip: { width: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 12 }, levelChipText: { fontSize: 14, fontWeight: "800" }, toggleChip: { minHeight: 48, justifyContent: "center", borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, toggleText: { fontSize: 13, fontWeight: "700" }, memoInput: { minHeight: 96, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, textAlignVertical: "top" }, notice: { fontSize: 14, lineHeight: 21 }
});
