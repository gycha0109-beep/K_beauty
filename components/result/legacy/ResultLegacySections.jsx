"use client";

import {
  FreeResultV2Card,
  FreeResultV2ExecutionGuideIcon,
  FreeResultV2LockIcon,
  FreeResultV2Pill,
  FreeResultV2RoutineIcon,
  FreeResultV2RoutineModeIcon,
  FreeResultV2StepFrame
} from "@/components/result/free-v2/FreeResultV2Primitives";

export function FreeResultV2FaceLabPreviewPanel({ faceLabPreview = null, locale = "ko", className = "" }) {
  if (!faceLabPreview) {
    return null;
  }

  const isEnglish = locale === "en";

  return (
    <div className={`rounded-[2rem] border border-[#ead9d6] bg-[#fffaf6] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.14)] dark:border-[#4a303c] dark:bg-[#241720] ${className}`}>
      <p className="text-[13px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">Face Lab</p>
      <p className="mt-3 text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">
        {isEnglish ? "Representative mood: " : "대표 무드: "}
        <span className="font-semibold text-[#26101a] dark:text-[#fff8f3]">{faceLabPreview.primary}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {faceLabPreview.keywords.map((keyword) => (
          <FreeResultV2Pill key={keyword}>{keyword}</FreeResultV2Pill>
        ))}
      </div>
    </div>
  );
}

export function FreeResultV2LockRow({ label, subLabel = "", locked = true }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.05rem] border border-[#ead9d6] bg-white/42 px-4 py-3 dark:border-[#5a3a48] dark:bg-[#2a1b24]/74">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#3a1824] dark:text-[#f3e4df]">{label}</p>
        {subLabel ? <p className="mt-0.5 text-xs leading-5 text-[#8b6370] dark:text-[#c8aeb8]">{subLabel}</p> : null}
      </div>
      {locked ? (
        <span className="shrink-0 text-[#9b7280] dark:text-[#9e7f8c]">
          <FreeResultV2LockIcon />
        </span>
      ) : null}
    </div>
  );
}

