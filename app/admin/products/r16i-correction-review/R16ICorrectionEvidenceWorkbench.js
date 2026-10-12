"use client";

import Link from "next/link";
import { useState } from "react";
import R16IR4D8RefreshControls from "./R16IR4D8RefreshControls";
import R16IR4D8PrivateEvidence from "./R16IR4D8PrivateEvidence";
import R16IR4D8CorrectionApproval from "./R16IR4D8CorrectionApproval";

const issueUrl = "https://github.com/gycha0109-beep/K_beauty/issues/1204";
const brandUrl = "https://www.snature.kr/product/detail.html?product_no=151";
const sellerUrl = "https://www.hwahae.co.kr/goods/45194";

// These are prompts for human source capture, not attestations or approved data.
const fields = Object.freeze([
  ["brand_option", "공식몰 80ml 옵션 · SKU"],
  ["brand_checkout", "공식몰 결제 직전 가격 · 재고"],
  ["seller_option", "화해 80ml×2 선택 옵션 · 세트 구성"],
  ["seller_checkout", "화해 결제 직전 가격 · 배송비"],
  ["serum_sku", "증정 세럼 10ml 정식 SKU"],
  ["review_scope", "리뷰가 귀속되는 상품 · 옵션"],
  ["capture_origin", "원본 캡처 URL · 시간 · 파일 위치"]
]);
const hints = {
  id: "현재 상품 ID를 유지할지 정확한 범위를 확인합니다.",
  size_ml: "현재 160ml는 세트 총량일 수 있어 80ml 단품으로 즉시 변경할 수 없습니다.",
  price_min: "화해 세트 표시가를 단품 결제가로 사용하지 않습니다.",
  price_max: "실제 선택 옵션별 결제가 근거가 필요합니다.",
  unit_price_per_10ml: "제품 용량과 가격의 판매 단위가 일치해야 합니다.",
  buy_link: "현재 화해 세트 링크와 공식몰 단품 링크를 구분해야 합니다.",
  market_signals: "리뷰가 어느 제품·판매 옵션에 귀속되는지 확인하지 못했습니다.",
  new_offer: "판매 옵션·가격·SKU를 확인하기 전에는 생성하지 않습니다.",
  new_subject: "처방·전성분의 공식 근거 없이는 등록하지 않습니다.",
  ranking: "실제 정정 후 추천 회귀 검증이 필요합니다."
};
const card = "rounded-2xl border border-[#e3e7ee] bg-white shadow-[0_6px_26px_rgba(21,29,45,0.035)] dark:border-[#303741] dark:bg-[#171b22]";
const muted = "text-[#697587] dark:text-[#aeb8c6]";
const inputClass = "mt-2 w-full min-h-[78px] resize-y rounded-xl border border-[#d9e0ea] bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-[#3973e9] focus:ring-2 focus:ring-[#3973e9]/15 dark:border-[#3b4351] dark:bg-[#1d232c] dark:focus:border-[#8bb1ff]";
const outboundClass = "inline-flex items-center gap-1.5 rounded-lg bg-[#edf3ff] px-3.5 py-2 text-xs font-semibold text-[#225ac3] transition hover:bg-[#deeafe] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3973e9] dark:bg-[#1d2d47] dark:text-[#a9c6ff]";
const num = (n) => typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("ko-KR") : "미확정";

