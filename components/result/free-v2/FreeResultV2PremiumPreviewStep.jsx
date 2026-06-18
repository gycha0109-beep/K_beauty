"use client";

const PREMIUM_REPORT_COMING_SOON_COPY = {
  ko: {
    title: "Skin Match 유료 리포트 준비 중입니다",
    body: "아침·저녁 루틴, 기능성 판단, 컨디션 대응까지 한 번에 볼 수 있는 퍼스널 피부 상담 맵을 정리하고 있어요.",
    button: "곧 공개 예정",
    developerButton: "개발자용 유료 리포트 열기",
    developerNote: "개발환경에서만 노출됩니다.",
    itemsTitle: "유료 리포트에서 확인할 수 있는 것",
    items: ["아침·저녁 루틴 제안", "기능성 제품 판단", "컨디션 대응 가이드", "Face Lab 스타일 제안"]
  },
  en: {
    title: "Skin Match paid report is coming soon",
    body: "We are organizing a personal skin consultation map that brings morning and evening routine, active checks, and condition responses together.",
    button: "Coming soon",
    developerButton: "Open paid report for development",
    developerNote: "Only shown in development.",
    itemsTitle: "What the paid report will include",
    items: ["Morning and evening routine", "Active product checks", "Condition response guide", "Face Lab style direction"]
  }
};

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

function ResultPreviewMaskCard({
  comingSoonCopy,
  premiumReportEnabled = false,
  isDevelopment = false,
  onDeveloperFullReportClick = null
}) {
  const showDeveloperEntry = isDevelopment && premiumReportEnabled && onDeveloperFullReportClick;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(120,70,70,0.14)] bg-[linear-gradient(145deg,#fff4ef_0%,#f6ece8_52%,#ffe1e5_100%)] p-5 text-[#28121b] shadow-[0_24px_70px_rgba(79,36,50,0.13)] dark:border-[#704557] dark:bg-[linear-gradient(135deg,#341f2c_0%,#2a1823_58%,#241720_100%)] dark:text-[#fff8f3] dark:shadow-[0_28px_80px_rgba(18,10,16,0.34)]">
      <div className="space-y-5">
        <div className="rounded-[1.6rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/70 p-5 text-center dark:border-[#704557] dark:bg-[#2a1823]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#ff9aa8]/45 bg-white/58 text-2xl text-[#ff8068] shadow-[0_0_28px_rgba(255,128,104,0.22)] dark:bg-[#301f28]">
            ✦
          </div>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(120,70,70,0.18)] bg-[#fff8f3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a3344] dark:border-[#704557] dark:bg-[#301f28] dark:text-[#f2c879]">
            Premium Report
          </span>
          <p className="mt-3 text-lg font-semibold tracking-tight text-[#28121b] dark:text-[#fff8f3]">{comingSoonCopy.title}</p>
          <p className="mt-2 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
            {comingSoonCopy.body}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/72 p-4 dark:border-[#704557] dark:bg-[#2a1823]">
          <p className="text-center text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{comingSoonCopy.itemsTitle}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {comingSoonCopy.items.map((item, index) => (
              <div key={item} className="border-l border-[rgba(120,70,70,0.16)] px-3 first:border-l-0 odd:first:border-l-0 dark:border-[#704557]">
                <span className="block text-[11px] font-semibold text-[#e96b93] dark:text-[#ff9aa8]">{String(index + 1).padStart(2, "0")}</span>
                <p className="mt-1 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-[1.5rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/72 p-4 dark:border-[#704557] dark:bg-[#2a1823]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/45 text-xs font-semibold text-[#e96b93]">
              i
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{comingSoonCopy.button}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{comingSoonCopy.body}</p>
            </div>
          </div>
          <button
            type="button"
            disabled
            className="ui-button-primary min-h-14 w-full cursor-not-allowed bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] px-5 text-sm font-semibold !text-white opacity-80 shadow-[0_16px_34px_rgba(232,96,116,0.20)]"
          >
            {comingSoonCopy.button}
          </button>
        </div>

        {showDeveloperEntry ? (
          <button
            type="button"
            onClick={onDeveloperFullReportClick}
            className="w-full rounded-[1.25rem] border border-dashed border-[rgba(120,70,70,0.26)] bg-transparent px-4 py-4 text-left transition hover:bg-white/35 dark:border-[#704557] dark:hover:bg-white/5"
          >
            <span className="inline-flex rounded-full border border-[rgba(120,70,70,0.18)] bg-[#fff8f3] px-2.5 py-1 text-[10px] font-semibold text-[#6a3344] dark:border-[#704557] dark:bg-[#301f28] dark:text-[#f2c879]">
              development
            </span>
            <span className="mt-3 block text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">
              {comingSoonCopy.developerButton}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">
              {comingSoonCopy.developerNote}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

// TODO(premium-report-release):
// 유료 Skin Match 리포트가 완성되면 이 Step5 준비 중 상태를 실제 유료 전환 CTA로 교체한다.
// 현재는 production에서 유료 리포트 진입을 막고, development에서만 내부 확인용 진입을 허용한다.
// 공개 전환 시 확인할 것:
// 1. NEXT_PUBLIC_PREMIUM_REPORT_ENABLED=true 설정
// 2. 결제/권한 확인 플로우 연결
// 3. 준비 중 카피 제거
// 4. 개발자용 진입 버튼 제거
// 5. /result/full-report 직접 접근 권한 검증
export default function FreeResultV2PremiumPreviewStep({
  copy,
  premiumReportEnabled = false,
  locale = "ko",
  isDevelopment = false,
  onDeveloperFullReportClick = null
}) {
  const comingSoonCopy = PREMIUM_REPORT_COMING_SOON_COPY[locale] || PREMIUM_REPORT_COMING_SOON_COPY.ko;

  return (
    <section className="space-y-4">
      <FreeResultV2PremiumPreviewLead
        title={copy.premiumPreviewTitle}
        body={null}
      />

      <ResultPreviewMaskCard
        comingSoonCopy={comingSoonCopy}
        premiumReportEnabled={premiumReportEnabled}
        isDevelopment={isDevelopment}
        onDeveloperFullReportClick={onDeveloperFullReportClick}
      />
    </section>
  );
}
