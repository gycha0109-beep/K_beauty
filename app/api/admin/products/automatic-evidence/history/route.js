import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/admin/access";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordAutomaticEvidenceFromLiveDB } from "@/lib/product-intelligence/automatic-evidence-history-store-v1.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function respond(body, status = 200) {
  return NextResponse.json(body, { status, headers: {
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Vercel-CDN-Cache-Control":"no-store",
  }});
}

/**
 * Explicit admin-initiated evaluation record (not field-by-field review).
 * No user-supplied claims, evidence, actor, evaluator status or admission.
 * GET preview remains strictly read-only; automation may call the store directly.
 */
export async function POST(request) {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser)
    return respond({ok:false,error:"관리자 로그인이 필요합니다."},401);
  if (!access.allowed || !access.userId)
    return respond({ok:false,error:"제품 검토 권한이 없습니다."},403);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return respond({ok:false,error:"요청 출처를 확인할 수 없습니다."},403);
  let body;
  try { body=await request.json(); }
  catch { return respond({ok:false,error:"요청 형식이 올바르지 않습니다."},400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !UUID.test(String(body.productId)))
    return respond({ok:false,error:"제품 식별자만 전달해야 합니다."},400);
  const client = createSupabaseAdminClient();
  if (!client) return respond({ok:false,error:"데이터 연결을 사용할 수 없습니다."},503);
  try {
    const record = await recordAutomaticEvidenceFromLiveDB(client,body.productId);
    return respond({ok:true,record,notAdmission:true,notRanking:true});
  } catch {
    return respond({ok:false,error:"자동 평가 이력을 기록하지 못했습니다."},409);
  }
}
