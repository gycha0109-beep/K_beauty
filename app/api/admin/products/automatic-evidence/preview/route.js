import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/admin/access";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { evaluateAutomaticEvidenceFromLiveDB } from "@/lib/product-intelligence/automatic-product-evidence-db-reader-v1.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function respond(body, status = 200) {
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Vercel-CDN-Cache-Control":"no-store",
  }});
}

/** An authenticated admin-only read-only preview. No public recommendation API. */
export async function GET(request) {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if (!access.authenticated || !access.accountUser)
    return respond({ok:false,error:"관리자 로그인이 필요합니다."},401);
  if (!access.allowed || !access.userId)
    return respond({ok:false,error:"제품 검토 권한이 없습니다."},403);
  const productId = new URL(request.url).searchParams.get("productId");
  if (!UUID.test(String(productId)))
    return respond({ok:false,error:"유효한 제품 식별자가 필요합니다."},400);
  const client = createSupabaseAdminClient();
  if (!client) return respond({ok:false,error:"데이터 연결을 사용할 수 없습니다."},503);
  try {
    const result = await evaluateAutomaticEvidenceFromLiveDB(client,productId);
    return respond({
      ok:true,mode:"읽기 전용 자동 평가",
      evidenceReady:result.evaluation.evidenceReady,
      adminReviewRequired:result.evaluation.operatorReviewsRequired,
      notAdmission:true,
      notManufacturerAttestation:true,
      notRanking:true,
      result,
    });
  } catch {
    // Do not disclose DB internals or source payloads from exceptions.
    return respond({ok:false,error:"제품 근거를 읽거나 검증하지 못했습니다."},409);
  }
}
