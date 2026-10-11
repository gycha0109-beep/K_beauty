import { NextResponse } from "next/server";
import { requireAdminCapability } from "@/lib/admin/access";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { readR16IR4D4Review } from "@/lib/product-offer-r16i-r4-d4-db-reader.mjs";

export const dynamic="force-dynamic";
export const runtime="nodejs";
function respond(body,status=200){
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Vercel-CDN-Cache-Control":"no-store"
  }});
}

/** Authenticated admin-only, exact-case production SELECT preview; no POST or writes. */
export async function GET(){
  const access=await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if(!access.authenticated || !access.accountUser)
    return respond({ok:false,error:"관리자 로그인이 필요합니다."},401);
  if(!access.allowed || !access.userId)
    return respond({ok:false,error:"제품 검토 권한이 없습니다."},403);
  const client=createSupabaseAdminClient();
  if(!client) return respond({ok:false,error:"데이터 연결을 사용할 수 없습니다."},503);
  try{
    const review=await readR16IR4D4Review(client);
    return respond({
      ok:true,mode:"읽기 전용 상품 정정 검토",
      review,notApproval:true,notWrite:true,
      notRecommendationRelease:true
    });
  }catch{
    return respond({ok:false,error:"정정 근거를 안전하게 검증하지 못했습니다."},409);
  }
}
