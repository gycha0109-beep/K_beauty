import { NextResponse } from "next/server";
import { upsertProfileForUser } from "@/lib/auth/profile-upsert";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { isAccountUser } from "@/lib/premium-access";
import {
  buildPremiumCurrentProductsSnapshot,
  enrichPremiumReportWithCurrentProducts
} from "@/lib/premium-current-products";
import { buildPremiumFaceLabSummary, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import {
  canonicalizeOptionalImageDataUrl,
  validateFullReportImageAliases
} from "@/lib/server/image-upload-boundary";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  updatePremiumReportSession,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";
import { resolvePremiumRouteContext } from "@/lib/premium-route-context";
import {
  buildPremiumReportSnapshot,
  classifyPremiumSnapshotReplay,
  resolvePremiumReportLocale
} from "@/lib/premium-report-snapshot";
import { sanitizePremiumReportPurchaseLinks } from "@/lib/product-purchase-link";
import { sanitizePremiumReportProductImages } from "@/lib/security/image-source-policy";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  createNoStoreHeaders,
  writeSafeLog
} from "@/lib/security/error-redaction";

const FULL_REPORT_RESPONSE_SCHEMA_VERSION = 2;

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

function sanitizePremiumReportForBoundary(report) {
  return sanitizePremiumReportProductImages(
    sanitizePremiumReportPurchaseLinks(report || {})
  );
}

function buildFullReportMeta(locale, source = "premium-session", persistence = null, snapshot = null) {
  return {
    schemaVersion: FULL_REPORT_RESPONSE_SCHEMA_VERSION,
    source,
    locale,
    generatedAt: new Date().toISOString(),
    ...(persistence ? { persistence } : {}),
    ...(snapshot
      ? {
          snapshot: {
            immutable: true,
            fingerprint: snapshot.fingerprint,
            contextHash: snapshot.contextHash,
            contextRevision: snapshot.contextRevision
          }
        }
      : {})
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
  "premium_session_missing_or_expired",
  "premium_principal_conflict"
]);

function getUnauthorizedResponse(reason) {
  const safeReason = FULL_REPORT_UNAUTHORIZED_REASONS.has(reason)
    ? reason
    : "login_required";

  return sensitiveJsonResponse(
    {
      success: false,
      error: safeReason
    },
    { status: 401 }
  );
}

