export default function ResultOverviewStep({
  copy,
  photoUrl,
  photoAlt,
  summaryCards,
  overviewSummary,
  faceLabPreview = null,
  photoObservations = null,
  locale = "ko"
}) {
  const hasFaceLabPreview = Boolean(faceLabPreview?.primary || faceLabPreview?.keywords?.length);
  const isEnglish = copy.resultOverviewTitle === "Your Result";
  const photoSummary = String(photoObservations?.summary || "").trim();
  const photoSignals = Array.isArray(photoObservations?.signals)
    ? photoObservations.signals
        .map((signal) => {
          const label = String(signal?.label || "").trim();
          const area = String(signal?.area || "").trim();
          return label && area ? `${label} · ${area}` : label || area;
        })
        .filter(Boolean)
        .slice(0, 2)
    : [];
  const showPhotoObservation = Boolean(photoSummary || photoSignals.length);

  return (
    <section className="w-full max-w-full overflow-hidden rounded-[2.15rem] border border-[#f1d9d3] bg-[#fff1f1] p-5 shadow-[0_26px_80px_rgba(52,20,35,0.16)] dark:border-[#4a303c] dark:bg-[#21151d] sm:p-6">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-sm font-semibold text-[#2b101b] shadow-[0_12px_26px_rgba(52,20,35,0.08)] dark:bg-[#301f28] dark:text-[#fff7f2]">
          01
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7e5261] dark:text-[#c7aeb8]">
            {isEnglish ? "Diagnosis Summary" : "진단 요약"}
          </p>
          <h1 className="mt-1 text-[1.9rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff7f2] sm:text-[2.15rem]">{copy.resultOverviewTitle}</h1>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] gap-3 sm:grid-cols-[minmax(160px,0.9fr)_minmax(0,1.1fr)] sm:gap-4">
        <div className="flex aspect-[4/5] h-full min-h-[176px] min-w-0 items-center justify-center overflow-hidden rounded-[1.45rem] border border-[#ead2cf] bg-white/70 dark:border-[#5a3a48] dark:bg-[#2a1b24] sm:min-h-[210px] sm:rounded-[1.55rem]">
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

        <div className="grid min-w-0 max-w-full content-start gap-1.5 sm:gap-2">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="min-w-0 w-[90%] justify-self-end rounded-[1.2rem] border border-[#ead9d6] bg-white/70 px-2.5 py-2 dark:border-[#5a3a48] dark:bg-[#301f28] sm:w-full sm:rounded-full sm:px-4 sm:py-3"
            >
              <p className="text-[8px] font-semibold uppercase tracking-[0.08em] text-[#8b6370] dark:text-[#c7aeb8] sm:text-[10px] sm:tracking-[0.15em]">{card.label}</p>
              <p className="mt-0.5 whitespace-normal break-words text-[12px] font-semibold leading-snug text-[#26101a] dark:text-[#fff7f2] sm:mt-1 sm:text-sm">{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {hasFaceLabPreview ? (
        <div className="mt-4 rounded-[1.35rem] border border-[#ead9d6] bg-white/50 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#c7aeb8]">
            {faceLabPreview.label}
          </p>
          {faceLabPreview.primary ? (
            <p className="mt-2 text-lg font-semibold tracking-tight text-[#26101a] dark:text-[#fff7f2]">{faceLabPreview.primary}</p>
          ) : null}
          {faceLabPreview.keywords?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {faceLabPreview.keywords.map((keyword) => (
                <span key={keyword} className="rounded-full border border-[#ead9d6] bg-white/70 px-3 py-1.5 text-[11px] font-medium text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 rounded-[1.35rem] border border-[#ead9d6] bg-white/40 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#c7aeb8]">{copy.recommendationDirection}</p>
        <p className="mt-2.5 text-sm leading-6 text-[#3a1824] dark:text-[#f2e2df]">{overviewSummary}</p>
      </div>

      {showPhotoObservation ? (
        <div className="mt-4 rounded-[1.35rem] border border-[#ead9d6] bg-white/40 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#c7aeb8]">
            {locale === "en" ? "Photo-based read" : "사진 기준 관찰"}
          </p>
          {photoSummary ? (
            <p className="mt-2.5 text-sm leading-6 text-[#3a1824] dark:text-[#f2e2df]">{photoSummary}</p>
          ) : null}
          {photoSignals.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {photoSignals.map((signal) => (
                <span key={signal} className="rounded-full border border-[#ead9d6] bg-white/70 px-3 py-1.5 text-[11px] font-medium text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {signal}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
