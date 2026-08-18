import { NextResponse } from "next/server";
import { buildExfoliationNormativePolicyRuntimeStateReadback } from "@/lib/exfoliation-normative-policy-runtime-state-readback";

export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.VERCEL_ENV !== "production") {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(
    buildExfoliationNormativePolicyRuntimeStateReadback(process.env),
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
