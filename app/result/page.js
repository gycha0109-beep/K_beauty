"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import ResultSection from "@/components/ResultSection";
import LoadingSpinner from "@/components/LoadingSpinner";
const displayMap = {
  ko: {
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
  },
  en: {
    skinType: {
      oily: "Oily",
      dry: "Dry",
      combination: "Combination",
      not_sure: "Not sure"
    },
    mainConcern: {
      oiliness: "Oiliness",
      dehydration: "Dehydration",
      acne: "Breakouts",
      uneven_tone: "Uneven tone",
      pores: "Pores",
      redness: "Redness",
      barrier: "Barrier"
    }
  }
};

const topPickHeadlineMap = {
  ko: {
    oiliness: "유분과 모공 흐름에서 가장 먼저 체감 차이가 나는 1순위",
    pores: "모공과 번들거림 기준으로 먼저 바꿔야 할 1순위",
    dehydration: "지금 피부 건조감에서 가장 먼저 보완할 1순위",
    acne: "트러블 부담을 줄이기 위해 먼저 바꿔야 할 1순위",
    uneven_tone: "톤 컨디션을 정리할 때 가장 먼저 손댈 1순위",
    redness: "예민하게 올라오는 피부에서 가장 먼저 바꿔야 할 1순위",
    barrier: "장벽이 흔들리는 지금 가장 먼저 써야 할 1순위"
  },
  en: {
    oiliness: "The first product to switch for oil flow and pore control",
    pores: "The first product to check for pores and midday shine",
    dehydration: "The first product to add for current dehydration",
    acne: "The first product to reach for when breakouts keep returning",
    uneven_tone: "The first product to check when tone looks uneven",
    redness: "The first product to calm visibly reactive skin",
    barrier: "The first product to use when your barrier feels shaky"
  }
};

const feedbackQuestionMap = {
  ko: [
    { id: "reflects_skin", text: "내 피부 상태를 잘 반영했나요?" },
    { id: "recommendation_makes_sense", text: "추천이 납득됐나요?" },
    { id: "worth_buying", text: "사볼 만한 제품이 있었나요?" }
  ],
  en: [
    { id: "reflects_skin", text: "Did this reflect your skin well?" },
    { id: "recommendation_makes_sense", text: "Did the recommendation make sense?" },
    { id: "worth_buying", text: "Was there anything you would actually buy?" }
  ]
};

