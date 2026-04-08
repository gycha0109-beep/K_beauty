import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request) {
  try {
    const body = await request.json();
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json({
        success: false,
        skipped: true,
        message: "Supabase environment variables are missing."
      });
    }

    const normalizedSupabaseUrl = supabaseUrl?.startsWith("http")
      ? supabaseUrl
      : `https://${supabaseUrl}`;

    const supabase = createClient(normalizedSupabaseUrl, supabaseServiceRoleKey);

    const payload = {
      event_name: body?.event_name || null,
      timestamp: body?.timestamp || new Date().toISOString(),
      product_id: body?.product_id || null,
      is_top_pick: Boolean(body?.is_top_pick),
      question_id: body?.question_id || null,
      answer: body?.answer || null
    };

    const { error } = await supabase.from("recommendation_logs").insert(payload);

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      });
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to store event."
      },
      { status: 500 }
    );
  }
}
