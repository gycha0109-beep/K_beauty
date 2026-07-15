"use client";

const PREMIUM_REPORT_BETA_COPY = {
  ko: {
    title: "Skin Match 프리미엄 리포트를 베타 체험으로 먼저 이용해보세요",
    body: "아침·저녁 루틴, 기능성 판단, 컨디션 대응, Face Lab 스타일 제안까지 내 현재 상태에 맞춰 정리합니다.",
    button: "이 결과를 루틴으로 정리하기",
    developerButton: "개발자용 프리미엄 리포트 열기",
    developerNote: "개발환경에서만 노출합니다.",
    itemsTitle: "프리미엄 베타에서 정리하는 것",
    items: ["아침·저녁 루틴", "기능성 판단", "컨디션 대응", "Face Lab 스타일 제안"]
  },
  en: {
    title: "Try the Skin Match premium report in beta",
    body: "It organizes morning and evening routine, active checks, condition responses, and Face Lab style direction around your current skin context.",
    button: "Turn this result into a routine",
    developerButton: "Open premium report for development",
    developerNote: "Only shown in development.",
    itemsTitle: "What premium beta organizes",
    items: ["Morning and evening routine", "Active product checks", "Condition response guide", "Face Lab style direction"]
  }
};

const PREMIUM_REPORT_REENTRY_COPY = {
  ko: {
    title: "완성된 Skin Match 플랜이 있어요",
    body: "방금 만든 풀리포트를 다시 보거나, 현재 제품 기준으로 새로 만들 수 있어요.",
    open: "풀리포트 다시 보기",
    create: "새 풀리포트 만들기"
  },
  en: {
    title: "Your Skin Match plan is ready",
    body: "Reopen the full report you just made, or create a new one with your current products.",
    open: "View full report",
    create: "Create a new full report"
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
  betaCopy,
  locale = "ko",
  premiumReportEnabled = false,
  premiumAvailability = "checking",
  savedReportId = null,
  isSavedReportChecking = false,
  isSessionRotationPending = false,
  isDevelopment = false,
  onDeveloperFullReportClick = null,
  onPremiumClick = null,
  onSavedReportClick = null,
  onNewPremiumClick = null
}) {
  const hasSavedReport = typeof savedReportId === "string" && savedReportId.trim();
  const reentryCopy = PREMIUM_REPORT_REENTRY_COPY[locale] || PREMIUM_REPORT_REENTRY_COPY.ko;
  const premiumUnavailable = premiumAvailability === "unavailable";
  const premiumChecking = premiumAvailability === "checking";
  const unavailableCopy =
    locale === "en"
      ? {
          title: "Premium report is currently unavailable",
          body: "Premium reports are not available right now.",
          button: "Premium report unavailable",
          checking: "Checking availability..."
        }
      : {
          title: "현재 프리미엄 리포트를 이용할 수 없습니다",
          body: "현재는 프리미엄 리포트를 이용할 수 없습니다.",
          button: "현재 이용할 수 없습니다",
          checking: "이용 가능 여부 확인 중..."
        };
  const displayTitle = hasSavedReport
    ? reentryCopy.title
    : premiumUnavailable
      ? unavailableCopy.title
      : betaCopy.button;
  const displayBody = hasSavedReport
    ? reentryCopy.body
    : premiumUnavailable
      ? unavailableCopy.body
      : betaCopy.body;
  const primaryButtonLabel = hasSavedReport
    ? reentryCopy.open
    : premiumUnavailable
      ? unavailableCopy.button
      : premiumChecking || isSavedReportChecking
        ? unavailableCopy.checking
        : betaCopy.button;
  const showDeveloperEntry = isDevelopment && !premiumUnavailable && premiumReportEnabled && onDeveloperFullReportClick;
  const canOpenSavedReport = Boolean(hasSavedReport && !isSessionRotationPending && onSavedReportClick);
  const canCreateNewReport = Boolean(
    hasSavedReport &&
      premiumReportEnabled &&
      !premiumChecking &&
      !premiumUnavailable &&
      !isSessionRotationPending &&
      onNewPremiumClick
  );
  const canOpenPremium = hasSavedReport
    ? canOpenSavedReport
    : premiumReportEnabled && !premiumChecking && !premiumUnavailable && !isSavedReportChecking && onPremiumClick;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(120,70,70,0.14)] bg-[linear-gradient(145deg,#fff4ef_0%,#f6ece8_52%,#ffe1e5_100%)] p-5 text-[#28121b] shadow-[0_24px_70px_rgba(79,36,50,0.13)] dark:border-[#704557] dark:bg-[linear-gradient(135deg,#341f2c_0%,#2a1823_58%,#241720_100%)] dark:text-[#fff8f3] dark:shadow-[0_28px_80px_rgba(18,10,16,0.34)]">
      <div className="space-y-5">
        <div className="rounded-[1.6rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/70 p-5 text-center dark:border-[#704557] dark:bg-[#2a1823]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#ff9aa8]/45 bg-white/58 text-2xl text-[#ff8068] shadow-[0_0_28px_rgba(255,128,104,0.22)] dark:bg-[#301f28]">
            ✦
          </div>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(120,70,70,0.18)] bg-[#fff8f3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a3344] dark:border-[#704557] dark:bg-[#301f28] dark:text-[#f2c879]">
            {premiumUnavailable ? "PREMIUM UNAVAILABLE" : "PREMIUM BETA"}
          </span>
          <p className="mt-3 text-lg font-semibold tracking-tight text-[#28121b] dark:text-[#fff8f3]">{displayTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
            {displayBody}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/72 p-4 dark:border-[#704557] dark:bg-[#2a1823]">
          <p className="text-center text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{betaCopy.itemsTitle}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {betaCopy.items.map((item, index) => (
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
              <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{displayTitle}</p>
              <p className="mt-1.5 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{displayBody}</p>
            </div>
          </div>
          <button
            type="button"
            disabled={!canOpenPremium}
            onClick={canOpenPremium ? (hasSavedReport ? onSavedReportClick : onPremiumClick) : undefined}
            className={`ui-button-primary min-h-14 w-full bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] px-5 text-sm font-semibold !text-white shadow-[0_16px_34px_rgba(232,96,116,0.20)] ${
              canOpenPremium ? "" : "cursor-not-allowed opacity-80"
            }`}
          >
            {primaryButtonLabel}
          </button>
          {hasSavedReport ? (
            <button
              type="button"
              disabled={!canCreateNewReport}
              onClick={canCreateNewReport ? onNewPremiumClick : undefined}
              className={`ui-button-secondary min-h-12 w-full border border-[#ddbfb5] bg-white/70 px-5 text-sm font-semibold text-[#4a2b34] transition hover:bg-[#fff4f1] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df] dark:hover:bg-[#352430] ${
                canCreateNewReport ? "" : "cursor-not-allowed opacity-70"
              }`}
            >
              {reentryCopy.create}
            </button>
          ) : null}
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
              {betaCopy.developerButton}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">
              {betaCopy.developerNote}
            </span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function FreeResultV2PremiumPreviewStep({
  copy,
  premiumReportEnabled = false,
  premiumAvailability = "checking",
  savedReportId = null,
  isSavedReportChecking = false,
  isSessionRotationPending = false,
  locale = "ko",
  isDevelopment = false,
  onDeveloperFullReportClick = null,
  onPremiumClick = null,
  onSavedReportClick = null,
  onNewPremiumClick = null
}) {
  const betaCopy = PREMIUM_REPORT_BETA_COPY[locale] || PREMIUM_REPORT_BETA_COPY.ko;

  return (
    <section className="space-y-4">
      <FreeResultV2PremiumPreviewLead
        title={copy.premiumPreviewTitle}
        body={null}
      />

      <ResultPreviewMaskCard
        betaCopy={betaCopy}
        locale={locale}
        premiumReportEnabled={premiumReportEnabled}
        premiumAvailability={premiumAvailability}
        savedReportId={savedReportId}
        isSavedReportChecking={isSavedReportChecking}
        isSessionRotationPending={isSessionRotationPending}
        isDevelopment={isDevelopment}
        onDeveloperFullReportClick={onDeveloperFullReportClick}
        onPremiumClick={onPremiumClick}
        onSavedReportClick={onSavedReportClick}
        onNewPremiumClick={onNewPremiumClick}
      />
    </section>
  );
}
