"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const LOADING_STEPS = {
  ko: [
    { label: "피부 신호 분석", status: "피부 신호 분석 중", threshold: 30 },
    { label: "루틴 최적화", status: "루틴 우선순위 정리 중", threshold: 60 },
    { label: "제품 매칭", status: "제품 매칭 중", threshold: 85 },
    { label: "플랜 완성", status: "플랜 완성 중", threshold: 100 }
  ],
  en: [
    { label: "Skin signals", status: "Analyzing skin signals", threshold: 30 },
    { label: "Routine order", status: "Prioritizing routine order", threshold: 60 },
    { label: "Product match", status: "Matching products", threshold: 85 },
    { label: "Plan ready", status: "Finalizing the plan", threshold: 100 }
  ]
};

const COPY = {
  ko: {
    brand: "Be Jewely",
    report: "PREMIUM REPORT",
    loadingTitle: "Skin Match 분석 중",
    loadingBody: "당신의 피부 데이터를 분석하고 맞춤 플랜을 구성하고 있어요.",
    completeTitle: "플랜이 생성되었어요!",
    completeBody: "물방울을 눌러 나만의 Skin Match 플랜을 확인해보세요.",
    tapHint: "물방울을 눌러주세요",
    openPlan: "내 플랜 열기",
    cardBody: "분석 결과를 기반으로 가장 적합한 플랜을 만들고 있어요",
    openAria: "생성된 Skin Match 플랜 열기"
  },
  en: {
    brand: "Be Jewely",
    report: "PREMIUM REPORT",
    loadingTitle: "Analyzing Skin Match",
    loadingBody: "We are reading your skin data and shaping your personalized plan.",
    completeTitle: "Your plan is ready!",
    completeBody: "Tap the drop to open your Skin Match plan.",
    tapHint: "Tap the drop",
    openPlan: "Open my plan",
    cardBody: "Creating the most relevant plan from your analysis result.",
    openAria: "Open generated Skin Match plan"
  }
};

function getLocaleFromPath(pathname = "") {
  return pathname.startsWith("/en/") ? "en" : "ko";
}

function getTargetPath(locale = "ko") {
  return locale === "en" ? "/en/result/full-report" : "/result/full-report";
}

function getStepIndex(progress) {
  if (progress <= 30) {
    return 0;
  }
  if (progress <= 60) {
    return 1;
  }
  if (progress <= 85) {
    return 2;
  }
  return 3;
}

