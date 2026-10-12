import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdminCapability } from "@/lib/admin/access";
import { ADMIN_CAPABILITIES } from "@/lib/admin/capabilities";
import { loadTrustIntakeReadiness } from "@/lib/admin/trust-intake-readiness";

export const dynamic="force-dynamic";
export const revalidate=0;
export const runtime="nodejs";
export const metadata={
  title:"상품 식별 준비도 | BEJEWELY 관리자",
  robots:{index:false,follow:false,nocache:true},
};

const CAUSES={
  SUBJECT_ALREADY_EXISTS:"기존 Subject 재해석 필요",
  MARKET_EVIDENCE_REQUIRED:"시장 식별 근거 필요",
  CATALOG_IDENTITY_AUTHORITY_REQUIRED:"상품 식별 권한 근거 필요",
  OFFICIAL_SOURCE_EVIDENCE_REQUIRED:"공식 제품 출처 검증 필요",
  FORMULATION_ATTESTATION_REQUIRED:"처방·리뉴얼 식별 근거 필요",
  GOVERNED_SUBJECT_PREFLIGHT_REQUIRED:"관리자 등록 사전 검증 필요",
};
const card="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#2b3038] dark:bg-[#16191f]";
function metric(label,value) {
  return <div className={card} key={label}>
    <dt className="text-sm text-[#657080] dark:text-[#a9b4c3]">{label}</dt>
    <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
  </div>;
}
export default async function TrustIdentityReadinessPage() {
  const access=await requireAdminCapability(ADMIN_CAPABILITIES.PRODUCTS_REVIEW);
  if(!access.authenticated || !access.accountUser) redirect("/?auth_required=admin");
  if(!access.allowed || !access.userId) notFound();

  let report;
  try {report=await loadTrustIntakeReadiness();}
  catch {
    return <section className={card} role="alert">
      <h1 className="text-xl font-semibold">식별 준비도 조회에 실패했습니다</h1>
      <p className="mt-3 text-sm">운영 DB 연결과 조회 범위를 확인해 주세요. 실패를 완료 상태로 표시하지 않습니다.</p>
    </section>;
  }
  const {summary,items,frontier}=report;
  const visible=items.slice(0,60);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#647184]">TRUST · P0/P1 preflight</p>
      <h1 className="mt-2 text-2xl font-semibold">신규 상품 식별 준비도</h1>
      <p className="mt-3 text-sm leading-7 text-[#627080] dark:text-[#aab5c3]">
        Subject 미생성으로 정지된 상품을 원인별로 분류합니다.
        이 페이지는 읽기 전용이며, 상품·Subject 생성이나 Fact 승인을 실행하지 않습니다.
      </p>
    </header>
    <dl className="grid gap-3 sm:grid-cols-3">
      {metric("Subject 생성이 필요한 상품",summary.products)}
      {metric("차단된 개별 조사 작업",summary.blockedTasks)}
      {metric("기존 출처 연결이 있는 상품",summary.productsWithResolvedBindings)}
    </dl>
    <section className={card}>
      <h2 className="text-lg font-semibold">가장 먼저 해결할 문제</h2>
      <div className="mt-4 grid gap-2">
        {Object.entries(summary.byNextAction).map(([code,count])=>
          <div key={code} className="flex justify-between gap-4 rounded-lg bg-[#f5f6f8] px-4 py-3 text-sm dark:bg-[#22262d]">
            <span>{CAUSES[code]??code}</span><strong className="tabular-nums">{count}개</strong>
          </div>)}
        {summary.products===0 && <p className="text-sm">현재 조회된 Subject 미생성 작업이 없습니다.</p>}
      </div>
      <p className="mt-4 text-xs leading-6 text-[#647184] dark:text-[#aab5c3]">
        연결된 화해 등 제3자 출처는 공식 제조사 검증을 대신하지 않습니다.
        현재 자료만으로 자동 Subject 생성이 허가된 상품은 0개입니다.
      </p>
    </section>
    <section className={card}>
      <h2 className="text-lg font-semibold">P1 · 같은 브랜드의 공식 출처 재활용</h2>
      <p className="mt-3 text-sm leading-7 text-[#627080] dark:text-[#aab5c3]">
        이미 확인된 <strong>다른 제품</strong>의 공식 출처를 브랜드 사이트 탐색의 출발점으로만 사용합니다.
        새 상품의 공식 근거·판매 시장·처방이 검증됐다는 뜻이 아니며, 자동 Subject 생성은 허가하지 않습니다.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {metric("브랜드 공식 탐색 후보 확보",frontier.withSeeds)}
        {metric("검증된 브랜드 출발점 없음",frontier.withoutSeeds)}
      </div>
      <p className="mt-3 text-xs text-[#657080] dark:text-[#a9b4c3]">
        해당 숫자는 실제 신규 상품 공식 페이지 발견 건수가 아닙니다. AI API 호출 0회, DB 쓰기 0건입니다.
      </p>
    </section>
    <section className={card}>
      <h2 className="text-lg font-semibold">상품별 확인 목록</h2>
      <p className="mt-2 text-sm text-[#657080] dark:text-[#a9b4c3]">
        이름과 원인만 표시하며 승인·생성 버튼은 제공하지 않습니다.
      </p>
      <ul className="mt-4 divide-y divide-[#e4e7ed] dark:divide-[#303741]">
        {visible.map(item=><li key={item.intakeId} className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="break-words text-sm font-semibold">{item.brand} · {item.name}</p>
            <span className="rounded-full bg-[#f3eee7] px-2.5 py-1 text-xs font-semibold text-[#8b541c] dark:bg-[#3b2b1d] dark:text-[#f1bc87]">
              {CAUSES[item.nextAction]??item.nextAction}
            </span>
          </div>
          <p className="mt-1 text-xs text-[#657080] dark:text-[#a9b4c3]">
            시장: {item.market??"미확인"} · 조사 {item.taskCount}건 ·
            기존 연결 {item.resolvedBindingCount}건 ·
            브랜드 공식 사이트 탐색 후보 {item.discoveryFrontier?.seedCount??0}개
          </p>
          {item.discoveryFrontier?.discoveryOrigins?.length>0 && <p className="mt-1 break-all text-xs text-[#657080] dark:text-[#a9b4c3]">
            출발 도메인: {item.discoveryFrontier.discoveryOrigins.map(x=>new URL(x.origin).hostname).join(", ")}
            {" · "}제품 일치/시장/처방 미검증
          </p>}
        </li>)}
      </ul>
      {items.length>visible.length && <p className="mt-3 text-sm text-[#657080] dark:text-[#a9b4c3]">
        최초 {visible.length}개 상품만 표시했습니다. 상단 집계는 전체 {items.length}개 기준입니다.
      </p>}
    </section>
    <Link href="/admin/products/trust" className="inline-block text-sm font-semibold underline underline-offset-4">
      TRUST 제품 신뢰 검토로 돌아가기
    </Link>
  </div>;
}
