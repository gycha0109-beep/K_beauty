import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { readR16IR4D4Review } from "@/lib/product-offer-r16i-r4-d4-db-reader.mjs";
import { listR16IEvidence, saveR16IEvidence, signR16IEvidence }
  from "@/lib/product-intelligence/r16i-private-evidence-store.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BODY = 5 * 1024 * 1024;
function reply(body,status=200) {
  return NextResponse.json(body,{status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store"
  }});
}
async function authorize() {
  const access=await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if(!access.authenticated || !access.accountUser)
    return {error:reply({ok:false,error:"관리자 로그인 필요"},401)};
  if(!access.allowed || !access.userId)
    return {error:reply({ok:false,error:"제품 근거 검토 권한 없음"},403)};
  const client=createSupabaseAdminClient();
  if(!client) return {error:reply({ok:false,error:"데이터 연결 불가"},503)};
  return {access,client};
}

/** Evidence is not a product fact or approval; only verified admin sees metadata. */
export async function GET(request) {
  const a=await authorize();
  if(a.error) return a.error;
  try{
    const id=new URL(request.url).searchParams.get("evidenceId");
    if(id) return reply({ok:true,mode:"private_signed_preview",preview:await signR16IEvidence(a.client,id)});
    return reply({ok:true,mode:"unverified_evidence",items:await listR16IEvidence(a.client)});
  }catch{
    return reply({ok:false,error:"비공개 증빙을 불러오지 못했습니다."},409);
  }
}
/** Upload is operator-initiated. Never modifies products, offers, subjects or rankings. */
export async function POST(request) {
  const a=await authorize();
  if(a.error) return a.error;
  const origin=request.headers.get("origin");
  if(!origin || origin!==new URL(request.url).origin)
    return reply({ok:false,error:"요청 출처가 올바르지 않습니다."},403);
  const length=Number(request.headers.get("content-length"));
  if(!Number.isFinite(length) || length<=0 || length>MAX_BODY)
    return reply({ok:false,error:"첨부 요청 크기를 확인할 수 없습니다."},413);
  const type=request.headers.get("content-type")||"";
  if(!/^multipart\/form-data(?:;|$)/i.test(type))
    return reply({ok:false,error:"이미지 첨부 형식이 올바르지 않습니다."},415);
  try{
    // Product/Offer collision or revision drift => refuse even evidence association.
    const review=await readR16IR4D4Review(a.client);
    if(review.decision!=="REVIEW_REQUIRED")
      return reply({ok:false,error:"상품 상태가 변경되어 근거 등록을 차단했습니다."},409);
    const form=await request.formData();
    const saved=await saveR16IEvidence(a.client,a.access.userId,form);
    return reply({ok:true,saved,notApproval:true,productWrites:0},201);
  }catch{
    return reply({ok:false,error:"근거 자료를 안전하게 저장하지 못했습니다. 입력값·버킷 구성을 확인해 주세요."},409);
  }
}
