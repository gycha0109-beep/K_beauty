"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ResultCard from "@/components/ResultCard";
import ResultSection from "@/components/ResultSection";
import LoadingSpinner from "@/components/LoadingSpinner";

const displayMap = {
  skinType: {
    oily: "지성",
    dry: "건성",
    combination: "복합성",
    not_sure: "잘 모르겠음"
  },
  mainConcern: {
    oiliness: "유분",
    dehydration: "건조",
    acne: "트러블",
    uneven_tone: "톤 불균일",
    pores: "모공",
    redness: "붉은기",
    barrier: "장벽 약화"
  }
};

const topPickHeadlineMap = {
  oiliness: "유분과 모공 흐름에서 가장 먼저 체감 차이가 나는 1순위",
  pores: "모공과 번들거림 기준으로 먼저 바꿔야 할 1순위",
  dehydration: "지금 피부 건조감에서 가장 먼저 보완할 1순위",
  acne: "트러블 부담을 줄이기 위해 먼저 바꿔야 할 1순위",
  uneven_tone: "톤 컨디션을 정리할 때 가장 먼저 손댈 1순위",
  redness: "예민하게 올라오는 피부에서 가장 먼저 바꿔야 할 1순위",
  barrier: "장벽이 흔들리는 지금 가장 먼저 써야 할 1순위"
};

const feedbackQuestions = [
  { id: "reflects_skin", text: "내 피부 상태를 잘 반영했나요?" },
  { id: "recommendation_makes_sense", text: "추천이 납득됐나요?" },
  { id: "worth_buying", text: "사볼 만한 제품이 있었나요?" }
];

const TRACKING_SESSION_KEY = "skinTestTrackingSessionId";

function getOrCreateTrackingSessionId() {
  if (typeof window === "undefined") {
    return null;
  }

  const existing = sessionStorage.getItem(TRACKING_SESSION_KEY);

  if (existing) {
    return existing;
  }

  const nextSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(TRACKING_SESSION_KEY, nextSessionId);
  return nextSessionId;
}

function trackEvent(eventName, data = {}) {
  const payload = {
    event_name: eventName,
    timestamp: new Date().toISOString(),
    session_id: data.session_id ?? getOrCreateTrackingSessionId(),
    product_id: data.product_id ?? null,
    feature_name: data.feature_name ?? "skin_analysis",
    result_type: data.result_type ?? null,
    is_top_pick: Boolean(data.is_top_pick),
    question_id: data.question_id ?? null,
    answer: data.answer ?? null,
    meta_json: data.meta_json ?? null
  };

  void fetch("/api/track", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
    keepalive: true
  })
    .then(async (response) => {
      if (!response.ok) {
        let details = null;

        try {
          details = await response.json();
        } catch {}

        console.error("[trackEvent] request failed", {
          status: response.status,
          details,
          payload
        });
      }
    })
    .catch((requestError) => {
      console.error("[trackEvent] request error", requestError, payload);
    });
}

function getTextureLabel(texture) {
  const map = {
    watery: "워터리하게",
    gel: "가볍게",
    lotion: "부드럽게",
    cream: "보습감 있게",
    heavy: "리치하게"
  };

  return map[texture] || "부담 없이";
}

function getFinishLabel(finish) {
  const map = {
    light: "마무리를 가볍게",
    natural: "표면을 과하게 남기지 않고",
    matte: "번들거림을 덜 남기고",
    "soft-matte": "번들 흐름을 눌러주고",
    dewy: "건조한 결을 덜 들뜨게 하고",
    rich: "보습막을 더 안정적으로 남기고",
    fresh: "답답함을 덜 남기고"
  };

  return map[finish] || "사용감을 더 깔끔하게";
}

function getTopPickHeadline(form) {
  return topPickHeadlineMap[form?.mainConcern] || "이 조건에서는 이 제품을 먼저 써야 합니다";
}

