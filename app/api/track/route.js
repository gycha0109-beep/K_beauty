import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRouteSupabaseUser } from "@/lib/supabase/server-client";
import {
  consumeRateLimit,
  getRequestClientKey,
  verifyWriteAccessToken,
  WRITE_ACCESS_HEADER
} from "@/lib/write-access";

const TRACK_LIMIT = 50;
const TRACK_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_EVENTS = new Set([
  "view_result",
  "feedback_response"
]);

function normalizeOptionalString(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) {
    return new Date().toISOString();
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? new Date().toISOString()
    : parsedDate.toISOString();
}

function normalizeMetaJson(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const serialized = JSON.stringify(value);

  if (serialized.length > 2000) {
    throw new Error("meta_json is too large.");
  }

  return value;
}

function buildTrackPayload(body = {}) {
  const eventName = normalizeOptionalString(body?.event_name, 64);

  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    throw new Error("Unsupported event name.");
  }

  return {
    event_name: eventName,
    timestamp: normalizeTimestamp(body?.timestamp),
    session_id: normalizeOptionalString(body?.session_id, 120),
    product_id: normalizeOptionalString(body?.product_id, 120),
    feature_name: normalizeOptionalString(body?.feature_name, 80),
    result_type: normalizeOptionalString(body?.result_type, 80),
    question_id: normalizeOptionalString(body?.question_id, 80),
    answer: normalizeOptionalString(body?.answer, 240),
    is_top_pick: Boolean(body?.is_top_pick),
    meta_json: normalizeMetaJson(body?.meta_json)
  };
}

function getUnauthorizedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "The tracking session is missing or expired. Please run the analysis again."
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
      key: `track:${getRequestClientKey(request)}`,
      limit: TRACK_LIMIT,
      windowMs: TRACK_WINDOW_MS
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many tracking requests. Please slow down and try again."
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
    const currentUser = await getRouteSupabaseUser(request);

    if (!supabase) {
      return NextResponse.json(
        {
          success: false,
          error: "Supabase environment variables are missing."
        },
        { status: 500 }
      );
    }

    let body = null;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON body."
        },
        { status: 400 }
      );
    }

    let payload = null;

    try {
      payload = buildTrackPayload(body);
    } catch (validationError) {
      return NextResponse.json(
        {
          success: false,
          error: validationError instanceof Error
            ? validationError.message
            : "Invalid tracking payload."
        },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("recommendation_logs")
      .insert([{
        ...payload,
        user_id: currentUser?.id || null
      }]);

    if (error) {
      console.error("[api/track] insert failed", {
        message: error.message,
        event_name: payload.event_name,
        session_id: payload.session_id,
        question_id: payload.question_id
      });

      return NextResponse.json(
        {
          success: false,
          error: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Failed to store event.";

    console.error("[api/track] request failed", { message });

    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 500 }
    );
  }
}
