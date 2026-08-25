import { NextResponse } from "next/server";
import { getMySavedReportHistory } from "@/lib/my/saved-report-history";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";

export const dynamic = "force-dynamic";

function sensitiveJsonResponse(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: createNoStoreHeaders(init.headers)
  });
}

export async function GET(request) {
  const limit = request.nextUrl.searchParams.get("limit");
  const offset = request.nextUrl.searchParams.get("offset");
  const result = await getMySavedReportHistory({ limit, offset });

  if (result.status !== 200) {
    return sensitiveJsonResponse(
      { error: result.error || "saved_report_history_unavailable" },
      { status: result.status }
    );
  }

  return sensitiveJsonResponse(result.payload);
}