function PremiumReportLoadingStyles() {
  return (
    <style>{`
      .premium-loading-page {
        min-height: 100vh;
        overflow-x: hidden;
        background:
          radial-gradient(circle at 50% 4%, rgba(255, 249, 245, 0.98) 0%, rgba(250, 238, 230, 0.96) 44%, rgba(239, 222, 211, 0.96) 100%);
        color: #3c2428;
      }

      html.dark .premium-loading-page {
        background:
          radial-gradient(circle at 48% 4%, rgba(60, 33, 39, 0.94) 0%, rgba(30, 15, 20, 0.97) 48%, #12080d 100%);
        color: #fff3ed;
      }

      .premium-loading-shell {
        margin: 0 auto;
        display: flex;
        min-height: 100vh;
        width: 100%;
        max-width: 31rem;
        flex-direction: column;
        padding: 2.2rem 1.5rem 2rem;
      }

      @media (min-width: 900px) {
        .premium-loading-shell {
          max-width: 54rem;
          padding-top: 2.8rem;
        }
      }

      .premium-drop-button {
        position: relative;
        display: grid;
        place-items: center;
        width: min(68vw, 17.5rem);
        aspect-ratio: 0.78;
        border: 0;
        background: transparent;
        cursor: pointer;
        outline: none;
        transform-origin: 50% 88%;
        transition: transform 0.25s ease, filter 0.25s ease;
      }

      .premium-drop-button:focus-visible {
        filter: drop-shadow(0 0 0.85rem rgba(230, 122, 98, 0.42));
      }

      .premium-drop-button:not(:disabled):hover {
        transform: translateY(-0.18rem) scale(1.01);
      }

      .premium-drop-button.is-dropping {
        animation: dropPress 0.9s cubic-bezier(.2,.7,.3,1) forwards;
        pointer-events: none;
      }

      .premium-drop-shape {
        position: absolute;
        inset: 0;
        overflow: hidden;
        border: 1px solid rgba(215, 142, 126, 0.52);
        border-radius: 58% 58% 62% 62% / 72% 72% 42% 42%;
        background:
          radial-gradient(circle at 32% 24%, rgba(255,255,255,0.9), transparent 15%),
          radial-gradient(circle at 70% 30%, rgba(255,255,255,0.5), transparent 8%),
          linear-gradient(160deg, rgba(255,255,255,0.72), rgba(255,239,231,0.28));
        box-shadow:
          inset 0 0.35rem 1rem rgba(255,255,255,0.72),
          inset 0 -0.35rem 1.2rem rgba(207,111,94,0.16),
          0 1.2rem 3rem rgba(188,109,89,0.18);
        clip-path: path("M 118 4 C 106 28 35 100 35 168 C 35 232 80 276 138 276 C 196 276 241 232 241 168 C 241 100 170 28 158 4 C 150 -7 126 -7 118 4 Z");
      }

      html.dark .premium-drop-shape {
        border-color: rgba(239, 174, 154, 0.46);
        background:
          radial-gradient(circle at 32% 24%, rgba(255,238,232,0.7), transparent 14%),
          radial-gradient(circle at 70% 30%, rgba(255,219,207,0.36), transparent 9%),
          linear-gradient(160deg, rgba(255,221,209,0.25), rgba(56,28,33,0.28));
        box-shadow:
          inset 0 0.35rem 1rem rgba(255,232,224,0.18),
          inset 0 -0.35rem 1.2rem rgba(218,108,88,0.18),
          0 0 2.6rem rgba(225,128,105,0.16);
      }

      .premium-drop-fill {
        position: absolute;
        left: -12%;
        right: -12%;
        bottom: -2%;
        border-radius: 45% 45% 40% 40%;
        background:
          radial-gradient(circle at 48% 16%, rgba(255,230,221,0.72), transparent 24%),
          linear-gradient(180deg, rgba(244, 176, 158, 0.92), rgba(228, 111, 94, 0.9));
        transition: height 0.42s ease;
      }

      .premium-drop-fill::before {
        content: "";
        position: absolute;
        left: 0;
        top: -0.55rem;
        width: 200%;
        height: 1.2rem;
        background: rgba(255,255,255,0.42);
        border-radius: 50%;
        animation: liquidWave 3s ease-in-out infinite;
      }

      .premium-drop-percent {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #d66d61;
        text-shadow: 0 1px 0 rgba(255,255,255,0.56);
      }

      html.dark .premium-drop-percent {
        color: #ffc0ad;
        text-shadow: 0 1px 0 rgba(34,12,18,0.4);
      }

      .premium-ripple {
        position: absolute;
        left: 50%;
        bottom: -1.5rem;
        width: 9rem;
        height: 2.7rem;
        border: 1px solid rgba(225, 126, 103, 0.28);
        border-radius: 999px;
        transform: translateX(-50%);
        opacity: 0.7;
        animation: softRipple 2.4s ease-in-out infinite;
      }

      .premium-ripple::after {
        content: "";
        position: absolute;
        inset: 0.45rem 1.2rem;
        border: 1px solid rgba(225, 126, 103, 0.16);
        border-radius: 999px;
      }

      .premium-ripple.is-transitioning {
        animation: expandRipple 0.95s ease-out forwards;
      }

      @keyframes liquidWave {
        0%, 100% { transform: translateX(-35%) translateY(0); }
        50% { transform: translateX(-48%) translateY(0.18rem); }
      }

      @keyframes softRipple {
        0%, 100% { transform: translateX(-50%) scale(0.96); opacity: 0.45; }
        50% { transform: translateX(-50%) scale(1.08); opacity: 0.72; }
      }

      @keyframes expandRipple {
        0% { transform: translateX(-50%) scale(1); opacity: 0.68; }
        100% { transform: translateX(-50%) scale(7); opacity: 0; }
      }

      @keyframes dropPress {
        0% { transform: translateY(0) scale(1); }
        22% { transform: translateY(0.3rem) scale(0.96, 0.99); }
        62% { transform: translateY(2.1rem) scale(0.98); }
        100% { transform: translateY(2.1rem) scale(0.96); opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .premium-drop-button,
        .premium-drop-fill,
        .premium-drop-fill::before,
        .premium-ripple,
        .premium-ripple.is-transitioning {
          animation: none;
          transition: none;
        }
      }
    `}</style>
  );
}

