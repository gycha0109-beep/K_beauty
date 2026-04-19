"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import RecommendedProductsStep from "@/components/result/RecommendedProductsStep";
import ResultBottomCTA from "@/components/result/ResultBottomCTA";
import ResultOverviewStep from "@/components/result/ResultOverviewStep";
import ResultProgressDots from "@/components/result/ResultProgressDots";
import ResultShareActions from "@/components/result/ResultShareActions";
import RoutineGuideStep from "@/components/result/RoutineGuideStep";
import TipsStep from "@/components/result/TipsStep";
import TopPickStep from "@/components/result/TopPickStep";
import { readWriteAccessToken } from "@/lib/write-access-client";
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
    { id: "overall_satisfaction", text: "결과가 전반적으로 만족스러우셨나요?" },
    { id: "easy_to_understand", text: "추천 구성이 이해하기 쉬웠나요?" },
    { id: "reuse_intent", text: "이 서비스를 다시 사용할 의향이 있으신가요?" }
  ],
  en: [
    { id: "overall_satisfaction", text: "Were you satisfied with the overall result?" },
    { id: "easy_to_understand", text: "Was the recommendation easy to understand?" },
    { id: "reuse_intent", text: "Would you use this service again?" }
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
    buyNow: "판매처 보기",
    findStore: "구매처 찾기",
    priceBand: "가격대",
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
    notesSubtitle: "사용 전에 가볍게 확인하면 좋은 포인트만 모았습니다.",
    routineSubtitle: "아침과 저녁 루틴을 한 번에 짧게 정리했습니다.",
    feedbackSubtitle: "한두 번만 눌러 주셔도 다음 추천 개선에 바로 도움이 됩니다.",
    resultProgressLabel: "RESULT STEP",
    resultOverviewKicker: "RESULT STEP 1",
    resultOverviewTitle: "진단 결과",
    resultOverviewBody: "먼저 내 피부 결과를 한눈에 볼 수 있게 짧게 정리했습니다.",
    resultPhotoFallback: "업로드한 사진",
    topPickStepKicker: "RESULT STEP 2",
    topPickStepTitle: "당신을 위한 Top Pick",
    topPickStepBody: "지금 가장 먼저 바꾸면 체감 차이가 큰 제품입니다.",
    recommendedStepKicker: "RESULT STEP 3",
    recommendedStepTitle: "함께 쓰면 좋은 추천",
    recommendedStepBody: "가볍게 넘겨보면서 루틴에 붙일 만한 제품만 빠르게 확인하세요.",
    recommendedStepEmpty: "함께 추천할 제품이 아직 없습니다.",
    routineStepKicker: "RESULT STEP 4",
    routineStepTitle: "추천 루틴 가이드",
    routineStepEmpty: "표시할 루틴 정보가 없습니다.",
    tipsStepKicker: "RESULT STEP 5",
    tipsStepTitle: "사용 전에 가볍게 확인하세요",
    tipsStepEmpty: "추가로 확인할 팁이 없습니다.",
    feedbackThanksTitle: "피드백 감사합니다",
    feedbackThanksBody: "다음 추천 개선에 반영하겠습니다.",
    ctaViewTopPick: "Top Pick 보기",
    ctaViewRecommended: "함께 쓰면 좋은 제품 보기",
    ctaViewRoutine: "추천 루틴 보기",
    ctaViewTips: "주의사항 및 사용 팁 보기",
    ctaLeaveFeedback: "피드백 남기기",
    backHome: "처음으로 돌아가기",
    topPickEmpty: "가장 먼저 시작할 제품 정보를 불러오지 못했습니다."
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
    buyNow: "View Store",
    findStore: "Find Retailers",
    priceBand: "Price band",
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
    feedbackSubtitle: "A quick tap helps improve the next recommendation.",
    resultProgressLabel: "RESULT STEP",
    resultOverviewKicker: "RESULT STEP 1",
    resultOverviewTitle: "Your Result",
    resultOverviewBody: "Start with a short summary of how this result connects to your skin.",
    resultPhotoFallback: "Uploaded photo",
    topPickStepKicker: "RESULT STEP 2",
    topPickStepTitle: "Your Top Pick",
    topPickStepBody: "This is the product most likely to create the clearest first difference.",
    recommendedStepKicker: "RESULT STEP 3",
    recommendedStepTitle: "Also Worth Using",
    recommendedStepBody: "Swipe through the lighter supporting picks for the rest of your routine.",
    recommendedStepEmpty: "There are no extra recommendations yet.",
    routineStepKicker: "RESULT STEP 4",
    routineStepTitle: "Routine Guide",
    routineStepEmpty: "There is no routine information to show yet.",
    tipsStepKicker: "RESULT STEP 5",
    tipsStepTitle: "Check These Before You Start",
    tipsStepEmpty: "There are no extra tips to show yet.",
    feedbackThanksTitle: "Thanks for your feedback",
    feedbackThanksBody: "We will use it to improve the next recommendation.",
    ctaViewTopPick: "See Top Pick",
    ctaViewRecommended: "See Supporting Picks",
    ctaViewRoutine: "See Routine Guide",
    ctaViewTips: "See Tips",
    ctaLeaveFeedback: "Leave Feedback",
    backHome: "Back to Home",
    topPickEmpty: "Could not load the Top Pick product."
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
  const writeAccessToken = readWriteAccessToken();

  if (!writeAccessToken) {
    return;
  }

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
      "Content-Type": "application/json",
      "x-kbeauty-write-token": writeAccessToken
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

function getConcernDisplay(form = {}, locale = "ko") {
  const display = getDisplayMap(locale);
  const copy = getResultCopy(locale);
  const concernKeys = Array.isArray(form.mainConcerns) && form.mainConcerns.length
    ? form.mainConcerns
    : form.mainConcern
      ? [form.mainConcern]
      : [];
  const labels = concernKeys
    .map((item) => display.mainConcern[item])
    .filter(Boolean);

  return labels.length ? labels.slice(0, 3).join(" · ") : copy.currentConcernBasis;
}

function getRoutineStructureLabel(result, locale = "ko") {
  const morningCount = Array.isArray(result?.morning) ? result.morning.filter(Boolean).length : 0;
  const nightCount = Array.isArray(result?.night) ? result.night.filter(Boolean).length : 0;
  const stepCount = Math.max(morningCount, nightCount, 0);

  if (locale === "en") {
    return stepCount > 0 ? `Morning + Night · ${stepCount} ${stepCount === 1 ? "step" : "steps"}` : "Morning + Night";
  }

  return stepCount > 0 ? `아침 + 저녁 · ${stepCount}단계` : "아침 + 저녁";
}

function getOverviewSummary(form = {}, locale = "ko") {
  const display = getDisplayMap(locale);
  const concernLabel = getConcernDisplay(form, locale);
  const skinTypeLabel = display.skinType[form?.skinType] || (locale === "en" ? "Skin" : "피부");
  const directionSummary = getDirectionSummary(form, locale);

  if (locale === "en") {
    return `${skinTypeLabel} with ${concernLabel.toLowerCase()}, so ${directionSummary.charAt(0).toLowerCase()}${directionSummary.slice(1)}`;
  }

  return `${skinTypeLabel} 피부이고 ${concernLabel} 고민이 있어, ${directionSummary}`;
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

function getDisplayPriceRange(priceRange) {
  if (!priceRange) {
    return null;
  }

  if (priceRange === "$") {
    return "₩";
  }

  if (priceRange === "$$") {
    return "₩₩";
  }

  if (priceRange === "$$$") {
    return "₩₩₩";
  }

  return cleanText(priceRange);
}

function getPriceLabel(priceRange, locale = "ko") {
  const copy = getResultCopy(locale);
  const displayRange = getDisplayPriceRange(priceRange);

  if (!displayRange) {
    return null;
  }

  return `${copy.priceBand} ${displayRange}`;
}

function isExactOliveYoungProductLink(buyLink) {
  if (!buyLink || typeof buyLink !== "string" || !buyLink.startsWith("http")) {
    return false;
  }

  if (buyLink.includes("example.com")) {
    return false;
  }

  return /oliveyoung\.co\.kr\/.*getGoodsDetail/i.test(buyLink);
}

function getPurchaseLinkInfo(product, locale = "ko") {
  const copy = getResultCopy(locale);
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

function getHomePath(locale = "ko") {
  return locale === "en" ? "/en" : "/";
}

function getImageFallbackLabel(product) {
  return product?.brand ? `${product.brand} ${product?.name || ""}`.trim() : product?.name || "Product";
}

function SmallProductThumb({ product, height = "h-28", locale = "ko" }) {
  const copy = getResultCopy(locale);
  return (
    <div className={`ui-image-surface overflow-hidden rounded-[1.1rem] ${height}`}>
      {product?.image_url ? (
        <div className="flex h-full w-full items-center justify-center p-2">
          <img
            src={product.image_url}
            alt={getImageFallbackLabel(product)}
            className="h-full w-full object-contain"
          />
        </div>
      ) : (
        <div className="ui-image-empty flex h-full items-center justify-center px-3 text-center">
          <div className="flex flex-col items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-[0.9rem] border border-zinc-200 bg-white/72 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500">
              <svg viewBox="0 0 48 48" className="h-5 w-5" fill="none" aria-hidden="true">
                <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
              </svg>
            </div>
            <p className="mt-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">{product?.brand || "Product"}</p>
            <p className="mt-0.5 text-[9px] text-zinc-500 dark:text-zinc-500">{copy.imagePreparing}</p>
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
  const [currentResultStep, setCurrentResultStep] = useState(0);
  const [currentFeedbackIndex, setCurrentFeedbackIndex] = useState(0);
  const [feedback, setFeedback] = useState({});
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});
  const [feedbackComplete, setFeedbackComplete] = useState(false);
  const profileSummaryItems = buildLocalizedSkinProfileSummary(submission?.form || {}, locale);
  const error = searchParams.get("error");
  const totalResultSteps = 5;
  const homePath = getHomePath(locale);
  const localizedPath = getLocalePath(pathname, locale);
  const yesLabel = locale === "en" ? "Yes" : "예";
  const noLabel = locale === "en" ? "No" : "아니오";

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

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, [currentResultStep]);

  function handleFeedback(answer) {
    const currentQuestion = feedbackQuestions[currentFeedbackIndex];

    if (!currentQuestion || feedbackSubmitted[currentQuestion.id]) {
      return;
    }

    setFeedback((current) => ({
      ...current,
      [currentQuestion.id]: answer
    }));
    setFeedbackSubmitted((current) => ({
      ...current,
      [currentQuestion.id]: true
    }));

    trackEvent("feedback_response", {
      product_id: result?.topPick?.id || null,
      feature_name: "feedback",
      result_type: "result_feedback",
      is_top_pick: false,
      question_id: currentQuestion.id,
      answer,
      meta_json: {
        question_text: currentQuestion.text
      }
    });

    if (currentFeedbackIndex === feedbackQuestions.length - 1) {
      setFeedbackComplete(true);
      return;
    }

    setCurrentFeedbackIndex((current) => current + 1);
  }

  if (!isReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <LoadingSpinner label={copy.loading} />
      </main>
    );
  }

  const photoUrl = submission?.imagePreviewDataUrl || submission?.imagePreview || "";
  const overviewCards = [
    {
      label: locale === "en" ? "Skin Type" : "피부 타입",
      value: display.skinType[submission?.form?.skinType] || (locale === "en" ? "Matched routine" : "맞춤 루틴")
    },
    {
      label: locale === "en" ? "Main Concern" : "주요 고민",
      value: getConcernDisplay(submission?.form || {}, locale)
    },
    {
      label: locale === "en" ? "Routine Structure" : "추천 루틴 구조",
      value: getRoutineStructureLabel(result, locale)
    }
  ];
  const stepCtaLabels = [
    copy.ctaViewTopPick,
    copy.ctaViewRecommended,
    copy.ctaViewRoutine,
    copy.ctaViewTips,
    null
  ];
  const resultSteps = result
    ? [
        <ResultOverviewStep
          key="overview"
          copy={copy}
          photoUrl={photoUrl}
          photoAlt={submission?.imageName || copy.resultPhotoFallback}
          summaryCards={overviewCards}
          overviewSummary={getOverviewSummary(submission?.form, locale)}
        />,
        <TopPickStep
          key="top-pick"
          copy={copy}
          card={
            result.topPick ? (
              <ProductDecisionCard
                product={result.topPick}
                featured
                form={submission?.form}
                locale={locale}
                detailItems={profileSummaryItems}
              />
            ) : (
              <div className="ui-card p-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {copy.topPickEmpty}
              </div>
            )
          }
        />,
        <RecommendedProductsStep
          key="recommended"
          copy={copy}
          products={result.categoryPicks || []}
          renderProduct={(product) => (
            <ProductDecisionCard
              product={product}
              form={submission?.form}
              locale={locale}
            />
          )}
        />,
        <RoutineGuideStep
          key="routine"
          copy={copy}
          locale={locale}
          morning={result.morning || []}
          night={result.night || []}
          toRoutineAction={toRoutineAction}
        />,
        <TipsStep
          key="tips"
          copy={copy}
          cautions={result.avoid || []}
          insightDescription={result.funInsight?.description || ""}
          feedbackQuestions={feedbackQuestions}
          currentFeedbackIndex={currentFeedbackIndex}
          feedback={feedback}
          feedbackComplete={feedbackComplete}
          yesLabel={yesLabel}
          noLabel={noLabel}
          onAnswer={handleFeedback}
        />
      ]
    : [];
  const activeResultStep = resultSteps[currentResultStep] || null;
  const showBottomCta = Boolean(result) && currentResultStep < totalResultSteps - 1;

  return (
    <main className="ui-page ui-page-shell min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-36 pt-4 sm:px-6 sm:pt-6">
        <div className="space-y-4">
          <header className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-kicker">
                  K-Beauty Result
                </p>
                <h1 className="ui-title mt-2 text-xl sm:text-2xl">
                  {copy.title}
                </h1>
                {result?.meta?.notice ? (
                  <p className="mt-3 inline-flex rounded-full bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    {result.meta.notice}
                  </p>
                ) : null}
              </div>

              <Link
                href={homePath}
                className="ui-button-secondary shrink-0 bg-white/88 px-4 py-2.5 text-xs font-medium dark:bg-zinc-900/88"
              >
                {copy.tryAgain}
              </Link>
            </div>

            <div className="flex flex-wrap gap-2">
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

            {result && submission ? (
              <ResultShareActions
                result={result}
                submission={submission}
                locale={locale}
              />
            ) : null}

            {result ? (
              <ResultProgressDots
                currentStep={currentResultStep + 1}
                totalSteps={totalResultSteps}
                label={copy.resultProgressLabel}
              />
            ) : null}
          </header>

          {error ? (
            <div className="ui-error">
              <p className="font-semibold">{copy.noResultTitle}</p>
              <p className="mt-2">{error}</p>
            </div>
          ) : null}

          {!error && !result ? (
            <div className="ui-card p-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {copy.noResultBody}
            </div>
          ) : null}

          {result ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${localizedPath}-${currentResultStep}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="flex-1"
              >
                {activeResultStep}
              </motion.div>
            </AnimatePresence>
          ) : null}
        </div>
      </div>

      {showBottomCta ? (
        <ResultBottomCTA
          label={stepCtaLabels[currentResultStep]}
          onClick={() => setCurrentResultStep((current) => Math.min(totalResultSteps - 1, current + 1))}
          previousLabel={currentResultStep > 0 ? copy.previous : null}
          onPrevious={
            currentResultStep > 0
              ? () => setCurrentResultStep((current) => Math.max(0, current - 1))
              : null
          }
        />
      ) : null}
    </main>
  );
}

function InsightStat({ label, value }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 font-medium text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function FitGaugeRows({ product, form, compact = false, locale = "ko" }) {
  const copy = getResultCopy(locale);
  const displayMetrics = buildFitMetrics(product, form, locale);

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      <p className={`font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400 ${compact ? "text-[10px]" : "text-xs"}`}>
        {compact ? copy.fitHeadingCompact : copy.fitHeading}
      </p>
      {displayMetrics.map((metric) => (
        <div
          key={`${product.id}-${metric.label}`}
          className={`grid items-center ${compact ? "grid-cols-[48px_1fr] gap-2.5" : "grid-cols-[86px_1fr] gap-3"}`}
        >
          <span className={`${compact ? "text-[10px]" : "text-xs"} text-zinc-500 dark:text-zinc-400`}>{metric.label}</span>
          <div className={`flex ${compact ? "gap-1" : "gap-1.5"}`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <span
                key={`${metric.label}-${index}`}
                className={`h-2 flex-1 rounded-full ${
                  index < metric.value ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-800"
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
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {activeIndex + 1} / {products.length}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => moveTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="ui-button-secondary px-3 py-1.5 text-xs font-medium"
          >
            {copy.previous}
          </button>
          <button
            type="button"
            onClick={() => moveTo(activeIndex + 1)}
            disabled={activeIndex === products.length - 1}
            className="ui-button-secondary px-3 py-1.5 text-xs font-medium"
          >
            {copy.next}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductDecisionCard({ product, featured = false, form = null, locale = "ko", detailItems = [] }) {
  const [expanded, setExpanded] = useState(false);
  const copy = getResultCopy(locale);

  if (featured) {
    const topPickHeadline = getTopPickHeadline(form, locale);
    const topPickSummary = getTopPickSummary(product, form, locale);
    const especiallyGoodFor = getEspeciallyGoodFor(product, form, locale);
    const purchaseLink = getPurchaseLinkInfo(product, locale);
    const priceLabel = getPriceLabel(product.price_range, locale);
    const topPickSignals = [product.step, ...getTopPickSignalLabels(product, locale)].slice(0, 5);
    const detailLines = getProductReasonSentences(product);

    return (
      <div
        className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-[linear-gradient(135deg,#fafafa_0%,#ffffff_56%,#ffffff_100%)] shadow-[0_24px_64px_rgba(24,24,27,0.08)] dark:border-zinc-800 dark:bg-[linear-gradient(135deg,#18181b_0%,#111114_56%,#09090b_100%)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.28)]"
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
                <span className="ui-chip px-3 py-1.5 text-[11px] font-semibold">
                  {copy.topPickBadge}
                </span>
              </div>

            <p className="mt-5 text-sm font-semibold leading-6 text-zinc-600 dark:text-zinc-300 sm:text-[15px]">{topPickHeadline}</p>
            <h2 className="mt-3 text-[2rem] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-[2.4rem]">
              {product.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 sm:text-[15px]">{product.brand}</p>
            {priceLabel ? (
              <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-[13px]">{priceLabel}</p>
            ) : null}

            {topPickSignals.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {topPickSignals.map((label) => (
                  <span
                    key={`${product.id}-${label}`}
                    className="ui-chip-compact"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{copy.especiallyGoodFor}</span> {especiallyGoodFor}
            </p>
            <p className="mt-4 max-w-2xl text-[15px] leading-7 text-zinc-700 dark:text-zinc-300">{topPickSummary}</p>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded((current) => !current);
              }}
              className="mt-4 text-sm font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 dark:text-zinc-300 dark:decoration-zinc-600"
            >
              {expanded ? copy.less : copy.more}
            </button>

            {expanded ? (
              <div className="mt-4 space-y-4 rounded-[1.4rem] border border-zinc-200 bg-white/72 p-4 dark:border-zinc-700 dark:bg-zinc-900/84">
                {detailItems.length ? (
                  <div className="flex flex-wrap gap-2">
                    {detailItems.map((item) => (
                      <span
                        key={`${product.id}-detail-item-${item}`}
                        className="ui-chip-compact px-3 py-1.5"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                {detailLines.length ? (
                  <div className="space-y-2">
                    {detailLines.map((line) => (
                      <p key={`${product.id}-detail-${line}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="ui-image-surface overflow-hidden rounded-[1.6rem]">
              {product.image_url ? (
                <div className="flex h-48 items-center justify-center px-4 py-3">
                  <img
                    src={product.image_url}
                    alt={getImageFallbackLabel(product)}
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div className="ui-image-empty flex h-48 items-center justify-center px-6 text-center">
                  <div className="flex flex-col items-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] border border-zinc-200 bg-white/72 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500">
                      <svg viewBox="0 0 48 48" className="h-7 w-7" fill="none" aria-hidden="true">
                        <path d="M14 17.5h20M14 24h20M18 30.5h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        <rect x="11" y="9" width="26" height="30" rx="6" stroke="currentColor" strokeWidth="2.2" />
                      </svg>
                    </div>
                    <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">{getImageFallbackLabel(product)}</p>
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-500">{copy.imagePreparing}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="ui-card-subtle p-3.5">
              <FitGaugeRows product={product} form={form} compact locale={locale} />
            </div>

            <div className="ui-card-subtle p-4 sm:p-5">
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
                className="ui-button-primary w-full px-4 py-2.5 text-sm font-semibold"
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
  const priceLabel = getPriceLabel(product.price_range, locale);
  const cardTags = [product.step, ...getTopPickSignalLabels(product, locale).slice(0, 1)].filter(Boolean).slice(0, 2);
  const previewLine = getProductPreviewLines(product, 1)[0] || getEspeciallyGoodFor(product, form, locale);
  const detailLines = getProductReasonSentences(product);

  return (
    <div
      className="ui-card-muted rounded-[1.45rem] p-4"
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
      <div className="grid min-h-[236px] gap-3 sm:grid-cols-[minmax(0,1fr)_112px] sm:items-stretch">
        <div className="flex min-h-full flex-col">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{product.step}</p>
          <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{product.name}</p>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{product.brand}</p>
          {priceLabel ? <p className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{priceLabel}</p> : null}

          {cardTags.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {cardTags.map((label) => (
                <span
                  key={`${product.id}-${label}`}
                  className="ui-chip-compact"
                >
                  {label}
                </span>
              ))}
            </div>
          ) : null}

          <p
            className="mt-3 min-h-12 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
            style={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden"
            }}
          >
            {previewLine}
          </p>

          <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setExpanded(true);
              }}
              className="ui-button-secondary px-3.5 py-1.5 text-xs font-medium"
            >
              {locale === "en" ? "Details" : "상세보기"}
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
                className="ui-button-secondary px-3.5 py-1.5 text-xs font-medium"
            >
              {purchaseLink.label}
            </a>
          </div>

        </div>
        <div className="flex items-center sm:w-[112px]">
          <SmallProductThumb product={product} height="h-24" locale={locale} />
        </div>
      </div>

      {expanded ? (
        <div
          className="ui-overlay fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          onClick={(event) => {
            event.stopPropagation();
            setExpanded(false);
          }}
        >
          <div
            className="relative w-full max-w-md rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-[0_28px_80px_rgba(24,24,27,0.18)] dark:border-zinc-800 dark:bg-zinc-900"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="ui-button-secondary absolute right-4 top-4 h-9 w-9 text-sm"
              aria-label={locale === "en" ? "Close details" : "상세 닫기"}
            >
              ×
            </button>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_132px] sm:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{product.step}</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">{product.name}</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{product.brand}</p>
                {priceLabel ? <p className="mt-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{priceLabel}</p> : null}

                {cardTags.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {cardTags.map((label) => (
                      <span
                        key={`${product.id}-modal-${label}`}
                        className="ui-chip-compact"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 space-y-2.5">
                  {detailLines.map((line) => (
                    <p key={`${product.id}-detail-${line}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {line}
                    </p>
                  ))}
                </div>

                <div className="mt-5">
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
                          fallback_link: purchaseLink.isFallback,
                          source: "category_pick_modal"
                        }
                      });
                    }}
                    className="ui-button-secondary px-4 py-2 text-sm font-medium"
                  >
                    {purchaseLink.label}
                  </a>
                </div>
              </div>

              <div className="space-y-3 sm:w-[132px]">
                <SmallProductThumb product={product} height="h-28" locale={locale} />
                <div className="ui-card-subtle rounded-[1.1rem] p-3">
                  <FitGaugeRows product={product} form={form} compact locale={locale} />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

