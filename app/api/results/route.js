import { NextResponse } from "next/server";
import { buildAnalysisResultRow, createShareId, getSharePath } from "@/lib/analysis-results";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  consumeRateLimit,
  getRequestClientKey,
  verifyWriteAccessToken,
  WRITE_ACCESS_HEADER
} from "@/lib/write-access";

const SAVE_RESULTS_LIMIT = 10;
const SAVE_RESULTS_WINDOW_MS = 10 * 60 * 1000;

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

function getUnauthorizedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "The analysis save session is missing or expired. Please run the analysis again."
    },
    { status: 401 }
  );
}

export async function POST(request) {
  try {
    const verification = verifyWriteAccessToken(
      request.headers.get(WRITE_ACCESS_HEADER)
    );

    if (!verification.ok) {
      return getUnauthorizedResponse();
    }

    const rateLimit = consumeRateLimit({
      key: `results:${getRequestClientKey(request)}`,
      limit: SAVE_RESULTS_LIMIT,
      windowMs: SAVE_RESULTS_WINDOW_MS
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many save requests. Please wait a moment and try again."
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000))
          }
        }
      );
    }

    const supabase = createSupabaseAdminClient();

    if (!supabase) {
      return NextResponse.json(
        { success: false, error: "Supabase environment variables are missing." },
        { status: 500 }
      );
    }

    let body = null;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const result = body?.result && typeof body.result === "object" ? body.result : null;
    const submission = body?.submission && typeof body.submission === "object"
      ? body.submission
      : null;
    const locale = body?.locale === "en" ? "en" : "ko";
    const share = body?.share === true;

    if (!result || !submission?.form || typeof submission.form !== "object") {
      return NextResponse.json(
        { success: false, error: "Missing analysis result payload." },
        { status: 400 }
      );
    }

    if (!share) {
      return NextResponse.json(
        { success: false, error: "Explicit share confirmation is required." },
        { status: 400 }
      );
    }

    const saved = await insertAnalysisResult(supabase, {
      result,
      submission,
      locale,
      userId: null,
      isPublic: true
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
