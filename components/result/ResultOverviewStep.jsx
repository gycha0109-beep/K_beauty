export default function ResultOverviewStep({
  copy,
  photoUrl,
  photoAlt,
  summaryCards,
  overviewSummary
}) {
  return (
    <section className="space-y-3">
      <div className="rounded-[1.9rem] border border-black/5 bg-white/88 p-5 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.resultOverviewKicker}
        </p>
        <h1 className="mt-2 text-[1.75rem] font-semibold tracking-tight text-ink sm:text-[1.9rem]">
          {copy.resultOverviewTitle}
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-black/58">
          {copy.resultOverviewBody}
        </p>
      </div>

      <div className="overflow-hidden rounded-[1.9rem] border border-black/5 bg-white/88 shadow-soft">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={photoAlt}
            className="h-[224px] w-full bg-[#f8f1e8] object-cover"
          />
        ) : (
          <div className="flex h-[224px] items-center justify-center bg-[linear-gradient(135deg,#f5ede3_0%,#fffaf4_100%)] px-6 text-center">
            <div className="flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-black/6 bg-white/70 text-black/28">
                <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
                  <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
                </svg>
              </div>
              <p className="mt-3 text-sm font-medium text-black/58">{copy.resultPhotoFallback}</p>
              <p className="mt-1 text-[11px] text-black/38">{copy.imagePreparing}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-2.5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-[1.45rem] border border-black/5 bg-white/88 p-4 shadow-soft"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/38">
              {card.label}
            </p>
            <p className="mt-2 text-base font-semibold text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[1.7rem] border border-black/5 bg-[linear-gradient(135deg,#f6efe7_0%,#fff9f2_100%)] p-5 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-black/38">
          {copy.recommendationDirection}
        </p>
        <p className="mt-2.5 text-sm leading-6 text-black/74">{overviewSummary}</p>
      </div>
    </section>
  );
}
