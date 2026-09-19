import Link from "next/link";
import TrustSubjectRegistrationAction from "@/app/admin/products/trust/TrustSubjectRegistrationAction";

const BLOCKER_LABELS = Object.freeze({
  SUBJECT_CREATION_REQUIRED: "Subject 생성 필요",
  SUBJECT_CANDIDATE_FOUND: "Subject 후보 검토",
  IDENTITY_BLOCKED: "Identity 차단",
  VARIANT_CONFLICT: "Variant 충돌",
  FORMULATION_CONFLICT: "Formulation 충돌",
  MARKET_CONFLICT: "Market 충돌",
  REGISTRY_GAP: "Registry gap",
  EVIDENCE_CONFLICT: "Evidence 충돌"
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

function formatJson(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatCurrentValue(fact) {
  if (!fact) {
    return "-";
  }

  if (fact.valueBoolean !== null) {
    return String(fact.valueBoolean);
  }
  if (fact.valueEnum) {
    return fact.valueEnum;
  }
  if (fact.valueEntityIdentifier) {
    return fact.valueEntityIdentifier;
  }
  if (fact.valueRangeMin !== null || fact.valueRangeMax !== null) {
    return `${fact.valueRangeMin ?? "-"}–${fact.valueRangeMax ?? "-"}${fact.valueUnit ? ` ${fact.valueUnit}` : ""}`;
  }
  if (fact.valueNumber !== null) {
    return `${fact.valueNumber}${fact.valueUnit ? ` ${fact.valueUnit}` : ""}`;
  }
  return "-";
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

function Badge({ children, tone = "slate" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    amber: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
  };

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[tone]}`}>
      {children}
    </span>
  );
}

function buildHref({ blocker = "all", taskId = null }) {
  const query = [];
  if (blocker !== "all") {
    query.push(`blocker=${encodeURIComponent(blocker)}`);
  }
  if (taskId) {
    query.push(`task=${encodeURIComponent(taskId)}`);
  }
  return `/admin/products/trust${query.length ? `?${query.join("&")}` : ""}`;
}

function QueueList({ queue }) {
  if (queue.items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8dde5] p-8 text-center text-sm text-[#7a828e] dark:border-[#353b45] dark:text-[#9ea6b1]">
        현재 필터에 해당하는 관리자 검토 항목이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {queue.items.map((item) => {
        const selected = queue.selected?.task.id === item.task.id;
        const title = [item.product?.brand, item.product?.name].filter(Boolean).join(" ") || item.task.productId;
        return (
          <Link
            key={item.task.id}
            href={buildHref({ blocker: queue.filter, taskId: item.task.id })}
            aria-current={selected ? "true" : undefined}
            className={
              selected
                ? "rounded-2xl border border-[#20242b] bg-[#171a20] p-4 text-white dark:border-[#e6e9ee] dark:bg-[#eef1f5] dark:text-[#171a20]"
                : "rounded-2xl border border-[#e0e4ea] bg-white p-4 transition hover:border-[#aeb5bf] dark:border-[#303640] dark:bg-[#181c22] dark:hover:border-[#59616d]"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className={selected ? "mt-1 text-xs opacity-75" : "mt-1 text-xs text-[#7a828e] dark:text-[#9da5b0]"}>
                  {item.task.factKey} · {item.intake?.market ?? "-"} · {item.intake?.category ?? item.product?.category ?? "-"}
                </p>
              </div>
              <Badge tone={item.task.blockerCode?.includes("CONFLICT") ? "red" : "amber"}>
                {BLOCKER_LABELS[item.task.blockerCode] || item.task.state || "Review"}
              </Badge>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function SourceSection({ item }) {
  const binding = item.sourceBinding;
  const observation = item.observation;
  const catalog = item.catalogCandidate;

  return (
    <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
      <h3 className="text-sm font-bold">Source / provenance</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Official binding" value={binding?.sourceName} />
        <Field label="Official URL" value={binding?.sourceUrl} />
        <Field label="Observation publisher" value={observation?.publisher} />
        <Field label="Observation URL" value={observation?.canonicalLocator} />
        <Field label="Digest basis" value={observation?.digestBasis} />
        <Field label="Observed at" value={formatDate(observation?.observedAt)} />
        <Field label="Catalog source" value={catalog?.sourceName} />
        <Field label="Catalog source URL" value={catalog?.sourceUrl} />
      </dl>
      {catalog?.providers?.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold text-[#676f7b] dark:text-[#a7aeba]">Identity evidence providers</p>
          <div className="mt-2 grid gap-2">
            {catalog.providers.map((provider, index) => (
              <div key={`${provider.provider ?? "provider"}-${index}`} className="rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">
                <span className="font-semibold">{provider.provider ?? "unknown"}</span>
                {provider.locator ? <span className="ml-2 break-all text-[#68717d] dark:text-[#aeb5bf]">{provider.locator}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {observation ? (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold">Frozen observation detail</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">{formatJson({ observedClaim: observation.observedClaim, productIdentityObservation: observation.productIdentityObservation })}</pre>
        </details>
      ) : null}
    </section>
  );
}

function EvidenceSection({ item }) {
  const evidence = item.evidenceCandidate;
  return (
    <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
      <h3 className="text-sm font-bold">Evidence / governed state</h3>
      {evidence ? (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Candidate state" value={evidence.candidateState} />
            <Field label="Evidence class" value={evidence.evidenceClass} />
            <Field label="Authority" value={evidence.evidenceAuthority} />
            <Field label="Support direction" value={evidence.supportDirection} />
            <Field label="Confidence" value={evidence.confidence} />
            <Field label="Market / locale" value={[evidence.market, evidence.locale].filter(Boolean).join(" / ") || "-"} />
          </dl>
          <pre className="mt-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">{formatJson(evidence.normalizedValue)}</pre>
        </>
      ) : (
        <p className="mt-3 text-sm text-[#7a828e] dark:text-[#9ea6b1]">아직 Evidence candidate가 없습니다.</p>
      )}

      <div className="mt-5 border-t border-[#e6e9ee] pt-5 dark:border-[#303640]">
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#6d7580] dark:text-[#aab1bb]">Existing Current</h4>
        {item.currentFacts.length ? (
          <div className="mt-3 grid gap-2">
            {item.currentFacts.map((fact) => (
              <div key={fact.factInstanceId} className="rounded-xl bg-[#f6f7f9] p-3 text-sm dark:bg-[#20242b]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{fact.factKey}</span>
                  <Badge tone="blue">{fact.semanticStatus ?? "current"}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#68717d] dark:text-[#aeb5bf]">{formatCurrentValue(fact)} · {fact.market ?? "-"} · {fact.authorityCeiling ?? "-"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#7a828e] dark:text-[#9ea6b1]">해당 Subject/Fact의 Current가 없습니다.</p>
        )}
      </div>

      <div className="mt-5 border-t border-[#e6e9ee] pt-5 dark:border-[#303640]">
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#6d7580] dark:text-[#aab1bb]">Governed review</h4>
        {item.reviewAssignments.length ? (
          <div className="mt-3 grid gap-2">
            {item.reviewAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">
                <span className="font-semibold">{assignment.operationalState}</span>
                <span className="ml-2 text-[#68717d] dark:text-[#aeb5bf]">{assignment.reviewPolicyVersion ?? "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#7a828e] dark:text-[#9ea6b1]">아직 governed review assignment가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function Detail({ item, canReview }) {
  if (!item) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8dde5] p-10 text-center text-sm text-[#7a828e] dark:border-[#353b45] dark:text-[#9ea6b1]">
        선택할 검토 항목이 없습니다.
      </div>
    );
  }

  const identityDetail = item.intake?.identityResolutionDetail || {};

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777f8b]">TRUST review item</p>
            <h2 className="mt-1 text-xl font-bold">{[item.product?.brand, item.product?.name].filter(Boolean).join(" ") || item.task.productId}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="amber">{BLOCKER_LABELS[item.task.blockerCode] || item.task.state}</Badge>
            <Badge>{item.intake?.trustState ?? "-"}</Badge>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="Fact" value={item.task.factKey} />
          <Field label="Task state" value={item.task.state} />
          <Field label="Priority" value={item.task.priority} />
          <Field label="Category" value={item.intake?.category ?? item.product?.category} />
          <Field label="Market" value={item.intake?.market} />
          <Field label="Registry" value={item.task.registryVersion} />
          <Field label="Identity state" value={item.intake?.identityState} />
          <Field label="Subject" value={item.task.subjectId ?? item.intake?.subjectId} />
          <Field label="Reason" value={identityDetail.reason_code ?? item.task.blockerCode} />
          <Field label="Updated" value={formatDate(item.task.updatedAt)} />
          <Field label="Attempts" value={item.task.attemptCount} />
          <Field label="Policy" value={item.intake?.requiredFactPolicyVersion} />
        </dl>

        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold">Blocker detail</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">{formatJson(item.task.blockerDetail)}</pre>
        </details>
      </section>

      <TrustSubjectRegistrationAction
        taskId={item.task.id}
        eligible={
          item.task.state === "REVIEW_REQUIRED" &&
          item.task.blockerCode === "SUBJECT_CREATION_REQUIRED" &&
          item.intake?.identityState === "SUBJECT_CREATION_REQUIRED" &&
          !item.task.subjectId &&
          !item.intake?.subjectId
        }
        canReview={canReview}
      />
      <SourceSection item={item} />
      <EvidenceSection item={item} />
    </div>
  );
}

export default function TrustQueueWorkbench({ queue, canReview = false }) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a828e]">TRUST / Product Fact Operations</p>
          <h1 className="mt-1 text-2xl font-bold">Admin Queue</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68717d] dark:text-[#aeb5bf]">
            사람이 판단해야 하는 identity/evidence/registry blocker만 표시합니다. SUBJECT_CREATION_REQUIRED 항목은 admin.products.review 권한에서만 controlled Subject 등록을 수행할 수 있으며 Evidence 채택, Product Fact confirmation, Recommendation 변경은 자동 실행하지 않습니다.
          </p>
        </div>
        {canReview ? <Badge tone="amber">Controlled review</Badge> : <Badge tone="blue">Read only</Badge>}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href={buildHref({ blocker: "all" })}
          className={queue.filter === "all" ? "rounded-full bg-[#171a20] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#eef1f5] dark:text-[#171a20]" : "rounded-full border border-[#dce1e8] px-3 py-1.5 text-xs font-semibold dark:border-[#343a44]"}
        >
          전체 {queue.items.length}
        </Link>
        {queue.visibleBlockers.map((blocker) => (
          <Link
            key={blocker}
            href={buildHref({ blocker })}
            className={queue.filter === blocker ? "rounded-full bg-[#171a20] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#eef1f5] dark:text-[#171a20]" : "rounded-full border border-[#dce1e8] px-3 py-1.5 text-xs font-semibold dark:border-[#343a44]"}
          >
            {BLOCKER_LABELS[blocker] || blocker} {queue.blockerCounts[blocker] ?? 0}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)]">
        <aside>
          <QueueList queue={queue} />
        </aside>
        <main>
          <Detail item={queue.selected} canReview={canReview} />
        </main>
      </div>
    </div>
  );
}
