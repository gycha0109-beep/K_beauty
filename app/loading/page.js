"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const TOTAL_DURATION_MS = 15000;

const loadingSteps = [
  {
    at: "0~5초",
    label: "사진 신호를 확인하고 있어요",
    detail: "업로드된 얼굴 이미지에서 보이는 피부 단서를 정리합니다."
  },
  {
    at: "5~10초",
    label: "설문 답변과 피부 패턴을 맞춰보고 있어요",
    detail: "사진에서 보인 흐름과 사용자가 답한 피부 고민을 함께 비교합니다."
  },
  {
    at: "10~15초",
    label: "관리 우선순위를 정리하고 있어요",
    detail: "지금 가장 먼저 볼 관리 축과 다음 행동을 압축합니다."
  }
];

const resultTags = ["속건조", "수분 부족", "유분 밸런스 필요"];

function getLoadingStepIndex(elapsedMs) {
  if (elapsedMs < 5000) {
    return 0;
  }

  if (elapsedMs < 10000) {
    return 1;
  }

  return 2;
}

export default function LoadingExperimentPage() {
  const router = useRouter();
  const [elapsedMs, setElapsedMs] = useState(0);
  const isComplete = elapsedMs >= TOTAL_DURATION_MS;
  const progress = Math.min(100, Math.round((elapsedMs / TOTAL_DURATION_MS) * 100));
  const activeStepIndex = getLoadingStepIndex(elapsedMs);
  const activeStep = loadingSteps[activeStepIndex];
  const progressStyle = useMemo(
    () => ({
      background: `conic-gradient(#e6507a ${progress}%, rgba(230,80,122,0.12) ${progress}%)`
    }),
    [progress]
  );

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      router.replace("/");
      return undefined;
    }

    const startedAt = Date.now();
    const timerId = window.setInterval(() => {
      setElapsedMs(Math.min(TOTAL_DURATION_MS, Date.now() - startedAt));
    }, 160);

    return () => window.clearInterval(timerId);
  }, [router]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7f2_0%,#f5e5e0_42%,#ead7cf_100%)] text-[#26101a] dark:bg-[radial-gradient(circle_at_top,#241720_0%,#1b1017_46%,#160d13_100%)] dark:text-[#fff8f3]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7e5261] dark:text-[#c8aeb8]">
              AI Beauty Platform
            </p>
            <p className="mt-0.5 text-sm font-semibold text-[#26101a] dark:text-[#fff8f3]">무료 결과 v2 테스트</p>
          </div>
          <span className="rounded-full border border-[#ead9d6] bg-white/68 px-3 py-1 text-[11px] font-semibold text-[#7a5360] dark:border-[#5a3a48] dark:bg-[#301f28]/78 dark:text-[#c8aeb8]">
            DEV FLOW
          </span>
        </div>

        <section className="flex flex-1 items-center py-8">
          {!isComplete ? (
            <motion.div
              key="loading"
              className="w-full rounded-[2rem] border border-[#ead9d6] bg-[#fffaf6] p-5 text-center shadow-[0_24px_70px_rgba(35,16,25,0.14)] dark:border-[#4a303c] dark:bg-[#241720]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36, ease: "easeOut" }}
            >
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#d9416f] dark:text-[#ff9aa8]">
                분석 중
              </p>
              <h1 className="mt-3 break-keep text-[1.55rem] font-semibold leading-[1.32] text-[#26101a] dark:text-[#fff8f3]">
                AI가 당신의 피부 신호를
                <br />
                정리하고 있어요
              </h1>
              <p className="mt-2 break-keep text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
                잠시만 기다려주세요.
              </p>

              <div className="mx-auto mt-8 flex h-40 w-40 items-center justify-center rounded-full p-2 shadow-[0_0_34px_rgba(230,80,122,0.12)]" style={progressStyle}>
                <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-[#fffaf6] dark:bg-[#241720]">
                  <span className="text-[2.2rem] font-semibold leading-none text-[#26101a] dark:text-[#fff8f3]">{progress}%</span>
                  <span className="mt-1 text-[11px] font-semibold text-[#d9416f] dark:text-[#ff9aa8]">15초 테스트</span>
                </div>
              </div>

              <div className="mt-7 rounded-[1.35rem] border border-[#ead9d6] bg-white/34 p-4 text-left dark:border-[#5a3a48] dark:bg-[#2a1b24]/64">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff7d9b] text-[12px] font-semibold text-white dark:bg-[#ff8fa2] dark:text-[#25131d]">
                    {activeStepIndex + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#d9416f] dark:text-[#ff9aa8]">{activeStep.at}</p>
                    <p className="mt-1 break-keep text-sm font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">{activeStep.label}</p>
                    <p className="mt-1 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{activeStep.detail}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-left">
                {loadingSteps.map((step, index) => {
                  const isDone = activeStepIndex > index || isComplete;
                  const isActive = activeStepIndex === index && !isComplete;

                  return (
                    <div key={step.label} className="flex items-center gap-2 text-[12px] text-[#7a5360] dark:text-[#c8aeb8]">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                        isDone
                          ? "border-[#e6507a] bg-[#e6507a] text-white dark:border-[#ff8fa2] dark:bg-[#ff8fa2] dark:text-[#25131d]"
                          : isActive
                            ? "border-[#e6507a] text-[#e6507a] dark:border-[#ff8fa2] dark:text-[#ff8fa2]"
                            : "border-[#d9c1c8] text-[#9a6c78] dark:border-[#5a3a48] dark:text-[#8f7480]"
                      }`}>
                        {isDone ? "✓" : index + 1}
                      </span>
                      <span className={isActive ? "font-semibold text-[#4d2635] dark:text-[#f1d9e2]" : ""}>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="complete"
              className="w-full rounded-[2rem] border border-[#ead9d6] bg-[#fffaf6] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.14)] dark:border-[#4a303c] dark:bg-[#241720]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f45f88,#ff7b68)] text-white shadow-[0_16px_34px_rgba(230,80,122,0.22)]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                  <path d="m7 12.2 3.1 3.1L17.5 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <div className="mt-5 text-center">
                <p className="text-[12px] font-semibold text-[#d9416f] dark:text-[#ff9aa8]">분석 완료</p>
                <p className="mt-2 text-[13px] font-semibold text-[#7a5360] dark:text-[#c8aeb8]">AI가 찾은 핵심 패턴</p>
                <h1 className="mt-4 break-keep text-[1.75rem] font-semibold leading-[1.36] text-[#26101a] dark:text-[#fff8f3]">
                  겉으로는 번들거리는데,
                  <br />
                  <span className="text-[#e6507a] dark:text-[#ff8fa2]">속은 건조한 상태에</span>
                  <br />
                  가깝습니다.
                </h1>
                <p className="mx-auto mt-4 max-w-[18rem] break-keep text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
                  사진과 설문에서 확인된 신호를 바탕으로 정리했어요.
                </p>
              </div>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {resultTags.map((tag) => (
                  <span key={tag} className="rounded-full border border-[#ead9d6] bg-white/42 px-3 py-1.5 text-[12px] font-semibold text-[#5f3a48] dark:border-[#5a3a48] dark:bg-[#2a1b24]/68 dark:text-[#f1d9e2]">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="mt-7 rounded-[1.35rem] border border-[#ead9d6] bg-white/34 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]/64">
                <p className="break-keep text-sm font-semibold leading-6 text-[#4d2635] dark:text-[#f1d9e2]">
                  더 자세한 이유와 맞춤 관리 방향을 Step1에서 이어서 확인할 수 있어요.
                </p>
              </div>

              <Link
                href="/test-result"
                className="mt-4 inline-flex min-h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#f45f88,#ff7b68)] px-5 text-sm font-semibold text-white shadow-[0_20px_44px_rgba(230,80,122,0.28)] transition hover:brightness-105 active:scale-[0.99]"
              >
                진단 결과 보러가기
              </Link>
            </motion.div>
          )}
        </section>
      </div>
    </main>
  );
}
