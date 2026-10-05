"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import TrustSubjectRegistrationAction from "@/app/admin/products/trust/TrustSubjectRegistrationAction";
import TrustReentryAction from "@/app/admin/products/trust/TrustReentryAction";

const BLOCKER_LABELS = Object.freeze({
  SUBJECT_CREATION_REQUIRED: "제품 사실 대상 생성 필요",
  SUBJECT_CANDIDATE_FOUND: "제품 사실 대상 후보 검토",
  IDENTITY_BLOCKED: "제품 식별 차단",
  VARIANT_CONFLICT: "변형 충돌",
  FORMULATION_CONFLICT: "처방 버전 충돌",
  MARKET_CONFLICT: "시장 충돌",
  REGISTRY_GAP: "기준 목록 누락",
  EVIDENCE_CONFLICT: "근거 충돌"
});

const FACT_LABELS = Object.freeze({
  barrier_support_claim: "피부 장벽 지원 주장",
  primary_use_role: "주요 사용 목적",
  contains_active: "유효 성분 포함",
  water_resistance_duration: "내수성 지속 시간",
  product_format: "제품 형태",
  low_ph: "약산성 여부",
  photo_protection: "광보호",
  exfoliation_load: "각질 제거 부담",
  hydration_preservation: "수분 보존",
  cleansing_burden: "세정 부담",
  irritation_burden: "자극 부담",
  sebum_pore_control: "피지·모공 관리"
});

const CATEGORY_LABELS = Object.freeze({
  cleanser: "클렌저",
  treatment: "트리트먼트",
  toner_essence: "토너·에센스",
  toner_pad: "토너 패드",
  moisturizer_balm: "보습제·밤",
  moisturizer_cream: "보습 크림",
  moisturizer_lotion_emulsion: "로션·에멀전",
  serum: "세럼",
  essence: "에센스",
  ampoule: "앰플",
  sunscreen: "선크림"
});

const STATE_LABELS = Object.freeze({
  REVIEW_REQUIRED: "검토 필요",
  RESEARCH_PENDING: "조사 대기",
  BLOCKED: "차단됨",
  COMPLETED: "완료",
  current: "현재",
  EXACT_SUBJECT_FOUND: "정확한 대상 확인",
  SUBJECT_CREATION_REQUIRED: "제품 사실 대상 생성 필요",
  SUBJECT_CANDIDATE_FOUND: "제품 사실 대상 후보 검토",
  IDENTITY_BLOCKED: "제품 식별 차단",
  SOURCE_BLOCKED: "출처 차단",
  EVIDENCE_INSUFFICIENT: "근거 부족",
  EVIDENCE_CANDIDATE: "근거 후보",
  PREFLIGHT_READY: "사전 검증 완료",
  CONFIRMED: "확인 완료",
  ALREADY_COVERED: "이미 충족됨"
});

function displayFact(value) {
  return FACT_LABELS[value] || value || "-";
}

function displayCategory(value) {
  return CATEGORY_LABELS[value] || value || "-";
}

function displayState(value) {
  return STATE_LABELS[value] || BLOCKER_LABELS[value] || value || "-";
}

function displayMarket(value) {
  return value === "KR" ? "대한민국" : value || "-";
}

function displayRegistry(value) {
  return value === "product-fact-registry-cross-category-v1"
    ? "교차 카테고리 제품 사실 기준 1판"
    : value || "-";
}

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
    return fact.valueBoolean ? "예" : "아니오";
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

function buildHref({ blocker = "all", taskId = null, search = "" }) {
  const query = [];
  if (blocker !== "all") {
    query.push(`blocker=${encodeURIComponent(blocker)}`);
  }
  if (taskId) {
    query.push(`task=${encodeURIComponent(taskId)}`);
  }
  if (search.trim()) {
    query.push(`q=${encodeURIComponent(search.trim())}`);
  }
  return `/admin/products/trust${query.length ? `?${query.join("&")}` : ""}`;
}