const resultCopy = {
  ko: {
    loading: "결과를 불러오는 중입니다...",
    title: "당신의 K-뷰티 매치",
    tryAgain: "다시 테스트하기",
    skinProfile: "당신의 피부 프로필",
    profileBody: "이 조건을 기준으로 가장 안정적인 루틴을 정리했습니다.",
    currentConcern: "현재 고민",
    currentSkin: "지금 피부",
    currentConcernBasis: "현재 고민 기준",
    topPickFallback: "이 조건에서는 이 제품을 먼저 써야 합니다",
    productStartHere: "가장 먼저 시작할 제품",
    recommendationDirection: "추천 방향",
    categoryPicks: "함께 보면 좋은 추천",
    dailyRoutine: "아침 · 저녁 루틴",
    notes: "주의사항 · 참고할 점",
    cautions: "주의사항",
    skinNote: "참고할 점",
    quickFeedback: "짧은 피드백",
    feedbackSaved: "저장됨",
    especiallyGoodFor: "이럴 때 특히 좋아요",
    imageEmpty: "이미지 없음",
    imagePreparing: "이미지 준비 중",
    previous: "이전",
    next: "다음",
    topPickBadge: "1순위 추천",
    more: "더보기",
    less: "접기",
    buyNow: "구매하기",
    findStore: "구매처 찾기",
    fitHeading: "현재 입력 기준 적합도",
    fitHeadingCompact: "현재 입력 기준",
    fitLabels: ["보습", "장벽", "트러블", "사용감", "민감도"],
    directionSummaryBarrier: "지금은 장벽 회복과 가벼운 보습 연결이 우선입니다.",
    directionSummaryOil: "지금은 유분 흐름을 먼저 정리하는 쪽이 맞습니다.",
    directionSummaryCalm: "지금은 자극 부담을 줄이는 쪽이 먼저입니다.",
    directionSummaryDefault: "지금은 피부 흐름을 단순하게 정리하는 편이 맞습니다.",
    directionActionLight: "무거운 마무리보다 흡수 빠른 루틴부터 시작하세요.",
    directionActionLayer: "보습이 끊기지 않게 얇게 여러 단계로 이어가세요.",
    directionActionCalm: "자극 가능성이 큰 단계보다 순한 구성부터 맞춰보세요.",
    directionActionDefault: "제품 수를 늘리기보다 기본 단계부터 안정적으로 맞춰보세요.",
    routineCleanser: "순한 클렌저로 가볍게 세안",
    routineToner: "가벼운 토너로 수분 연결",
    routineSerum: "필요한 고민 위주로 세럼 한 단계 추가",
    routineSunscreen: "가벼운 선크림으로 마무리",
    routineMoisturizer: "무겁지 않은 보습으로 마무리",
    useTime: { day: "아침", night: "저녁", both: "아침·저녁" },
    especiallyOil: "오후 유분이 빠르게 올라오는 피부",
    especiallyTight: "세안 후 당김이 오래 남는 피부",
    especiallyMask: "마스크 마찰로 예민해지는 피부",
    especiallyPores: "모공과 번들거림이 함께 신경 쓰이는 피부",
    especiallyAcne: "잔여감이 무거우면 트러블이 올라오는 피부",
    especiallyNight: "밤 루틴에서 집중 관리가 필요한 날",
    especiallyDay: "아침 루틴에서 가볍게 마무리하고 싶은 날",
    especiallyDefault: "매일 부담 없이 루틴을 이어가고 싶은 피부",
    signalConcern: "일치",
    signalSkin: "맞춤",
    signalTextureExact: "사용감 일치",
    signalTextureNear: "사용감 근접",
    signalFinish: "마무리감 적합",
    signalSensitive: "민감 피부 우호",
    signalLowIrritation: "저자극 축",
    noResultTitle: "결과를 불러오지 못했습니다.",
    noResultBody: "표시할 결과가 없습니다. 홈으로 돌아가 다시 테스트해 주세요.",
    notesSubtitle: "시작 전에 가볍게 보고 넘어갈 포인트만 묶었습니다.",
    routineSubtitle: "아침과 저녁 루틴을 한 번에 짧게 정리했습니다.",
    feedbackSubtitle: "한두 번만 눌러 주셔도 다음 추천 개선에 바로 도움이 됩니다."
  },
  en: {
    loading: "Loading your result...",
    title: "Your K-Beauty Match",
    tryAgain: "Try Again",
    skinProfile: "Your Skin Profile",
    profileBody: "We organized the most stable routine around these conditions.",
    currentConcern: "Current concern",
    currentSkin: "Current skin",
    currentConcernBasis: "Current concern",
    topPickFallback: "This is the first product to start with for your current condition",
    productStartHere: "Start Here",
    recommendationDirection: "Recommendation Direction",
    categoryPicks: "Also Worth Checking",
    dailyRoutine: "Morning · Night Routine",
    notes: "Cautions · Notes",
    cautions: "Cautions",
    skinNote: "Skin Note",
    quickFeedback: "Quick Feedback",
    feedbackSaved: "Saved",
    especiallyGoodFor: "Especially good for",
    imageEmpty: "No image",
    imagePreparing: "Image coming soon",
    previous: "Previous",
    next: "Next",
    topPickBadge: "Top Pick",
    more: "More",
    less: "Less",
    buyNow: "Buy Now",
    findStore: "Find Store",
    fitHeading: "Fit for your current inputs",
    fitHeadingCompact: "Current fit",
    fitLabels: ["Hydration", "Barrier", "Breakouts", "Texture", "Sensitivity"],
    directionSummaryBarrier: "Barrier support and lighter hydration should come first right now.",
    directionSummaryOil: "It makes more sense to control oil flow first right now.",
    directionSummaryCalm: "Lowering irritation should come first right now.",
    directionSummaryDefault: "A simpler, steadier routine is the better direction right now.",
    directionActionLight: "Start with faster-absorbing layers instead of heavier finishes.",
    directionActionLayer: "Keep hydration going with thinner, layered steps.",
    directionActionCalm: "Start with gentler steps before anything more active.",
    directionActionDefault: "Stabilize the basics before adding more products.",
    routineCleanser: "Cleanse lightly with a gentle cleanser",
    routineToner: "Add hydration with a light toner",
    routineSerum: "Add one serum focused on the main concern",
    routineSunscreen: "Finish with a light sunscreen",
    routineMoisturizer: "Seal in with a light moisturizer",
    useTime: { day: "Morning", night: "Night", both: "Morning·Night" },
    especiallyOil: "skin that gets shiny quickly by the afternoon",
    especiallyTight: "skin that stays tight after cleansing",
    especiallyMask: "skin that reacts more easily with mask friction",
    especiallyPores: "skin concerned with both pores and shine",
    especiallyAcne: "skin that breaks out when residue feels heavy",
    especiallyNight: "nights when you need more focused care",
    especiallyDay: "mornings when you want a lighter finish",
    especiallyDefault: "skin that needs an easy routine every day",
    signalConcern: "match",
    signalSkin: "fit",
    signalTextureExact: "texture match",
    signalTextureNear: "texture close",
    signalFinish: "finish fit",
    signalSensitive: "sensitive-safe",
    signalLowIrritation: "low irritation",
    noResultTitle: "Could not load the result.",
    noResultBody: "There is no result to show yet. Please go back and try again.",
    notesSubtitle: "Only the quick notes worth checking before you start.",
    routineSubtitle: "A short, practical summary of your morning and night routine.",
    feedbackSubtitle: "A quick tap helps improve the next recommendation."
  }
};

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