function getPaymentRequiredResponse(access) {
  return sensitiveJsonResponse(
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
  return sensitiveJsonResponse(
    {
      success: false,
      error: "premium_unavailable",
      reason: "premium_unavailable"
    },
    { status: 403 }
  );
}

function getPremiumPersistenceFailedResponse(code = "premium_save_failed") {
  return sensitiveJsonResponse(
    {
      success: false,
      error: code
    },
    { status: 503 }
  );
}

function getSnapshotConflictResponse() {
  return sensitiveJsonResponse(
    { success: false, error: "premium_snapshot_finalized" },
    { status: 409 }
  );
}

function getStorageUnavailableResponse() {
  return sensitiveJsonResponse(
    { success: false, error: "premium_save_unavailable" },
    { status: 503 }
  );
}

function resolveFaceLabSummary({ storedPremiumReport, body, locale, canonicalImageUrl }) {
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
        imageUrl: canonicalImageUrl || storedFaceLabSummary.imageUrl,
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

async function loadSavedPremiumReport({ supabase, userId, savedReportId }) {
  if (!supabase || !userId || !savedReportId) {
    return { data: null, error: new Error("saved_report_lookup_unavailable") };
  }

  return supabase
    .from("saved_reports")
    .select("id, report_type, report_version, premium_report, free_result, face_lab, created_at")
    .eq("id", savedReportId)
    .eq("user_id", userId)
    .eq("report_type", "premium")
    .maybeSingle();
}

async function loadSavedPremiumReportForSession({ supabase, userId, sessionId }) {
  if (!supabase || !userId || !sessionId) {
    return { data: null, error: new Error("saved_report_session_lookup_unavailable") };
  }

  return supabase
    .from("saved_reports")
    .select("id, report_version, premium_report, created_at")
    .eq("user_id", userId)
    .eq("report_type", "premium")
    .eq("source_type", "premium_report_session")
    .eq("source_session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

function buildSavedPremiumReportResponse(savedReport, fallbackLocale = "ko") {
  const savedPremiumReport = sanitizePremiumReportForBoundary(savedReport?.premium_report || {});
  const savedLocale = resolvePremiumReportLocale(savedPremiumReport, fallbackLocale);
  const savedFreeResult =
    savedPremiumReport?.freeResult && typeof savedPremiumReport.freeResult === "object"
      ? savedPremiumReport.freeResult
      : null;
  const topPickFitGauges = buildProductFitGauges(savedFreeResult?.topPick || null, {
    locale: savedLocale
  });

  return sensitiveJsonResponse({
    ...savedPremiumReport,
    topPickFitGauges,
    meta: buildFullReportMeta(
      savedLocale,
      "saved-report",
      { status: "existing", savedReportId: savedReport.id },
      buildPremiumReportSnapshot(savedPremiumReport)
    )
  });
}

async function persistPremiumSavedReport({
  adminSupabase,
  user,
  sessionId,
  authoritativePremiumReport,
  locale
}) {
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

  const existing = await loadSavedPremiumReportForSession({
    supabase: adminSupabase,
    userId: user.id,
    sessionId
  });

  if (existing.error) {
    writeSafeLog("error", {
      event: "full_report_failed",
      category: "database_unavailable",
      operation: "full_report",
      dependency: "supabase",
      retryable: true
    });
    return { ok: false, code: "lookup_failed" };
  }

  const snapshot = buildPremiumReportSnapshot(authoritativePremiumReport);
  if (!snapshot) {
    return { ok: false, code: "invalid_snapshot" };
  }

  if (existing.data?.id) {
    const replay = classifyPremiumSnapshotReplay(
      existing.data.premium_report,
      authoritativePremiumReport
    );
    return replay.status === "existing"
      ? { ok: true, code: "existing", savedReportId: existing.data.id, snapshot }
      : { ok: false, code: "snapshot_conflict", savedReportId: existing.data.id, snapshot };
  }

  const payload = {
    user_id: user.id,
    report_type: "premium",
    source_type: "premium_report_session",
    source_session_id: sessionId,
    title: locale === "en" ? "Premium routine report" : "프리미엄 루틴 리포트",
    report_version: snapshot.reportVersion,
    premium_report: authoritativePremiumReport,
    free_result: null,
    face_lab:
      authoritativePremiumReport.faceLabSummary ||
      authoritativePremiumReport.faceLab ||
      null
  };

  const { data, error } = await adminSupabase
    .from("saved_reports")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    const retry = await loadSavedPremiumReportForSession({
      supabase: adminSupabase,
      userId: user.id,
      sessionId
    });

    if (!retry.error && retry.data?.id) {
      const replay = classifyPremiumSnapshotReplay(
        retry.data.premium_report,
        authoritativePremiumReport
      );
      if (replay.status === "existing") {
        return {
          ok: true,
          code: "existing",
          savedReportId: retry.data.id,
          snapshot
        };
      }
      if (replay.status === "conflict") {
        return {
          ok: false,
          code: "snapshot_conflict",
          savedReportId: retry.data.id,
          snapshot
        };
      }
    }

    writeSafeLog("error", {
      event: "full_report_failed",
      category: "database_unavailable",
      operation: "full_report",
      dependency: "supabase",
      retryable: true
    });
    return { ok: false, code: "insert_failed" };
  }

  return {
    ok: true,
    code: "saved",
    savedReportId: data?.id || null,
    snapshot
  };
}

async function applyCurrentProductsToReport({ report, body, locale }) {
  if (!Array.isArray(body?.currentProducts)) {
    return {
      premiumReport: report,
      changed: false
    };
  }

  const currentProducts = await buildPremiumCurrentProductsSnapshot(body.currentProducts);
  return {
    premiumReport: enrichPremiumReportWithCurrentProducts(report, currentProducts, locale),
    changed: true
  };
}

export async function POST(request) {
  let body = null;

  try {
    body = await request.json();
  } catch {}

  const imageAliasValidation = validateFullReportImageAliases(body);

  if (!imageAliasValidation.ok) {
    return sensitiveJsonResponse({ error: "invalid_image" }, { status: 400 });
  }

  const canonicalImage = await canonicalizeOptionalImageDataUrl(body?.imageUrl);

  if (!canonicalImage.ok) {
    return sensitiveJsonResponse({ error: "invalid_image" }, { status: 400 });
  }

  const canonicalImageUrl = canonicalImage.absent ? null : canonicalImage.dataUrl;
  const requestedLocale = body?.locale === "en" ? "en" : "ko";
  const context = await resolvePremiumRouteContext(request);
  const { user, access, supabase: userSupabase } = context;

  if (context.authError === "principal_conflict") {
    return getUnauthorizedResponse("premium_principal_conflict");
  }

  if (isAccountUser(user) && !userSupabase) {
    return getStorageUnavailableResponse();
  }

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
        writeSafeLog("warn", {
          event: "full_report_failed",
          category: "database_unavailable",
          operation: "full_report",
          dependency: "supabase",
          retryable: true
        });
      }
      return getUnauthorizedResponse("premium_session_missing_or_expired");
    }

    return buildSavedPremiumReportResponse(savedReport, requestedLocale);
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
      writeSafeLog("warn", {
        event: "full_report_failed",
        category: "session_unavailable",
        operation: "full_report",
        dependency: "application",
        retryable: false
      });
    }
    return getUnauthorizedResponse("premium_session_missing_or_expired");
  }

  let finalizedSavedReport = null;

  if (isAccountUser(user)) {
    const finalizedLookup = await loadSavedPremiumReportForSession({
      supabase: userSupabase,
      userId: user.id,
      sessionId: premiumSession.payload.sessionId
    });

    if (finalizedLookup.error) {
      writeSafeLog("error", {
        event: "full_report_failed",
        category: "database_unavailable",
        operation: "full_report",
        dependency: "supabase",
        retryable: true
      });
      return getStorageUnavailableResponse();
    }

    finalizedSavedReport = finalizedLookup.data || null;
  }

  const locale = finalizedSavedReport?.premium_report
    ? resolvePremiumReportLocale(finalizedSavedReport.premium_report, requestedLocale)
    : requestedLocale;

  let storedPremiumReport = sanitizePremiumReportForBoundary(
    premiumSession.payload.premiumReport
  );
  const currentProductsResult = await applyCurrentProductsToReport({
    report: storedPremiumReport,
    body,
    locale
  });
  storedPremiumReport = currentProductsResult.premiumReport;

  const { faceLabSummary, shouldPersist } = resolveFaceLabSummary({
    storedPremiumReport,
    body,
    locale,
    canonicalImageUrl
  });
  const responsePremiumReport = sanitizePremiumReportForBoundary({
    ...storedPremiumReport,
    faceLabSummary,
    locale
  });

  if (finalizedSavedReport?.premium_report) {
    const replay = classifyPremiumSnapshotReplay(
      finalizedSavedReport.premium_report,
      responsePremiumReport
    );
    return replay.status === "existing"
      ? buildSavedPremiumReportResponse(finalizedSavedReport, locale)
      : getSnapshotConflictResponse();
  }

  let authoritativePremiumReport = responsePremiumReport;

  if (
    shouldPersist ||
    currentProductsResult.changed ||
    storedPremiumReport.locale !== locale
  ) {
    const updateResult = await updatePremiumReportSession(premiumCookie, responsePremiumReport);

    if (!updateResult.ok || !updateResult.payload?.premiumReport) {
      writeSafeLog("warn", {
        event: "full_report_failed",
        category: "session_unavailable",
        operation: "full_report",
        dependency: "supabase",
        retryable: true
      });
      return getPremiumPersistenceFailedResponse("premium_session_update_failed");
    }

    authoritativePremiumReport = sanitizePremiumReportForBoundary(
      updateResult.payload.premiumReport
    );
  }

  let persistence = null;
  let snapshot = buildPremiumReportSnapshot(authoritativePremiumReport);

  if (userSupabase && isAccountUser(user)) {
    await upsertProfileForUser({
      supabase: userSupabase,
      user,
      preferAdmin: true
    }).catch(() => {
      writeSafeLog("warn", {
        event: "profile_sync_failed",
        category: "database_unavailable",
        operation: "profile_sync",
        dependency: "supabase",
        retryable: true
      });
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
      return persistResult.code === "snapshot_conflict"
        ? getSnapshotConflictResponse()
        : getPremiumPersistenceFailedResponse();
    }

    persistence = {
      status: persistResult.code,
      savedReportId: persistResult.savedReportId
    };
    snapshot = persistResult.snapshot;
  }

  if (
    process.env.NODE_ENV !== "production" &&
    !hasFullReportPayloadShape(authoritativePremiumReport)
  ) {
    writeSafeLog("warn", {
      event: "full_report_failed",
      category: "response_shape_invalid",
      operation: "full_report",
      dependency: "application",
      retryable: false
    });
  }

  const clientPremiumReport = sanitizePremiumReportForBoundary(
    authoritativePremiumReport
  );
  const storedFreeResult =
    clientPremiumReport?.freeResult &&
    typeof clientPremiumReport.freeResult === "object"
      ? clientPremiumReport.freeResult
      : null;
  const topPickFitGauges = buildProductFitGauges(
    storedFreeResult?.topPick || null,
    { locale }
  );
  const response = sensitiveJsonResponse({
    ...clientPremiumReport,
    topPickFitGauges,
    meta: buildFullReportMeta(
      locale,
      "premium-session",
      persistence,
      snapshot
    )
  });

  response.cookies.set(
    PREMIUM_REPORT_COOKIE,
    premiumCookie || "",
    getPremiumReportCookieOptions()
  );

  return response;
}
