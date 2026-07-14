import { NextResponse } from "next/server";
import { executeEvaluatorBoundaryPolicyPreviewRuntimeProbe } from "@/lib/evaluator-boundary-policy-preview-runtime-probe";

export const dynamic = "force-dynamic";

export async function GET() {
  const probe = await executeEvaluatorBoundaryPolicyPreviewRuntimeProbe({ envLike: process.env });
  if (!probe.allowed) return new NextResponse(null, { status: 404 });
  if (probe.status !== 200) return new NextResponse(null, { status: 500 });

  return NextResponse.json(probe.response, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
