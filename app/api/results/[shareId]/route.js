import { NextResponse } from "next/server";
import { normalizeStoredAnalysisResult } from "@/lib/analysis-results";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET(request, { params }) {
  try {
    const supabase = createSupabaseAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    const shareId = params?.shareId;

    if (!shareId) {
      return NextResponse.json(
        { success: false, error: "Share id is required." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("analysis_results")
      .select("*")
      .eq("share_id", shareId)
      .eq("is_public", true)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: "Result not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      result: normalizeStoredAnalysisResult(data)
    });
  } catch (error) {
    console.error("[api/results/:shareId] read failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load result."
      },
      { status: 500 }
    );
  }
}
