import { NextResponse } from "next/server";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { getOpenAiEnvDiagnostics } from "@/lib/openai-env-diagnostics";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
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
  const faceLabLaunch = buildFaceLabLaunchData(body?.faceLab || null, locale);
  const storedPremiumReport = premiumSession.payload.premiumReport || {};

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
    faceLab: {
      summary: faceLabLaunch?.paid?.summary || null,
      faceMood: faceLabLaunch?.paid?.faceMood || null,
      faceSummary: String(faceLabLaunch?.paid?.faceSummary || "").trim(),
      hairDirections: Array.isArray(faceLabLaunch?.paid?.hairDirections) ? faceLabLaunch.paid.hairDirections : [],
      avoidStyles: Array.isArray(faceLabLaunch?.paid?.avoidStyles) ? faceLabLaunch.paid.avoidStyles : [],
      styleKeywords: Array.isArray(faceLabLaunch?.paid?.styleKeywords) ? faceLabLaunch.paid.styleKeywords : [],
      toneDirection: String(faceLabLaunch?.paid?.toneDirection || "").trim(),
      reasoningLines: Array.isArray(faceLabLaunch?.paid?.reasoningLines) ? faceLabLaunch.paid.reasoningLines : [],
      practicalGuide: faceLabLaunch?.paid?.practicalGuide || null,
      sections: Array.isArray(faceLabLaunch?.paid?.sections) ? faceLabLaunch.paid.sections : [],
      steps: Array.isArray(faceLabLaunch?.paid?.steps) ? faceLabLaunch.paid.steps : []
    },
    meta: buildFullReportMeta(locale)
  });

  response.cookies.set(
    PREMIUM_REPORT_COOKIE,
    premiumCookie || "",
    getPremiumReportCookieOptions()
  );

  return response;
}