function getResultCopy(locale = "ko") {
  return resultCopy[locale] || resultCopy.ko;
}

function getDisplayMap(locale = "ko") {
  return displayMap[locale] || displayMap.ko;
}

function getFeedbackQuestions(locale = "ko") {
  return feedbackQuestionMap[locale] || feedbackQuestionMap.ko;
}

function buildLocalizedSkinProfileSummary(form = {}, locale = "ko") {
  const map = getDisplayMap(locale);
  const copy = getResultCopy(locale);
  const items = [];

  if (form.skinType) {
    const skinType = map.skinType[form.skinType] || copy.currentSkin;
    const afternoonMap =
      locale === "en"
        ? {
            more_oily: "more afternoon shine",
            more_dry: "more dryness in the afternoon",
            red_or_irritated: "more afternoon sensitivity",
            mostly_same: "little change in the afternoon"
          }
        : {
            more_oily: "오후 유분 증가",
            more_dry: "오후 건조 심화",
            red_or_irritated: "오후 예민함 증가",
            mostly_same: "오후에도 큰 변화 없음"
          };
    const afternoon = afternoonMap[form.afternoonSkinChange];
    items.push(afternoon ? `${skinType} / ${afternoon}` : skinType);
  }

  if (form.mainConcern) {
    items.push(map.mainConcern[form.mainConcern] || copy.currentConcernBasis);
  }

  if (form.preferredTexture) {
    const textureMap =
      locale === "en"
        ? {
            gel: "prefers light textures",
            watery: "prefers watery textures",
            lotion: "prefers lotion textures",
            cream: "prefers cream textures"
          }
        : {
            gel: "가벼운 제형 선호",
            watery: "워터 제형 선호",
            lotion: "로션 제형 선호",
            cream: "크림 제형 선호"
          };
    items.push(textureMap[form.preferredTexture]);
  }

  if (form.mostDislikedFeel) {
    const dislikeMap =
      locale === "en"
        ? {
            sticky: "avoids stickiness",
            greasy: "avoids greasiness",
            heavy: "avoids heavy feel",
            fragranced: "avoids strong fragrance",
            pilling: "avoids pilling"
          }
        : {
            sticky: "끈적임 회피",
            greasy: "번들거림 회피",
            heavy: "무거운 사용감 회피",
            fragranced: "강한 향 회피",
            pilling: "밀림 회피"
          };
    items.push(dislikeMap[form.mostDislikedFeel]);
  }

  return items.filter(Boolean).slice(0, 4);
}

function getTextureLabel(texture, locale = "ko") {
  const map = locale === "en"
    ? {
        watery: "more lightly",
        gel: "lightly",
        lotion: "smoothly",
        cream: "with more cushion",
        heavy: "more richly"
      }
    : {
        watery: "워터리하게",
        gel: "가볍게",
        lotion: "부드럽게",
        cream: "보습감 있게",
        heavy: "리치하게"
      };
  return map[texture] || (locale === "en" ? "without heaviness" : "부담 없이");
}

function getFinishLabel(finish, locale = "ko") {
  const map = locale === "en"
    ? {
        light: "with a lighter finish",
        natural: "without leaving too much on the surface",
        matte: "with less shine left behind",
        "soft-matte": "while keeping shine more controlled",
        soft_matte: "while keeping shine more controlled",
        dewy: "while softening dry texture",
        rich: "while leaving a steadier moisture layer",
        fresh: "while feeling less stuffy"
      }
    : {
        light: "마무리를 가볍게",
        natural: "표면을 과하게 남기지 않고",
        matte: "번들거림을 덜 남기고",
        "soft-matte": "번들 흐름을 눌러주고",
        soft_matte: "번들 흐름을 눌러주고",
        dewy: "건조한 결을 덜 들뜨게 하고",
        rich: "보습막을 더 안정적으로 남기고",
        fresh: "답답함을 덜 남기고"
      };

  return map[finish] || (locale === "en" ? "with a cleaner finish" : "사용감을 더 깔끔하게");
}

function getTopPickHeadline(form, locale = "ko") {
  const map = topPickHeadlineMap[locale] || topPickHeadlineMap.ko;
  const copy = getResultCopy(locale);
  return map[form?.mainConcern] || copy.topPickFallback;
}

