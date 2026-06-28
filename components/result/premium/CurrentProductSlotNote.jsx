const verdictToneClass = {
  keep: "border-emerald-300/40 bg-emerald-500/[0.08] text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/[0.08] dark:text-emerald-200",
  adjust: "border-amber-300/45 bg-amber-400/[0.09] text-amber-800 dark:border-amber-300/25 dark:bg-amber-300/[0.08] dark:text-amber-100",
  hold: "border-rose-300/45 bg-rose-400/[0.09] text-rose-800 dark:border-rose-300/25 dark:bg-rose-300/[0.08] dark:text-rose-100",
  check_needed: "border-zinc-300/55 bg-zinc-500/[0.07] text-zinc-700 dark:border-zinc-600/70 dark:bg-white/[0.04] dark:text-zinc-200"
};

const verdictLabels = {
  ko: {
    keep: "유지",
    adjust: "조정",
    hold: "잠시 쉬기",
    check_needed: "확인 필요"
  },
  en: {
    keep: "Keep",
    adjust: "Adjust",
    hold: "Pause",
    check_needed: "Check needed"
  }
};

function CurrentProductVerdictNote({ verdict, locale = "ko" }) {
  if (!verdict) {
    return null;
  }

  const labels = verdictLabels[locale === "en" ? "en" : "ko"];
  const label = labels[verdict.status] || labels.check_needed;
  const tone = verdictToneClass[verdict.status] || verdictToneClass.check_needed;

  return (
    <div className="mt-2 rounded-[0.65rem] border border-white/10 bg-white/[0.04] p-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-4 ${tone}`}>
          {label}
        </span>
        {verdict.title ? (
          <span className="min-w-0 flex-1 break-words text-[10px] font-semibold leading-4 text-zinc-700 dark:text-zinc-200">
            {verdict.title}
          </span>
        ) : null}
      </div>
      {verdict.summary ? (
        <p className="mt-1.5 break-words text-[10px] leading-4 text-zinc-600 dark:text-zinc-300">{verdict.summary}</p>
      ) : null}
      {verdict.adjustment ? (
        <p className="mt-1 break-words text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
          {locale === "en" ? "Adjust: " : "조정: "}
          {verdict.adjustment}
        </p>
      ) : null}
    </div>
  );
}

export default function CurrentProductSlotNote({ items = [], compact = false, getVerdict, locale = "ko" }) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  const toneClass = {
    positive: "border-[#e7b49f]/35 bg-[#e87662]/[0.07] text-[#6f342f] dark:border-[#e7b49f]/25 dark:bg-[#e87662]/[0.09] dark:text-[#f2c5b6]",
    neutral: "border-white/10 bg-white/[0.035] text-zinc-700 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-300",
    warning: "border-[#f0a9a3]/40 bg-[#f07167]/[0.08] text-[#893f3b] dark:border-[#f0a9a3]/28 dark:bg-[#f07167]/10 dark:text-[#f3b8b2]",
    empty: "border-zinc-300/45 bg-zinc-500/[0.07] text-zinc-600 dark:border-zinc-700/75 dark:bg-white/[0.03] dark:text-zinc-300"
  };

  return (
    <div className={`${compact ? "mt-2" : "mt-2.5"} grid gap-2`}>
      {items.map((item) => {
        const productLine = [item.brandName, item.productName].filter(Boolean).join(" - ");
        const verdict = typeof getVerdict === "function" ? getVerdict(item) : null;

        return (
          <div
            key={`${item.category}-${item.slot}-${item.status}-${productLine || item.helperText}`}
            className={`min-w-0 rounded-[0.72rem] border px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${toneClass[item.severity] || toneClass.neutral}`}
          >
            <p className="text-[10px] font-semibold leading-4 text-zinc-500 dark:text-zinc-400">{item.label}</p>
            {productLine ? (
              <p className="mt-0.5 break-words text-xs font-semibold leading-5">{productLine}</p>
            ) : null}
            {item.helperText ? (
              <p className="mt-0.5 break-words text-[10px] leading-4 opacity-72">{item.helperText}</p>
            ) : null}
            <CurrentProductVerdictNote verdict={verdict} locale={locale} />
          </div>
        );
      })}
    </div>
  );
}
