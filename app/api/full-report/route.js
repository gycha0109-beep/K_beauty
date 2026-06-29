import { NextResponse } from "next/server";
import { getOpenAiEnvDiagnostics } from "@/lib/openai-env-diagnostics";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { buildPremiumFaceLabSummary, sanitizePremiumFaceLabSummary } from "@/lib/premium-face-lab";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  updatePremiumReportSession,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";

const FULL_REPORT_RESPONSE_SCHEMA_VERSION = 1;

function buildFullReportMeta(locale) {
  return {
    schemaVersion: FULL_REPORT_RESPONSE_SCHEMA_VERSION,
    source: "premium-session",
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

function getUnauthorizedResponse() {
  return NextResponse.json(
    {
      success: false,
      error: "The full-report session is missing or expired. Please run the analysis again."
    },
    { status: 401 }
  );
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

  const premiumCookie = request.cookies.get(PREMIUM_REPORT_COOKIE)?.value || null;
  const premiumSession = await verifyPremiumReportSession(premiumCookie);

  if (!premiumSession.ok || !premiumSession.payload?.premiumReport) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[full-report] premium session rejected", premiumSession.code);
    }
    return getUnauthorizedResponse();
  }

  let body = null;

  try {
    body = await request.json();
  } catch {}

  const locale = body?.locale === "en" ? "en" : "ko";
  const storedPremiumReport = premiumSession.payload.premiumReport || {};
  const { faceLabSummary, shouldPersist } = resolveFaceLabSummary({
    storedPremiumReport,
    body,
    locale
  });

  if (shouldPersist) {
    const updateResult = await updatePremiumReportSession(premiumCookie, {
      ...storedPremiumReport,
      faceLabSummary
    });

    if (!updateResult.ok && process.env.NODE_ENV !== "production") {
      console.warn("[full-report] faceLabSummary session update skipped", updateResult.code);
    }
  }

  if (process.env.NODE_ENV !== "production" && !hasFullReportPayloadShape(storedPremiumReport)) {
    console.warn("[full-report] response shape warning", {
      hasFreeResult: storedPremiumReport && "freeResult" in storedPremiumReport,
      hasFullRoutine: Boolean(storedPremiumReport?.fullRoutine)
    });
  }

  const storedFreeResult =
    storedPremiumReport?.freeResult && typeof storedPremiumReport.freeResult === "object"
      ? storedPremiumReport.freeResult
      : null;
  const topPickFitGauges = buildProductFitGauges(body?.topPick || storedFreeResult?.topPick || null, { locale });
  const response = NextResponse.json({
    ...storedPremiumReport,
    topPickFitGauges,
    faceLabSummary,
    meta: buildFullReportMeta(locale)
  });

  response.cookies.set(
    PREMIUM_REPORT_COOKIE,
    premiumCookie || "",
    getPremiumReportCookieOptions()
  );

  return response;
}
