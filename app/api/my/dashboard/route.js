import { NextResponse } from "next/server";
import { isValidLocalDate } from "@/lib/my/local-date";
import { getMyDashboardPayload } from "@/lib/my/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const localDate = request.nextUrl.searchParams.get("localDate");

  if (localDate && !isValidLocalDate(localDate)) {
    return NextResponse.json({ error: "invalid_local_date" }, { status: 400 });
  }

  const result = await getMyDashboardPayload({
    localDate: localDate || undefined
  });

  if (result.status === 401) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (result.status !== 200) {
    return NextResponse.json(
      { error: result.error || "dashboard_unavailable" },
      { status: result.status }
    );
  }

  return NextResponse.json(result.payload, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
