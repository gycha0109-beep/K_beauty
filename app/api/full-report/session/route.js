import { NextResponse } from "next/server";
import { isAccountUser } from "@/lib/premium-access";
import {
  createPremiumReportSession,
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE,
  verifyPremiumReportSession
} from "@/lib/premium-report-session";
import { buildRotatedPremiumReportPayload } from "@/lib/premium-report-reentry";
import { resolvePremiumRouteContext } from "@/lib/premium-route-context";

export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

async function getCurrentSessionContext(request) {
  const routeContext = await resolvePremiumRouteContext(request);
  if (routeContext.authError === "principal_conflict") {
    return { error: "principal_conflict" };
  }
  if (!isAccountUser(routeContext.user) || !routeContext.supabase) {
    return { error: "current_session_missing" };
  }

  const premiumCookie = request.cookies.get(PREMIUM_REPORT_COOKIE)?.value || null;
  const premiumSession = await verifyPremiumReportSession(premiumCookie);
  if (!premiumSession.ok || !premiumSession.payload?.sessionId || !premiumSession.payload?.premiumReport) {
    return { error: "current_session_missing" };
  }

  return { ...routeContext, premiumCookie, premiumSession, error: null };
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
    if (context.error) return json({ hasSavedReport: false });

    const savedReportId = await findSavedReportForCurrentSession({
      supabase: context.supabase,
      userId: context.user.id,
      sessionId: context.premiumSession.payload.sessionId
    });

    return json(savedReportId ? { hasSavedReport: true, savedReportId } : { hasSavedReport: false });
  } catch {
    return json({ hasSavedReport: false });
  }
}

export async function POST(request) {
  try {
    const context = await getCurrentSessionContext(request);
    if (context.error === "principal_conflict") {
      return json({ rotated: false, reason: "principal_conflict" }, 401);
    }
    if (context.error) {
      return json({ rotated: false, reason: "current_session_missing" }, 401);
    }
    if (!context.access.canCreatePremium) {
      return json({ rotated: false, reason: "premium_creation_not_allowed" }, 403);
    }

    const savedReportId = await findSavedReportForCurrentSession({
      supabase: context.supabase,
      userId: context.user.id,
      sessionId: context.premiumSession.payload.sessionId
    });
    if (!savedReportId) return json({ rotated: false, reason: "saved_snapshot_not_found" }, 404);

    const premiumReport = buildRotatedPremiumReportPayload(context.premiumSession.payload.premiumReport);
    if (!premiumReport) return json({ rotated: false, reason: "rotation_failed" }, 409);

    const premiumSessionToken = await createPremiumReportSession({
      premiumReport,
      locale: context.premiumSession.payload.locale
    });
    if (!premiumSessionToken) return json({ rotated: false, reason: "session_store_unavailable" }, 503);

    const response = json({ rotated: true, reason: "new_session_created" });
    response.cookies.set(
      PREMIUM_REPORT_COOKIE,
      premiumSessionToken,
      getPremiumReportCookieOptions()
    );
    return response;
  } catch {
    return json({ rotated: false, reason: "rotation_failed" }, 500);
  }
}
