import { NextResponse } from "next/server";
import {
  ANONYMOUS_TRACK_WRITE_HEADER,
  LEGACY_ANONYMOUS_WRITE_HEADER,
  claimAnonymousWriteGrant,
  completeAnonymousWriteGrant,
  createAnonymousTrackRequestFingerprint,
  failAnonymousWriteGrant,
  verifyAnonymousWriteGrantForRequest
} from "@/lib/security/anonymous-write-grant";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRouteSupabaseUser } from "@/lib/supabase/server-client";
import { consumeRateLimit, getRequestClientKey } from "@/lib/write-access";

const TRACK_LIMIT = 50;
const TRACK_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_EVENTS = new Set([
  "view_result",
  "feedback_response",
  "click_full_report_cta",
  "click_top_pick",
  "click_buy_link",
  "click_product_card",
  "view_full_report",
  "view_face_lab",
  "click_share"
]);
const TRACK_BODY_KEYS = new Set([
  "analysisRunId",
  "event_name",
  "timestamp",
  "session_id",
  "product_id",
  "feature_name",
  "result_type",
  "question_id",
  "answer",
  "is_top_pick",
  "meta_json"
]);

function isAccountUser(user) {
  return Boolean(user) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

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

function getAnonymousWriteErrorResponse(code, status) {
  const messages = {
    anonymous_write_token_required: "The tracking session is missing. Please run the analysis again.",
    anonymous_write_token_invalid: "The tracking session is invalid. Please run the analysis again.",
    anonymous_write_token_expired: "The tracking session expired. Please run the analysis again.",
    anonymous_write_token_scope_mismatch: "This tracking session cannot be used here.",
    anonymous_write_principal_mismatch: "The tracking session belongs to a different browser.",
    anonymous_write_resource_mismatch: "The tracking session does not match this analysis.",
    anonymous_write_replayed: "This tracking event was already processed.",
    anonymous_write_in_progress: "This tracking event is already being processed.",
    anonymous_write_grant_unavailable: "We cannot store this tracking event right now. Please try again shortly.",
    anonymous_write_token_mixed: "Use either an account session or an anonymous tracking session."
  };

  return NextResponse.json(
    {
      success: false,
      error: code,
      message: messages[code] || messages.anonymous_write_token_invalid
    },
    { status }
  );
}

function getGrantClaimErrorResponse(state) {
  const mapping = {
    invalid: ["anonymous_write_token_invalid", 401],
    expired: ["anonymous_write_token_expired", 401],
    principal_mismatch: ["anonymous_write_principal_mismatch", 403],
    resource_mismatch: ["anonymous_write_resource_mismatch", 403],
    operation_mismatch: ["anonymous_write_token_scope_mismatch", 403],
    fingerprint_mismatch: ["anonymous_write_resource_mismatch", 403],
    in_progress: ["anonymous_write_in_progress", 409],
    completed: ["anonymous_write_replayed", 409],
    max_uses: ["anonymous_write_replayed", 409],
    failed: ["anonymous_write_replayed", 409],
    inactive: ["anonymous_write_replayed", 409]
  };
  const [code, status] = mapping[state] || ["anonymous_write_grant_unavailable", 503];

  return getAnonymousWriteErrorResponse(code, status);
}

function hasAnonymousWriteHeader(request) {
  return Boolean(
    request.headers.get(ANONYMOUS_TRACK_WRITE_HEADER) ||
    request.headers.get(LEGACY_ANONYMOUS_WRITE_HEADER) ||
    request.headers.get("x-kbeauty-result-write-token")
  );
}

async function findAnonymousTrackLog(supabase, grantUseId) {
  if (!grantUseId) {
    return null;
  }

  const { data, error } = await supabase
    .from("recommendation_logs")
    .select("id")
    .eq("anonymous_write_grant_use_id", grantUseId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function dedupeAccountFeedback(supabase, payload) {
  if (payload.event_name !== "feedback_response" || !payload.session_id || !payload.question_id) {
    return false;
  }

  let duplicateQuery = supabase
    .from("recommendation_logs")
    .select("id")
    .eq("event_name", payload.event_name)
    .eq("session_id", payload.session_id)
    .eq("question_id", payload.question_id)
    .eq("result_type", payload.result_type)
    .limit(1);

  duplicateQuery = payload.product_id
    ? duplicateQuery.eq("product_id", payload.product_id)
    : duplicateQuery.is("product_id", null);

  const { data, error } = await duplicateQuery;

  if (error) {
    console.error("[api/track] account feedback dedupe lookup failed", { message: error.message });
    return false;
  }

  return Boolean(data?.length);
}

export async function POST(request) {
  let supabase = null;
  let anonymousGrant = null;
  let anonymousFingerprint = null;
  let anonymousClaimUseId = null;
  let accountUser = false;

  try {
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

    const currentUser = await getRouteSupabaseUser(request);
    accountUser = isAccountUser(currentUser);

    if (accountUser && hasAnonymousWriteHeader(request)) {
      return getAnonymousWriteErrorResponse("anonymous_write_token_mixed", 400);
    }

    if (!accountUser && Object.keys(body || {}).some((key) => !TRACK_BODY_KEYS.has(key))) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid tracking payload."
        },
        { status: 400 }
      );
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

    supabase = createSupabaseAdminClient();

    if (!supabase) {
      return accountUser
        ? NextResponse.json({ success: false, error: "Supabase environment variables are missing." }, { status: 500 })
        : getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
    }

    if (!accountUser) {
      if (request.headers.get(LEGACY_ANONYMOUS_WRITE_HEADER)) {
        return getAnonymousWriteErrorResponse("anonymous_write_token_invalid", 401);
      }

      anonymousGrant = verifyAnonymousWriteGrantForRequest({
        request,
        headerName: ANONYMOUS_TRACK_WRITE_HEADER,
        expectedOperation: "track:create"
      });

      if (!anonymousGrant.ok) {
        const code = anonymousGrant.code === "missing"
          ? "anonymous_write_token_required"
          : anonymousGrant.code === "expired"
            ? "anonymous_write_token_expired"
            : anonymousGrant.code === "operation_mismatch"
              ? "anonymous_write_token_scope_mismatch"
              : anonymousGrant.code === "principal_mismatch" || anonymousGrant.code === "principal_missing"
                ? "anonymous_write_principal_mismatch"
                : anonymousGrant.code === "unavailable" || anonymousGrant.code === "misconfigured"
                  ? "anonymous_write_grant_unavailable"
                  : "anonymous_write_token_invalid";
        const status = code === "anonymous_write_grant_unavailable" ? 503 : code.includes("mismatch") ? 403 : 401;

        return getAnonymousWriteErrorResponse(code, status);
      }

      if (body?.analysisRunId !== anonymousGrant.payload.resourceId) {
        return getAnonymousWriteErrorResponse("anonymous_write_resource_mismatch", 403);
      }

      anonymousFingerprint = createAnonymousTrackRequestFingerprint({
        analysisRunId: anonymousGrant.payload.resourceId,
        payload
      });

      if (!anonymousFingerprint) {
        return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }

      const claimResult = await claimAnonymousWriteGrant({
        supabase,
        grant: anonymousGrant,
        requestFingerprintHash: anonymousFingerprint
      });

      if (!claimResult.ok) {
        return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }

      if (claimResult.claim.state === "completed") {
        return NextResponse.json({ success: true, deduped: true });
      }

      if (claimResult.claim.state !== "claimed") {
        return getGrantClaimErrorResponse(claimResult.claim.state);
      }

      anonymousClaimUseId = claimResult.claim.use_id || null;

      const existingLog = await findAnonymousTrackLog(supabase, anonymousClaimUseId);

      if (existingLog) {
        const completion = await completeAnonymousWriteGrant({
          supabase,
          grant: anonymousGrant,
          requestFingerprintHash: anonymousFingerprint
        });

        return completion.ok
          ? NextResponse.json({ success: true, deduped: true })
          : getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }
    } else if (await dedupeAccountFeedback(supabase, payload)) {
      return NextResponse.json({ success: true, deduped: true });
    }

    const insertPayload = {
      ...payload,
      user_id: accountUser ? currentUser.id : null,
      ...(anonymousGrant ? { anonymous_write_grant_use_id: anonymousClaimUseId } : {})
    };

    if (anonymousGrant && !insertPayload.anonymous_write_grant_use_id) {
      return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
    }

    const { error } = await supabase
      .from("recommendation_logs")
      .insert([insertPayload]);

    if (error) {
      if (anonymousGrant && error.code === "23505") {
        const existingLog = await findAnonymousTrackLog(
          supabase,
          insertPayload.anonymous_write_grant_use_id
        );

        if (existingLog) {
          const completion = await completeAnonymousWriteGrant({
            supabase,
            grant: anonymousGrant,
            requestFingerprintHash: anonymousFingerprint
          });

          return completion.ok
            ? NextResponse.json({ success: true, deduped: true })
            : getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
        }
      }

      if (anonymousGrant) {
        const failure = await failAnonymousWriteGrant({
          supabase,
          grant: anonymousGrant,
          requestFingerprintHash: anonymousFingerprint
        });

        if (!failure.ok) {
          return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
        }
      }

      console.error("[api/track] insert failed", { message: error.message });

      return NextResponse.json(
        {
          success: false,
          error: accountUser ? error.message : "tracking_store_failed"
        },
        { status: 500 }
      );
    }

    if (anonymousGrant) {
      const completion = await completeAnonymousWriteGrant({
        supabase,
        grant: anonymousGrant,
        requestFingerprintHash: anonymousFingerprint
      });

      if (!completion.ok) {
        return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    if (anonymousGrant && anonymousFingerprint && supabase) {
      const failure = await failAnonymousWriteGrant({
        supabase,
        grant: anonymousGrant,
        requestFingerprintHash: anonymousFingerprint
      });

      if (!failure.ok) {
        return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }
    }

    console.error("[api/track] request failed", {
      message: error instanceof Error ? error.message : "unknown"
    });

    return NextResponse.json(
      {
        success: false,
        error: accountUser ? "Failed to store event." : "tracking_store_failed"
      },
      { status: 500 }
    );
  }
}
