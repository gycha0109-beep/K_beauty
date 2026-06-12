"use client";

import { Fragment, useState } from "react";
import {
  FreeResultV2Card,
  FreeResultV2LockIcon,
  FreeResultV2RoleIcon,
  FreeResultV2RoutineModeIcon,
  FreeResultV2StepFrame
} from "@/components/result/free-v2/FreeResultV2Primitives";

function getImageFallbackLabel(product) {
  return product?.brand ? `${product.brand} ${product?.name || ""}`.trim() : product?.name || "Product";
}

function SmallProductThumb({ product, height = "h-28", locale = "ko", elevated = false }) {
  const imagePreparing = locale === "en" ? "Image coming soon" : "\uC774\uBBF8\uC9C0 \uC900\uBE44 \uC911";
  const surfaceClass = elevated
    ? "border border-[#edc9c3] bg-[#fff7f4] shadow-[inset_0_0_28px_rgba(255,128,104,0.12),0_14px_36px_rgba(80,28,46,0.10)] dark:border-[#5a3947] dark:bg-[#2c1c25] dark:shadow-[inset_0_0_28px_rgba(255,128,104,0.08),0_14px_36px_rgba(0,0,0,0.20)]"
    : "ui-image-surface";
  const emptyClass = elevated
    ? "flex h-full items-center justify-center bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.62),rgba(255,245,241,0.22)_44%,rgba(255,128,104,0.06)_100%)] px-3 text-center dark:bg-[radial-gradient(circle_at_50%_36%,rgba(255,255,255,0.08),rgba(255,128,104,0.07)_46%,rgba(0,0,0,0.04)_100%)]"
    : "ui-image-empty flex h-full items-center justify-center px-3 text-center";
  const iconClass = elevated
    ? "flex h-11 w-11 items-center justify-center rounded-[1rem] border border-[#ead1cb] bg-white/78 text-zinc-400 shadow-[0_8px_22px_rgba(80,28,46,0.08)] dark:border-[#563746] dark:bg-[#21161e] dark:text-zinc-500"
    : "flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-zinc-200 bg-white/70 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500";
  return (
    <div className={`${surfaceClass} overflow-hidden rounded-[1.1rem] ${height}`}>
      {product?.image_url ? (
        <div className="flex h-full w-full items-center justify-center p-2">
          <img
            src={product.image_url}
            alt={getImageFallbackLabel(product)}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className={emptyClass}>
          <div className="flex flex-col items-center">
            <div className={iconClass}>
              <svg viewBox="0 0 48 48" className={elevated ? "h-[22px] w-[22px]" : "h-5 w-5"} fill="none" aria-hidden="true">
                <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
              </svg>
            </div>
            <p className={elevated ? "mt-2.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-300" : "mt-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300"}>{product?.brand || "Product"}</p>
            <p className="mt-0.5 text-[9px] text-zinc-500 dark:text-zinc-500">{imagePreparing}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getFreeResultV2ProductRoles(locale = "ko") {
  return locale === "en"
    ? [
        { key: "moisture", title: "Moisture boost", body: "Core role", primary: true },
        { key: "light", title: "Light feel", body: "Keeps oil burden low" },
        { key: "daily", title: "Daily care", body: "Easy to keep using" }
      ]
    : [
        { key: "moisture", title: "수분 보강", body: "핵심 역할", primary: true },
        { key: "light", title: "가벼운 사용감", body: "유분 부담 최소화" },
        { key: "daily", title: "데일리 케어", body: "매일 편하게" }
      ];
}

function FreeResultV2RolePill({ role }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-[#ead9d6] bg-white/34 px-3 py-2 text-xs font-semibold text-[#26101a] dark:border-[#5a3a48] dark:bg-[#2a1b24]/74 dark:text-[#fff8f3]">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/26 bg-[#ff9aa8]/10 text-[#ff9aa8]">
        <FreeResultV2RoleIcon type={role.key} />
      </span>
      <span className="min-w-0 break-keep">{role.title}</span>
    </span>
  );
}

function FreeResultV2TabbedRoutinePreview({ routinePreview, locale = "ko" }) {
  const isEnglish = locale === "en";
  const [activeRoutine, setActiveRoutine] = useState("morning");
  const tabs = [
    {
      key: "morning",
      label: isEnglish ? "Morning routine" : "아침 루틴",
      tone: "morning",
      steps: routinePreview?.morningSteps || []
    },
    {
      key: "night",
      label: isEnglish ? "Night routine" : "저녁 루틴",
      tone: "night",
      steps: routinePreview?.nightSteps || []
    }
  ];
  const activeTab = tabs.find((tab) => tab.key === activeRoutine) || tabs[0];
  const safeSteps = activeTab.steps.slice(0, 3);

  return (
    <FreeResultV2Card>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">{isEnglish ? "Custom use routine" : "맞춤 활용 루틴"}</p>
        <span className="text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
          {isEnglish ? "Switch morning and night." : "아침과 저녁 루틴을 전환해 보세요."}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-[1.15rem] border border-[#ead9d6] bg-white/28 p-1 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveRoutine(tab.key)}
              className={`inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[linear-gradient(135deg,#f45f88,#ff7b68)] text-white shadow-[0_14px_28px_rgba(230,80,122,0.22)]"
                  : "text-[#7a5360] hover:bg-white/40 dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
              }`}
              aria-pressed={isActive}
            >
              <FreeResultV2RoutineModeIcon tone={tab.tone} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_1rem_minmax(0,1fr)_1rem_minmax(0,1fr)] items-stretch gap-2">
        {safeSteps.map((step, index) => (
          <Fragment key={`${activeTab.key}-${step}`}>
            <div className="min-w-0 rounded-[1rem] border border-[#ead9d6] bg-white/34 px-2.5 py-3 text-center dark:border-[#5a3a48] dark:bg-[#2a1b24]/74">
              <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-[#f2c4ca] bg-[#fff8f3] text-[11px] font-semibold text-[#e6507a] dark:border-[#6a4353] dark:bg-[#241720] dark:text-[#ff9aa8]">
                {index + 1}
              </span>
              <span className="mt-2 block break-keep text-xs font-semibold leading-5 text-[#3a1824] dark:text-[#f3e4df]">{step}</span>
            </div>
            {index < safeSteps.length - 1 ? (
              <div className="flex items-center justify-center text-[#b17888] dark:text-[#d6a1af]" aria-hidden="true">→</div>
            ) : null}
          </Fragment>
        ))}
      </div>

      <p className="mt-4 rounded-[0.95rem] border border-[#ead9d6] bg-white/30 px-3 py-2 text-xs leading-5 text-[#7a5360] dark:border-[#5a3a48] dark:bg-[#2a1b24]/62 dark:text-[#c8aeb8]">
        {routinePreview?.gateNote || (isEnglish ? "Detailed order and frequency continue in the full report." : "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요.")}
      </p>
    </FreeResultV2Card>
  );
}

function FreeResultV2Step3PremiumPreview({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const items = isEnglish
    ? ["Why this product ranked #1", "Alternatives if it does not fit", "Detailed morning/night order"]
    : ["왜 이 제품이 1순위인지", "안 맞을 때 대체 제품", "아침/저녁 상세 사용 순서"];

  return (
    <FreeResultV2Card className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/32 bg-[#ff9aa8]/10 text-[#ff9aa8]">
          <FreeResultV2LockIcon />
        </span>
        <div className="min-w-0">
          <p className="break-keep text-base font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
            {isEnglish ? "Unlocked in the full report" : "전체 리포트에서 열리는 내용"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
            {isEnglish ? "The key details continue after this preview." : "결제 후 아래 핵심 정보를 이어서 확인할 수 있어요."}
          </p>
        </div>
      </div>
      <div className="overflow-hidden rounded-[1.15rem] border border-[#ead9d6] bg-white/28 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
        {items.map((item, index) => (
          <div key={item} className={`flex items-center gap-3 px-3.5 py-3 ${index ? "border-t border-[#ead9d6]/80 dark:border-[#5a3a48]" : ""}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/28 bg-[#ff9aa8]/10 text-[#ff9aa8]">
              <FreeResultV2LockIcon />
            </span>
            <span className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item}</span>
          </div>
        ))}
      </div>
    </FreeResultV2Card>
  );
}

export default function FreeResultV2RecommendationGuideStep({ preview, routinePreview, copy, locale = "ko" }) {
  const isEnglish = locale === "en";
  const productRoles = getFreeResultV2ProductRoles(locale);

  return (
    <FreeResultV2StepFrame
      eyebrow={isEnglish ? "Recommendation guide" : "추천 & 활용"}
      title={isEnglish ? "Recommendation & Use Guide" : "추천 & 활용 가이드"}
      body={isEnglish ? "Your matched product and how to use it, in one flow." : "맞춤 추천 제품과 사용 방향을 한 번에 정리했어요."}
    >
      {preview ? (
        <FreeResultV2Card className="bg-[linear-gradient(145deg,rgba(255,250,246,0.96),rgba(255,244,241,0.88))] dark:bg-[linear-gradient(145deg,rgba(36,23,32,0.98),rgba(31,18,27,0.98))]">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#ff9aa8]/36 bg-[#ff9aa8]/10 px-3 py-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#e6507a] dark:text-[#ff9aa8]">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="m5 8.4 3.5 2.2L12 5l3.5 5.6L19 8.4 17.8 17H6.2L5 8.4Z" />
            </svg>
            Top Pick
          </span>
          <div className="mt-4 grid grid-cols-[6.4rem_minmax(0,1fr)] gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-center">
            <SmallProductThumb product={preview.product} height="h-32 sm:h-56" locale={locale} elevated />
            <div className="min-w-0">
              <h3 className="break-keep text-[1.45rem] font-semibold leading-tight text-[#26101a] dark:text-[#fff8f3] sm:text-[1.75rem]">
                {preview.product.name}
              </h3>
              <p className="mt-2 text-base font-semibold text-[#e6507a] dark:text-[#ff9aa8]">{preview.product.brand}</p>
              <p className="mt-4 text-sm leading-7 text-[#3a1824] dark:text-[#f3e4df]">“{preview.reason}”</p>
            </div>
          </div>
          <div className="mt-4 border-t border-[#ead9d6] pt-4 dark:border-[#5a3a48]">
            <p className="text-xs font-semibold text-[#b3949f] dark:text-[#c8aeb8]">{isEnglish ? "Core roles" : "핵심 역할"}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {productRoles.map((role) => (
                <FreeResultV2RolePill key={role.key} role={role} />
              ))}
            </div>
          </div>
        </FreeResultV2Card>
      ) : (
        <TopPickFallbackCard copy={copy} locale={locale} />
      )}

      <FreeResultV2TabbedRoutinePreview routinePreview={routinePreview} locale={locale} />
      <FreeResultV2Step3PremiumPreview locale={locale} />

    </FreeResultV2StepFrame>
  );
}

function TopPickFallbackCard({ copy, locale = "ko" }) {
  return (
    <section className="rounded-[2rem] border border-[#ead9d2] bg-[#fffaf5] p-5 text-sm leading-6 text-[#69424f] shadow-[0_24px_70px_rgba(35,16,25,0.14)] dark:border-[#4a303c] dark:bg-[#241720] dark:text-[#c8aeb8]">
      <div className="rounded-[1.5rem] border border-[#ead9d6] bg-white/58 p-5 text-center dark:border-[#5a3a48] dark:bg-[#2a1b24]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[#ead9d6] bg-[#fff4f1] text-[#e6507a] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#ff9aa8]">
          <svg viewBox="0 0 48 48" className="h-8 w-8" fill="none" aria-hidden="true">
            <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
          </svg>
        </div>
        <p className="mt-4 font-semibold text-[#26101a] dark:text-[#fff8f3]">
          {copy.topPickEmpty}
        </p>
        <p className="mt-2 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
          {locale === "en"
            ? "The rest of the free report is still available from your analysis data."
            : "제품 데이터가 비어도 분석 요약과 루틴 가이드는 계속 확인할 수 있습니다."}
        </p>
      </div>
    </section>
  );
}
