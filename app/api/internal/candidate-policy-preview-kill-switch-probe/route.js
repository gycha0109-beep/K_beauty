import { NextResponse } from "next/server";
import { executeEvaluatorBoundaryPolicyPreviewProbe } from "@/lib/evaluator-boundary-policy-preview-kill-switch-probe";

export const dynamic = "force-dynamic";

export function GET() {
  const probe = executeEvaluatorBoundaryPolicyPreviewProbe({ envLike: process.env });
  if (!probe.allowed) return new NextResponse(null, { status: 404 });
  if (probe.status !== 200) return new NextResponse(null, { status: 500 });

  return NextResponse.json(probe.response, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
