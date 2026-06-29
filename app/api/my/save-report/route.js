import { NextResponse } from "next/server";
import {
  buildAnalysisRequestRow,
  buildAnalysisResultRow,
  createShareId,
  getSharePath
} from "@/lib/analysis-results";
import { upsertProfileForUser, isSchemaCacheError, serializeSupabaseError } from "@/lib/auth/profile-upsert";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const REPORT_TYPES = new Set(["free", "premium"]);
const SOURCE_TYPES = new Set(["session", "premium_report_session", "share", "manual"]);

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asPlainObject(value) {
  return isPlainObject(value) ? value : {};
}

function getPath(source, path) {
  return path.reduce((current, key) => {
    if (!isPlainObject(current) && !Array.isArray(current)) {
      return undefined;
    }

    return current?.[key];
  }, source);
}

function pickString(...values) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function normalizeStringArray(...values) {
  const items = [];

  for (const value of values) {
    const source = Array.isArray(value) ? value : value ? [value] : [];

    for (const item of source) {
      if (typeof item !== "string") {
        continue;
      }

      const trimmed = item.trim();
      if (trimmed && !items.includes(trimmed)) {
        items.push(trimmed);
      }
    }
  }

  return items;
}

function getPreferences(surveyForm) {
  const preferenceKeys = [
    "preferredFinish",
    "preferredTexture",
    "sunscreenPreference",
    "mostDislikedFeel",
    "budget",
    "routinePreference",
    "toneUpPreference",
    "coveragePreference",
    "makeupFrequency"
  ];
  const preferences = {};

  if (isPlainObject(surveyForm.preferences)) {
    Object.assign(preferences, surveyForm.preferences);
  }

  for (const key of preferenceKeys) {
    if (surveyForm[key] !== undefined) {
      preferences[key] = surveyForm[key];
    }
  }

  return Object.keys(preferences).length ? preferences : null;
}

function getPhotoAnalysis(body, freeResult, faceLab) {
  return (
    body.photoAnalysis ??
    body.photo_analysis ??
    freeResult.photoAnalysis ??
    freeResult.photo_analysis ??
    freeResult.photoObservations ??
    faceLab.photoAnalysis ??
    faceLab.photo_observations ??
    null
  );
}

function buildSkinProfilePayload({ userId, body }) {
  const freeResult = asPlainObject(body.freeResult);
  const faceLab = asPlainObject(body.faceLab);
  const surveySnapshot = asPlainObject(body.surveySnapshot);
  const surveyForm = asPlainObject(surveySnapshot.form || surveySnapshot);
  const concerns = normalizeStringArray(
    freeResult.concerns,
    freeResult.mainConcerns,
    getPath(freeResult, ["priority", "axis"]),
    surveyForm.mainConcerns,
    surveyForm.mainConcern,
    surveyForm.secondaryConcerns
  );

  return {
    user_id: userId,
    skin_type: pickString(
      freeResult.skinType,
      freeResult.skin_type,
      getPath(freeResult, ["profile", "skinType"]),
      surveyForm.skinType,
      surveyForm.skin_type
    ),
    concerns,
    sensitivity_level: pickString(
      freeResult.sensitivityLevel,
      freeResult.sensitivity_level,
      surveyForm.sensitivityLevel,
      surveyForm.sensitivity_level,
      surveyForm.sensitivity,
      surveyForm.skinSensitivity
    ),
    skin_summary: pickString(
      freeResult.summary,
      freeResult.directionSummary,
      getPath(freeResult, ["photoObservations", "summary"]),
      getPath(freeResult, ["meta", "notice"])
    ),
    face_summary: pickString(
      faceLab.summary,
      getPath(faceLab, ["base_data", "summary"]),
      getPath(faceLab, ["paid", "summary"]),
      getPath(freeResult, ["faceLab", "summary"])
    ),
    preferences: getPreferences(surveyForm),
    photo_analysis: getPhotoAnalysis(body, freeResult, faceLab),
    survey_snapshot: Object.keys(surveySnapshot).length ? surveySnapshot : null,
    result_snapshot: Object.keys(freeResult).length ? freeResult : null,
    is_active: true
  };
}

function buildSavedReportPayload({ userId, skinProfileId, body }) {
  const freeResult = asPlainObject(body.freeResult);
  const faceLab = asPlainObject(body.faceLab);
  const reportType = REPORT_TYPES.has(body.reportType) ? body.reportType : "free";
  const sourceType = SOURCE_TYPES.has(body.sourceType) ? body.sourceType : "session";

  return {
    user_id: userId,
    skin_profile_id: skinProfileId,
    report_type: reportType,
    source_type: sourceType,
    source_session_id: pickString(body.sourceSessionId, body.source_session_id),
    title: pickString(body.title, freeResult.title, "Free skin report"),
    report_version: pickString(body.reportVersion, body.report_version, "free-v1"),
    free_result: reportType === "free" ? freeResult : null,
    premium_report: reportType === "premium" ? (body.premiumReport ?? freeResult.premiumReport ?? null) : null,
    face_lab: Object.keys(faceLab).length ? faceLab : null
  };
}

function buildAnalysisSubmission(body) {
  const surveySnapshot = asPlainObject(body.surveySnapshot);
  const form = asPlainObject(surveySnapshot.form || surveySnapshot);

  return {
    ...surveySnapshot,
    form
  };
}

