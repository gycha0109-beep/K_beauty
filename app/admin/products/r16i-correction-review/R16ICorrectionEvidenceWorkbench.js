"use client";
import { useState } from "react";

const issueUrl = "https://github.com/gycha0109-beep/K_beauty/issues/1204";
const brandUrl = "https://www.snature.kr/product/detail.html?product_no=151";
const sellerUrl = "https://www.hwahae.co.kr/goods/45194";
const fields = Object.freeze([
  ["brand_option","공식몰 80ml 옵션·SKU"],
  ["brand_checkout","공식몰 실제 결제 직전 금액·재고"],
  ["seller_option","화해 80ml×2 선택 옵션·구성"],
  ["seller_checkout","화해 결제 직전 가격·배송비"],
  ["serum_sku","세럼 10ml 정식 상품명·SKU"],
  ["review_scope","리뷰가 귀속되는 제품·옵션"],
  ["capture_origin","원본 캡처 URL·시각·파일 위치"]
]);
const hints = {
  size_ml:"기존 160ml는 세트 구성을 포함할 수 있어 단품 80ml로 자동 변경할 수 없습니다.",
  price_min:"기획세트 표시가를 단품 실제가로 사용할 수 없습니다.",
  price_max:"실제 선택 옵션별 결제가가 필요합니다.",
  unit_price_per_10ml:"단위가격의 분모에 해당하는 상품 용량이 필요합니다.",
  buy_link:"화해 세트 URL과 공식 단품 URL을 구분해야 합니다.",
  market_signals:"리뷰의 수집 시점과 실제 상품 귀속 미확인.",
  new_offer:"정확한 옵션과 가격·SKU 확인 필요.",
  new_subject:"같은 처방이라는 공식 근거 필요."
};
function valueString(v){
  if(v === null || v === undefined) return "미확정";
  if(typeof v === "object"){
    if(Object.hasOwn(v,"review_count")) return "리뷰 " + v.review_count + "건 · " + (v.source||"출처 미상");
    return JSON.stringify(v);
  }
  return String(v);
}
export default function R16ICorrectionEvidenceWorkbench({review}){
  const [notes,setNotes] = useState(() => Object.fromEntries(fields.map(([k])=>[k,""])));
  const [status,setStatus] = useState("");
  const blocked = review?.decision !== "REVIEW_REQUIRED";
  const rows = Array.isArray(review?.reviewed_fields)?review.reviewed_fields:[];
  const seenAt = review?.observed_at
    ? new Date(review.observed_at).toLocaleString("ko-KR",{timeZone:"Asia/Seoul"})
    : "DB 확인 실패";
  const liveUpdated = (k,v) => { setNotes(p=>({...p,[k]:v}));setStatus(""); };
  async function copyDraft(){
    const obj={
      document_type:"R16I_EVIDENCE_COLLECTION_DRAFT_ONLY",
      product_id:review?.product_id ?? null,
      status:"UNVERIFIED_NOT_APPROVED",
      db_observed_at:review?.observed_at ?? null,
      product_revision:review?.product_revision ?? null,
      evidence:Object.fromEntries(fields.map(([k])=>[k,notes[k].trim()||null])),
      approved_option:null,approved_after_values:null,
      operator_approval:false,production_write_authorized:false,
      notice:"작성자가 직접 입력한 메모이며 원본 증빙·검증·승인에 해당하지 않습니다."
    };
    try { await navigator.clipboard.writeText(JSON.stringify(obj,null,2));setStatus("초안 복사 완료 · 미승인"); }
    catch { setStatus("브라우저 복사에 실패했습니다."); }
  }
  const panel="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#2b3038] dark:bg-[#16191f] sm:p-6";
  const small="text-xs leading-5 text-[#707986] dark:text-[#a6b0bd]";
  const link="inline-flex rounded-xl border border-[#d2d8e1] px-4 py-2.5 text-sm font-semibold hover:bg-[#f5f6f8] dark:border-[#3b424d] dark:hover:bg-[#252a33]";
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#737d89]">Product evidence / R16I</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">에스네이처 상품 정정 검토</h1>
        <p className="mt-3 text-sm leading-6 text-[#656f7c] dark:text-[#aeb9c6]">
          공식 80ml 단품과 화해 80ml×2 기획세트의 상품·가격·리뷰를 분리하는 관리자 검토 화면입니다.
          승인 또는 상품 수정 기능은 없습니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
          <strong className={blocked?"text-red-700 dark:text-red-300":"text-amber-700 dark:text-amber-300"}>
            {blocked?"현재 상태 충돌 · 차단":"근거 미확보 · 승인 전 보류"}
          </strong>
          <span>읽기 전용 · 실제 변경 0건</span>
          <span>조회: {seenAt}</span>
        </div>
      </header>
      {blocked ? (
        <section role="alert" className="rounded-xl border border-red-300 bg-red-50 p-5 text-sm dark:border-red-900 dark:bg-red-950/30">
          <h2 className="font-semibold">현재 DB 상태가 검증 기준과 다릅니다</h2>
          <p className="mt-2">충돌 또는 수정이 확인되어 변경 전후값을 제공하지 않습니다. 검토를 중단하고 원인을 확인해야 합니다.</p>
          <code className="mt-3 block break-words text-xs">{(review?.reasons||[]).join(", ")}</code>
        </section>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              ["DB에 저장된 기존 값","160ml · 29,900원","기존 혼합 상품 표현 · 수정 승인 전"],
              ["제조사 단품","크림 80ml","현재 결제가격·SKU 미검증"],
              ["화해 판매세트","크림 80ml×2 + 세럼 10ml","선택 옵션·실결제가 미검증"]
            ].map(([label,v,detail])=>(
              <article key={label} className={panel}>
                <p className={small}>{label}</p>
                <p className="mt-2 text-lg font-semibold">{v}</p>
                <p className={"mt-2 "+small}>{detail}</p>
              </article>
            ))}
          </div>
          <section className={panel}>
            <h2 className="text-lg font-semibold">현재 DB 기준 · 정정 검토 20개 항목</h2>
            <p className={"mt-2 "+small}>변경 전 값만 확정할 수 있습니다. 변경 후 값은 승인 전까지 비워 둡니다.</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-[#e5e8ef] dark:border-[#303640]">
              <table className="w-full min-w-[670px] text-left text-xs">
                <thead className="bg-[#f5f7f9] dark:bg-[#252a33]">
                  <tr><th className="p-3">DB 필드</th><th className="p-3">현재 값</th><th className="p-3">변경 후</th><th className="p-3">보류 사유</th></tr>
                </thead>
                <tbody>
                  {rows.map(row=>(
                    <tr key={row.entity+"."+row.field} className="border-t border-[#edf0f3] align-top dark:border-[#303640]">
                      <td className="p-3 font-mono">{row.entity}.{row.field}</td>
                      <td className="max-w-48 break-words p-3">{valueString(row.before)}</td>
                      <td className="p-3 font-semibold text-amber-700 dark:text-amber-300">미확정</td>
                      <td className="p-3 leading-5">{hints[row.field]||"소유자·근거·수정값 확인 필요"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      <section className={panel}>
        <h2 className="text-lg font-semibold">판매 옵션·가격·원본 근거 수집</h2>
        <p className={"mt-2 "+small}>
          검색 색인 가격이나 리뷰수를 현재 결제가·공식 제품 사실로 인정하지 않습니다.
          증빙은 실제 원본 URL, 캡처 시점, 선택 옵션, SKU를 함께 기록해야 합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a className={link} href={brandUrl} target="_blank" rel="noopener noreferrer">공식몰 확인 ↗</a>
          <a className={link} href={sellerUrl} target="_blank" rel="noopener noreferrer">화해 확인 ↗</a>
          <a className={link} href={issueUrl} target="_blank" rel="noopener noreferrer">정정 이슈 #1204 ↗</a>
        </div>
        <div className="mt-5 border-t border-[#e6e9ee] pt-5 dark:border-[#303640]">
          <h3 className="text-sm font-semibold">미검증 현장 메모</h3>
          <p className={"mt-1 "+small}>작성 내용은 서버에 저장되지 않습니다. 복사해서 이슈에 첨부하더라도 승인 상태로 전환되지 않습니다.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {fields.map(([k,label])=>(
              <label key={k} className="block space-y-2">
                <span className="text-sm font-semibold">{label}</span>
                <textarea rows={2} maxLength={1200}
                  value={notes[k]} onChange={e=>liveUpdated(k,e.target.value)}
                  placeholder="직접 검증한 원본 근거 또는 미확인 사유"
                  className="block w-full resize-y rounded-xl border border-[#d7dce4] bg-transparent px-3 py-2 text-sm dark:border-[#404650]" />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={copyDraft} className="rounded-xl bg-[#171a20] px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-[#171a20]">
              미검증 검토 메모 복사
            </button>
            <span role="status" className={small}>{status||"가격·리뷰·제품 정보 자동수정 없음"}</span>
          </div>
        </div>
      </section>
      <footer className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        160ml 세트 가격을 80ml 단품 가격으로 자동 변경하지 않습니다. 실제 운영 승인과 추천 회귀 검증 전까지 Product, Offer, Subject, 구매 링크 및 리뷰 데이터를 수정하지 않습니다.
      </footer>
    </div>
  );
}
