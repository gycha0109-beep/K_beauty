import { NextResponse } from "next/server";
import {
  buildAnalysisRequestRow,
  buildAnalysisResultRow,
  createShareId,
  getSharePath
} from "@/lib/analysis-results";
import { getAnalysisResultOwnerUserId } from "@/lib/analysis-result-access";
import {
  ANONYMOUS_RESULT_WRITE_HEADER,
  LEGACY_ANONYMOUS_WRITE_HEADER,
  claimAnonymousWriteGrant,
  completeAnonymousWriteGrant,
  createAnonymousResultRequestFingerprint,
  failAnonymousWriteGrant,
  verifyAnonymousWriteGrantForRequest
} from "@/lib/security/anonymous-write-grant";
import {
  canonicalizeAnonymousResultForPersistence,
  canonicalizeAnonymousSurveyForPersistence
} from "@/lib/security/anonymous-write-grant-core";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getRouteSupabaseUser } from "@/lib/supabase/server-client";
import { consumeRateLimit, getRequestClientKey } from "@/lib/write-access";

const SAVE_RESULTS_LIMIT = 10;
const SAVE_RESULTS_WINDOW_MS = 10 * 60 * 1000;
const USER_ID_COLUMN_SUPPORT = new Map();
const ANONYMOUS_FORM_KEYS = new Set([
  "skinType",
  "sensitivity",
  "sensitivityLevel",
  "mainConcern",
  "mainConcerns",
  "primaryConcern",
  "recentSkinChange",
  "recentlyChangedProduct",
  "cleansingFrequency",
  "preferredTexture",
  "texturePreference",
  "postWashFeeling",
  "postCleanseFeel",
  "afternoonSkinChange",
  "afternoonState",
  "environmentExposure",
  "mostDislikedFeel",
  "dislikedFeel",
  "genderPreference",
  "whiteCastHate",
  "toneUpWanted",
  "makeupUse",
  "eyeSensitive",
  "sunscreenPreferenceState",
  "outdoorExposure",
  "verySensitivePeriod"
]);

function isAccountUser(user) {
  return Boolean(user) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

function getResultSaveErrorMessage() {
  return "Failed to save result.";
}

function getAnonymousWriteErrorResponse(code, status) {
  const messages = {
    anonymous_write_token_required: "The analysis save session is missing. Please run the analysis again.",
    anonymous_write_token_invalid: "The analysis save session is invalid. Please run the analysis again.",
    anonymous_write_token_expired: "The analysis save session expired. Please run the analysis again.",
    anonymous_write_token_scope_mismatch: "This analysis save session cannot be used here.",
    anonymous_write_principal_mismatch: "The analysis save session belongs to a different browser.",
    anonymous_write_resource_mismatch: "The analysis save session does not match this result.",
    anonymous_write_replayed: "This analysis result was already saved.",
    anonymous_write_in_progress: "This analysis result is already being saved.",
    anonymous_write_grant_unavailable: "We cannot save the result right now. Please try again shortly.",
    anonymous_write_token_mixed: "Use either an account session or an anonymous save session."
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
    request.headers.get(ANONYMOUS_RESULT_WRITE_HEADER) ||
    request.headers.get(LEGACY_ANONYMOUS_WRITE_HEADER) ||
    request.headers.get("x-kbeauty-track-write-token")
  );
}

function pickAllowedObject(source, allowedKeys) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return null;
  }

  if (Object.keys(source).some((key) => !allowedKeys.has(key))) {
    return null;
  }

  return Object.entries(source).reduce((next, [key, value]) => {
    if (allowedKeys.has(key)) {
      next[key] = value;
    }

    return next;
  }, {});
}

