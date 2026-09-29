"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function short(value) {
  if (!value) return "-";
  const text = String(value);
  return text.length > 20
    ? `${text.slice(0, 10)}…${text.slice(-8)}`
    : text;
}

function messageFor(code) {
  const messages = {
    trust_grouped_relocation_stale_preflight:
      "상태가 변경되었습니다. Preflight를 다시 실행하세요.",
    trust_grouped_relocation_preflight_parity_mismatch:
      "애플리케이션과 데이터베이스 Preflight가 일치하지 않습니다. 확정을 차단했습니다.",
    trust_grouped_relocation_invalid_request:
      "Relocation 요청이 유효하지 않습니다.",
    trust_grouped_relocation_conflict:
      "이미 처리되었거나 현재 상태와 충돌합니다.",
    trust_grouped_relocation_service_unavailable:
      "Relocation 서비스를 사용할 수 없습니다.",
    trust_grouped_relocation_rpc_failed:
      "Relocation 데이터베이스 처리에 실패했습니다.",
    trust_grouped_relocation_canary_real_candidate_required:
      "첫 grouped relocation은 실제 scheduled READY_FOR_8I4 canary만 확정할 수 있습니다.",
    trust_grouped_relocation_canary_candidate_not_first:
      "다른 실제 canary 후보가 먼저 대기 중입니다. 첫 후보를 먼저 처리하세요.",
  };
  return messages[code] || "Relocation 처리 중 오류가 발생했습니다.";
}

