import { NextResponse } from "next/server";
import { resolvePremiumAccessForRequest } from "@/lib/premium-access";
import { createNoStoreHeaders } from "@/lib/security/error-redaction";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const { access } = await resolvePremiumAccessForRequest(request);

  return NextResponse.json(access, {
    headers: createNoStoreHeaders()
  });
}
