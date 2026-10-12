import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { requireAdminCapability } from "@/lib/admin/access";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { classifyAutomaticEvidenceAttention } from "@/lib/product-intelligence/automatic-evidence-daily-v1.mjs";
import { readAutomaticEvidenceRunHealth } from "@/lib/product-intelligence/automatic-evidence-run-health-v1.mjs";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const metadata = {
  title:"상품 자동 근거 평가 · 중요 예외",
  robots:{index:false,follow:false,nocache:true},
};
const LIMIT=100;
const card="rounded-2xl border border-[#dde2e9] bg-white p-5 dark:border-[#2b3038] dark:bg-[#16191f]";
const small="text-sm leading-6 text-[#5e6876] dark:text-[#aeb6c3]";
const REASONS=Object.freeze({
  SUBJECT_IDENTITY_UNRESOLVED:"상품 근거 대상의 신원이 확정되지 않았습니다.",
  EVIDENCE_IDENTITY_SCOPE_MISMATCH:"근거 자료와 상품 대상의 범위가 일치하지 않습니다.",
  AUTHORITATIVE_FACT_CONFLICT:"권위 있는 근거 사이에 충돌이 발견되었습니다.",
  "CORE_EVIDENCE_LOST:category_slot":"검증된 상품 카테고리 근거가 더 이상 유지되지 않습니다.",
  "CORE_EVIDENCE_LOST:uv_filter_type":"검증된 UV 필터 유형 근거가 더 이상 유지되지 않습니다.",
});
function dateLabel(value) {
  if(!value) return "기록 없음";
  const date=new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("ko-KR",{
    timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",
  }) : "기록 시각 확인 불가";
}
function ResultState({title,detail}) {
  return <section className={card} role="status">
    <h1 className="text-xl font-semibold">{title}</h1>
    <p className={"mt-3 "+small}>{detail}</p>
  </section>;
}
export default async function AutomaticEvidenceInboxPage() {
  const access=await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if(!access.authenticated || !access.accountUser) redirect("/?auth_required=admin");
  if(!access.allowed || !access.userId) notFound();

  let rows;
  let runHealth;
  try {
    const client=createSupabaseAdminClient();
    if(!client) throw new Error("DATA_CONNECTION_MISSING");
    const {data,error}=await client.from("automatic_product_evidence_history_v1")
      .select("history_id,product_id,subject_id,evaluated_at,event_kind,changed_fields,fields,exceptions")
      .order("history_id",{ascending:false}).limit(LIMIT);
    if(error || !Array.isArray(data)) throw new Error("DATA_READ_FAILED");
    rows=data;
    runHealth=await readAutomaticEvidenceRunHealth(client);
  } catch {
    return <ResultState title="자동 평가 기록을 불러오지 못했습니다"
      detail="평가 이력 또는 자동 실행 로그의 조회에 실패했습니다. 조회 실패를 '예외 없음'으로 처리하지 않습니다." />;
  }

  const seen=new Set(),latest=[];
  for(const row of rows) {
    const identity=row.product_id+"|"+row.subject_id;
    if(seen.has(identity)) continue;
    seen.add(identity);
    latest.push(row);
  }
  const attention=latest.map(row=>classifyAutomaticEvidenceAttention(row))
    .filter(Boolean);
  const lastEvaluation=latest.reduce((last,row)=>{
    const time=Date.parse(row.evaluated_at??"");
    return Number.isFinite(time)&&time>last?time:last;
  },0);
  const truncated=rows.length===LIMIT;
  const healthText={
    unobserved:"실행 기록 없음 · 가동 상태 미확인",
    running:"실행 중 · 완료 결과 대기",
    interrupted:"실행 시작 후 완료 기록 없음 · 확인 필요",
    failed:"최근 자동 실행 실패 · 확인 필요",
    stale:"마지막 정상 실행 36시간 경과 · 확인 필요",
    healthy:"최근 정상 실행 확인",
    clock_error:"실행 시각 이상 · 확인 필요",
  };
  return <div className="mx-auto max-w-5xl space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#68727f]">Evidence operations</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">상품 자동 평가 · 중요 예외</h1>
      <p className={"mt-3 "+small}>
        자동 평가 이력의 현재 상태만 조회합니다. 불충분한 일반 근거는 검토 요청으로 만들지 않으며,
        제품 승인·추천 편입·랭킹 수정은 실행하지 않습니다.
      </p>
    </header>

    <section className={card} aria-label="자동 실행 상태">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">자동 실행 상태</h2>
          <p className={"mt-1 "+small}>평가 내용이 아니라 별도의 실행 로그를 기준으로 표시합니다.</p>
        </div>
        <span role="status" className={runHealth.warning
          ?"rounded-full border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
          :"rounded-full border border-[#cbd9cb] bg-[#eff7ef] px-3 py-1.5 text-xs font-semibold text-[#236035] dark:border-[#23503a] dark:bg-[#173024] dark:text-[#a6d9b1]"}>
          {healthText[runHealth.state]??"실행 상태 확인 필요"}
        </span>
      </div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <div><dt className={small}>최근 실행 시작</dt><dd className="mt-1 text-sm font-semibold">{dateLabel(runHealth.lastStartedAt)}</dd></div>
        <div><dt className={small}>마지막 정상 완료</dt><dd className="mt-1 text-sm font-semibold">{dateLabel(runHealth.lastSuccessAt)}</dd></div>
        <div><dt className={small}>마지막 완료 기록</dt><dd className="mt-1 text-sm font-semibold">{dateLabel(runHealth.lastCompletedAt)}</dd></div>
      </dl>
      {runHealth.state==="unobserved" && <p className={"mt-3 "+small}>
        운영 로그 도입 이전에 생성된 평가 이력은 자동 실행 성공으로 간주하지 않습니다.
      </p>}
      {runHealth.warning && <p className="mt-3 text-sm text-[#91551e] dark:text-[#f1b87d]">
        Vercel 예약 실행 설정과 서버 연결, 최근 실패 기록을 확인해 주세요.
      </p>}
      {runHealth.limitedWindow && <p className={"mt-3 "+small}>
        최근 실행 이벤트 100건만 조회했습니다. 전체 실행 이력 통계는 아닙니다.
      </p>}
    </section>

    <section className="grid gap-3 sm:grid-cols-3" aria-label="자동 평가 현황">
      <div className={card}>
        <p className={small}>확인된 최신 평가 대상</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{latest.length}개</p>
      </div>
      <div className={card}>
        <p className={small}>중요 예외</p>
        <p className="mt-2 text-2xl font-semibold tabular-nums">{attention.length}건</p>
      </div>
      <div className={card}>
        <p className={small}>마지막 기록 시각</p>
        <p className="mt-2 text-sm font-semibold">{lastEvaluation?dateLabel(lastEvaluation):"기록 없음"}</p>
      </div>
    </section>

    {truncated && <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      최근 이력 100건만 조회했습니다. 오래된 대상은 이 집계에 포함되지 않을 수 있습니다.
    </p>}

    <section className={card} aria-label="중요 예외 인박스">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">확인이 필요한 변경</h2>
        <span className="rounded-full bg-[#f0f2f5] px-3 py-1 text-xs font-semibold dark:bg-[#252a32]">
          읽기 전용
        </span>
      </div>
      {attention.length>0?
        <ul className="mt-5 divide-y divide-[#e5e8ed] dark:divide-[#323841]">
          {attention.map(item=><li key={item.historyId} className="py-4 first:pt-0 last:pb-0">
            <p className="text-sm font-semibold text-[#ac541e] dark:text-[#f9b77e]">근거 확인 필요</p>
            <p className="mt-1 break-all text-xs text-[#6a7280] dark:text-[#aab2c0]">제품 ID: {item.productId}</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
              {item.reasonCodes.map(code=><li key={code}>{REASONS[code]??code}</li>)}
            </ul>
            <p className="mt-2 text-xs text-[#6a7280] dark:text-[#aab2c0]">평가: {dateLabel(item.evaluatedAt)} · 이력 #{item.historyId}</p>
          </li>)}
        </ul>:
        <p className={"mt-4 "+small}>
          {latest.length===0
            ?"평가 이력이 아직 없습니다. 실행 여부를 확인해야 합니다."
            :"저장된 최신 평가에서 중요 예외가 발견되지 않았습니다. 일반적인 근거 부족은 숨겼습니다."}
        </p>}
    </section>

    <section className={card}>
      <h2 className="font-semibold">운영 범위</h2>
      <p className={"mt-2 "+small}>
        평가 이력과 별도의 시작·완료 실행 로그를 조회합니다. 정상 완료 후 36시간 초과,
        최근 실행 실패 또는 시작 후 20분 동안 완료 없음은 경고로 표시합니다.
        예약 서비스가 요청을 보내지 않거나 DB 접속이 끊긴 경우에는 기록 자체가 없을 수 있습니다.
        외부 알림은 발송하지 않으며, 실제 호출 경로는 Vercel 로그로 추가 확인해야 합니다.
      </p>
      <Link href="/admin/products/trust"
        className="mt-4 inline-block text-sm font-semibold underline underline-offset-4">
        제품 신뢰 검토로 이동
      </Link>
    </section>
  </div>;
}
