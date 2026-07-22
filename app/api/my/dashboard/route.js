import { NextResponse } from "next/server";
import { isValidLocalDate } from "@/lib/my/local-date";
import { getMyDashboardPayload } from "@/lib/my/dashboard";

export const dynamic = "force-dynamic";

const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate",
  Pragma: "no-cache",
  Vary: "Cookie"
};

function json(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      ...PRIVATE_RESPONSE_HEADERS,
      ...(init.headers || {})
    }
  });
}

export async function GET(request) {
  const localDate = request.nextUrl.searchParams.get("localDate");

  if (localDate && !isValidLocalDate(localDate)) {
    return json({ error: "invalid_local_date" }, { status: 400 });
  }

  const result = await getMyDashboardPayload({
    localDate: localDate || undefined
  });

  if (result.status === 401) {
    return json({ error: "unauthorized" }, { status: 401 });
  }

  if (result.status !== 200) {
    return json(
      { error: result.error || "dashboard_unavailable" },
      { status: result.status }
    );
  }

  return json(result.payload);
}
