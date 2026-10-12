import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { runDailyAutomaticEvidencePilot } from "@/lib/product-intelligence/automatic-evidence-daily-v1.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function respond(body,status=200) {
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Vercel-CDN-Cache-Control":"no-store",
  }});
}
function authorized(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32 || /[\r\n]/.test(secret)) return false;
  const candidate = request.headers.get("authorization") ?? "";
  const expected = "Bearer " + secret;
  const actual = Buffer.from(candidate,"utf8");
  const trusted = Buffer.from(expected,"utf8");
  return actual.length === trusted.length && timingSafeEqual(actual,trusted);
}

/** Only the Vercel scheduler can call this route. No browser/admin bypass. */
export async function GET(request) {
  if (!authorized(request)) return respond({ok:false,error:"unauthorized"},401);
  if (process.env.BEJEWELY_AUTO_EVIDENCE_DAILY_ENABLED !== "true")
    return respond({ok:true,mode:"disabled",evaluations:0});
  const client = createSupabaseAdminClient();
  if (!client) return respond({ok:false,error:"database_unavailable"},503);
  try {
    const result = await runDailyAutomaticEvidencePilot(client);
    // Do not disclose DB exception payloads or create approval tasks.
    if (result.failed) {
      console.error("automatic_evidence_daily_failed",{
        failed:result.failed,checked:result.checked,
      });
      return respond({ok:false,checked:result.checked,failed:result.failed},503);
    }
    return respond({
      ok:true,checked:result.checked,recorded:result.recorded,
      duplicates:result.duplicates,needsReview:result.needsReview,
      recommendationWrites:0,adminReviewWrites:0,
    });
  } catch {
    console.error("automatic_evidence_daily_unhandled");
    return respond({ok:false,error:"evaluation_unavailable"},503);
  }
}
