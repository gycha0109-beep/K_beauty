"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BUSHMAN_REVIEW_GUIDE,
  BUSHMAN_REVIEW_VALUE_LABELS,
  BUSHMAN_SOURCE_LABELS,
  bushmanReviewStateLabel,
} from "@/lib/admin/bushman-review-korean-guide.mjs";

const ERROR_LABELS = {
  invalid_request_origin: "보안 정책에 따라 요청을 처리하지 못했습니다. 화면을 새로고침해 주세요.",
  admin_login_required: "관리자 로그인이 필요합니다.",
  admin_product_review_forbidden: "이 제품의 검토 권한이 없습니다.",
  CURRENT_FIELD_ALREADY_REVIEWED_RECHECK_REQUIRED: "이미 기록된 항목입니다. 화면을 새로고침해 현재 상태를 확인해 주세요.",
  LIVE_EXACT_SUBJECT_MISMATCH: "검토 대상 제품 정보가 변경됐습니다. 등록을 중단했습니다.",
  S2_PAYLOAD_CONTRACT_MISMATCH: "근거 자료와 등록 요청이 일치하지 않아 기록하지 않았습니다.",
  semantic_review_confirmation_failed: "검토 등록 여부를 확인하지 못했습니다. 새로고침 후 현재 기록을 확인해 주세요.",
  semantic_review_operation_failed: "검토를 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

function reviewResult(field) {
  if (field.proposalState === "established") {
    const value = BUSHMAN_REVIEW_VALUE_LABELS[field.proposalValue];
    return value ? `확정: ${value}` : "확정 정보 확인 필요";
  }
  return "미확정으로 기록";
}

function ReviewRow({ field, workbench, opened, onToggle, onConfirm, busy }) {
  const guide = BUSHMAN_REVIEW_GUIDE[field.name];
  const label = guide?.label ?? "검토 정보";
  const ready = field.status === "ready";
  const currentState = field.current?.state;
  const alreadyDone = currentState === "established" || currentState === "reviewed_not_established";
  const established = field.proposalState === "established";
  const result = reviewResult(field);
  const sources = field.sourceIds.map((id) => {
    const source = workbench.sources?.find((s) => s.id === id);
    return {
      id,
      label: BUSHMAN_SOURCE_LABELS[id] ?? "추가 검토 근거",
      url: source?.url ?? null,
    };
  });
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-blue-500 sm:px-5 dark:hover:bg-slate-800/80"
        aria-expanded={opened}
        onClick={onToggle}
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-slate-950 dark:text-white">{label}</span>
            {alreadyDone ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">기록 완료</span>
            ) : (
              <span className={established
                ? "rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
                : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"}>
                {established ? "확정 제안" : "판단 보류"}
              </span>
            )}
          </span>
          <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-300">
            {guide?.explanation ?? "연결된 근거를 검토한 뒤 결과를 기록합니다."}
          </span>
          <span className="mt-2 block text-xs font-medium text-slate-500 dark:text-slate-400">
            {alreadyDone ? bushmanReviewStateLabel(currentState) : `기록 예정 · ${result}`}
          </span>
        </span>
        <span className="mt-1 shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-800 dark:border-slate-600 dark:text-slate-100">
          {opened ? "접기" : "근거 확인"}
        </span>
      </button>
      {opened ? (
        <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4 sm:px-5 dark:border-slate-700 dark:bg-slate-950/40">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">이번에 확인할 내용</p>
          <p className="mt-1 text-sm leading-6 text-slate-800 dark:text-slate-100">
            {guide?.instruction ?? "근거와 기록될 결과가 일치하는지 확인합니다."}
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">실제로 저장될 검토 결과</p>
            <p className="mt-1 text-base font-bold text-slate-950 dark:text-white">{result}</p>
            {!established ? (
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                정보가 없다는 의미가 아닙니다. 상반된 후기나 불충분한 근거 때문에 단정하지 않는다는 뜻입니다.
              </p>
            ) : null}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">확인에 사용한 자료</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sources.map((source) => source.url?.startsWith("https://") ? (
                <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-blue-700 underline underline-offset-2 dark:border-slate-600 dark:bg-slate-900 dark:text-blue-300">
                  {source.label} <span aria-hidden="true" className="ml-1">↗</span>
                </a>
              ) : (
                <span key={source.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  {source.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-lg text-xs leading-5 text-slate-600 dark:text-slate-300">
              {alreadyDone
                ? "이미 등록된 결과입니다. 다시 기록하지 않습니다."
                : "기록하면 이 항목의 검토 결과와 관리자 확인 이력이 저장됩니다. 다른 항목이나 추천 순위는 변경되지 않습니다."}
            </p>
            {ready ? (
              <button type="button" disabled={Boolean(busy)} onClick={onConfirm}
                className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-wait disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100">
                {busy ? "기록하는 중…" : "이 내용으로 검토 기록"}
              </button>
            ) : (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                {alreadyDone ? "기록 완료" : "등록 전 데이터 확인 필요"}
              </span>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}

export default function BushmanSemanticReviewWorkbench({ workbench }) {
  const router = useRouter();
  const [opened, setOpened] = useState(null);
  const [busyField, setBusyField] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const fields = workbench.fields ?? [];
  const confirmedFields = fields.filter((f) => f.proposalState === "established");
  const unresolvedFields = fields.filter((f) => f.proposalState !== "established");
  const reviewed = workbench.reviewed ?? 0;
  const required = workbench.required ?? 12;
  const progress = Math.max(0, Math.min(100, Math.round(required ? reviewed / required * 100 : 0)));

  async function confirmField(field) {
    const guide = BUSHMAN_REVIEW_GUIDE[field.name];
    const label = guide?.label ?? "이 항목";
    const result = reviewResult(field);
    if (busyField || field.status !== "ready" || !window.confirm(
      `${label}의 근거를 확인하셨습니까?\n\n기록할 결과: ${result}\n\n확인하면 이 항목의 검토와 관리자 확인 이력이 저장됩니다.`
    )) return;
    setBusyField(field.name);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/products/bushman-semantic-review/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          fieldName: field.name,
          requestId: `data-ai29c-r4ds3-${field.name}-${crypto.randomUUID()}`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok !== true) {
        const code = data.error || "semantic_review_operation_failed";
        throw new Error(ERROR_LABELS[code] || "검토를 기록하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      setNotice(`${label} 항목을 기록했습니다. 검토 현황을 새로고침했습니다.`);
      setOpened(null);
      router.refresh();
    } catch (next) {
      setError(next.message || "검토를 기록하지 못했습니다.");
    } finally {
      setBusyField(null);
    }
  }

  const group = (heading, description, items, accent) => (
    <section className="mt-8" aria-label={heading}>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">{heading}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{items.length}개 항목</span>
      </div>
      <div className={`space-y-3 border-l-2 pl-3 sm:pl-4 ${accent}`}>
        {items.map((field) => (
          <ReviewRow key={field.name} field={field} workbench={workbench}
            opened={opened === field.name}
            onToggle={() => { setOpened(opened === field.name ? null : field.name); setError(null); }}
            onConfirm={() => confirmField(field)} busy={busyField === field.name} />
        ))}
      </div>
    </section>
  );

  return (
    <div className="pb-12">
      <header>
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">제품 정보 관리 · 관리자 검토</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
          부쉬맨 선크림 정보 확인
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700 dark:text-slate-200">
          상품 정보와 실제 사용 후기를 비교해 정리한 <strong>12개 판단을 확인하고 기록하는 화면</strong>입니다.
          이미 제안된 결론이 타당한지 확인해 주세요. 새 제품을 추천 목록에 올리는 작업은 아닙니다.
        </p>
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60" aria-label="검토 진행 현황">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-300">검토 기록 진행률</p>
            <p className="mt-1 text-3xl font-bold text-slate-950 dark:text-white">{reviewed}<span className="text-base font-medium text-slate-500 dark:text-slate-300"> / {required}개</span></p>
          </div>
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300">기록할 결과 · 확정 {confirmedFields.length}개 · 미확정 {unresolvedFields.length}개</p>
        </div>
        <div role="progressbar" aria-valuenow={reviewed} aria-valuemin={0} aria-valuemax={required} aria-label="검토 기록 진행률"
          className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-400" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
          '미확정'도 정상적인 검토 결과입니다. 근거가 부족한 특성을 안전하다고 추측해서 저장하지 않습니다.
        </p>
      </section>

      <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900/60 dark:bg-amber-950/20">
        <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">지금 하실 일</p>
        <p className="mt-1 text-sm leading-6 text-amber-900 dark:text-amber-200">
          아래 항목에서 <strong>근거 확인</strong>을 누른 후, 자료와 기록될 결과를 확인하고
          <strong> 이 내용으로 검토 기록</strong>을 누르시면 됩니다. 각 항목은 한 번씩만 기록됩니다.
        </p>
      </section>

      {error ? <p role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">{notice}</p> : null}

      {group("확인할 수 있는 정보", "공식 자료와 현재 제품 정보에 근거해 값을 확정할 수 있습니다.", confirmedFields, "border-blue-300 dark:border-blue-700")}
      {group("판단을 보류할 정보", "후기가 엇갈리거나 근거가 부족합니다. 안전하다고 추측하지 않고 미확정으로 기록합니다.", unresolvedFields, "border-amber-300 dark:border-amber-800")}

      <section className="mt-8 rounded-2xl border border-slate-200 p-5 dark:border-slate-700" aria-label="기록 확인 상태">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">검토 기록 확인</h2>
        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
          저장된 검토 내용은 관리자 확인 이력과 자동으로 대조됩니다.
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <p className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/70">
            감사 기록 대조: <strong>{workbench.s4?.audited ?? 0} / 12개</strong>
          </p>
          <p className="rounded-lg bg-slate-50 px-3 py-3 dark:bg-slate-800/70">
            검토·감사 상태: <strong>{workbench.s4?.reviewReady ? "모두 확인됨" : "확인 중"}</strong>
          </p>
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-600 dark:text-slate-300">
          추천 후보 등록은 별도 승인 절차입니다.
          현재 제품 식별 승인 상태: <strong>{workbench.s4?.subjectAuthorityReady ? "조건 충족" : "추가 승인 필요"}</strong>.
          이 화면에서 검토를 완료해도 추천 순위가 바뀌지는 않습니다.
        </p>
      </section>
    </div>
  );
}
