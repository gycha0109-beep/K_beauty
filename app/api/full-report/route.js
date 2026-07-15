import { NextResponse } from "next/server";
import { getOpenAiEnvDiagnostics } from "@/lib/openai-env-diagnostics";
import { upsertProfileForUser, serializeSupabaseError } from "@/lib/auth/profile-upsert";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { resolvePremiumAccessForRequest, isAccountUser } from "@/lib/premium-access";
import {
  buildPremiumCurrentProductsSnapshot,
  buildPremiumCurrentProductVerdicts
} from "@/lib/premium-current-products";
import { buildPremiumFaceLabSummary, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  updatePremiumReportSession,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";
import { sanitizePremiumReportPurchaseLinks } from "@/lib/product-purchase-link";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createRouteSupabaseAuthClient } from "@/lib/supabase/server-client";

const FULL_REPORT_RESPONSE_SCHEMA_VERSION = 1;

function buildFullReportMeta(locale, source = "premium-session") {
  return {
    schemaVersion: FULL_REPORT_RESPONSE_SCHEMA_VERSION,
    source,
    locale,
    generatedAt: new Date().toISOString()
  };
}

function hasFullReportPayloadShape(report) {
  return Boolean(
    report &&
    typeof report === "object" &&
    "freeResult" in report &&
    report.fullRoutine &&
    typeof report.fullRoutine === "object"
  );
}

const FULL_REPORT_UNAUTHORIZED_REASONS = new Set([
  "login_required",
  "premium_session_missing_or_expired"
]);

function getUnauthorizedResponse(reason) {
  const safeReason = FULL_REPORT_UNAUTHORIZED_REASONS.has(reason)
    ? reason
    : "login_required";

  return NextResponse.json(
    {
      success: false,
      error: safeReason
    },
    { status: 401 }
  );
}

function getPaymentRequiredResponse(access) {
  return NextResponse.json(
    {
      success: false,
      error: "premium_payment_required",
      reason: access?.reason || "payment_required",
      releaseMode: access?.releaseMode || "paid_only"
    },
    { status: 402 }
  );
}

function getPremiumUnavailableResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "premium_unavailable",
      reason: "premium_unavailable"
    },
    { status: 403 }
  );
}

function getPremiumPersistenceFailedResponse(code = "premium_save_failed") {
  return NextResponse.json(
    {
      success: false,
      error: code
    },
    { status: 503 }
  );
}

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}

function resolveFaceLabSummary({ storedPremiumReport, body, locale }) {
  const storedFaceLabSummary = sanitizePremiumFaceLabSummary(storedPremiumReport.faceLabSummary);

  if (storedFaceLabSummary.status === "available") {
    return {
      faceLabSummary: storedFaceLabSummary,
      shouldPersist: false
    };
  }

  const requestFaceLabSummary = body?.faceLab
    ? buildPremiumFaceLabSummary(body.faceLab, {
        locale,
        imageUrl: body?.imageUrl || storedFaceLabSummary.imageUrl,
        imageAlt: body?.imageAlt || storedFaceLabSummary.imageAlt
      })
    : null;

  if (requestFaceLabSummary?.status === "available") {
    return {
      faceLabSummary: requestFaceLabSummary,
      shouldPersist: true
    };
  }

  const legacyFaceLabSummary = storedPremiumReport.faceLab
    ? buildPremiumFaceLabSummary(storedPremiumReport.faceLab, {
        locale,
        imageUrl: storedFaceLabSummary.imageUrl,
        imageAlt: storedFaceLabSummary.imageAlt
      })
    : null;

  if (legacyFaceLabSummary?.status === "available") {
    return {
      faceLabSummary: legacyFaceLabSummary,
      shouldPersist: true
    };
  }

  return {
    faceLabSummary: storedFaceLabSummary,
    shouldPersist: false
  };
}

async function getUserSupabaseClient(request) {
  const accessToken = getBearerToken(request);
  return accessToken ? createRouteSupabaseAuthClient(accessToken) : null;
}

