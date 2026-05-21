export default function ResultOverviewStep({
  copy,
  photoUrl,
  photoAlt,
  summaryCards,
  matchSummary = null,
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
  const routineHighlights = Array.isArray(matchSummary?.routineHighlights)
    ? matchSummary.routineHighlights.slice(0, 2)
    : [];
  const concerns = Array.isArray(matchSummary?.concerns) ? matchSummary.concerns.slice(0, 3) : [];
  const matchScore = typeof matchSummary?.score === "number" ? matchSummary.score : null;

  return (
    <section className="w-full max-w-full overflow-hidden rounded-[2.15rem] border border-[#f1d9d3] bg-[linear-gradient(145deg,#fff6f1_0%,#fff0ef_58%,#ffe6e9_100%)] p-5 shadow-[0_26px_80px_rgba(52,20,35,0.16)] dark:border-[#4a303c] dark:bg-[linear-gradient(145deg,#241720_0%,#21151d_55%,#2d1d28_100%)] sm:p-6">
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

      <div className="mt-5 grid min-w-0 gap-4">
        <div className="relative order-2 mx-auto flex aspect-[4/5] min-h-[196px] w-full max-w-[260px] items-center justify-center overflow-hidden rounded-[1.55rem] border border-[#ead2cf] bg-white/70 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
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
          <span className="pointer-events-none absolute left-4 top-4 h-5 w-5 border-l border-t border-white/80 dark:border-[#ffd4d6]/70" />
          <span className="pointer-events-none absolute right-4 top-4 h-5 w-5 border-r border-t border-white/80 dark:border-[#ffd4d6]/70" />
          <span className="pointer-events-none absolute bottom-4 left-4 h-5 w-5 border-b border-l border-white/80 dark:border-[#ffd4d6]/70" />
          <span className="pointer-events-none absolute bottom-4 right-4 h-5 w-5 border-b border-r border-white/80 dark:border-[#ffd4d6]/70" />
        </div>

        <div className="order-1 min-w-0 overflow-hidden rounded-[1.55rem] border border-[#ead9d6] bg-[linear-gradient(145deg,rgba(255,255,255,0.68),rgba(255,239,237,0.58))] p-4 dark:border-[#5a3a48] dark:bg-[linear-gradient(145deg,rgba(48,31,40,0.96),rgba(37,24,32,0.96))]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8b6370] dark:text-[#c7aeb8]">
            {isEnglish ? "Core match" : "핵심 매치"}
          </p>
          <h2 className="mt-2 break-keep text-[1.45rem] font-semibold leading-[1.18] tracking-tight text-[#26101a] dark:text-[#fff7f2] sm:text-[1.6rem]">
            {matchSummary?.matchLabel || summaryCards?.[0]?.value || copy.resultOverviewTitle}
          </h2>

          <div className="mt-4 grid grid-cols-[0.9fr_1.1fr] gap-2.5">
            <div className="rounded-[1.15rem] border border-[#ead9d6] bg-[#fff8f3]/78 px-3 py-3 dark:border-[#5a3a48] dark:bg-[#301f28]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b6370] dark:text-[#c7aeb8]">
                {matchScore !== null ? (isEnglish ? "Top score" : "매치 점수") : (isEnglish ? "Core match" : "핵심 매치")}
              </p>
              <p className="mt-2 text-2xl font-semibold leading-none text-[#e6507a] dark:text-[#ff9aa8]">
                {matchScore !== null ? matchScore : "Top"}
              </p>
            </div>
            <div className="rounded-[1.15rem] border border-[#ead9d6] bg-[#fff8f3]/78 px-3 py-3 dark:border-[#5a3a48] dark:bg-[#301f28]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8b6370] dark:text-[#c7aeb8]">
                {isEnglish ? "Skin type" : "대표 피부"}
              </p>
              <p className="mt-2 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff7f2]">
                {matchSummary?.skinTypeLabel || summaryCards?.[0]?.value}
              </p>
            </div>
          </div>

          {concerns.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {concerns.map((concern) => (
                <span key={concern} className="rounded-full border border-[#ead9d6] bg-white/72 px-3 py-1.5 text-[11px] font-medium text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {concern}
                </span>
              ))}
            </div>
          ) : null}

          {routineHighlights.length ? (
            <div className="mt-3 space-y-2">
              {routineHighlights.map((item) => (
                <div key={item.key} className="grid grid-cols-[3.4rem_minmax(0,1fr)] gap-2 rounded-[1rem] border border-[#ead9d6] bg-white/46 px-3 py-2.5 dark:border-[#5a3a48] dark:bg-[#251820]">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#e6507a] dark:text-[#ff9aa8]">{item.label}</span>
                  <span className="text-xs font-medium leading-5 text-[#3a1824] dark:text-[#f2e2df]">{item.body}</span>
                </div>
              ))}
            </div>
          ) : null}
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

      <div className="mt-4 grid gap-3">
        <div className="rounded-[1.25rem] border border-[#ead9d6] bg-white/34 p-3.5 dark:border-[#5a3a48] dark:bg-[#2a1b24]/88">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7e5261] dark:text-[#c7aeb8]">{copy.recommendationDirection}</p>
          <p className="mt-2 text-sm leading-5 text-[#3a1824] dark:text-[#f2e2df]">{overviewSummary}</p>
        </div>

        {showPhotoObservation ? (
          <div className="rounded-[1.25rem] border border-[#ead9d6] bg-white/28 p-3.5 dark:border-[#5a3a48] dark:bg-[#2a1b24]/74">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8f6672] dark:text-[#bfa8b1]">
              {locale === "en" ? "Photo-based read" : "사진 기준 관찰"}
            </p>
            {photoSummary ? (
              <p className="mt-2 text-xs leading-5 text-[#6f4a56] dark:text-[#d8c2c9]">{photoSummary}</p>
            ) : null}
            {photoSignals.length ? (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {photoSignals.map((signal) => (
                  <span key={signal} className="rounded-full border border-[#ead9d6] bg-white/58 px-2.5 py-1 text-[10px] font-medium text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
                    {signal}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
