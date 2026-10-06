"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_MESSAGES = Object.freeze({
  admin_login_required: "관리자 로그인이 필요합니다.",
  admin_product_review_forbidden: "제품 검토 권한이 없습니다.",
  invalid_request_origin: "허용되지 않은 요청 출처입니다.",
  subject_authority_upgrade_stale_preflight:
    "사전검증 이후 상태가 변경되었습니다. 페이지를 새로고침해 주세요.",
  subject_authority_upgrade_conflict:
    "현재 Subject 권위 또는 의존 데이터가 예상 상태와 다릅니다.",
  subject_authority_upgrade_boundary_mismatch:
    "고정된 COSRX 대상과 현재 데이터가 일치하지 않습니다.",
  subject_authority_upgrade_forbidden:
    "권위 승격 실행 권한이 없습니다.",
  subject_authority_upgrade_service_unavailable:
    "권위 승격 서비스를 사용할 수 없습니다."
});

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok !== true) {
    const code = data?.error || "subject_authority_upgrade_failed";
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  return data;
}

function shortHash(value) {
  if (!value) return "-";
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function errorMessage(error) {
  return (
    ERROR_MESSAGES[error?.code] ||
    "권위 승격 요청을 처리하지 못했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요."
  );
}

export default function CosrxSubjectAuthorityUpgradeAction({ preflight }) {
  const router = useRouter();
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleConfirm() {
    if (
      preflight?.status !== "ready" ||
      !preflight?.payloadDigest ||
      !preflight?.prestateDigest
    ) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const requestId = `data-ai29c-d5e-d-r3p-${crypto.randomUUID()}`;
      const data = await postJson(
        "/api/admin/trust/cosrx-subject-authority-upgrade/confirm",
        {
          requestId,
          payloadDigest: preflight.payloadDigest,
          prestateDigest: preflight.prestateDigest
        }
      );
      setResult(data.result);
      router.refresh();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  const ready = preflight?.status === "ready";

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-900/60 dark:bg-amber-950/20">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-300">
        DATA-AI29C-D5E-D-R3-P
      </p>
      <h1 className="mt-1 text-xl font-bold">COSRX Subject 식별 권위 승격</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#6f6652] dark:text-amber-200/80">
        이 화면은 COSRX Ultra-Light Invisible Sunscreen의 현재 Subject 1건에만
        고정되어 있습니다. 제품·처방·시장·의미 키는 바꾸지 않고 식별 권위
        출처만 관리자 검토 권위로 승격합니다.
      </p>

      <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-[#181c22]">
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <p className="font-semibold text-[#707783]">사전검증 상태</p>
            <p className="mt-1 font-mono">{preflight?.status ?? "-"}</p>
          </div>
          <div>
            <p className="font-semibold text-[#707783]">현재 → 목표 권위</p>
            <p className="mt-1 break-all font-mono">
              {preflight?.currentAuthority ?? "-"} →{" "}
              {preflight?.targetAuthority ?? "-"}
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#707783]">payload digest</p>
            <p className="mt-1 font-mono">
              {shortHash(preflight?.payloadDigest)}
            </p>
          </div>
          <div>
            <p className="font-semibold text-[#707783]">prestate digest</p>
            <p className="mt-1 font-mono">
              {shortHash(preflight?.prestateDigest)}
            </p>
          </div>
        </div>

        <pre className="mt-4 overflow-auto rounded-lg bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">
          {JSON.stringify(
            {
              dependentCounts: preflight?.dependentCounts,
              plannedWrites: preflight?.plannedWrites
            },
            null,
            2
          )}
        </pre>

        {ready ? (
          <>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              실행하면 Subject 1건의 권위 버전과 시스템 갱신 시각만 바뀌고,
              검토 이벤트 1건과 관리자 감사 1건이 기록됩니다. Product Fact,
              Evidence, Semantic, Recommendation은 변경하지 않습니다.
            </p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy || !preflight?.requiresExplicitConfirmation}
              className="mt-3 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "승격 중…" : "명시적 권위 승격 실행"}
            </button>
          </>
        ) : (
          <p className="mt-4 text-sm text-[#6d7580] dark:text-[#aab1bb]">
            현재 상태에서는 추가 실행이 필요하지 않거나 사전검증 조건을 충족하지
            않습니다.
          </p>
        )}
      </div>

      {result ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          권위 승격이 완료되었습니다.
          <div className="mt-2 break-all font-mono text-xs">
            {result.authority}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage(error)}
        </div>
      ) : null}
    </section>
  );
}
