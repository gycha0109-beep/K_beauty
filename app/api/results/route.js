import { NextResponse } from "next/server";
import { buildAnalysisResultRow, createShareId, getSharePath } from "@/lib/analysis-results";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

async function insertAnalysisResult(supabase, payload) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareId = createShareId();
    const row = buildAnalysisResultRow({ ...payload, shareId });
    const { data, error } = await supabase
      .from("analysis_results")
      .insert([row])
      .select("id, share_id, created_at, locale")
      .single();

    if (!error && data) {
      return data;
    }

    if (!error || error.code !== "23505") {
      throw error || new Error("Failed to save analysis result.");
    }
  }

  throw new Error("Could not generate a unique share id.");
}

export async function POST(request) {
  try {
    const supabase = createSupabaseAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const result = body?.result || null;
    const submission = body?.submission || null;
    const locale = body?.locale || submission?.locale || "ko";

    if (!result || !submission?.form) {
      return NextResponse.json(
        { success: false, error: "Missing analysis result payload." },
        { status: 400 }
      );
    }

    const saved = await insertAnalysisResult(supabase, {
      result,
      submission,
      locale,
      userId: null
    });

    return NextResponse.json({
      success: true,
      shareId: saved.share_id,
      sharePath: getSharePath(saved.share_id),
      createdAt: saved.created_at,
      locale: saved.locale
    });
  } catch (error) {
    console.error("[api/results] save failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save result."
      },
      { status: 500 }
    );
  }
}
