import { NextResponse } from "next/server";
import { isAccountUser, resolvePremiumAccessForRequest } from "@/lib/premium-access";
import {
  createPremiumReportSession,
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";
import { buildRotatedPremiumReportPayload } from "@/lib/premium-report-reentry";
import { createRouteSupabaseAuthClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

function getBearerToken(request) {
  const authorizationHeader = request.headers.get("authorization");

  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}

function getNoSavedReportResponse() {
  return NextResponse.json(
    { hasSavedReport: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}

async function getCurrentSessionContext(request) {
  const { user, access } = await resolvePremiumAccessForRequest(request);
  const accessToken = getBearerToken(request);
  const supabase = accessToken ? createRouteSupabaseAuthClient(accessToken) : null;

  if (!isAccountUser(user) || !supabase) {
    return null;
  }

  const premiumCookie = request.cookies.get(PREMIUM_REPORT_COOKIE)?.value || null;
  const premiumSession = await verifyPremiumReportSession(premiumCookie);

  if (!premiumSession.ok || !premiumSession.payload?.sessionId || !premiumSession.payload?.premiumReport) {
    return null;
  }

  return {
    user,
    access,
    supabase,
    premiumSession
  };
}

async function findSavedReportForCurrentSession({ supabase, userId, sessionId }) {
  const result = await supabase
    .from("saved_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("report_type", "premium")
    .eq("source_type", "premium_report_session")
    .eq("source_session_id", sessionId)
    .not("premium_report", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return result.error ? null : result.data?.id || null;
}

export async function GET(request) {
  try {
    const context = await getCurrentSessionContext(request);

    if (!context) {
      return getNoSavedReportResponse();
    }

    const savedReportId = await findSavedReportForCurrentSession({
      supabase: context.supabase,
      userId: context.user.id,
      sessionId: context.premiumSession.payload.sessionId
    });

    return NextResponse.json(
      savedReportId
        ? { hasSavedReport: true, savedReportId }
        : { hasSavedReport: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return getNoSavedReportResponse();
  }
}

export async function POST(request) {
  try {
    const context = await getCurrentSessionContext(request);

    if (!context || !context.access.canCreatePremium) {
      return NextResponse.json({ rotated: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const savedReportId = await findSavedReportForCurrentSession({
      supabase: context.supabase,
      userId: context.user.id,
      sessionId: context.premiumSession.payload.sessionId
    });

    if (!savedReportId) {
      return NextResponse.json({ rotated: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const premiumReport = buildRotatedPremiumReportPayload(context.premiumSession.payload.premiumReport);

    if (!premiumReport) {
      return NextResponse.json({ rotated: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const premiumSessionToken = await createPremiumReportSession({
      premiumReport,
      locale: context.premiumSession.payload.locale
    });

    if (!premiumSessionToken) {
      return NextResponse.json({ rotated: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const response = NextResponse.json(
      { rotated: true },
      { headers: { "Cache-Control": "no-store" } }
    );
    response.cookies.set(
      PREMIUM_REPORT_COOKIE,
      premiumSessionToken,
      getPremiumReportCookieOptions()
    );

    return response;
  } catch {
    return NextResponse.json({ rotated: false }, { headers: { "Cache-Control": "no-store" } });
  }
}