export function FreeResultV2RoutineFlow({ title, steps = [], note = "", tone = "morning" }) {
  const safeSteps = steps.length ? steps : [title].filter(Boolean);

  return (
    <div className="rounded-[1.35rem] border border-[#ead9d6] bg-white/42 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]/74">
      <div className="flex items-center gap-3">
        <FreeResultV2RoutineIcon tone={tone} />
        <p className="text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">{title}</p>
      </div>
      <div className="relative mt-4">
        {safeSteps.length > 1 ? (
          <span className="absolute left-[14%] right-[14%] top-3 h-px bg-[#e7c5bc] dark:bg-[#6a4353]" />
        ) : null}
        <div
          className="relative grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(safeSteps.length, 1)}, minmax(0, 1fr))` }}
        >
          {safeSteps.map((step, index) => (
            <div key={`${title}-${step}`} className="min-w-0 text-center">
              <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-[#f2c4ca] bg-[#fff8f3] text-[11px] font-semibold text-[#e6507a] shadow-[0_0_16px_rgba(230,80,122,0.12)] dark:border-[#6a4353] dark:bg-[#301f28] dark:text-[#ff9aa8]">
                {index + 1}
              </span>
              <span className="mt-2 flex min-h-[2.65rem] items-center justify-center rounded-[0.95rem] border border-[#ead9d6] bg-white/56 px-2 py-2 text-center text-[12px] font-semibold leading-4 text-[#3a1824] dark:border-[#6a4353] dark:bg-[#301f28] dark:text-[#f3e4df]">
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
      {safeSteps.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-[#b17888] dark:text-[#d6a1af]" aria-hidden="true">
          {safeSteps.map((step, index) => (
            <span key={`${title}-arrow-${step}`} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {index < safeSteps.length - 1 ? <span>→</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {note ? (
        <p className="mt-3 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{note}</p>
      ) : null}
    </div>
  );
}

export function FreeResultV2RoutineFaceLabStep({ routinePreview, diagnosis = null, faceLabPreview = null, locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <FreeResultV2StepFrame
      eyebrow={isEnglish ? "Next step" : "다음 단계"}
      title={isEnglish ? "Routine direction preview" : "루틴 방향 미리보기"}
    >
      <FreeResultV2Card>
        <p className="text-[13px] font-semibold text-[#b3949f] dark:text-[#c8aeb8]">AM / PM</p>
        <div className="mt-4 grid gap-3">
          <FreeResultV2RoutineFlow
            title={isEnglish ? "Morning direction" : "아침 방향"}
            steps={routinePreview.morningSteps}
            note={routinePreview.morningNote}
            tone="morning"
          />
          <FreeResultV2RoutineFlow
            title={isEnglish ? "Night direction" : "저녁 방향"}
            steps={routinePreview.nightSteps}
            note={routinePreview.nightNote}
            tone="night"
          />
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-[#9b7280] dark:text-[#9e7f8c]">
          {routinePreview.gateNote || (isEnglish ? "Detailed order and product placement are in the full report." : "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요.")}
        </p>
      </FreeResultV2Card>

      {diagnosis ? (
        <FreeResultV2Card>
          <p className="text-[13px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">{isEnglish ? "Recommendation direction" : "추천 방향"}</p>
          <p className="mt-3 text-base leading-8 text-[#3a1824] dark:text-[#f3e4df]">{diagnosis.directionLine}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {diagnosis.directionTags.map((tag) => (
              <FreeResultV2Pill key={tag}>{tag}</FreeResultV2Pill>
            ))}
          </div>
        </FreeResultV2Card>
      ) : null}

      <FreeResultV2FaceLabPreviewPanel faceLabPreview={faceLabPreview} locale={locale} />

      <FreeResultV2Card>
        <p className="text-[13px] font-semibold text-[#b3949f] dark:text-[#c8aeb8]">{isEnglish ? "Unlocked in the full report" : "전체 리포트에서 열리는 항목"}</p>
        <div className="mt-3 grid gap-2">
          <FreeResultV2LockRow label={isEnglish ? "Product operation guide" : "제품 운용법"} />
          <FreeResultV2LockRow label={isEnglish ? "Combinations to watch" : "주의할 조합"} />
        </div>
      </FreeResultV2Card>
    </FreeResultV2StepFrame>
  );
}

export function FreeResultV2ReportValueStrip({ items = [] }) {
  return (
    <div className="relative mt-4 -mx-4 sm:-mx-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-[linear-gradient(90deg,#fffaf6_0%,rgba(255,250,246,0)_100%)] dark:bg-[linear-gradient(90deg,#241720_0%,rgba(36,23,32,0)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-[linear-gradient(270deg,#fffaf6_0%,rgba(255,250,246,0)_100%)] dark:bg-[linear-gradient(270deg,#241720_0%,rgba(36,23,32,0)_100%)]" aria-hidden="true" />
      <div className="overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:px-5">
        <div className="flex w-max gap-2.5 pr-2">
          {items.map((item) => (
            <article
              key={item.key}
              className="flex h-[7.45rem] w-[8.35rem] shrink-0 flex-col rounded-[1rem] border border-[#ead9d6]/82 bg-white/24 px-3 py-3 shadow-[0_10px_24px_rgba(35,16,25,0.06)] dark:border-[#5a3a48]/82 dark:bg-[#2a1b24]/58 dark:shadow-none"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/28 bg-[#ff9aa8]/9 text-[#ff9aa8]">
                <FreeResultV2ExecutionGuideIcon type={item.icon} />
              </span>
              <p className="mt-2 break-keep text-[13px] font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item.title}</p>
              <p className="mt-1 break-keep text-[11px] leading-[1.45] text-[#7a5360] dark:text-[#c8aeb8]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FreeResultV2BlurredRoutinePreview({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const rows = isEnglish
    ? ["Morning routine order", "Night routine order"]
    : ["아침 루틴 순서", "저녁 루틴 순서"];

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[#ead9d6] bg-white/26 p-3 dark:border-[#5a3a48] dark:bg-[#2a1b24]/72">
      <div className="space-y-2 blur-[2.5px]">
        {rows.map((row, index) => (
          <div key={row} className="grid grid-cols-[2.8rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1rem] border border-[#ead9d6] bg-white/34 px-3 py-3 dark:border-[#5a3a48] dark:bg-[#241720]/80">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              index ? "border-[#cda7ff]/32 bg-[#3a2340]/40 text-[#d8b6ff]" : "border-[#ff9a8a]/36 bg-[#ff9a8a]/10 text-[#ff9a8a]"
            }`}>
              <FreeResultV2RoutineModeIcon tone={index ? "night" : "morning"} />
            </span>
            <span className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{row}</span>
            <span className="text-[#b17888] dark:text-[#d6a1af]" aria-hidden="true">›</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#fffaf6]/28 backdrop-blur-[1px] dark:bg-[#241720]/30">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ff9aa8]/34 bg-[#241720]/82 px-4 py-2 text-xs font-semibold text-[#fff8f3] shadow-[0_16px_34px_rgba(18,10,16,0.28)]">
          <FreeResultV2LockIcon />
          {isEnglish ? "Organized in the full report" : "전체 리포트에서 확인할 수 있어요"}
        </span>
      </div>
    </div>
  );
}

export function FreeResultV2FullReportCompletionStep({ locale = "ko", onCtaClick = null }) {
  const isEnglish = locale === "en";
  const reportValueItems = isEnglish
    ? [
        { key: "order", icon: "order", title: "Routine order", body: "Follow the morning and night order as-is." },
        { key: "alternative", icon: "alternative", title: "Alternatives", body: "Check what to switch to if it does not fit." },
        { key: "avoid", icon: "avoid", title: "Avoid pairings", body: "Reduce irritation risk before it starts." },
        { key: "flare", icon: "flare", title: "Skin SOS", body: "Adjust the routine on rough skin days." },
        { key: "style", icon: "style", title: "Style expansion", body: "See Face Lab-based direction too." }
      ]
    : [
        { key: "order", icon: "order", title: "루틴 순서", body: "아침·저녁 순서를 그대로 따라가요" },
        { key: "alternative", icon: "alternative", title: "대체 제품", body: "안 맞을 때 바꿀 후보를 확인해요" },
        { key: "avoid", icon: "avoid", title: "피해야 할 조합", body: "자극 리스크를 미리 줄여요" },
        { key: "flare", icon: "flare", title: "피부 응급 대응", body: "뒤집힌 날 조정법을 확인해요" },
        { key: "style", icon: "style", title: "스타일 확장", body: "Face Lab 기반 방향까지 봐요" }
      ];

  return (
    <FreeResultV2StepFrame
      title={isEnglish ? "Full Report Complete" : "전체 리포트 완성"}
      body={isEnglish ? "The free result showed the direction. Now get the execution guide you can follow." : "무료 결과는 방향을 알려드렸어요. 이제 그대로 따라 할 실행 가이드를 받아보세요."}
    >
      <FreeResultV2Card className="space-y-4 overflow-hidden">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/34 bg-[#ff9aa8]/10 text-[#ff9aa8]">
            <FreeResultV2ExecutionGuideIcon type="order" />
          </span>
          <div className="min-w-0">
            <p className="break-keep text-xl font-semibold leading-7 text-[#26101a] dark:text-[#fff8f3]">
              {isEnglish ? "Your routine is ready" : "이미 준비된 내 루틴"}
            </p>
            <p className="mt-2 break-keep text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
              {isEnglish ? "Morning, night, switch options, and caution points are organized into one guide." : "아침·저녁 순서와 조정 포인트를 하나의 실행 가이드로 정리합니다."}
            </p>
          </div>
        </div>
        <FreeResultV2BlurredRoutinePreview locale={locale} />
      </FreeResultV2Card>

      <FreeResultV2Card className="overflow-hidden px-4 py-4 sm:px-5">
        <div>
          <p className="text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">
            {isEnglish ? "Organized into the full report" : "전체 리포트로 정리되는 것"}
          </p>
          <p className="mt-1 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
            {isEnglish ? "The direction becomes concrete actions you can follow from today." : "방향 확인에서 끝나지 않도록, 오늘부터 할 행동으로 이어집니다."}
          </p>
        </div>
        <FreeResultV2ReportValueStrip items={reportValueItems} />
      </FreeResultV2Card>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onCtaClick}
          className="ui-button-primary min-h-14 w-full bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] px-5 text-sm font-semibold !text-white shadow-[0_16px_34px_rgba(232,96,116,0.28)] hover:opacity-95"
        >
          {isEnglish ? "Get tonight's routine guide" : "오늘 밤부터 그대로 따라 할 루틴 받기"}
        </button>
        <p className="break-keep px-1 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
          {isEnglish ? "Routine order, switch options, and caution points are organized together." : "루틴 순서, 바꿀 후보, 피해야 할 조합까지 함께 정리됩니다."}
        </p>
      </div>
    </FreeResultV2StepFrame>
  );
}

export function SkinDashboardCard({ metrics = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const items = Array.isArray(metrics) ? metrics.slice(0, 5) : [];
  const primaryMetric = [...items].sort((a, b) => b.value - a.value)[0] || null;
  const secondaryMetrics = primaryMetric
    ? items.filter((metric) => metric.key !== primaryMetric.key)
    : items;
  const darkMetricColors = {
    hydration: "#d85f78",
    oil: "#e0705e",
    sensitivity: "#77b799",
    barrier: "#7b5063",
    tone: "#d18b7f"
  };
  const primaryDarkColor = primaryMetric ? darkMetricColors[primaryMetric.key] || "#d96c69" : "#d96c69";

  return (
    <section className="rounded-[2rem] border border-[#ead9d2] bg-[#fffaf5] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.18)] dark:border-[#4a303c] dark:bg-[#241720] sm:p-6">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2b101b] shadow-[0_12px_26px_rgba(52,20,35,0.08)] dark:bg-[#301f28] dark:text-[#fff8f3]">
          02
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7e5261] dark:text-[#c8aeb8]">SKIN DASHBOARD</p>
          <h2 className="mt-1 text-[1.8rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff8f3] sm:text-[2rem]">
            {isEnglish ? "Skin Dashboard" : "피부 상태 대시보드"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
            {isEnglish
              ? "Before the Top Pick, check the main skin signals briefly."
              : "Top Pick 전에 주요 피부 신호만 짧게 확인합니다."}
          </p>
        </div>
      </div>

      {primaryMetric ? (
        <div className="mt-6 overflow-hidden rounded-[1.65rem] border border-[#efcfc9] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(255,232,231,0.76))] p-4 shadow-[0_18px_42px_rgba(80,28,46,0.12)] dark:border-[#5a3a48] dark:bg-[linear-gradient(135deg,rgba(55,35,47,0.96),rgba(40,25,34,0.96))]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#c8aeb8]">
                  {isEnglish ? "Main signal" : "대표 지표"}
                </p>
                <span className="rounded-full border border-[#e7c5bc] bg-white/72 px-2.5 py-1 text-[11px] font-semibold text-[#8a4c5d] dark:border-[#6a4353] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {primaryMetric.status}
                </span>
              </div>
              <p className="mt-2 text-[1.55rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff8f3]">
                {primaryMetric.label}
              </p>
              <p className="mt-2 max-w-[26rem] text-sm leading-6 text-[#6f4a56] dark:text-[#d8c2c9]">{primaryMetric.description}</p>
            </div>
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center self-center rounded-full bg-[#fff7f2] shadow-inner dark:bg-[#301f28]">
              <span
                className="absolute inset-0 rounded-full dark:hidden"
                style={{ background: `conic-gradient(${primaryMetric.color} ${primaryMetric.value * 3.6}deg, rgba(234,217,210,0.75) 0deg)` }}
              />
              <span
                className="absolute inset-0 hidden rounded-full dark:block"
                style={{ background: `conic-gradient(${primaryDarkColor} ${primaryMetric.value * 3.6}deg, rgba(74,48,60,0.88) 0deg)` }}
              />
              <span className="relative flex h-[4.9rem] w-[4.9rem] flex-col items-center justify-center rounded-full bg-white text-[#26101a] dark:bg-[#241720]">
                <span className="text-2xl font-semibold leading-none dark:text-[#e87a68]">{primaryMetric.value}</span>
                <span className="mt-0.5 text-[10px] font-medium text-[#8b6370] dark:text-[#d59a91]">/100</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2.5">
        {secondaryMetrics.map((metric) => (
          <div key={metric.key} className="rounded-[1.15rem] border border-[#ead9d2] bg-white/48 px-3.5 py-3 dark:border-[#5a3a48] dark:bg-[#2a1b24]/88">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
                  <p className="text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{metric.label}</p>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#7a5360] dark:text-[#c8aeb8]">{metric.description}</p>
              </div>
              <div className="flex min-w-[4.9rem] shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold leading-none text-[#26101a] dark:text-[#fff8f3]">{metric.value}</span>
                <span className="rounded-full border border-[#e7c5bc] bg-white/72 px-2.5 py-0.5 text-[10px] font-medium text-[#8a4c5d] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {metric.status}
                </span>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e7dcda] dark:bg-[#3a2630]">
              <div
                className="h-full rounded-full"
                style={{ width: `${metric.value}%`, backgroundColor: metric.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function RoutineFlowCard({ sections = [], directionCards = [], warnings = [], emptyText, warningsLabel, locale = "ko" }) {
  const isEnglish = locale === "en";
  const visibleSections = sections.length
    ? sections
    : directionCards.map((card) => ({
        key: card.key,
        label: card.label,
        meta: isEnglish ? "Routine direction" : "루틴 방향",
        strategy: card.body,
        items: [card.body].filter(Boolean)
      }));

  return (
    <section className="rounded-[2rem] border border-[#ead9d2] bg-[#fff8ef] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.16)] dark:border-[#4a303c] dark:bg-[#241720]">
      <div className="space-y-4">
        {visibleSections.length ? (
          <div className="grid gap-3">
            {visibleSections.map((section) => (
              <div key={`routine-flow-${section.key}`} className="rounded-[1.45rem] border border-[#ead9d2] bg-white/58 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e6507a] dark:text-[#ff9aa8]">{section.meta}</p>
                    <h3 className="mt-1 text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">{section.label}</h3>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ead9d2] bg-[#fff4f1] text-sm font-semibold text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#fff8f3]">
                    {section.key === "night" ? "PM" : "AM"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {section.items.map((item, index) => (
                    <div key={`${section.key}-${item}-${index}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 rounded-[1rem] border border-[#efc5bd] bg-[#fffaf6] px-3 py-2.5 shadow-[0_8px_20px_rgba(128,58,44,0.07)] dark:border-[#563746] dark:bg-[#301f28] dark:shadow-none">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#f0d2cb] bg-white text-[11px] font-semibold text-[#e6507a] shadow-[0_3px_10px_rgba(230,80,122,0.12)] dark:border-[#4a303c] dark:bg-[#241720] dark:text-[#ff9aa8] dark:shadow-none">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">{item}</p>
                    </div>
                  ))}
                </div>

                {section.strategy && !section.items.includes(section.strategy) ? (
                  <p className="mt-3 rounded-[1rem] border border-[#ead9d2] bg-white/45 px-3 py-2 text-xs leading-5 text-[#7a5360] dark:border-[#5a3a48] dark:bg-[#251820] dark:text-[#c8aeb8]">
                    {section.strategy}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.4rem] bg-white/60 px-4 py-4 text-sm leading-6 text-[#69424f] dark:bg-[#2f202a] dark:text-[#c8aeb8]">
            {emptyText}
          </div>
        )}

        <div className="rounded-[1.45rem] border border-[#ead9d2] bg-white/58 p-4 dark:border-[#6a4a25] dark:bg-[#3a2818]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#f2c879]">
            {warningsLabel}
          </p>
          <div className="mt-3 space-y-2.5">
            {(warnings.length ? warnings : [
              isEnglish
                ? "Keep the routine simple first and add new steps one at a time."
                : "처음에는 루틴을 단순하게 두고 새 단계는 하나씩만 추가하세요."
            ]).map((warning, index) => (
              <p key={`routine-warning-${index}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">
                <span className="text-[#ff8068]">!</span>
                <span>{warning}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ResultPreviewThumb({ type = "routine" }) {
  const baseClass = "relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.05rem] border border-[#ff9aa8]/32 bg-[#fff8f3]/76 shadow-[0_12px_28px_rgba(128,58,78,0.11)] dark:border-[#704557] dark:bg-[#301f28]";

  if (type === "variants") {
    return (
      <div className={baseClass} aria-hidden="true">
        <div className="absolute inset-2 grid grid-cols-2 gap-1.5">
          <span className="rounded-[0.55rem] border border-[#f0c9c8] bg-[#ffe9e4] dark:border-[#765065] dark:bg-[#3a2630]" />
          <span className="rounded-[0.55rem] border border-[#f0c9c8] bg-white/88 dark:border-[#765065] dark:bg-[#251820]" />
          <span className="rounded-[0.55rem] border border-[#f0c9c8] bg-white/88 dark:border-[#765065] dark:bg-[#251820]" />
          <span className="rounded-[0.55rem] border border-[#ff9aa8]/46 bg-[#ffe2eb] dark:border-[#ff9aa8]/30 dark:bg-[#442631]" />
        </div>
      </div>
    );
  }

  if (type === "compare") {
    return (
      <div className={baseClass} aria-hidden="true">
        <div className="absolute inset-x-2 top-2 grid grid-cols-2 gap-1.5">
          <span className="h-6 rounded-[0.6rem] bg-[#ffe2eb] dark:bg-[#442631]" />
          <span className="h-6 rounded-[0.6rem] bg-white/86 dark:bg-[#251820]" />
        </div>
        <span className="absolute bottom-5 left-2 right-2 h-1.5 rounded-full bg-[#ead9d6] dark:bg-[#4a303c]" />
        <span className="absolute bottom-5 left-2 h-1.5 w-8 rounded-full bg-[#ff9aa8]" />
        <span className="absolute bottom-2 left-2 right-2 h-1.5 rounded-full bg-[#ead9d6] dark:bg-[#4a303c]" />
        <span className="absolute bottom-2 left-2 h-1.5 w-11 rounded-full bg-[#ff8068]" />
      </div>
    );
  }

  if (type === "avoid") {
    return (
      <div className={baseClass} aria-hidden="true">
        <span className="absolute left-3 top-3 h-10 w-10 rounded-full border border-[#ff9aa8]/60" />
        <span className="absolute left-[18px] top-[31px] h-px w-9 rotate-45 bg-[#ff8068]" />
        <span className="absolute left-[18px] top-[31px] h-px w-9 -rotate-45 bg-[#ff8068]" />
        <span className="absolute bottom-3 left-3 h-1.5 w-7 rounded-full bg-[#ead9d6] dark:bg-[#4a303c]" />
        <span className="absolute bottom-3 right-3 h-1.5 w-3 rounded-full bg-[#ff9aa8]" />
      </div>
    );
  }

  if (type === "face-lab") {
    return (
      <div className={baseClass} aria-hidden="true">
        <span className="absolute left-1/2 top-2 h-9 w-8 -translate-x-1/2 rounded-[42%] border border-[#ff9aa8]/68 bg-[#ffeaf0]/42 dark:bg-[#3a2630]" />
        <span className="absolute left-[21px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
        <span className="absolute right-[21px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
        <span className="absolute bottom-4 left-4 right-4 h-px bg-[#ff9aa8]/68" />
        <span className="absolute bottom-2 left-6 right-6 h-px bg-[#ff8068]/64" />
      </div>
    );
  }

  return (
    <div className={baseClass} aria-hidden="true">
      <div className="absolute inset-2 flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-5 text-[8px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">AM</span>
          <span className="h-1.5 flex-1 rounded-full bg-[#ff9aa8]" />
          <span className="h-1.5 w-3 rounded-full bg-[#ffcabd]" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 text-[8px] font-semibold text-[#9b6bd8] dark:text-[#d8b6ff]">PM</span>
          <span className="h-1.5 flex-1 rounded-full bg-[#d8b6ff]" />
          <span className="h-1.5 w-4 rounded-full bg-[#f0c9ff]" />
        </div>
        <span className="h-5 rounded-[0.65rem] border border-[#ead9d6] bg-white/72 dark:border-[#5a3a48] dark:bg-[#251820]" />
      </div>
    </div>
  );
}

export function ResultPreviewLargeVisual({ type = "routine" }) {
  if (type === "variants") {
    return (
      <div className="relative mt-4 h-28 overflow-hidden rounded-[1rem] border border-[#ff9aa8]/18 bg-[linear-gradient(180deg,rgba(255,154,168,0.12),rgba(36,23,32,0.18))]" aria-hidden="true">
        <div className="absolute left-5 right-5 top-4 flex items-center justify-center gap-3 text-[#ff9aa8]">
          <span className="text-base leading-none">≋</span>
          <span className="h-9 w-9 rounded-full border border-[#ff9aa8]/30 bg-[#ff9aa8]/16">
            <span className="mx-auto mt-3 block h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
            <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
          </span>
          <span className="h-9 w-9 rounded-full border border-[#c9b6ff]/26 bg-[#c9b6ff]/14">
            <span className="mx-auto mt-2.5 block h-4 w-3 rounded-b-full rounded-t-[60%] bg-[#c9b6ff]/70" />
          </span>
        </div>
        <div className="absolute bottom-3 left-6 right-6 flex items-end justify-center gap-4">
          <span className="h-12 w-6 rounded-t-[0.55rem] bg-white/62 dark:bg-white/48" />
          <span className="h-9 w-5 rounded-t-[0.45rem] bg-[#f3c9d2]/72" />
          <span className="h-11 w-5 rounded-t-[0.45rem] bg-white/56 dark:bg-white/40" />
          <span className="h-6 w-9 rounded-[0.35rem] bg-[#ffcabd]/62" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-4 h-28 overflow-hidden rounded-[1rem] border border-[#ff9aa8]/18 bg-[linear-gradient(180deg,rgba(255,154,168,0.12),rgba(36,23,32,0.18))]" aria-hidden="true">
      <div className="absolute left-5 top-4 flex items-center gap-3">
        <span className="rounded-full bg-[#ff8068]/26 px-3 py-1 text-[11px] font-semibold text-[#ffd0ca]">AM</span>
        <span className="h-px w-7 border-t border-dashed border-[#ff9aa8]/45" />
        <span className="rounded-full bg-[#8d79ff]/22 px-3 py-1 text-[11px] font-semibold text-[#d8d1ff]">PM</span>
      </div>
      <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between">
        <span className="h-12 w-6 rounded-t-[0.55rem] bg-white/60 dark:bg-white/46" />
        <span className="h-9 w-5 rounded-t-[0.45rem] bg-[#f3c9d2]/72" />
        <span className="h-16 w-7 rounded-t-[0.5rem] bg-white/78" />
        <span className="h-5 w-9 rounded-[0.35rem] bg-[#d8b6ff]/52" />
        <span className="h-8 w-6 rounded-t-[0.45rem] bg-white/60 dark:bg-white/44" />
        <span className="h-14 w-7 rounded-t-[0.55rem] bg-[#ffb49d]/70" />
      </div>
    </div>
  );
}

export function ResultPreviewHighlightCard({ section, index, locale = "ko" }) {
  const isEnglish = locale === "en";
  const footnote = section.previewType === "variants"
    ? (isEnglish ? "Shows how to reduce the routine when needed." : "루틴을 어떻게 줄일지 정리됩니다.")
    : (isEnglish ? "Product order and frequency are organized together." : "제품 순서와 사용 빈도까지 정리됩니다.");

  return (
    <div className="rounded-[1.45rem] border border-[#ff9aa8]/34 bg-[#fbf2ee]/76 p-4 shadow-[0_18px_42px_rgba(128,58,78,0.11)] dark:border-[#8b4d63] dark:bg-[#321d2a]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9b2c0]/58 text-sm font-semibold text-[#6a3344] dark:bg-[#ff9aa8]/18 dark:text-[#ffd0d8]">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{section.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{section.body}</p>
        </div>
      </div>
      <ResultPreviewLargeVisual type={section.previewType || section.key} />
      <div className="mt-3 flex items-center justify-between gap-3 text-xs leading-5 text-[#7a5360] dark:text-[#d8c2c9]">
        <span>{footnote}</span>
        <span className="shrink-0 text-[#9b7280] dark:text-[#d6a1af]">
          <FreeResultV2LockIcon />
        </span>
      </div>
    </div>
  );
}

export function ResultPreviewLockedRow({ section }) {
  return (
    <div className="rounded-[1.1rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/58 px-4 py-3 dark:border-[#704557] dark:bg-[#2a1823]">
      <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3">
        <ResultPreviewThumb type={section.previewType || section.key} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{section.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{section.body}</p>
        </div>
        <span className="shrink-0 text-[#9b7280] dark:text-[#d6a1af]">
          <FreeResultV2LockIcon />
        </span>
      </div>
    </div>
  );
}
