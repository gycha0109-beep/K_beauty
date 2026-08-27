import { NextResponse } from "next/server";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";
import { isValidLocalDate } from "@/lib/my/local-date";
import { isValidDiaryMonth } from "@/lib/my/diary-month";
import { getMyDashboardPayload } from "@/lib/my/dashboard";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";

export const dynamic = "force-dynamic";

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

export async function GET(request) {
  const localDate = request.nextUrl.searchParams.get("localDate");
  const diaryMonth = request.nextUrl.searchParams.get("diaryMonth");

  if (localDate && !isValidLocalDate(localDate)) {
    return sensitiveJsonResponse({ error: "invalid_local_date" }, { status: 400 });
  }

  if (diaryMonth && !isValidDiaryMonth(diaryMonth)) {
    return sensitiveJsonResponse({ error: "invalid_diary_month" }, { status: 400 });
  }

  const authContext = await resolveRouteSupabaseAuth(request);

  if (!authContext) {
    return sensitiveJsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getMyDashboardPayload({
    localDate: localDate || undefined,
    diaryMonth: diaryMonth || undefined,
    authContext
  });

  if (result.status === 401) {
    return sensitiveJsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  if (result.status !== 200) {
    return sensitiveJsonResponse(
      { error: result.error || "dashboard_unavailable" },
      { status: result.status }
    );
  }

  return sensitiveJsonResponse(result.payload);
}
