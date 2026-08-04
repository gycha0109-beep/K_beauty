"use client";

import Link from "next/link";
import { useMemo, useReducer, useRef, useState } from "react";
import {
  PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES
} from "@/lib/admin/product-review-import/import-error-map";
import {
  canConfirmProductReviewImport,
  hasAllProductReviewImportFiles,
  INITIAL_PRODUCT_REVIEW_IMPORT_STATE,
  productReviewImportReducer,
  PRODUCT_REVIEW_IMPORT_STATES
} from "@/app/admin/products/reviews/import/workbench-state";

const FILES = Object.freeze([
  ["batch", "batch.json", ".json"],
  ["manifest", "manifest.csv", ".csv"],
  ["evidence", "evidence.jsonl", ".jsonl,application/x-ndjson"],
  ["reviewed", "reviewed.csv", ".csv"]
]);
const CONFIRMATION = "CONFIRM_PRODUCT_REVIEW_IMPORT";

function formatBytes(value) {
  if (!Number.isFinite(value)) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function errorMessage(code) {
  return (
    PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES[code] ||
    PRODUCT_REVIEW_IMPORT_ERROR_MESSAGES.unexpected_error
  );
}

function normalizeImportError(error, fallback = "unexpected_error") {
  const code =
    typeof error?.code === "string" && error.code
      ? error.code
      : fallback;
  return {
    code,
    message:
      typeof error?.safeMessage === "string" && error.safeMessage
        ? error.safeMessage
        : errorMessage(code),
    requestId:
      typeof error?.requestId === "string" ? error.requestId : null,
    retryable: error?.retryable === true
  };
}

function makeFormData(files, fields = {}) {
  const formData = new FormData();
  for (const [field] of FILES) {
    formData.append(field, files[field], files[field].name);
  }
  for (const [field, value] of Object.entries(fields)) {
    formData.append(field, value);
  }
  return formData;
}

async function requestImport(url, formData) {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    cache: "no-store",
    credentials: "same-origin"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload || typeof payload !== "object") {
    const error = new Error("product_review_import_request_failed");
    error.code =
      typeof payload?.error === "string"
        ? payload.error
        : "unexpected_error";
    error.safeMessage =
      typeof payload?.message === "string" ? payload.message : null;
    error.requestId =
      typeof payload?.requestId === "string" ? payload.requestId : null;
    error.retryable = payload?.retryable === true;
    throw error;
  }
  return payload;
}

