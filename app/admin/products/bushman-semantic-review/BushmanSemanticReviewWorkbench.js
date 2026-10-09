"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const LABELS = {
  category_slot: "제품 분류", skin_types: "피부 타입", concerns: "피부 고민",
  texture: "제형", finish: "마무리감", uv_filter_type: "자외선 차단 필터",
  sensitivity_safe: "민감성 피부 안전성", irritation_risk: "자극 위험",
  tone_up: "톤업", white_cast: "백탁", eye_sting: "눈시림", pilling_risk: "밀림",
};
const VALUE_LABELS = { sunscreen: "선크림", hybrid: "혼합자차" };
const ERROR_LABELS = {
  invalid_request_origin: "보안 정책상 허용되지 않은 요청입니다.",
  admin_login_required: "관리자 로그인이 필요합니다.",
  admin_product_review_forbidden: "검토 권한이 없습니다.",
  CURRENT_FIELD_ALREADY_REVIEWED_RECHECK_REQUIRED: "기존 검토가 있어 자동 덮어쓰지 않았습니다. 새로고침해 확인해 주세요.",
  LIVE_EXACT_SUBJECT_MISMATCH: "제품의 현재 Subject가 검토안과 다릅니다.",
  S2_PAYLOAD_CONTRACT_MISMATCH: "검토 요청의 근거가 원본 계약과 일치하지 않습니다.",
  semantic_review_confirmation_failed: "등록 확인에 실패했습니다. 운영 리뷰 기록을 확인하세요.",
};

export default function BushmanSemanticReviewWorkbench({ workbench }) {
  const router = useRouter();
  const [busyField, setBusyField] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  async function confirmField(field) {
    if (busyField || field.status !== "ready" || !window.confirm(
      `${LABELS[field.name] ?? field.name} 항목을 실제 운영 Semantic Review에 기록하시겠습니까? 이 작업은 관리자 감사 기록을 생성합니다.`
    )) return;
    setBusyField(field.name);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        "/api/admin/products/bushman-semantic-review/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            fieldName: field.name,
            requestId: `data-ai29c-r4ds3-${field.name}-${crypto.randomUUID()}`,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        const code = data.error || "semantic_review_operation_failed";
        throw new Error(ERROR_LABELS[code] || code);
      }
      setNotice(`${LABELS[field.name]} 등록 완료 · Audit ID: ${data.result?.auditId ?? "-"}`);
      router.refresh();
    } catch (next) {
      setError(next.message || "검토 등록에 실패했습니다.");
    } finally {
      setBusyField(null);
    }
  }

  return (
    <section>
      <p className="text-xs font-semibold tracking-wider text-amber-700 dark:text-amber-300">DATA-AI29C-FILTER-R4-D-S3</p>
      <h1 className="mt-1 text-2xl font-bold">BUSHMAN 선크림 피부 적합성 검토</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{workbench.note}</p>
      <div className="mt-5 flex flex-wrap gap-3 text-sm">
        <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          현재 등록 <strong>{workbench.reviewed}/{workbench.required}</strong>
        </div>
        <div className="rounded-xl border border-slate-200 px-4 py-3 dark:border-slate-700">
          현재 확정 <strong>{workbench.established}</strong>
        </div>
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          추천 편입/Subject 승격 <strong>별도 절차 · 미승인</strong>
        </div>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-lg border border-red-200 p-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-lg border border-emerald-200 p-3 text-sm text-emerald-700">{notice}</p> : null}
      <div className="mt-6 space-y-3">
        {workbench.fields.map((field) => (
          <article key={field.name} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{LABELS[field.name] ?? field.name}</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  제안: {field.proposalState === "established"
                    ? `확정 — ${VALUE_LABELS[field.proposalValue] ?? String(field.proposalValue)}`
                    : "근거 검토 완료 / 값 미확정"} · 현재: {field.current?.state ?? "미등록"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => confirmField(field)}
                disabled={field.status !== "ready" || Boolean(busyField)}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
              >
                {busyField === field.name ? "기록 중…" :
                  field.status === "ready" ? "이 항목 검토 기록" : "등록 불가 / 기존 기록"}
              </button>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-300">{field.rationale}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>근거:</span>
              {field.sourceIds.map((id) => {
                const source = workbench.sources?.find((item) => item.id === id);
                return source?.url ? (
                  <a key={id} href={source.url} target="_blank" rel="noopener noreferrer"
                    className="underline decoration-dotted underline-offset-2">
                    {id}
                  </a>
                ) : <span key={id}>{id}</span>;
              })}
            </div>
            {field.blocker ? <p className="mt-2 font-mono text-xs text-amber-700">{field.blocker}</p> : null}
          </article>
        ))}
      </div>
      <p className="mt-6 text-xs leading-5 text-slate-500 dark:text-slate-400">
        각 클릭은 기존 승인 RPC에 제품 1건의 필드 1개만 제출합니다. 다른 필드의 검토나 추천 점수,
        Subject authority, 제품 DB 값은 자동 변경하지 않습니다.
      </p>
    </section>
  );
}
