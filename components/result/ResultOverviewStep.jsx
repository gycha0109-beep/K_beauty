export default function ResultOverviewStep({
  copy,
  photoUrl,
  photoAlt,
  summaryCards,
  overviewSummary
}) {
  return (
    <section className="space-y-3">
      <div className="ui-card p-5">
        <p className="ui-kicker">{copy.resultOverviewKicker}</p>
        <h1 className="ui-title mt-2 text-[1.75rem] sm:text-[1.9rem]">{copy.resultOverviewTitle}</h1>
        {copy.resultOverviewBody ? (
          <p className="ui-text-secondary mt-1.5 text-sm leading-6">{copy.resultOverviewBody}</p>
        ) : null}
      </div>

      <div className="ui-card overflow-hidden p-0">
        {photoUrl ? (
          <div className="flex h-[224px] items-start justify-center bg-[linear-gradient(180deg,#f4f4f5_0%,#ffffff_100%)] p-3 dark:bg-[linear-gradient(180deg,#18181b_0%,#111114_100%)]">
            <img
              src={photoUrl}
              alt={photoAlt}
              className="h-full w-full rounded-[1.4rem] object-contain object-top"
            />
          </div>
        ) : (
          <div className="flex h-[224px] items-center justify-center bg-[linear-gradient(135deg,#f4f4f5_0%,#ffffff_100%)] px-6 text-center dark:bg-[linear-gradient(135deg,#18181b_0%,#111114_100%)]">
            <div className="flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-zinc-200 bg-white/70 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500">
                <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{copy.resultPhotoFallback}</p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">{copy.imagePreparing}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2.5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="ui-card-muted p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{card.label}</p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="ui-panel-accent p-5 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{copy.recommendationDirection}</p>
        <p className="mt-2.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{overviewSummary}</p>
      </div>
    </section>
  );
}