function getTopPickSummary(product, form) {
  const concern = displayMap.mainConcern[form?.mainConcern] || "현재 고민";
  const skinType = displayMap.skinType[form?.skinType] || "지금 피부";
  const texture = getTextureLabel(product.texture);
  const finish = getFinishLabel(product.finish);

  if (form?.mainConcern === "oiliness" || form?.mainConcern === "pores") {
    return `${concern} 고민이 함께 있는 ${skinType} 상태에서는, ${texture} 흡수되고 ${finish} 이 제품이 가장 먼저 체감 차이를 만듭니다.`;
  }

  if (form?.mainConcern === "dehydration" || form?.mainConcern === "barrier") {
    return `${skinType} 피부가 쉽게 메마르는 지금은, ${texture} 쌓이면서도 ${finish} 이 제품부터 바꾸는 편이 체감이 가장 큽니다.`;
  }

  if (form?.mainConcern === "redness" || form?.mainConcern === "acne") {
    return `${concern}이 반복되는 ${skinType} 상태에서는, ${finish} 자극 부담을 덜어주는 이 제품이 가장 먼저 손에 잡힐 선택입니다.`;
  }

  return `현재 ${concern} 기준에서는, ${texture} 이어지고 ${finish} 이 제품이 가장 먼저 피부 흐름을 정리해 줍니다.`;
}

function getUsageTimingLabel(useTime) {
  const value = Array.isArray(useTime) ? useTime[0] : useTime;
  const map = {
    day: "Morning",
    night: "Night",
    both: "Both"
  };

  return map[value] || "Both";
}

function getPriceLabel(priceRange) {
  if (!priceRange) {
    return "Price -";
  }

  return `Price ${priceRange}`;
}

function hasPurchaseLink(buyLink) {
  return Boolean(
    buyLink &&
      typeof buyLink === "string" &&
      buyLink.startsWith("http") &&
      !buyLink.includes("example.com")
  );
}

function getPurchaseLinkInfo(product) {
  if (hasPurchaseLink(product?.buy_link)) {
    return {
      href: product.buy_link,
      label: "구매하기",
      isFallback: false
    };
  }

  const query = encodeURIComponent(`${product?.brand || ""} ${product?.name || ""} 구매`);

  return {
    href: `https://search.shopping.naver.com/search/all?query=${query}`,
    label: "구매처 찾기",
    isFallback: true
  };
}

function getEspeciallyGoodFor(product, form) {
  if (form?.afternoonSkinChange === "more_oily" || form?.mainConcern === "oiliness") {
    return "오후 유분이 빠르게 올라오는 피부";
  }

  if (form?.postWashFeeling === "tight" || form?.mainConcern === "dehydration") {
    return "세안 후 당김이 오래 남는 피부";
  }

  if (
    (form?.environmentExposure || []).includes("mask") ||
    form?.skinType === "sensitive" ||
    form?.mainConcern === "redness"
  ) {
    return "마스크 마찰로 예민해지는 피부";
  }

  if (form?.mainConcern === "pores") {
    return "모공과 번들거림이 함께 신경 쓰이는 피부";
  }

  if (form?.mainConcern === "acne") {
    return "잔여감이 무거우면 트러블이 올라오는 피부";
  }

  if (product.use_time === "night") {
    return "밤 루틴에서 집중 관리가 필요한 날";
  }

  if (product.use_time === "day") {
    return "아침 루틴에서 가볍게 마무리하고 싶은 날";
  }

  return "매일 부담 없이 루틴을 이어가고 싶은 피부";
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
          <LoadingSpinner label="결과를 불러오는 중입니다..." />
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}

