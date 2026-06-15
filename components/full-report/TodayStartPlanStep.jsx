"use client";

function getSkinMatchHubCardLayout(id) {
  const layouts = {
    routine: {
      card: "left-0 top-0 rounded-tl-[1.65rem] rounded-tr-[4.6rem] rounded-bl-[4.6rem] rounded-br-[1.5rem] pr-[3.2rem] pb-[2.9rem] pt-4 pl-4 sm:pr-[5.2rem] sm:pb-[4.2rem] sm:pt-5 sm:pl-5",
      content: "items-start text-left",
      icon: "sun"
    },
    functional: {
      card: "right-0 top-0 rounded-tr-[1.65rem] rounded-tl-[4.6rem] rounded-br-[4.6rem] rounded-bl-[1.5rem] pl-[3.2rem] pb-[2.9rem] pt-4 pr-4 sm:pl-[5.2rem] sm:pb-[4.2rem] sm:pt-5 sm:pr-5",
      content: "items-end text-right",
      icon: "sliders",
      arrow: "end"
    },
    condition: {
      card: "left-0 bottom-0 rounded-bl-[1.65rem] rounded-tl-[4.6rem] rounded-br-[4.6rem] rounded-tr-[1.5rem] pr-[3.2rem] pt-[3.4rem] pb-4 pl-4 sm:pr-[5.2rem] sm:pt-[4.8rem] sm:pb-5 sm:pl-5",
      content: "items-start text-left",
      icon: "alert"
    },
    "face-lab": {
      card: "right-0 bottom-0 rounded-br-[1.65rem] rounded-tr-[4.6rem] rounded-bl-[4.6rem] rounded-tl-[1.5rem] pl-[3.2rem] pt-[3.4rem] pb-4 pr-4 sm:pl-[5.2rem] sm:pt-[4.8rem] sm:pb-5 sm:pr-5",
      content: "items-end text-right",
      icon: "sparkle",
      arrow: "end"
    }
  };

  return layouts[id] || layouts.routine;
}

function SkinMatchHubIcon({ type, className = "" }) {
  const baseClass = `h-6 w-6 ${className}`;

  if (type === "bottle") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 3h4" />
        <path d="M10.7 3v3.1l-2.2 2.3A3.7 3.7 0 0 0 7.5 11v7.2A2.8 2.8 0 0 0 10.3 21h3.4a2.8 2.8 0 0 0 2.8-2.8V11a3.7 3.7 0 0 0-1-2.6l-2.2-2.3V3" />
        <path d="M10 14h4" />
      </svg>
    );
  }

  if (type === "alert") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v5" />
        <path d="M12 17h.01" />
        <circle cx="12" cy="12" r="8.5" />
      </svg>
    );
  }

  if (type === "sliders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 7h14" />
        <path d="M5 17h14" />
        <circle cx="9" cy="7" r="2" />
        <circle cx="15" cy="17" r="2" />
      </svg>
    );
  }

  if (type === "sparkle") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3.5 14.2 9 20 11.2 14.2 13.4 12 19 9.8 13.4 4 11.2 9.8 9 12 3.5Z" />
        <path d="M18 4.5v3" />
        <path d="M19.5 6h-3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={baseClass} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.8v2.4" />
      <path d="M12 18.8v2.4" />
      <path d="m4.9 4.9 1.7 1.7" />
      <path d="m17.4 17.4 1.7 1.7" />
      <path d="M2.8 12h2.4" />
      <path d="M18.8 12h2.4" />
      <path d="m4.9 19.1 1.7-1.7" />
      <path d="m17.4 6.6 1.7-1.7" />
    </svg>
  );
}

