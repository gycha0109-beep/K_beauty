import { NextResponse } from "next/server";
import { isAccountUser } from "@/lib/premium-access";
import { resolvePremiumRouteContext } from "@/lib/premium-route-context";
import { getFaceLabObservationAnalysis } from "@/lib/face-lab-analysis-bundle";
import { sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import { buildFaceLabV2Canonical } from "@/lib/face-lab-v2/canonical-composer";
import {
  normalizeFaceLabV2PersistencePayload
} from "@/lib/face-lab-v2/survey-contract";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";

const SAVED_FACE_LAB_V2_VERSION = "face-lab-saved-v2";

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

async function resolveOwnedSavedReport({ supabase, userId, savedReportId }) {
  if (!supabase || !userId || !savedReportId) {
    return { data: null, error: new Error("saved_report_lookup_unavailable") };
  }

  return supabase
    .from("saved_reports")
    .select("id, premium_report, face_lab, face_lab_revision")
    .eq("id", savedReportId)
    .eq("user_id", userId)
    .eq("report_type", "premium")
    .maybeSingle();
}

function sanitizeLegacySummary(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return sanitizePremiumFaceLabSummary(value);
}

function readSavedV2(faceLab) {
  if (
    !faceLab ||
    typeof faceLab !== "object" ||
    Array.isArray(faceLab) ||
    faceLab.schemaVersion !== SAVED_FACE_LAB_V2_VERSION
  ) {
    return null;
  }

  return {
    schemaVersion: SAVED_FACE_LAB_V2_VERSION,
    surveyAnswers: faceLab.surveyAnswers || null,
    targetFinderResult: faceLab.targetFinderResult || null,
    selectedRouteId: faceLab.selectedRouteId || null,
    updatedAt: faceLab.updatedAt || null
  };
}

function rehydrateSavedV2(data) {
  const saved = readSavedV2(data?.face_lab);
  if (!saved) return null;

  const analysis = getFaceLabObservationAnalysis(data?.premium_report?.faceLabAnalysis);
  if (!analysis) {
    return {
      ...saved,
      canonicalV2: null
    };
  }

  const normalized = normalizeFaceLabV2PersistencePayload(saved);
  const canonicalV2 = buildFaceLabV2Canonical({
    analysis,
    surveyAnswers: normalized.surveyAnswers,
    targetFinderResult: normalized.targetFinderResult,
    selectedRouteId: normalized.selectedRouteId,
    locale: data?.premium_report?.locale === "en" ? "en" : "ko",
    resultId: data?.id || null,
    analyzedAt: data?.premium_report?.faceLabSummary?.analyzedAt || null
  });

  return {
    schemaVersion: SAVED_FACE_LAB_V2_VERSION,
    surveyAnswers: normalized.surveyAnswers,
    targetFinderResult: normalized.targetFinderResult,
    selectedRouteId: canonicalV2.routes?.selectedRouteId || normalized.selectedRouteId || null,
    canonicalV2,
    updatedAt: saved.updatedAt || null
  };
}

export async function GET(request) {
  const context = await resolvePremiumRouteContext(request);
  const { user, supabase } = context;

  if (!isAccountUser(user) || !supabase) {
    return json({ success: false, error: "login_required" }, { status: 401 });
  }

  const savedReportId = new URL(request.url).searchParams.get("savedReportId");
  if (!savedReportId) {
    return json({ success: false, error: "saved_report_id_required" }, { status: 400 });
  }

  const { data, error } = await resolveOwnedSavedReport({
    supabase,
    userId: user.id,
    savedReportId
  });

  if (error) {
    writeSafeLog("warn", {
      event: "face_lab_v2_load_failed",
      category: "database_unavailable",
      operation: "face_lab_v2_load",
      dependency: "supabase",
      retryable: true
    });
    return json({ success: false, error: "face_lab_v2_load_failed" }, { status: 503 });
  }

  if (!data) {
    return json({ success: false, error: "saved_report_not_found" }, { status: 404 });
  }

  return json({
    success: true,
    savedReportId: data.id,
    revision: Number.isSafeInteger(data.face_lab_revision) ? data.face_lab_revision : 0,
    faceLabV2: rehydrateSavedV2(data)
  });
}

export async function POST(request) {
  let body = null;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, { status: 400 });
  }

  const context = await resolvePremiumRouteContext(request);
  const { user, supabase } = context;

  if (!isAccountUser(user) || !supabase) {
    return json({ success: false, error: "login_required" }, { status: 401 });
  }

  const savedReportId =
    typeof body?.savedReportId === "string" && body.savedReportId.trim()
      ? body.savedReportId.trim()
      : null;

  if (!savedReportId) {
    return json({ success: false, error: "saved_report_id_required" }, { status: 400 });
  }

  const expectedRevision = body?.expectedRevision;
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
    return json({ success: false, error: "expected_revision_required" }, { status: 400 });
  }

  const { data, error } = await resolveOwnedSavedReport({
    supabase,
    userId: user.id,
    savedReportId
  });

  if (error) {
    writeSafeLog("warn", {
      event: "face_lab_v2_save_failed",
      category: "database_unavailable",
      operation: "face_lab_v2_save",
      dependency: "supabase",
      retryable: true
    });
    return json({ success: false, error: "face_lab_v2_load_failed" }, { status: 503 });
  }

  if (!data) {
    return json({ success: false, error: "saved_report_not_found" }, { status: 404 });
  }

  const analysis = getFaceLabObservationAnalysis(data.premium_report?.faceLabAnalysis);
  if (!analysis) {
    return json({ success: false, error: "face_lab_analysis_unavailable" }, { status: 409 });
  }

  const normalized = normalizeFaceLabV2PersistencePayload(body);
  const canonicalV2 = buildFaceLabV2Canonical({
    analysis,
    surveyAnswers: normalized.surveyAnswers,
    targetFinderResult: normalized.targetFinderResult,
    selectedRouteId: normalized.selectedRouteId,
    locale: data.premium_report?.locale === "en" ? "en" : "ko",
    resultId: savedReportId,
    analyzedAt: data.premium_report?.faceLabSummary?.analyzedAt || null
  });

  if (canonicalV2?.targetStyle?.status !== "available") {
    return json({
      success: false,
      error: "target_style_not_confirmed"
    }, { status: 400 });
  }

  const previousV2 = readSavedV2(data.face_lab);
  const legacySummary = sanitizeLegacySummary(
    previousV2
      ? data.face_lab?.legacySummary || null
      : data.face_lab || null
  );

  const persisted = {
    schemaVersion: SAVED_FACE_LAB_V2_VERSION,
    legacySummary,
    surveyAnswers: normalized.surveyAnswers,
    targetFinderResult: normalized.targetFinderResult,
    selectedRouteId: canonicalV2.routes?.selectedRouteId || normalized.selectedRouteId || null,
    updatedAt: new Date().toISOString()
  };

  const nextRevision = expectedRevision + 1;
  const { data: updated, error: updateError } = await supabase
    .from("saved_reports")
    .update({
      face_lab: persisted,
      face_lab_revision: nextRevision
    })
    .eq("id", savedReportId)
    .eq("user_id", user.id)
    .eq("report_type", "premium")
    .eq("face_lab_revision", expectedRevision)
    .select("id, face_lab, face_lab_revision")
    .maybeSingle();

  if (updateError) {
    writeSafeLog("warn", {
      event: "face_lab_v2_save_failed",
      category: "database_unavailable",
      operation: "face_lab_v2_save",
      dependency: "supabase",
      retryable: true
    });
    return json({ success: false, error: "face_lab_v2_save_failed" }, { status: 503 });
  }

  if (!updated) {
    const { data: current, error: currentError } = await resolveOwnedSavedReport({
      supabase,
      userId: user.id,
      savedReportId
    });

    if (currentError) {
      return json({ success: false, error: "face_lab_v2_load_failed" }, { status: 503 });
    }

    if (!current) {
      return json({ success: false, error: "saved_report_not_found" }, { status: 404 });
    }

    return json({
      success: false,
      error: "face_lab_state_conflict",
      currentRevision: Number.isSafeInteger(current.face_lab_revision)
        ? current.face_lab_revision
        : 0,
      faceLabV2: rehydrateSavedV2(current)
    }, { status: 409 });
  }

  return json({
    success: true,
    savedReportId,
    revision: updated.face_lab_revision,
    faceLabV2: {
      schemaVersion: SAVED_FACE_LAB_V2_VERSION,
      surveyAnswers: persisted.surveyAnswers,
      targetFinderResult: persisted.targetFinderResult,
      selectedRouteId: persisted.selectedRouteId,
      canonicalV2,
      updatedAt: persisted.updatedAt
    }
  });
}
