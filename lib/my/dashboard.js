import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isSchemaCacheError,
  serializeSupabaseError,
  upsertProfileForUser
} from "@/lib/auth/profile-upsert";
import { getUtcDateString, isValidLocalDate } from "@/lib/my/local-date";

const SKIN_PROFILE_COLUMNS = [
  "id",
  "user_id",
  "skin_type",
  "concerns",
  "sensitivity_level",
  "skin_summary",
  "face_summary",
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

async function ensureProfile(supabase, user) {
  const result = await upsertProfileForUser({
    supabase,
    user,
    preferAdmin: true
  });

  if (result.error) {
    console.error("[my/dashboard] profile upsert failed", {
      error: serializeSupabaseError(result.error),
      method: result.method,
      payload: result.payload,
      attempts: result.attempts
    });
    throw new Error(`profile_upsert_failed: ${result.error.message}`);
  }
}

async function resolveSingle(label, query) {
  const { data, error } = await query;

  if (error) {
    if (isSchemaCacheError(error)) {
      console.error(`[my/dashboard] ${label} unavailable in current schema`, {
        error: serializeSupabaseError(error)
      });
      return null;
    }

    throw new Error(`${label}: ${error.message}`);
  }

  return data || null;
}

function resolveDashboardDate(localDate) {
  if (isValidLocalDate(localDate)) {
    return localDate;
  }

  // Server fallback only. The /my client refresh sends the browser local date.
  return getUtcDateString();
}

export async function getMyDashboardPayload({ localDate } = {}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      status: 401,
      error: "unauthorized",
      payload: null
    };
  }

  try {
    await ensureProfile(supabase, user);

    const dashboardDate = resolveDashboardDate(localDate);
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

    return {
      status: 200,
      error: null,
      payload: {
        latestSkinProfile,
        todayCheckin,
        todayRoutine,
        latestSavedReport,
        hasProfile,
        needsCheckIn: hasProfile && !todayCheckin
      }
    };
  } catch (error) {
    console.error("[my/dashboard] failed to build dashboard payload", error);

    return {
      status: 500,
      error: "dashboard_unavailable",
      payload: null
    };
  }
}
