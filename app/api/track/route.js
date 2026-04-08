import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function buildTrackPayload(body = {}) {
  return {
    event_name: body?.event_name || null,
    timestamp: body?.timestamp || new Date().toISOString(),
    session_id: body?.session_id || null,
    product_id: body?.product_id || null,
    feature_name: body?.feature_name || null,
    result_type: body?.result_type || null,
    question_id: body?.question_id || null,
    answer: body?.answer || null,
    is_top_pick: Boolean(body?.is_top_pick),
    meta_json: body?.meta_json ?? null
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const normalizedSupabaseUrl = supabaseUrl?.startsWith("http")
      ? supabaseUrl
      : supabaseUrl
        ? `https://${supabaseUrl}`
        : null;

    console.log("[api/track] env check", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseServiceRoleKey: Boolean(supabaseServiceRoleKey),
      supabaseHost: normalizedSupabaseUrl
        ? new URL(normalizedSupabaseUrl).host
        : null,
      vercelEnv: process.env.VERCEL_ENV || null
    });

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: "Supabase environment variables are missing."
      }, { status: 500 });
    }

    const supabase = createClient(normalizedSupabaseUrl, supabaseServiceRoleKey);
    const payload = buildTrackPayload(body);

    console.log("[api/track]", payload);

    const { data, error, status, statusText } = await supabase
      .from("recommendation_logs")
      .insert([payload]);

    console.log("[api/track] insert result", {
      data,
      error,
      status,
      statusText
    });

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
    console.error("[api/track] request failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to store event."
      },
      { status: 500 }
    );
  }
}
