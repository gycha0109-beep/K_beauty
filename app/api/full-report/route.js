import { NextResponse } from "next/server";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
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
  const response = NextResponse.json({
    ...premiumSession.payload.premiumReport,
    faceLab: {
      hairDirection: Array.isArray(faceLabLaunch?.paid?.hairDirection) ? faceLabLaunch.paid.hairDirection : [],
      avoidStyles: Array.isArray(faceLabLaunch?.paid?.avoidStyles) ? faceLabLaunch.paid.avoidStyles : [],
      colorPalette: Array.isArray(faceLabLaunch?.paid?.colorPalette) ? faceLabLaunch.paid.colorPalette : [],
      vibeKeywords: Array.isArray(faceLabLaunch?.paid?.vibeKeywords) ? faceLabLaunch.paid.vibeKeywords : []
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
