"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const FILTERS = Object.freeze([
  ["pending", "검토 대기"],
  ["queued", "Queued"],
  ["reviewing", "Reviewing"],
  ["approved", "Approved"],
  ["deferred", "Deferred"],
  ["rejected", "Blocked"]
]);

const DECISIONS = Object.freeze([
  ["approve", "승인"],
  ["defer", "보류"],
  ["block", "차단"]
]);

const STATUS_LABELS = Object.freeze({
  queued: "검토 대기",
  reviewing: "검토 중",
  approved: "승인",
  deferred: "보류",
  rejected: "차단"
});

const ISSUE_LABELS = Object.freeze({
  invalid_decision: "결정값이 올바르지 않습니다.",
  reason_required: "조치 사유를 3자 이상 입력해야 합니다.",
  review_queue_not_actionable: "현재 상태에서는 조치할 수 없습니다.",
  candidate_already_promoted: "이미 승격된 후보입니다.",
  missing_external_identity: "외부 제품 식별자가 없습니다.",
  missing_canonical_name: "정규 제품명이 없습니다.",
  missing_canonical_brand: "정규 브랜드명이 없습니다.",
  ambiguous_category: "카테고리를 확정할 수 없습니다.",
  invalid_category: "허용되지 않은 카테고리입니다.",
  missing_product_form: "treatment 제품 형태가 없습니다.",
  invalid_product_form: "제품 형태가 허용값과 다릅니다.",
  unexpected_product_form: "해당 카테고리에 제품 형태가 들어가 있습니다.",
  invalid_promotion_payload: "승격 payload가 올바르지 않습니다.",
  missing_skin_types: "피부 타입 근거가 없습니다.",
  invalid_skin_types: "피부 타입 값이 허용 범위를 벗어났습니다.",
  missing_concerns: "피부 고민 근거가 없습니다.",
  invalid_concerns: "피부 고민 값이 허용 범위를 벗어났습니다.",
  missing_texture: "제형 정보가 없습니다.",
  invalid_texture: "제형 값이 허용 범위를 벗어났습니다.",
  missing_finish: "마무리감 정보가 없습니다.",
  invalid_finish: "마무리감 값이 허용 범위를 벗어났습니다.",
  missing_irritation_risk: "자극 위험 정보가 없습니다.",
  invalid_irritation_risk: "자극 위험 값이 허용 범위를 벗어났습니다.",
  missing_sensitivity_safe: "민감성 안전 여부가 확정되지 않았습니다."
});

const ERROR_LABELS = Object.freeze({
  admin_login_required: "관리자 로그인이 필요합니다.",
  admin_product_review_forbidden: "이 작업을 실행할 권한이 없습니다.",
  product_review_invalid_request: "입력값을 다시 확인해 주세요.",
  product_review_stale_preflight: "후보 근거가 변경됐습니다. dry-run을 다시 실행해 주세요.",
  product_review_preflight_blocked: "안전 검증을 통과하지 못했습니다.",
  product_review_request_conflict: "같은 요청 식별자가 다른 작업에 사용됐습니다.",
  product_review_not_found: "후보를 찾을 수 없습니다.",
  product_review_forbidden: "이 작업을 실행할 권한이 없습니다.",
  product_review_data_unavailable: "검토 데이터를 불러오지 못했습니다.",
  product_review_operation_failed: "작업을 완료하지 못했습니다."
});

function formatDate(value) {
  if (!value) {
    return "-";
  }

  try {
    return new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatPercent(value) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "-";
}

function formatPrice(value) {
  return typeof value === "number"
    ? new Intl.NumberFormat("ko-KR").format(value)
    : "-";
}

function StatusBadge({ status }) {
  const style =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : status === "rejected"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : status === "deferred"
          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7d8490]">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-medium text-[#22262d] dark:text-[#eef1f5]">
        {value ?? "-"}
      </dd>
    </div>
  );
}

