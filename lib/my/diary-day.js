import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidLocalDate } from "@/lib/my/local-date";
import { writeSafeLog } from "@/lib/security/error-redaction";

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

export async function getMyDiaryDayPayload({ date } = {}) {
  if (!isValidLocalDate(date)) {
    return {
      status: 400,
      error: "invalid_diary_date",
      payload: null
    };
  }

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
    const { data: checkin, error: checkinError } = await supabase
      .from("daily_checkins")
      .select(DAILY_CHECKIN_COLUMNS)
      .eq("user_id", user.id)
      .eq("checkin_date", date)
      .limit(1)
      .maybeSingle();

    if (checkinError) {
      throw new Error("diary_day_checkin_unavailable");
    }

    if (!checkin) {
      return {
        status: 404,
        error: "diary_day_not_found",
        payload: null
      };
    }

    const { data: routine, error: routineError } = await supabase
      .from("routine_logs")
      .select(ROUTINE_LOG_COLUMNS)
      .eq("user_id", user.id)
      .eq("routine_date", date)
      .limit(1)
      .maybeSingle();

    if (routineError) {
      throw new Error("diary_day_routine_unavailable");
    }

    return {
      status: 200,
      error: null,
      payload: {
        date,
        checkin,
        routine: routine || null,
        historicalSnapshot: true
      }
    };
  } catch {
    writeSafeLog("error", {
      event: "diary_day_failed",
      category: "database_unavailable",
      operation: "diary_day_read",
      dependency: "supabase",
      retryable: true
    });

    return {
      status: 500,
      error: "diary_day_unavailable",
      payload: null
    };
  }
}