export function SkinMatchHubQuickCard({ action, onNavigate, locale = "ko" }) {
  const layout = getSkinMatchHubCardLayout(action.id);
  const label = locale === "en" ? `Open ${action.title}` : `${action.title} 섹션으로 이동`;

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => onNavigate?.(action.target)}
      className={`group absolute z-10 flex h-[13.1rem] w-[49%] flex-col justify-between overflow-hidden border border-[#ecd1c4]/48 bg-[linear-gradient(145deg,rgba(255,254,251,0.92),rgba(255,246,240,0.76))] text-[#3d2422] shadow-[0_18px_46px_rgba(130,82,64,0.075),inset_0_1px_0_rgba(255,255,255,0.76)] outline-none transition duration-200 hover:-translate-y-0.5 hover:border-[#e6ad9c]/68 hover:shadow-[0_22px_50px_rgba(165,90,72,0.11)] focus-visible:ring-2 focus-visible:ring-[#e87662]/55 dark:border-[#6d3f3a]/54 dark:bg-[linear-gradient(145deg,rgba(45,24,28,0.8),rgba(25,13,17,0.88))] dark:text-[#fff4ee] dark:shadow-[0_18px_48px_rgba(10,3,6,0.34),inset_0_1px_0_rgba(255,226,215,0.07)] dark:hover:border-[#c98577]/56 sm:h-[13.25rem] lg:h-[13rem] ${layout.card}`}
    >
      <span className={`flex h-full flex-col ${layout.content}`}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#edb29f]/48 bg-[#fff6f1]/82 text-[#cc7668] shadow-[0_10px_24px_rgba(190,112,94,0.08)] dark:border-[#8b514b]/56 dark:bg-[#352026] dark:text-[#efb1a3]">
          <SkinMatchHubIcon type={layout.icon} />
        </span>
        <span className="mt-3 block text-[1.08rem] font-semibold leading-tight text-[#351f1f] dark:text-[#fff4ef] sm:text-[1.2rem]">
          {action.title}
        </span>
        <span className="mt-1.5 block text-[0.76rem] leading-4 text-[#785c54] dark:text-[#cfb4ac] sm:text-[0.82rem] sm:leading-5">
          {action.description}
        </span>
      </span>
      <span className={`mt-3 flex h-8 w-8 items-center justify-center rounded-full bg-[#f7e8df] text-sm text-[#9f5b50] transition group-hover:bg-[#e87662] group-hover:text-white dark:bg-[#332027] dark:text-[#f0b7a7] dark:group-hover:bg-[#d97966] ${layout.arrow === "end" ? "self-end" : "self-start"}`}>
        &rarr;
      </span>
    </button>
  );
}

