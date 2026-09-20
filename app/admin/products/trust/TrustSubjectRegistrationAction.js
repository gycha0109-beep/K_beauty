"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ERROR_MESSAGES = Object.freeze({
  trust_subject_registration_state_not_reviewable:
    "현재 항목은 더 이상 Subject 생성 검토 상태가 아닙니다.",
  trust_subject_registration_stale_preflight:
    "검토 중 상태가 변경되었습니다. Preflight를 다시 실행해 주세요.",
  trust_subject_registration_stale_proposal:
    "검토한 Subject identity 입력이 변경되었습니다. Preflight를 다시 실행해 주세요.",
  trust_subject_identity_catalog_authority_boundary_invalid:
    "Catalog identity evidence의 authority boundary를 검증할 수 없습니다.",
  trust_subject_identity_market_mismatch:
    "검토한 market이 현재 TRUST intake market과 일치하지 않습니다.",
  trust_subject_identity_variant_review_required:
    "variant_key를 입력하거나 product-scoped(null)로 검토했음을 명시해야 합니다.",
  trust_subject_identity_reviewed_input_invalid:
    "Subject identity 검토 입력값을 다시 확인해 주세요.",
  trust_subject_registration_semantic_key_conflict:
    "동일 semantic key에 다른 Subject identity가 존재합니다.",
  trust_subject_registration_competing_subject_detected:
    "동일 product/market에 다른 current Subject가 존재합니다.",
  trust_subject_registration_forbidden:
    "Subject 등록 권한이 없습니다.",
  trust_subject_registration_service_unavailable:
    "Subject 등록 서비스를 사용할 수 없습니다."
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
    "Subject 등록 검토를 처리하지 못했습니다. 상태를 새로고침한 뒤 다시 확인해 주세요."
  );
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
        <h3 className="text-sm font-bold">Subject resolution</h3>
        <p className="mt-2 text-sm text-[#7a828e] dark:text-[#9ea6b1]">
          이 항목은 Subject 생성 검토가 필요합니다. 현재 계정은 조회 권한만 있어
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
          <h3 className="text-sm font-bold">Controlled Subject registration</h3>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[#6f6652] dark:text-amber-200/80">
            Catalog identity evidence는 Product Fact Subject identity authority가 아닙니다.
            variant/formulation identity는 관리자 검토값을 직접 입력해야 하며,
            catalog evidence에서 자동 생성하지 않습니다.
          </p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-amber-800 shadow-sm dark:bg-amber-950 dark:text-amber-200">
          admin.products.review
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-[#181c22]">
        <p className="text-xs leading-5 text-[#6b7280] dark:text-[#aeb5bf]">
          현재 TRUST intake market: <strong className="font-mono">{intakeMarket ?? "-"}</strong>.
          market 값도 자동 채움하지 않습니다. 검토 후 동일 값을 직접 입력해야 합니다.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InputField
            label="Formulation revision key"
            required
            value={form.formulationRevisionKey}
            onChange={(event) => changeField("formulationRevisionKey", event.target.value)}
            placeholder="검토된 canonical formulation revision"
          />
          <InputField
            label="Variant key"
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
            placeholder="검토된 semantic variant (없으면 아래 체크)"
          />
          <InputField
            label="Formulation label"
            value={form.formulationLabel}
            onChange={(event) => changeField("formulationLabel", event.target.value)}
            placeholder="선택: 사람이 읽는 formulation label"
          />
          <InputField
            label="Market applicability"
            required
            value={form.marketApplicability}
            onChange={(event) => changeField("marketApplicability", event.target.value)}
            placeholder={intakeMarket ? `예: ${intakeMarket}` : "예: KR"}
          />
          <InputField
            label="Region applicability"
            value={form.regionApplicability}
            onChange={(event) => changeField("regionApplicability", event.target.value)}
            placeholder="선택"
          />
          <div className="grid grid-cols-2 gap-2">
            <InputField
              label="Valid from"
              type="date"
              value={form.validFrom}
              onChange={(event) => changeField("validFrom", event.target.value)}
            />
            <InputField
              label="Valid to"
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
            별도 semantic variant가 없는 product-scoped Subject로 검토했습니다.
            이 체크가 없으면 빈 variant_key로 Preflight할 수 없습니다.
          </span>
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePreflight}
            disabled={busy || !formReady}
            className="rounded-xl bg-[#171a20] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#eef1f5] dark:text-[#171a20]"
          >
            {busy ? "검증 중…" : "Subject 등록 Preflight"}
          </button>
          {!formReady ? (
            <span className="self-center text-xs text-[#8a6b24] dark:text-amber-300">
              formulation / market / variant 검토를 완료해야 합니다.
            </span>
          ) : null}
        </div>
      </div>

      {preflight ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900/60 dark:bg-[#181c22]">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <p className="font-semibold text-[#707783]">Formulation revision</p>
              <p className="mt-1 break-all font-mono">
                {preflight.proposal?.formulation_revision_key ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">Variant</p>
              <p className="mt-1 font-mono">
                {preflight.proposal?.variant_key ?? "null (reviewed)"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">Market</p>
              <p className="mt-1 font-mono">
                {preflight.proposal?.market_applicability ?? "-"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">Semantic key</p>
              <p className="mt-1 font-mono">
                {shortHash(preflight.proposal?.subject_semantic_key)}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">Catalog PF authority</p>
              <p className="mt-1 font-mono">
                {preflight.catalogContext?.treatedAsProductFactAuthority
                  ? "INVALID"
                  : "false"}
              </p>
            </div>
            <div>
              <p className="font-semibold text-[#707783]">Planned Subject writes</p>
              <p className="mt-1 font-mono">
                {preflight.plannedWrites?.productFactSubjects ?? 0}
              </p>
            </div>
          </div>

          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            확인 시 <strong>검토한 Subject identity만</strong> 기존 governed RPC로 등록합니다.
            Evidence 채택, Product Fact confirmation, Recommendation 변경은 자동 실행되지 않습니다.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={busy}
              className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "등록 중…" : "명시적으로 Subject 등록"}
            </button>
            <button
              type="button"
              onClick={handlePreflight}
              disabled={busy}
              className="rounded-xl border border-[#d8dde5] px-4 py-2 text-sm font-semibold disabled:opacity-50 dark:border-[#3a414c]"
            >
              Preflight 다시 실행
            </button>
          </div>
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
          Subject 등록과 canonical TRUST subject resolution 재실행이 완료되었습니다.
          <div className="mt-2 break-all font-mono text-xs">
            {result.subjectId}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          {errorMessage(error)}
          <div className="mt-1 font-mono text-[11px] opacity-70">
            {error.code}
          </div>
        </div>
      ) : null}
    </section>
  );
}