function normalizeAnonymousSubmission(submission) {
  const form = pickAllowedObject(submission?.form, ANONYMOUS_FORM_KEYS);

  if (!form) {
    return null;
  }

  return {
    form: canonicalizeAnonymousSurveyForPersistence(form)
  };
}

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
      return { saved: data, replayed: false };
    }

    if (!error || error.code !== "23505") {
      throw error || new Error("Failed to save analysis result.");
    }

    if (payload.anonymousWriteGrantUseId) {
      const existing = await findAnonymousResultForGrantUse(supabase, payload.anonymousWriteGrantUseId);

      if (existing) {
        return { saved: existing, replayed: true };
      }
    }
  }

  throw new Error("Could not generate a unique share id.");
}

async function supportsUserIdColumn(supabase, tableName) {
  if (USER_ID_COLUMN_SUPPORT.has(tableName)) {
    return USER_ID_COLUMN_SUPPORT.get(tableName);
  }

  const { error } = await supabase
    .from(tableName)
    .select("id, user_id")
    .limit(1);

  if (error?.code === "42703") {
    USER_ID_COLUMN_SUPPORT.set(tableName, false);
    return false;
  }

  if (error) {
    console.error(`[api/results] failed to inspect ${tableName}.user_id support`, error);
  }

  USER_ID_COLUMN_SUPPORT.set(tableName, true);
  return true;
}

async function createAnalysisRequest(supabase, payload) {
  const row = buildAnalysisRequestRow(payload);
  const { data, error } = await supabase
    .from("analysis_requests")
    .insert([row])
    .select("id")
    .single();

  if (error || !data?.id) {
    throw error || new Error("Failed to create analysis request.");
  }

  return data.id;
}

