import { NextResponse } from "next/server";
import { getMyDiaryDayPayload } from "@/lib/my/diary-day";
import { isValidLocalDate } from "@/lib/my/local-date";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";
import { resolveRouteSupabaseAuth } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

export async function GET(request) {
  const date = request.nextUrl.searchParams.get("date");

  if (!isValidLocalDate(date)) {
    return sensitiveJsonResponse({ error: "invalid_diary_date" }, { status: 400 });
  }

  const authContext = await resolveRouteSupabaseAuth(request);

  if (!authContext) {
    return sensitiveJsonResponse({ error: "unauthorized" }, { status: 401 });
  }

  const result = await getMyDiaryDayPayload({ date, authContext });

  if (result.status !== 200) {
    return sensitiveJsonResponse(
      { error: result.error || "diary_day_unavailable" },
      { status: result.status }
    );
  }

  return sensitiveJsonResponse(result.payload);
}
