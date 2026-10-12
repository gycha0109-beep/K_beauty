import { NextResponse } from "next/server";
import { ADMIN_CAPABILITIES, ADMIN_ROLES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const PRODUCT_ID = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY = 2048;
const APPLY_FLAG = "BEJEWELY_R16I_D8D_APPLY_ENABLED";

function answer(body, status=200) {
  return NextResponse.json(body, {status,headers:{
    "Cache-Control":"private, no-store, max-age=0",
    "CDN-Cache-Control":"no-store",
    "Vercel-CDN-Cache-Control":"no-store"
  }});
}
async function authorize() {
  const access = await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if(!access.authenticated || !access.accountUser)
    return {error:answer({ok:false,error:"관리자 로그인이 필요합니다."},401)};
  if(!access.allowed || access.role!==ADMIN_ROLES.OWNER || !access.userId)
    return {error:answer({ok:false,error:"정정 적용·원복은 소유자 권한이 필요합니다."},403)};
  const client=createSupabaseAdminClient();
  if(!client)return {error:answer({ok:false,error:"서비스 데이터베이스 연결이 없습니다."},503)};
  return {client,access};
}
const exact=(value,names)=>value&&typeof value==="object"&&!Array.isArray(value)&&
  Object.keys(value).length===names.length&&names.every(k=>Object.hasOwn(value,k));

/** Show the current protected gate and historical write events even after D4's frozen snapshot changes. */
export async function GET() {
  const authorized=await authorize();
  if(authorized.error)return authorized.error;
  const c=authorized.client;
  try {
    const [gate,history]=await Promise.all([
      c.from("admin_r16i_correction_release_gate_v1").select("enabled,change_ticket,changed_at")
        .eq("scope","R16I_S_NATURE_PRODUCT_1").maybeSingle(),
      c.from("admin_r16i_correction_applications_v1")
        .select("application_id,proposal_id,product_id,offer_id,before_values,after_values,offer_values,applied_at,rolled_back_at,rolled_back_by")
        .eq("product_id",PRODUCT_ID).order("applied_at",{ascending:false}).limit(10)
    ]);
    if(gate.error||!gate.data||history.error||!Array.isArray(history.data))
      return answer({ok:false,error:"적용 이력과 안전 잠금 상태를 읽지 못했습니다."},409);
    const envReady=process.env[APPLY_FLAG]==="true";
    return answer({ok:true,phase:"R16I_D8D",releaseGateEnabled:gate.data.enabled===true,
      serverApplyEnabled:envReady,applyAvailable:gate.data.enabled===true && envReady,
      releaseTicket:gate.data.change_ticket||null,
      applications:history.data.map(r=>({
        applicationId:r.application_id,proposalId:r.proposal_id,
        productId:r.product_id,offerId:r.offer_id,
        before:r.before_values,after:r.after_values,offer:r.offer_values,
        appliedAt:r.applied_at,rolledBackAt:r.rolled_back_at,
        state:r.rolled_back_at?"ROLLED_BACK":"APPLIED"
      })),
      currentProductWriteInThisRequest:false});
  } catch {
    return answer({ok:false,error:"적용 상태를 조회할 수 없습니다."},409);
  }
}
/** Preview is always read-only. Apply needs TWO independent rollout gates and owner confirmation.
 * Rollback can be executed after a prior apply even if the rollout gates have since closed.
 */
export async function POST(request) {
  const authorized=await authorize();
  if(authorized.error)return authorized.error;
  const origin=request.headers.get("origin");
  if(!origin||origin!==new URL(request.url).origin)
    return answer({ok:false,error:"요청 출처 검증 실패"},403);
  const size=Number(request.headers.get("content-length"));
  if(!Number.isSafeInteger(size)||size<2||size>MAX_BODY)
    return answer({ok:false,error:"요청 크기 제한 위반"},413);
  if(!/^application\/json(?:;|$)/i.test(request.headers.get("content-type")||""))
    return answer({ok:false,error:"JSON 요청만 허용됩니다."},415);
  let body;
  try { body=await request.json(); } catch { return answer({ok:false,error:"JSON 파싱 실패"},400); }
  if(!body||typeof body!=="object"||Array.isArray(body)||
     !["PREVIEW","APPLY","ROLLBACK"].includes(body.mode))
    return answer({ok:false,error:"지원하지 않는 작업입니다."},400);
  if(body.mode==="ROLLBACK"?
    !exact(body,["mode","applicationId","requestId","confirmation"])||
      !UUID.test(body.applicationId)||body.confirmation!=="원복 실행":
    !exact(body,["mode","proposalId","requestId","confirmation"])||
      !UUID.test(body.proposalId)||
      body.confirmation!==(body.mode==="APPLY"?"실제 DB 반영":"변경 전 검토"))
    return answer({ok:false,error:"작업 범위 또는 명시적 확인 문구가 틀렸습니다."},400);
  if(!UUID.test(body.requestId))
    return answer({ok:false,error:"유효하지 않은 요청 식별자입니다."},400);
  if(body.mode==="APPLY" && process.env[APPLY_FLAG]!=="true")
    return answer({ok:false,error:"서버의 운영 반영 잠금이 해제되지 않았습니다."},423);

  try {
    const c=authorized.client;
    const action=body.mode==="ROLLBACK"
      ?await c.rpc("r16i_d8d_rollback_v1",{
        p_application_id:body.applicationId,p_actor_id:authorized.access.userId,
        p_request_id:body.requestId
      })
      :await c.rpc("r16i_d8d_apply_v1",{
        p_proposal_id:body.proposalId,p_actor_id:authorized.access.userId,
        p_request_id:body.requestId,p_mode:body.mode
      });
    if(action.error||!action.data||typeof action.data.status!=="string")
      return answer({ok:false,error:"DB 트랜잭션 검증에 실패하여 적용·원복을 중단했습니다."},409);
    const result=action.data;
    if(body.mode==="PREVIEW" && (result.status!=="PREVIEW_VERIFIED_NO_WRITE"||
        result.productWrites!==0||result.offerWrites!==0))
      return answer({ok:false,error:"미리보기 응답 무결성 오류"},409);
    if(body.mode==="APPLY" && (result.status!=="APPLIED"||
        result.productWrites!==1||result.offerWrites!==1))
      return answer({ok:false,error:"적용 결과 무결성 확인 실패"},409);
    if(body.mode==="ROLLBACK" && (result.status!=="ROLLED_BACK"||
        result.productWrites!==1||result.offerDeletes!==1))
      return answer({ok:false,error:"원복 결과 무결성 확인 실패"},409);
    return answer({ok:true,result,mode:body.mode,manualConfirmation:true},body.mode==="PREVIEW"?200:201);
  } catch {
    return answer({ok:false,error:"실행을 안전하게 완료하지 못했습니다. 이력을 다시 조회하세요."},409);
  }
}
