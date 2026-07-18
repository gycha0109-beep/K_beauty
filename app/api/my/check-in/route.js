import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isLocalDateInServerWindow,
  isValidLocalDate
} from "@/lib/my/local-date";
import { generateDailyRoutine } from "@/lib/my/routine-generator";
import {
  mergeCheckinEventsContext,
  normalizeCheckinEvents
} from "@/lib/my/checkin-events";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";

export const dynamic = "force-dynamic";

const LEVEL_FIELDS = [
  "dryness_level",
  "oiliness_level",
  "redness_level",
  "breakout_level",
  "irritation_level"
];

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

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

function normalizeLevel(value) {
  const level = Number(value);

  if (!Number.isInteger(level) || level < 0 || level > 4) {
    return null;
  }

  return level;
}

function normalizeCheckinPayload(body) {
  if (!body || typeof body !== "object") {
    return {
      error: "invalid_body",
      payload: null
    };
  }

  if (!isValidLocalDate(body.checkinDate)) {
    return {
      error: "invalid_checkin_date",
      payload: null
    };
  }

  if (!isLocalDateInServerWindow(body.checkinDate)) {
    return {
      error: "checkin_date_out_of_range",
      payload: null
    };
  }

  const levels = {};

  for (const field of LEVEL_FIELDS) {
    const level = normalizeLevel(body[field]);

    if (level === null) {
      return {
        error: `invalid_${field}`,
        payload: null
      };
    }

    levels[field] = level;
  }

  const memo = typeof body.memo === "string" ? body.memo.trim().slice(0, 1000) : "";
  const checkinEvents = normalizeCheckinEvents({
    checkinEvents: body.checkinEvents
  });

  return {
    error: null,
    payload: {
      checkinDate: body.checkinDate,
      ...levels,
      makeup_today: body.makeup_today === true,
      outdoor_today: body.outdoor_today === true,
      checkinEvents,
      memo: memo || null
    }
  };
}

async function getActiveSkinProfile(supabase, userId) {
  const { data, error } = await supabase
    .from("skin_profiles")
    .select(SKIN_PROFILE_COLUMNS)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("active_skin_profile_unavailable");
  }

  return data || null;
}

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return sensitiveJsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return sensitiveJsonResponse({ error: "invalid_json" }, { status: 400 });
  }

  const { error: validationError, payload } = normalizeCheckinPayload(body);

  if (validationError) {
    return sensitiveJsonResponse({ error: validationError }, { status: 400 });
  }

  try {
    const skinProfile = await getActiveSkinProfile(supabase, user.id);

    if (!skinProfile) {
      return sensitiveJsonResponse({ error: "skin_profile_required" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { data: existingCheckin, error: existingCheckinError } = await supabase
      .from("daily_checkins")
      .select("context")
      .eq("user_id", user.id)
      .eq("checkin_date", payload.checkinDate)
      .limit(1)
      .maybeSingle();

    if (existingCheckinError) {
      throw new Error("daily_checkin_existing_read_failed");
    }

    // checkin_date/routine_date are the user's calendar date.
    // created_at remains the UTC event timestamp for audit and ordering.
    const checkinRecord = {
      user_id: user.id,
      skin_profile_id: skinProfile.id,
      checkin_date: payload.checkinDate,
      dryness_level: payload.dryness_level,
      oiliness_level: payload.oiliness_level,
      redness_level: payload.redness_level,
      breakout_level: payload.breakout_level,
      irritation_level: payload.irritation_level,
      makeup_today: payload.makeup_today,
      outdoor_today: payload.outdoor_today,
      memo: payload.memo,
      context: mergeCheckinEventsContext(existingCheckin?.context, payload.checkinEvents),
      updated_at: now
    };

    const { data: savedCheckin, error: checkinError } = await supabase
      .from("daily_checkins")
      .upsert(checkinRecord, { onConflict: "user_id,checkin_date" })
      .select(DAILY_CHECKIN_COLUMNS)
      .single();

    if (checkinError) {
      throw new Error("daily_checkin_upsert_failed");
    }

    const routinePayload = generateDailyRoutine({
      skinProfile,
      checkin: savedCheckin
    });
    const routineRecord = {
      user_id: user.id,
      skin_profile_id: skinProfile.id,
      daily_checkin_id: savedCheckin.id,
      routine_date: payload.checkinDate,
      am_routine: routinePayload.am_routine,
      pm_routine: routinePayload.pm_routine,
      keep_items: routinePayload.keep_items,
      reduce_items: routinePayload.reduce_items,
      avoid_items: routinePayload.avoid_items,
      warnings: routinePayload.warnings,
      generation_source: "rule",
      updated_at: now
    };

    const { data: savedRoutine, error: routineError } = await supabase
      .from("routine_logs")
      .upsert(routineRecord, { onConflict: "user_id,routine_date" })
      .select(ROUTINE_LOG_COLUMNS)
      .single();

    if (routineError) {
      throw new Error("routine_log_upsert_failed");
    }

    return sensitiveJsonResponse({
      todayCheckin: savedCheckin,
      todayRoutine: savedRoutine
    });
  } catch {
    writeSafeLog("error", {
      event: "check_in_failed",
      category: "database_unavailable",
      operation: "check_in",
      dependency: "supabase",
      retryable: true
    });

    return sensitiveJsonResponse({ error: "checkin_save_failed" }, { status: 500 });
  }
}