function Tags({ values, empty = "없음" }) {
  if (!values?.length) {
    return <span className="text-sm text-[#8a919c]">{empty}</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <span
          key={value}
          className="rounded-full border border-[#dce1e8] bg-[#f7f8fa] px-2.5 py-1 text-xs font-medium dark:border-[#343a44] dark:bg-[#20242b]"
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function EvidenceSummary({ evidence }) {
  const concerns = Array.isArray(evidence?.concerns) ? evidence.concerns : [];
  const popularity = evidence?.popularity || {};

  return (
    <div className="grid gap-4">
      <div>
        <h4 className="text-sm font-semibold">고민 랭킹 근거</h4>
        {concerns.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {concerns.map((item, index) => (
              <div
                key={`${item.concern || "concern"}-${index}`}
                className="rounded-xl bg-[#f6f7f9] p-3 dark:bg-[#20242b]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">{item.concern || "미분류"}</span>
                  <span className="text-xs text-[#68717e] dark:text-[#aab1bb]">
                    최근 {item.latest_rank ?? "-"}위 · 최고 {item.best_rank ?? "-"}위
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#7a828e] dark:text-[#9ea6b1]">
                  관측 {item.observation_count ?? 0}회 · {formatDate(item.latest_collected_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#8a919c]">고민 랭킹 근거 없음</p>
        )}
      </div>

      <div>
        <h4 className="text-sm font-semibold">인기 랭킹 근거</h4>
        <div className="mt-2 rounded-xl bg-[#f6f7f9] p-3 text-sm dark:bg-[#20242b]">
          관측 {popularity.observation_count ?? 0}회 · 최근 {popularity.latest_rank ?? "-"}위 · 최고 {popularity.best_rank ?? "-"}위
        </div>
      </div>
    </div>
  );
}

function ReviewActionPanel({ candidateId, canReview, actionable }) {
  const router = useRouter();
  const [decision, setDecision] = useState("approve");
  const [reason, setReason] = useState("");
  const [preflight, setPreflight] = useState(null);
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);

  const reasonValid = reason.trim().length >= 3 && reason.trim().length <= 1000;
  const preflightReady = preflight?.status === "ready";

  function resetPreflight() {
    setPreflight(null);
    setError(null);
    setPhase("idle");
  }

  async function requestJson(url, body) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "product_review_operation_failed");
    }

    return payload;
  }

  async function runPreflight() {
    setPhase("preflighting");
    setError(null);
    setPreflight(null);

    try {
      const payload = await requestJson("/api/admin/product-reviews/preflight", {
        candidateId,
        decision,
        reason: reason.trim()
      });
      setPreflight(payload.preflight);
      setPhase(payload.preflight.status === "ready" ? "ready" : "blocked");
    } catch (requestError) {
      setError(requestError.message);
      setPhase("failed");
    }
  }

  async function confirm() {
    if (!preflightReady) {
      return;
    }

    setPhase("confirming");
    setError(null);

    try {
      const requestId = crypto.randomUUID();
      await requestJson("/api/admin/product-reviews/confirm", {
        candidateId,
        decision,
        reason: reason.trim(),
        candidateUpdatedAt: preflight.candidate_updated_at,
        reviewUpdatedAt: preflight.review_updated_at,
        evidenceHash: preflight.evidence_hash,
        preflightHash: preflight.preflight_hash,
        requestId
      });
      setPhase("confirmed");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
      setPhase("failed");
    }
  }

  if (!canReview) {
    return (
      <div className="rounded-2xl border border-[#dfe3e9] bg-[#f7f8fa] p-5 text-sm text-[#67707d] dark:border-[#303640] dark:bg-[#1d2128] dark:text-[#aeb5c0]">
        읽기 전용 권한입니다. 조치 실행은 Operator 또는 Owner만 가능합니다.
      </div>
    );
  }

  if (!actionable) {
    return (
      <div className="rounded-2xl border border-[#dfe3e9] bg-[#f7f8fa] p-5 text-sm text-[#67707d] dark:border-[#303640] dark:bg-[#1d2128] dark:text-[#aeb5c0]">
        이미 처리된 후보입니다. 감사와 결과 확인만 가능합니다.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
      <div className="flex flex-wrap gap-2">
        {DECISIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setDecision(value);
              resetPreflight();
            }}
            className={
              decision === value
                ? "rounded-full bg-[#171a20] px-4 py-2 text-sm font-semibold text-white dark:bg-[#f2f4f7] dark:text-[#171a20]"
                : "rounded-full border border-[#d8dde4] px-4 py-2 text-sm font-semibold hover:bg-[#f5f6f8] dark:border-[#363c46] dark:hover:bg-[#20242b]"
            }
          >
            {label}
          </button>
        ))}
      </div>

      <label className="mt-4 block">
        <span className="text-sm font-semibold">조치 사유</span>
        <textarea
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            resetPreflight();
          }}
          rows={4}
          maxLength={1000}
          placeholder="근거 확인 결과와 조치 이유를 입력하세요."
          className="mt-2 w-full resize-y rounded-xl border border-[#d8dde4] bg-white px-3 py-3 text-sm outline-none focus:border-[#6e7682] dark:border-[#363c46] dark:bg-[#111419]"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!reasonValid || phase === "preflighting" || phase === "confirming"}
          onClick={runPreflight}
          className="rounded-full border border-[#171a20] px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#e4e8ee]"
        >
          {phase === "preflighting" ? "검증 중" : "Dry-run"}
        </button>
        <button
          type="button"
          disabled={!preflightReady || phase === "confirming"}
          onClick={confirm}
          className="rounded-full bg-[#171a20] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-35 dark:bg-[#f2f4f7] dark:text-[#171a20]"
        >
          {phase === "confirming" ? "반영 중" : "Confirm"}
        </button>
      </div>

      {preflight ? (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            preflight.status === "ready"
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"
              : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              {preflight.status === "ready" ? "반영 준비 완료" : "반영 차단"}
            </p>
            <span className="text-xs font-semibold uppercase">{preflight.status}</span>
          </div>
          <p className="mt-2 text-sm">
            products 예상 쓰기: {preflight.planned?.products_write_count ?? 0} · 작업: {preflight.planned?.promotion_action || "none"}
          </p>
          {preflight.issues?.length > 0 ? (
            <ul className="mt-3 grid gap-1 text-sm">
              {preflight.issues.map((issue) => (
                <li key={issue}>• {ISSUE_LABELS[issue] || issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {phase === "confirmed" ? (
        <p className="mt-4 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          조치가 반영됐습니다.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm font-semibold text-red-700 dark:text-red-300">
          {ERROR_LABELS[error] || ERROR_LABELS.product_review_operation_failed}
        </p>
      ) : null}
    </section>
  );
}

export default function ProductReviewWorkbench({
  workbench,
  canReview
}) {
  const selected = workbench.selected;
  const selectedCandidateId = selected?.review?.candidateId ?? null;
  const rawEvidence = useMemo(
    () => JSON.stringify(selected?.review?.evidenceSnapshot ?? {}, null, 2),
    [selected]
  );
  const rawPromotion = useMemo(
    () => JSON.stringify(selected?.candidate?.promotion ?? {}, null, 2),
    [selected]
  );

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <div className="flex flex-col gap-4 border-b border-[#dfe3e9] pb-5 dark:border-[#303640] sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#727a86]">
            Product operations
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">제품 후보 검수</h2>
          <p className="mt-2 text-sm text-[#69717d] dark:text-[#aeb5c0]">
            근거를 확인하고 dry-run을 통과한 후보만 최종 반영합니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(([value, label]) => (
            <Link
              key={value}
              href={`/admin/products/reviews?status=${value}`}
              className={
                workbench.filter === value
                  ? "rounded-full bg-[#171a20] px-3.5 py-2 text-xs font-semibold text-white dark:bg-[#f2f4f7] dark:text-[#171a20]"
                  : "rounded-full border border-[#d8dde4] px-3.5 py-2 text-xs font-semibold dark:border-[#363c46]"
              }
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {workbench.items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-[#cfd5dd] bg-white p-10 text-center dark:border-[#363c46] dark:bg-[#16191f]">
          <p className="text-lg font-semibold">표시할 검토 후보가 없습니다.</p>
          <p className="mt-2 text-sm text-[#757d89]">다른 상태 필터를 확인해 주세요.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(360px,0.85fr)_minmax(0,1.55fr)]">
          <section className="overflow-hidden rounded-2xl border border-[#dfe3e9] bg-white dark:border-[#303640] dark:bg-[#16191f]">
            <div className="border-b border-[#e2e6ec] px-4 py-3 dark:border-[#303640]">
              <p className="text-sm font-semibold">후보 {workbench.items.length}건</p>
            </div>
            <div className="max-h-[calc(100vh-260px)] overflow-y-auto">
              {workbench.items.map(({ review, candidate }) => {
                const active = review.candidateId === selectedCandidateId;
                return (
                  <Link
                    key={review.candidateId}
                    href={`/admin/products/reviews?status=${workbench.filter}&candidate=${review.candidateId}`}
                    className={`block border-b border-[#edf0f3] px-4 py-4 last:border-b-0 dark:border-[#272c34] ${
                      active
                        ? "bg-[#eef1f5] dark:bg-[#22272f]"
                        : "hover:bg-[#f8f9fa] dark:hover:bg-[#1d2128]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {candidate?.brandNameRaw || "브랜드 미확인"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-[#626b77] dark:text-[#b1b8c2]">
                          {candidate?.productNameRaw || "제품명 미확인"}
                        </p>
                      </div>
                      <StatusBadge status={review.status} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-[#7b838f]">
                      <span>우선순위 {review.priorityScore}</span>
                      <span>{formatDate(review.lastQueuedAt)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {selected ? (
            <div className="grid min-w-0 gap-5">
              <section className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#737b87]">
                      Candidate identity
                    </p>
                    <h3 className="mt-2 text-xl font-semibold">
                      {selected.candidate?.canonicalBrand || selected.candidate?.brandNameRaw || "브랜드 미확인"}
                    </h3>
                    <p className="mt-1 text-sm text-[#68717d] dark:text-[#b0b7c1]">
                      {selected.candidate?.canonicalName || selected.candidate?.productNameRaw || "제품명 미확인"}
                    </p>
                  </div>
                  <StatusBadge status={selected.review.status} />
                </div>

                <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Source" value={selected.candidate?.sourceName} />
                  <Field label="External ID" value={selected.candidate?.externalId} />
                  <Field label="Category" value={selected.candidate?.serviceCategory} />
                  <Field label="Product form" value={selected.candidate?.productForm} />
                  <Field label="Match method" value={selected.candidate?.matchMethod} />
                  <Field label="Match confidence" value={formatPercent(selected.candidate?.matchConfidence)} />
                </dl>

                <div className="mt-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7d8490]">Review flags</p>
                  <div className="mt-2"><Tags values={selected.candidate?.reviewFlags} /></div>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <article className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
                  <h3 className="text-base font-semibold">랭킹·선정 근거</h3>
                  <p className="mt-2 text-sm leading-6 text-[#68717d] dark:text-[#b0b7c1]">
                    {selected.review.selectionReason || "선정 사유 없음"}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-4">
                    <Field label="Priority" value={selected.review.priorityScore} />
                    <Field label="Rule version" value={selected.review.ruleVersion} />
                  </dl>
                  <div className="mt-5">
                    <EvidenceSummary evidence={selected.review.evidenceSnapshot} />
                  </div>
                </article>

                <article className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
                  <h3 className="text-base font-semibold">기존 제품 비교</h3>
                  {selected.matchedProduct ? (
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                      <Field label="Brand" value={selected.matchedProduct.brand} />
                      <Field label="Name" value={selected.matchedProduct.name} />
                      <Field label="Category" value={selected.matchedProduct.category} />
                      <Field label="Product form" value={selected.matchedProduct.productForm} />
                      <Field label="Texture" value={selected.matchedProduct.texture} />
                      <Field label="Finish" value={selected.matchedProduct.finish} />
                    </dl>
                  ) : (
                    <p className="mt-4 rounded-xl bg-[#f6f7f9] p-4 text-sm text-[#68717d] dark:bg-[#20242b] dark:text-[#b0b7c1]">
                      현재 연결된 기존 제품이 없습니다. 승인 시 신규 제품 생성이 예상됩니다.
                    </p>
                  )}
                </article>
              </section>

              <section className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
                <h3 className="text-base font-semibold">승격 예정 필드</h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Texture" value={selected.candidate?.promotion?.texture} />
                  <Field label="Finish" value={selected.candidate?.promotion?.finish} />
                  <Field label="Irritation risk" value={selected.candidate?.promotion?.irritationRisk} />
                  <Field
                    label="Sensitivity safe"
                    value={
                      selected.candidate?.promotion?.sensitivitySafe === null
                        ? "unknown"
                        : String(selected.candidate?.promotion?.sensitivitySafe)
                    }
                  />
                  <Field label="Price min" value={formatPrice(selected.candidate?.promotion?.priceMin)} />
                  <Field label="Price max" value={formatPrice(selected.candidate?.promotion?.priceMax)} />
                  <Field label="Buy link" value={selected.candidate?.promotion?.hasBuyLink ? "있음" : "없음"} />
                  <Field label="Image" value={selected.candidate?.promotion?.hasImageUrl ? "있음" : "없음"} />
                </dl>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7d8490]">Skin types</p>
                    <div className="mt-2"><Tags values={selected.candidate?.promotion?.skinTypes} /></div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#7d8490]">Concerns</p>
                    <div className="mt-2"><Tags values={selected.candidate?.promotion?.concerns} /></div>
                  </div>
                </div>
              </section>

              <ReviewActionPanel
                key={selected.review.candidateId}
                candidateId={selected.review.candidateId}
                canReview={canReview}
                actionable={["queued", "reviewing"].includes(selected.review.status)}
              />

              <section className="grid gap-3">
                <details className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
                  <summary className="cursor-pointer text-sm font-semibold">원본 evidence JSON</summary>
                  <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#111419] p-4 text-xs leading-6 text-[#e7ebf0]">
                    {rawEvidence}
                  </pre>
                </details>
                <details className="rounded-2xl border border-[#dfe3e9] bg-white p-5 dark:border-[#303640] dark:bg-[#16191f]">
                  <summary className="cursor-pointer text-sm font-semibold">정규화된 promotion JSON</summary>
                  <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-[#111419] p-4 text-xs leading-6 text-[#e7ebf0]">
                    {rawPromotion}
                  </pre>
                </details>
              </section>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