function getTopPickSummary(product, form, locale = "ko") {
  const map = getDisplayMap(locale);
  const copy = getResultCopy(locale);
  const concern = map.mainConcern[form?.mainConcern] || copy.currentConcern;
  const skinType = map.skinType[form?.skinType] || copy.currentSkin;
  const texture = getTextureLabel(product.texture, locale);
  const finish = getFinishLabel(product.finish, locale);

  if (form?.mainConcern === "oiliness" || form?.mainConcern === "pores") {
    return locale === "en"
      ? `For ${skinType.toLowerCase()} skin dealing with ${concern.toLowerCase()}, this one absorbs ${texture} and lands ${finish}, so it creates the clearest first difference.`
      : `${concern} 고민이 함께 있는 ${skinType} 상태에서는, ${texture} 흡수되고 ${finish} 이 제품이 가장 먼저 체감 차이를 만듭니다.`;
  }

  if (form?.mainConcern === "dehydration" || form?.mainConcern === "barrier") {
    return locale === "en"
      ? `When ${skinType.toLowerCase()} skin dries out easily, this one layers ${texture} and stays ${finish}, so it is the first switch that feels different.`
      : `${skinType} 피부가 쉽게 메마르는 지금은, ${texture} 쌓이면서도 ${finish} 이 제품부터 바꾸는 편이 체감이 가장 큽니다.`;
  }

  if (form?.mainConcern === "redness" || form?.mainConcern === "acne") {
    return locale === "en"
      ? `For ${skinType.toLowerCase()} skin that keeps dealing with ${concern.toLowerCase()}, this one feels ${finish} and lowers irritation load first.`
      : `${concern}이 반복되는 ${skinType} 상태에서는, ${finish} 자극 부담을 덜어주는 이 제품이 가장 먼저 손에 잡힐 선택입니다.`;
  }

  return locale === "en"
    ? `For your current ${concern.toLowerCase()} concern, this one layers ${texture} and stays ${finish}, making the routine feel steadier first.`
    : `현재 ${concern} 기준에서는, ${texture} 이어지고 ${finish} 이 제품이 가장 먼저 피부 흐름을 정리해 줍니다.`;
}

function getTopPickReason(product) {
  if (!product) {
    return "";
  }

  if (typeof product.reason === "string" && product.reason.trim()) {
    return product.reason.trim();
  }

  const firstReason = Array.isArray(product.why_picked)
    ? product.why_picked.find((item) => typeof item === "string" && item.trim())
    : null;

  return firstReason?.trim() || "";
}

