import { NextResponse } from "next/server";
import { getOpenAiEnvDiagnostics } from "@/lib/openai-env-diagnostics";
import { upsertProfileForUser, serializeSupabaseError } from "@/lib/auth/profile-upsert";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { isAccountUser } from "@/lib/premium-access";
import {
  buildPremiumCurrentProductsSnapshot,
  enrichPremiumReportWithCurrentProducts
} from "@/lib/premium-current-products";
import { buildPremiumFaceLabSummary, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  updatePremiumReportSession,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";
import { resolvePremiumRouteContext } from "@/lib/premium-route-context";
import {
  canReadSavedPremiumReport,
  hasSavedPremiumReportEntitlement
} from "@/lib/premium-saved-report-access";
import {
  buildPremiumReportSnapshot,
  classifyPremiumSnapshotReplay,
  resolvePremiumReportLocale
} from "@/lib/premium-report-snapshot";

const FULL_REPORT_RESPONSE_SCHEMA_VERSION = 2;

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Vary: "Cookie, Authorization"
};

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      ...(init.headers || {})
    }
  });
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
  return json({ success: false, error: safeReason }, { status: 401 });
}

function getPaymentRequiredResponse(access) {
  return json(
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
  return json(
    { success: false, error: "premium_unavailable", reason: "premium_unavailable" },
    { status: 403 }
  );
}

function getSnapshotConflictResponse() {
  return json(
    { success: false, error: "premium_snapshot_finalized" },
    { status: 409 }
  );
}

function getStorageUnavailableResponse() {
  return json(
    { success: false, error: "premium_save_unavailable" },
    { status: 503 }
  );
}

function getSavedReportNotFoundResponse() {
  return json(
    { success: false, error: "premium_report_not_found" },
    { status: 404 }
  );
}

function resolveFaceLabSummary({ storedPremiumReport, body, locale }) {
  const storedFaceLabSummary = sanitizePremiumFaceLabSummary(storedPremiumReport.faceLabSummary);
  if (storedFaceLabSummary.status === "available") {
    return { faceLabSummary: storedFaceLabSummary, shouldPersist: false };
  }

  const requestFaceLabSummary = body?.faceLab
    ? buildPremiumFaceLabSummary(body.faceLab, {
        locale,
        imageUrl: body?.imageUrl || storedFaceLabSummary.imageUrl,
        imageAlt: body?.imageAlt || storedFaceLabSummary.imageAlt
      })
    : null;

  if (requestFaceLabSummary?.status === "available") {
    return { faceLabSummary: requestFaceLabSummary, shouldPersist: true };
  }

  const legacyFaceLabSummary = storedPremiumReport.faceLab
    ? buildPremiumFaceLabSummary(storedPremiumReport.faceLab, {
        locale,
        imageUrl: storedFaceLabSummary.imageUrl,
        imageAlt: storedFaceLabSummary.imageAlt
      })
    : null;

  if (legacyFaceLabSummary?.status === "available") {
    return { faceLabSummary: legacyFaceLabSummary, shouldPersist: true };
  }

  return { faceLabSummary: storedFaceLabSummary, shouldPersist: false };
}

async function loadSavedPremiumReport({ supabase, userId, savedReportId }) {
  if (!supabase || !userId || !savedReportId) {
    return { data: null, error: new Error("saved_report_lookup_unavailable") };
  }

  return supabase
    .from("saved_reports")
    .select("id, user_id, report_type, report_version, premium_report, free_result, face_lab, created_at")
    .eq("id", savedReportId)
    .eq("user_id", userId)
    .eq("report_type", "premium")
    .not("premium_report", "is", null)
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
  const savedPremiumReport = savedReport?.premium_report || {};
  const savedLocale = resolvePremiumReportLocale(savedPremiumReport, fallbackLocale);
  const savedFreeResult =
    savedPremiumReport?.freeResult && typeof savedPremiumReport.freeResult === "object"
      ? savedPremiumReport.freeResult
      : null;
  const topPickFitGauges = buildProductFitGauges(savedFreeResult?.topPick || null, {
    locale: savedLocale
  });

  return json({
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

async function persistPremiumSavedReport({ supabase, user, sessionId, premiumReport, locale }) {
  if (!supabase || !isAccountUser(user) || !sessionId || !premiumReport || typeof premiumReport !== "object") {
    return { ok: false, code: "persist_not_available" };
  }

  const existing = await loadSavedPremiumReportForSession({
    supabase,
    userId: user.id,
    sessionId
  });

  if (existing.error) {
    console.error("[full-report] saved premium lookup failed", serializeSupabaseError(existing.error));
    return { ok: false, code: "lookup_failed" };
  }

  const snapshot = buildPremiumReportSnapshot(premiumReport);
  if (!snapshot) return { ok: false, code: "invalid_snapshot" };

  if (existing.data?.id) {
    const replay = classifyPremiumSnapshotReplay(existing.data.premium_report, premiumReport);
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
    premium_report: premiumReport,
    free_result: null,
    face_lab: premiumReport.faceLabSummary || premiumReport.faceLab || null
  };

  const { data, error } = await supabase
    .from("saved_reports")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    const retry = await loadSavedPremiumReportForSession({
      supabase,
      userId: user.id,
      sessionId
    });

    if (!retry.error && retry.data?.id) {
      const replay = classifyPremiumSnapshotReplay(retry.data.premium_report, premiumReport);
      if (replay.status === "existing") {
        return { ok: true, code: "existing", savedReportId: retry.data.id, snapshot };
      }
      if (replay.status === "conflict") {
        return { ok: false, code: "snapshot_conflict", savedReportId: retry.data.id, snapshot };
      }
    }

    console.error("[full-report] saved premium insert failed", serializeSupabaseError(error));
    return { ok: false, code: "insert_failed" };
  }

  return { ok: true, code: "saved", savedReportId: data?.id || null, snapshot };
}

async function applyCurrentProductsToReport({ report, body, locale }) {
  if (!Array.isArray(body?.currentProducts)) {
    return { premiumReport: report, changed: false };
  }

  const currentProducts = await buildPremiumCurrentProductsSnapshot(body.currentProducts);
  return {
    premiumReport: enrichPremiumReportWithCurrentProducts(report, currentProducts, locale),
    changed: true
  };
}

export async function POST(request) {
  if (process.env.NODE_ENV !== "production") {
    console.info(
      "[full-report] openai-env:diagnostic",
      getOpenAiEnvDiagnostics({ route: "full-report", routeUsesOpenAi: false, routeUsesOpenRouter: false })
    );
  }

  let body = null;
  try {
    body = await request.json();
  } catch {}

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
      return getSavedReportNotFoundResponse();
    }

    if (!hasSavedPremiumReportEntitlement(access)) {
      return getSavedReportNotFoundResponse();
    }

    const requestedSavedReportId = String(body.savedReportId);

    const { data: savedReport, error } = await loadSavedPremiumReport({
      supabase: userSupabase,
      userId: user.id,
      savedReportId: requestedSavedReportId
    });

    if (error || !canReadSavedPremiumReport({
      access,
      report: savedReport,
      requestedReportId: requestedSavedReportId,
      userId: user.id
    })) {
      if (error) console.error("[full-report] saved premium read failed", serializeSupabaseError(error));
      return getSavedReportNotFoundResponse();
    }

    return buildSavedPremiumReportResponse(savedReport, requestedLocale);
  }

  if (!access.canCreatePremium) {
    if (access.reason === "premium_unavailable") return getPremiumUnavailableResponse();
    return access.reason === "payment_required"
      ? getPaymentRequiredResponse(access)
      : getUnauthorizedResponse("login_required");
  }

  const premiumCookie = request.cookies.get(PREMIUM_REPORT_COOKIE)?.value || null;
  const premiumSession = await verifyPremiumReportSession(premiumCookie, { userId: user?.id });
  if (!premiumSession.ok || !premiumSession.payload?.premiumReport) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[full-report] premium session rejected", premiumSession.code);
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
      console.error("[full-report] finalized premium lookup failed", serializeSupabaseError(finalizedLookup.error));
      return getStorageUnavailableResponse();
    }
    finalizedSavedReport = finalizedLookup.data || null;
  }

  const locale = finalizedSavedReport?.premium_report
    ? resolvePremiumReportLocale(finalizedSavedReport.premium_report, requestedLocale)
    : requestedLocale;

  let storedPremiumReport = premiumSession.payload.premiumReport || {};
  const currentProductsResult = await applyCurrentProductsToReport({ report: storedPremiumReport, body, locale });
  storedPremiumReport = currentProductsResult.premiumReport;
  const { faceLabSummary, shouldPersist } = resolveFaceLabSummary({ storedPremiumReport, body, locale });
  const responsePremiumReport = { ...storedPremiumReport, faceLabSummary, locale };

  if (finalizedSavedReport?.premium_report) {
    const replay = classifyPremiumSnapshotReplay(
      finalizedSavedReport.premium_report,
      responsePremiumReport
    );
    return replay.status === "existing"
      ? buildSavedPremiumReportResponse(finalizedSavedReport, locale)
      : getSnapshotConflictResponse();
  }

  if (shouldPersist || currentProductsResult.changed || storedPremiumReport.locale !== locale) {
    const updateResult = await updatePremiumReportSession(
      premiumCookie,
      responsePremiumReport,
      { userId: user?.id }
    );
    if (!updateResult.ok) return getStorageUnavailableResponse();
  }

  let persistence = null;
  let snapshot = buildPremiumReportSnapshot(responsePremiumReport);
  if (isAccountUser(user)) {
    await upsertProfileForUser({ supabase: userSupabase, user, preferAdmin: true }).catch((error) => {
      console.warn("[full-report] profile upsert before premium save skipped", error?.message || error);
    });

    const saveResult = await persistPremiumSavedReport({
      supabase: userSupabase,
      user,
      sessionId: premiumSession.payload.sessionId,
      premiumReport: responsePremiumReport,
      locale
    });

    if (!saveResult.ok) {
      return saveResult.code === "snapshot_conflict"
        ? getSnapshotConflictResponse()
        : getStorageUnavailableResponse();
    }

    persistence = { status: saveResult.code, savedReportId: saveResult.savedReportId };
    snapshot = saveResult.snapshot;
  }

  if (process.env.NODE_ENV !== "production" && !hasFullReportPayloadShape(storedPremiumReport)) {
    console.warn("[full-report] response shape warning", {
      hasFreeResult: storedPremiumReport && "freeResult" in storedPremiumReport,
      hasFullRoutine: Boolean(storedPremiumReport?.fullRoutine)
    });
  }

  const storedFreeResult =
    responsePremiumReport?.freeResult && typeof responsePremiumReport.freeResult === "object"
      ? responsePremiumReport.freeResult
      : null;
  const topPickFitGauges = buildProductFitGauges(storedFreeResult?.topPick || null, { locale });
  const response = json({
    ...responsePremiumReport,
    topPickFitGauges,
    meta: buildFullReportMeta(locale, "premium-session", persistence, snapshot)
  });

  response.cookies.set(
    PREMIUM_REPORT_COOKIE,
    premiumCookie || "",
    getPremiumReportCookieOptions()
  );

  return response;
}