async function loadSavedPremiumReport({ supabase, userId, savedReportId }) {
  if (!supabase || !userId || !savedReportId) {
    return { data: null, error: new Error("saved_report_lookup_unavailable") };
  }

  return supabase
    .from("saved_reports")
    .select("id, report_type, premium_report, free_result, face_lab, created_at")
    .eq("id", savedReportId)
    .eq("user_id", userId)
    .eq("report_type", "premium")
    .maybeSingle();
}

async function persistPremiumSavedReport({ adminSupabase, user, sessionId, authoritativePremiumReport, locale }) {
  if (
    !adminSupabase ||
    !isAccountUser(user) ||
    !sessionId ||
    !authoritativePremiumReport ||
    typeof authoritativePremiumReport !== "object" ||
    Array.isArray(authoritativePremiumReport)
  ) {
    return { ok: false, code: "persist_not_available" };
  }

  const existing = await adminSupabase
    .from("saved_reports")
    .select("id")
    .eq("user_id", user.id)
    .eq("report_type", "premium")
    .eq("source_type", "premium_report_session")
    .eq("source_session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    console.error("[full-report] saved premium lookup failed", serializeSupabaseError(existing.error));
    return { ok: false, code: "lookup_failed" };
  }

  const payload = {
    user_id: user.id,
    report_type: "premium",
    source_type: "premium_report_session",
    source_session_id: sessionId,
    title: locale === "en" ? "Premium routine report" : "프리미엄 루틴 리포트",
    report_version: "premium-v1",
    premium_report: authoritativePremiumReport,
    free_result: null,
    face_lab: authoritativePremiumReport.faceLabSummary || authoritativePremiumReport.faceLab || null
  };

  if (existing.data?.id) {
    const { data, error } = await adminSupabase
      .from("saved_reports")
      .update({
        premium_report: payload.premium_report,
        face_lab: payload.face_lab,
        title: payload.title,
        report_version: payload.report_version
      })
      .eq("id", existing.data.id)
      .eq("user_id", user.id)
      .eq("report_type", "premium")
      .eq("source_type", "premium_report_session")
      .eq("source_session_id", sessionId)
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      console.error("[full-report] saved premium update failed", serializeSupabaseError(error));
      return { ok: false, code: "update_failed" };
    }

    return { ok: true, savedReportId: data.id };
  }

  const { data, error } = await adminSupabase
    .from("saved_reports")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    console.error("[full-report] saved premium insert failed", serializeSupabaseError(error));
    return { ok: false, code: "insert_failed" };
  }

  return { ok: true, savedReportId: data?.id || null };
}

async function applyCurrentProductsToReport({ report, body, locale }) {
  if (!Array.isArray(body?.currentProducts)) {
    return {
      premiumReport: report,
      changed: false
    };
  }

  const currentProducts = await buildPremiumCurrentProductsSnapshot(body.currentProducts);
  const currentProductVerdicts = currentProducts
    ? buildPremiumCurrentProductVerdicts(currentProducts, report, locale)
    : [];

  return {
    premiumReport: {
      ...report,
      currentProducts,
      currentProductVerdicts
    },
    changed: true
  };
}

