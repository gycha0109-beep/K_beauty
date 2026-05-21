import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateDailyRoutine } from "@/lib/my/routine-generator";

export const dynamic = "force-dynamic";

const LEVEL_FIELDS = [
  "dryness_level",
  "oiliness_level",
  "redness_level",
  "breakout_level",
  "irritation_level"
];

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

function isValidLocalDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

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

  return {
    error: null,
    payload: {
      checkinDate: body.checkinDate,
      ...levels,
      makeup_today: body.makeup_today === true,
      outdoor_today: body.outdoor_today === true,
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
    throw new Error(`active_skin_profile: ${error.message}`);
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
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { error: validationError, payload } = normalizeCheckinPayload(body);

  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const skinProfile = await getActiveSkinProfile(supabase, user.id);

    if (!skinProfile) {
      return NextResponse.json({ error: "skin_profile_required" }, { status: 409 });
    }

    const now = new Date().toISOString();
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
      context: {
        source: "my-check-in"
      },
      updated_at: now
    };

    const { data: savedCheckin, error: checkinError } = await supabase
      .from("daily_checkins")
      .upsert(checkinRecord, { onConflict: "user_id,checkin_date" })
      .select(DAILY_CHECKIN_COLUMNS)
      .single();

    if (checkinError) {
      throw new Error(`daily_checkin_upsert: ${checkinError.message}`);
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
      throw new Error(`routine_log_upsert: ${routineError.message}`);
    }

    return NextResponse.json({
      todayCheckin: savedCheckin,
      todayRoutine: savedRoutine
    });
  } catch (error) {
    console.error("[my/check-in] failed to save check-in", error);

    return NextResponse.json({ error: "checkin_save_failed" }, { status: 500 });
  }
}
