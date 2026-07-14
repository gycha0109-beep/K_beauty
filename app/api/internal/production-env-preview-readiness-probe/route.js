import { NextResponse } from "next/server";
import { executeProductionEnvPreviewReadinessProbe } from "@/lib/production-env-preview-readiness-probe";

export const dynamic = "force-dynamic";

export function GET() {
  const probe = executeProductionEnvPreviewReadinessProbe(process.env);
  if (!probe.allowed) return new NextResponse(null, { status: 404 });

  return NextResponse.json(probe.response, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
