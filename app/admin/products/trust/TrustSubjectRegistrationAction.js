"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_MESSAGES = Object.freeze({
  trust_subject_registration_state_not_reviewable:
    "현재 항목은 더 이상 제품 사실 대상 생성 검토 상태가 아닙니다.",
  trust_subject_registration_stale_preflight:
    "검토 중 상태가 변경되었습니다. 사전 검증을 다시 실행해 주세요.",
  trust_subject_registration_stale_proposal:
    "검토한 제품 식별 정보가 변경되었습니다. 사전 검증을 다시 실행해 주세요.",
  trust_subject_identity_catalog_authority_boundary_invalid:
    "카탈로그 식별 근거의 권위 경계를 검증할 수 없습니다.",
  trust_subject_identity_market_mismatch:
    "검토한 적용 시장이 현재 검토 항목의 시장과 일치하지 않습니다.",
  trust_subject_identity_variant_review_required:
    "변형 키를 입력하거나 별도 변형이 없는 제품 단위 대상으로 검토했음을 표시해야 합니다.",
  trust_subject_identity_reviewed_input_invalid:
    "제품 사실 대상 식별 입력값을 다시 확인해 주세요.",
  trust_subject_registration_semantic_key_conflict:
    "동일한 의미 키에 다른 제품 사실 대상 식별 정보가 존재합니다.",
  trust_subject_registration_competing_subject_detected:
    "동일 제품과 시장에 다른 현재 제품 사실 대상이 존재합니다.",
  trust_subject_registration_forbidden:
    "제품 사실 대상 등록 권한이 없습니다.",
  trust_subject_registration_service_unavailable:
    "제품 사실 대상 등록 서비스를 사용할 수 없습니다."
});

const EMPTY_FORM = Object.freeze({
  variantKey: "",
  variantKeyReviewedAsNull: false,
  formulationRevisionKey: "",
  formulationLabel: "",
  marketApplicability: "",
  regionApplicability: "",
  validFrom: "",
  validTo: ""
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
    const code = data?.error || "trust_subject_registration_failed";
    const error = new Error(code);
    error.code = code;
    throw error;
  }

  return data;
}

function shortHash(value) {
  if (!value) {
    return "-";
  }
  return `${value.slice(0, 12)}…${value.slice(-8)}`;
}

function errorMessage(error) {
  return (
    ERROR_MESSAGES[error?.code] ||
    "제품 사실 대상 등록 검토를 처리하지 못했습니다. 상태를 새로고침한 뒤 다시 확인해 주세요."
  );
}

function displayMarket(value) {
  return value === "KR" ? "대한민국" : value || "-";
}

function toReviewedIdentity(form) {
  return {
    variantKey: form.variantKey.trim() || null,
    variantKeyReviewedAsNull: form.variantKeyReviewedAsNull === true,
    formulationRevisionKey: form.formulationRevisionKey.trim(),
    formulationLabel: form.formulationLabel.trim() || null,
    marketApplicability: form.marketApplicability.trim(),
    regionApplicability: form.regionApplicability.trim() || null,
    validFrom: form.validFrom || null,
    validTo: form.validTo || null
  };
}

