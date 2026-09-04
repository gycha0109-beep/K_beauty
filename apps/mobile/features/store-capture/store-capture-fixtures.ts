import type { NativeAnalyzeResult } from "../analyze/analyze-client";
import type { NativeMyDashboard } from "../../lib/my";

export const STORE_CAPTURE_FIXTURE_VERSION = "mobile-20b-v1";
export const STORE_CAPTURE_DATE = "2026-09-03";
export const STORE_CAPTURE_MONTH = "2026-09";

export const STORE_RESULTS_FIXTURE: NativeAnalyzeResult = Object.freeze({
  summary: "Combination skin with mild sensitivity benefits from a gentle, low-burden routine focused on hydration and barrier comfort.",
  topPick: {
    id: "6d560546-80f1-4ccf-9d2c-34023722d2a7",
    brand: "닥터지",
    name: "약산성 레드 블레미쉬 클리어 수딩 폼",
    reason: "A mildly acidic cleanser from the current catalog that fits a gentle daily cleansing direction."
  },
  alternative: {
    id: "d7bb44e4-d585-41ca-8a74-04781470d1de",
    brand: "라운드랩",
    name: "1025 독도 클렌저",
    reason: "A second mildly acidic catalog option when you want a simple alternative without increasing routine burden.",
    comparison_reason: "Choose based on texture preference and how your skin feels after cleansing."
  },
  amFocus: "Keep cleansing gentle, then prioritize hydration and daily sun protection.",
  pmFocus: "Remove the day without over-cleansing and keep the rest of the routine calm.",
  morning: ["Gentle cleanse", "Hydrating moisturizer", "Broad-spectrum sunscreen"],
  night: ["Gentle cleanse", "Barrier-focused moisturizer"],
  warnings: [],
  meta: {
    source: "deterministic-store-capture",
    locale: "en",
    generatedAt: "2026-09-03T09:00:00+09:00",
    notice: "Built from your skin profile and preferences."
  }
});

const checkin = (id: string, date: string, dryness: number, redness: number, breakout: number, memo: string) => ({
  id,
  checkin_date: date,
  dryness_level: dryness,
  oiliness_level: 2,
  redness_level: redness,
  breakout_level: breakout,
  irritation_level: 1,
  makeup_today: false,
  outdoor_today: true,
  memo,
  context: { checkinEvents: {} }
});

export const STORE_DIARY_DASHBOARD_FIXTURE: NativeMyDashboard = Object.freeze({
  latestSkinProfile: {
    id: "store-profile",
    skin_type: "combination",
    concerns: ["dehydration", "redness"],
    sensitivity_level: "moderate"
  },
  todayCheckin: checkin("store-checkin-03", "2026-09-03", 1, 1, 0, "Skin felt comfortable after a simple morning routine."),
  recentTrendCheckins: [
    checkin("store-checkin-03", "2026-09-03", 1, 1, 0, "Comfortable and balanced today."),
    checkin("store-checkin-02", "2026-09-02", 2, 1, 1, "Slight dryness after cleansing, settled after moisturizer."),
    checkin("store-checkin-01", "2026-09-01", 2, 2, 1, "Kept the routine simple after some redness.")
  ],
  monthlyDiaryCheckins: [
    checkin("store-checkin-03", "2026-09-03", 1, 1, 0, "Comfortable and balanced today."),
    checkin("store-checkin-02", "2026-09-02", 2, 1, 1, "Slight dryness after cleansing, settled after moisturizer.")
  ],
  todayRoutine: {
    routine_date: "2026-09-03",
    am_routine: ["Gentle cleanse", "Moisturizer", "Sunscreen"],
    pm_routine: ["Gentle cleanse", "Moisturizer"]
  },
  latestSavedReport: {
    id: "store-report",
    report_type: "skin_match",
    title: "Skin Match · Sep 3",
    created_at: "2026-09-03T09:00:00+09:00"
  },
  diaryMonth: STORE_CAPTURE_MONTH,
  currentDiaryMonth: STORE_CAPTURE_MONTH,
  hasProfile: true,
  needsCheckIn: false
});
