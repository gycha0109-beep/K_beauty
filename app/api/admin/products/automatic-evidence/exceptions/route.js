import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/admin/access";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { classifyAutomaticEvidenceAttention } from "@/lib/product-intelligence/automatic-evidence-daily-v1.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function respond(body,status=200) {
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Vercel-CDN-Cache-Control":"no-store",
  }});
}
/** Only actionable anomalies. Normal insufficient evidence is never a task. */
export async function GET() {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser)
    return respond({ok:false,error:"관리자 로그인이 필요합니다."},401);
  if (!access.allowed || !access.userId)
    return respond({ok:false,error:"제품 검토 권한이 없습니다."},403);
  const client = createSupabaseAdminClient();
  if (!client) return respond({ok:false,error:"데이터 연결을 사용할 수 없습니다."},503);
  const {data,error} = await client.from("automatic_product_evidence_history_v1")
    .select("history_id,product_id,subject_id,evaluated_at,event_kind,changed_fields,fields,exceptions")
    .order("history_id",{ascending:false}).limit(100);
  if (error || !Array.isArray(data))
    return respond({ok:false,error:"자동 평가 예외를 불러오지 못했습니다."},503);
  const seen = new Set();
  const attention=[];
  for (const row of data) {
    const key=row.product_id+"|"+row.subject_id;
    if (seen.has(key)) continue;
    seen.add(key);
    const item=classifyAutomaticEvidenceAttention(row);
    if (item) attention.push(item);
  }
  return respond({ok:true,mode:"important_exceptions_only",
    scannedHistoryRows:data.length,
    limitedHistoryWindow:data.length===100,
    attentionCount:attention.length,items:attention,
    normalInsufficientEvidenceSuppressed:true});
}
