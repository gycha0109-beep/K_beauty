import { NextResponse } from "next/server";
import {
  getCanonicalProductionOrigin,
  getNormalizedConfiguredProductionOrigin
} from "@/lib/canonical-site-origin";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE
} from "@/lib/premium-report-session";
import {
  createSignOutRouteHandlers,
  getSignOutRuntimeOriginContract
} from "@/lib/security/signout-request-policy";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const signOutHandlers = createSignOutRouteHandlers({
  createSupabaseClient: createServerSupabaseClient,
  getRuntimeOriginContract() {
    return getSignOutRuntimeOriginContract({
      vercelEnvironment: process.env.VERCEL_ENV,
      configuredProductionOrigin: getNormalizedConfiguredProductionOrigin(),
      canonicalProductionOrigin: getCanonicalProductionOrigin()
    });
  }
});

export const GET = signOutHandlers.GET;
export const HEAD = signOutHandlers.HEAD;
export const OPTIONS = signOutHandlers.OPTIONS;

export async function POST(request) {
  const response = await signOutHandlers.POST(request);

  if (response.status !== 303) {
    return response;
  }

  const nextResponse = new NextResponse(null, {
    status: response.status,
    headers: response.headers
  });
  nextResponse.cookies.set(PREMIUM_REPORT_COOKIE, "", {
    ...getPremiumReportCookieOptions(),
    maxAge: 0
  });
  return nextResponse;
}
