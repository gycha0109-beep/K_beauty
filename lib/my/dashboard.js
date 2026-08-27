import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isSchemaCacheError,
  upsertProfileForUser
} from "@/lib/auth/profile-upsert";
import { getUtcDateString, isValidLocalDate } from "@/lib/my/local-date";
import {
  getDiaryMonthFromLocalDate,
  getDiaryMonthRange,
  isValidDiaryMonth
} from "@/lib/my/diary-month";
import { writeSafeLog } from "@/lib/security/error-redaction";

const SKIN_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "skin_type",
  "concerns",
  "sensitivity_level",
  "preferences",
  "photo_analysis",
  "is_active",
  "created_at",
  "updated_at"
].join(",");

const DAILY_CHECKIN_COLUMNS = [
  "id",
  "user_id",
  "skin_profile_id",
  "checkin_date",
  "dryness_level",
  "oiliness_level",
  "redness_level",
  "breakout_level",
  "irritation_level",
  "makeup_today",
  "outdoor_today",
  "memo",
  "context",
  "created_at",
  "updated_at"
].join(",");

const ROUTINE_LOG_COLUMNS = [
  "id",
  "user_id",
  "skin_profile_id",
  "daily_checkin_id",
  "routine_date",
  "am_routine",
  "pm_routine",
  "keep_items",
  "reduce_items",
  "avoid_items",
  "warnings",
  "generation_source",
  "created_at",
  "updated_at"
].join(",");

const SAVED_REPORT_COLUMNS = [
  "id",
  "user_id",
  "skin_profile_id",
  "report_type",
  "source_type",
  "source_session_id",
  "title",
  "report_version",
  "created_at",
  "updated_at"
].join(",");

function getLatestReportPath(report) {
  if (!report) {
    return null;
  }

  if (report.report_type === "premium" && report.id) {
    return `/result/full-report?savedReportId=${encodeURIComponent(report.id)}`;
  }

  if (report.report_type === "free" && report.source_type === "share" && report.source_session_id) {
    return `/r/${encodeURIComponent(report.source_session_id)}`;
  }

  return null;
}

async function ensureProfile(supabase, user) {
  const result = await upsertProfileForUser({
    supabase,
    user,
    preferAdmin: true
  });

  if (result.error) {
    writeSafeLog("error", {
      event: "profile_sync_failed",
      category: isSchemaCacheError(result.error)
        ? "schema_unavailable"
        : "database_unavailable",
      operation: "profile_sync",
      dependency: "supabase",
      retryable: true
    });
    throw new Error("profile_upsert_failed");
  }
}

async function resolveSingle(label, query) {
  const { data, error } = await query;

  if (error) {
    if (isSchemaCacheError(error)) {
      writeSafeLog("warn", {
        event: "dashboard_failed",
        category: "schema_unavailable",
        operation: "dashboard",
        dependency: "supabase",
        retryable: true
      });
      return null;
    }

    throw new Error(`${label}_unavailable`);
  }

  return data || null;
}

function resolveDashboardDate(localDate) {
  if (isValidLocalDate(localDate)) {
    return localDate;
  }

  return getUtcDateString();
}

function addDays(dateString, amount) {
  if (!isValidLocalDate(dateString)) {
    return dateString;
  }

  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + amount);

  return date.toISOString().slice(0, 10);
}

async function resolveDashboardAuth(authContext) {
  if (authContext?.supabase && authContext?.user) {
    return authContext;
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return { supabase, user, transport: "cookie" };
}

export async function getMyDashboardPayload({ localDate, diaryMonth, authContext } = {}) {
  const resolvedAuth = await resolveDashboardAuth(authContext);

  if (!resolvedAuth) {
    return {
      status: 401,
      error: "unauthorized",
      payload: null
    };
  }

  const { supabase, user } = resolvedAuth;

  if (diaryMonth && !isValidDiaryMonth(diaryMonth)) {
    return {
      status: 400,
      error: "invalid_diary_month",
      payload: null
    };
  }

  try {
    await ensureProfile(supabase, user);

    const dashboardDate = resolveDashboardDate(localDate);
    const currentDiaryMonth = getDiaryMonthFromLocalDate(dashboardDate);
    const selectedDiaryMonth = diaryMonth || currentDiaryMonth;
    const diaryMonthRange = getDiaryMonthRange(selectedDiaryMonth, {
      localDate: dashboardDate
    });
    const recentStartDate = addDays(dashboardDate, -6);
    const latestSkinProfile = await resolveSingle(
      "latest_skin_profile",
      supabase
        .from("skin_profiles")
        .select(SKIN_PROFILE_COLUMNS)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );

    const latestSavedReport = await resolveSingle(
      "latest_saved_report",
      supabase
        .from("saved_reports")
        .select(SAVED_REPORT_COLUMNS)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    );

    const todayCheckin = latestSkinProfile
      ? await resolveSingle(
        "today_checkin",
        supabase
          .from("daily_checkins")
          .select(DAILY_CHECKIN_COLUMNS)
          .eq("user_id", user.id)
          .eq("checkin_date", dashboardDate)
          .limit(1)
          .maybeSingle()
      )
      : null;

    const recentTrendCheckins = latestSkinProfile
      ? await resolveSingle(
        "recent_trend_checkins",
        supabase
          .from("daily_checkins")
          .select(DAILY_CHECKIN_COLUMNS)
          .eq("user_id", user.id)
          .gte("checkin_date", recentStartDate)
          .lte("checkin_date", dashboardDate)
          .order("checkin_date", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(7)
      )
      : [];

    const monthlyDiaryCheckins = latestSkinProfile && diaryMonthRange && !diaryMonthRange.isFutureMonth
      ? await resolveSingle(
        "monthly_diary_checkins",
        supabase
          .from("daily_checkins")
          .select(DAILY_CHECKIN_COLUMNS)
          .eq("user_id", user.id)
          .gte("checkin_date", diaryMonthRange.startDate)
          .lte("checkin_date", diaryMonthRange.endDate)
          .order("checkin_date", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(31)
      )
      : [];

    const todayRoutine = latestSkinProfile
      ? await resolveSingle(
        "today_routine",
        supabase
          .from("routine_logs")
          .select(ROUTINE_LOG_COLUMNS)
          .eq("user_id", user.id)
          .eq("routine_date", dashboardDate)
          .limit(1)
          .maybeSingle()
      )
      : null;

    const hasProfile = Boolean(latestSkinProfile);
    const normalizedRecentTrendCheckins = Array.isArray(recentTrendCheckins) ? recentTrendCheckins : [];

    return {
      status: 200,
      error: null,
      payload: {
        latestSkinProfile,
        todayCheckin,
        recentTrendCheckins: normalizedRecentTrendCheckins,
        monthlyDiaryCheckins: Array.isArray(monthlyDiaryCheckins) ? monthlyDiaryCheckins : [],
        recentCheckins: normalizedRecentTrendCheckins,
        diaryMonth: selectedDiaryMonth,
        currentDiaryMonth,
        todayRoutine,
        latestSavedReport,
        latestSharePath: getLatestReportPath(latestSavedReport),
        hasProfile,
        needsCheckIn: hasProfile && !todayCheckin
      }
    };
  } catch {
    writeSafeLog("error", {
      event: "dashboard_failed",
      category: "database_unavailable",
      operation: "dashboard",
      dependency: "supabase",
      retryable: true
    });

    return {
      status: 500,
      error: "dashboard_unavailable",
      payload: null
    };
  }
}
