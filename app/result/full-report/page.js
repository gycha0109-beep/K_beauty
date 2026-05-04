"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { readWriteAccessToken } from "@/lib/write-access-client";

const TRACKING_SESSION_KEY = "skinTestTrackingSessionId";

const COPY = {
  ko: {
    loading: "전체 리포트를 불러오는 중입니다...",
    title: "실행 가능한 Full Report",
    body: "무료 결과의 Top Pick을 기준으로, 실제로 따라가기 쉬운 루틴과 확장 가이드를 정리했습니다.",
    backResult: "무료 결과로 돌아가기",
    restart: "다시 테스트하기",
    errorTitle: "전체 리포트를 불러오지 못했습니다.",
    errorBody: "분석 세션이 만료되었거나 필요한 데이터가 없습니다. 무료 결과로 돌아가 다시 이어가 주세요.",
    topPickReason: "Top Pick 상세 이유",
    supportingProducts: "함께 쓰기 좋은 제품",
    fullRoutine: "실제 사용 가이드",
    morning: "아침",
    night: "저녁",
    situationVariants: "상황별 변형",
    avoid: "피하면 좋은 조합",
    budget: "예산 대안",
    faceLab: "Face Lab 확장 가이드",
    faceSummary: "얼굴 인상 요약",
    hairDirections: "헤어 방향",
    avoidStyles: "피할 스타일",
    styleKeywords: "스타일 키워드",
    toneDirection: "톤 / 무드 방향",
    reasoningLines: "왜 이렇게 읽는지",
    buyNow: "판매처 보기",
    empty: "표시할 내용이 아직 없습니다.",
    skinMatchTab: "Skin Match",
    faceLabTab: "Face Lab",
    fitSectionTitle: "제품 적합도",
    fitSectionBody: "이 점수는 제품의 사용감과 적합도를 요약한 참고 지표입니다.",
    alternativesTitle: "대안 제품",
    alternativesBody: "카테고리별로 넘겨 보면서 비교할 수 있게 정리했습니다.",
    previousCard: "이전",
    nextCard: "다음",
    recommendedForThisStep: "이 단계 추천",
    noImage: "이미지 없음"
  },
  en: {
    loading: "Loading your full report...",
    title: "Practical Full Report",
    body: "Built from the same Top Pick as the free result, this report organizes the routine into something you can actually follow.",
    backResult: "Back to free result",
    restart: "Try again",
    errorTitle: "Could not load the full report.",
    errorBody: "The analysis session expired or the required data is missing. Please go back to the free result and continue from there.",
    topPickReason: "Top Pick Detailed Reason",
    supportingProducts: "Supporting Products",
    fullRoutine: "Practical Routine Guide",
    morning: "Morning",
    night: "Night",
    situationVariants: "Situation Variants",
    avoid: "Avoid Combinations",
    budget: "Budget Alternatives",
    faceLab: "Face Lab Extended Guidance",
    faceSummary: "Face Summary",
    hairDirections: "Hair Directions",
    avoidStyles: "Avoid Styles",
    styleKeywords: "Style Keywords",
    toneDirection: "Tone / Mood Direction",
    reasoningLines: "Reasoning",
    buyNow: "View store",
    empty: "There is nothing to show yet.",
    skinMatchTab: "Skin Match",
    faceLabTab: "Face Lab",
    fitSectionTitle: "Product fit",
    fitSectionBody: "These scores are a compact reference for wear profile and fit.",
    alternativesTitle: "Alternatives",
    alternativesBody: "These are arranged one card at a time so you can compare by category.",
    previousCard: "Previous",
    nextCard: "Next",
    recommendedForThisStep: "Suggested for this step",
    noImage: "No image"
  }
};

function getCopy(locale = "ko") {
  return COPY[locale] || COPY.ko;
}

function getLocaleFromPathname(pathname = "") {
  return pathname.startsWith("/en") ? "en" : "ko";
}

function getResultPath(locale = "ko") {
  return locale === "en" ? "/en/result" : "/result";
}

function getHomePath(locale = "ko") {
  return locale === "en" ? "/en" : "/";
}

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

