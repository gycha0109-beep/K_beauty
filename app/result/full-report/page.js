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
    alternativesTitle: "역할별 선택지",
    alternativesBody: "Top Pick을 기준으로 대체, 보완, 저자극 선택지를 나눠 정리했습니다.",
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
    alternativesTitle: "Role-based options",
    alternativesBody: "Organized as swaps, boosters, and lower-irritation options around the Top Pick.",
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

function FitSegmentBars({ fitData }) {
  const gauges = Array.isArray(fitData?.gauges) ? fitData.gauges : [];

  if (!gauges.length) {
    return null;
  }

  return (
    <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/5 px-2.5 py-2">
      <div className="space-y-2">
        {gauges.map((gauge) => {
          const filled = scoreToStars(gauge.score);

          return (
            <div key={`${gauge.key}-bar`}>
              <p className="text-[10px] font-semibold leading-none text-zinc-900 dark:text-zinc-100">
                {gauge.label}
              </p>
              <div className="mt-1.5 flex gap-1">
                {Array.from({ length: 5 }).map((_, segmentIndex) => (
                  <span
                    key={`${gauge.key}-segment-${segmentIndex}`}
                    className={`h-1.5 flex-1 rounded-full transition ${
                      segmentIndex < filled
                        ? "bg-zinc-900 dark:bg-zinc-100"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
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

function unwrapSupportingProductItem(item) {
  return item?.product || item || null;
}

function getSupportingProductItemKey(item) {
  const product = unwrapSupportingProductItem(item);
  return item?.role && product?.id
    ? `${item.role}-${product.id}`
    : product?.id || `${product?.category || product?.step}-${product?.name}`;
}

function getDefaultRelationToTopPick(role, locale = "ko") {
  if (locale === "en") {
    if (role === "support_concern_booster") {
      return "The Top Pick handles the main concern first; this fills the supporting gap.";
    }

    if (role === "low_irritation_option") {
      return "Compared with the Top Pick, this leans more toward a steadier low-irritation day.";
    }

    return "It keeps the same concern direction as the Top Pick while changing the wear profile.";
  }

  if (role === "support_concern_booster") {
    return "Top Pick이 1순위 고민을 먼저 잡는다면, 이 제품은 보조 고민 쪽 빈틈을 보완합니다.";
  }

  if (role === "low_irritation_option") {
    return "Top Pick보다 기능을 더 밀기보다 예민한 날 안정감과 반응 관찰에 초점을 둡니다.";
  }

  return "Top Pick과 같은 고민을 보지만 제형, 마무리, 단계 부담을 다르게 가져갑니다.";
}

function TopPickHeroCard({ product, report, copy, locale }) {
  if (!product) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);

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
          <FitSegmentBars fitData={report.topPickFitGauges} />
          <a
            href={purchaseLink.href}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("click_buy_link", {
                product_id: product.id || null,
                feature_name: "skin_analysis",
                result_type: "full_report_top_pick",
                is_top_pick: true,
                meta_json: {
                  step: product.step || null,
                  brand: product.brand || null,
                  button_label: purchaseLink.label,
                  fallback_link: purchaseLink.isFallback
                }
              })
            }
            className="ui-button-secondary mt-3 justify-center px-3 py-2 text-xs font-medium"
          >
            {purchaseLink.label}
          </a>
        </div>
      </div>
    </section>
  );
}

function SupportingProductCard({ item: itemProp, product: productProp, copy, locale = "ko" }) {
  const item = itemProp || productProp;
  const product = unwrapSupportingProductItem(item);

  if (!product) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);
  const roleLabel = item?.label || product.step || product.category || "Product";
  const roleReason = item?.reason || product.reason || "";
  const usage = item?.usage || "";
  const rawRelationToTopPick = String(item?.relationToTopPick || "").trim();
  const relationToTopPick = rawRelationToTopPick.includes("Top Pick")
    ? rawRelationToTopPick
    : item?.role
      ? getDefaultRelationToTopPick(item.role, locale)
      : "";

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
                {roleLabel}
              </p>
              <h3 className="ui-title mt-2 text-base">{product.name}</h3>
              <p className="ui-text-secondary mt-1 text-sm">{product.brand}</p>
            </div>
            {product.price_range ? <span className="ui-chip-compact shrink-0">{product.price_range}</span> : null}
          </div>

          {roleReason ? (
            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{roleReason}</p>
          ) : null}

          {usage ? (
            <div className="mt-3 rounded-[1rem] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "When to use" : "언제 쓰면 좋은지"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{usage}</p>
            </div>
          ) : null}

          {relationToTopPick ? (
            <div className="mt-2 rounded-[1rem] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "Difference from Top Pick" : "Top Pick과 차이"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{relationToTopPick}</p>
            </div>
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
                  role: item?.role || null,
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
  const roleItems = Array.isArray(report?.supportingProducts)
    ? report.supportingProducts.filter((item) => item?.product)
    : [];

  if (roleItems.length) {
    const seenRoleProducts = new Set();
    return roleItems.filter((item) => {
      const product = unwrapSupportingProductItem(item);
      const key = product?.id || `${item.role}-${product?.name}`;

      if (!key || seenRoleProducts.has(key)) {
        return false;
      }

      seenRoleProducts.add(key);
      return true;
    });
  }

  const seen = new Set();
  const candidates = [
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    ...(Array.isArray(freeResult?.categoryPicks) ? freeResult.categoryPicks : []),
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : []),
    freeResult?.alternative || null,
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
    const product = unwrapSupportingProductItem(item);
    const key = product?.id || `${product?.category || product?.step}-${product?.name}`;
    const slotKey =
      String(
        product?.decision_meta?.slot ||
        product?.step ||
        product?.category ||
        key
      ).toLowerCase();

    if (!key || seen.has(slotKey)) {
      return false;
    }

    seen.add(slotKey);
    return true;
  });
}

function AlternativeGrid({ items, copy, locale = "ko" }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="ui-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ui-kicker">{copy.alternativesTitle}</p>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.alternativesBody}</p>
        </div>
        <span className="ui-chip-compact shrink-0">{items.length}</span>
      </div>

      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <SupportingProductCard
            key={getSupportingProductItemKey(item)}
            item={item}
            copy={copy}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
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
        <SupportingProductCard item={activeItem} copy={copy} locale={locale} />
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

function resolveRoutineSupportProductsV2(freeResult, report, alternativeItems = []) {
  const seen = new Set();
  const items = [
    freeResult?.topPick || null,
    ...alternativeItems,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    freeResult?.alternative || null,
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : [])
  ].map(unwrapSupportingProductItem).filter(Boolean).filter((item) => {
    const key = item.id || `${item.brand}-${item.name}`;
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  const pickPreferred = (slots, excludeIds = new Set()) =>
    items.find((item) => {
      if (!item || excludeIds.has(item.id)) {
        return false;
      }

      const useTime = String(item.use_time || "both").toLowerCase();
      return slots.includes(useTime);
    }) || null;

  const morning = pickPreferred(["day"]) || pickPreferred(["both"]) || freeResult?.topPick || items[0] || null;
  const usedIds = new Set(morning?.id ? [morning.id] : []);
  const night =
    pickPreferred(["night"], usedIds) ||
    pickPreferred(["both"], usedIds) ||
    items.find((item) => item?.id && !usedIds.has(item.id)) ||
    null;

  return {
    morning,
    night
  };
}

function resolveRoutineSupportProducts(freeResult, report) {
  const seen = new Set();
  const items = [
    freeResult?.topPick || null,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    freeResult?.alternative || null,
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : [])
  ].map(unwrapSupportingProductItem).filter(Boolean).filter((item) => {
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

function normalizeRoutineDisplaySteps(stepItems = [], fallbackItems = [], locale = "ko") {
  const objectSteps = Array.isArray(stepItems)
    ? stepItems
        .filter((item) => item && typeof item === "object")
        .map((item, index) => ({
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
          stepName: String(item.stepName || "").trim(),
          productRole: String(item.productRole || "").trim(),
          product: item.product || null,
          instruction: String(item.instruction || "").trim(),
          frequency: String(item.frequency || "").trim(),
          caution: String(item.caution || "").trim()
        }))
        .filter((item) => item.stepName || item.instruction || item.product)
    : [];

  if (objectSteps.length) {
    return objectSteps;
  }

  return (Array.isArray(fallbackItems) ? fallbackItems : [])
    .map((item, index) => ({
      order: index + 1,
      stepName: locale === "en" ? `Step ${index + 1}` : `${index + 1}단계`,
      productRole: "",
      product: null,
      instruction: String(item || "").trim(),
      frequency: "",
      caution: ""
    }))
    .filter((item) => item.instruction);
}

function RoutineProductInline({ product, copy, locale = "ko" }) {
  if (!product) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);

  return (
    <div className="mt-3 flex items-center gap-3 rounded-[1rem] border border-white/10 bg-white/5 p-3">
      <ProductThumb product={product} copy={copy} sizeClass="h-14 w-12" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {copy.recommendedForThisStep}
        </p>
        <p className="mt-1 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</p>
        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{product.brand}</p>
      </div>
      <a
        href={purchaseLink.href}
        target="_blank"
        rel="noreferrer"
        className="ui-button-secondary shrink-0 px-3 py-2 text-[11px] font-medium"
      >
        {purchaseLink.label}
      </a>
    </div>
  );
}

function RoutineTimelineCard({ step, copy, locale = "ko" }) {
  return (
    <article className="ui-card-subtle p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-950">
          {step.order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="ui-title text-base">{step.stepName}</h3>
            {step.productRole ? <span className="ui-chip-compact">{step.productRole}</span> : null}
          </div>
          {step.instruction ? (
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{step.instruction}</p>
          ) : null}
          <RoutineProductInline product={step.product} copy={copy} locale={locale} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {step.frequency ? (
              <div className="rounded-[0.9rem] bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {locale === "en" ? "Frequency" : "빈도"}
                </p>
                <p className="mt-1 text-sm leading-5 text-zinc-700 dark:text-zinc-300">{step.frequency}</p>
              </div>
            ) : null}
            {step.caution ? (
              <div className="rounded-[0.9rem] bg-white/5 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {locale === "en" ? "Caution" : "주의"}
                </p>
                <p className="mt-1 text-sm leading-5 text-zinc-700 dark:text-zinc-300">{step.caution}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function RoutineTimelineGroup({ title, steps, copy, locale = "ko" }) {
  if (!steps.length) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="ui-kicker">{title}</p>
      {steps.map((step) => (
        <RoutineTimelineCard
          key={`${title}-${step.order}-${step.stepName}`}
          step={step}
          copy={copy}
          locale={locale}
        />
      ))}
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
            : []) || [],
      morningSteps:
        (Array.isArray(premiumReport.fullRoutine?.morningSteps) && premiumReport.fullRoutine.morningSteps.length
          ? premiumReport.fullRoutine.morningSteps
          : []) || [],
      nightSteps:
        (Array.isArray(premiumReport.fullRoutine?.nightSteps) && premiumReport.fullRoutine.nightSteps.length
          ? premiumReport.fullRoutine.nightSteps
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
      summary: faceLabLaunch?.paid?.summary || null,
      faceMood: faceLabLaunch?.paid?.faceMood || null,
      faceSummary: faceLabLaunch?.paid?.faceSummary || "",
      hairDirections: faceLabLaunch?.paid?.hairDirections || [],
      avoidStyles: faceLabLaunch?.paid?.avoidStyles || [],
      styleKeywords: faceLabLaunch?.paid?.styleKeywords || [],
      toneDirection: faceLabLaunch?.paid?.toneDirection || "",
      reasoningLines: faceLabLaunch?.paid?.reasoningLines || [],
      practicalGuide: faceLabLaunch?.paid?.practicalGuide || null,
      sections: faceLabLaunch?.paid?.sections || [],
      steps: faceLabLaunch?.paid?.steps || []
    },
    topPickFitGauges: buildProductFitGauges(result?.topPick || null, { locale }),
    routineStructure: premiumReport.routineStructure || result?.routineStructure || null
  };
}

function CompactActionList({ items = [] }) {
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

const FACE_LAB_SECTION_ORDER = ["structure", "direction", "guide", "mood"];

const FACE_LAB_UI = {
  ko: {
    moodTitle: "Face Mood",
    moodLabels: {
      primary: "대표 무드",
      secondary: "서브 무드",
      keywords: "스타일 키워드",
      impression: "인상 방향"
    },
    moodFallback: {
      primary: "고양이상",
      secondary: ["토끼상", "두부상"],
      keywords: ["가벼운 윗볼륨", "피치", "코랄", "정돈된 사이드"],
      impression: "맑고 부드러운 인상, 눈매 중심"
    },
    labels: {
      structure: "얼굴 구조 정리",
      direction: "스타일 방향",
      guide: "실전 적용 가이드",
      mood: "무드 해석"
    },
    recommended: "추천",
    avoid: "피하기",
    baseSetup: "기본 세팅"
  },
  en: {
    moodTitle: "Face Mood",
    moodLabels: {
      primary: "Primary mood",
      secondary: "Sub mood",
      keywords: "Style keywords",
      impression: "Impression"
    },
    moodFallback: {
      primary: "고양이상",
      secondary: ["토끼상", "두부상"],
      keywords: ["light top volume", "peach", "coral", "controlled sides"],
      impression: "Clear and soft mood with eye focus"
    },
    labels: {
      structure: "Face Structure",
      direction: "Style Direction",
      guide: "Practical Guide",
      mood: "Mood Read"
    },
    recommended: "Recommended",
    avoid: "Avoid",
    baseSetup: "Base Setup"
  }
};

function getFaceLabUi(locale = "ko") {
  return FACE_LAB_UI[locale] || FACE_LAB_UI.ko;
}

function cleanReportText(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactReportList(values, limit = 10) {
  return Array.isArray(values)
    ? values.map((item) => cleanReportText(item)).filter(Boolean).slice(0, limit)
    : [];
}

function uniqueReportList(values, limit = 10) {
  return [...new Set(values.map((item) => cleanReportText(item)).filter(Boolean))].slice(0, limit);
}

function normalizeFaceLabSectionId(section) {
  const rawId = String(section?.id || section?.key || section?.step || "").toLowerCase();

  if (rawId.includes("structure") || rawId === "5") {
    return "structure";
  }
  if (rawId.includes("direction") || rawId === "6") {
    return "direction";
  }
  if (rawId.includes("application") || rawId.includes("guide") || rawId === "7") {
    return "guide";
  }
  if (rawId.includes("mood") || rawId.includes("keyword") || rawId === "8") {
    return "mood";
  }

  return rawId || "structure";
}

function normalizeFaceLabSection(section, locale = "ko") {
  const ui = getFaceLabUi(locale);
  const id = normalizeFaceLabSectionId(section);
  const label = id === "mood" ? ui.labels.mood : cleanReportText(section?.label || section?.title) || ui.labels[id] || id;

  return {
    ...section,
    id,
    label,
    title: id === "mood" ? ui.labels.mood : cleanReportText(section?.title) || label
  };
}

function buildSectionsFromLegacySteps(steps, locale = "ko") {
  return steps.map((step) => {
    const id = normalizeFaceLabSectionId(step);
    const base = normalizeFaceLabSection(step, locale);

    if (id === "structure") {
      return {
        ...base,
        content: uniqueReportList([step.summary, ...(Array.isArray(step.bullets) ? step.bullets : [])], 4)
      };
    }

    if (id === "direction") {
      return {
        ...base,
        recommended: compactReportList(step.recommended, 4),
        avoid: compactReportList(step.avoid, 4)
      };
    }

    if (id === "guide") {
      return {
        ...base,
        baseSetup: compactReportList(step.baseSetup, 3),
        cards: Array.isArray(step.cards) && step.cards.length ? step.cards : step.variations || []
      };
    }

    const keywords = compactReportList(step.keywords, 8);
    const moodContent = compactReportList(step.bullets || step.content, 4);

    return {
      ...base,
      content: moodContent.length
        ? moodContent
        : keywords.length
          ? [
              locale === "en"
                ? `This mood is best supported by ${keywords.slice(0, 4).join(", ")}.`
                : `이 무드는 ${keywords.slice(0, 4).join(", ")} 같은 방향으로 안정적으로 살아납니다.`
            ]
          : [],
      keywords
    };
  });
}

function buildSectionsFromFlatFaceLab(faceLab, locale = "ko") {
  const ui = getFaceLabUi(locale);
  const guide = faceLab?.practicalGuide || {};

  return [
    {
      id: "structure",
      label: ui.labels.structure,
      title: ui.labels.structure,
      content: uniqueReportList([faceLab?.faceSummary, ...(Array.isArray(faceLab?.reasoningLines) ? faceLab.reasoningLines : [])], 4)
    },
    {
      id: "direction",
      label: ui.labels.direction,
      title: ui.labels.direction,
      recommended: compactReportList(faceLab?.hairDirections, 4),
      avoid: compactReportList(faceLab?.avoidStyles, 4)
    },
    {
      id: "guide",
      label: ui.labels.guide,
      title: ui.labels.guide,
      baseSetup: compactReportList(guide.baseSetup, 3),
      cards: Array.isArray(guide.cards) && guide.cards.length ? guide.cards : guide.variations || []
    },
    {
      id: "mood",
      label: ui.labels.mood,
      title: ui.labels.mood,
      content: compactReportList(faceLab?.moodInterpretation || faceLab?.styleKeywords, 4)
    }
  ];
}

function getFaceLabSections(faceLab, locale = "ko") {
  const sections = Array.isArray(faceLab?.sections) ? faceLab.sections : [];
  const legacySteps = Array.isArray(faceLab?.steps) ? faceLab.steps : [];
  const rawSections = sections.length ? sections : legacySteps.length ? buildSectionsFromLegacySteps(legacySteps, locale) : buildSectionsFromFlatFaceLab(faceLab, locale);

  return rawSections
    .map((section) => normalizeFaceLabSection(section, locale))
    .filter((section) => {
      if (section.id === "structure") {
        return compactReportList(section.content, 4).length;
      }
      if (section.id === "direction") {
        return compactReportList(section.recommended, 4).length || compactReportList(section.avoid, 4).length;
      }
      if (section.id === "guide") {
        return compactReportList(section.baseSetup, 3).length || (Array.isArray(section.cards) && section.cards.length);
      }
      if (section.id === "mood") {
        return compactReportList(section.content, 4).length || compactReportList(section.keywords, 8).length;
      }

      return true;
    })
    .sort((a, b) => FACE_LAB_SECTION_ORDER.indexOf(a.id) - FACE_LAB_SECTION_ORDER.indexOf(b.id));
}

function getFaceLabMood(faceLab, sections, locale = "ko") {
  const ui = getFaceLabUi(locale);
  const mood = faceLab?.faceMood || {};
  const moodSection = sections.find((section) => section.id === "mood") || {};
  const legacyKeywords = compactReportList(faceLab?.styleKeywords, 8);
  const moodKeywords = compactReportList(mood.keywords, 8);
  const sectionKeywords = compactReportList(moodSection.keywords, 8);

  return {
    primary: cleanReportText(mood.primary) || ui.moodFallback.primary,
    secondary: compactReportList(mood.secondary, 3).length ? compactReportList(mood.secondary, 3) : ui.moodFallback.secondary,
    keywords: uniqueReportList([...moodKeywords, ...sectionKeywords, ...legacyKeywords, ...ui.moodFallback.keywords], 8),
    impression: cleanReportText(mood.impression) || ui.moodFallback.impression
  };
}

function FaceLabPhotoPreview({ imageUrl }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <section className="ui-card-subtle p-3">
      <div className="ui-image-surface mx-auto flex aspect-[4/5] w-full max-w-[240px] items-center justify-center overflow-hidden rounded-[1.35rem] sm:max-w-[280px]">
        <img
          src={imageUrl}
          alt="Face Lab"
          className="h-full w-full object-cover object-center"
        />
      </div>
    </section>
  );
}

function FaceMoodCard({ mood, locale = "ko" }) {
  const ui = getFaceLabUi(locale);
  const secondary = compactReportList(mood.secondary, 3);
  const keywords = compactReportList(mood.keywords, 8);

  return (
    <section className="ui-card-subtle overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ui-kicker">{ui.moodTitle}</p>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{ui.moodLabels.primary}</p>
            <h3 className="ui-title mt-1 text-2xl sm:text-[1.75rem]">{mood.primary || ui.moodFallback.primary}</h3>
          </div>
        </div>
        <div className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
          Mood
        </div>
      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {mood.impression || ui.moodFallback.impression}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
          <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{ui.moodLabels.secondary}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {secondary.map((item) => (
              <span key={item} className="ui-chip-compact px-3 py-1.5">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-[1rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
          <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{ui.moodLabels.keywords}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span key={keyword} className="ui-chip-compact px-3 py-1.5">
                {keyword}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FaceLabPanelList({ items = [] }) {
  const safeItems = compactReportList(items, 6);

  if (!safeItems.length) {
    return null;
  }

  return (
    <div className="mt-3 grid gap-2">
      {safeItems.map((item, index) => (
        <p
          key={`${item}-${index}`}
          className="rounded-[1rem] border border-zinc-200 bg-zinc-50/80 px-3 py-3 text-sm leading-6 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/35 dark:text-zinc-300"
        >
          {item}
        </p>
      ))}
    </div>
  );
}

function FaceLabSectionPanel({ section, locale = "ko" }) {
  const ui = getFaceLabUi(locale);

  if (!section) {
    return null;
  }

  if (section.id === "direction") {
    return (
      <section className="ui-card-subtle p-5">
        <h3 className="ui-title text-lg">{section.title}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[1rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
            <p className="ui-kicker">{ui.recommended}</p>
            <CompactActionList items={compactReportList(section.recommended, 4)} />
          </div>
          <div className="rounded-[1rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
            <p className="ui-kicker">{ui.avoid}</p>
            <CompactActionList items={compactReportList(section.avoid, 4)} />
          </div>
        </div>
      </section>
    );
  }

  if (section.id === "guide") {
    const cards = Array.isArray(section.cards) ? section.cards : [];

    return (
      <section className="ui-card-subtle p-5">
        <h3 className="ui-title text-lg">{section.title}</h3>
        {compactReportList(section.baseSetup, 3).length ? (
          <div className="mt-4 rounded-[1rem] border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-950/35">
            <p className="ui-kicker">{ui.baseSetup}</p>
            <CompactActionList items={compactReportList(section.baseSetup, 3)} />
          </div>
        ) : null}
        {cards.length ? (
          <div className="mt-3 grid gap-2">
            {cards.map((card, index) => (
              <article key={`${card.label || "guide"}-${index}`} className="rounded-[1rem] border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/35">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  {card.label}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{card.body}</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="ui-card-subtle p-5">
      <h3 className="ui-title text-lg">{section.title}</h3>
      <FaceLabPanelList items={section.content} />
    </section>
  );
}

function FaceLabSection({ report, photoUrl, locale = "ko" }) {
  const faceLab = report?.faceLab || {};
  const sections = getFaceLabSections(faceLab, locale);
  const firstSectionId = sections[0]?.id || "structure";
  const [activeSection, setActiveSection] = useState(firstSectionId);

  useEffect(() => {
    if (!sections.length) {
      return;
    }

    if (!sections.some((section) => section.id === activeSection)) {
      setActiveSection(firstSectionId);
    }
  }, [activeSection, firstSectionId, sections]);

  if (!sections.length) {
    return null;
  }

  const faceMood = getFaceLabMood(faceLab, sections, locale);
  const activePanel = sections.find((section) => section.id === activeSection) || sections[0];

  return (
    <section className="space-y-4">
      <FaceLabPhotoPreview imageUrl={photoUrl} />
      <FaceMoodCard mood={faceMood} locale={locale} />

      <div className="grid grid-cols-2 gap-2">
        {sections.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
              className={`ui-button-secondary min-h-14 w-full justify-start px-3 py-3 text-left text-sm font-semibold ${
                isActive
                  ? "!border-zinc-900 !bg-zinc-900 !text-white dark:!border-zinc-100 dark:!bg-zinc-100 dark:!text-zinc-950"
                  : ""
              }`}
            >
              <span className="text-current">{section.label}</span>
            </button>
          );
        })}
      </div>

      <FaceLabSectionPanel section={activePanel} locale={locale} />
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
  const [submissionImageUrl, setSubmissionImageUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedResult = sessionStorage.getItem("skinTestResult");
    const storedSubmission = sessionStorage.getItem("skinTestSubmission");

    try {
      const parsedSubmission = storedSubmission ? JSON.parse(storedSubmission) : null;
      setSubmissionImageUrl(parsedSubmission?.imagePreviewDataUrl || "");
    } catch {
      setSubmissionImageUrl("");
    }

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
              data.faceLab?.faceMood?.primary ||
              data.faceLab?.sections?.length ||
              data.faceLab?.steps?.length ||
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
  const morningSteps = normalizeRoutineDisplaySteps(
    report?.fullRoutine?.morningSteps,
    report?.fullRoutine?.morning,
    locale
  );
  const nightSteps = normalizeRoutineDisplaySteps(
    report?.fullRoutine?.nightSteps,
    report?.fullRoutine?.night,
    locale
  );
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

              <AlternativeGrid items={alternativeItems} copy={copy} locale={locale} />

              {hasRoutineSteps ? (
                <section className="ui-card p-6">
                  <p className="ui-kicker">{copy.fullRoutine}</p>
                  <div className="mt-4 grid gap-5">
                    <RoutineTimelineGroup
                      title={copy.morning}
                      steps={morningSteps}
                      copy={copy}
                      locale={locale}
                    />
                    <RoutineTimelineGroup
                      title={copy.night}
                      steps={nightSteps}
                      copy={copy}
                      locale={locale}
                    />
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
            <FaceLabSection report={report} photoUrl={submissionImageUrl} locale={locale} />
          )}
        </div>
      </div>
    </main>
  );
}
