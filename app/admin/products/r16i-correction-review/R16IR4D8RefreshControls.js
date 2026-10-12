"use client";

import { useState } from "react";

const DB_ENDPOINT = "/api/admin/products/r16i-correction-review";
const SOURCE_ENDPOINT = "/api/admin/products/r16i-correction-review/source-refresh";
const STATUS = Object.freeze({
  HTML_VISIBLE_UNVERIFIED: "페이지 응답 확인 · 옵션 및 결제가 미검증",
  ACCESS_RESTRICTED: "접근 제한 · 수동 원본 캡처 필요",
  REDIRECT_BLOCKED: "허용되지 않은 사이트로 이동하여 조회 차단",
  REDIRECT_WITHOUT_LOCATION: "이동할 주소 확인 실패",
  TOO_MANY_REDIRECTS: "페이지 이동 횟수 초과",
  UNEXPECTED_CONTENT_TYPE: "상품 HTML이 아닌 응답",
  PAGE_TOO_LARGE: "응답 크기 제한 초과",
  HTTP_ERROR: "상품 페이지 요청 실패",
  NETWORK_OR_TIMEOUT_ERROR: "네트워크 연결 실패 또는 시간 초과"
});
const small = "text-xs leading-5 text-[#718094] dark:text-[#aebad0]";
const btn = "rounded-xl border border-[#cbd8ec] bg-white px-4 py-2.5 text-sm font-bold text-[#2a5baf] transition hover:bg-[#f1f6ff] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#4b5a72] dark:bg-[#263142] dark:text-[#b6d1ff]";

async function safeGet(path) {
  const r = await fetch(path, {
    method: "GET", credentials: "same-origin", cache: "no-store",
    headers: { "Accept": "application/json" }
  });
  const body = await r.json().catch(() => null);
  if (!r.ok || body?.ok !== true) throw new Error(body?.error || "관리자 조회에 실패했습니다.");
  return body;
}
export default function R16IR4D8RefreshControls({ onReview }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [inspection, setInspection] = useState(null);
  async function refreshDatabase() {
    if (busy) return;
    setBusy("db");
    setMessage("");
    try {
      const body = await safeGet(DB_ENDPOINT);
      if (!body.review || body.review.product_id !== "b639c8b4-6a61-440e-b4db-fac7381593ff")
        throw new Error("대상 상품의 최신 조회 결과를 확인할 수 없습니다.");
      onReview(body.review);
      setMessage(body.review.decision === "REVIEW_REQUIRED"
        ? "DB 최신 조회를 완료했습니다. 실제 상품값은 변경하지 않았습니다."
        : "DB 상태 변경·충돌을 확인했습니다. 정정 검토가 차단됐습니다.");
    } catch {
      // Never show old readback as if it were refreshed.
      onReview({ decision: "BLOCKED", reasons: ["R16I_D8_LIVE_DB_REFRESH_FAILED"] });
      setMessage("DB 새로고침에 실패했습니다. 이전 값을 현재 상태로 사용할 수 없어 검토를 차단했습니다.");
    } finally {
      setBusy("");
    }
  }
  async function refreshSources() {
    if (busy) return;
    setBusy("source");
    setInspection(null);
    setMessage("");
    try {
      const body = await safeGet(SOURCE_ENDPOINT);
      if (body.inspection?.commercialFactsApproved !== false ||
          body.inspection?.checkoutVerified !== false ||
          body.inspection?.productWriteAuthorized !== false ||
          !Array.isArray(body.inspection.sources) ||
          body.inspection.sources.length !== 2)
        throw new Error("외부 원본 검증 상태가 불완전합니다.");
      setInspection(body.inspection);
      setMessage("판매처 접근 확인을 마쳤습니다. 결제 옵션·실판매가는 별도 확인이 필요합니다.");
    } catch {
      setMessage("판매처 상태 조회에 실패했습니다. 판매정보는 자동으로 갱신되지 않았습니다.");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="rounded-2xl border border-[#dce4f0] bg-[#f7faff] p-4 dark:border-[#364458] dark:bg-[#1c293a] sm:p-5" aria-label="실제 정보 갱신">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1c304e] dark:text-[#e0eeff]">실제 정보 갱신</h2>
          <p className={small + " mt-1"}>
            DB 조회와 판매처 원본 접근 확인을 구분합니다. 판매처 가격은 실제 선택 옵션의 결제가로 자동 승인되지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={Boolean(busy)} onClick={refreshDatabase} className={btn}>
            {busy === "db" ? "DB 조회 중…" : "DB 새로고침"}
          </button>
          <button type="button" disabled={Boolean(busy)} onClick={refreshSources} className={btn}>
            {busy === "source" ? "판매처 확인 중…" : "판매처 정보 조회"}
          </button>
        </div>
      </div>
      <p role="status" aria-live="polite" className={small + " mt-3"}>{message || "조회 버튼을 누르면 실제 최신 읽기 결과를 표시합니다."}</p>
      {inspection && (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {inspection.sources.map((source) => (
            <div key={source.key} className="rounded-lg border border-[#e2e8f0] bg-white p-3 text-sm dark:border-[#3c4858] dark:bg-[#222e3e]">
              <p className="font-semibold">{source.label}</p>
              <p className={small + " mt-1"}>{STATUS[source.state] || "원본 상태 판별 불가"}</p>
              <p className={small + " mt-1"}>조회: {source.observedAt && Number.isFinite(Date.parse(source.observedAt))
                ? new Date(source.observedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "확인 불가"}</p>
              {source.rawHtmlSha256 && (
                <p className={small + " mt-1"} title={source.rawHtmlSha256}>HTML 응답 식별값: {source.rawHtmlSha256.slice(0, 12)}… (결제 증명 아님)</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