export default function TodayStartPlanStep({ baseline, actionItems, hubActions, locale = "ko", onNavigate }) {
  const isEnglish = locale === "en";
  const signalChips = (baseline.chips || []).slice(0, 2);
  const primaryAction = actionItems[0] || {};

  return (
    <section className="relative overflow-hidden rounded-[1.6rem] border border-[#efe1d9] bg-[#fffaf5] p-4 shadow-[0_24px_62px_rgba(105,66,48,0.065)] dark:border-[#4a3033] dark:bg-[#170d12] dark:shadow-[0_28px_80px_rgba(9,3,6,0.38)] sm:p-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_58%,rgba(238,143,119,0.14),transparent_31%),radial-gradient(circle_at_50%_82%,rgba(246,187,164,0.18),transparent_35%),linear-gradient(180deg,rgba(255,251,248,0.74),rgba(255,242,235,0.54))] dark:bg-[radial-gradient(circle_at_50%_58%,rgba(213,124,105,0.13),transparent_33%),radial-gradient(circle_at_50%_82%,rgba(116,54,53,0.28),transparent_38%),linear-gradient(180deg,rgba(32,17,22,0.94),rgba(20,10,14,0.98))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-[-8rem] h-80 bg-[radial-gradient(ellipse_at_50%_0%,rgba(237,151,128,0.18),transparent_62%)] dark:bg-[radial-gradient(ellipse_at_50%_0%,rgba(182,92,78,0.18),transparent_64%)]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-serif text-[1.55rem] leading-none tracking-[0.04em] text-[#402930] dark:text-[#f4d8cc]">
              Be Jewely
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#9b746c] dark:text-[#b99791]">
              Premium Report
            </p>
          </div>
          <span className="rounded-full border border-[#dfb8ad] bg-[#fff4ee] px-3 py-1 text-[11px] font-semibold text-[#9a594f] dark:border-[#70413f] dark:bg-[#2b171d] dark:text-[#f0b7a7]">
            Skin Match AI
          </span>
        </div>

        <div className="mt-8 text-center">
          <p className="text-[0.78rem] font-semibold tracking-[0.02em] text-[#7c4a42] dark:text-[#ddb7aa]">
            {isEnglish ? "Skin Match Plan" : "Skin Match 플랜"}
          </p>
          <h3 className="mt-2.5 font-serif text-[2.05rem] font-medium leading-tight text-[#44251f] dark:text-[#ffe2d7] sm:text-[2.45rem]">
            {isEnglish ? "Personal Skin Map" : "퍼스널 피부 상담 맵"}
          </h3>
          <p className="mx-auto mt-3 max-w-[28rem] text-sm leading-6 text-[#654b45] dark:text-[#f1d7ce]">
            {isEnglish
              ? "Based on your skin right now, this organizes what to keep and what to reduce today."
              : "지금 피부 기준으로, 오늘 유지할 것과 줄일 것을 먼저 정리했어요."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {signalChips.map((chip) => (
              <span key={chip} className="rounded-full border border-[#e6c8bd]/54 bg-[#fff8f3]/88 px-3 py-1.5 text-xs font-semibold text-[#b96054] dark:border-[#70413f]/64 dark:bg-[#311b21] dark:text-[#f0b7a7]">
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto mt-7 min-h-[31rem] max-w-[28rem] sm:min-h-[34rem] sm:max-w-[34rem] lg:min-h-[33rem] lg:max-w-[46rem]">
          <div className="pointer-events-none absolute left-1/2 top-[47%] h-[22rem] w-[22rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#f0b7a7]/18 dark:border-[#7d4b47]/25" />
          <div className="pointer-events-none absolute left-1/2 top-[47%] h-[16.5rem] w-[16.5rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#edc8bb]/28 dark:border-[#6e3e3c]/34" />
          <div className="pointer-events-none absolute left-1/2 top-[47%] h-[11.4rem] w-[11.4rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,241,234,0.58),rgba(255,226,212,0.14),transparent_72%)] dark:bg-[radial-gradient(circle,rgba(151,74,65,0.24),rgba(66,30,33,0.16),transparent_72%)]" />

          {hubActions.map((action) => (
            <SkinMatchHubQuickCard
              key={action.id}
              action={action}
              locale={locale}
              onNavigate={onNavigate}
            />
          ))}

          <div className="absolute left-1/2 top-[47%] z-20 flex h-[11.75rem] w-[11.75rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-[#f3c1ae]/64 bg-[radial-gradient(circle_at_50%_20%,rgba(255,253,250,0.98),rgba(255,236,225,0.9)_68%,rgba(255,223,209,0.78))] px-4 text-center shadow-[0_0_0_7px_rgba(241,173,151,0.09),0_20px_50px_rgba(185,93,74,0.16),inset_0_1px_0_rgba(255,255,255,0.82)] dark:border-[#d28a78]/58 dark:bg-[radial-gradient(circle_at_50%_18%,rgba(70,35,39,0.96),rgba(38,19,24,0.92)_70%,rgba(27,13,18,0.98))] dark:shadow-[0_0_0_7px_rgba(176,83,74,0.09),0_24px_62px_rgba(8,2,5,0.45),inset_0_1px_0_rgba(255,226,215,0.1)] sm:h-[13.75rem] sm:w-[13.75rem] sm:px-5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#efb09f]/56 bg-[#fff6f0] text-[#d06f60] dark:border-[#8d514b]/72 dark:bg-[#3b2026] dark:text-[#f0b7a7]">
              ✧
            </span>
            <h4 className="mt-2 font-serif text-[1.65rem] font-semibold leading-tight text-[#4b2822] dark:text-[#ffe2d7] sm:text-[1.95rem]">
              {isEnglish ? "Start Today" : "오늘 시작"}
            </h4>
            <p className="mt-1.5 text-[0.74rem] leading-5 text-[#755650] dark:text-[#ead0c7] sm:mt-2 sm:text-[0.82rem]">
              {isEnglish ? "First priority:" : "오늘 우선 실행:"}<br />
              <strong className="font-semibold text-[#3d2422] dark:text-[#fff4ef]">
                {primaryAction.title || (isEnglish ? "Pause new active steps" : "기능성 추가 멈추기")}
              </strong>
            </p>
            <button
              type="button"
              onClick={() => onNavigate?.("morning-routine")}
              className="mt-2.5 inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#e87662_0%,#f2aa91_100%)] px-4 text-[0.72rem] font-semibold text-white shadow-[0_12px_26px_rgba(215,111,91,0.24)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2aa91]/70 sm:mt-3 sm:min-h-10 sm:px-4 sm:text-xs"
            >
              {isEnglish ? "Open routine consult" : "루틴 상담 보기"}
              <span className="ml-2">&rarr;</span>
            </button>
          </div>
        </div>

        <div className="mt-4 flex w-full items-center justify-between gap-3 rounded-[1.1rem] border border-[#e1c8bd] bg-[#fff7f1]/82 px-4 py-3 text-left shadow-[0_12px_28px_rgba(105,66,48,0.06)] dark:border-[#52363a] dark:bg-[#21151b]/78 dark:shadow-none">
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dca396]/55 bg-[#fff1ea] text-[#b76356] dark:border-[#8a514c] dark:bg-[#321b21] dark:text-[#f0b7a7]">
              <SkinMatchHubIcon type="alert" className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[#4c3335] dark:text-[#fff4ef]">
                {isEnglish ? "Your skin data is protected" : "내 피부 데이터는 안전하게 보호돼요"}
              </span>
              <span className="mt-0.5 block truncate text-xs text-[#8b6c64] dark:text-[#bfa59f]">
                {isEnglish ? "You can reopen this premium report during access." : "구독 기간 동안 리포트를 다시 확인할 수 있어요."}
              </span>
            </span>
          </span>
          <span className="shrink-0 text-xl text-[#9f5b50] dark:text-[#f0b7a7]">&rsaquo;</span>
        </div>
      </div>
    </section>
  );
}