function InputField({ label, value, onChange, placeholder, required = false, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-[#616976] dark:text-[#b4bbc5]">
        {label}{required ? " *" : ""}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-[#d8dde5] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#707985] dark:border-[#3a414c] dark:bg-[#111419]"
      />
    </label>
  );
}

export default function TrustSubjectRegistrationAction({
  taskId,
  intakeMarket,
  eligible,
  canReview
}) {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [preflight, setPreflight] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!eligible) {
    return null;
  }

  if (!canReview) {
    return (
      <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
        <h3 className="text-sm font-bold">제품 사실 대상 식별</h3>
        <p className="mt-2 text-sm text-[#7a828e] dark:text-[#9ea6b1]">
          이 항목은 제품 사실 대상 생성 검토가 필요합니다. 현재 계정은 조회 권한만 있어
          등록 작업을 수행할 수 없습니다.
        </p>
      </section>
    );
  }

  const reviewedIdentity = toReviewedIdentity(form);
  const variantReviewed =
    Boolean(reviewedIdentity.variantKey) ||
    reviewedIdentity.variantKeyReviewedAsNull;
  const formReady =
    Boolean(reviewedIdentity.formulationRevisionKey) &&
    Boolean(reviewedIdentity.marketApplicability) &&
    variantReviewed;

  function changeField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setPreflight(null);
    setResult(null);
    setError(null);
  }

  async function handlePreflight() {
    if (!formReady) {
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const data = await postJson(
        "/api/admin/trust/subject-registration/preflight",
        { taskId, reviewedIdentity }
      );
      setPreflight(data.preflight);
    } catch (nextError) {
      setPreflight(null);
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!preflight?.preflightHash || !preflight?.reviewedIdentity) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const requestId = `trust-phase5b-${crypto.randomUUID()}`;
      const data = await postJson(
        "/api/admin/trust/subject-registration/confirm",
        {
          taskId,
          reviewedIdentity: preflight.reviewedIdentity,
          preflightHash: preflight.preflightHash,
          proposalDigest: preflight.proposalDigest,
          requestId
        }
      );
      setResult(data.result);
      setPreflight(null);
      router.refresh();
    } catch (nextError) {
      setError(nextError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">제품 사실 대상 등록</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6f6652] dark:text-amber-200/80">
            카탈로그의 제품 식별 근거는 제품 사실 대상의 최종 권위가 아닙니다.
            변형과 처방 버전 식별 정보는 관리자가 직접 검토한 값을 입력해야 하며,
            카탈로그 근거에서 자동 생성하지 않습니다.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm dark:bg-amber-950 dark:text-amber-200">
          제품 검토 권한
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-[#181c22]">
        <p className="text-xs leading-5 text-[#6b7280] dark:text-[#aeb5bf]">
          현재 검토 항목 시장: <strong>{displayMarket(intakeMarket)}</strong>.
          시장 값은 자동 입력하지 않습니다. 검토 후 동일한 시장 코드를 직접 입력해야 합니다.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InputField
            label="처방 버전 키"
            required
            value={form.formulationRevisionKey}
            onChange={(event) => changeField("formulationRevisionKey", event.target.value)}
            placeholder="검토 완료된 기준 처방 버전 키"
          />
          <InputField
            label="변형 키"
            value={form.variantKey}
            onChange={(event) => {
              changeField("variantKey", event.target.value);
              if (event.target.value.trim()) {
                setForm((current) => ({
                  ...current,
                  variantKey: event.target.value,
                  variantKeyReviewedAsNull: false
                }));
              }
            }}
            placeholder="별도 변형이 있으면 입력"
          />
          <InputField
            label="처방 버전 이름"
            value={form.formulationLabel}
            onChange={(event) => changeField("formulationLabel", event.target.value)}
            placeholder="선택: 사람이 읽는 처방 버전 이름"
          />
          <InputField
            label="적용 시장"
            required
            value={form.marketApplicability}
            onChange={(event) => changeField("marketApplicability", event.target.value)}
            placeholder={intakeMarket ? `예: ${intakeMarket}` : "예: KR"}
          />
          <InputField
            label="적용 지역"
            value={form.regionApplicability}
            onChange={(event) => changeField("regionApplicability", event.target.value)}
            placeholder="선택"
          />
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="적용 시작일"
              type="date"
              value={form.validFrom}
              onChange={(event) => changeField("validFrom", event.target.value)}
            />
            <InputField
              label="적용 종료일"
              type="date"
              value={form.validTo}
              onChange={(event) => changeField("validTo", event.target.value)}
            />
          </div>
        </div>

        <label className="mt-3 flex items-start gap-2 rounded-lg bg-[#f7f8fa] p-3 text-xs dark:bg-[#20242b]">
          <input
            type="checkbox"
            checked={form.variantKeyReviewedAsNull}
            disabled={Boolean(form.variantKey.trim())}
            onChange={(event) =>
              changeField("variantKeyReviewedAsNull", event.target.checked)
            }
            className="mt-0.5"
          />
          <span>
            별도 의미상 변형이 없는 제품 단위 대상으로 검토했습니다.
            이 항목을 체크하지 않으면 변형 키를 비운 상태로 사전 검증할 수 없습니다.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreflight}
            disabled={busy || !formReady}
            className="rounded-xl bg-[#171a20] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#eef1f5] dark:text-[#171a20]"
          >
            {busy ? "검증 중…" : "대상 등록 사전 검증"}
          </button>
          {!formReady ? (
            <span className="self-center text-xs text-[#8a6b24] dark:text-amber-300">
              처방 버전·시장·변형 검토를 완료해야 합니다.
            </span>
          ) : null}
        </div>
      </div>

      {preflight ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-[#181c22]">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="font-semibold text-[#707783]">처방 버전</p>
              <p className="mt-1 break-all font-mono">
                {preflight.proposal?.formulation_revision_key ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">변형</p>
              <p className="mt-1 font-mono">
                {preflight.proposal?.variant_key ?? "없음"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">적용 시장</p>
              <p className="mt-1">
                {displayMarket(preflight.proposal?.market_applicability)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">의미 키</p>
              <p className="mt-1 font-mono">
                {shortHash(preflight.proposal?.subject_semantic_key)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">카탈로그의 제품 사실 권위 여부</p>
              <p className="mt-1">
                {preflight.catalogContext?.treatedAsProductFactAuthority
                  ? "잘못된 상태"
                  : "아니오"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">예정 대상 생성 수</p>
              <p className="mt-1">
                {preflight.plannedWrites?.productFactSubjects ?? 0}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            확인하면 <strong>관리자가 검토한 제품 사실 대상 식별 정보만</strong> 기존 관리형 등록 절차로 저장합니다.
            근거 채택, 제품 사실 확정, 추천 변경은 자동으로 실행하지 않습니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "등록 중…" : "검토한 대상 등록"}
            </button>
            <button
              type="button"
              onClick={handlePreflight}
              disabled={busy}
              className="rounded-xl border border-[#d8dde5] px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-[#3a414c]"
            >
              사전 검증 다시 실행
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          제품 사실 대상 등록과 기준 식별 재처리가 완료되었습니다.
          <div className="mt-2 break-all font-mono text-xs">
            {result.subjectId}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage(error)}
        </div>
      ) : null}
    </section>
  );
}
