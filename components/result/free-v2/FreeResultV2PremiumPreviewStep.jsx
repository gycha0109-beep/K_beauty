"use client";

function FreeResultV2PremiumPreviewLead({ title, body }) {
  return (
    <section className="rounded-[2rem] border border-[#ead9d6] bg-transparent p-1 dark:border-[#4a303c]">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.92] text-sm font-semibold text-[#2b101b] shadow-[0_14px_30px_rgba(0,0,0,0.18)] dark:bg-[#301f28] dark:text-[#fff7f2]">
          05
        </span>
        <div className="min-w-0">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff7f2] sm:text-[2rem]">{title}</h2>
        </div>
      </div>
      {body ? <p className="ui-text-secondary mt-2 text-sm leading-6">{body}</p> : null}
    </section>
  );
}

function ResultPreviewMaskCard({ copy, sections = [], ctaLabel = "", onCtaClick = null }) {
  const visibleSections = Array.isArray(sections)
    ? sections
        .map((section) => ({
          ...section,
          body: String(section?.body || "").trim()
        }))
        .filter((section) => section.title && section.body)
    : [];

  if (!visibleSections.length) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(120,70,70,0.14)] bg-[linear-gradient(145deg,#fff4ef_0%,#f6ece8_52%,#ffe1e5_100%)] p-5 text-[#28121b] shadow-[0_24px_70px_rgba(79,36,50,0.13)] dark:border-[#704557] dark:bg-[linear-gradient(135deg,#341f2c_0%,#2a1823_58%,#241720_100%)] dark:text-[#fff8f3] dark:shadow-[0_28px_80px_rgba(18,10,16,0.34)]">
      <div className="space-y-5">
        <div className="rounded-[1.6rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/70 p-5 text-center dark:border-[#704557] dark:bg-[#2a1823]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#ff9aa8]/45 bg-white/58 text-2xl text-[#ff8068] shadow-[0_0_28px_rgba(255,128,104,0.22)] dark:bg-[#301f28]">
            ✓
          </div>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(120,70,70,0.18)] bg-[#fff8f3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a3344] dark:border-[#704557] dark:bg-[#301f28] dark:text-[#f2c879]">
            Premium Report
          </span>
          <p className="mt-3 text-lg font-semibold tracking-tight text-[#28121b] dark:text-[#fff8f3]">{copy.routinePreviewTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
            {copy.premiumCardBody}
          </p>
        </div>

        <div className="grid gap-3">
          {visibleSections.map((section, index) => (
            <div
              key={section.key || section.title}
              className="rounded-[1.25rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/72 px-4 py-3.5 dark:border-[#704557] dark:bg-[#2a1823]"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#ead0c8] text-[11px] font-semibold text-[#6a3344] dark:bg-white/10 dark:text-white/80">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{section.title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{section.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {ctaLabel && onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="ui-button-primary min-h-14 w-full bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] px-5 text-sm font-semibold !text-white shadow-[0_16px_34px_rgba(232,96,116,0.28)] hover:opacity-95"
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function FreeResultV2PremiumPreviewStep({ copy, sections = [], onFullReportClick = null }) {
  return (
    <section className="space-y-4">
      <FreeResultV2PremiumPreviewLead
        title={copy.premiumPreviewTitle}
        body={null}
      />

      <ResultPreviewMaskCard
        copy={copy}
        sections={sections}
        ctaLabel={copy.premiumCardButton}
        onCtaClick={onFullReportClick}
      />
    </section>
  );
}
