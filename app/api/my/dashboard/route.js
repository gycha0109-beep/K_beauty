import { NextResponse } from "next/server";
import { getMyDashboardPayload } from "@/lib/my/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getMyDashboardPayload();

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