function matchesQueueSearch(item, search) {
  const normalized = search.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const values = [
    item.product?.brand,
    item.product?.name,
    item.task?.id,
    item.task?.productId,
    item.task?.factKey,
    item.task?.state,
    item.task?.blockerCode,
    BLOCKER_LABELS[item.task?.blockerCode],
    item.intake?.market,
    item.intake?.category,
    item.product?.category
  ];

  return values
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function QueueList({ queue, items, search }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#d8dde5] p-8 text-center text-sm text-[#7a828e] dark:border-[#353b45] dark:text-[#9ea6b1]">
        검색 조건에 해당하는 관리자 검토 항목이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const selected = queue.selected?.task.id === item.task.id;
        const title = [item.product?.brand, item.product?.name].filter(Boolean).join(" ") || item.task.productId;
        return (
          <Link
            key={item.task.id}
            href={buildHref({ blocker: queue.filter, taskId: item.task.id, search })}
            prefetch={false}
            aria-current={selected ? "true" : undefined}
            className={
              selected
                ? "rounded-2xl border border-[#8b95a3] bg-[#f3f5f7] p-3 shadow-sm dark:border-[#667080] dark:bg-[#252a33]"
                : "rounded-2xl border border-[#e0e4ea] bg-white p-3 transition hover:border-[#aeb5bf] hover:bg-[#f8f9fb] dark:border-[#303640] dark:bg-[#181c22] dark:hover:border-[#59616d] dark:hover:bg-[#20242b]"
            }
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{title}</p>
                <p className="mt-1 truncate text-xs text-[#7a828e] dark:text-[#9da5b0]">
                  {displayFact(item.task.factKey)} · {displayMarket(item.intake?.market)} · {displayCategory(item.intake?.category ?? item.product?.category)}
                </p>
              </div>
              <span className="shrink-0"><Badge tone={item.task.blockerCode?.includes("CONFLICT") ? "red" : "amber"}>
                {BLOCKER_LABELS[item.task.blockerCode] || displayState(item.task.state) || "검토"}
              </Badge></span>
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
      <h3 className="text-sm font-bold">출처 / 추적 정보</h3>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="공식 출처 연결" value={binding?.sourceName} />
        <Field label="공식 출처 주소" value={binding?.sourceUrl} />
        <Field label="관찰 출처 발행자" value={observation?.publisher} />
        <Field label="관찰 출처 주소" value={observation?.canonicalLocator} />
        <Field label="해시 산출 기준" value={observation?.digestBasis} />
        <Field label="관찰 시각" value={formatDate(observation?.observedAt)} />
        <Field label="카탈로그 출처" value={catalog?.sourceName} />
        <Field label="카탈로그 출처 주소" value={catalog?.sourceUrl} />
      </dl>
      {catalog?.providers?.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold text-[#676f7b] dark:text-[#a7aeba]">식별 근거 제공처</p>
          <div className="mt-2 grid gap-2">
            {catalog.providers.map((provider, index) => (
              <div key={`${provider.provider ?? "provider"}-${index}`} className="rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">
                <span className="font-semibold">{provider.provider ?? "알 수 없음"}</span>
                {provider.locator ? <span className="ml-2 break-all text-[#68717d] dark:text-[#aeb5bf]">{provider.locator}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {observation ? (
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold">고정 관찰 상세</summary>
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
      <h3 className="text-sm font-bold">근거 / 관리 상태</h3>
      {evidence ? (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="후보 상태" value={displayState(evidence.candidateState)} />
            <Field label="근거 분류" value={evidence.evidenceClass} />
            <Field label="권위 수준" value={evidence.evidenceAuthority} />
            <Field label="지지 방향" value={evidence.supportDirection} />
            <Field label="신뢰도" value={evidence.confidence} />
            <Field label="시장 / 언어권" value={[displayMarket(evidence.market), evidence.locale].filter(Boolean).join(" / ")} />
          </dl>
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-semibold">원본 근거 값 보기</summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">{formatJson(evidence.normalizedValue)}</pre>
          </details>
        </>
      ) : (
        <p className="mt-3 text-sm text-[#7a828e] dark:text-[#9ea6b1]">아직 근거 후보가 없습니다.</p>
      )}

      <div className="mt-5 border-t border-[#e6e9ee] pt-5 dark:border-[#303640]">
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#6d7580] dark:text-[#aab1bb]">현재 채택 사실</h4>
        {item.currentFacts.length ? (
          <div className="mt-3 grid gap-2">
            {item.currentFacts.map((fact) => (
              <div key={fact.factInstanceId} className="rounded-xl bg-[#f6f7f9] p-3 text-sm dark:bg-[#20242b]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{displayFact(fact.factKey)}</span>
                  <Badge tone="blue">{displayState(fact.semanticStatus ?? "current")}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#68717d] dark:text-[#aeb5bf]">{formatCurrentValue(fact)} · {displayMarket(fact.market)} · {fact.authorityCeiling ?? "-"}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#7a828e] dark:text-[#9ea6b1]">해당 제품 사실 대상과 사실 항목에 현재 채택된 값이 없습니다.</p>
        )}
      </div>

      <div className="mt-5 border-t border-[#e6e9ee] pt-5 dark:border-[#303640]">
        <h4 className="text-xs font-bold uppercase tracking-[0.08em] text-[#6d7580] dark:text-[#aab1bb]">관리형 검토</h4>
        {item.reviewAssignments.length ? (
          <div className="mt-3 grid gap-2">
            {item.reviewAssignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">
                <span className="font-semibold">{displayState(assignment.operationalState)}</span>
                <span className="ml-2 text-[#68717d] dark:text-[#aeb5bf]">{assignment.reviewPolicyVersion ?? "-"}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#7a828e] dark:text-[#9ea6b1]">아직 관리형 검토 배정이 없습니다.</p>
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
    <div className="min-w-0 grid gap-4">
      <section className="rounded-2xl border border-[#e0e4ea] bg-white p-5 dark:border-[#303640] dark:bg-[#181c22]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#777f8b]">제품 신뢰 검토 항목</p>
            <h2 className="mt-1 text-xl font-bold">{[item.product?.brand, item.product?.name].filter(Boolean).join(" ") || item.task.productId}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="amber">{BLOCKER_LABELS[item.task.blockerCode] || displayState(item.task.state)}</Badge>
            <Badge>{displayState(item.intake?.trustState)}</Badge>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Field label="사실 항목" value={displayFact(item.task.factKey)} />
          <Field label="작업 상태" value={displayState(item.task.state)} />
          <Field label="우선순위" value={item.task.priority} />
          <Field label="카테고리" value={displayCategory(item.intake?.category ?? item.product?.category)} />
          <Field label="시장" value={displayMarket(item.intake?.market)} />
          <Field label="기준 목록" value={displayRegistry(item.task.registryVersion)} />
          <Field label="식별 상태" value={displayState(item.intake?.identityState)} />
          <Field label="제품 사실 대상" value={item.task.subjectId ?? item.intake?.subjectId} />
          <Field label="사유" value={displayState(identityDetail.reason_code ?? item.task.blockerCode)} />
          <Field label="갱신 시각" value={formatDate(item.task.updatedAt)} />
          <Field label="시도 횟수" value={item.task.attemptCount} />
          <Field label="정책" value={item.intake?.requiredFactPolicyVersion} />
        </dl>

        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold">차단 상세</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-[#f6f7f9] p-3 text-xs dark:bg-[#20242b]">{formatJson(item.task.blockerDetail)}</pre>
        </details>
      </section>

      <TrustSubjectRegistrationAction
        taskId={item.task.id}
        intakeMarket={item.intake?.market ?? null}
        eligible={
          item.task.state === "REVIEW_REQUIRED" &&
          item.task.blockerCode === "SUBJECT_CREATION_REQUIRED" &&
          item.intake?.identityState === "SUBJECT_CREATION_REQUIRED" &&
          !item.task.subjectId &&
          !item.intake?.subjectId
        }
        canReview={canReview}
      />
      <TrustReentryAction taskId={item.task.id} canReview={canReview} />
      <SourceSection item={item} />
      <EvidenceSection item={item} />
    </div>
  );
}

function QueueSidebar({ queue, initialSearch = "" }) {
  const [search, setSearch] = useState(initialSearch);
  const filteredItems = useMemo(
    () => queue.items.filter((item) => matchesQueueSearch(item, search)),
    [queue.items, search]
  );

  return (
    <aside className="min-w-0 xl:sticky xl:top-4 xl:self-start">
      <div className="overflow-hidden rounded-2xl border border-[#dfe3e8] bg-[#f7f8fa] dark:border-[#303640] dark:bg-[#14171c]">
        <div className="border-b border-[#dfe3e8] bg-white p-3 dark:border-[#303640] dark:bg-[#181c22]">
          <div className="flex items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="제품명 · 브랜드 · 사실 항목 · 작업 번호 검색"
              aria-label="제품 신뢰 검토 항목 검색"
              autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-[#d8dde5] bg-[#f8f9fb] px-3 py-2.5 text-sm outline-none transition focus:border-[#7c8796] focus:bg-white dark:border-[#3a414c] dark:bg-[#111419] dark:focus:border-[#687381]"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="shrink-0 rounded-xl border border-[#d8dde5] px-3 py-2.5 text-xs font-semibold text-[#59616d] dark:border-[#3a414c] dark:text-[#b6bdc8]"
              >
                지우기
              </button>
            ) : null}
          </div>
          <p className="mt-2 px-1 text-[11px] text-[#7a828e] dark:text-[#9da5b0]">
            검색 결과 <strong>{filteredItems.length}</strong> / 현재 목록 {queue.items.length}
          </p>
        </div>
        <div className="max-h-[calc(100vh-15rem)] overflow-y-auto p-2">
          <QueueList queue={queue} items={filteredItems} search={search} />
        </div>
      </div>
    </aside>
  );
}

export default function TrustQueueWorkbench({
  queue,
  canReview = false,
  initialSearch = ""
}) {
  return (
    <div className="mx-auto w-full max-w-[1500px] min-w-0">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#7a828e]">제품 신뢰 검토 / 제품 사실 운영</p>
          <h1 className="mt-1 text-2xl font-bold">관리자 검토 대기열</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#68717d] dark:text-[#aeb5bf]">
            사람이 판단해야 하는 식별 정보·근거·기준 목록 차단 항목만 표시합니다. 제품 사실 대상 생성이 필요한 항목은 제품 검토 권한이 있는 관리자만 등록할 수 있습니다. 6단계 수동 재검사는 현재 상태를 다시 확인할 뿐, 현재 채택 사실·제품 사실 대상·근거를 강제로 초기화하지 않으며 추천 결과도 변경하지 않습니다.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReview ? (
            <Link
              href="/admin/products/trust/relocations"
              prefetch={false}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
            >
              출처 재연결
            </Link>
          ) : null}
          {canReview ? <Badge tone="amber">검토 가능</Badge> : <Badge tone="blue">읽기 전용</Badge>}
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href={buildHref({ blocker: "all" })}
          prefetch={false}
          className={queue.filter === "all" ? "rounded-full bg-[#171a20] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#eef1f5] dark:text-[#171a20]" : "rounded-full border border-[#dce1e8] px-3 py-1.5 text-xs font-semibold dark:border-[#343a44]"}
        >
          전체 {queue.items.length}
        </Link>
        {queue.visibleBlockers.map((blocker) => (
          <Link
            key={blocker}
            href={buildHref({ blocker })}
            prefetch={false}
            className={queue.filter === blocker ? "rounded-full bg-[#171a20] px-3 py-1.5 text-xs font-semibold text-white dark:bg-[#eef1f5] dark:text-[#171a20]" : "rounded-full border border-[#dce1e8] px-3 py-1.5 text-xs font-semibold dark:border-[#343a44]"}
          >
            {BLOCKER_LABELS[blocker] || blocker} {queue.blockerCounts[blocker] ?? 0}
          </Link>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
        <QueueSidebar queue={queue} initialSearch={initialSearch} />

        <main className="min-w-0 overflow-hidden">
          <Detail item={queue.selected} canReview={canReview} />
        </main>
      </div>
    </div>
  );
}