function ResultContent() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [feedback, setFeedback] = useState({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});

  useEffect(() => {
    const saved = sessionStorage.getItem("skinTestResult");
    const savedSubmission = sessionStorage.getItem("skinTestSubmission");

    if (saved) {
      try {
        setResult(JSON.parse(saved));
      } catch {
        setResult(null);
      }
    }

    if (savedSubmission) {
      try {
        setSubmission(JSON.parse(savedSubmission));
      } catch {
        setSubmission(null);
      }
    }

    setIsReady(true);
  }, []);

  useEffect(() => {
    if (isReady && result) {
      trackEvent("view_result", {
        product_id: result.topPick?.id || null,
        feature_name: "skin_analysis",
        result_type: "result_page",
        is_top_pick: false,
        meta_json: {
          has_top_pick: Boolean(result.topPick),
          category_pick_count: Array.isArray(result.categoryPicks) ? result.categoryPicks.length : 0
        }
      });
    }
  }, [isReady, result]);

  function handleFeedback(questionId, answer) {
    if (feedbackSubmitted[questionId]) {
      return;
    }

    setFeedback((current) => ({
      ...current,
      [questionId]: answer
    }));
    setFeedbackSubmitted((current) => ({
      ...current,
      [questionId]: true
    }));

    trackEvent("feedback_response", {
      product_id: result?.topPick?.id || null,
      feature_name: "feedback",
      result_type: "result_feedback",
      is_top_pick: false,
      question_id: questionId,
      answer,
      meta_json: {
        question_text: feedbackQuestions.find((item) => item.id === questionId)?.text || null
      }
    });
  }

  const error = searchParams.get("error");

  if (!isReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <LoadingSpinner label="결과를 불러오는 중입니다..." />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-col gap-6">
        <header className="overflow-hidden rounded-[2rem] border border-black/5 bg-white/85 shadow-soft backdrop-blur">
          <div className="bg-[linear-gradient(135deg,rgba(216,195,173,0.36),rgba(255,255,255,0.72))] px-6 py-8 sm:px-8 sm:py-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs uppercase tracking-[0.24em] text-black/40">Result</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                  Your K-Beauty Match
                </h1>
                <p className="mt-3 text-sm leading-6 text-black/65">
                  지금 바로 고를 제품이 먼저 보이도록 Top Pick을 맨 위에 두었습니다.
                  아래 카테고리 추천은 루틴을 채우는 보조 구성만 남겨 과하게 복잡하지 않게 정리했습니다.
                </p>
                {result?.meta?.notice ? (
                  <p className="mt-3 inline-flex rounded-full bg-white/75 px-3 py-1 text-xs text-black/55">
                    {result.meta.notice}
                  </p>
                ) : null}
              </div>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/80 px-5 py-3 text-sm font-medium text-black/75 transition hover:border-black/20 hover:bg-white"
              >
                다시 테스트하기
              </Link>
            </div>
          </div>

          {result ? (
            <div className="grid gap-3 border-t border-black/5 bg-white/70 px-6 py-5 text-sm text-black/60 sm:grid-cols-3 sm:px-8">
              <InsightStat
                label="Skin Type"
                value={displayMap.skinType[submission?.form?.skinType] || "맞춤 루틴"}
              />
              <InsightStat label="Routine" value="Morning + Night 3 steps" />
              <InsightStat
                label="Top Concern"
                value={displayMap.mainConcern[submission?.form?.mainConcern] || "현재 고민 기준"}
              />
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-[2rem] border border-red-200 bg-[linear-gradient(180deg,#fff7f7_0%,#fff1f1_100%)] p-6 text-sm leading-6 text-red-600 shadow-soft">
            <p className="font-semibold text-red-700">결과를 불러오지 못했습니다.</p>
            <p className="mt-2">{error}</p>
          </div>
        ) : null}

        {!error && !result ? (
          <div className="rounded-[2rem] border border-black/5 bg-white/85 p-6 text-sm leading-6 text-black/65 shadow-soft">
            표시할 결과가 없습니다. 홈으로 돌아가 다시 테스트해 주세요.
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <ResultSection
                title="Top Pick"
                subtitle="지금 가장 먼저 집어야 할 제품만 바로 보이게 정리했습니다."
              >
                {result.topPick ? (
                  <ProductDecisionCard
                    product={result.topPick}
                    featured
                    form={submission?.form}
                  />
                ) : null}
              </ResultSection>
            </div>

            <ResultCard title="피부 요약" text={result.summary} tone="accent" />
            <ResultCard title="핵심 전략" text={result.strategy} tone="soft" />

            <div className="md:col-span-2">
              <ResultSection
                title="Category Picks"
                subtitle="각 단계에서 메인 제품만 남겨 루틴이 복잡해 보이지 않게 정리했습니다."
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {(result.categoryPicks || []).map((product) => (
                    <ProductDecisionCard
                      key={product.id}
                      product={product}
                      form={submission?.form}
                    />
                  ))}
                </div>
              </ResultSection>
            </div>

            {result.alternative ? (
              <div className="md:col-span-2">
                <ResultSection
                  title="Optional Alternative"
                  subtitle="메인 추천이 사용감과 안 맞을 때만 비교해 볼 수 있는 대안 1개입니다."
                >
                  <AlternativeCard product={result.alternative} form={submission?.form} />
                </ResultSection>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <ResultSection
                title="Why These Won"
                subtitle="각 제품에서 눈에 띄는 차이만 짧게 정리해 두었습니다."
              >
                <div className="grid gap-3 lg:grid-cols-2">
                  {[result.topPick, ...(result.categoryPicks || [])]
                    .filter(Boolean)
                    .map((product) => (
                      <WinningReasonCard key={`why-${product.id}`} product={product} />
                    ))}
                </div>
              </ResultSection>
            </div>

            <ResultCard title="Morning Routine" items={result.morning} tone="default" />
            <ResultCard title="Night Routine" items={result.night} tone="default" />

            <div className="md:col-span-2">
              <ResultCard title="Avoid" items={result.avoid} tone="soft" />
            </div>

            {result.funInsight ? (
              <div className="md:col-span-2">
                <ResultSection
                  title={result.funInsight.title || "Optional Skin Note"}
                  subtitle="가볍게 참고할 보조 메모입니다."
                >
                  <div className="rounded-2xl bg-[linear-gradient(135deg,#f6efe7_0%,#fff9f2_100%)] px-5 py-5 text-sm leading-7 text-black/70">
                    {result.funInsight.description}
                  </div>
                </ResultSection>
              </div>
            ) : null}

            <div className="md:col-span-2">
              <ResultSection
                title="Quick Feedback"
                subtitle="짧게 남겨 주시면 추천 품질을 다듬는 데 바로 반영됩니다."
              >
                <div className="grid gap-3">
                  {feedbackQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-black/5 bg-white/85 px-4 py-4"
                    >
                      <p className="text-sm font-medium text-ink">{question.text}</p>
                      {feedbackSubmitted[question.id] ? (
                        <p className="mt-3 text-xs font-medium text-[#7d5724]">
                          감사합니다. 의견이 저장되었습니다.
                        </p>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          {["Yes", "No"].map((option) => {
                            const isActive = feedback[question.id] === option;

                            return (
                              <button
                                key={`${question.id}-${option}`}
                                type="button"
                                onClick={() => handleFeedback(question.id, option)}
                                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                  isActive
                                    ? "bg-[#1f1811] text-white"
                                    : "border border-black/10 bg-white text-black/65 hover:border-black/20"
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ResultSection>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function InsightStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-[#faf5ee] px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-black/35">{label}</p>
      <p className="mt-1 font-medium text-ink">{value}</p>
    </div>
  );
}

function WinningReasonCard({ product }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-[#faf6f0] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">{product.step}</p>
          <p className="mt-2 text-sm font-semibold text-ink">{product.name}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-black/45">
          Score {product.score}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-black/65">
        {product.comparison_reason || product.reason}
      </p>
    </div>
  );
}

function ProductDecisionCard({ product, featured = false, form = null }) {
  if (featured) {
    const topPickHeadline = getTopPickHeadline(form);
    const topPickSummary = getTopPickSummary(product, form);
    const especiallyGoodFor = getEspeciallyGoodFor(product, form);
    const usageTiming = getUsageTimingLabel(product.use_time);
    const priceLabel = getPriceLabel(product.price_range);
    const purchaseLink = getPurchaseLinkInfo(product);

    return (
      <div
        className="overflow-hidden rounded-[2rem] border border-[#d6b487] bg-[linear-gradient(135deg,#f1dfc8_0%,#fff7ee_56%,#fffdf9_100%)] shadow-[0_24px_64px_rgba(79,51,8,0.14)]"
        onClick={() =>
          trackEvent("click_top_pick", {
            product_id: product.id,
            feature_name: "skin_analysis",
            result_type: "top_pick",
            is_top_pick: true,
            meta_json: {
              step: product.step,
              brand: product.brand,
              score: product.score
            }
          })
        }
      >
        <div className="grid gap-6 px-5 py-6 sm:px-7 sm:py-8 lg:grid-cols-[1.28fr_0.72fr] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full bg-[#1f1811] px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
                Best Match
              </span>
              <span className="rounded-full border border-[#1f1811]/10 bg-white/85 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-black/65">
                Top Pick
              </span>
              <span className="rounded-full border border-[#1f1811]/10 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-black/65">
                1순위 추천
              </span>
              <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-black/55">
                {product.step}
              </span>
              <span className="rounded-full border border-black/10 bg-white/80 px-3 py-1.5 text-[11px] font-medium text-black/55">
                Score {product.score}
              </span>
            </div>

            <p className="mt-5 text-sm font-semibold leading-6 text-[#7d5724] sm:text-[15px]">
              {topPickHeadline}
            </p>

            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.4rem]">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-black/45 sm:text-[15px]">{product.brand}</p>

            {product.labels?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {product.labels.map((label) => (
                  <span
                    key={`${product.id}-${label}`}
                    className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/60"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-black/10 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-black/58">
                Use {usageTiming}
              </span>
              <span className="rounded-full border border-black/10 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-black/58">
                {priceLabel}
              </span>
            </div>

            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-black/80">{topPickSummary}</p>

            <p className="mt-4 text-sm leading-6 text-black/70">
              <span className="font-semibold text-black/78">Especially good for...</span>{" "}
              {especiallyGoodFor}
            </p>

            <div className="mt-5 rounded-[1.25rem] border border-[#cfb48d]/60 bg-white/80 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-black/35">Why This Pick First</p>
              <p className="mt-2 text-sm leading-6 text-black/72">{product.reason}</p>
            </div>

            <p className="mt-4 text-sm font-medium text-[#7d5724]">
              이 제품부터 시작하는 것을 추천합니다.
            </p>
          </div>

          <div className="rounded-[1.6rem] border border-[#cfb48d]/50 bg-white/88 p-4 sm:p-5">
            <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">Why This Wins</p>
            <p className="mt-3 text-sm leading-6 text-black/68">
              {product.comparison_reason || product.reason}
            </p>

            <div className="mt-5 rounded-[1.2rem] bg-[#fbf2e6] px-4 py-3 text-sm leading-6 text-black/68">
              한 가지만 먼저 바꾼다면 이 제품부터 시작하는 편이 가장 이해하기 쉽습니다.
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#f7efe5] px-3 py-1 text-xs font-medium text-black/60">
                {priceLabel}
              </span>
              <a
                href={purchaseLink.href}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => {
                  event.stopPropagation();
                  trackEvent("click_buy_link", {
                    product_id: product.id,
                    feature_name: "skin_analysis",
                    result_type: "top_pick",
                    is_top_pick: true,
                    meta_json: {
                      step: product.step,
                      brand: product.brand,
                      button_label: purchaseLink.label,
                      fallback_link: purchaseLink.isFallback
                    }
                  });
                }}
                className="inline-flex items-center justify-center rounded-full bg-[#1f1811] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
              >
                {purchaseLink.label}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const especiallyGoodFor = getEspeciallyGoodFor(product, form);
  const usageTiming = getUsageTimingLabel(product.use_time);
  const priceLabel = getPriceLabel(product.price_range);
  const purchaseLink = getPurchaseLinkInfo(product);

  return (
    <div
      className="rounded-[1.5rem] border border-black/5 bg-[#fbf7f2] p-5"
      onClick={() =>
        trackEvent("click_product_card", {
          product_id: product.id,
          feature_name: "skin_analysis",
          result_type: "category_pick",
          is_top_pick: false,
          meta_json: {
            step: product.step,
            brand: product.brand,
            score: product.score
          }
        })
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">{product.step}</p>
          <p className="mt-2 text-base font-semibold text-ink">{product.name}</p>
          <p className="mt-1 text-xs text-black/45">{product.brand}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-black/55">
          {priceLabel}
        </span>
      </div>

      {product.labels?.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {product.labels.slice(0, 2).map((label) => (
            <span
              key={`${product.id}-${label}`}
              className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/58"
            >
              {label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/56">
          Use {usageTiming}
        </span>
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/56">
          {priceLabel}
        </span>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-black/35">
        Especially good for...
      </p>
      <p className="mt-1 text-sm leading-6 text-black/70">{especiallyGoodFor}</p>

      <p className="mt-4 text-sm leading-6 text-black/68">{product.reason}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-black/42">Score {product.score}</span>
        <a
          href={purchaseLink.href}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            event.stopPropagation();
            trackEvent("click_buy_link", {
              product_id: product.id,
              feature_name: "skin_analysis",
              result_type: "category_pick",
              is_top_pick: false,
              meta_json: {
                step: product.step,
                brand: product.brand,
                button_label: purchaseLink.label,
                fallback_link: purchaseLink.isFallback
              }
            });
          }}
          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-black/72 transition hover:border-black/20 hover:bg-black/5"
        >
          {purchaseLink.label}
        </a>
      </div>
    </div>
  );
}

function AlternativeCard({ product, form }) {
  const purchaseLink = getPurchaseLinkInfo(product);

  return (
    <div
      className="rounded-[1.5rem] border border-dashed border-black/10 bg-[#f8f4ee] p-5"
      onClick={() =>
        trackEvent("click_product_card", {
          product_id: product.id,
          feature_name: "skin_analysis",
          result_type: "alternative",
          is_top_pick: false,
          meta_json: {
            step: product.step,
            brand: product.brand,
            score: product.score
          }
        })
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">Alternative</p>
          <p className="mt-2 text-base font-semibold text-ink">{product.name}</p>
          <p className="mt-1 text-xs text-black/45">{product.brand}</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-black/55">
          {getPriceLabel(product.price_range)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/56">
          Use {getUsageTimingLabel(product.use_time)}
        </span>
        {product.labels?.slice(0, 1).map((label) => (
          <span
            key={`${product.id}-${label}`}
            className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/56"
          >
            {label}
          </span>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-black/35">
        Especially good for...
      </p>
      <p className="mt-1 text-sm leading-6 text-black/70">{getEspeciallyGoodFor(product, form)}</p>

      <p className="mt-4 text-sm leading-6 text-black/66">{product.reason}</p>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium text-black/42">Alternative</span>
        <a
          href={purchaseLink.href}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => {
            event.stopPropagation();
            trackEvent("click_buy_link", {
              product_id: product.id,
              feature_name: "skin_analysis",
              result_type: "alternative",
              is_top_pick: false,
              meta_json: {
                step: product.step,
                brand: product.brand,
                button_label: purchaseLink.label,
                fallback_link: purchaseLink.isFallback
              }
            });
          }}
          className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-medium text-black/72 transition hover:border-black/20 hover:bg-black/5"
        >
          {purchaseLink.label}
        </a>
      </div>
    </div>
  );
}

