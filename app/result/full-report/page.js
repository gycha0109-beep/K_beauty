"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { clearWriteAccessToken, readWriteAccessToken } from "@/lib/write-access-client";

const TRACKING_SESSION_KEY = "skinTestTrackingSessionId";

const COPY = {
  ko: {
    loading: "전체 리포트를 불러오는 중입니다...",
    title: "실행 가능한 Full Report",
    body: "무료 결과의 1순위 제품을 기준으로, 실제로 따라가기 쉬운 루틴과 확장 가이드를 정리했습니다.",
    backResult: "무료 결과로 돌아가기",
    restart: "다시 테스트하기",
    errorTitle: "전체 리포트를 불러오지 못했습니다.",
    errorBody: "분석 세션이 만료되었거나 필요한 데이터가 없습니다. 무료 결과로 돌아가 다시 이어가 주세요.",
    topPickReason: "1순위 제품 상세 이유",
    supportingProducts: "함께 쓰기 좋은 제품",
    fullRoutine: "실제 사용 가이드",
    morning: "아침",
    night: "저녁",
    situationVariants: "상황별 변형",
    avoid: "피하면 좋은 조합",
    budget: "예산 대안",
    budgetLowerBurden: "부담 낮춘 대안",
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
    alternativesBody: "1순위 제품을 기준으로 대체, 보완, 저자극 선택지를 나눠 정리했습니다.",
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

function getLocalePath(pathname, nextLocale) {
  if (!pathname) {
    return nextLocale === "en" ? "/en/result/full-report" : "/result/full-report";
  }

  const normalized = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return nextLocale === "en" ? `/en${normalized === "/" ? "" : normalized}` : normalized;
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
  const displayItems = uniqueDisplayTexts(items);

  if (!displayItems.length) {
    return null;
  }

  return (
    <div className="mt-3 space-y-2">
      {displayItems.map((item, index) => (
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
      return "Use this to split out the supporting concern while the primary product stays focused on the main role.";
    }

    if (role === "low_irritation_option") {
      return "On days when the primary product feels heavy or reactive, try this in the same step instead.";
    }

    return "When the primary product feels like too much for daily use, this can work as the same-role swap.";
  }

  if (role === "support_concern_booster") {
    return "1순위 제품과 같은 루틴 안에서, 보조 고민은 이 제품으로 나누어 볼 수 있습니다.";
  }

  if (role === "low_irritation_option") {
    return "1순위 제품이 무겁거나 따갑게 느껴지는 날에는, 같은 단계에서 이 제품으로 바꿔 써보세요.";
  }

  return "1순위 제품을 매일 쓰기 부담스러운 날에는 같은 역할의 대체안으로 볼 수 있습니다.";
}

function hasKoreanText(value) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value || ""));
}

function compactText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function uniqueDisplayTexts(items = []) {
  const seen = new Set();

  return (Array.isArray(items) ? items : [])
    .map(compactText)
    .filter((item) => {
      const key = item.toLowerCase();

      if (!item || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function isSameDisplayText(left, right) {
  const normalizedLeft = compactText(left).toLowerCase();
  const normalizedRight = compactText(right).toLowerCase();

  return Boolean(normalizedLeft && normalizedLeft === normalizedRight);
}

function normalizeReportCategory(product = {}) {
  const category = String(product?.category || "").trim().toLowerCase();

  if (category === "toner_pad" || category === "toner_essence" || category === "essence") {
    return "toner_essence";
  }
  if (category === "serum" || category === "ampoule") {
    return "serum_ampoule";
  }

  return category;
}

function normalizeDisplayStepKey(value) {
  const key = String(value || "").trim().toLowerCase();

  if (!key) {
    return "";
  }
  if (key === "serum" || key === "ampoule" || key === "serum_ampoule") {
    return "serum_ampoule";
  }
  if (key === "toner_pad") {
    return "toner_pad";
  }
  if (key === "toner_essence" || key === "essence") {
    return "toner_essence";
  }
  if (["cleanser", "sunscreen", "moisturizer"].includes(key)) {
    return key;
  }

  return "";
}

function getReportStepLabel(product = {}, locale = "ko") {
  const displayKey =
    normalizeDisplayStepKey(product?.category) ||
    normalizeDisplayStepKey(product?.step) ||
    normalizeReportCategory(product);
  const rawStep = String(product?.step || "").trim();
  const labels = locale === "en"
    ? {
        cleanser: "Cleanser",
        toner_pad: "Toner Pad",
        toner_essence: "Toner / Essence",
        serum_ampoule: "Serum",
        moisturizer: "Moisturizer",
        sunscreen: "Sunscreen"
      }
    : {
        cleanser: "클렌저",
        toner_pad: "토너패드",
        toner_essence: "토너/에센스",
        serum_ampoule: "세럼/앰플",
        moisturizer: "보습제",
        sunscreen: "선크림"
      };

  if (labels[displayKey]) {
    return labels[displayKey];
  }
  if (locale === "en" && hasKoreanText(rawStep)) {
    return "Product";
  }

  return rawStep || (locale === "en" ? "Product" : "제품");
}

function getReportPriorityAxis(result = {}) {
  return result?.priority?.axis || result?.form?.mainConcern || result?.mainConcern || "dehydration";
}

function getReportPriorityLabel(result = {}, locale = "ko") {
  const axis = getReportPriorityAxis(result);
  const labels = locale === "en"
    ? {
        uv: "UV pressure",
        oiliness: "oiliness",
        pores: "pores",
        dehydration: "dehydration",
        acne: "breakouts",
        uneven_tone: "uneven tone",
        redness: "redness",
        barrier: "barrier support"
      }
    : {
        uv: "자외선",
        oiliness: "유분",
        pores: "모공",
        dehydration: "건조",
        acne: "트러블",
        uneven_tone: "톤 불균일",
        redness: "붉은기",
        barrier: "장벽"
      };

  return labels[axis] || labels.dehydration;
}

function buildEnglishTopPickDetailedReason(result = {}) {
  const product = result?.topPick || {};
  const category = normalizeReportCategory(product);
  const concern = getReportPriorityLabel(result, "en");

  if (category === "moisturizer") {
    return `The current result is led by ${concern}, so the routine needs a steady sealing step before adding more active products. This moisturizer keeps the Top Pick role focused on comfort, barrier support, and a finish that is easier to keep using daily.`;
  }
  if (category === "sunscreen") {
    return `The current result is led by ${concern}, so the first priority is protection that can stay in the morning routine without feeling too heavy. This sunscreen keeps the routine practical because it is easier to apply enough and reapply on longer outdoor days.`;
  }
  if (category === "cleanser") {
    return `The current result is led by ${concern}, so the routine should reset residue without pushing the skin into a stripped or irritated state. This cleanser works as the anchor step because it keeps the reset simple before the rest of the routine starts.`;
  }
  if (category === "toner_essence") {
    return `The current result is led by ${concern}, so the routine benefits from a thin first layer that organizes hydration and texture before heavier products. This toner or essence step is useful as a controlled starting point rather than an extra-heavy correction step.`;
  }
  if (category === "serum_ampoule") {
    return `The current result is led by ${concern}, so the routine should use one focused care lane instead of stacking several active steps together. This serum role keeps the correction targeted while leaving the rest of the routine simple.`;
  }

  return `The current result is led by ${concern}, so this product stays as the anchor step while the surrounding routine stays simple and easier to follow.`;
}

const TOP_PICK_REASON_LABELS = {
  ko: {
    why: "왜 1순위인지",
    evidence: "사진/설문 근거",
    usage: "사용 방향",
    review: "리뷰 참고"
  },
  en: {
    why: "Why it is first",
    evidence: "Photo / survey basis",
    usage: "How to use it",
    review: "Review reference"
  }
};

function splitReasonSentences(value) {
  const text = compactText(value);

  if (!text) {
    return [];
  }

  return (text.match(/[^.!?。！？]+[.!?。！？]?/g) || [text])
    .map(compactText)
    .filter(Boolean);
}

function isSunscreenProduct(product = {}) {
  return normalizeReportCategory(product) === "sunscreen";
}

function buildTopPickWhyText(product = {}, result = {}, locale = "ko") {
  const category = normalizeReportCategory(product);
  const concern = getReportPriorityLabel(result, locale);

  if (locale === "en") {
    if (category === "sunscreen") {
      return `${concern} is the leading priority, so the first product role is a sun-care step that can stay in the morning routine.`;
    }
    if (category === "moisturizer") {
      return `${concern} is the leading priority, so the first product role is a steady sealing step before adding stronger active products.`;
    }
    if (category === "cleanser") {
      return `${concern} is the leading priority, so the first product role is a reset step that does not push the skin harder.`;
    }
    if (category === "serum_ampoule") {
      return `${concern} is the leading priority, so the first product role stays focused instead of stacking several correction lanes.`;
    }

    return `${concern} is the leading priority, so this product stays as the anchor while the surrounding routine remains simple.`;
  }

  if (category === "sunscreen") {
    return `${concern} 흐름이 우선으로 잡힌 상태라, 아침 보호 단계를 안정적으로 유지하는 제품을 1순위로 둡니다.`;
  }
  if (category === "moisturizer") {
    return `${concern} 흐름이 우선으로 잡힌 상태라, 기능을 더 겹치기보다 마무리 보습 축을 먼저 안정시키는 편이 좋습니다.`;
  }
  if (category === "cleanser") {
    return `${concern} 흐름이 우선으로 잡힌 상태라, 피부를 더 밀어붙이지 않는 정리 단계가 먼저 필요합니다.`;
  }
  if (category === "serum_ampoule") {
    return `${concern} 흐름이 우선으로 잡힌 상태라, 여러 보정 기능을 겹치기보다 한 가지 축에 집중하는 편이 안정적입니다.`;
  }

  return `${concern} 흐름이 우선으로 잡힌 상태라, 이 제품을 기준 단계로 두고 주변 루틴은 단순하게 맞춥니다.`;
}

function buildTopPickEvidenceText(result = {}, locale = "ko") {
  const evidenceSources = [
    ...(Array.isArray(result?.surveyEvidence) ? result.surveyEvidence : []),
    ...(Array.isArray(result?.photoEvidence) ? result.photoEvidence : []),
    ...(Array.isArray(result?.evidenceLines) ? result.evidenceLines : [])
  ];
  const evidenceLines = uniqueDisplayTexts(evidenceSources).filter((item) => locale !== "en" || !hasKoreanText(item));

  if (evidenceLines.length) {
    return evidenceLines.slice(0, 2).join(" ");
  }

  const hasPriorityData = Boolean(result?.priority || result?.form?.mainConcern || result?.mainConcern);

  if (!hasPriorityData) {
    return "";
  }

  const concern = getReportPriorityLabel(result, locale);
  return locale === "en"
    ? `The photo and survey inputs point toward ${concern}, so the report keeps the routine anchored to that priority.`
    : `사진과 설문에서 ${concern} 흐름이 우선으로 잡혀, 루틴의 기준도 이 방향에 맞췄습니다.`;
}

function buildTopPickUsageText(product = {}, result = {}, locale = "ko") {
  const category = normalizeReportCategory(product);

  if (locale === "en") {
    if (category === "sunscreen") {
      return "Use it as the final morning step, and reapply when outdoor exposure is long.";
    }
    if (category === "cleanser") {
      return "Use it briefly and gently at the cleansing step, then keep the next layers simple.";
    }
    if (category === "toner_essence") {
      return "Place it as a thin first layer after cleansing before heavier products.";
    }
    if (category === "serum_ampoule") {
      return "Use it as one focused lane, without stacking several active products on the same day.";
    }
    if (category === "moisturizer") {
      return "Use it after toner or serum as the sealing step, especially on days when the skin feels reactive.";
    }

    return "Use it as the anchor step and keep the surrounding routine easy to repeat.";
  }

  if (category === "sunscreen") {
    return "아침 마지막 단계에서 충분히 바르고, 야외 시간이 길면 덧바르는 기준으로 봅니다.";
  }
  if (category === "cleanser") {
    return "세안 단계에서 짧고 부드럽게 사용하고, 이후 단계는 가볍게 이어갑니다.";
  }
  if (category === "toner_essence") {
    return "세안 직후 얇게 먼저 두고, 무거운 제품은 뒤 단계로 넘깁니다.";
  }
  if (category === "serum_ampoule") {
    return "한 번에 여러 기능을 겹치기보다 필요한 날 한 방향으로만 사용합니다.";
  }
  if (category === "moisturizer") {
    return "토너나 세럼 다음 마무리 단계에서 얇게 두고, 예민한 날에는 활성 제품과 겹치지 않습니다.";
  }

  return "기준 단계로 두고, 주변 루틴은 반복하기 쉬운 쪽으로 단순하게 맞춥니다.";
}

function buildReviewSignalText(product = {}, locale = "ko") {
  const signals = product?.review_signals || product?.reviewSignals || null;
  const positives = Array.isArray(signals?.positive) ? signals.positive : [];
  const negatives = Array.isArray(signals?.negative) ? signals.negative : [];
  const positiveLabels = positives.map((item) => compactText(item?.label)).filter(Boolean).slice(0, 2);
  const negativeLabels = negatives.map((item) => compactText(item?.label)).filter(Boolean).slice(0, 1);

  if (!positiveLabels.length && !negativeLabels.length) {
    return "";
  }

  if (locale === "en") {
    const positiveText = positiveLabels.length
      ? `Visible AI review keywords often mention ${positiveLabels.join(", ")}.`
      : "";
    const negativeText = negativeLabels.length
      ? `Check ${negativeLabels.join(", ")} first if your skin is reactive.`
      : "";

    return compactText(`${positiveText} ${negativeText}`);
  }

  const positiveText = positiveLabels.length
    ? `실제 리뷰에서는 ${positiveLabels.join(", ")} 반응이 많이 보입니다.`
    : "";
  const negativeText = negativeLabels.length
    ? `다만 ${negativeLabels.join(", ")} 의견도 있어 민감한 피부라면 먼저 확인하는 편이 좋습니다.`
    : "";

  return compactText(`${positiveText} ${negativeText}`);
}

function buildTopPickReasonBlocks({ report = {}, result = {}, product = {}, locale = "ko" } = {}) {
  const labels = TOP_PICK_REASON_LABELS[locale] || TOP_PICK_REASON_LABELS.ko;
  const explicitBlocks = Array.isArray(report?.topPickReasonBlocks)
    ? report.topPickReasonBlocks
        .map((block) => ({
          key: block?.key || "custom",
          label: labels[block?.key] || compactText(block?.label) || compactText(block?.key),
          body: compactText(block?.body)
        }))
        .filter((block) => block.body && (locale !== "en" || !hasKoreanText(block.body)))
    : [];

  if (explicitBlocks.length) {
    const seenBodies = new Set();
    return explicitBlocks.filter((block) => {
      const key = block.body.toLowerCase();

      if (seenBodies.has(key)) {
        return false;
      }

      seenBodies.add(key);
      return true;
    });
  }

  const detailedReason = compactText(
    report?.topPickDetailedReason ||
    product?.reason ||
    product?.explanation ||
    result?.directionSummary ||
    ""
  );
  const sentences = splitReasonSentences(detailedReason);
  const usedSentences = new Set();
  const takeSentences = (patterns, maxCount = 2) => {
    const matches = [];

    sentences.forEach((sentence) => {
      if (matches.length >= maxCount || usedSentences.has(sentence)) {
        return;
      }

      if (patterns.some((pattern) => pattern.test(sentence))) {
        usedSentences.add(sentence);
        matches.push(sentence);
      }
    });

    return matches;
  };

  const reviewSentences = takeSentences([/리뷰|후기|review/i], 2);
  const usageSentences = takeSentences([/사용|바르|단계|루틴|소량|덧바르|겹치|apply|use|routine|step|reapply|stack/i], 2);
  const evidenceSentences = takeSentences([/사진|설문|피부|잡혔|보이|photo|survey|visible|input/i], 2);
  const whySentences = sentences.filter((sentence) => !usedSentences.has(sentence)).slice(0, 2);
  const blocks = [];
  const seenBodies = new Set();
  const addBlock = (key, body) => {
    const text = compactText(body);
    const bodyKey = text.toLowerCase();

    if (!text || seenBodies.has(bodyKey)) {
      return;
    }

    seenBodies.add(bodyKey);
    blocks.push({ key, label: labels[key], body: text });
  };

  addBlock("why", whySentences.join(" ") || buildTopPickWhyText(product, result, locale));
  addBlock("evidence", evidenceSentences.join(" ") || buildTopPickEvidenceText(result, locale));
  addBlock("usage", usageSentences.join(" ") || buildTopPickUsageText(product, result, locale));
  addBlock("review", reviewSentences.join(" ") || buildReviewSignalText(product, locale));

  return blocks;
}

function getEnglishRoleLabel(role, product) {
  if (role === "support_concern_booster") {
    return "Supporting concern booster";
  }
  if (role === "low_irritation_option") {
    return "Lower-irritation option";
  }
  if (role === "same_concern_alternative") {
    return "Same-concern swap";
  }

  return getReportStepLabel(product, "en");
}

function getKoreanRoleLabel(role) {
  if (role === "support_concern_booster") {
    return "보조 고민 보완";
  }
  if (role === "low_irritation_option") {
    return "저자극 대체";
  }
  if (role === "same_concern_alternative") {
    return "같은 역할 대체";
  }

  return "역할 대체안";
}

function inferSupportingRole(item, product) {
  if (item?.role) {
    return item.role;
  }

  const metaRole =
    item?.decision_meta?.role ||
    item?.decision_meta?.slot ||
    product?.decision_meta?.role ||
    product?.decision_meta?.slot ||
    "";
  const normalizedMetaRole = String(metaRole || "").toLowerCase();

  if (["support_concern_booster", "low_irritation_option", "same_concern_alternative"].includes(normalizedMetaRole)) {
    return normalizedMetaRole;
  }

  const text = buildProductTextIndex({
    ...product,
    reason: `${item?.reason || ""} ${product?.reason || ""}`,
    summary: `${item?.summary || ""} ${product?.summary || ""}`,
    comparison_reason: `${item?.comparison_reason || ""} ${product?.comparison_reason || ""}`,
    tags: [item?.label, product?.label, item?.roleLabel, product?.roleLabel].filter(Boolean)
  });

  if (/(저자극|자극|예민|민감|low irritation|reactive|sensitive|calm)/i.test(text)) {
    return "low_irritation_option";
  }
  if (/(보조|보완|함께|부족|support|booster|fill|gap)/i.test(text)) {
    return "support_concern_booster";
  }

  return "same_concern_alternative";
}

function appendSunCareDescriptor(label, product, locale = "ko") {
  const baseLabel = compactText(label) || getReportStepLabel(product, locale);

  if (!isSunscreenProduct(product)) {
    return baseLabel;
  }

  const lowerLabel = baseLabel.toLowerCase();
  const hasSunCareText =
    lowerLabel.includes("sunscreen") ||
    lowerLabel.includes("sun care") ||
    baseLabel.includes("선크림") ||
    baseLabel.includes("선케어");

  if (hasSunCareText) {
    return baseLabel;
  }

  return `${baseLabel} · ${locale === "en" ? "Sun care" : "선케어"}`;
}

function getSupportingRoleLabel(item, product, locale = "ko") {
  const role = inferSupportingRole(item, product);
  const roleLabel = locale === "en" ? getEnglishRoleLabel(role, product) : getKoreanRoleLabel(role);
  const stepLabel = getReportStepLabel(product, locale);
  const baseLabel = stepLabel && roleLabel !== stepLabel ? `${roleLabel} · ${stepLabel}` : roleLabel;

  return appendSunCareDescriptor(baseLabel, product, locale);
}

function getRoutineProductRoleDisplay(step = {}, locale = "ko") {
  const product = step?.product || null;

  if (product) {
    return getReportStepLabel(product, locale);
  }

  const rawRole = compactText(step?.productRole);
  const displayKey = normalizeDisplayStepKey(rawRole);

  if (!rawRole) {
    return "";
  }
  if (displayKey) {
    return getReportStepLabel({ category: displayKey }, locale);
  }
  if (locale === "en" && (rawRole.includes("선크림") || rawRole.includes("선케어"))) {
    return "Sunscreen";
  }

  return rawRole;
}

function makeUserFacingRelationToTopPick(rawRelation, role, locale = "ko") {
  const rawText = compactText(rawRelation);

  if (role) {
    return getDefaultRelationToTopPick(role, locale);
  }

  if (!rawText) {
    return "";
  }

  if (locale === "en") {
    return rawText.replace(/\bTop Pick\b/g, "the primary product");
  }

  return rawText
    .replace(/Top Pick/g, "1순위 제품")
    .replace(/부족한 축/g, "보완할 부분")
    .replace(/기능을 더 밀기보다/g, "기능을 늘리기보다");
}

function buildEnglishSupportingReason(role, result = {}) {
  const concern = getReportPriorityLabel(result, "en");

  if (role === "support_concern_booster") {
    return `This fills a support lane around ${concern}, instead of replacing the primary product.`;
  }
  if (role === "low_irritation_option") {
    return "This is the calmer option for days when the skin feels reactive, tight, or easily irritated.";
  }

  return `This keeps the same ${concern} direction while changing the texture, finish, or step burden.`;
}

function buildEnglishSupportingUsage(role) {
  if (role === "support_concern_booster") {
    return "Use it only when the supporting concern is more visible, without stacking too many active roles together.";
  }
  if (role === "low_irritation_option") {
    return "Switch to it on days with stinging, redness, or unusual tightness.";
  }

  return "Swap it in when the primary product role is right but the finish or texture does not fit the day.";
}

function localizeSupportingProductsForEnglish(items = [], result = {}) {
  return items.map((item) => {
    const product = unwrapSupportingProductItem(item);
    const role = item?.role || "same_concern_alternative";

    if (item?.product) {
      return {
        ...item,
        label: getEnglishRoleLabel(role, product),
        reason: hasKoreanText(item.reason) || !item.reason ? buildEnglishSupportingReason(role, result) : item.reason,
        usage: hasKoreanText(item.usage) || !item.usage ? buildEnglishSupportingUsage(role) : item.usage,
        relationToTopPick: hasKoreanText(item.relationToTopPick) || !item.relationToTopPick
          ? getDefaultRelationToTopPick(role, "en")
          : item.relationToTopPick
      };
    }

    return product;
  });
}

function buildEnglishRoutineInstruction(step, slot, result = {}) {
  const product = step?.product || null;
  const category = normalizeReportCategory(product);
  const concern = getReportPriorityLabel(result, "en");

  if (category === "cleanser") {
    return "Cleanse gently enough to remove residue without leaving the skin stripped.";
  }
  if (category === "sunscreen") {
    return "Finish with enough sunscreen, and keep the layer light enough to reapply when needed.";
  }
  if (category === "moisturizer") {
    return `Use this as the sealing step so ${concern} does not push the routine into heavier active stacking.`;
  }
  if (category === "toner_essence") {
    return "Apply a thin first hydration layer before heavier products so the routine starts evenly.";
  }
  if (category === "serum_ampoule") {
    return "Use one focused serum lane and keep the rest of the routine simple around it.";
  }

  return slot === "morning"
    ? "Keep the morning step light, protective, and easy to repeat."
    : "Use the evening step to reset and support recovery without adding unnecessary layers.";
}

function buildKoreanRoutineInstruction(step, slot, result = {}) {
  const product = step?.product || null;
  const category = normalizeReportCategory(product);
  const concern = getReportPriorityLabel(result, "ko");

  if (category === "cleanser") {
    return "잔여감은 정리하되, 세안 후 당김이 남지 않게 짧고 부드럽게 사용합니다.";
  }
  if (category === "sunscreen") {
    return "아침 마지막에 충분히 바르고, 야외 시간이 길면 덧바르는 쪽으로 봅니다.";
  }
  if (category === "moisturizer") {
    return `${concern} 흐름이 더 무거워지지 않게 마무리 단계에서 얇게 막을 잡아줍니다.`;
  }
  if (category === "toner_essence") {
    return "무거운 단계 전에 얇은 수분 결을 먼저 정리합니다.";
  }
  if (category === "serum_ampoule") {
    return "기능성은 한 방향만 두고, 나머지 루틴은 단순하게 유지합니다.";
  }

  return slot === "morning"
    ? "아침에는 가볍고 반복 가능한 방향으로 루틴을 시작합니다."
    : "저녁에는 잔여감을 정리하고 회복을 돕는 쪽으로 마무리합니다.";
}

function buildEnglishRoutineCaution(step, slot, result = {}) {
  const category = normalizeReportCategory(step?.product || null);
  const axis = getReportPriorityAxis(result);

  if (category === "sunscreen") {
    return "Do not replace reapplication with a thicker base layer.";
  }
  if (category === "cleanser") {
    return "Do not scrub harder just because residue or shine feels noticeable.";
  }
  if (axis === "redness" || axis === "barrier") {
    return "Avoid pairing this with high-friction or strongly active steps on the same day.";
  }
  if (slot === "night") {
    return "Do not stack multiple corrective products in the same night routine.";
  }

  return "Keep the surrounding routine simple until the skin feels steady.";
}

function buildKoreanRoutineCaution(step, slot, result = {}) {
  const category = normalizeReportCategory(step?.product || null);
  const axis = getReportPriorityAxis(result);

  if (category === "sunscreen") {
    return "처음부터 두껍게 올리는 방식으로 덧바름을 대신하지 않습니다.";
  }
  if (category === "cleanser") {
    return "번들거림이나 잔여감이 느껴져도 문지르는 강도를 높이지 않습니다.";
  }
  if (axis === "redness" || axis === "barrier") {
    return "마찰이 큰 단계나 강한 기능성 제품과 같은 날 겹치지 않습니다.";
  }
  if (slot === "night") {
    return "보정 제품을 여러 개 한 번에 겹치지 않습니다.";
  }

  return "피부가 안정될 때까지 주변 단계는 단순하게 유지합니다.";
}

function localizeRoutineStepsForEnglish(steps = [], fallbackItems = [], slot = "morning", result = {}) {
  const source = Array.isArray(steps) && steps.length
    ? steps
    : (Array.isArray(fallbackItems) ? fallbackItems : []).map((item, index) => ({
        order: index + 1,
        instruction: String(item || "").trim()
      }));

  return source.map((step, index) => ({
    ...step,
    order: Number.isFinite(Number(step.order)) ? Number(step.order) : index + 1,
    stepName: `${slot === "morning" ? "Morning" : "Night"} Step ${index + 1}`,
    productRole: step.product ? getReportStepLabel(step.product, "en") : "",
    instruction: buildEnglishRoutineInstruction(step, slot, result),
    frequency: slot === "morning" ? "Every morning" : "Every night",
    caution: buildEnglishRoutineCaution(step, slot, result)
  }));
}

function localizeRoutineStepsForKorean(steps = [], fallbackItems = [], slot = "morning", result = {}) {
  const source = Array.isArray(steps) && steps.length
    ? steps
    : (Array.isArray(fallbackItems) ? fallbackItems : []).map((item, index) => ({
        order: index + 1,
        instruction: String(item || "").trim()
      }));

  return source.map((step, index) => ({
    ...step,
    order: Number.isFinite(Number(step.order)) ? Number(step.order) : index + 1,
    stepName: String(step.stepName || "").trim() || `${slot === "morning" ? "아침" : "저녁"} ${index + 1}단계`,
    productRole: step.product ? getReportStepLabel(step.product, "ko") : String(step.productRole || "").trim(),
    instruction: String(step.instruction || "").trim() || buildKoreanRoutineInstruction(step, slot, result),
    frequency: String(step.frequency || "").trim() || (slot === "morning" ? "매일 아침" : "매일 저녁"),
    caution: String(step.caution || "").trim() || buildKoreanRoutineCaution(step, slot, result)
  }));
}

function buildEnglishRoutineVariants(result = {}) {
  const concern = getReportPriorityLabel(result, "en");

  return [
    {
      key: "sensitive_day",
      label: "Sensitive day",
      items: ["Keep cleansing low-friction.", "Skip extra active or exfoliating steps.", "Use the Top Pick as the main support step only."]
    },
    {
      key: "breakout_day",
      label: "Breakout day",
      items: ["Do not add several spot-care products at once.", `Keep the routine centered on ${concern}.`, "Reduce heavy finish layers if they feel suffocating."]
    },
    {
      key: "outdoor_day",
      label: "Outdoor-heavy day",
      items: ["Protect the morning routine first.", "Reapply sunscreen when exposure is long.", "Reset sunscreen and surface residue gently at night."]
    },
    {
      key: "makeup_day",
      label: "Makeup day",
      items: ["Keep the base layers thin.", "Avoid products that pill under makeup.", "Clean off makeup and sunscreen fully before the night routine."]
    }
  ];
}

function buildKoreanRoutineVariants(result = {}) {
  const concern = getReportPriorityLabel(result, "ko");

  return [
    {
      key: "sensitive_day",
      label: "민감한 날",
      items: ["세안은 마찰을 줄이고 짧게 끝냅니다.", "각질 케어나 고기능 제품은 추가하지 않습니다.", "1순위 제품을 중심 단계로만 두고 루틴을 가볍게 유지합니다."]
    },
    {
      key: "breakout_day",
      label: "트러블 올라온 날",
      items: ["스팟 케어 제품을 여러 개 겹치지 않습니다.", `루틴 중심은 ${concern} 방향으로 유지합니다.`, "답답한 마무리감이 느껴지면 두꺼운 마감 제품은 줄입니다."]
    },
    {
      key: "outdoor_day",
      label: "야외활동 많은 날",
      items: ["아침 루틴은 보호 단계를 먼저 안정시킵니다.", "노출 시간이 길면 선크림은 덧바르는 쪽으로 봅니다.", "저녁에는 선크림과 표면 잔여감을 순하게 정리합니다."]
    },
    {
      key: "makeup_day",
      label: "메이크업하는 날",
      items: ["베이스 전 단계는 얇게 가져갑니다.", "밀림이 생기는 조합은 피합니다.", "밤에는 메이크업과 선크림 잔여감을 먼저 충분히 지웁니다."]
    }
  ];
}

function buildEnglishAvoidCombinations(result = {}) {
  const axis = getReportPriorityAxis(result);

  if (axis === "redness" || axis === "barrier") {
    return [
      "Hot water + strong rubbing + strong cleansing in the same routine",
      "Exfoliating pads + active serum on a reactive-skin day",
      "Heavy fragrance steps when the skin already feels irritated"
    ];
  }
  if (axis === "acne" || axis === "pores" || axis === "oiliness") {
    return [
      "Strong cleanser + exfoliating pad + spot care on the same night",
      "Heavy occlusive finish layered over a breakout-prone day routine",
      "Extra pore-care steps added only because shine appears"
    ];
  }

  return [
    "Thick moisturizer + heavy base makeup when the skin already feels tight",
    "Multiple active correction steps before the skin has stabilized",
    "Stronger cleansing used to compensate for a heavy routine"
  ];
}

function buildKoreanAvoidCombinations(result = {}) {
  const axis = getReportPriorityAxis(result);

  if (axis === "redness" || axis === "barrier") {
    return [
      "뜨거운 물 + 강한 마찰 + 강한 세안을 같은 루틴에 넣는 조합",
      "각질 패드 + 고기능 세럼을 예민한 날 같이 쓰는 조합",
      "피부가 이미 자극받은 날 향이 강한 제품을 추가하는 조합"
    ];
  }
  if (axis === "acne" || axis === "pores" || axis === "oiliness") {
    return [
      "강한 세안제 + 각질 패드 + 스팟 케어를 같은 밤에 겹치는 조합",
      "트러블이 올라온 날 무거운 마감 제품을 두껍게 덮는 조합",
      "번들거림이 보인다는 이유만으로 모공 케어 단계를 추가하는 조합"
    ];
  }

  return [
    "두꺼운 보습제 + 무거운 베이스 메이크업을 피부가 당기는 날 겹치는 조합",
    "피부가 안정되기 전에 고기능 보정 단계를 여러 개 추가하는 조합",
    "무거운 루틴을 보완하려고 세안을 더 강하게 하는 조합"
  ];
}

const BUDGET_ALTERNATIVE_SUMMARIES = {
  ko: {
    calming: [
      "예민한 날에는 기능을 늘리기보다 진정 축만 남기는 대체안으로 쓰기 좋습니다.",
      "자극 반응이 신경 쓰이는 날에는 루틴을 단순하게 유지하는 선택지로 볼 수 있습니다.",
      "피부가 흔들릴 때는 보정 기능보다 편안한 사용감을 우선하는 쪽으로 맞습니다."
    ],
    hydration: [
      "건조감이 올라오는 날에는 보습 축을 보완하는 선택지로 볼 수 있습니다.",
      "세안 후 당김이 남는 날에는 수분과 장벽감을 먼저 채우는 대체안으로 볼 수 있습니다.",
      "마무리가 쉽게 무너지는 날에는 보습 지속감을 보완하는 역할로 두기 좋습니다."
    ],
    tone_sebum: [
      "톤 불균일이나 유분감이 함께 신경 쓰일 때 보조 선택지로 볼 수 있습니다.",
      "모공과 번들거림이 같이 보이는 날에는 결 정리 쪽 보완안으로 두기 좋습니다.",
      "피지감이 먼저 올라오는 날에는 루틴을 무겁게 만들지 않는 보조 축으로 맞습니다."
    ],
    light: [
      "무거운 마무리가 부담스러운 날에 더 가볍게 바꿔 쓰기 좋은 선택입니다.",
      "산뜻한 사용감이 필요한 아침에는 단계 부담을 낮추는 대체안으로 볼 수 있습니다.",
      "답답한 막이 싫은 날에는 같은 방향을 유지하면서 제형 부담을 줄이기 좋습니다."
    ],
    sunscreen: [
      "자외선 노출이 긴 날에는 루틴 마지막을 선케어 축으로 분리해 보기 좋습니다.",
      "아침 루틴에서는 보정 제품을 늘리기보다 보호 단계를 명확히 두는 선택지입니다.",
      "야외 시간이 길 때는 덧바름까지 고려하는 선케어 대체안으로 볼 수 있습니다."
    ],
    focused: [
      "같은 세럼/앰플이라도 한 가지 기능만 좁게 남기고 싶을 때 쓰기 좋은 대체안입니다.",
      "보조 기능을 넓히기보다 현재 고민 하나에만 초점을 맞추는 역할로 볼 수 있습니다.",
      "루틴을 복잡하게 만들지 않고 집중 케어 단계만 바꾸고 싶을 때 맞는 선택입니다."
    ],
    same: [
      "1순위 제품이 매일 쓰기 부담스러운 날, 같은 단계에서 더 가볍게 바꿔볼 수 있습니다.",
      "추천 방향은 유지하면서 제형이나 마무리 취향만 다르게 가져갈 때 볼 수 있습니다.",
      "주요 고민 축은 바꾸지 않고 루틴 안의 부담만 조정하는 선택지입니다."
    ]
  },
  en: {
    calming: [
      "Use this as a calmer swap when the skin feels reactive, instead of adding more active steps.",
      "This keeps the routine simpler on days when sensitivity is easier to trigger.",
      "It prioritizes comfort over stronger correction when the skin feels unstable."
    ],
    hydration: [
      "Use this when dryness rises and you want to reinforce the moisture lane without adding step burden.",
      "It works as a moisture-support swap when tightness stays after cleansing.",
      "This is the option to keep barrier comfort steadier without making the routine heavier."
    ],
    tone_sebum: [
      "Use this as a support option when uneven tone or oiliness is also visible.",
      "It fits days when pores and shine need a lighter texture-control lane.",
      "This keeps the support role around sebum and texture without replacing the main priority."
    ],
    light: [
      "Use this when a heavier finish feels uncomfortable and the routine needs a lighter swap.",
      "It lowers step burden for mornings when a fresh finish matters more.",
      "This keeps the same direction while reducing texture weight."
    ],
    sunscreen: [
      "Use this as a clear sun-care option when outdoor exposure is longer.",
      "It separates the protection role from correction steps in the morning routine.",
      "This is the sun-care swap to consider when reapplication matters."
    ],
    focused: [
      "Use this when you want one focused serum lane instead of expanding the routine.",
      "It keeps the support role narrow around one concern rather than adding several functions.",
      "This works as a focused-care swap without changing the selected recommendation set."
    ],
    same: [
      "Use this to keep the same step direction while adjusting texture, finish, or price burden.",
      "It keeps the recommendation lane intact while changing the wear profile.",
      "This is a lower-burden swap that does not change the main recommendation logic."
    ]
  }
};

function buildProductTextIndex(product = {}) {
  const parts = [];
  const append = (value) => {
    if (!value) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }

    if (typeof value === "object") {
      Object.values(value).forEach(append);
      return;
    }

    parts.push(String(value));
  };

  [
    product.category,
    product.step,
    product.texture,
    product.finish,
    product.reason,
    product.summary,
    product.comparison_reason,
    product.concerns,
    product.tags,
    product.skin_types,
    product.decision_meta
  ].forEach(append);

  return parts.join(" ").toLowerCase();
}

function productTextHas(product, tokens = []) {
  const textIndex = buildProductTextIndex(product);

  return tokens.some((token) => textIndex.includes(token));
}

function getBudgetAlternativeKind(product = {}) {
  const category = normalizeReportCategory(product);

  if (category === "sunscreen") {
    return "sunscreen";
  }
  if (
    product?.sensitivity_safe ||
    productTextHas(product, ["sensitive", "calm", "redness", "low irritation", "진정", "민감", "붉은"])
  ) {
    return "calming";
  }
  if (
    category === "moisturizer" ||
    productTextHas(product, ["dehydration", "hydration", "moist", "dry", "barrier", "수분", "보습", "건조", "장벽"])
  ) {
    return "hydration";
  }
  if (
    productTextHas(product, ["tone", "oil", "sebum", "pores", "acne", "texture", "톤", "유분", "피지", "모공", "트러블", "결"])
  ) {
    return "tone_sebum";
  }
  if (
    productTextHas(product, ["light", "fresh", "gel", "watery", "matte", "가벼", "산뜻", "젤", "워터", "매트"])
  ) {
    return "light";
  }
  if (category === "serum_ampoule") {
    return "focused";
  }

  return "same";
}

function chooseBudgetAlternativeSummary(product, locale = "ko", usedSummaries = new Set()) {
  const language = locale === "en" ? "en" : "ko";
  const kind = getBudgetAlternativeKind(product);
  const candidates = BUDGET_ALTERNATIVE_SUMMARIES[language][kind] || BUDGET_ALTERNATIVE_SUMMARIES[language].same;
  const summary = candidates.find((item) => !usedSummaries.has(item.toLowerCase())) || candidates[0] || "";

  if (summary) {
    usedSummaries.add(summary.toLowerCase());
  }

  return summary;
}

function buildDisplayBudgetAlternatives(items = [], result = {}, locale = "ko") {
  const seenProducts = new Set();
  const usedSummaries = new Set();

  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const product = unwrapSupportingProductItem(item);

      if (!product) {
        return null;
      }

      return {
        ...item,
        ...product,
        id: product.id || item?.id || null,
        name: item?.name || product.name || "",
        brand: item?.brand || product.brand || "",
        price_range: item?.price_range || product.price_range || "",
        summary: chooseBudgetAlternativeSummary(product, locale, usedSummaries)
      };
    })
    .filter((item) => {
      const key = item?.id || `${item?.brand}-${item?.name}`;

      if (!key || !item?.name || seenProducts.has(key)) {
        return false;
      }

      seenProducts.add(key);
      return true;
    });
}

function hasConcretePriceComparison(items = []) {
  return (Array.isArray(items) ? items : []).some((item) => {
    const priceText = compactText(item?.price_range || item?.priceRange || item?.price || "");

    return /(?:₩|원|\$|usd|krw|[0-9]{2,})/i.test(priceText);
  });
}

function getBudgetSectionTitle(copy, items = [], locale = "ko") {
  if (locale === "en") {
    return hasConcretePriceComparison(items) ? copy.budget : "Lower-burden alternatives";
  }

  return hasConcretePriceComparison(items) ? copy.budget : copy.budgetLowerBurden || "부담 낮춘 대안";
}

function localizeBudgetAlternativesForEnglish(items = [], result = {}) {
  return buildDisplayBudgetAlternatives(items, result, "en");
}

function localizeFullReportForLocale(report, result, locale = "ko") {
  if (!report) {
    return report;
  }

  if (locale !== "en") {
    const localizedReport = {
      ...report,
      budgetAlternatives: buildDisplayBudgetAlternatives(report.budgetAlternatives || [], result, locale)
    };

    return {
      ...localizedReport,
      topPickReasonBlocks: buildTopPickReasonBlocks({
        report: localizedReport,
        result,
        product: result?.topPick || null,
        locale
      })
    };
  }

  const localizedReport = {
    ...report,
    topPickDetailedReason: hasKoreanText(report.topPickDetailedReason) || !report.topPickDetailedReason
      ? buildEnglishTopPickDetailedReason(result)
      : report.topPickDetailedReason,
    supportingProducts: localizeSupportingProductsForEnglish(report.supportingProducts || [], result),
    fullRoutine: {
      ...report.fullRoutine,
      morning: ["Start with a light, repeatable morning routine around the Top Pick."],
      night: ["Use the evening routine to reset residue and support recovery without stacking too much."],
      morningSteps: localizeRoutineStepsForEnglish(
        report.fullRoutine?.morningSteps || [],
        report.fullRoutine?.morning || [],
        "morning",
        result
      ),
      nightSteps: localizeRoutineStepsForEnglish(
        report.fullRoutine?.nightSteps || [],
        report.fullRoutine?.night || [],
        "night",
        result
      )
    },
    routineVariants: buildEnglishRoutineVariants(result),
    avoidCombinations: buildEnglishAvoidCombinations(result),
    budgetAlternatives: localizeBudgetAlternativesForEnglish(report.budgetAlternatives || [], result)
  };

  return {
    ...localizedReport,
    topPickReasonBlocks: buildTopPickReasonBlocks({
      report: localizedReport,
      result,
      product: result?.topPick || null,
      locale
    })
  };
}

function TopPickHeroCard({ product, report, copy, locale, result }) {
  if (!product) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);
  const topPickReasonBlocks = Array.isArray(report?.topPickReasonBlocks) && report.topPickReasonBlocks.length
    ? report.topPickReasonBlocks
    : buildTopPickReasonBlocks({ report, result, product, locale });

  return (
    <section className="ui-card p-6">
      <div className="grid grid-cols-[1fr_96px] gap-4 sm:grid-cols-[1fr_120px] sm:gap-5">
        <div className="min-w-0">
          <p className="ui-kicker">{copy.topPickReason}</p>
          <h2 className="ui-title mt-2 break-words text-[1.35rem] sm:text-[1.45rem]">{product.name || "Top Pick"}</h2>
          <p className="ui-text-secondary mt-1 text-sm">{product.brand || ""}</p>
          {topPickReasonBlocks.length ? (
            <div className="mt-4 grid gap-3">
              {topPickReasonBlocks.map((block, index) => (
                <div key={`${block.key}-${index}`} className="rounded-[1rem] bg-white/5 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {block.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{block.body}</p>
                </div>
              ))}
            </div>
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
  const roleLabel = getSupportingRoleLabel(item, product, locale);
  const roleReason = locale === "en" && hasKoreanText(item?.reason)
    ? buildEnglishSupportingReason(item?.role, {})
    : item?.reason || (locale === "en" && hasKoreanText(product.reason) ? "" : product.reason) || "";
  const usage = locale === "en" && hasKoreanText(item?.usage)
    ? buildEnglishSupportingUsage(item?.role)
    : item?.usage || "";
  const relationToTopPick = makeUserFacingRelationToTopPick(item?.relationToTopPick, item?.role, locale);
  const displayUsage = isSameDisplayText(usage, roleReason) ? "" : usage;
  const displayRelationToTopPick = [roleReason, displayUsage].some((itemText) => isSameDisplayText(itemText, relationToTopPick))
    ? ""
    : relationToTopPick;

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
              <h3 className="ui-title mt-2 break-words text-base">{product.name}</h3>
              <p className="ui-text-secondary mt-1 text-sm">{product.brand}</p>
            </div>
            {product.price_range ? <span className="ui-chip-compact shrink-0">{product.price_range}</span> : null}
          </div>

          {roleReason ? (
            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{roleReason}</p>
          ) : null}

          {displayUsage ? (
            <div className="mt-3 rounded-[1rem] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "When to use" : "언제 쓰면 좋은지"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{displayUsage}</p>
            </div>
          ) : null}

          {displayRelationToTopPick ? (
            <div className="mt-2 rounded-[1rem] bg-white/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {locale === "en" ? "Difference from primary product" : "1순위와의 차이"}
              </p>
              <p className="mt-1.5 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{displayRelationToTopPick}</p>
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
  const getOptionLabel = (item, index) => {
    const product = unwrapSupportingProductItem(item);

    if (product) {
      return getSupportingRoleLabel(item, product, locale);
    }

    return locale === "en" ? `Option ${index + 1}` : `선택지 ${index + 1}`;
  };

  return (
    <section className="ui-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ui-kicker">{copy.alternativesTitle}</p>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.alternativesBody}</p>
        </div>
        <span className="ui-chip-compact shrink-0">{activeIndex + 1} / {items.length}</span>
      </div>

      {items.length > 1 ? (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item, index) => {
            const active = index === activeIndex;

            return (
              <button
                key={getSupportingProductItemKey(item)}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`ui-button-secondary px-3 py-2.5 text-xs font-medium ${active ? "ui-choice-active" : ""}`}
              >
                {getOptionLabel(item, index)}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="mt-4">
        <SupportingProductCard item={activeItem} copy={copy} locale={locale} />
      </div>
    </section>
  );
}

function SituationVariantsSelector({ variants = [] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [variants.length]);

  if (!variants.length) {
    return null;
  }

  const activeVariant = variants[Math.min(activeIndex, variants.length - 1)];

  return (
    <div className="mt-4 space-y-3">
      {variants.length > 1 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {variants.map((variant, index) => {
            const active = index === activeIndex;

            return (
              <button
                key={variant.key || variant.label}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`ui-button-secondary px-3 py-2.5 text-xs font-medium ${active ? "ui-choice-active" : ""}`}
              >
                {variant.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="ui-card-subtle p-4">
        <p className="ui-kicker">{activeVariant.label}</p>
        {renderList(activeVariant.items)}
      </div>
    </div>
  );
}

function BudgetAlternativeCard({ item, copy, locale = "ko" }) {
  if (!item) {
    return null;
  }

  const purchaseLink = getPurchaseLinkInfo(item, copy, locale);

  return (
    <article className="ui-card-muted rounded-[1.25rem] p-4">
      <div className="flex items-start gap-3">
        <div className="shrink-0">
          <ProductThumb product={item} copy={copy} sizeClass="h-20 w-16" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="ui-title break-words text-sm">{item.name}</p>
              <p className="ui-text-secondary mt-1 text-xs">{item.brand}</p>
            </div>
            {item.price_range ? <span className="ui-chip-compact shrink-0">{item.price_range}</span> : null}
          </div>
          {item.summary ? (
            <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.summary}</p>
          ) : null}
          <a
            href={purchaseLink.href}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              trackEvent("click_buy_link", {
                product_id: item.id || null,
                feature_name: "skin_analysis",
                result_type: "full_report_budget",
                is_top_pick: false,
                meta_json: {
                  step: item.step || null,
                  brand: item.brand || null,
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

function BudgetAlternativesStep({ items = [], title, copy, locale = "ko" }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className="ui-card p-6">
      <p className="ui-kicker">{title}</p>
      <div className="mt-4 grid gap-3">
        {items.map((item) => (
          <BudgetAlternativeCard
            key={item.id || `${item.brand}-${item.name}`}
            item={item}
            copy={copy}
            locale={locale}
          />
        ))}
      </div>
    </section>
  );
}

function SituationAdjustmentStep({ variants = [], avoidItems = [], copy }) {
  const hasVariants = variants.length > 0;
  const hasAvoidItems = avoidItems.length > 0;

  if (!hasVariants && !hasAvoidItems) {
    return null;
  }

  return (
    <div className="space-y-4">
      {hasVariants ? (
        <section className="ui-card p-6">
          <p className="ui-kicker">{copy.situationVariants}</p>
          <SituationVariantsSelector variants={variants} />
        </section>
      ) : null}

      {hasAvoidItems ? (
        <section className="ui-card p-6">
          <p className="ui-kicker">{copy.avoid}</p>
          {renderList(avoidItems)}
        </section>
      ) : null}
    </div>
  );
}

function SkinMatchStepReport({
  freeResult,
  report,
  copy,
  locale,
  alternativeItems = [],
  morningSteps = [],
  nightSteps = [],
  displayRoutineVariants = [],
  displayAvoidCombinations = [],
  displayBudgetAlternatives = [],
  budgetSectionTitle
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const labels = locale === "en"
    ? {
        stepKicker: "SKIN MATCH STEP",
        topPick: "Primary Product Analysis",
        alternatives: "Alternative Product Strategy",
        morning: "Morning Routine",
        night: "Night Routine",
        adjustment: "Situation Adjustments",
        budget: budgetSectionTitle || "Lower-burden alternatives",
        previous: "Previous",
        next: "Next",
        backResult: "Back to free result"
      }
    : {
        stepKicker: "SKIN MATCH STEP",
        topPick: "1순위 제품 분석",
        alternatives: "대체 제품 전략",
        morning: "아침 루틴",
        night: "저녁 루틴",
        adjustment: "상황별 조정",
        budget: budgetSectionTitle || "부담 낮춘 대안",
        previous: "이전",
        next: "다음",
        backResult: "결과 다시보기"
      };
  const steps = [
    freeResult?.topPick
      ? {
          key: "top_pick",
          label: labels.topPick,
          content: (
            <TopPickHeroCard
              product={freeResult.topPick}
              report={report}
              copy={copy}
              locale={locale}
              result={freeResult}
            />
          )
        }
      : null,
    alternativeItems.length
      ? {
          key: "alternatives",
          label: labels.alternatives,
          content: <AlternativeCarousel items={alternativeItems} copy={copy} locale={locale} />
        }
      : null,
    morningSteps.length
      ? {
          key: "morning",
          label: labels.morning,
          content: (
            <section className="ui-card p-6">
              <RoutineTimelineGroup
                title={copy.morning}
                steps={morningSteps}
                copy={copy}
                locale={locale}
              />
            </section>
          )
        }
      : null,
    nightSteps.length
      ? {
          key: "night",
          label: labels.night,
          content: (
            <section className="ui-card p-6">
              <RoutineTimelineGroup
                title={copy.night}
                steps={nightSteps}
                copy={copy}
                locale={locale}
              />
            </section>
          )
        }
      : null,
    displayRoutineVariants.length || displayAvoidCombinations.length
      ? {
          key: "adjustment",
          label: labels.adjustment,
          content: (
            <SituationAdjustmentStep
              variants={displayRoutineVariants}
              avoidItems={displayAvoidCombinations}
              copy={copy}
            />
          )
        }
      : null,
    displayBudgetAlternatives.length
      ? {
          key: "budget",
          label: labels.budget,
          content: (
            <BudgetAlternativesStep
              items={displayBudgetAlternatives}
              title={budgetSectionTitle}
              copy={copy}
              locale={locale}
            />
          )
        }
      : null
  ].filter(Boolean);
  const maxStepIndex = Math.max(steps.length - 1, 0);
  const currentStepIndex = Math.min(activeStepIndex, maxStepIndex);
  const activeStep = steps[currentStepIndex];

  useEffect(() => {
    if (activeStepIndex > maxStepIndex) {
      setActiveStepIndex(maxStepIndex);
    }
  }, [activeStepIndex, maxStepIndex]);

  if (!activeStep) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="ui-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="ui-kicker">{labels.stepKicker}</p>
            <h2 className="ui-title mt-2 text-xl">{activeStep.label}</h2>
          </div>
          <span className="ui-chip-compact shrink-0">{currentStepIndex + 1} / {steps.length}</span>
        </div>

        <div
          className="mt-4 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
        >
          {steps.map((step, index) => (
            <button
              key={step.key}
              type="button"
              onClick={() => setActiveStepIndex(index)}
              className={`h-2 rounded-full transition ${
                index === currentStepIndex
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : "bg-zinc-200 dark:bg-zinc-800"
              }`}
              aria-label={`${step.label} ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {activeStep.content}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setActiveStepIndex((current) => Math.max(current - 1, 0))}
          disabled={currentStepIndex === 0}
          className="ui-button-secondary min-h-12 px-4 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
        >
          {labels.previous}
        </button>
        {currentStepIndex === maxStepIndex ? (
          <Link
            href={getResultPath(locale)}
            className="ui-button-primary min-h-12 justify-center px-4 py-3 text-sm font-semibold"
          >
            {labels.backResult}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setActiveStepIndex((current) => Math.min(current + 1, maxStepIndex))}
            className="ui-button-primary min-h-12 px-4 py-3 text-sm font-semibold"
          >
            {labels.next}
          </button>
        )}
      </div>
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
          productRole: getRoutineProductRoleDisplay(item, locale),
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

function normalizeRoutineStepTitle(step = {}, groupTitle = "", stepCount = 1, locale = "ko") {
  const currentTitle = compactText(step.stepName);

  if (stepCount !== 1) {
    return currentTitle;
  }

  if (locale === "en") {
    return /step\s*1/i.test(currentTitle) ? `${groupTitle} Routine` : currentTitle;
  }

  return /1\s*단계/.test(currentTitle) ? `${groupTitle} 루틴` : currentTitle;
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
      {steps.map((step) => {
        const displayStep = {
          ...step,
          stepName: normalizeRoutineStepTitle(step, title, steps.length, locale)
        };

        return (
        <RoutineTimelineCard
          key={`${title}-${displayStep.order}-${displayStep.stepName}`}
          step={displayStep}
          copy={copy}
          locale={locale}
        />
        );
      })}
    </div>
  );
}

function buildDevelopmentReport(result, faceLabResult, locale = "ko") {
  const premiumReport = result?.premiumReport || {};
  const faceLabLaunch = buildFaceLabLaunchData(faceLabResult || result?.faceLab || null, locale);
  const fallbackMorning = (Array.isArray(premiumReport.fullRoutine?.morning) && premiumReport.fullRoutine.morning.length
    ? premiumReport.fullRoutine.morning
    : Array.isArray(result?.morning)
      ? result.morning.slice(0, 4)
      : []) || [];
  const fallbackNight = (Array.isArray(premiumReport.fullRoutine?.night) && premiumReport.fullRoutine.night.length
    ? premiumReport.fullRoutine.night
    : Array.isArray(result?.night)
      ? result.night.slice(0, 4)
      : []) || [];
  const premiumMorningSteps = Array.isArray(premiumReport.fullRoutine?.morningSteps) && premiumReport.fullRoutine.morningSteps.length
    ? premiumReport.fullRoutine.morningSteps
    : [];
  const premiumNightSteps = Array.isArray(premiumReport.fullRoutine?.nightSteps) && premiumReport.fullRoutine.nightSteps.length
    ? premiumReport.fullRoutine.nightSteps
    : [];

  const report = {
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
      morning: fallbackMorning,
      night: fallbackNight,
      morningSteps: localizeRoutineStepsForKorean(premiumMorningSteps, fallbackMorning, "morning", result),
      nightSteps: localizeRoutineStepsForKorean(premiumNightSteps, fallbackNight, "night", result)
    },
    routineVariants:
      (Array.isArray(premiumReport.routineVariants) && premiumReport.routineVariants.length
        ? premiumReport.routineVariants
        : Array.isArray(result?.premiumReport?.fullRoutine?.variants) && result.premiumReport.fullRoutine.variants.length
          ? result.premiumReport.fullRoutine.variants
          : buildKoreanRoutineVariants(result)) || [],
    avoidCombinations:
      (Array.isArray(premiumReport.avoidCombinations) && premiumReport.avoidCombinations.length
        ? premiumReport.avoidCombinations
        : Array.isArray(result?.avoid) && result.avoid.length
          ? result.avoid.slice(0, 4)
          : buildKoreanAvoidCombinations(result)) || [],
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

  return localizeFullReportForLocale(report, result, locale);
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
      primary: "Cat-like",
      secondary: ["Rabbit-like", "Soft tofu-like"],
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

        if (response.status === 401) {
          clearWriteAccessToken();
          setReport(fallbackReport);
          return;
        }

        if (!response.ok || !data) {
          throw new Error(data?.error || copy.errorBody);
        }

        const localizedData = localizeFullReportForLocale(data, parsedResult, locale);
        setReport(localizedData);
        trackEvent("view_full_report", {
          product_id: parsedResult?.topPick?.id || null,
          feature_name: "skin_analysis",
          result_type: "full_report",
          is_top_pick: false,
          meta_json: {
            supporting_count: Array.isArray(localizedData.supportingProducts) ? localizedData.supportingProducts.length : 0,
            has_face_lab_paid: Boolean(
              localizedData.faceLab?.faceMood?.primary ||
              localizedData.faceLab?.sections?.length ||
              localizedData.faceLab?.steps?.length ||
              localizedData.faceLab?.faceSummary ||
                localizedData.faceLab?.hairDirections?.length ||
                localizedData.faceLab?.avoidStyles?.length ||
                localizedData.faceLab?.styleKeywords?.length ||
                localizedData.faceLab?.toneDirection ||
                localizedData.faceLab?.reasoningLines?.length
            ),
            has_fit_gauges: Boolean(localizedData.topPickFitGauges?.gauges?.length)
          }
        });
      } catch (requestError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[full-report] using fallback report", requestError);
        }
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
  const displayRoutineVariants = Array.isArray(report.routineVariants)
    ? report.routineVariants
        .map((variant) => ({
          ...variant,
          items: uniqueDisplayTexts(variant?.items || [])
        }))
        .filter((variant) => variant.items.length)
    : [];
  const displayAvoidCombinations = uniqueDisplayTexts(report.avoidCombinations || []);
  const displayBudgetAlternatives = buildDisplayBudgetAlternatives(report.budgetAlternatives || [], freeResult, locale);
  const budgetSectionTitle = getBudgetSectionTitle(copy, displayBudgetAlternatives, locale);

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-20 pt-4 sm:px-6 sm:pt-6">
        <div className="space-y-4">
          <header className="ui-card p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="ui-kicker">FULL REPORT</p>
                <h1 className="ui-title mt-2 text-xl sm:text-2xl">{copy.title}</h1>
                <p className="ui-text-secondary mt-3 text-sm leading-6">{copy.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { code: "ko", label: "한국어" },
                    { code: "en", label: "English" }
                  ].map((item) => {
                    const active = locale === item.code;
                    return (
                      <Link
                        key={item.code}
                        href={getLocalePath(pathname, item.code)}
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-medium transition ${
                          active
                            ? "ui-choice-active"
                            : "ui-button-secondary bg-white/88 text-zinc-600 dark:bg-zinc-900/88"
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
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
            <SkinMatchStepReport
              freeResult={freeResult}
              report={report}
              copy={copy}
              locale={locale}
              alternativeItems={alternativeItems}
              morningSteps={morningSteps}
              nightSteps={nightSteps}
              displayRoutineVariants={displayRoutineVariants}
              displayAvoidCombinations={displayAvoidCombinations}
              displayBudgetAlternatives={displayBudgetAlternatives}
              budgetSectionTitle={budgetSectionTitle}
            />
          ) : (
            <FaceLabSection report={report} photoUrl={submissionImageUrl} locale={locale} />
          )}
        </div>
      </div>
    </main>
  );
}