function normalizeCopy(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitSentences(text) {
  const normalized = normalizeCopy(text);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(/(?<=[.!?])\s+|(?<=다\.)\s+|(?<=요\.)\s+|(?<=니다\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueItems(items) {
  return Array.from(new Set(items.filter(Boolean)));
}

function getProductReasonSentences(product) {
  const fromReason = splitSentences(product?.reason);
  const fromPicked = Array.isArray(product?.why_picked)
    ? product.why_picked.flatMap((item) => splitSentences(item))
    : [];
  const caution = product?.caution_note ? splitSentences(product.caution_note) : [];

  return uniqueItems([...fromReason, ...fromPicked, ...caution]);
}

function getProductPreviewLines(product, count = 1) {
  const sentences = getProductReasonSentences(product);
  return sentences.slice(0, count);
}

function clampGauge(value) {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function mapTierToGauge(value, fallback = 3) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampGauge(value);
  }

  if (value === "high") return 5;
  if (value === "medium") return 3;
  if (value === "low") return 2;

  return fallback;
}

function buildFitMetrics(product, form, locale = "ko") {
  const copy = getResultCopy(locale);
  const concerns = Array.isArray(product?.concerns) ? product.concerns : [];
  const signals = product?.matched_signals || {};
  const hydrationBase = mapTierToGauge(product?.hydration_level, 3);
  const barrierBase = mapTierToGauge(product?.barrier_support, 3);
  const irritationRisk = signals.irritation_risk || product?.irritation_risk || "medium";
  const comedogenicRisk = product?.comedogenic_risk || "low";

  const hydration = clampGauge(
    hydrationBase +
      (form?.mainConcern === "dehydration" || form?.mainConcern === "barrier" ? 1 : 0) +
      (form?.postWashFeeling === "tight" ? 1 : 0)
  );

  const barrier = clampGauge(
    barrierBase +
      (form?.mainConcern === "barrier" || form?.mainConcern === "redness" ? 1 : 0) +
      (form?.sensitivity === "high" ? 1 : 0)
  );

  const troublePenalty = comedogenicRisk === "high" ? 2 : comedogenicRisk === "medium" ? 1 : 0;
  const trouble = clampGauge(
    (concerns.includes("acne") || concerns.includes("oiliness") || concerns.includes("pores") ? 4 : 2) +
      (form?.mainConcern === "acne" || form?.mainConcern === "oiliness" || form?.mainConcern === "pores" ? 1 : 0) -
      troublePenalty
  );

  const textureBase =
    signals.texture_match === "exact" ? 5 : signals.texture_match === "near" ? 4 : signals.texture_match === "opposite" ? 1 : 3;
  const texture = clampGauge(textureBase + (signals.finish_match ? 1 : 0) - (signals.disliked_feel_conflict ? 1 : 0));

  const sensitivity =
    form?.sensitivity === "high"
      ? irritationRisk === "low"
        ? 5
        : irritationRisk === "medium"
          ? 3
          : 1
      : form?.sensitivity === "medium"
        ? irritationRisk === "low"
          ? 4
          : irritationRisk === "medium"
            ? 3
            : 2
        : irritationRisk === "high"
          ? 2
          : 3;

  return [
    { label: copy.fitLabels[0], value: hydration },
    { label: copy.fitLabels[1], value: barrier },
    { label: copy.fitLabels[2], value: trouble },
    { label: copy.fitLabels[3], value: texture },
    { label: copy.fitLabels[4], value: clampGauge(sensitivity + (signals.sensitivity_safe ? 1 : 0)) },
  ];
}

function getDirectionSummary(form, locale = "ko") {
  const copy = getResultCopy(locale);
  if (form?.mainConcern === "barrier" || form?.mainConcern === "dehydration") {
    return copy.directionSummaryBarrier;
  }

  if (form?.mainConcern === "oiliness" || form?.mainConcern === "pores") {
    return copy.directionSummaryOil;
  }

  if (form?.mainConcern === "acne" || form?.mainConcern === "redness") {
    return copy.directionSummaryCalm;
  }

  return copy.directionSummaryDefault;
}

function getDirectionAction(form, locale = "ko") {
  const copy = getResultCopy(locale);
  if (form?.preferredTexture === "gel" || form?.mostDislikedFeel === "sticky") {
    return copy.directionActionLight;
  }

  if (form?.preferredTexture === "cream" || form?.postWashFeeling === "tight") {
    return copy.directionActionLayer;
  }

  if (form?.mainConcern === "acne" || form?.mainConcern === "redness") {
    return copy.directionActionCalm;
  }

  return copy.directionActionDefault;
}

function toRoutineAction(item, locale = "ko") {
  const copy = getResultCopy(locale);
  const text = normalizeCopy(item);

  if (!text) {
    return "";
  }

  if (text.includes("클렌저") || text.includes("세안")) {
    return copy.routineCleanser;
  }

  if (text.includes("토너") || text.includes("에센스")) {
    return copy.routineToner;
  }

  if (text.includes("세럼") || text.includes("앰플")) {
    return copy.routineSerum;
  }

  if (text.includes("선크림") || text.includes("자외선")) {
    return copy.routineSunscreen;
  }

  if (text.includes("보습") || text.includes("크림") || text.includes("로션")) {
    return copy.routineMoisturizer;
  }

  return text;
}

function getUsageTimingLabel(useTime, locale = "ko") {
  const copy = getResultCopy(locale);
  const value = Array.isArray(useTime) ? useTime[0] : useTime;
  return copy.useTime[value] || copy.useTime.both;
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

function getPurchaseLinkInfo(product, locale = "ko") {
  const copy = getResultCopy(locale);
  if (hasPurchaseLink(product?.buy_link)) {
    return {
      href: product.buy_link,
      label: copy.buyNow,
      isFallback: false
    };
  }

  const query = encodeURIComponent(`${product?.brand || ""} ${product?.name || ""} ${locale === "en" ? "buy" : "구매"}`);

  return {
    href: `https://search.shopping.naver.com/search/all?query=${query}`,
    label: copy.findStore,
    isFallback: true
  };
}

function getEspeciallyGoodFor(product, form, locale = "ko") {
  const copy = getResultCopy(locale);
  if (form?.afternoonSkinChange === "more_oily" || form?.mainConcern === "oiliness") {
    return copy.especiallyOil;
  }

  if (form?.postWashFeeling === "tight" || form?.mainConcern === "dehydration") {
    return copy.especiallyTight;
  }

  if (
    (form?.environmentExposure || []).includes("mask") ||
    form?.skinType === "sensitive" ||
    form?.mainConcern === "redness"
  ) {
    return copy.especiallyMask;
  }

  if (form?.mainConcern === "pores") {
    return copy.especiallyPores;
  }

  if (form?.mainConcern === "acne") {
    return copy.especiallyAcne;
  }

  if (product.use_time === "night") {
    return copy.especiallyNight;
  }

  if (product.use_time === "day") {
    return copy.especiallyDay;
  }

  return copy.especiallyDefault;
}

function getTopPickSignalLabels(product, locale = "ko") {
  const display = getDisplayMap(locale);
  const copy = getResultCopy(locale);
  const signals = product?.matched_signals;

  if (!signals || typeof signals !== "object") {
    return [];
  }

  const labels = [];

  if (Array.isArray(signals.matched_concerns) && signals.matched_concerns.length > 0) {
    const concernKey = signals.matched_concerns[0];
    labels.push(`${display.mainConcern[concernKey] || concernKey} ${copy.signalConcern}`);
  }

  if (signals.matched_skin_type) {
    labels.push(`${display.skinType[signals.matched_skin_type] || signals.matched_skin_type} ${copy.signalSkin}`);
  }

  if (signals.texture_match === "exact") {
    labels.push(copy.signalTextureExact);
  } else if (signals.texture_match === "near") {
    labels.push(copy.signalTextureNear);
  }

  if (signals.finish_match) {
    labels.push(copy.signalFinish);
  }

  if (signals.sensitivity_safe) {
    labels.push(copy.signalSensitive);
  } else if (signals.irritation_risk === "low") {
    labels.push(copy.signalLowIrritation);
  }

  return labels.slice(0, 2);
}

function getLocaleFromPathname(pathname) {
  return pathname?.startsWith("/en") ? "en" : "ko";
}

function getLocalePath(pathname, nextLocale) {
  if (!pathname) {
    return nextLocale === "en" ? "/en" : "/";
  }

  const normalized = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return nextLocale === "en" ? `/en${normalized === "/" ? "" : normalized}` : normalized;
}

function getImageFallbackLabel(product) {
  return product?.brand ? `${product.brand} ${product?.name || ""}`.trim() : product?.name || "Product";
}

function SmallProductThumb({ product, height = "h-28", locale = "ko" }) {
  const copy = getResultCopy(locale);
  return (
    <div className={`overflow-hidden rounded-[1.1rem] border border-black/8 bg-white/80 ${height}`}>
      {product?.image_url ? (
        <img
          src={product.image_url}
          alt={getImageFallbackLabel(product)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-[linear-gradient(135deg,#f7ede1_0%,#fff9f2_100%)] px-3 text-center">
          <div>
            <p className="text-[11px] font-semibold text-black/58">{product?.brand || "Product"}</p>
            <p className="mt-1 text-[10px] text-black/42">{copy.imageEmpty}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
          <LoadingSpinner label="Loading your result..." />
        </main>
      }
    >
      <ResultContent />
    </Suspense>
  );
}

function ResultContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = getResultCopy(locale);
  const display = getDisplayMap(locale);
  const feedbackQuestions = getFeedbackQuestions(locale);
  const [result, setResult] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [feedback, setFeedback] = useState({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});
  const profileSummaryItems = buildLocalizedSkinProfileSummary(submission?.form || {}, locale);

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
        <LoadingSpinner label={copy.loading} />
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
                  {copy.title}
                </h1>
                {result?.meta?.notice ? (
                  <p className="mt-3 inline-flex rounded-full bg-white/75 px-3 py-1 text-xs text-black/55">
                    {result.meta.notice}
                  </p>
                ) : null}
              </div>

              <Link
                href={getLocalePath(pathname, locale)}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white/80 px-5 py-3 text-sm font-medium text-black/75 transition hover:border-black/20 hover:bg-white"
              >
                {copy.tryAgain}
              </Link>
            </div>
            <div className="mt-4 flex gap-2">
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
                        ? "bg-[#1f1811] text-white"
                        : "border border-black/10 bg-white/80 text-black/60 hover:border-black/20"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {result ? (
            <div className="grid gap-3 border-t border-black/5 bg-white/70 px-6 py-5 text-sm text-black/60 sm:grid-cols-3 sm:px-8">
              <InsightStat
                label={locale === "en" ? "Skin Type" : "피부 타입"}
                value={display.skinType[submission?.form?.skinType] || (locale === "en" ? "Matched routine" : "맞춤 루틴")}
              />
              <InsightStat
                label={locale === "en" ? "Routine" : "루틴"}
                value={locale === "en" ? "Morning + Night · 3 steps" : "아침 + 저녁 · 3단계"}
              />
              <InsightStat
                label={locale === "en" ? "Top Concern" : "주요 고민"}
                value={display.mainConcern[submission?.form?.mainConcern] || copy.currentConcernBasis}
              />
            </div>
          ) : null}
        </header>

        {error ? (
          <div className="rounded-[2rem] border border-red-200 bg-[linear-gradient(180deg,#fff7f7_0%,#fff1f1_100%)] p-6 text-sm leading-6 text-red-600 shadow-soft">
            <p className="font-semibold text-red-700">{copy.noResultTitle}</p>
            <p className="mt-2">{error}</p>
          </div>
        ) : null}

        {!error && !result ? (
          <div className="rounded-[2rem] border border-black/5 bg-white/85 p-6 text-sm leading-6 text-black/65 shadow-soft">
            {copy.noResultBody}
          </div>
        ) : null}

        {result ? (
          <div className="grid gap-5 md:grid-cols-2">
            {profileSummaryItems.length ? (
              <div className="md:col-span-2 rounded-[1.7rem] border border-black/5 bg-[#fcf8f2] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40">{copy.skinProfile}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {profileSummaryItems.map((item) => (
                    <p key={item} className="rounded-2xl bg-white/85 px-4 py-3 text-sm leading-6 text-black/76">
                      ✔ {item}
                    </p>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-black/62">
                  {copy.profileBody}
                </p>
              </div>
            ) : null}

            <div className="md:col-span-2 rounded-[1.5rem] border border-black/5 bg-white/85 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/40">{copy.recommendationDirection}</p>
              <div className="mt-3 space-y-2">
                <p className="text-sm leading-6 text-black/74">{getDirectionSummary(submission?.form, locale)}</p>
                <p className="text-sm leading-6 text-black/68">{getDirectionAction(submission?.form, locale)}</p>
              </div>
            </div>

            <div className="md:col-span-2">
              <ResultSection title={copy.productStartHere}>
                {result.topPick ? (
                  <ProductDecisionCard
                    product={result.topPick}
                    featured
                    form={submission?.form}
                    locale={locale}
                  />
                ) : null}
              </ResultSection>
            </div>

            <div className="md:col-span-2">
              <ResultSection title={copy.categoryPicks}>
                <CategoryCarousel products={result.categoryPicks || []} form={submission?.form} locale={locale} />
              </ResultSection>
            </div>

            <div className="md:col-span-2">
              <ResultSection
                title={copy.dailyRoutine}
                subtitle={copy.routineSubtitle}
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl bg-[#faf6f0] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/38">
                      {locale === "en" ? "Morning" : "아침"}
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {(result.morning || []).map((item, index) => (
                        <li key={`morning-${index}`} className="rounded-2xl bg-white/85 px-4 py-3 text-sm leading-6 text-black/78">
                          {toRoutineAction(item, locale)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl bg-[#faf6f0] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/38">
                      {locale === "en" ? "Night" : "저녁"}
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {(result.night || []).map((item, index) => (
                        <li key={`night-${index}`} className="rounded-2xl bg-white/85 px-4 py-3 text-sm leading-6 text-black/78">
                          {toRoutineAction(item, locale)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </ResultSection>
            </div>

            <div className="md:col-span-2">
              <ResultSection
                title={copy.notes}
                subtitle={copy.notesSubtitle}
              >
                <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
                  <div className="rounded-2xl bg-[#fffaf4] p-3.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/38">
                      {copy.cautions}
                    </p>
                    <ul className="mt-2.5 space-y-2">
                      {(result.avoid || []).map((item, index) => (
                        <li key={`avoid-${index}`} className="rounded-2xl bg-white/90 px-4 py-2.5 text-sm leading-6 text-black/78">
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {result.funInsight ? (
                    <div className="rounded-2xl bg-[linear-gradient(135deg,#f6efe7_0%,#fff9f2_100%)] p-3.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-black/38">
                        {copy.skinNote}
                      </p>
                      <p className="mt-2.5 rounded-2xl bg-white/80 px-4 py-3 text-sm leading-6 text-black/72">
                        {result.funInsight.description}
                      </p>
                    </div>
                  ) : null}
                </div>
              </ResultSection>
            </div>

            <div className="md:col-span-2">
              <ResultSection
                title={copy.quickFeedback}
                subtitle={copy.feedbackSubtitle}
              >
                <div className="grid gap-2">
                  {feedbackQuestions.map((question) => (
                    <div
                      key={question.id}
                      className="rounded-2xl border border-black/5 bg-white/85 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-ink">{question.text}</p>
                      {feedbackSubmitted[question.id] ? (
                        <p className="text-xs font-medium text-[#7d5724]">
                          {copy.feedbackSaved}
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          {(locale === "en" ? ["Yes", "No"] : ["예", "아니오"]).map((option) => {
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
                    </div>
                  ))}
                </div>
              </ResultSection>
            </div>

            <div className="md:col-span-2 flex justify-center">
              <Link
                href={getLocalePath(pathname, locale)}
                className="inline-flex items-center justify-center rounded-full border border-black/10 bg-white px-5 py-3 text-sm font-medium text-black/72 transition hover:border-black/20 hover:bg-black/5"
              >
                {copy.tryAgain}
              </Link>
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

function FitGaugeRows({ product, form, compact = false, locale = "ko" }) {
  const copy = getResultCopy(locale);
  const displayMetrics = buildFitMetrics(product, form, locale);

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <p className={`font-semibold uppercase tracking-[0.14em] text-black/38 ${compact ? "text-[10px]" : "text-xs"}`}>
        {compact ? copy.fitHeadingCompact : copy.fitHeading}
      </p>
      {displayMetrics.map((metric) => (
        <div
          key={`${product.id}-${metric.label}`}
          className={`grid items-center ${compact ? "grid-cols-[48px_1fr] gap-2.5" : "grid-cols-[86px_1fr] gap-3"}`}
        >
          <span className={`${compact ? "text-[10px]" : "text-xs"} text-black/52`}>{metric.label}</span>
          <div className={`flex ${compact ? "gap-1" : "gap-1.5"}`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={`${metric.label}-${index}`}
                className={`h-2 flex-1 rounded-full ${
                  index < metric.value ? "bg-[#7d5724]" : "bg-black/8"
                }`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CategoryCarousel({ products, form, locale = "ko" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const copy = getResultCopy(locale);

  if (!products.length) {
    return null;
  }

  const activeProduct = products[activeIndex];

  const moveTo = (nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(products.length - 1, nextIndex));
    setActiveIndex(boundedIndex);
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden">
        <ProductDecisionCard product={activeProduct} form={form} locale={locale} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-black/42">
          {activeIndex + 1} / {products.length}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => moveTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copy.previous}
          </button>
          <button
            type="button"
            onClick={() => moveTo(activeIndex + 1)}
            disabled={activeIndex === products.length - 1}
            className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copy.next}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDecisionCard({ product, featured = false, form = null, locale = "ko" }) {
  const [expanded, setExpanded] = useState(false);
  const copy = getResultCopy(locale);

  if (featured) {
    const topPickHeadline = getTopPickHeadline(form, locale);
    const topPickSummary = getTopPickSummary(product, form, locale);
    const especiallyGoodFor = getEspeciallyGoodFor(product, form, locale);
    const purchaseLink = getPurchaseLinkInfo(product, locale);
    const topPickSignals = [product.step, ...getTopPickSignalLabels(product, locale)].slice(0, 5);
    const previewLines = getProductPreviewLines(product, 2);
    const detailLines = getProductReasonSentences(product);

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
              brand: product.brand
            }
          })
        }
      >
        <div className="grid gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[1.28fr_0.72fr] lg:items-start">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-full border border-[#1f1811]/10 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-black/65">
                {copy.topPickBadge}
              </span>
            </div>

            <p className="mt-5 text-sm font-semibold leading-6 text-[#7d5724] sm:text-[15px]">{topPickHeadline}</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-ink sm:text-[2.4rem]">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-black/45 sm:text-[15px]">{product.brand}</p>

            {topPickSignals.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {topPickSignals.map((label) => (
                  <span
                    key={`${product.id}-${label}`}
                    className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/60"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-6 text-black/70">
              <span className="font-semibold text-black/78">{copy.especiallyGoodFor}</span> {especiallyGoodFor}
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-black/80">{topPickSummary}</p>
            <div className="mt-3 space-y-1.5">
              {previewLines.map((line) => (
                <p key={`${product.id}-${line}`} className="text-sm leading-6 text-black/68">
                  {line}
                </p>
              ))}
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => !current);
              }}
              className="mt-4 text-sm font-medium text-[#7d5724] underline decoration-black/15 underline-offset-4"
            >
              {expanded ? copy.less : copy.more}
            </button>

            {expanded ? (
              <div className="mt-4 space-y-4 rounded-[1.4rem] border border-black/8 bg-white/72 p-4">
                {detailLines.length ? (
                  <div className="space-y-2">
                    {detailLines.map((line) => (
                      <p key={`${product.id}-detail-${line}`} className="text-sm leading-6 text-black/72">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="overflow-hidden rounded-[1.6rem] border border-[#cfb48d]/50 bg-white/88">
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={getImageFallbackLabel(product)}
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="flex h-56 items-center justify-center bg-[linear-gradient(135deg,#f7ede1_0%,#fff9f2_100%)] px-6 text-center">
                  <div>
                    <p className="text-sm font-semibold text-black/65">{getImageFallbackLabel(product)}</p>
                    <p className="mt-2 text-xs text-black/45">{copy.imagePreparing}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[1.35rem] border border-[#cfb48d]/50 bg-white/88 p-3.5">
              <FitGaugeRows product={product} form={form} compact locale={locale} />
            </div>

            <div className="rounded-[1.6rem] border border-[#cfb48d]/50 bg-white/88 p-4 sm:p-5">
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
                className="inline-flex w-full items-center justify-center rounded-full bg-[#1f1811] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black"
              >
                {purchaseLink.label}
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const purchaseLink = getPurchaseLinkInfo(product, locale);
  const cardTags = [product.step, ...getTopPickSignalLabels(product, locale).slice(0, 1)].filter(Boolean);
  const previewLine = getProductPreviewLines(product, 1)[0] || getEspeciallyGoodFor(product, form, locale);
  const especiallyGoodFor = getEspeciallyGoodFor(product, form, locale);
  const detailLines = getProductReasonSentences(product);

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
            brand: product.brand
          }
        })
      }
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_156px] sm:items-start">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/35">{product.step}</p>
          <p className="mt-2 text-base font-semibold text-ink">{product.name}</p>
          <p className="mt-1 text-xs text-black/45">{product.brand}</p>

          {cardTags.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {cardTags.map((label) => (
                <span
                  key={`${product.id}-${label}`}
                  className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[11px] font-medium text-black/58"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <p className="mt-4 text-sm leading-6 text-black/70">{previewLine}</p>
          <p className="mt-2 text-xs leading-5 text-black/52">
            {locale === "en" ? `Best for ${especiallyGoodFor}` : `특히 ${especiallyGoodFor}`}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => !current);
              }}
              className="text-xs font-medium text-[#7d5724] underline decoration-black/15 underline-offset-4"
            >
              {expanded ? copy.less : copy.more}
            </button>
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

          {expanded ? (
            <div className="mt-4 rounded-[1.2rem] bg-white/85 p-4">
              <div className="space-y-2">
                {detailLines.map((line) => (
                  <p key={`${product.id}-detail-${line}`} className="text-sm leading-6 text-black/68">
                    {line}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className="space-y-3 sm:w-[156px]">
          <SmallProductThumb product={product} height="h-32" locale={locale} />
          <div className="rounded-[1.1rem] border border-black/6 bg-white/80 p-3">
            <FitGaugeRows product={product} form={form} compact locale={locale} />
          </div>
        </div>
      </div>
    </div>
  );
}

