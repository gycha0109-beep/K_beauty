"use client";

const STATUS_COPY = {
  ko: {
    maintain: {
      label: "유지하기",
      tone: "border-emerald-300/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
    },
    reduce: {
      label: "강도 줄이기",
      tone: "border-sky-300/35 bg-sky-500/12 text-sky-700 dark:text-sky-200"
    },
    avoid_for_now: {
      label: "당분간 확장 보류",
      tone: "border-amber-300/40 bg-amber-500/14 text-amber-700 dark:text-amber-200"
    },
    kicker: "CONDITION RESPONSE",
    title: "컨디션 대응",
    body: "피부가 흔들리는 날에는 루틴을 더하는 것보다 조정하는 편이 좋을 수 있어요.",
    fallbackTitle: "컨디션 대응 데이터가 아직 없어요",
    fallbackBody: "저장된 구형 리포트에는 컨디션 대응 데이터가 없어 루틴 상담과 기능성 판단을 기준으로 확인해 주세요.",
    reasons: "근거",
    action: "임시 조정",
    cta: "Face Lab 보기"
  },
  en: {
    maintain: {
      label: "Keep",
      tone: "border-emerald-300/35 bg-emerald-500/12 text-emerald-700 dark:text-emerald-200"
    },
    reduce: {
      label: "Reduce intensity",
      tone: "border-sky-300/35 bg-sky-500/12 text-sky-700 dark:text-sky-200"
    },
    avoid_for_now: {
      label: "Hold expansion",
      tone: "border-amber-300/40 bg-amber-500/14 text-amber-700 dark:text-amber-200"
    },
    kicker: "CONDITION RESPONSE",
    title: "Condition response",
    body: "On unstable skin days, adjusting the routine can matter more than adding more.",
    fallbackTitle: "Condition response is not available yet",
    fallbackBody: "This saved report does not include condition response data, so use the routine consult and active goal check instead.",
    reasons: "Why",
    action: "Temporary adjustment",
    cta: "Open Face Lab"
  }
};

function getCopy(locale) {
  return locale === "en" ? STATUS_COPY.en : STATUS_COPY.ko;
}

function statusRank(status) {
  return { maintain: 0, reduce: 1, avoid_for_now: 2 }[status] ?? 1;
}

function sanitizeResponse(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const responseKey = String(item.responseKey || "").trim();
  const status = String(item.status || "").trim();
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const summary = typeof item.summary === "string" ? item.summary.trim() : "";

  if (!responseKey || !["maintain", "reduce", "avoid_for_now"].includes(status) || !title || !summary) {
    return null;
  }

  return {
    responseKey,
    status,
    title,
    summary,
    reasons: Array.isArray(item.reasons)
      ? item.reasons
          .map((reason) => (typeof reason === "string" ? reason.trim() : ""))
          .filter(Boolean)
          .slice(0, 2)
      : [],
    action: typeof item.action === "string" && item.action.trim() ? item.action.trim() : null
  };
}

export default function PremiumConditionResponseSection({ responses = [], locale = "ko", onNavigate }) {
  const copy = getCopy(locale);
  const items = (Array.isArray(responses) ? responses : [])
    .map(sanitizeResponse)
    .filter(Boolean)
    .sort((left, right) => statusRank(left.status) - statusRank(right.status))
    .slice(0, 5);

  return (
    <section className="ui-card p-5 sm:p-6">
      <div className="min-w-0">
        <p className="ui-kicker">{copy.kicker}</p>
        <h3 className="ui-title mt-2 text-xl leading-tight">{copy.title}</h3>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
      </div>

      {items.length ? (
        <div className="mt-5 grid gap-3">
          {items.map((item) => {
            const statusCopy = copy[item.status] || copy.reduce;

            return (
              <article
                key={item.responseKey}
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
                <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {item.summary}
                </p>
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
                {item.action ? (
                  <p className="mt-3 rounded-[0.85rem] border border-white/10 bg-white/5 px-3 py-2 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{copy.action} · </span>
                    {item.action}
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
        onClick={() => onNavigate?.("face-lab")}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#e87662_0%,#f2aa91_100%)] px-4 text-sm font-semibold text-white shadow-[0_16px_34px_rgba(215,111,91,0.22)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2aa91]/70 sm:w-auto"
      >
        {copy.cta}
        <span className="ml-2" aria-hidden="true">&rarr;</span>
      </button>
    </section>
  );
}
