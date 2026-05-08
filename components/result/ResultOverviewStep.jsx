export default function ResultOverviewStep({
  copy,
  photoUrl,
  photoAlt,
  summaryCards,
  overviewSummary,
  faceLabPreview = null
}) {
  const hasFaceLabPreview = Boolean(faceLabPreview?.primary || faceLabPreview?.keywords?.length);

  return (
    <section className="ui-card overflow-hidden p-5">
      <p className="ui-kicker">{copy.resultOverviewKicker}</p>
      <h1 className="ui-title mt-2 text-[1.75rem] leading-tight sm:text-[1.9rem]">{copy.resultOverviewTitle}</h1>

      <div className="mt-5 grid grid-cols-[minmax(118px,0.9fr)_minmax(0,1.1fr)] gap-3">
        <div className="ui-image-surface flex aspect-[4/5] h-full min-h-[190px] items-center justify-center overflow-hidden rounded-[1.5rem]">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={photoAlt}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center px-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.1rem] border border-zinc-200 bg-white/70 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500">
                <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
                </svg>
              </div>
              <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">{copy.resultPhotoFallback}</p>
            </div>
          )}
        </div>

        <div className="grid min-w-0 content-start gap-2">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="ui-card-muted px-3 py-2.5"
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-zinc-500 dark:text-zinc-400">{card.label}</p>
              <p className="mt-1 break-words text-[13px] font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {hasFaceLabPreview ? (
        <div className="ui-card-muted mt-3 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {faceLabPreview.label}
          </p>
          {faceLabPreview.primary ? (
            <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{faceLabPreview.primary}</p>
          ) : null}
          {faceLabPreview.keywords?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {faceLabPreview.keywords.map((keyword) => (
                <span key={keyword} className="ui-chip-compact px-3 py-1.5">
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="ui-panel-accent mt-3 p-4 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{copy.recommendationDirection}</p>
        <p className="mt-2.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{overviewSummary}</p>
      </div>
    </section>
  );
}