function getRow(rows, entity, field) {
  return rows.find((r) => r.entity === entity && r.field === field);
}
function showBefore(v) {
  if (v === null || v === undefined) return "값 없음";
  if (typeof v === "object") {
    if (Object.hasOwn(v, "review_count")) return "리뷰 " + num(v.review_count) + "건 · " + (v.source || "출처 미상");
    return JSON.stringify(v);
  }
  return String(v);
}
function StepTitle({ number, title, description, right }) {
  return (
    <div className="flex flex-wrap items-start gap-3">
      <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#3474f5] text-sm font-bold text-white shadow-[0_3px_8px_rgba(38,108,240,0.2)]">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-bold tracking-tight text-[#192436] dark:text-[#eef3fa]">{title}</h2>
        <p className={"mt-1 text-sm leading-6 " + muted}>{description}</p>
      </div>
      {right}
    </div>
  );
}
function CheckRow({ children }) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-6 text-[#4a5870] dark:text-[#c2cbd7]">
      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4a83f6]" />
      <span>{children}</span>
    </li>
  );
}
function EvidenceTextarea({ field, notes, onUpdate, disabled }) {
  const [key, label] = field;
  return (
    <label className="block text-sm font-semibold text-[#28364a] dark:text-[#e6edf6]">
      {label}
      <textarea
        value={notes[key]}
        onChange={(e) => onUpdate(key, e.target.value)}
        maxLength={1200}
        rows={2}
        disabled={disabled}
        placeholder="확인한 내용과 근거, 또는 미확인 사유"
        className={inputClass}
      />
    </label>
  );
}
function EvidenceSource({ title, subtitle, label, url, items, children }) {
  return (
    <article className="flex min-w-0 flex-col rounded-xl border border-[#e3e8f0] bg-[#fff] p-4 dark:border-[#343b47] dark:bg-[#1b2028] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#6a7a93] dark:text-[#a5b4c9]">{subtitle}</p>
          <h3 className="mt-1 text-base font-bold text-[#1c2c43] dark:text-[#e8eff8]">{title}</h3>
        </div>
        <span className="rounded-full border border-[#f3dabb] bg-[#fff5e8] px-2.5 py-1 text-[11px] font-bold text-[#ae6215] dark:border-[#76552c] dark:bg-[#3b2d1b] dark:text-[#ffcb8b]">확인 대기</span>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" className={outboundClass + " mt-4 self-start"}>
        {label} 열기 <span aria-hidden="true">↗</span>
      </a>
      <div className="mt-4 rounded-xl border border-[#e8edf5] bg-[#f8faff] p-3.5 dark:border-[#303b4a] dark:bg-[#202936]">
        <p className="text-xs font-bold text-[#546784] dark:text-[#b8c8df]">확인 항목</p>
        <ul className="mt-2 space-y-1.5">{items.map((item) => <CheckRow key={item}>{item}</CheckRow>)}</ul>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </article>
  );
}
function CompareCell({ title, rows, tone }) {
  return (
    <div className={"overflow-hidden rounded-xl border " + (tone === "current"
      ? "border-[#ebdedc] dark:border-[#604a47]"
      : "border-[#cee0fa] dark:border-[#334f76]")}>
      <div className={"px-4 py-3 text-sm font-bold " + (tone === "current"
        ? "bg-[#fbf4f2] text-[#8c4b3c] dark:bg-[#382724] dark:text-[#efb4a7]"
        : "bg-[#eff6ff] text-[#235cb9] dark:bg-[#202e45] dark:text-[#a9caff]")}>{title}</div>
      <dl className="divide-y divide-[#eef1f5] dark:divide-[#343b45]">
        {rows.map(([name, value]) => (
          <div key={name} className="grid grid-cols-[78px_minmax(0,1fr)] gap-3 px-4 py-3 text-sm sm:grid-cols-[94px_minmax(0,1fr)]">
            <dt className={muted}>{name}</dt>
            <dd className="min-w-0 break-words font-medium text-[#2c3a4e] dark:text-[#e5eaf1]">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function R16ICorrectionEvidenceWorkbench({ review: initialReview }) {
  const [review, setReview] = useState(initialReview);
  const [notes, setNotes] = useState(() => Object.fromEntries(fields.map(([key]) => [key, ""])));
  const [copyState, setCopyState] = useState("");
  const blocked = review?.decision !== "REVIEW_REQUIRED";
  const rows = blocked ? [] : (Array.isArray(review?.reviewed_fields) ? review.reviewed_fields : []);
  const size = getRow(rows, "products", "size_ml")?.before;
  const price = getRow(rows, "products", "price_min")?.before;
  const reviewSignals = getRow(rows, "products", "market_signals")?.before;
  const seenAt = review?.observed_at && Number.isFinite(Date.parse(review.observed_at))
    ? new Date(review.observed_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })
    : "조회 결과 없음";
  function updateNote(key, value) {
    setNotes((prev) => ({ ...prev, [key]: value }));
    setCopyState("");
  }
  async function copyDraft() {
    if (blocked) return;
    const obj = {
      document_type: "R16I_EVIDENCE_COLLECTION_DRAFT_ONLY",
      product_id: review?.product_id ?? null,
      status: "UNVERIFIED_NOT_APPROVED",
      db_observed_at: review?.observed_at ?? null,
      product_revision: review?.product_revision ?? null,
      evidence: Object.fromEntries(fields.map(([key]) => [key, notes[key].trim() || null])),
      approved_option: null,
      approved_after_values:null,
      operator_approval:false,
      production_write_authorized:false,
      notice: "사용자 메모는 검증된 원본 증거 또는 상품 변경 승인에 해당하지 않습니다."
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      setCopyState("미검증 근거 메모를 복사했습니다. 원본 자료를 이슈에 별도로 첨부해 주세요.");
    } catch {
      setCopyState("클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-8 sm:space-y-5">
      <header className="space-y-3 pb-1">
        <nav aria-label="위치" className={"flex flex-wrap gap-2 text-xs " + muted}>
          <Link href="/admin" className="hover:underline">관리자</Link><span aria-hidden="true">/</span>
          <Link href="/admin/products/trust" className="hover:underline">제품 신뢰 검토</Link><span aria-hidden="true">/</span>
          <span>상품 정정</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#172336] dark:text-[#f1f4fa] sm:text-3xl">
                에스네이처 아쿠아 스쿠알란 수분크림
              </h1>
              <span className="rounded-lg bg-[#ecf0f5] px-2.5 py-1 text-xs font-semibold text-[#637083] dark:bg-[#2b3340] dark:text-[#bcc6d4]">R16I</span>
            </div>
            <p className={"mt-2 text-sm leading-6 " + muted}>
              상품 원본 DB 값은 읽기 전용으로 유지하면서 비공개 증빙·근거 판정·정정안과 승인 이력을 기록합니다.
            </p>
          </div>
          <span className={"rounded-full px-3 py-1.5 text-xs font-bold " + (blocked
            ? "bg-[#fee9e9] text-[#ab2f2f] dark:bg-[#442325] dark:text-[#ffc4c4]"
            : "bg-[#fff0df] text-[#a85813] dark:bg-[#473121] dark:text-[#f8c690]")}>
            {blocked ? "검토 차단" : "상품 정정 미반영 · 검토 진행"}
          </span>
        </div>
        <div className={"text-xs " + muted}>DB 마지막 조회: {seenAt} · 상품정보 DB 변경 없음 · 검토 승인 이력은 아래에서 조회</div>
      </header>

      <R16IR4D8RefreshControls onReview={setReview} />

      {blocked ? (
        <section role="alert" className={card + " border-red-300 bg-red-50 p-5 dark:border-red-900 dark:bg-red-950/30"}>
          <h2 className="text-lg font-bold text-red-800 dark:text-red-200">DB 상태가 기존 검토 기준과 다릅니다</h2>
          <p className="mt-2 text-sm leading-6">상품 리비전·출처·Offer·Subject가 변경되었거나 조회가 불완전합니다. 운영 정정 근거와 DB 값을 표시하지 않습니다.</p>
          <p className="mt-3 break-all font-mono text-xs">{(review?.reasons || []).join(" · ")}</p>
          <p className={"mt-4 text-xs " + muted}>현재 상태에서는 메모 복사·검토 요청이 허용되지 않습니다.</p>
        </section>
      ) : (
        <>
          <section className={card + " overflow-hidden p-4 sm:p-5"}>
            <div className="rounded-xl border-l-4 border-[#ec9b59] bg-[#fff7f0] px-4 py-3.5 dark:bg-[#33281f]">
              <p className="text-sm font-bold text-[#9e4917] dark:text-[#ffbe8d]">현재 발견된 문제</p>
              <p className="mt-1 text-sm leading-6 text-[#364255] dark:text-[#e1d9cf]">
                DB에는 <strong>{num(size)}ml · {num(price)}원</strong>으로 저장되어 있지만,
                이 값이 80ml 단품인지 80ml×2 기획세트인지 구분되지 않았습니다.
              </p>
              <p className={"mt-1 text-xs " + muted}>변경 전 값은 읽기 전용 조회 결과입니다. 공식 상품 구성과 결제가는 아직 승인되지 않았습니다.</p>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              {[
                ["상품 브랜드", "에스네이처"], ["현재 DB 용량", num(size) + "ml"],
                ["현재 DB 가격", num(price) + "원"], ["저장된 리뷰 신호", num(reviewSignals?.review_count) + "건"]
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className={"text-xs " + muted}>{label}</dt>
                  <dd className="mt-1 text-sm font-bold text-[#19283d] dark:text-[#eaf0f8]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={card + " p-4 sm:p-5"}>
            <StepTitle number="1" title="판매처별 실제 정보 확인"
              description="각 판매처에서 현재 옵션과 결제 직전 가격을 확인하십시오. 검색 색인 금액은 검증값이 아닙니다."
              right={<span className="self-start rounded-full bg-[#fff1e6] px-2.5 py-1 text-xs font-bold text-[#a95b1e] dark:bg-[#463123] dark:text-[#f5bd8a]">필수 · 근거 대기</span>} />
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <EvidenceSource title="공식몰 · 크림 80ml 단품" subtitle="제조사 자사몰" label="공식몰 상품" url={brandUrl}
                items={["현재 80ml 단품 판매 및 정확한 SKU", "옵션 선택 후 결제 직전 가격 · 재고", "상품 페이지 및 선택 옵션의 캡처 시각"]}>
                <EvidenceTextarea field={fields[0]} notes={notes} onUpdate={updateNote} disabled={false}/>
                <EvidenceTextarea field={fields[1]} notes={notes} onUpdate={updateNote} disabled={false}/>
              </EvidenceSource>
              <EvidenceSource title="화해 · 크림 80ml×2 + 세럼 10ml" subtitle="판매처 기획세트" label="화해 판매 페이지" url={sellerUrl}
                items={["현재 실제 선택 가능한 기획세트 옵션", "크림 수량 · 추가 세럼의 정확한 SKU", "결제 직전 가격 · 배송비 · 증정품 조건"]}>
                <EvidenceTextarea field={fields[2]} notes={notes} onUpdate={updateNote} disabled={false}/>
                <EvidenceTextarea field={fields[3]} notes={notes} onUpdate={updateNote} disabled={false}/>
              </EvidenceSource>
            </div>
            <div className="mt-4 rounded-xl bg-[#f3f6fb] px-4 py-3 text-xs leading-6 text-[#53647b] dark:bg-[#222b37] dark:text-[#b4c2d5]">
              이 입력창은 메모용으로 서버에 저장되지 않습니다. 아래 별도의 비공개 캡처 등록 기능은 실제로 저장됩니다. <a className="font-semibold underline underline-offset-2" href={issueUrl} target="_blank" rel="noopener noreferrer">정정 이슈 #1204</a>에 별도 첨부해야 하며, 텍스트 입력만으로 사실 확인이나 승인이 완료되지 않습니다.
            </div>
          </section>

          <section className={card + " p-4 sm:p-5"}>
            <StepTitle number="2" title="판매 정보 정정안 미리보기"
              description="A안: 기존 Product ID 유지 + 판매처별 Offer 분리. 아래는 승인된 변경값이 아닌 검토 방향입니다."
              right={<span className="self-start rounded-full bg-[#e9f2ff] px-2.5 py-1 text-xs font-bold text-[#2c66bc] dark:bg-[#223752] dark:text-[#bad5ff]">구조안 · 미확정</span>} />
            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_28px_1fr]">
              <CompareCell title="현재 DB 값 · 그대로 유지 중" tone="current" rows={[
                ["용량", num(size) + "ml"],
                ["가격", num(price) + "원"],
                ["구매 링크", "화해 #45194"],
                ["리뷰 신호", num(reviewSignals?.review_count) + "건 · 귀속 미확인"]
              ]}/>
              <div aria-hidden="true" className="hidden items-center justify-center text-2xl text-[#8ea2be] md:flex">→</div>
              <CompareCell title="분리 정정 방향 · 적용하지 않음" tone="proposed" rows={[
                ["제품 자체", "80ml 단품 여부 및 공식 SKU 재검증"],
                ["판매 옵션", "단품 / 기획세트 별도 표현 검토"],
                ["가격", "각 옵션의 실결제가 확인 후 결정"],
                ["리뷰", "기존 유지 · 실제 귀속 별도 판단"]
              ]}/>
            </div>
            <p className={"mt-3 text-xs leading-6 " + muted}>
              29,900원을 80ml 단품 가격으로 옮기거나, 160ml를 즉시 80ml로 변경하지 않습니다.
              Offer 등록 · Subject 생성 · 추천 반영은 모두 미승인입니다.
            </p>
          </section>

          <section className={card + " p-4 sm:p-5"}>
            <StepTitle number="3" title="확인한 원본 근거 기록"
              description="자유 메모는 로컬에서만 보관되며 복사할 수 있습니다. 비공개 캡처는 별도 업로드로 실제 저장됩니다." />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <EvidenceTextarea field={fields[4]} notes={notes} onUpdate={updateNote} disabled={false}/>
              <EvidenceTextarea field={fields[6]} notes={notes} onUpdate={updateNote} disabled={false}/>
            </div>
            <details className="mt-4 rounded-xl border border-[#e2e8ef] p-3.5 dark:border-[#3b4450]">
              <summary className="cursor-pointer text-sm font-semibold text-[#31405a] dark:text-[#d5dfed]">
                리뷰 귀속 조사 메모 · 별도 확인 항목
              </summary>
              <div className="mt-3">
                <EvidenceTextarea field={fields[5]} notes={notes} onUpdate={updateNote} disabled={false}/>
                <p className={"mt-2 text-xs " + muted}>리뷰 수의 변화만으로 단품 또는 기획세트에 귀속되는 리뷰라고 확정할 수 없습니다.</p>
              </div>
            </details>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={copyDraft}
                className="rounded-xl bg-[#253755] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#354d76] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3f7cf1] dark:bg-[#d9e6fa] dark:text-[#1a2940]">
                미검증 근거 메모 복사
              </button>
              <span role="status" className={"text-xs leading-5 " + muted}>{copyState || "이 7개 자유 메모는 저장되지 않습니다. 아래 비공개 캡처 및 정정 검토 이력은 별도로 저장됩니다."}</span>
            </div>
            <R16IR4D8PrivateEvidence blocked={blocked} />
          </section>

          <section className={card + " p-4 sm:p-5"}>
            <StepTitle number="4" title="최종 검토 · 정정안 승인"
              description="증빙 판정과 정정안 제출·승인·보류·반려를 기록합니다. 상품정보의 실제 DB 반영은 D8-D 이후에만 가능합니다." />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#efd5a7] bg-[#fff9ee] px-4 py-3.5 dark:border-[#624d2e] dark:bg-[#342c20]">
              <p className="text-sm font-medium text-[#925e1c] dark:text-[#f2d3a1]">
                이 단계의 승인과 상품 데이터 실제 적용은 별개입니다. 승인 기록이 있어도 적용은 차단됩니다.
              </p>
              <button type="button" disabled aria-disabled="true"
                title="정정안 승인 이력은 저장할 수 있지만 실제 Product/Offer DB 적용은 D8-D 이후에만 제공됩니다."
                className="cursor-not-allowed rounded-lg bg-[#e1e4e9] px-4 py-2 text-xs font-bold text-[#828b98] dark:bg-[#3a414b] dark:text-[#9fa8b5]">
                실제 DB 반영 · D8-D 전까지 불가
              </button>
            </div>
            <R16IR4D8CorrectionApproval review={review} />
          </section>

          <details className={card + " px-4 py-3.5 sm:px-5"}>
            <summary className="cursor-pointer text-sm font-semibold text-[#43536a] dark:text-[#c8d4e2]">
              기술 상세 · DB 필드 20개 <span className={"ml-2 text-xs font-normal " + muted}>(개발·감사용, 기본 접힘)</span>
            </summary>
            <p className={"mt-3 text-xs leading-6 " + muted}>
              변경 전 값은 SELECT 시점의 스냅샷입니다. 모든 변경 후 값은 미확정이며, 수정·승인 권한을 의미하지 않습니다.
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-[#e4e9f0] dark:border-[#343b46]">
              <table className="w-full min-w-[700px] text-left text-xs">
                <thead className="bg-[#f3f6fa] text-[#40506a] dark:bg-[#242d3a] dark:text-[#d2dce9]">
                  <tr><th className="p-3">DB 필드</th><th className="p-3">현재 값</th><th className="p-3">변경 후</th><th className="p-3">보류 이유</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.entity + "." + row.field} className="border-t border-[#e8edf3] align-top dark:border-[#333b47]">
                      <td className="p-3 font-mono">{row.entity}.{row.field}</td>
                      <td className="max-w-56 break-all p-3">{showBefore(row.before)}</td>
                      <td className="p-3 font-semibold text-[#a26224] dark:text-[#ecc18a]">미확정</td>
                      <td className="p-3 leading-5">{hints[row.field] || "출처·제품 정체성·승인 근거가 필요합니다."}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}

      <p className={"px-1 text-xs leading-6 " + muted}>
        본 화면은 비공개 증빙과 검토·승인 이력을 저장합니다. Product, Offer, Subject, 리뷰, 구매 링크 및 추천 랭킹을 실제 변경하지는 않습니다.
      </p>
    </div>
  );
}
