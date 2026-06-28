"use client";

const STATUS_COPY = {
  ko: {
    now: {
      label: "지금 시작",
      tone: "border-emerald-300/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
    },
    later: {
      label: "안정 후 검토",
      tone: "border-sky-300/35 bg-sky-500/12 text-sky-700 dark:text-sky-200"
    },
    pause: {
      label: "당분간 보류",
      tone: "border-amber-300/40 bg-amber-500/14 text-amber-700 dark:text-amber-200"
    },
    kicker: "FUNCTIONAL DECISION",
    title: "기능성 판단",
    body: "지금 피부 상태에서 무엇을 먼저 다뤄야 하는지 정리했어요.",
    fallbackTitle: "기능성 판단이 아직 준비되지 않았어요",
    fallbackBody: "저장된 구형 리포트에는 기능성 목표 판단 데이터가 없어 루틴 상담과 컨디션 대응을 기준으로 확인해 주세요.",
    reasons: "근거",
    nextAction: "다음 행동",
    cta: "컨디션 대응 보기"
  },
  en: {
    now: {
      label: "Start now",
      tone: "border-emerald-300/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
    },
    later: {
      label: "Review after stable",
      tone: "border-sky-300/35 bg-sky-500/12 text-sky-700 dark:text-sky-200"
    },
    pause: {
      label: "Pause for now",
      tone: "border-amber-300/40 bg-amber-500/14 text-amber-700 dark:text-amber-200"
    },
    kicker: "FUNCTIONAL DECISION",
    title: "Active goal check",
    body: "This organizes which skin goals fit the current condition first.",
    fallbackTitle: "Active goal check is not available yet",
    fallbackBody: "This saved report does not include functional decision data, so use the routine consult and condition guide instead.",
    reasons: "Why",
    nextAction: "Next action",
    cta: "Open condition guide"
  }
};

function getCopy(locale) {
  return locale === "en" ? STATUS_COPY.en : STATUS_COPY.ko;
}

function statusRank(status) {
  return { now: 0, later: 1, pause: 2 }[status] ?? 1;
}

function sanitizeDecision(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const goalKey = String(item.goalKey || "").trim();
  const status = String(item.status || "").trim();

  if (!goalKey || !["now", "later", "pause"].includes(status)) {
    return null;
  }

  return {
    goalKey,
    status,
    title: String(item.title || "").trim(),
    summary: String(item.summary || "").trim(),
    reasons: Array.isArray(item.reasons)
      ? item.reasons.map((reason) => String(reason || "").trim()).filter(Boolean).slice(0, 2)
      : [],
    nextAction: item.nextAction ? String(item.nextAction).trim() : null
  };
}

export default function PremiumFunctionalDecisionSection({ decisions = [], locale = "ko", onNavigate }) {
  const copy = getCopy(locale);
  const items = (Array.isArray(decisions) ? decisions : [])
    .map(sanitizeDecision)
    .filter(Boolean)
    .sort((left, right) => statusRank(left.status) - statusRank(right.status))
    .slice(0, 5);

  return (
    <section className="ui-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-kicker">{copy.kicker}</p>
          <h3 className="ui-title mt-2 text-xl leading-tight">{copy.title}</h3>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
        </div>
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-3">
          {items.map((item) => {
            const statusCopy = copy[item.status] || copy.later;

            return (
              <article
                key={item.goalKey}
                className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`max-w-full rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-5 ${statusCopy.tone}`}>
                    {statusCopy.label}
                  </span>
                  <h4 className="min-w-0 flex-1 text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </h4>
                </div>
                {item.summary ? (
                  <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {item.summary}
                  </p>
                ) : null}
                {item.reasons.length ? (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                      {copy.reasons}
                    </p>
                    {item.reasons.map((reason) => (
                      <p key={reason} className="text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                        {reason}
                      </p>
                    ))}
                  </div>
                ) : null}
                {item.nextAction ? (
                  <p className="mt-3 rounded-[0.85rem] border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{copy.nextAction} · </span>
                    {item.nextAction}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-[1rem] border border-white/10 bg-white/5 px-4 py-4">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{copy.fallbackTitle}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{copy.fallbackBody}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onNavigate?.("adjustment-guide")}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#e87662_0%,#f2aa91_100%)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(215,111,91,0.22)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2aa91]/70 sm:w-auto"
      >
        {copy.cta}
        <span className="ml-2" aria-hidden="true">&rarr;</span>
      </button>
    </section>
  );
}