export async function POST(request) {
  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[full-report] openai-env:diagnostic",
      getOpenAiEnvDiagnostics({
        route: "full-report",
        routeUsesOpenAi: false,
        routeUsesOpenRouter: false
      })
    );
  }

  let body = null;

  try {
    body = await request.json();
  } catch {}

  const locale = body?.locale === "en" ? "en" : "ko";
  const userSupabase = await getUserSupabaseClient(request);
  const { user, access } = await resolvePremiumAccessForRequest(request);

  if (body?.savedReportId) {
    if (!isAccountUser(user) || !userSupabase) {
      return getUnauthorizedResponse("login_required");
    }

    const { data: savedReport, error } = await loadSavedPremiumReport({
      supabase: userSupabase,
      userId: user.id,
      savedReportId: String(body.savedReportId)
    });

    if (error || !savedReport?.premium_report) {
      if (error) {
        console.error("[full-report] saved premium read failed", serializeSupabaseError(error));
      }
      return getUnauthorizedResponse("premium_session_missing_or_expired");
    }

    const savedPremiumReport = sanitizePremiumReportPurchaseLinks(savedReport.premium_report || {});
    const savedFreeResult =
      savedPremiumReport?.freeResult && typeof savedPremiumReport.freeResult === "object"
        ? savedPremiumReport.freeResult
        : null;
    const topPickFitGauges = buildProductFitGauges(body?.topPick || savedFreeResult?.topPick || null, { locale });

    return NextResponse.json({
      ...savedPremiumReport,
      topPickFitGauges,
      meta: buildFullReportMeta(locale, "saved-report")
    });
  }

  if (!access.canCreatePremium) {
    if (access.reason === "premium_unavailable") {
      return getPremiumUnavailableResponse();
    }

    return access.reason === "payment_required"
      ? getPaymentRequiredResponse(access)
      : getUnauthorizedResponse("login_required");
  }

  const premiumCookie = request.cookies.get(PREMIUM_REPORT_COOKIE)?.value || null;
  const premiumSession = await verifyPremiumReportSession(premiumCookie);

  if (!premiumSession.ok || !premiumSession.payload?.premiumReport) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[full-report] premium session rejected", premiumSession.code);
    }
    return getUnauthorizedResponse("premium_session_missing_or_expired");
  }

  let storedPremiumReport = premiumSession.payload.premiumReport || {};
  const currentProductsResult = await applyCurrentProductsToReport({
    report: storedPremiumReport,
    body,
    locale
  });
  storedPremiumReport = currentProductsResult.premiumReport;
  const { faceLabSummary, shouldPersist } = resolveFaceLabSummary({
    storedPremiumReport,
    body,
    locale
  });
  const responsePremiumReport = {
    ...storedPremiumReport,
    faceLabSummary
  };
  let authoritativePremiumReport = premiumSession.payload.premiumReport;

  if (shouldPersist || currentProductsResult.changed) {
    const updateResult = await updatePremiumReportSession(premiumCookie, {
      ...responsePremiumReport
    });

    if (!updateResult.ok || !updateResult.payload?.premiumReport) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[full-report] premium session update failed", updateResult.code);
      }
      return getPremiumPersistenceFailedResponse("premium_session_update_failed");
    }

    authoritativePremiumReport = updateResult.payload.premiumReport;
  }

  if (userSupabase && isAccountUser(user)) {
    await upsertProfileForUser({
      supabase: userSupabase,
      user,
      preferAdmin: true
    }).catch((error) => {
      console.warn("[full-report] profile upsert before premium save skipped", error?.message || error);
    });

    const adminSupabase = createSupabaseAdminClient();
    const persistResult = await persistPremiumSavedReport({
      adminSupabase,
      user,
      sessionId: premiumSession.payload.sessionId,
      authoritativePremiumReport,
      locale
    });

    if (!persistResult.ok) {
      return getPremiumPersistenceFailedResponse();
    }
  }

  if (process.env.NODE_ENV !== "production" && !hasFullReportPayloadShape(storedPremiumReport)) {
    console.warn("[full-report] response shape warning", {
      hasFreeResult: storedPremiumReport && "freeResult" in storedPremiumReport,
      hasFullRoutine: Boolean(storedPremiumReport?.fullRoutine)
    });
  }

  const clientPremiumReport = sanitizePremiumReportPurchaseLinks(responsePremiumReport);
  const storedFreeResult =
    clientPremiumReport?.freeResult && typeof clientPremiumReport.freeResult === "object"
      ? clientPremiumReport.freeResult
      : null;
  const topPickFitGauges = buildProductFitGauges(body?.topPick || storedFreeResult?.topPick || null, { locale });
  const response = NextResponse.json({
    ...clientPremiumReport,
    topPickFitGauges,
    meta: buildFullReportMeta(locale)
  });

  response.cookies.set(
    PREMIUM_REPORT_COOKIE,
    premiumCookie || "",
    getPremiumReportCookieOptions()
  );

  return response;
}
