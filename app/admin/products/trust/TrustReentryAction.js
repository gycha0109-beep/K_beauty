"use client";

import { useState } from "react";

function messageFor(code) {
  const messages = {
    trust_reentry_stale_preflight: "상태가 변경되었습니다. 다시 검증하세요.",
    trust_reentry_invalid_request: "재검사 요청이 유효하지 않습니다.",
    trust_reentry_service_unavailable: "재검사 서비스를 사용할 수 없습니다.",
    trust_reentry_rpc_failed: "재검사 처리에 실패했습니다."
  };
  return messages[code] || "재검사 처리 중 오류가 발생했습니다.";
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
      <h3 className="text-sm font-bold">Phase 6 · Manual revalidation</h3>
      <p className="mt-2 text-xs leading-5 text-[#657080] dark:text-[#aeb7c4]">
        현재 상태를 다시 읽고 canonical Subject resolution을 재실행합니다. 강제 초기화가 아니며
        identity/formulation/market conflict, governed Evidence, Current는 자동으로 지우지 않습니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runPreflight}
          disabled={busy}
          className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50 dark:border-sky-800 dark:bg-[#181c22] dark:text-sky-200"
        >
          {busy ? "검증 중…" : "재검사 Preflight"}
        </button>
      </div>

      {preflight ? (
        <div className="mt-4 rounded-xl border border-sky-200 bg-white p-4 text-xs dark:border-sky-900 dark:bg-[#181c22]">
          <p><strong>예상 동작:</strong> {preflight.plannedAction}</p>
          <p className="mt-1"><strong>사유:</strong> {preflight.reasonCode}</p>
          <p className="mt-1"><strong>Current 무효화:</strong> false</p>
          <button
            type="button"
            onClick={confirm}
            disabled={busy}
            className="mt-3 rounded-xl bg-sky-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            명시적으로 재검사 실행
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          재검사 완료 · {result.disposition} · {result.reasonCode || "-"}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {messageFor(error)}
          <div className="mt-1 font-mono text-[11px] opacity-70">{error}</div>
        </div>
      ) : null}
    </section>
  );
}