function Pill({ children, tone = "slate" }) {
  const styles = {
    slate:
      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    amber:
      "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    emerald:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    blue:
      "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function CandidateCard({ item, selected, onSelect }) {
  const title =
    [item.product?.brand, item.product?.name].filter(Boolean).join(" ") ||
    item.productId;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        selected
          ? "w-full rounded-2xl border border-[#20242b] bg-[#171a20] p-4 text-left text-white dark:border-[#e6e9ee] dark:bg-[#eef1f5] dark:text-[#171a20]"
          : "w-full rounded-2xl border border-[#e0e4ea] bg-white p-4 text-left transition hover:border-[#aeb5bf] dark:border-[#303640] dark:bg-[#181c22] dark:hover:border-[#59616d]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p
            className={
              selected
                ? "mt-1 text-xs opacity-75"
                : "mt-1 text-xs text-[#7a828e] dark:text-[#9da5b0]"
            }
          >
            Source {item.historicalSourceIds?.length ?? 0} · Incident{" "}
            {item.incidentIds?.length ?? 0}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Pill tone="amber">READY_FOR_8I4</Pill>
          {item.canary?.isFirstRealCanary ? (
            <Pill tone="emerald">8I-4G FIRST REAL CANARY</Pill>
          ) : item.canary?.state === "QUEUED_BEHIND_FIRST_REAL_CANARY" ? (
            <Pill>Queued behind canary</Pill>
          ) : item.canary?.state ===
            "NOT_REAL_SCHEDULED_CANARY_BLOCKED_FOR_FIRST_GROUP" ? (
            <Pill>Not real canary</Pill>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function Detail({ item }) {
  const [busy, setBusy] = useState(false);
  const [preflight, setPreflight] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  if (!item) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8dde5] p-10 text-center text-sm text-[#7a828e] dark:border-[#353b45] dark:text-[#9ea6b1]">
        검토할 relocation candidate가 없습니다.
      </div>
    );
  }

  const canConfirmCanary =
    item.canary?.firstCanaryOpen !== true ||
    item.canary?.isFirstRealCanary === true;

  async function rerunPreflight() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(
        "/api/admin/trust/relocation/preflight",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: item.caseId,
            evaluationId: item.evaluationId,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "trust_grouped_relocation_failed",
        );
      }
      setPreflight(payload.preflight);
    } catch (caught) {
      setPreflight(null);
      setError(
        caught.message || "trust_grouped_relocation_failed",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (
      !canConfirmCanary ||
      preflight?.status !==
        "ready_for_explicit_admin_confirmation" ||
      !preflight?.preflightHash
    ) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/admin/trust/relocation/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseId: item.caseId,
            evaluationId: item.evaluationId,
            preflightHash: preflight.preflightHash,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(
          payload.error || "trust_grouped_relocation_failed",
        );
      }
      setResult(payload.result);
      setPreflight(null);
    } catch (caught) {
      setError(
        caught.message || "trust_grouped_relocation_failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777f8b]">
              Phase 8I-4F · Grouped official-source relocation
            </p>
            <h2 className="mt-1 text-xl font-bold">
              {[item.product?.brand, item.product?.name]
                .filter(Boolean)
                .join(" ") || item.productId}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {item.canary?.isFirstRealCanary ? (
              <Pill tone="emerald">FIRST REAL CANARY</Pill>
            ) : null}
            <Pill tone="amber">Explicit Admin Confirm</Pill>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl bg-[#f6f7f9] p-4 dark:bg-[#20242b]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#737b87]">
              Old official locator
            </p>
            <p className="mt-2 break-all text-sm font-medium">
              {item.oldLocator}
            </p>
          </div>
          <div className="rounded-xl bg-[#f6f7f9] p-4 dark:bg-[#20242b]">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#737b87]">
              Qualified replacement
            </p>
            <p className="mt-2 break-all text-sm font-medium">
              {item.replacementLocator}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="text-xs text-[#78808b]">Case</dt>
            <dd className="mt-1 font-mono text-xs">{short(item.caseId)}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#78808b]">Evaluation</dt>
            <dd className="mt-1 font-mono text-xs">
              {short(item.evaluationId)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#78808b]">Qualified anchor</dt>
            <dd className="mt-1 font-mono text-xs">
              {short(item.qualifiedHistoricalSourceId)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#78808b]">Historical sources</dt>
            <dd className="mt-1 font-semibold">
              {item.historicalSourceIds?.length ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#78808b]">Transport incidents</dt>
            <dd className="mt-1 font-semibold">
              {item.incidentIds?.length ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#78808b]">Qualification digest</dt>
            <dd className="mt-1 font-mono text-xs">
              {short(item.qualificationDigest)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
        <h3 className="text-sm font-bold">Grouped lineage</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-[#6f7782]">
              Historical Evidence Sources
            </p>
            <div className="mt-2 grid gap-2">
              {(item.historicalSources || []).map((source) => (
                <div
                  key={source.sourceId}
                  className="rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]"
                >
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="blue">{source.sourceKind || "source"}</Pill>
                    {source.sourceId ===
                    item.qualifiedHistoricalSourceId ? (
                      <Pill tone="emerald">Qualified anchor</Pill>
                    ) : null}
                  </div>
                  <p className="mt-2 font-semibold">
                    {source.publisher || "-"}
                  </p>
                  <p className="mt-1 break-all text-[#68717d] dark:text-[#aeb5bf]">
                    {source.canonicalLocator}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#6f7782]">
              Transport incidents
            </p>
            <div className="mt-2 grid gap-2">
              {(item.incidents || []).map((incident) => (
                <div
                  key={incident.incidentId}
                  className="rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]"
                >
                  <p className="font-semibold">{incident.incidentKind}</p>
                  <p className="mt-1 break-all text-[#68717d] dark:text-[#aeb5bf]">
                    {incident.effectiveLocator}
                  </p>
                  <p className="mt-1 font-mono text-[11px] opacity-70">
                    {short(incident.incidentId)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
        <h3 className="text-sm font-bold">Authority boundary</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill tone="emerald">Binding relocation only</Pill>
          <Pill>Product Fact Current unchanged</Pill>
          <Pill>Evidence Source unchanged</Pill>
          <Pill>Recommendation unchanged</Pill>
          <Pill>Semantic SAME/CHANGED 미판정</Pill>
        </div>
        <p className="mt-3 text-xs leading-5 text-[#657080] dark:text-[#aeb7c4]">
          READY_FOR_8I4는 확정 권한이 아닙니다. 버튼을 누를 때 서버가
          JS/DB dual-preflight를 다시 실행하고, digest가 모두 일치할 때만
          기존 Phase 8H relocation primitive를 호출합니다.
        </p>

        {item.canary?.firstCanaryOpen ? (
          <div
            className={
              item.canary?.isFirstRealCanary
                ? "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950/30 dark:text-slate-300"
            }
          >
            {item.canary?.isFirstRealCanary
              ? "Phase 8I-4G 첫 실제 canary 후보입니다. 명시적 Admin 확인 이후에만 첫 grouped relocation을 생성할 수 있습니다."
              : "첫 실제 canary가 아직 닫히지 않았습니다. 이 후보의 relocation 확정은 현재 차단됩니다."}
          </div>
        ) : null}

        <button
          type="button"
          onClick={rerunPreflight}
          disabled={busy || Boolean(result)}
          className="mt-4 rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50 dark:border-amber-800 dark:bg-[#181c22] dark:text-amber-200"
        >
          {busy ? "검증 중…" : "Preflight 다시 실행"}
        </button>

        {preflight?.status ===
        "ready_for_explicit_admin_confirmation" ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 text-xs dark:border-amber-900 dark:bg-[#181c22]">
            <p>
              <strong>Dual-preflight:</strong> PASS
            </p>
            <p className="mt-1">
              <strong>Group plan:</strong>{" "}
              <span className="font-mono">
                {short(preflight.groupPlanDigest)}
              </span>
            </p>
            <p className="mt-1">
              <strong>예상 영향:</strong> old binding retire + replacement
              binding resolve + grouped lineage append
            </p>
            <p className="mt-1">
              <strong>Product Fact / Evidence / Recommendation:</strong> 변경
              없음
            </p>
            <button
              type="button"
              onClick={confirm}
              disabled={busy || !canConfirmCanary}
              className="mt-4 rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              명시적으로 Official Source Relocation 확정
            </button>
          </div>
        ) : null}

        {preflight?.status === "hold" ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            확정 차단 · {(preflight.blockers || []).join(", ") || "HOLD"}
          </div>
        ) : null}

        {preflight?.status === "already_confirmed" ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            이미 확정된 relocation입니다. Group{" "}
            <span className="font-mono">{short(preflight.groupId)}</span>
          </div>
        ) : null}

        {result ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-semibold">Relocation 확정 완료</p>
            <p className="mt-1">
              Group {short(result.groupId)} · Relocation{" "}
              {short(result.relocationId)}
            </p>
            <p className="mt-1">
              Source {result.historicalSourceCount} · Incident{" "}
              {result.incidentCount} · Product Fact writes 0
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {messageFor(error)}
            <div className="mt-1 font-mono text-[11px] opacity-70">
              {error}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default function TrustGroupedRelocationWorkbench({ queue }) {
  const [selectedId, setSelectedId] = useState(
    queue.items?.[0]?.evaluationId ?? null,
  );

  const selected = useMemo(
    () =>
      queue.items?.find(
        (item) => item.evaluationId === selectedId,
      ) ??
      queue.items?.[0] ??
      null,
    [queue.items, selectedId],
  );

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a828e]">
            TRUST / Official Source Operations
          </p>
          <h1 className="mt-1 text-2xl font-bold">Source Relocations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68717d] dark:text-[#aeb5bf]">
            최신 READY_FOR_8I4 evaluation 중 DB와 JS preflight가 모두
            통과하는 grouped relocation만 표시합니다. 이 화면의 확정은
            source binding lifecycle만 변경하며 Product Fact 의미 판단은
            수행하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {queue.canary?.state === "WAITING_FOR_REAL_READY_FOR_8I4" ? (
            <Pill>8I-4G Waiting</Pill>
          ) : queue.canary?.state ===
            "FIRST_REAL_CANARY_READY_FOR_ADMIN_PREFLIGHT" ? (
            <Pill tone="emerald">8I-4G Canary Ready</Pill>
          ) : (
            <Pill tone="blue">8I-4G Canary Closed</Pill>
          )}
          <Pill tone="amber">admin.products.review</Pill>
          <Link
            href="/admin/products/trust"
            className="rounded-full border border-[#dce1e8] px-3 py-1.5 text-xs font-semibold dark:border-[#343a44]"
          >
            Fact Queue로 돌아가기
          </Link>
        </div>
      </div>

      {queue.count === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d8dde5] p-10 text-center text-sm text-[#7a828e] dark:border-[#353b45] dark:text-[#9ea6b1]">
          {queue.canary?.state === "WAITING_FOR_REAL_READY_FOR_8I4"
            ? "WAITING_FOR_REAL_READY_FOR_8I4 · 실제 scheduled READY 후보가 아직 없습니다."
            : "현재 명시적 Admin relocation confirmation이 가능한 READY_FOR_8I4 case가 없습니다."}
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)]">
          <aside className="grid content-start gap-2">
            {queue.items.map((item) => (
              <CandidateCard
                key={item.evaluationId}
                item={item}
                selected={selected?.evaluationId === item.evaluationId}
                onSelect={() => setSelectedId(item.evaluationId)}
              />
            ))}
          </aside>
          <main>
            <Detail
              key={selected?.evaluationId ?? "empty"}
              item={selected}
            />
          </main>
        </div>
      )}
    </div>
  );
}
