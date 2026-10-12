import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES, ADMIN_ROLES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { readR16IR4D4Review } from "@/lib/product-offer-r16i-r4-d4-db-reader.mjs";
import {
  listR16ID8C,reviewR16IEvidence,createR16IProposal,decideR16IProposal
} from "@/lib/product-intelligence/r16i-correction-approval-ledger.mjs";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const MAX_JSON_BYTES=8192;
const answer=(body,status=200)=>NextResponse.json(body,{status,headers:{
  "Cache-Control":"private, no-store, max-age=0",
  "CDN-Cache-Control":"no-store","Vercel-CDN-Cache-Control":"no-store"
}});
async function guard(){
  const access=await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if(!access.authenticated||!access.accountUser)
    return {error:answer({ok:false,error:"관리자 로그인이 필요합니다."},401)};
  if(!access.allowed||!access.userId)
    return {error:answer({ok:false,error:"상품 검토 권한이 필요합니다."},403)};
  const client=createSupabaseAdminClient();
  if(!client)return {error:answer({ok:false,error:"데이터 연결을 사용할 수 없습니다."},503)};
  return {access,client};
}
async function readGuardedReview(client){
  const review=await readR16IR4D4Review(client);
  if(review.decision!=="REVIEW_REQUIRED"||review.live_read_verified!==true||
     review.revision_matches!==true||review.collision_free!==true)
    throw Error("R16I_PRESTATE_BLOCKED");
  return review;
}
export async function GET(){
  const a=await guard();
  if(a.error)return a.error;
  try{
    const review=await readGuardedReview(a.client);
    const ledger=await listR16ID8C(a.client,review);
    return answer({ok:true,ledger,canOwnerDecide:a.access.role===ADMIN_ROLES.OWNER,
      notProductApproval:true,notProductionWrite:true});
  }catch{
    return answer({ok:false,error:"정정 검토 이력 또는 상품 최신 상태를 확인하지 못했습니다."},409);
  }
}
/** Append-only evidence review, correction proposal and owner decision.
 * Explicitly no Product, Offer, Subject, ranking or checkout price mutations.
 */
export async function POST(request){
  const a=await guard();
  if(a.error)return a.error;
  if(!request.headers.get("origin")||
     request.headers.get("origin")!==new URL(request.url).origin)
    return answer({ok:false,error:"요청 출처가 올바르지 않습니다."},403);
  const len=Number(request.headers.get("content-length"));
  if(!Number.isSafeInteger(len)||len<2||len>MAX_JSON_BYTES)
    return answer({ok:false,error:"요청 크기가 올바르지 않습니다."},413);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))
    return answer({ok:false,error:"JSON 형식만 허용됩니다."},415);
  let body;
  try{body=await request.json();}catch{
    return answer({ok:false,error:"요청 내용을 읽을 수 없습니다."},400);
  }
  if(!body||typeof body!=="object"||Array.isArray(body)||
     Object.keys(body).length!==2||typeof body.action!=="string"||
     !body.payload||typeof body.payload!=="object"||Array.isArray(body.payload))
    return answer({ok:false,error:"정정 검토 요청 형식이 올바르지 않습니다."},400);
  const allowed=["review_evidence","create_proposal","decide_proposal"];
  if(!allowed.includes(body.action))
    return answer({ok:false,error:"허용되지 않은 정정 작업입니다."},400);
  const ownerOnly=body.action==="review_evidence"||body.action==="decide_proposal";
  if(ownerOnly&&a.access.role!==ADMIN_ROLES.OWNER)
    return answer({ok:false,error:"근거 판정·정정안 결정은 소유자 권한이 필요합니다."},403);
  try{
    const review=await readGuardedReview(a.client);
    const result=body.action==="review_evidence"
      ?await reviewR16IEvidence(a.client,body.payload,a.access.userId)
      :body.action==="create_proposal"
        ?await createR16IProposal(a.client,body.payload,a.access.userId,review)
        :await decideR16IProposal(a.client,body.payload,a.access.userId,review);
    return answer({ok:true,action:body.action,result,
      productWrites:0,offerWrites:0,subjectWrites:0,rankingWrites:0,
      productionWriteAuthorized:false},201);
  }catch{
    return answer({ok:false,error:"근거 또는 변경 전 값이 유효하지 않거나 이미 처리되었습니다. DB 새로고침 후 다시 확인해 주세요."},409);
  }
}