function Summary({ summary }) {
  if (!summary) return null;
  const values = [
    ["전체", summary.total],
    ["유효", summary.valid ?? summary.total],
    ["승인", summary.approve ?? (summary.create || 0) + (summary.merge || 0)],
    ["신규", summary.create],
    ["병합", summary.merge],
    ["보류", summary.defer],
    ["차단", summary.block],
    ["Stale", summary.stale],
    ["Identity 충돌", summary.identityConflicts],
    ["Schema 오류", summary.schemaErrors],
    ["DB writes", summary.databaseWrites ?? "confirmed"]
  ].filter(([, value]) => value !== undefined && value !== null);

  return (
    <section className="rounded-2xl border border-[#dde2e9] bg-white p-5 dark:border-[#303640] dark:bg-[#171a20]">
      <h2 className="text-base font-semibold">Batch summary</h2>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-[#f6f7f9] p-3 dark:bg-[#20242b]">
            <dt className="text-xs text-[#737b87]">{label}</dt>
            <dd className="mt-1 text-lg font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function RowResults({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-[#dde2e9] bg-white p-5 dark:border-[#303640] dark:bg-[#171a20]">
      <h2 className="text-base font-semibold">Row 검증</h2>
      <div className="mt-4 grid gap-3">
        {rows.map((row, index) => (
          <article
            key={`${row.candidateId || "unknown"}-${index}`}
            className="rounded-xl border border-[#e3e7ed] p-4 dark:border-[#303640]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="break-all text-sm font-semibold">
                {row.candidateId || "candidate ID 확인 불가"}
              </p>
              <span className="rounded-full bg-[#f1f3f6] px-2.5 py-1 text-xs font-semibold dark:bg-[#242932]">
                {row.decision || "invalid"} · {row.plan}
              </span>
            </div>
            {row.errors?.length > 0 ? (
              <ul className="mt-3 grid gap-2 text-sm text-red-700 dark:text-red-300">
                {row.errors.map((error, errorIndex) => (
                  <li key={`${error.code}-${error.field}-${errorIndex}`}>
                    {error.field ? `${error.field}: ` : ""}
                    {error.message || errorMessage(error.code)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                반영 계획 검증 통과
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ProductReviewImportWorkbench() {
  const [files, setFiles] = useState({});
  const [confirmation, setConfirmation] = useState("");
  const [state, dispatch] = useReducer(
    productReviewImportReducer,
    INITIAL_PRODUCT_REVIEW_IMPORT_STATE
  );
  const inFlight = useRef(false);
  const complete = useMemo(
    () => hasAllProductReviewImportFiles(files),
    [files]
  );
  const canConfirm = canConfirmProductReviewImport(state, confirmation);
  const busy = [
    PRODUCT_REVIEW_IMPORT_STATES.VALIDATING,
    PRODUCT_REVIEW_IMPORT_STATES.CONFIRMING
  ].includes(state.status);
  const finished = [
    PRODUCT_REVIEW_IMPORT_STATES.CONFIRMED,
    PRODUCT_REVIEW_IMPORT_STATES.ALREADY_CONFIRMED
  ].includes(state.status);
  const visibleSummary = state.result?.summary || state.dryRun?.summary || null;

  function selectFile(field, file) {
    const nextFiles = { ...files };
    if (file instanceof File) nextFiles[field] = file;
    else delete nextFiles[field];
    setFiles(nextFiles);
    setConfirmation("");
    dispatch({
      type: "files_changed",
      complete: hasAllProductReviewImportFiles(nextFiles)
    });
  }

  function resetWorkbench() {
    if (inFlight.current) return;
    setFiles({});
    setConfirmation("");
    dispatch({ type: "reset" });
  }

  async function runDryRun() {
    if (inFlight.current || !complete) return;
    inFlight.current = true;
    dispatch({ type: "dry_run_started" });
    try {
      const payload = await requestImport(
        "/api/admin/product-reviews/import/dry-run",
        makeFormData(files)
      );
      dispatch({ type: "dry_run_completed", payload });
    } catch (error) {
      dispatch({
        type: "dry_run_failed",
        error: normalizeImportError(error, "dry_run_failed")
      });
    } finally {
      inFlight.current = false;
    }
  }

  async function confirmImport() {
    if (inFlight.current || !canConfirm) return;
    inFlight.current = true;
    dispatch({ type: "confirm_started" });
    try {
      const payload = await requestImport(
        "/api/admin/product-reviews/import/confirm",
        makeFormData(files, {
          requestId: state.requestId,
          expectedReviewedFileSha256: state.reviewedFileSha256,
          expectedCanonicalPayloadSha256: state.canonicalPayloadSha256,
          confirmation
        })
      );
      dispatch({ type: "confirm_completed", payload });
    } catch (error) {
      dispatch({
        type: "confirm_failed",
        error: normalizeImportError(error, "confirm_failed")
      });
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#777f8c]">
          Product operations
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Reviewed batch import
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#68717d] dark:text-[#b2b8c1]">
          동일 export batch의 네 파일을 서버에서 다시 검증합니다. 파일은 저장하지 않으며,
          dry-run이 ready인 경우에만 전체 batch 단일 transaction 반영을 승인할 수 있습니다.
        </p>
      </header>

      <section className="rounded-2xl border border-[#dde2e9] bg-white p-5 dark:border-[#303640] dark:bg-[#171a20]">
        <h2 className="text-base font-semibold">1. 네 파일 선택</h2>
        <p className="mt-1 text-sm text-[#747c88]">
          ZIP이 아니라 batch.json, manifest.csv, evidence.jsonl, reviewed.csv를 각각 선택합니다.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FILES.map(([field, label, accept]) => {
            const file = files[field];
            return (
              <label
                key={`${field}-${state.filesRevision}`}
                className="rounded-xl border border-[#dfe3e9] p-4 dark:border-[#303640]"
              >
                <span className="text-sm font-semibold">{label}</span>
                <input
                  className="mt-3 block w-full text-sm"
                  type="file"
                  accept={accept}
                  disabled={busy}
                  onChange={(event) =>
                    selectFile(field, event.target.files?.[0] || null)
                  }
                />
                <span className="mt-2 block break-all text-xs text-[#747c88]">
                  {file
                    ? `${file.name} · ${formatBytes(file.size)}`
                    : "선택되지 않음"}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runDryRun}
            disabled={!complete || busy}
            className="rounded-xl bg-[#171a20] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f2f4f7] dark:text-[#171a20]"
          >
            {state.status === PRODUCT_REVIEW_IMPORT_STATES.VALIDATING
              ? "검증 중..."
              : "Dry-run 실행"}
          </button>
          <button
            type="button"
            onClick={resetWorkbench}
            disabled={busy}
            className="rounded-xl border border-[#d9dde4] px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#343a44]"
          >
            Reset
          </button>
        </div>
      </section>

      {state.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
          <p className="font-semibold">
            {state.error.message || errorMessage(state.error.code)}
          </p>
          {state.error.requestId ? (
            <p className="mt-2 break-all text-xs">
              request ID: {state.error.requestId}
            </p>
          ) : null}
          <p className="mt-1 text-xs">
            {state.error.retryable
              ? "동일 파일과 동일 request ID로 다시 시도할 수 있습니다."
              : "파일 또는 상태를 확인한 뒤 새 dry-run을 실행해 주세요."}
          </p>
        </div>
      ) : null}

      <Summary summary={visibleSummary} />
      <RowResults rows={state.dryRun?.rows} />

      {state.dryRun?.status === "ready" ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950/20">
          <h2 className="text-base font-semibold">2. 실제 반영 승인</h2>
          <p className="mt-2 text-sm leading-6 text-amber-900 dark:text-amber-100">
            이 작업은 products create/merge와 후보 defer/block, audit, confirmation ledger를
            전체 batch 단일 transaction으로 반영합니다. dry-run 파일과 hash를 서버에서 다시 검증합니다.
          </p>
          <label className="mt-4 block">
            <span className="text-xs font-semibold">
              아래 확인 문구를 정확히 입력하세요
            </span>
            <code className="mt-2 block rounded-lg bg-white/70 px-3 py-2 text-xs dark:bg-black/20">
              {CONFIRMATION}
            </code>
            <input
              type="text"
              value={confirmation}
              disabled={busy || finished}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              className="mt-2 w-full rounded-xl border border-amber-300 bg-white px-3 py-3 text-sm outline-none focus:border-amber-600 dark:border-amber-800 dark:bg-[#171a20]"
            />
          </label>
          <button
            type="button"
            onClick={confirmImport}
            disabled={!canConfirm || busy || finished}
            className="mt-4 rounded-xl bg-amber-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {state.status === PRODUCT_REVIEW_IMPORT_STATES.CONFIRMING
              ? "반영 중..."
              : state.status === PRODUCT_REVIEW_IMPORT_STATES.FAILED &&
                  state.error?.retryable
                ? "동일 요청 다시 시도"
                : "Reviewed batch 반영"}
          </button>
        </section>
      ) : null}

      {finished ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h2 className="font-semibold text-emerald-900 dark:text-emerald-100">
            {state.status === PRODUCT_REVIEW_IMPORT_STATES.ALREADY_CONFIRMED
              ? "이미 완료된 동일 요청입니다."
              : "Reviewed batch 반영이 완료되었습니다."}
          </h2>
          <p className="mt-2 break-all text-xs text-emerald-800 dark:text-emerald-200">
            request ID: {state.result?.requestId || state.requestId}
          </p>
        </section>
      ) : null}

      <Link
        href="/admin/products/reviews"
        className="inline-flex rounded-xl border border-[#d9dde4] px-4 py-2.5 text-sm font-semibold transition hover:bg-white dark:border-[#343a44] dark:hover:bg-[#20242b]"
      >
        Product Candidate Reviews로 이동
      </Link>
    </div>
  );
}