async function getFullReportAccessToken() {
  return getBrowserSupabaseAccessToken();
}

function trackEvent(eventName, data = {}) {
  const writeAccessToken = readWriteAccessToken();

  void (async () => {
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
    const supabaseAccessToken = await getFullReportAccessToken();

    if (!supabaseAccessToken && !writeAccessToken) {
      return;
    }

    const headers = {
      "Content-Type": "application/json"
    };

    if (writeAccessToken) {
      headers["x-kbeauty-write-token"] = writeAccessToken;
    }

    if (supabaseAccessToken) {
      headers.Authorization = `Bearer ${supabaseAccessToken}`;
    }

    return fetch("/api/track", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  })();
}

function renderList(items = []) {
  if (!items.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {items.map((item, index) => (
        <p key={`${item}-${index}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {item}
        </p>
      ))}
    </div>
  );
}

function isExactOliveYoungProductLink(link) {
  return typeof link === "string" && /oliveyoung\.co\.kr/i.test(link);
}

function getPurchaseLinkInfo(product, copy, locale = "ko") {
  if (isExactOliveYoungProductLink(product?.buy_link)) {
    return {
      href: product.buy_link,
      label: copy.buyNow,
      isFallback: false
    };
  }

  const query = encodeURIComponent(`${product?.brand || ""} ${product?.name || ""} ${locale === "en" ? "buy" : "구매"}`);
  return {
    href: `https://search.shopping.naver.com/search/all?query=${query}`,
    label: copy.buyNow,
    isFallback: true
  };
}

function scoreToStars(score) {
  const normalized = Math.max(0, Math.min(100, Number(score || 0)));
  if (normalized <= 0) {
    return 0;
  }

  return Math.max(1, Math.min(5, Math.round(normalized / 20)));
}

function FitStars({ fitData }) {
  const gauges = Array.isArray(fitData?.gauges) ? fitData.gauges : [];

  if (!gauges.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {gauges.map((gauge) => {
        const filled = scoreToStars(gauge.score);

        return (
          <div key={gauge.key} className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">{gauge.label}</p>
            <div className="mt-1.5 flex items-center gap-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <span
                  key={`${gauge.key}-star-${index}`}
                  className={`text-[11px] leading-none ${index < filled ? "text-amber-400" : "text-zinc-300 dark:text-zinc-600"}`}
                >
                  ★
                </span>
              ))}
              <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">{filled}.0 / 5</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductThumb({ product, copy, sizeClass = "h-28 w-24" }) {
  if (product?.image_url) {
    return (
      <div className={`${sizeClass} overflow-hidden rounded-[1.25rem] border border-white/10 bg-zinc-900/70`}>
        <img src={product.image_url} alt={product.name || "Product"} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-[1.25rem] border border-dashed border-white/10 bg-zinc-900/50 px-3 text-center text-[11px] text-zinc-400`}>
      {copy.noImage}
    </div>
  );
}

function TopPickHeroCard({ product, report, copy, locale }) {
  if (!product) {
    return null;
  }

  return (
    <section className="ui-card p-6">
      <div className="grid grid-cols-[1fr_96px] gap-4 sm:grid-cols-[1fr_120px] sm:gap-5">
        <div className="min-w-0">
          <p className="ui-kicker">{copy.topPickReason}</p>
          <h2 className="ui-title mt-2 text-[1.35rem] sm:text-[1.45rem]">{product.name || "Top Pick"}</h2>
          <p className="ui-text-secondary mt-1 text-sm">{product.brand || ""}</p>
          {report.topPickDetailedReason ? (
            <p className="mt-4 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
              {report.topPickDetailedReason}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-stretch justify-start">
          <ProductThumb product={product} copy={copy} sizeClass="h-28 w-24 sm:h-32 sm:w-28" />
          <FitStars fitData={report.topPickFitGauges} />
        </div>
      </div>
    </section>
  );
}

function SupportingProductCard({ product, copy, locale = "ko" }) {
  if (!product) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);

  return (
    <article className="ui-card-muted rounded-[1.35rem] p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <ProductThumb product={product} copy={copy} sizeClass="h-20 w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {product.step || product.category || "Product"}
              </p>
              <h3 className="ui-title mt-2 text-base">{product.name}</h3>
              <p className="ui-text-secondary mt-1 text-sm">{product.brand}</p>
            </div>
            {product.price_range ? <span className="ui-chip-compact shrink-0">{product.price_range}</span> : null}
          </div>

          {product.reason ? (
            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{product.reason}</p>
          ) : null}

          {product.comparison_reason ? (
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{product.comparison_reason}</p>
          ) : null}

          <a
            href={purchaseLink.href}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("click_buy_link", {
                product_id: product.id || null,
                feature_name: "skin_analysis",
                result_type: "full_report_supporting",
                is_top_pick: false,
                meta_json: {
                  step: product.step || null,
                  brand: product.brand || null,
                  button_label: purchaseLink.label,
                  fallback_link: purchaseLink.isFallback
                }
              })
            }
            className="ui-button-secondary mt-4 inline-flex px-3.5 py-2 text-xs font-medium"
          >
            {purchaseLink.label}
          </a>
        </div>
      </div>
    </article>
  );
}

function buildAlternativeCarouselItems(freeResult, report) {
  const seen = new Set();
  const candidates = [
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    freeResult?.alternative || null,
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : []),
    ...(Array.isArray(freeResult?.categoryPicks) ? freeResult.categoryPicks : []),
    ...(Array.isArray(report?.budgetAlternatives)
      ? report.budgetAlternatives.map((item) => ({
          ...item,
          category: "budget",
          comparison_reason: item.summary || "",
          reason: item.summary || ""
        }))
      : [])
  ].filter(Boolean);

  return candidates.filter((item) => {
    const key = item.id || `${item.category || item.step}-${item.name}`;
    const slotKey = item.step || item.category || key;

    if (!key || seen.has(slotKey)) {
      return false;
    }

    seen.add(slotKey);
    return true;
  });
}

function AlternativeCarousel({ items, copy, locale = "ko" }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length]);

  if (!items.length) {
    return null;
  }

  const activeItem = items[activeIndex];

  return (
    <section className="ui-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ui-kicker">{copy.alternativesTitle}</p>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.alternativesBody}</p>
        </div>
        <span className="ui-chip-compact shrink-0">{activeIndex + 1} / {items.length}</span>
      </div>

      <div className="mt-4">
        <SupportingProductCard product={activeItem} copy={copy} locale={locale} />
      </div>

      {items.length > 1 ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveIndex((current) => (current - 1 + items.length) % items.length)}
            className="ui-button-secondary px-4 py-2.5 text-sm font-medium"
          >
            {copy.previousCard}
          </button>
          <button
            type="button"
            onClick={() => setActiveIndex((current) => (current + 1) % items.length)}
            className="ui-button-secondary px-4 py-2.5 text-sm font-medium"
          >
            {copy.nextCard}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function resolveRoutineSupportProducts(freeResult, report) {
  const seen = new Set();
  const items = [
    freeResult?.topPick || null,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    freeResult?.alternative || null,
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : [])
  ].filter(Boolean).filter((item) => {
    const key = item.id || `${item.brand}-${item.name}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const pickByUseTime = (slot) =>
    items.find((item) => item.use_time === slot || item.use_time === "both") || null;

  return {
    morning: pickByUseTime("day") || freeResult?.topPick || items[0] || null,
    night: pickByUseTime("night") || items.find((item) => item.id !== freeResult?.topPick?.id) || freeResult?.topPick || null
  };
}

function RoutineStepSupport({ product, copy, locale = "ko" }) {
  if (!product) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);

  return (
    <div className="mb-4 flex items-start gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 p-3">
      <ProductThumb product={product} copy={copy} sizeClass="h-20 w-16" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          {copy.recommendedForThisStep}
        </p>
        <p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</p>
        <p className="mt-1 text-xs text-zinc-400">{product.brand}</p>
        <a
          href={purchaseLink.href}
          target="_blank"
          rel="noreferrer"
          className="ui-button-secondary mt-3 inline-flex px-3 py-2 text-xs font-medium"
        >
          {purchaseLink.label}
        </a>
      </div>
    </div>
  );
}

function buildDevelopmentReport(result, faceLabResult, locale = "ko") {
  const premiumReport = result?.premiumReport || {};
  const faceLabLaunch = buildFaceLabLaunchData(faceLabResult || result?.faceLab || null, locale);

  return {
    topPickDetailedReason:
      premiumReport.topPickDetailedReason ||
      result?.topPick?.reason ||
      result?.topPick?.explanation ||
      result?.directionSummary ||
      "",
    supportingProducts:
      (Array.isArray(premiumReport.supportingProducts) && premiumReport.supportingProducts.length
        ? premiumReport.supportingProducts
        : Array.isArray(result?.altPicks) && result.altPicks.length
          ? result.altPicks.slice(0, 3)
          : Array.isArray(result?.categoryPicks)
            ? result.categoryPicks.slice(0, 3)
            : []) || [],
    fullRoutine: {
      morning:
        (Array.isArray(premiumReport.fullRoutine?.morning) && premiumReport.fullRoutine.morning.length
          ? premiumReport.fullRoutine.morning
          : Array.isArray(result?.morning)
            ? result.morning.slice(0, 4)
            : []) || [],
      night:
        (Array.isArray(premiumReport.fullRoutine?.night) && premiumReport.fullRoutine.night.length
          ? premiumReport.fullRoutine.night
          : Array.isArray(result?.night)
            ? result.night.slice(0, 4)
            : []) || []
    },
    routineVariants:
      (Array.isArray(premiumReport.routineVariants) && premiumReport.routineVariants.length
        ? premiumReport.routineVariants
        : Array.isArray(result?.premiumReport?.fullRoutine?.variants)
          ? result.premiumReport.fullRoutine.variants
          : []) || [],
    avoidCombinations:
      (Array.isArray(premiumReport.avoidCombinations) && premiumReport.avoidCombinations.length
        ? premiumReport.avoidCombinations
        : Array.isArray(result?.avoid)
          ? result.avoid.slice(0, 4)
          : []) || [],
    budgetAlternatives:
      (Array.isArray(premiumReport.budgetAlternatives) && premiumReport.budgetAlternatives.length
        ? premiumReport.budgetAlternatives
        : Array.isArray(result?.budgetAlternatives)
          ? result.budgetAlternatives.slice(0, 3)
          : []) || [],
    faceLab: {
      faceSummary: faceLabLaunch?.paid?.faceSummary || "",
      hairDirections: faceLabLaunch?.paid?.hairDirections || [],
      avoidStyles: faceLabLaunch?.paid?.avoidStyles || [],
      styleKeywords: faceLabLaunch?.paid?.styleKeywords || [],
      toneDirection: faceLabLaunch?.paid?.toneDirection || "",
      reasoningLines: faceLabLaunch?.paid?.reasoningLines || []
    },
    topPickFitGauges: buildProductFitGauges(result?.topPick || null, { locale }),
    routineStructure: premiumReport.routineStructure || result?.routineStructure || null
  };
}

function FaceLabSection({ report, copy }) {
  const faceSummary = report.faceLab?.faceSummary || "";
  const hairDirections = report.faceLab?.hairDirections || [];
  const avoidStyles = report.faceLab?.avoidStyles || [];
  const styleKeywords = report.faceLab?.styleKeywords || [];
  const toneDirection = report.faceLab?.toneDirection || "";
  const reasoningLines = report.faceLab?.reasoningLines || [];
  const hasAnyContent =
    faceSummary ||
    hairDirections.length ||
    avoidStyles.length ||
    styleKeywords.length ||
    toneDirection ||
    reasoningLines.length;

  if (!hasAnyContent) {
    return null;
  }

  return (
    <section className="ui-card p-6">
      <p className="ui-kicker">{copy.faceLab}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {faceSummary ? (
          <div className="ui-card-subtle p-4 sm:col-span-2">
            <p className="ui-kicker">{copy.faceSummary}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{faceSummary}</p>
          </div>
        ) : null}
        {hairDirections.length ? (
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.hairDirections}</p>
            {renderList(hairDirections)}
          </div>
        ) : null}
        {avoidStyles.length ? (
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.avoidStyles}</p>
            {renderList(avoidStyles)}
          </div>
        ) : null}
        {styleKeywords.length ? (
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.styleKeywords}</p>
            {renderList(styleKeywords)}
          </div>
        ) : null}
        {toneDirection ? (
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.toneDirection}</p>
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{toneDirection}</p>
          </div>
        ) : null}
        {reasoningLines.length ? (
          <div className="ui-card-subtle p-4 sm:col-span-2">
            <p className="ui-kicker">{copy.reasoningLines}</p>
            {renderList(reasoningLines)}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function FullReportPage() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = getCopy(locale);
  const [freeResult, setFreeResult] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState("skin_match");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedResult = sessionStorage.getItem("skinTestResult");

    if (!storedResult) {
      setError(copy.errorBody);
      setIsReady(true);
      return;
    }

    let parsedResult = null;

    try {
      parsedResult = JSON.parse(storedResult);
      setFreeResult(parsedResult);
    } catch {
      setError(copy.errorBody);
      setIsReady(true);
      return;
    }

    async function loadFullReport() {
      const writeAccessToken = readWriteAccessToken();
      const storedFaceLab = sessionStorage.getItem("skinTestFaceLabFull");
      let parsedFaceLab = null;

      try {
        parsedFaceLab = storedFaceLab ? JSON.parse(storedFaceLab) : null;
      } catch {
        parsedFaceLab = null;
      }

      const fallbackReport = buildDevelopmentReport(parsedResult, parsedFaceLab, locale);

      if (!writeAccessToken) {
        setReport(fallbackReport);
        setIsReady(true);
        return;
      }

      try {
        const supabaseAccessToken = await getFullReportAccessToken();
        const response = await fetch("/api/full-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(supabaseAccessToken ? { Authorization: `Bearer ${supabaseAccessToken}` } : {}),
            "x-kbeauty-write-token": writeAccessToken
          },
          body: JSON.stringify({
            locale,
            faceLab: parsedFaceLab,
            topPick: parsedResult?.topPick || null
          })
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data) {
          throw new Error(data?.error || copy.errorBody);
        }

        setReport(data);
        trackEvent("view_full_report", {
          product_id: parsedResult?.topPick?.id || null,
          feature_name: "skin_analysis",
          result_type: "full_report",
          is_top_pick: false,
          meta_json: {
            supporting_count: Array.isArray(data.supportingProducts) ? data.supportingProducts.length : 0,
            has_face_lab_paid: Boolean(
              data.faceLab?.faceSummary ||
                data.faceLab?.hairDirections?.length ||
                data.faceLab?.avoidStyles?.length ||
                data.faceLab?.styleKeywords?.length ||
                data.faceLab?.toneDirection ||
                data.faceLab?.reasoningLines?.length
            ),
            has_fit_gauges: Boolean(data.topPickFitGauges?.gauges?.length)
          }
        });
      } catch (requestError) {
        console.error("[full-report] load failed", requestError);
        setReport(fallbackReport);
      } finally {
        setIsReady(true);
      }
    }

    void loadFullReport();
  }, [copy.errorBody, locale]);

  if (!isReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <LoadingSpinner label={copy.loading} />
      </main>
    );
  }

  if (error || !freeResult || !report) {
    return (
      <main className="ui-page ui-page-shell min-h-screen">
        <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 py-6 sm:px-6">
          <div className="ui-card p-6">
            <p className="ui-kicker">FULL REPORT</p>
            <h1 className="ui-title mt-2 text-xl sm:text-2xl">{copy.errorTitle}</h1>
            <p className="ui-text-secondary mt-3 text-sm leading-6">{error || copy.errorBody}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={getResultPath(locale)} className="ui-button-secondary px-4 py-2.5 text-sm font-medium">
                {copy.backResult}
              </Link>
              <Link href={getHomePath(locale)} className="ui-button-secondary px-4 py-2.5 text-sm font-medium">
                {copy.restart}
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const alternativeItems = buildAlternativeCarouselItems(freeResult, report);
  const routineSupportProducts = resolveRoutineSupportProducts(freeResult, report);
  const morningSteps = report?.fullRoutine?.morning || [];
  const nightSteps = report?.fullRoutine?.night || [];
  const hasRoutineSteps = morningSteps.length || nightSteps.length;
  const hasRoutineVariants = Array.isArray(report.routineVariants) && report.routineVariants.length;
  const hasAvoidCombinations = Array.isArray(report.avoidCombinations) && report.avoidCombinations.length;
  const hasBudgetAlternatives = Array.isArray(report.budgetAlternatives) && report.budgetAlternatives.length;

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-20 pt-4 sm:px-6 sm:pt-6">
        <div className="space-y-4">
          <header className="ui-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-kicker">FULL REPORT</p>
                <h1 className="ui-title mt-2 text-xl sm:text-2xl">{copy.title}</h1>
                <p className="ui-text-secondary mt-3 text-sm leading-6">{copy.body}</p>
              </div>
              <button
                type="button"
                onClick={() => router.push(getResultPath(locale))}
                className="ui-button-secondary shrink-0 px-4 py-2.5 text-xs font-medium"
              >
                {copy.backResult}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("skin_match")}
              className={`ui-button-secondary px-4 py-3 text-sm font-medium ${activeTab === "skin_match" ? "ui-choice-active" : ""}`}
            >
              {copy.skinMatchTab}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("face_lab")}
              className={`ui-button-secondary px-4 py-3 text-sm font-medium ${activeTab === "face_lab" ? "ui-choice-active" : ""}`}
            >
              {copy.faceLabTab}
            </button>
          </div>

          {activeTab === "skin_match" ? (
            <>
              <TopPickHeroCard
                product={freeResult?.topPick || null}
                report={report}
                copy={copy}
                locale={locale}
              />

              <AlternativeCarousel items={alternativeItems} copy={copy} locale={locale} />

              {hasRoutineSteps ? (
                <section className="ui-card p-6">
                  <p className="ui-kicker">{copy.fullRoutine}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {morningSteps.length ? (
                      <div className="ui-card-subtle p-4">
                        <p className="ui-kicker">{copy.morning}</p>
                        <RoutineStepSupport product={routineSupportProducts.morning} copy={copy} locale={locale} />
                        {renderList(morningSteps)}
                      </div>
                    ) : null}
                    {nightSteps.length ? (
                      <div className="ui-card-subtle p-4">
                        <p className="ui-kicker">{copy.night}</p>
                        <RoutineStepSupport product={routineSupportProducts.night} copy={copy} locale={locale} />
                        {renderList(nightSteps)}
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {hasRoutineVariants ? (
                <section className="ui-card p-6">
                  <p className="ui-kicker">{copy.situationVariants}</p>
                  <div className="mt-4 grid gap-3">
                    {report.routineVariants.map((variant) => (
                      Array.isArray(variant.items) && variant.items.length ? (
                        <div key={variant.key || variant.label} className="ui-card-subtle p-4">
                          <p className="ui-kicker">{variant.label}</p>
                          {renderList(variant.items)}
                        </div>
                      ) : null
                    ))}
                  </div>
                </section>
              ) : null}

              {hasAvoidCombinations ? (
                <section className="ui-card p-6">
                  <p className="ui-kicker">{copy.avoid}</p>
                  {renderList(report.avoidCombinations)}
                </section>
              ) : null}

              {hasBudgetAlternatives ? (
                <section className="ui-card p-6">
                  <p className="ui-kicker">{copy.budget}</p>
                  <div className="mt-4 grid gap-3">
                    {report.budgetAlternatives.map((item) => (
                      <div key={item.id || `${item.brand}-${item.name}`} className="ui-card-muted rounded-[1.25rem] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="ui-title text-sm">{item.name}</p>
                            <p className="ui-text-secondary mt-1 text-xs">{item.brand}</p>
                          </div>
                          {item.price_range ? <span className="ui-chip-compact shrink-0">{item.price_range}</span> : null}
                        </div>
                        {item.summary ? (
                          <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.summary}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <FaceLabSection report={report} copy={copy} />
          )}
        </div>
      </div>
    </main>
  );
}
