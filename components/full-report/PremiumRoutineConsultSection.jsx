"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import CurrentProductSlotNote from "@/components/result/premium/CurrentProductSlotNote";
import { buildCurrentProductRoutineSlots } from "@/lib/current-products";
import { getCurrentProductVerdictSlotKey } from "@/lib/current-product-verdicts";

function RoutineConsultProductInline({ product, locale = "ko", copy }) {
  if (!product) {
    return (
      <div className="mt-3 rounded-[0.9rem] border border-white/10 bg-white/[0.035] px-3 py-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {locale === "en" ? "No specific item is fixed for this step yet." : "현재 입력값 기준으로 고정된 항목은 아직 없습니다."}
      </div>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-[0.95rem] border border-white/10 bg-white/[0.035] p-3">
      {product.image_url ? (
        <div className="h-12 w-10 overflow-hidden rounded-[1.25rem] border border-white/10 bg-zinc-900/70">
          <img src={product.image_url} alt={product.name || "Product"} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="mt-1 h-9 w-8 rounded-[0.7rem] border border-white/10 bg-white/5" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {locale === "en" ? "RECOMMENDED FOR THIS STEP" : "이 단계 추천 제품"}
        </p>
        <p className="mt-1 break-words text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{product.name}</p>
        {product.brand ? <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{product.brand}</p> : null}
      </div>
    </div>
  );
}

function RoutineConsultStatusBadge({ status }) {
  const tone = status === "고정" || status === "Fixed"
    ? "border-[#e79582]/45 bg-[#e87662]/12 text-[#a55349] dark:border-[#e79582]/35 dark:bg-[#e87662]/16 dark:text-[#f0b7a7]"
    : status === "생략 가능" || status === "Skippable"
      ? "border-zinc-300/60 bg-zinc-500/8 text-zinc-600 dark:border-zinc-700 dark:bg-white/5 dark:text-zinc-300"
      : "border-[#d8b5aa]/55 bg-white/45 text-[#7a5c55] dark:border-[#6d3f3a]/58 dark:bg-white/5 dark:text-[#d6beb6]";

  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-semibold ${tone}`}>
      {status}
    </span>
  );
}

function RoutineConsultStepCard({ step, direction = "left", locale = "ko", copy, getCurrentProductVerdict }) {
  const cardRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();
  const [isVisible, setIsVisible] = useState(false);
  const initialX = direction === "right" ? 22 : -22;
  const visibleState = { opacity: 1, x: 0 };
  const hiddenState = { opacity: 0, x: initialX };
  const motionState = prefersReducedMotion || isVisible ? visibleState : hiddenState;

  useEffect(() => {
    const node = cardRef.current;

    if (!node || prefersReducedMotion) {
      setIsVisible(true);
      return undefined;
    }

    setIsVisible(false);

    let observer;
    const revealIfVisible = () => {
      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;

      if (rect.top < viewportHeight * 0.92 && rect.bottom > viewportHeight * 0.04) {
        setIsVisible(true);
        observer?.disconnect();
        window.removeEventListener("scroll", revealIfVisible);
        window.removeEventListener("resize", revealIfVisible);
      }
    };

    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer?.disconnect();
            window.removeEventListener("scroll", revealIfVisible);
            window.removeEventListener("resize", revealIfVisible);
          }
        },
        { threshold: 0.08 }
      );
      observer.observe(node);
    }

    window.addEventListener("scroll", revealIfVisible, { passive: true });
    window.addEventListener("resize", revealIfVisible);
    revealIfVisible();

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", revealIfVisible);
      window.removeEventListener("resize", revealIfVisible);
    };
  }, [prefersReducedMotion, step.order, step.title, direction]);

  return (
    <motion.article
      ref={cardRef}
      initial={prefersReducedMotion ? false : hiddenState}
      animate={motionState}
      transition={{ duration: 0.42, ease: "easeOut" }}
      className="rounded-[1.1rem] border border-white/10 bg-white/5 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      data-routine-flow-card={direction}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2b1f26] text-xs font-semibold text-white dark:bg-[#f5ded4] dark:text-[#271318]">
          {step.order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ui-title text-base leading-6">{step.title}</h3>
            <RoutineConsultStatusBadge status={step.status} />
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{step.action}</p>
          <RoutineConsultProductInline product={step.product} locale={locale} copy={copy} />
          <CurrentProductSlotNote
            items={step.currentProducts}
            getVerdict={getCurrentProductVerdict}
            locale={locale}
          />
          <p className="mt-3 rounded-[0.9rem] bg-white/5 px-3 py-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {locale === "en" ? "Tip" : "Tip"}
            </span>
            <span className="mx-1 text-zinc-400">·</span>
            {step.adjustment}
          </p>
        </div>
      </div>
    </motion.article>
  );
}

function RoutineModeSwitch({ activeMode, locale = "ko", onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-[1rem] border border-white/10 bg-white/5 p-1">
      {[
        ["morning", locale === "en" ? "Morning routine" : "아침 루틴"],
        ["night", locale === "en" ? "Evening routine" : "저녁 루틴"]
      ].map(([modeKey, label]) => {
        const active = activeMode === modeKey;

        return (
          <button
            key={modeKey}
            type="button"
            onClick={() => onChange(modeKey)}
            className={`min-h-11 rounded-[0.85rem] px-3 text-sm font-semibold transition ${
              active
                ? "bg-[linear-gradient(135deg,#e87662_0%,#f2aa91_100%)] text-white shadow-[0_10px_24px_rgba(215,111,91,0.22)]"
                : "text-zinc-600 hover:bg-white/50 dark:text-zinc-300 dark:hover:bg-white/8"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default function PremiumRoutineConsultSection({
  freeResult,
  report,
  morningSteps = [],
  nightSteps = [],
  copy,
  locale = "ko",
  onNavigate,
  getMeta,
  buildSteps
}) {
  const [activeMode, setActiveMode] = useState("morning");
  const routineTopRef = useRef(null);
  const meta = getMeta(activeMode, locale);
  const currentProductSlots = buildCurrentProductRoutineSlots(report?.currentProducts, locale);
  const currentProductVerdictMap = new Map(
    Array.isArray(report?.currentProductVerdicts)
      ? report.currentProductVerdicts
          .filter((verdict) => verdict?.slotKey)
          .map((verdict) => [verdict.slotKey, verdict])
      : []
  );
  const getCurrentProductVerdict = (item) => {
    if (!item || item.status === "not_using") {
      return null;
    }

    return currentProductVerdictMap.get(
      getCurrentProductVerdictSlotKey(activeMode === "morning" ? "am" : "pm", item.slot, item.category)
    ) || null;
  };
  const displaySteps = buildSteps({
    mode: activeMode,
    freeResult,
    report,
    morningSteps,
    nightSteps,
    locale,
    currentProductSlots
  });
  const isMorning = activeMode === "morning";
  const functionalCurrentProducts = !isMorning && Array.isArray(currentProductSlots?.pm?.functional)
    ? currentProductSlots.pm.functional
    : [];
  const scrollToRoutineTop = () => {
    if (typeof window === "undefined") {
      return;
    }

    window.requestAnimationFrame(() => {
      const top = routineTopRef.current?.getBoundingClientRect().top ?? 0;

      if (top < 12 || top > window.innerHeight * 0.35) {
        routineTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  };
  const switchToMode = (nextMode, shouldScroll = true) => {
    if (nextMode === activeMode) {
      if (shouldScroll) {
        scrollToRoutineTop();
      }

      return;
    }

    setActiveMode(nextMode);

    if (shouldScroll) {
      scrollToRoutineTop();
    }
  };

  return (
    <section ref={routineTopRef} className="ui-card p-5 sm:p-6">
      <div className="flex flex-col gap-4">
        <div>
          <p className="ui-kicker">{locale === "en" ? "ROUTINE CONSULT" : "루틴 상담"}</p>
          <h3 className="ui-title mt-2 text-xl leading-tight">{meta.title}</h3>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{meta.body}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {meta.chips.map((chip) => (
              <span key={chip} className="ui-chip-compact px-3 py-1.5">{chip}</span>
            ))}
          </div>
        </div>

        <RoutineModeSwitch activeMode={activeMode} locale={locale} onChange={switchToMode} />

        <div key={activeMode} className="grid gap-4 overflow-hidden py-1">
          {displaySteps.map((step, index) => (
            <RoutineConsultStepCard
              key={`${activeMode}-${step.order}-${step.title}`}
              step={step}
              direction={index % 2 === 1 ? "right" : "left"}
              copy={copy}
              locale={locale}
              getCurrentProductVerdict={getCurrentProductVerdict}
            />
          ))}
        </div>

        {functionalCurrentProducts.length ? (
          <div className="rounded-[1rem] border border-white/10 bg-white/[0.035] p-3">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
              {locale === "en" ? "Active selections" : "기능성 선택값"}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {locale === "en"
                ? "Check these in the functional plan rather than adding them to the routine here."
                : "여기서 루틴을 늘리기보다 별도 기능성 플랜에서 확인합니다."}
            </p>
            <CurrentProductSlotNote
              items={functionalCurrentProducts}
              compact
              getVerdict={getCurrentProductVerdict}
              locale={locale}
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (isMorning) {
              switchToMode("night", true);
              return;
            }

            onNavigate?.("product-plan");
          }}
          className="ui-button-primary mt-1 min-h-12 w-full justify-center px-5 text-sm font-semibold"
        >
          {isMorning
            ? locale === "en" ? "See evening routine" : "저녁 루틴 보기"
            : locale === "en" ? "See functional plan" : "기능성 플랜 보기"}
        </button>
      </div>
    </section>
  );
}
