"use client";

import { useState } from "react";

const ACTION_LABELS = Object.freeze({
  NOOP: "변경 없음",
  IDENTITY_REVALIDATION: "식별 정보 재검증",
  RESEARCH_REQUEUE: "조사 대기열 재등록"
});

const REASON_LABELS = Object.freeze({
  GOVERNED_OR_COVERED_STATE_PRESERVED: "이미 관리 상태 또는 충족 상태라 기존 값을 유지합니다.",
  IDENTITY_REVALIDATION_REQUIRED: "식별 정보 재검증이 필요합니다.",
  MANUAL_RETRY_ELIGIBLE_RESEARCH_BLOCKER: "수동 재시도가 가능한 조사 차단 상태입니다.",
  MANUAL_RETRY_NOT_ELIGIBLE_FOR_FORCE_RESET: "강제 초기화 대상이 아니므로 기존 상태를 유지합니다.",
  SOURCE_BLOCKED: "출처가 차단된 상태입니다.",
  EVIDENCE_INSUFFICIENT: "근거가 부족한 상태입니다.",
  EVIDENCE_CANDIDATE: "근거 후보 상태입니다.",
  PREFLIGHT_READY: "사전 검증이 완료된 상태입니다.",
  CONFIRMED: "확인이 완료된 상태입니다.",
  ALREADY_COVERED: "이미 충족된 상태입니다."
});

function messageFor(code) {
  const messages = {
    trust_reentry_stale_preflight: "상태가 변경되었습니다. 다시 검증해 주세요.",
    trust_reentry_invalid_request: "재검사 요청이 유효하지 않습니다.",
    trust_reentry_service_unavailable: "재검사 서비스를 사용할 수 없습니다.",
    trust_reentry_rpc_failed: "재검사 처리에 실패했습니다."
  };
  return messages[code] || "재검사 처리 중 오류가 발생했습니다.";
}

function displayAction(value) {
  return ACTION_LABELS[value] || "상태 재확인";
}

function displayReason(value) {
  return REASON_LABELS[value] || (value ? "세부 사유가 기록되었습니다." : "-");
}

export default function TrustReentryAction({ taskId, canReview = false }) {
  const [busy, setBusy] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!canReview) {
    return null;
  }

  async function runPreflight() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/admin/trust/reentry/preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "trust_reentry_failed");
      }
      setPreflight(payload.preflight);
    } catch (caught) {
      setPreflight(null);
      setError(caught.message || "trust_reentry_failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preflight?.preflightHash) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/trust/reentry/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          preflightHash: preflight.preflightHash
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "trust_reentry_failed");
      }
      setResult(payload.result);
      setPreflight(null);
    } catch (caught) {
      setError(caught.message || "trust_reentry_failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900/60 dark:bg-sky-950/20">
      <h3 className="text-sm font-bold">6단계 · 수동 재검증</h3>
      <p className="mt-2 text-xs leading-5 text-[#657080] dark:text-[#aeb7c4]">
        현재 상태를 다시 읽고 기준 제품 사실 대상 식별 절차를 재실행합니다. 강제 초기화가 아니며
        식별 정보·처방 버전·시장 충돌, 관리형 근거, 현재 채택 사실은 자동으로 지우지 않습니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runPreflight}
          disabled={busy}
          className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50 dark:border-sky-800 dark:bg-[#181c22] dark:text-sky-200"
        >
          {busy ? "검증 중…" : "재검사 사전 검증"}
        </button>
      </div>

      {preflight ? (
        <div className="mt-4 rounded-xl border border-sky-200 bg-white p-4 text-xs dark:border-sky-900 dark:bg-[#181c22]">
          <p><strong>예상 동작:</strong> {displayAction(preflight.plannedAction)}</p>
          <p className="mt-1"><strong>사유:</strong> {displayReason(preflight.reasonCode)}</p>
          <p className="mt-1"><strong>현재 채택 사실 무효화:</strong> 아니오</p>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="mt-3 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            재검사 실행
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          재검사 완료 · {displayAction(result.disposition)} · {displayReason(result.reasonCode)}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {messageFor(error)}
        </div>
      ) : null}
    </section>
  );
}