async function findAnonymousResultForGrantUse(supabase, grantUseId) {
  if (!grantUseId) {
    return null;
  }

  const { data, error } = await supabase
    .from("analysis_results")
    .select("id, share_id, created_at, locale")
    .eq("anonymous_write_grant_use_id", grantUseId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function publishExistingShare(supabase, { shareId, userId }) {
  if (!shareId || !userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("analysis_results")
    .update({ is_public: true })
    .eq("share_id", shareId)
    .eq("user_id", userId)
    .select("id, share_id, created_at, locale, is_public")
    .single();

  if (error || !data) {
    throw error || new Error("share_not_found");
  }

  return data;
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

function createSavedResultResponse(saved, options = {}) {
  return NextResponse.json({
    success: true,
    shareId: saved.share_id,
    sharePath: getSharePath(saved.share_id),
    createdAt: saved.created_at,
    locale: saved.locale,
    ...(options.replayed ? { replayed: true } : {})
  });
}

export async function POST(request) {
  let requestId = null;
  let anonymousGrant = null;
  let anonymousFingerprint = null;
  let anonymousClaimUseId = null;
  let supabase = null;

  try {
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
    const requestedShareId = typeof body?.shareId === "string" ? body.shareId.trim() : "";
    const currentUser = await getRouteSupabaseUser(request);
    const accountUser = isAccountUser(currentUser);

    if (accountUser && hasAnonymousWriteHeader(request)) {
      return getAnonymousWriteErrorResponse("anonymous_write_token_mixed", 400);
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

    supabase = createSupabaseAdminClient();

    if (!supabase) {
      return accountUser
        ? NextResponse.json({ success: false, error: getResultSaveErrorMessage() }, { status: 500 })
        : getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
    }

    if (share && requestedShareId) {
      const ownerUserId = accountUser ? currentUser.id : await getAnalysisResultOwnerUserId(request);

      if (!ownerUserId) {
        return getUnauthorizedResponse();
      }

      const published = await publishExistingShare(supabase, {
        shareId: requestedShareId,
        userId: ownerUserId
      });

      return NextResponse.json({
        success: true,
        shareId: published.share_id,
        sharePath: getSharePath(published.share_id),
        createdAt: published.created_at,
        locale: published.locale,
        publicShared: Boolean(published.is_public)
      });
    }

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

    const resolvedUserId = accountUser ? currentUser.id : null;
    let resultForStorage = result;
    let submissionForStorage = submission;

    if (!accountUser) {
      if (request.headers.get(LEGACY_ANONYMOUS_WRITE_HEADER)) {
        return getAnonymousWriteErrorResponse("anonymous_write_token_invalid", 401);
      }

      anonymousGrant = verifyAnonymousWriteGrantForRequest({
        request,
        headerName: ANONYMOUS_RESULT_WRITE_HEADER,
        expectedOperation: "result:create"
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

      resultForStorage = canonicalizeAnonymousResultForPersistence(result);
      submissionForStorage = normalizeAnonymousSubmission(submission);

      if (!resultForStorage || !submissionForStorage) {
        return NextResponse.json(
          { success: false, error: "Invalid analysis result payload." },
          { status: 400 }
        );
      }

      anonymousFingerprint = createAnonymousResultRequestFingerprint({
        result: resultForStorage,
        submission: submissionForStorage,
        locale
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

      anonymousClaimUseId = claimResult.claim.use_id || null;

      if (!anonymousClaimUseId) {
        return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }

      if (["completed", "in_progress"].includes(claimResult.claim.state)) {
        const existing = await findAnonymousResultForGrantUse(supabase, anonymousClaimUseId);

        if (existing) {
          if (claimResult.claim.state === "in_progress") {
            const completion = await completeAnonymousWriteGrant({
              supabase,
              grant: anonymousGrant,
              requestFingerprintHash: anonymousFingerprint,
              resultReference: {
                result_id: existing.id,
                share_id: existing.share_id
              }
            });

            if (!completion.ok) {
              return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
            }
          }

          return createSavedResultResponse(existing, { replayed: true });
        }

        return getGrantClaimErrorResponse(claimResult.claim.state);
      }

      if (claimResult.claim.state !== "claimed") {
        return getGrantClaimErrorResponse(claimResult.claim.state);
      }

      const existing = await findAnonymousResultForGrantUse(supabase, anonymousClaimUseId);

      if (existing) {
        const completion = await completeAnonymousWriteGrant({
          supabase,
          grant: anonymousGrant,
          requestFingerprintHash: anonymousFingerprint,
          resultReference: {
            result_id: existing.id,
            share_id: existing.share_id
          }
        });

        return completion.ok
          ? createSavedResultResponse(existing, { replayed: true })
          : getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }
    }

    const [requestSupportsUserId, resultSupportsUserId] = await Promise.all([
      supportsUserIdColumn(supabase, "analysis_requests"),
      supportsUserIdColumn(supabase, "analysis_results")
    ]);

    requestId = await createAnalysisRequest(supabase, {
      submission: submissionForStorage,
      userId: resolvedUserId,
      supportsUserId: requestSupportsUserId
    });

    const insertion = await insertAnalysisResult(supabase, {
      result: resultForStorage,
      submission: submissionForStorage,
      locale,
      requestId,
      userId: resolvedUserId,
      supportsUserId: resultSupportsUserId,
      isPublic: true,
      anonymousWriteGrantUseId: anonymousClaimUseId
    });
    const saved = insertion.saved;

    if (insertion.replayed && requestId) {
      await supabase
        .from("analysis_requests")
        .delete()
        .eq("id", requestId);
      requestId = null;
    }

    if (anonymousGrant) {
      const completion = await completeAnonymousWriteGrant({
        supabase,
        grant: anonymousGrant,
        requestFingerprintHash: anonymousFingerprint,
        resultReference: {
          result_id: saved.id,
          share_id: saved.share_id
        }
      });

      if (!completion.ok) {
        return getAnonymousWriteErrorResponse("anonymous_write_grant_unavailable", 503);
      }
    }

    return createSavedResultResponse(saved, { replayed: insertion.replayed });
  } catch (error) {
    console.error("[api/results] save failed", {
      message: error instanceof Error ? error.message : "unknown"
    });

    if (requestId && supabase) {
      try {
        await supabase
          .from("analysis_requests")
          .delete()
          .eq("id", requestId);
      } catch {
        console.error("[api/results] request cleanup failed");
      }
    }

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

    return NextResponse.json(
      {
        success: false,
        error: getResultSaveErrorMessage()
      },
      { status: 500 }
    );
  }
}
