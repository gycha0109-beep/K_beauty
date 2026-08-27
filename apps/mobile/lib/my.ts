import type { Session } from "@supabase/auth-js";
import { getMobileApiBaseUrl } from "./env";

export const CHECKIN_LEVEL_KEYS = [
  "dryness_level",
  "oiliness_level",
  "redness_level",
  "breakout_level",
  "irritation_level"
] as const;

export const CHECKIN_EVENT_KEYS = [
  "newProductUsed",
  "activeProductUsed",
  "exfoliationUsed",
  "moisturizerSkipped",
  "sleepDeprived",
  "workoutOrSweat"
] as const;

export type CheckinLevelKey = (typeof CHECKIN_LEVEL_KEYS)[number];
export type CheckinEventKey = (typeof CHECKIN_EVENT_KEYS)[number];

export type NativeSkinProfile = {
  id: string;
  skin_type?: string | null;
  concerns?: string[] | null;
  sensitivity_level?: string | null;
};

export type NativeDailyCheckin = {
  id: string;
  checkin_date: string;
  dryness_level: number;
  oiliness_level: number;
  redness_level: number;
  breakout_level: number;
  irritation_level: number;
  makeup_today: boolean;
  outdoor_today: boolean;
  memo?: string | null;
  context?: unknown;
};

export type NativeRoutineLog = {
  routine_date?: string | null;
  am_routine?: unknown;
  pm_routine?: unknown;
  keep_items?: unknown;
  reduce_items?: unknown;
  avoid_items?: unknown;
  warnings?: unknown;
};

export type NativeSavedReport = {
  id: string;
  report_type?: string | null;
  title?: string | null;
  created_at?: string | null;
};

export type NativeMyDashboard = {
  latestSkinProfile: NativeSkinProfile | null;
  todayCheckin: NativeDailyCheckin | null;
  recentTrendCheckins: NativeDailyCheckin[];
  monthlyDiaryCheckins: NativeDailyCheckin[];
  todayRoutine: NativeRoutineLog | null;
  latestSavedReport: NativeSavedReport | null;
  diaryMonth: string;
  currentDiaryMonth: string;
  hasProfile: boolean;
  needsCheckIn: boolean;
};

export type NativeDiaryDay = {
  date: string;
  checkin: NativeDailyCheckin;
  routine: NativeRoutineLog | null;
  historicalSnapshot: boolean;
};

export type NativeCheckinInput = Record<CheckinLevelKey, number> & {
  checkinDate: string;
  makeup_today: boolean;
  outdoor_today: boolean;
  checkinEvents: Record<CheckinEventKey, boolean>;
  memo: string;
};

function bearerHeaders(session: Session) {
  return {
    Authorization: `Bearer ${session.access_token}`,
    Accept: "application/json"
  };
}

async function readJson(response: Response) {
  return response.json().catch(() => null);
}

function requireOk(response: Response, payload: any, fallback: string) {
  if (response.status === 401) {
    throw new Error("mobile_my_unauthorized");
  }

  if (!response.ok) {
    throw new Error(typeof payload?.error === "string" ? payload.error : fallback);
  }
}

export function getNativeLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNativeDiaryMonth(date = new Date()) {
  return getNativeLocalDate(date).slice(0, 7);
}

export function shiftNativeDiaryMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function createEmptyNativeCheckin(date = getNativeLocalDate()): NativeCheckinInput {
  return {
    checkinDate: date,
    dryness_level: 0,
    oiliness_level: 0,
    redness_level: 0,
    breakout_level: 0,
    irritation_level: 0,
    makeup_today: false,
    outdoor_today: false,
    checkinEvents: {
      newProductUsed: false,
      activeProductUsed: false,
      exfoliationUsed: false,
      moisturizerSkipped: false,
      sleepDeprived: false,
      workoutOrSweat: false
    },
    memo: ""
  };
}

export function createNativeCheckinFromExisting(checkin: NativeDailyCheckin | null): NativeCheckinInput {
  const base = createEmptyNativeCheckin(checkin?.checkin_date || getNativeLocalDate());
  if (!checkin) return base;

  const context = checkin.context && typeof checkin.context === "object" ? checkin.context as Record<string, any> : {};
  const sourceEvents = context.checkinEvents && typeof context.checkinEvents === "object"
    ? context.checkinEvents as Record<string, unknown>
    : {};

  return {
    checkinDate: checkin.checkin_date,
    dryness_level: checkin.dryness_level,
    oiliness_level: checkin.oiliness_level,
    redness_level: checkin.redness_level,
    breakout_level: checkin.breakout_level,
    irritation_level: checkin.irritation_level,
    makeup_today: checkin.makeup_today === true,
    outdoor_today: checkin.outdoor_today === true,
    checkinEvents: {
      newProductUsed: sourceEvents.newProductUsed === true,
      activeProductUsed: sourceEvents.activeProductUsed === true,
      exfoliationUsed: sourceEvents.exfoliationUsed === true,
      moisturizerSkipped: sourceEvents.moisturizerSkipped === true,
      sleepDeprived: sourceEvents.sleepDeprived === true,
      workoutOrSweat: sourceEvents.workoutOrSweat === true
    },
    memo: typeof checkin.memo === "string" ? checkin.memo : ""
  };
}

export async function fetchNativeMyDashboard(
  session: Session,
  options: { localDate?: string; diaryMonth?: string } = {}
): Promise<NativeMyDashboard> {
  const localDate = options.localDate || getNativeLocalDate();
  const diaryMonth = options.diaryMonth || getNativeDiaryMonth();
  const query = new URLSearchParams({ localDate, diaryMonth });
  const response = await fetch(`${getMobileApiBaseUrl()}/api/my/dashboard?${query.toString()}`, {
    headers: bearerHeaders(session)
  });
  const payload = await readJson(response);
  requireOk(response, payload, "mobile_dashboard_unavailable");
  return payload as NativeMyDashboard;
}

export async function saveNativeCheckin(session: Session, input: NativeCheckinInput) {
  const response = await fetch(`${getMobileApiBaseUrl()}/api/my/check-in`, {
    method: "POST",
    headers: {
      ...bearerHeaders(session),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });
  const payload = await readJson(response);
  requireOk(response, payload, "mobile_checkin_save_failed");
  return payload as { todayCheckin: NativeDailyCheckin; todayRoutine: NativeRoutineLog };
}

export async function fetchNativeDiaryDay(session: Session, date: string): Promise<NativeDiaryDay> {
  const response = await fetch(
    `${getMobileApiBaseUrl()}/api/my/diary-day?date=${encodeURIComponent(date)}`,
    { headers: bearerHeaders(session) }
  );
  const payload = await readJson(response);
  requireOk(response, payload, "mobile_diary_day_unavailable");
  return payload as NativeDiaryDay;
}
