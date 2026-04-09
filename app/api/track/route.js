import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function buildTrackPayload(body = {}) {
  return {
    event_name: body?.event_name ?? null,
    timestamp: body?.timestamp ?? new Date().toISOString(),
    session_id: body?.session_id ?? null,
    product_id: body?.product_id ?? null,
    feature_name: body?.feature_name ?? null,
    result_type: body?.result_type ?? null,
    question_id: body?.question_id ?? null,
    answer: body?.answer ?? null,
    is_top_pick: Boolean(body?.is_top_pick),
    meta_json: body?.meta_json ?? null
  };
}

function getSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.startsWith("http")
      ? supabaseUrl
      : `https://${supabaseUrl}`,
    supabaseServiceRoleKey
  };
}

export async function POST(request) {
  try {
    const supabaseConfig = getSupabaseConfig();

    if (!supabaseConfig) {
      return NextResponse.json({
        success: false,
        error: "Supabase environment variables are missing."
      }, { status: 500 });
    }

    const payload = buildTrackPayload(await request.json());
    const supabase = createClient(
      supabaseConfig.supabaseUrl,
      supabaseConfig.supabaseServiceRoleKey
    );

    const { error } = await supabase
      .from("recommendation_logs")
      .insert([payload]);

    if (error) {
      console.error("[api/track] insert failed", error.message, payload);

      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Failed to store event.";

    console.error("[api/track] request failed", error);

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
