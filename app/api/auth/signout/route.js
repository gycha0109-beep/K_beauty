import { NextResponse } from "next/server";
import {
  getPremiumReportCookieOptions,
  PREMIUM_REPORT_COOKIE
} from "@/lib/premium-report-session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

async function signOut(request) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const response = NextResponse.redirect(new URL("/", request.url), {
    headers: {
      "Cache-Control": "private, no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Vary: "Cookie"
    }
  });
  response.cookies.set(PREMIUM_REPORT_COOKIE, "", {
    ...getPremiumReportCookieOptions(),
    maxAge: 0
  });
  return response;
}

export async function GET(request) {
  return signOut(request);
}

export async function POST(request) {
  return signOut(request);
}