export default function PremiumReportLoadingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPath(pathname || "");
  const copy = COPY[locale] || COPY.ko;
  const steps = LOADING_STEPS[locale] || LOADING_STEPS.ko;
  const [progress, setProgress] = useState(7);
  const [isComplete, setIsComplete] = useState(false);
  const [isDropping, setIsDropping] = useState(false);
  const activeStepIndex = useMemo(() => getStepIndex(progress), [progress]);
  const activeStep = steps[activeStepIndex] || steps[0];

  useEffect(() => {
    if (isComplete) {
      return;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, Math.round(7 + (elapsed / 3800) * 93));

      setProgress(nextProgress);

      if (nextProgress >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => setIsComplete(true), 450);
      }
    }, 110);

    return () => window.clearInterval(timer);
  }, [isComplete]);

  function openFullReport() {
    if (isDropping) {
      return;
    }

    setIsDropping(true);

    window.setTimeout(() => {
      router.push(getTargetPath(locale));
    }, 950);
  }

  return (
    <main className="premium-loading-page">
      <PremiumReportLoadingStyles />
      <div className="premium-loading-shell">
        <header className="text-center">
          <p className="font-serif text-[2rem] font-semibold leading-none tracking-[0.04em] text-[#4a2425] dark:text-[#f5d7cd]">
            {copy.brand}
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.36em] text-[#7d4b43] dark:text-[#c6a199]">
            {copy.report}
          </p>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center py-8 text-center sm:py-10">
          <div className="min-h-[7rem]">
            <h1 className="font-serif text-[2rem] font-semibold leading-tight text-[#4a2425] dark:text-[#fff1e9] sm:text-[2.35rem]">
              {isComplete ? copy.completeTitle : copy.loadingTitle}
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-[#6d4e49] dark:text-[#e2c5bd]">
              {isComplete ? copy.completeBody : copy.loadingBody}
            </p>
          </div>

          <div className="relative mt-5 flex min-h-[22rem] w-full items-center justify-center">
            <button
              type="button"
              aria-label={copy.openAria}
              disabled={!isComplete && progress < 100}
              onClick={openFullReport}
              className={`premium-drop-button ${isDropping ? "is-dropping" : ""}`}
            >
              <span className="premium-drop-shape">
                <span className="premium-drop-fill" style={{ height: `${progress}%` }} />
              </span>
              <span className="premium-drop-percent">
                {!isComplete ? (
                  <>
                    <span className="text-[2.75rem] font-semibold leading-none">{progress}</span>
                    <span className="mt-1 text-sm font-semibold">%</span>
                  </>
                ) : (
                  <span className="text-[2rem] font-semibold leading-tight">✧</span>
                )}
              </span>
            </button>
            <span className={`premium-ripple ${isDropping ? "is-transitioning" : ""}`} />
          </div>

          <div className="mt-1 min-h-[3.5rem]">
            <p className="text-base font-semibold text-[#cc6f61] dark:text-[#ffc0ad]">
              {isComplete ? copy.tapHint : activeStep.status}
            </p>
            {isComplete ? (
              <button
                type="button"
                onClick={openFullReport}
                className="mt-4 min-h-11 rounded-full bg-[linear-gradient(135deg,#e87662_0%,#f2aa91_100%)] px-6 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(215,111,91,0.24)]"
              >
                {copy.openPlan}
              </button>
            ) : null}
          </div>
        </section>

        <section className="space-y-5">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((step, index) => {
              const active = index <= activeStepIndex;

              return (
                <div key={step.label} className="min-w-0 text-center">
                  <div className="flex items-center justify-center">
                    <span className={`h-7 w-7 rounded-full border ${
                      active
                        ? "border-[#e27968] bg-[#fff1ea] text-[#d86f62] dark:border-[#f0a794] dark:bg-[#351d22] dark:text-[#ffc0ad]"
                        : "border-[#ead8d0] bg-[#fff9f5] text-[#d8bcb2] dark:border-[#4a3036] dark:bg-[#211318] dark:text-[#765a57]"
                    }`}>
                      <span className="flex h-full items-center justify-center text-xs font-semibold">
                        {active ? "✓" : ""}
                      </span>
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] leading-4 text-[#7a5b55] dark:text-[#c8aaa2]">
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="rounded-[1.25rem] border border-[#ead6cc] bg-[#fffaf5]/78 px-4 py-4 text-left shadow-[0_14px_36px_rgba(106,65,49,0.07)] dark:border-[#4b3035] dark:bg-[#21151a]/78 dark:shadow-none">
            <div className="flex gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff1ea] text-[#d86f62] dark:bg-[#321b21] dark:text-[#ffc0ad]">
                ✧
              </span>
              <p className="text-sm font-semibold leading-6 text-[#4d302f] dark:text-[#f6ddd4]">
                {copy.cardBody}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