async function createPrivateShareResult({ body, userId }) {
  const freeResult = asPlainObject(body.freeResult);
  const submission = buildAnalysisSubmission(body);
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    throw new Error("supabase_admin_unavailable");
  }

  if (!Object.keys(freeResult).length || !Object.keys(submission.form).length) {
    throw new Error("analysis_result_payload_missing");
  }

  const requestRow = buildAnalysisRequestRow({
    submission,
    userId,
    supportsUserId: true
  });
  const { data: requestRowData, error: requestError } = await supabase
    .from("analysis_requests")
    .insert([requestRow])
    .select("id")
    .single();

  if (requestError || !requestRowData?.id) {
    throw requestError || new Error("analysis_request_insert_failed");
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const shareId = createShareId();
    const resultRow = buildAnalysisResultRow({
      result: freeResult,
      submission,
      locale: body.locale === "en" ? "en" : "ko",
      shareId,
      requestId: requestRowData.id,
      userId,
      supportsUserId: true,
      isPublic: false
    });
    const { data, error } = await supabase
      .from("analysis_results")
      .insert([resultRow])
      .select("id, request_id, share_id, created_at, locale")
      .single();

    if (!error && data?.share_id) {
      return data;
    }

    if (!error || error.code !== "23505") {
      throw error || new Error("analysis_result_insert_failed");
    }
  }

  throw new Error("share_id_generation_failed");
}

function getDbErrorResponse(label, error) {
  const serializedError = serializeSupabaseError(error);

  console.error(`[my/save-report] ${label}`, {
    error: serializedError
  });

  return NextResponse.json(
    {
      error: isSchemaCacheError(error) ? "revisit_schema_unavailable" : label,
      message: error?.message || "save_report_failed",
      code: error?.code || null
    },
    { status: isSchemaCacheError(error) ? 503 : 500 }
  );
}

function isAccountUser(user) {
  return Boolean(user) && !user.is_anonymous && user.app_metadata?.provider !== "anonymous";
}

async function restorePreviousActiveProfile({ supabase, userId, skinProfileId, previousActiveProfileId }) {
  const deleteResult = await supabase
    .from("skin_profiles")
    .delete()
    .eq("id", skinProfileId)
    .eq("user_id", userId);

  if (deleteResult.error) {
    console.error("[my/save-report] skin profile cleanup failed", {
      error: serializeSupabaseError(deleteResult.error),
      skinProfileId
    });
  }

  if (!previousActiveProfileId) {
    return;
  }

  const restoreResult = await supabase
    .from("skin_profiles")
    .update({ is_active: true })
    .eq("id", previousActiveProfileId)
    .eq("user_id", userId);

  if (restoreResult.error) {
    console.error("[my/save-report] previous active profile restore failed", {
      error: serializeSupabaseError(restoreResult.error),
      previousActiveProfileId
    });
  }
}

export async function POST(request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !isAccountUser(user)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const profileResult = await upsertProfileForUser({
    supabase,
    user,
    preferAdmin: true
  });

  if (profileResult.error) {
    console.error("[my/save-report] profile upsert failed", {
      error: serializeSupabaseError(profileResult.error),
      method: profileResult.method,
      payload: profileResult.payload,
      attempts: profileResult.attempts
    });

    if (!isSchemaCacheError(profileResult.error)) {
      return NextResponse.json(
        {
          error: "profile_upsert_failed",
          message: profileResult.error.message || "profile_upsert_failed"
        },
        { status: 500 }
      );
    }
  }

  const { data: previousActiveProfiles, error: previousActiveError } = await supabase
    .from("skin_profiles")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  if (previousActiveError) {
    return getDbErrorResponse("previous_active_skin_profile_lookup_failed", previousActiveError);
  }

  const previousActiveProfileId = previousActiveProfiles?.[0]?.id || null;
  const deactivateResult = await supabase
    .from("skin_profiles")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (deactivateResult.error) {
    return getDbErrorResponse("skin_profile_deactivate_failed", deactivateResult.error);
  }

  const skinProfilePayload = buildSkinProfilePayload({
    userId: user.id,
    body
  });
  const { data: skinProfile, error: skinProfileError } = await supabase
    .from("skin_profiles")
    .insert(skinProfilePayload)
    .select("id")
    .single();

  if (skinProfileError) {
    return getDbErrorResponse("skin_profile_insert_failed", skinProfileError);
  }

  let privateShareResult = null;

  try {
    privateShareResult = await createPrivateShareResult({
      body,
      userId: user.id
    });
  } catch (error) {
    await restorePreviousActiveProfile({
      supabase,
      userId: user.id,
      skinProfileId: skinProfile.id,
      previousActiveProfileId
    });

    return getDbErrorResponse("analysis_result_insert_failed", error);
  }

  const savedReportPayload = buildSavedReportPayload({
    userId: user.id,
    skinProfileId: skinProfile.id,
    body
  });
  const linkedSavedReportPayload = privateShareResult?.share_id
    ? {
        ...savedReportPayload,
        source_type: "share",
        source_session_id: privateShareResult.share_id
      }
    : savedReportPayload;
  const { data: savedReport, error: savedReportError } = await supabase
    .from("saved_reports")
    .insert(linkedSavedReportPayload)
    .select("id")
    .single();

  if (savedReportError) {
    await restorePreviousActiveProfile({
      supabase,
      userId: user.id,
      skinProfileId: skinProfile.id,
      previousActiveProfileId
    });

    if (privateShareResult?.request_id) {
      await createSupabaseAdminClient()
        ?.from("analysis_requests")
        .delete()
        .eq("id", privateShareResult.request_id);
    }

    return getDbErrorResponse("saved_report_insert_failed", savedReportError);
  }

  return NextResponse.json(
    {
      skinProfileId: skinProfile.id,
      savedReportId: savedReport.id,
      shareId: privateShareResult?.share_id || null,
      sharePath: privateShareResult?.share_id ? getSharePath(privateShareResult.share_id) : null,
      publicShared: false
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
