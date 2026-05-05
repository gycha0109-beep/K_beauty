import { NextResponse } from "next/server";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { getOpenAiEnvDiagnostics } from "@/lib/openai-env-diagnostics";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";
import {
  verifyWriteAccessToken,
  WRITE_ACCESS_HEADER
} from "@/lib/write-access";

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

  const verification = verifyWriteAccessToken(
    request.headers.get(WRITE_ACCESS_HEADER)
  );

  if (!verification.ok) {
    return getUnauthorizedResponse();
  }

  const premiumCookie = request.cookies.get(PREMIUM_REPORT_COOKIE)?.value || null;
  const premiumSession = verifyPremiumReportSession(premiumCookie);

  if (!premiumSession.ok || !premiumSession.payload?.premiumReport) {
    return getUnauthorizedResponse();
  }

  let body = null;

  try {
    body = await request.json();
  } catch {}

  const locale = body?.locale === "en" ? "en" : "ko";
  const faceLabLaunch = buildFaceLabLaunchData(body?.faceLab || null, locale);
  const topPickFitGauges = buildProductFitGauges(body?.topPick || null, { locale });
  const response = NextResponse.json({
    ...premiumSession.payload.premiumReport,
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
    meta: {
      source: "premium-session",
      locale
    }
  });

  response.cookies.set(
    PREMIUM_REPORT_COOKIE,
    premiumCookie || "",
    getPremiumReportCookieOptions()
  );

  return response;
}
