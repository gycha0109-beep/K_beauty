"use client";

import Link from "next/link";
import { Fragment, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ErrorState from "@/components/common/ErrorState";
import LoadingSpinner from "@/components/LoadingSpinner";
import ResultBottomCTA from "@/components/result/ResultBottomCTA";
import ResultProgressDots from "@/components/result/ResultProgressDots";
import ResultShareActions from "@/components/result/ResultShareActions";
import SaveReportCTA from "@/components/result/SaveReportCTA";
import {
  FreeResultV2Card,
  FreeResultV2EvidenceSourceIcon,
  FreeResultV2ExecutionGuideIcon,
  FreeResultV2LockIcon,
  FreeResultV2ManagementIcon,
  FreeResultV2Pill,
  FreeResultV2PriorityIcon,
  FreeResultV2RoleIcon,
  FreeResultV2RoutineIcon,
  FreeResultV2RoutineModeIcon,
  FreeResultV2StepFrame
} from "@/components/result/free-v2/FreeResultV2Primitives";
import AuthNav from "@/components/auth/AuthNav";
import AppHamburgerMenu from "@/components/navigation/AppHamburgerMenu";
import {
  buildFaceLabLaunchData,
  formatFaceLabDisplayList,
  formatFaceLabDisplayText
} from "@/lib/face-lab-launch";
import { getRoutineStructureData } from "@/lib/routine-structure";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
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
      barrier: "장벽 약화",
      uv: "자외선"
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
      barrier: "Barrier",
      uv: "UV"
    }
  }
};

const topPickHeadlineMap = {
  ko: {
    uv: "자외선 부담이 커서 가장 먼저 지켜야 할 1순위",
    oiliness: "유분과 모공 흐름에서 가장 먼저 체감 차이가 나는 1순위",
    pores: "모공과 번들거림 기준으로 먼저 바꿔야 할 1순위",
    dehydration: "지금 피부 건조감에서 가장 먼저 보완할 1순위",
    acne: "트러블 부담을 줄이기 위해 먼저 바꿔야 할 1순위",
    uneven_tone: "톤 컨디션을 정리할 때 가장 먼저 손댈 1순위",
    redness: "예민하게 올라오는 피부에서 가장 먼저 바꿔야 할 1순위",
    barrier: "장벽이 흔들리는 지금 가장 먼저 써야 할 1순위"
  },
  en: {
    uv: "The first product to lock in when UV pressure is carrying the daytime result",
    oiliness: "The first product to switch for oil flow and pore control",
    pores: "The first product to check for pores and midday shine",
    dehydration: "The first product to add for current dehydration",
    acne: "The first product to reach for when breakouts keep returning",
    uneven_tone: "The first product to check when tone looks uneven",
    redness: "The first product to calm visibly reactive skin",
    barrier: "The first product to use when your barrier feels shaky"
  }
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
    especiallyGoodFor: "이럴때 특히 좋아요",
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
    resultOverviewBody: "",
    resultPhotoFallback: "업로드한 사진",
    photoObservationTitle: "사진 기준 관찰",
    photoObservationFallback: "사진 분석이 제한되어 설문 답변을 중심으로 정리했습니다.",
    topPickStepKicker: "RESULT STEP 3",
    topPickStepTitle: "Top Pick",
    topPickStepBody: "",
    topPickTabLabel: "Top Pick",
    faceShapeTabLabel: "얼굴형 분석",
    faceShapeFreeKicker: "FACE LAB",
    faceShapeFreeTitle: "Face Lab 티저",
    faceLabTeaserTitle: "Face Lab 티저",
    faceLabTeaserBody: "",
    faceLabImpressionLabel: "인상 라인",
    faceLabShapeLabel: "형태 라인",
    faceLabStyleLabel: "스타일 라인",
    faceShapeLabel: "얼굴형",
    faceShapeSummaryLabel: "한 줄 분석",
    faceShapeTagsLabel: "보이는 특징",
    faceShapeEmpty: "얼굴형 분석을 아직 불러오지 못했습니다.",
    routineProductLabel: "추천 제품",
    alternativeLabel: "함께 볼 대안 1개",
    freeFocusTitle: "지금 바로 따라갈 포인트",
    recommendedStepKicker: "RESULT STEP 3",
    recommendedStepTitle: "함께 쓰면 좋은 추천",
    recommendedStepBody: "",
    recommendedStepEmpty: "함께 추천할 제품이 아직 없습니다.",
    alternativeStepTitle: "대안 1개",
    alternativeStepBody: "",
    faceLabStepTitle: "Face Lab 티저",
    faceLabStepBody: "",
    routineStepKicker: "RESULT STEP 4",
    routineStepTitle: "루틴 및 주의할 점",
    routineStepBody: "",
    routineStepEmpty: "표시할 루틴 정보가 없습니다.",
    routineGateHint: "",
    routinePreviewTitle: "전체 리포트에서 추가로 볼 수 있어요",
    premiumPreviewTitle: "전체 리포트",
    premiumPreviewBody: "",
    tipsStepKicker: "RESULT STEP 5",
    tipsStepTitle: "사용 전에 가볍게 확인하세요",
    tipsStepEmpty: "추가로 확인할 팁이 없습니다.",
    feedbackThanksTitle: "피드백 감사합니다",
    feedbackThanksBody: "다음 추천 개선에 반영하겠습니다.",
    ctaViewTopPick: "Top Pick 보기",
    ctaViewSkinDashboard: "피부 상태 대시보드 보기",
    ctaViewRecommended: "함께 쓰면 좋은 제품 보기",
    ctaViewAlternative: "대안 보기",
    ctaViewRoutine: "루틴 및 주의사항",
    ctaViewPremiumPreview: "전체 리포트 보기",
    ctaViewTips: "주의사항 및 사용 팁 보기",
    ctaLeaveFeedback: "피드백 남기기",
    backHome: "처음으로 돌아가기",
    revisitResult: "결과 다시보기",
    topPickEmpty: "가장 먼저 시작할 제품 정보를 불러오지 못했습니다.",
    premiumCardKicker: "FULL REPORT",
    premiumCardTitle: "실행 순서 이어보기",
    premiumCardBody: "루틴 실행 직전부터 전체 구성과 실제 사용 순서를 이어서 볼 수 있습니다.",
    premiumCardButton: "전체 리포트 보기"
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
    resultOverviewBody: "",
    resultPhotoFallback: "Uploaded photo",
    photoObservationTitle: "Photo-based read",
    photoObservationFallback: "Photo analysis was limited, so the result is organized mainly around the survey answers.",
    topPickStepKicker: "RESULT STEP 3",
    topPickStepTitle: "Top Pick",
    topPickStepBody: "",
    topPickTabLabel: "Top Pick",
    faceShapeTabLabel: "Face Shape",
    faceShapeFreeKicker: "FACE LAB",
    faceShapeFreeTitle: "Face Lab Teaser",
    faceLabTeaserTitle: "Face Lab Teaser",
    faceLabTeaserBody: "",
    faceLabImpressionLabel: "Impression Line",
    faceLabShapeLabel: "Shape Line",
    faceLabStyleLabel: "Style Line",
    faceShapeLabel: "Face shape",
    faceShapeSummaryLabel: "One-line read",
    faceShapeTagsLabel: "Visible features",
    faceShapeEmpty: "Could not load the face-shape analysis yet.",
    routineProductLabel: "Suggested product",
    alternativeLabel: "One Alternative",
    freeFocusTitle: "What To Follow Right Now",
    recommendedStepKicker: "RESULT STEP 3",
    recommendedStepTitle: "Also Worth Using",
    recommendedStepBody: "",
    recommendedStepEmpty: "There are no extra recommendations yet.",
    alternativeStepTitle: "One Alternative",
    alternativeStepBody: "",
    faceLabStepTitle: "Face Lab Teaser",
    faceLabStepBody: "",
    routineStepKicker: "RESULT STEP 4",
    routineStepTitle: "Routine & Notes",
    routineStepBody: "",
    routineStepEmpty: "There is no routine information to show yet.",
    routineGateHint: "",
    routinePreviewTitle: "You can unlock more in the full report",
    premiumPreviewTitle: "Full Report",
    premiumPreviewBody: "",
    tipsStepKicker: "RESULT STEP 5",
    tipsStepTitle: "Check These Before You Start",
    tipsStepEmpty: "There are no extra tips to show yet.",
    feedbackThanksTitle: "Thanks for your feedback",
    feedbackThanksBody: "We will use it to improve the next recommendation.",
    ctaViewTopPick: "See Top Pick",
    ctaViewSkinDashboard: "See Skin Dashboard",
    ctaViewRecommended: "See Supporting Picks",
    ctaViewAlternative: "See Alternative",
    ctaViewRoutine: "Routine & Notes",
    ctaViewPremiumPreview: "See Full Report",
    ctaViewTips: "See Tips",
    ctaLeaveFeedback: "Leave Feedback",
    backHome: "Back to Home",
    revisitResult: "Review Result Again",
    topPickEmpty: "Could not load the Top Pick product.",
    premiumCardKicker: "FULL REPORT",
    premiumCardTitle: "Continue Into The Full Routine",
    premiumCardBody: "From this point, the full setup and actual order continue.",
    premiumCardButton: "See Full Report"
  }
};

const TRACKING_SESSION_KEY = "skinTestTrackingSessionId";

async function getResultPageAccessToken() {
  return getBrowserSupabaseAccessToken();
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
    const supabaseAccessToken = await getResultPageAccessToken();
    const token = supabaseAccessToken;

    if (!token && !writeAccessToken) {
      return;
    }

    const headers = {
      "Content-Type": "application/json"
    };

    if (writeAccessToken) {
      headers["x-kbeauty-write-token"] = writeAccessToken;
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch("/api/track", {
      method: "POST",
      headers,
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
  })();
}

function getResultCopy(locale = "ko") {
  return resultCopy[locale] || resultCopy.ko;
}

function getDisplayMap(locale = "ko") {
  return displayMap[locale] || displayMap.ko;
}

function getDecisionCopy(locale = "ko") {
  if (locale === "en") {
    return {
      priority: "Decision Priority",
      amFocus: "AM Focus",
      pmFocus: "PM Focus",
      warnings: "Warnings",
      photoEvidence: "Photo Evidence",
      surveyEvidence: "Survey Evidence",
      noWarnings: "No extra warnings were needed for this match.",
      noEvidence: "Evidence was limited, so the survey carried more of the decision."
    };
  }

  return {
    priority: "결정 우선순위",
    amFocus: "아침 포커스",
    pmFocus: "저녁 포커스",
    warnings: "주의 포인트",
    photoEvidence: "사진 근거",
    surveyEvidence: "설문 근거",
    noWarnings: "이번 매치에서는 추가 경고를 늘리지 않았습니다.",
    noEvidence: "사진 근거가 제한적이라 설문 비중을 더 높게 두었습니다."
  };
}

function hasKoreanText(value) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(String(value || ""));
}

function getResultLeaveMessage(locale = "ko") {
  return locale === "en"
    ? "Do you want to go back to the survey page?"
    : "설문페이지로 돌아가시겠습니까?";
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

function getPriorityDisplay(decision = null, form = {}, locale = "ko") {
  const display = getDisplayMap(locale);
  const key = decision?.priority?.axis || form?.mainConcern;
  const label = decision?.priority?.label;

  if (locale === "en") {
    return display.mainConcern[key] || (hasKoreanText(label) ? getConcernDisplay(form, locale) : label) || getConcernDisplay(form, locale);
  }

  return label || getConcernDisplay(form, locale);
}

function getOverviewSummary(form = {}, decision = null, locale = "ko") {
  const display = getDisplayMap(locale);
  const concernLabel = getPriorityDisplay(decision, form, locale);
  const skinTypeLabel = display.skinType[form?.skinType] || (locale === "en" ? "Skin" : "피부");
  const directionSummary = getDirectionSummary(form, decision, locale);

  if (locale === "en") {
    return `${skinTypeLabel} with ${concernLabel.toLowerCase()}, so ${directionSummary.charAt(0).toLowerCase()}${directionSummary.slice(1)}`;
  }

  return `${skinTypeLabel} 피부이고 ${concernLabel} 고민이 있어, ${directionSummary}`;
}

function buildOverviewRoutineHighlights(result = null, form = {}, locale = "ko") {
  const structure = getRoutineStructureData(result, locale);
  const amLine = structure?.am?.strategyLine || "";
  const pmLine = structure?.pm?.strategyLine || "";
  const morning = Array.isArray(result?.morning) ? result.morning : [];
  const night = Array.isArray(result?.night) ? result.night : [];
  const fallbackAction = getDirectionAction(form, locale);
  const labels = locale === "en"
    ? { am: "AM strategy", pm: "PM strategy" }
    : { am: "AM 전략", pm: "PM 전략" };

  return [
    {
      key: "am",
      label: labels.am,
      body: amLine || toRoutineAction(morning[0], locale) || fallbackAction
    },
    {
      key: "pm",
      label: labels.pm,
      body: pmLine || toRoutineAction(night[0], locale) || fallbackAction
    }
  ].filter((item) => item.body);
}

function buildOverviewMatchSummary(form = {}, result = null, locale = "ko") {
  const display = getDisplayMap(locale);
  const skinTypeLabel = display.skinType[form?.skinType] || (locale === "en" ? "Matched skin" : "맞춤 피부");
  const priorityLabel = getPriorityDisplay(result, form, locale);
  const concernKeys = Array.isArray(form?.mainConcerns) && form.mainConcerns.length
    ? form.mainConcerns
    : form?.mainConcern
      ? [form.mainConcern]
      : [];
  const concerns = concernKeys
    .map((key) => display.mainConcern[key])
    .filter(Boolean)
    .slice(0, 3);
  const score = typeof result?.topPick?.score === "number" && Number.isFinite(result.topPick.score)
    ? Math.round(result.topPick.score)
    : null;

  return {
    matchLabel: priorityLabel ? `${skinTypeLabel} · ${priorityLabel}` : skinTypeLabel,
    skinTypeLabel,
    priorityLabel,
    concerns,
    routineHighlights: buildOverviewRoutineHighlights(result, form, locale),
    score
  };
}

function getPhotoSignalLabel(signal = {}, locale = "ko") {
  const key = String(signal?.key || "").trim();
  const label = String(signal?.label || "").trim();

  if (locale !== "en") {
    return label;
  }

  const labels = {
    oiliness: "oiliness",
    dehydration: "dryness",
    acne: "breakout tendency",
    uneven_tone: "uneven tone",
    pores: "visible pores",
    redness: "redness",
    barrier: "barrier stress"
  };

  return labels[key] || (hasKoreanText(label) ? "visible skin cue" : label);
}

function getPhotoSignalArea(area, locale = "ko") {
  const text = String(area || "").trim();

  if (locale !== "en" || !text) {
    return text;
  }

  const normalized = text.replace(/\s+/g, "");
  const areaMap = [
    [/볼\/턱라인|볼과턱라인|볼턱라인/i, "cheek / jawline"],
    [/볼주변|볼/i, "cheek area"],
    [/턱라인|턱/i, "jawline"],
    [/티존|T존|T-zone/i, "T-zone"],
    [/이마와코|이마\/코/i, "forehead / nose"],
    [/코주변|코/i, "nose area"],
    [/전체/i, "overall"]
  ];

  const match = areaMap.find(([pattern]) => pattern.test(normalized));

  if (match) {
    return match[1];
  }

  return hasKoreanText(text) ? "visible area" : text;
}

function buildPhotoSignalDescription(signal = {}, locale = "ko") {
  const description = String(signal?.description || "").trim();

  if (locale !== "en") {
    return description;
  }

  if (description && !hasKoreanText(description)) {
    return description;
  }

  const label = getPhotoSignalLabel(signal, locale);
  const area = getPhotoSignalArea(signal?.area, locale);
  const verb = signal?.confidence === "low" ? "appears lightly" : "is visible";

  return `${label.charAt(0).toUpperCase()}${label.slice(1)} ${verb}${area ? ` around the ${area}` : " in the photo"}.`;
}

function buildPhotoObservationSummary(signals = [], rawSummary = "", fallbackSummary = "", locale = "ko") {
  const summary = String(rawSummary || "").trim();

  if (locale !== "en") {
    return summary || fallbackSummary;
  }

  if (summary && !hasKoreanText(summary)) {
    return summary;
  }

  const cues = signals
    .slice(0, 2)
    .map((signal) => {
      const label = getPhotoSignalLabel(signal, locale);
      const area = getPhotoSignalArea(signal?.area, locale);
      return area ? `${label} around the ${area}` : label;
    })
    .filter(Boolean);

  if (!cues.length) {
    return fallbackSummary;
  }

  return `The photo shows ${cues.join(" and ")} as supporting skin cues.`;
}

function normalizePhotoObservationsForDisplay(observations, copy, locale = "ko") {
  const fallbackSummary = copy.photoObservationFallback;
  const source = observations && typeof observations === "object" ? observations : null;
  const signals = Array.isArray(source?.signals)
    ? source.signals
        .map((item) => {
          const signal = {
            key: String(item?.key || "").trim(),
            label: String(item?.label || "").trim(),
            area: String(item?.area || "").trim(),
            confidence: ["low", "medium", "high"].includes(item?.confidence) ? item.confidence : "low",
            description: String(item?.description || "").trim()
          };

          return {
            ...signal,
            label: getPhotoSignalLabel(signal, locale),
            area: getPhotoSignalArea(signal.area, locale),
            description: buildPhotoSignalDescription(signal, locale)
          };
        })
        .filter((item) => item.label || item.area || item.description)
        .slice(0, 3)
    : [];
  const summary = buildPhotoObservationSummary(signals, source?.summary, fallbackSummary, locale);
  const surveyAlignment = source?.surveyAlignment && typeof source.surveyAlignment === "object"
    ? {
        status: String(source.surveyAlignment.status || "unknown").trim(),
        note: locale === "en" && hasKoreanText(source.surveyAlignment.note)
          ? ""
          : String(source.surveyAlignment.note || "").trim()
      }
    : { status: "unknown", note: "" };

  return {
    summary,
    signals,
    surveyAlignment,
    isFallback: !signals.length && summary === fallbackSummary
  };
}

function buildPhotoObservationSignalTitle(signal) {
  const label = String(signal?.label || "").trim();
  const area = String(signal?.area || "").trim();

  if (label && area) {
    return `${label} · ${area}`;
  }

  return label || area || String(signal?.description || "").trim();
}

function buildPhotoRecommendationLine(observations, priorityKey, locale = "ko") {
  const source = observations && typeof observations === "object" ? observations : null;
  const signals = Array.isArray(source?.signals) ? source.signals : [];
  const selected =
    signals.find((signal) => signal?.key === priorityKey) ||
    signals.find((signal) => signal?.confidence !== "low") ||
    signals[0] ||
    null;

  if (selected) {
    const label = getPhotoSignalLabel(selected, locale);
    const area = getPhotoSignalArea(selected.area, locale);
    const weak = selected.confidence === "low";

    if (locale === "en") {
      const cue = area ? `${label.toLowerCase()} around ${area}` : label.toLowerCase();
      return `From the photo, ${cue || "a visible skin cue"} ${weak ? "appears lightly" : "also appears"}, so the recommendation keeps that visual tendency as supporting context.`;
    }

    const cue = area ? `${area} 쪽 ${label}` : label;
    return `사진 기준으로 ${cue || "피부 경향"}이 ${weak ? "약하게 보이는 편이라" : "함께 보여"}, 이 시각적 경향을 보조 근거로 함께 봤습니다.`;
  }

  if (source?.surveyAlignment?.status === "unknown") {
    return locale === "en"
      ? "Because photo detail was limited, the recommendation keeps the survey answers as the main basis."
      : "사진 분석이 제한된 경우에는 설문에서 확인된 흐름을 우선 기준으로 제품을 정리했습니다.";
  }

  return "";
}

function buildRoutinePreviewItems(result, locale = "ko") {
  const items = [];
  const structure = getRoutineStructureData(result, locale);
  const amLine = structure?.am?.strategyLine || "";
  const pmLine = structure?.pm?.strategyLine || "";

  if (locale === "en") {
    if (amLine) {
      items.push(`AM: ${amLine}`);
    }
    if (pmLine) {
      items.push(`PM: ${pmLine}`);
    }
    items.push("The full report opens the exact step order, situation variants, and what not to overlap.");
    return items.slice(0, 4);
  }

  if (amLine) {
    items.push(`AM: ${amLine}`);
  }
  if (pmLine) {
    items.push(`PM: ${pmLine}`);
  }
  items.push("전체 리포트에서는 실제 순서, 상황별 변형, 겹치지 말아야 할 조합까지 이어집니다.");
  return items.slice(0, 4);
}

function buildFinalReportPreviewSections(locale = "ko") {
  const isEnglish = locale === "en";

  if (isEnglish) {
    return [
      {
        key: "routine_execution",
        title: "Morning · night execution routine",
        body: "We organize which product to use, in what order, and at which step."
      },
      {
        key: "situation_routines",
        title: "Situation-based routine changes",
        body: "We adjust the routine for sensitive days, breakout days, outdoor-heavy days, and makeup days."
      },
      {
        key: "avoid_combinations",
        title: "Avoid combinations",
        body: "We point out pairings that can increase irritation or make the routine feel too heavy."
      },
      {
        key: "alternative_strategy",
        title: "Alternative product strategy",
        body: "We explain when and how to switch products instead of relying only on the Top Pick."
      },
      {
        key: "face_lab_expanded",
        title: "Face Lab expanded guide",
        body: "We organize hair direction, avoid styles, and mood keywords that fit your face shape."
      }
    ];
  }

  return [
    {
      key: "routine_execution",
      title: "아침·저녁 실행 루틴",
      body: "제품을 어느 순서로, 어느 단계에서 쓰면 되는지 정리합니다."
    },
    {
      key: "situation_routines",
      title: "상황별 루틴 변형",
      body: "민감한 날, 트러블 올라온 날, 야외활동 많은 날, 메이크업하는 날 기준으로 루틴을 바꿔줍니다."
    },
    {
      key: "avoid_combinations",
      title: "피해야 할 조합",
      body: "같이 쓰면 자극이 커지거나 루틴이 무거워지는 조합을 알려줍니다."
    },
    {
      key: "alternative_strategy",
      title: "대체 제품 사용 전략",
      body: "Top Pick 대신 어떤 제품을 언제 바꿔 쓰면 좋은지 정리합니다."
    },
    {
      key: "face_lab_expanded",
      title: "Face Lab 확장 가이드",
      body: "얼굴형에 맞는 헤어 방향, 피해야 할 스타일, 분위기 키워드를 정리합니다."
    }
  ];
}

function buildRoutineDirectionCards(result, locale = "ko") {
  const axis = result?.priority?.axis || "";
  const isEnglish = locale === "en";

  const copy = {
    ko: {
      morning: "아침",
      night: "저녁",
      core: "루틴 방향"
    },
    en: {
      morning: "Morning",
      night: "Night",
      core: "Routine Direction"
    }
  }[locale] || {
    morning: "아침",
    night: "저녁",
    core: "루틴 방향"
  };

  if (isEnglish) {
    const englishMap = {
      uv: {
        morning: "Because daytime UV exposure is a key condition, a comfortable protection-focused product is the right direction.",
        night: "Because sunscreen and outdoor residue can build up, a gentle reset and light moisture direction is better at night."
      },
      oiliness: {
        morning: "Because oil can rise quickly through the day, a fresher finish product direction is more useful.",
        night: "Because surface residue and shine need to settle, a non-heavy recovery direction is better at night."
      },
      pores: {
        morning: "Because shine and visible texture are linked, a light texture-smoothing product direction is better.",
        night: "Because pore-related buildup can feel heavier by night, a gentle reset direction is useful."
      },
      dehydration: {
        morning: "Because moisture can drop early, a light hydration-support product direction is better.",
        night: "Because the skin needs to hold moisture longer, a barrier-supporting product direction is better."
      },
      acne: {
        morning: "Because heavy residue can feel risky, a lighter low-burden product direction is better.",
        night: "Because repeated breakouts need a steadier base, a simple calming-support direction is better."
      },
      redness: {
        morning: "Because visible sensitivity can rise during the day, a lower-irritation protection direction is better.",
        night: "Because redness needs a calmer base, a comfort-support product direction is better."
      },
      barrier: {
        morning: "Because the barrier looks unsettled, a lower-irritation protection direction is better.",
        night: "Because comfort needs to last longer, a barrier-support product direction is better."
      }
    };
    const selected = englishMap[axis] || englishMap.dehydration;
    return [
      { key: "morning", label: copy.morning, body: selected.morning },
      { key: "night", label: copy.night, body: selected.night }
    ];
  }

  const koreanMap = {
    uv: {
      morning: "야외 노출과 자외선 부담이 있는 상태이므로, 편하게 덧바를 수 있는 보호 방향의 제품을 사용하는 것이 좋습니다.",
      night: "낮 동안 남은 선케어와 잔여감을 정리해야 하는 상태이므로, 순한 세정과 가벼운 보습 방향이 좋습니다."
    },
    oiliness: {
      morning: "오후에 유분이 빠르게 올라올 수 있는 상태이므로, 산뜻하게 마무리되는 방향의 제품을 사용하는 것이 좋습니다.",
      night: "표면 유분과 잔여감을 정리해야 하는 상태이므로, 무겁지 않게 회복을 돕는 방향이 좋습니다."
    },
    pores: {
      morning: "모공과 번들거림이 함께 보이는 상태이므로, 결을 가볍게 정돈하는 방향의 제품을 사용하는 것이 좋습니다.",
      night: "하루 동안 쌓인 피지와 잔여감이 부담될 수 있는 상태이므로, 순하게 정리하는 방향이 좋습니다."
    },
    dehydration: {
      morning: "수분감이 빨리 끊길 수 있는 상태이므로, 가볍게 수분을 이어주는 방향의 제품을 사용하는 것이 좋습니다.",
      night: "건조감이 오래 남을 수 있는 상태이므로, 수분을 잡아두는 장벽 보조 방향이 좋습니다."
    },
    acne: {
      morning: "무거운 잔여감이 부담될 수 있는 상태이므로, 가볍고 답답하지 않은 방향의 제품을 사용하는 것이 좋습니다.",
      night: "트러블 부담이 반복될 수 있는 상태이므로, 단계를 늘리기보다 진정 보조 방향이 좋습니다."
    },
    redness: {
      morning: "붉은기와 예민함이 올라올 수 있는 상태이므로, 자극 부담이 낮은 보호 방향의 제품을 사용하는 것이 좋습니다.",
      night: "피부가 쉽게 달아오를 수 있는 상태이므로, 편안함을 회복하는 방향의 제품을 사용하는 것이 좋습니다."
    },
    barrier: {
      morning: "장벽과 예민함이 함께 잡힌 상태이므로, 자극 부담이 낮은 보호 방향의 제품을 사용하는 것이 좋습니다.",
      night: "편안함이 오래 이어져야 하는 상태이므로, 장벽을 보조하는 방향의 제품을 사용하는 것이 좋습니다."
    }
  };
  const selected = koreanMap[axis] || koreanMap.dehydration;

  return [
    { key: "morning", label: copy.morning, body: selected.morning },
    { key: "night", label: copy.night, body: selected.night }
  ];
}

function getFaceLabProfilePreview(launchData, locale = "ko") {
  const paid = launchData?.paid || {};
  const primary = formatFaceLabDisplayText(paid.faceMood?.primary || "", locale);
  const keywords = formatFaceLabDisplayList(
    [
      ...(Array.isArray(paid.styleKeywords) ? paid.styleKeywords : []),
      ...(Array.isArray(paid.faceMood?.keywords) ? paid.faceMood.keywords : [])
    ],
    locale,
    5
  );

  if (!primary && !keywords.length) {
    return null;
  }

  return {
    label: locale === "en" ? "Face Lab mood" : "Face Lab 대표 무드",
    primary,
    keywords
  };
}

function getAdvanceLabelForStep(stepId, copy) {
  const isEnglish = copy.resultOverviewTitle === "Your Result";

  switch (stepId) {
    case "evidence":
      return isEnglish ? "See why" : "왜 이렇게 판단했나요?";
    case "recommendation-guide":
      return isEnglish ? "See recommendation guide" : "추천 & 활용 보기";
    case "recommendation-validation":
      return isEnglish ? "Check recommendation fit" : "추천이 맞는지 확인하기";
    case "top-pick-preview":
      return copy.ctaViewTopPick;
    case "expected-change-preview":
      return isEnglish ? "Preview expected changes" : "예상 변화 미리보기";
    case "routine-face-lab":
      return isEnglish ? "See routine direction" : "루틴 방향 미리보기";
    case "skin-dashboard":
      return copy.ctaViewSkinDashboard || copy.next;
    case "top-pick":
      return copy.ctaViewTopPick;
    case "alternative":
      return copy.ctaViewAlternative;
    case "routine-summary":
      return copy.ctaViewRoutine;
    case "warnings":
      return copy.ctaViewTips;
    case "premium-preview":
      return isEnglish ? "See full management guide" : "전체 관리 가이드 보기";
    default:
      return copy.next;
  }
}

function getPrimaryConcernKey(result = null, form = {}) {
  return result?.priority?.axis || form?.mainConcern || (Array.isArray(form?.mainConcerns) ? form.mainConcerns[0] : "") || "";
}

function getFreeResultV2FullReportCtaLabel(locale = "ko") {
  return locale === "en"
    ? "Decide my routine plan"
    : "오늘 쓸 루틴까지 정리하기";
}

function getFreeResultV2CorePatternLine(form = {}, result = null, matchSummary = null, locale = "ko") {
  const axis = getPrimaryConcernKey(result, form);
  const skinTypeLabel = matchSummary?.skinTypeLabel || getDisplayMap(locale).skinType[form?.skinType] || (locale === "en" ? "skin" : "피부");
  const priorityLabel = getPriorityDisplay(result, form, locale);
  const secondaryConcerns = Array.isArray(form?.secondaryConcerns) ? form.secondaryConcerns : [];
  const concernHints = uniqueItems([
    axis,
    ...(Array.isArray(form?.mainConcerns) ? form.mainConcerns : []),
    ...secondaryConcerns
  ]);
  const hasOilFlow =
    form?.skinType === "oily" ||
    form?.skinType === "combination" ||
    form?.afternoonSkinChange === "more_oily" ||
    concernHints.some((item) => item === "oiliness" || item === "pores");
  const hasDehydrationFlow =
    form?.postWashFeeling === "tight" ||
    concernHints.some((item) => item === "dehydration" || item === "barrier");

  if (locale === "en") {
    if (form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) {
      return "The surface looks shiny,\nbut the inside feels closer to dry.";
    }

    if (axis === "oiliness" || axis === "pores") {
      return "Oil and pore texture are the first things your skin is showing right now.";
    }

    if (axis === "redness" || axis === "acne") {
      return "Your skin looks like it needs less irritation before stronger care.";
    }

    return `${priorityLabel} looks like the condition to handle first.`;
  }

  if (form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) {
    return "겉으로는 번들거리는데,\n속은 건조한 상태에 가깝습니다.";
  }

  if ((axis === "dehydration" || axis === "barrier") && hasOilFlow) {
    return "겉으로는 번들거리는데,\n속은 건조한 상태에 가깝습니다.";
  }

  if (axis === "oiliness" || axis === "pores") {
    return "지금은 유분과 모공 흐름이\n먼저 눈에 띄는 상태입니다.";
  }

  if (axis === "redness" || axis === "acne") {
    return "피부가 쉽게 예민해질 수 있어\n자극을 먼저 줄이는 편이 좋습니다.";
  }

  return `현재는 ${priorityLabel}을\n먼저 정리해야 하는 상태입니다.`;
}

function getFreeResultV2PatternLabel(form = {}, result = null, matchSummary = null, locale = "ko") {
  const axis = getPrimaryConcernKey(result, form);
  const skinTypeLabel = matchSummary?.skinTypeLabel || getDisplayMap(locale).skinType[form?.skinType] || (locale === "en" ? "Matched skin" : "맞춤 피부");
  const priorityLabel = getPriorityDisplay(result, form, locale);
  const secondaryConcerns = Array.isArray(form?.secondaryConcerns) ? form.secondaryConcerns : [];
  const concernHints = uniqueItems([
    axis,
    ...(Array.isArray(form?.mainConcerns) ? form.mainConcerns : []),
    ...secondaryConcerns
  ]);
  const hasOilFlow = form?.skinType === "oily" || form?.skinType === "combination" || concernHints.some((item) => item === "oiliness" || item === "pores");
  const hasDehydrationFlow = form?.postWashFeeling === "tight" || concernHints.some((item) => item === "dehydration" || item === "barrier");

  if (locale === "en") {
    if (form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) {
      return "Dehydrated combination · oil / pore balance";
    }

    return `${skinTypeLabel} · ${priorityLabel}`;
  }

  if (form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) {
    return "수분 부족형 복합성 · 유분/모공 밸런스";
  }

  return `${skinTypeLabel} · ${priorityLabel}`;
}

function hasFreeResultV2DehydratedCombination(form = {}, result = null) {
  const axis = getPrimaryConcernKey(result, form);
  const secondaryConcerns = Array.isArray(form?.secondaryConcerns) ? form.secondaryConcerns : [];
  const concernHints = uniqueItems([
    axis,
    ...(Array.isArray(form?.mainConcerns) ? form.mainConcerns : []),
    ...secondaryConcerns
  ]);
  const hasOilFlow =
    form?.skinType === "oily" ||
    form?.skinType === "combination" ||
    form?.afternoonSkinChange === "more_oily" ||
    concernHints.some((item) => item === "oiliness" || item === "pores");
  const hasDehydrationFlow =
    form?.postWashFeeling === "tight" ||
    concernHints.some((item) => item === "dehydration" || item === "barrier");

  return Boolean((form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) || ((axis === "dehydration" || axis === "barrier") && hasOilFlow));
}

function getFreeResultV2SkinFlowLabel(form = {}, result = null, matchSummary = null, locale = "ko") {
  const patternLabel = getFreeResultV2PatternLabel(form, result, matchSummary, locale);

  if (locale === "en") {
    return patternLabel.split(" · ")[0] || patternLabel;
  }

  return patternLabel.split(" · ")[0] || patternLabel;
}

function getFreeResultV2CurrentPriorityTagValue(form = {}, result = null, fallback = "", locale = "ko") {
  if (hasFreeResultV2DehydratedCombination(form, result)) {
    return locale === "en" ? "Moisture hold" : "수분 유지";
  }

  return fallback;
}

function buildFreeResultV2Priorities(axis = "", locale = "ko") {
  const priorityMap = locale === "en"
    ? {
        dehydration: [
          ["Moisture retention", "Keep hydration from dropping too fast."],
          ["Barrier comfort", "Avoid irritating the skin while adding moisture."],
          ["Oil / pore balance", "Control shine without over-cleansing."]
        ],
        barrier: [
          ["Barrier comfort", "Keep the routine low-irritation first."],
          ["Moisture retention", "Hold hydration with lighter layers."],
          ["Oil / pore balance", "Do not strip the surface too hard."]
        ],
        oiliness: [
          ["Oil balance", "Reduce surface heaviness without stripping."],
          ["Moisture retention", "Keep the skin from rebounding with more oil."],
          ["Pore texture", "Keep the surface smoother and lighter."]
        ],
        pores: [
          ["Oil / pore balance", "Start with lighter surface control."],
          ["Moisture retention", "Keep hydration steady so texture does not look rougher."],
          ["Barrier comfort", "Avoid stacking strong pore care too fast."]
        ],
        acne: [
          ["Low irritation", "Keep heavy residue and friction low."],
          ["Barrier comfort", "Stabilize the base before adding stronger care."],
          ["Moisture retention", "Keep the routine light but not drying."]
        ],
        redness: [
          ["Low irritation", "Reduce heat, rubbing, and reactive steps first."],
          ["Barrier comfort", "Keep comfort stable through the day."],
          ["Moisture retention", "Use hydration without making the routine heavy."]
        ],
        uneven_tone: [
          ["Daytime protection", "Keep the tone-care base steady."],
          ["Moisture retention", "Avoid making texture look drier."],
          ["Low irritation", "Add brightening care slowly."]
        ],
        uv: [
          ["Daytime protection", "Keep sunscreen comfortable and repeatable."],
          ["Moisture retention", "Prevent dryness under daytime products."],
          ["Low irritation", "Avoid heavy or reactive layering."]
        ]
      }
    : {
        dehydration: [
          ["수분 유지", "수분감이 빨리 끊기지 않게 먼저 잡습니다."],
          ["장벽 안정", "수분을 더해도 자극이 커지지 않게 둡니다."],
          ["유분/모공 밸런스", "피지를 더 벗겨내기보다 균형을 봅니다."]
        ],
        barrier: [
          ["장벽 안정", "자극 부담을 낮추는 구성이 먼저입니다."],
          ["수분 유지", "얇은 보습으로 수분감을 이어갑니다."],
          ["유분/모공 밸런스", "표면을 과하게 벗겨내지 않습니다."]
        ],
        oiliness: [
          ["유분 밸런스", "표면 번들거림을 무겁지 않게 정리합니다."],
          ["수분 유지", "수분 부족으로 유분이 더 올라오지 않게 봅니다."],
          ["모공/결 정돈", "피부결이 거칠어 보이지 않게 정리합니다."]
        ],
        pores: [
          ["유분/모공 밸런스", "가벼운 표면 정돈부터 시작합니다."],
          ["수분 유지", "수분감이 끊겨 결이 더 도드라지지 않게 합니다."],
          ["장벽 안정", "강한 모공 케어를 한 번에 겹치지 않습니다."]
        ],
        acne: [
          ["자극 최소화", "무거운 잔여감과 마찰을 먼저 줄입니다."],
          ["장벽 안정", "강한 기능을 늘리기 전 기본 상태를 잡습니다."],
          ["수분 유지", "건조하지 않지만 답답하지 않게 유지합니다."]
        ],
        redness: [
          ["자극 최소화", "열감, 마찰, 강한 단계를 먼저 줄입니다."],
          ["장벽 안정", "하루 동안 편안함이 이어지게 둡니다."],
          ["수분 유지", "무겁지 않게 수분감을 보강합니다."]
        ],
        uneven_tone: [
          ["낮 시간 보호", "톤 케어의 기본이 되는 보호를 유지합니다."],
          ["수분 유지", "건조로 결이 거칠어 보이지 않게 합니다."],
          ["자극 최소화", "톤 케어 성분은 천천히 늘립니다."]
        ],
        uv: [
          ["낮 시간 보호", "편하게 반복 가능한 선케어를 먼저 둡니다."],
          ["수분 유지", "낮 시간 제품 아래 수분감을 유지합니다."],
          ["자극 최소화", "무겁거나 자극적인 겹침을 줄입니다."]
        ]
      };
  const fallback = priorityMap.dehydration;
  return (priorityMap[axis] || fallback).map(([title, body], index) => ({
    rank: index + 1,
    title,
    body
  }));
}

function buildFreeResultV2DirectionTags(axis = "", form = {}, locale = "ko") {
  const isEnglish = locale === "en";
  const base = isEnglish
    ? ["Avoid over-cleansing", "Hydration first", "Minimize irritation"]
    : ["과한 세안 자제", "수분 보강 우선", "자극 최소화"];
  const byAxis = isEnglish
    ? {
        oiliness: ["Light finish", "Avoid stripping", "Pore balance"],
        pores: ["Texture reset", "Light hydration", "Avoid stacking actives"],
        acne: ["Low residue", "Calming first", "Simple routine"],
        redness: ["Low irritation", "Barrier comfort", "Avoid friction"],
        uneven_tone: ["Daytime protection", "Slow tone care", "Hydration support"],
        uv: ["Sunscreen consistency", "Light finish", "Reapply-friendly"]
      }
    : {
        oiliness: ["산뜻한 마무리", "벗겨내기 자제", "모공 밸런스"],
        pores: ["결 정돈", "가벼운 수분", "기능 겹침 자제"],
        acne: ["잔여감 낮추기", "진정 우선", "단순 루틴"],
        redness: ["자극 최소화", "장벽 안정", "마찰 줄이기"],
        uneven_tone: ["낮 시간 보호", "톤 케어 천천히", "수분 보조"],
        uv: ["선케어 유지", "가벼운 마무리", "덧바르기 편한 구성"]
      };
  const selected = byAxis[axis] || base;

  if (form?.postWashFeeling === "tight" && !selected.includes(base[1])) {
    return uniqueItems([base[1], ...selected]).slice(0, 3);
  }

  return selected.slice(0, 3);
}

function getFreeResultV2DirectionLine(form = {}, result = null, locale = "ko") {
  const axis = getPrimaryConcernKey(result, form);
  const hasOilFlow = form?.skinType === "oily" || form?.skinType === "combination" || form?.afternoonSkinChange === "more_oily";

  if (locale === "en") {
    if ((axis === "dehydration" || axis === "barrier") && hasOilFlow) {
      return "Right now, it is better to hold moisture and stabilize the barrier than to keep removing more oil.";
    }

    return getDirectionSummary(form, result, locale);
  }

  if ((axis === "dehydration" || axis === "barrier") && hasOilFlow) {
    return "지금은 피지를 더 제거하기보다 수분을 유지하고 피부 장벽을 안정시키는 방향이 더 적합합니다.";
  }

  return getDirectionSummary(form, result, locale);
}

function buildFreeResultV2Diagnosis(form = {}, result = null, matchSummary = null, locale = "ko") {
  const axis = getPrimaryConcernKey(result, form);
  const display = getDisplayMap(locale);
  const priorities = buildFreeResultV2Priorities(axis, locale);
  const concernLabels = Array.isArray(matchSummary?.concerns) && matchSummary.concerns.length
    ? matchSummary.concerns
    : getConcernDisplay(form, locale).split(" · ").filter(Boolean);
  const priorityLabel = getPriorityDisplay(result, form, locale);
  const skinFlowLabel = getFreeResultV2SkinFlowLabel(form, result, matchSummary, locale) || display.skinType[form?.skinType] || (locale === "en" ? "Matched skin" : "맞춤 피부");
  const currentPriorityLabel = getFreeResultV2CurrentPriorityTagValue(form, result, priorities[0]?.title || priorityLabel, locale);

  return {
    coreLine: getFreeResultV2CorePatternLine(form, result, matchSummary, locale),
    patternLine: "",
    tags: [
      { label: locale === "en" ? "Skin flow" : "피부 흐름", value: skinFlowLabel },
      { label: locale === "en" ? "Core concern" : "핵심 고민", value: priorities[0]?.title || priorityLabel || concernLabels.slice(0, 2).join(" · ") },
      { label: locale === "en" ? "Current priority" : "현재 우선순위", value: currentPriorityLabel }
    ],
    priorities,
    directionLine: getFreeResultV2DirectionLine(form, result, locale),
    directionTags: buildFreeResultV2DirectionTags(axis, form, locale)
  };
}

function buildSurveyEvidenceSignals(form = {}, locale = "ko") {
  const display = getDisplayMap(locale);
  const isEnglish = locale === "en";
  const labels = isEnglish
    ? {
        postWashFeeling: {
          tight: "tightness after cleansing",
          comfortable: "comfortable after cleansing",
          still_oily: "oiliness remains after cleansing"
        },
        afternoonSkinChange: {
          more_oily: "oil increases later in the day",
          more_dry: "dryness increases later in the day",
          red_or_irritated: "reactivity rises later in the day",
          mostly_same: "condition stays mostly steady"
        },
        sensitivity: {
          high: "high sensitivity",
          medium: "moderate sensitivity",
          low: "low sensitivity"
        },
        texture: {
          gel: "prefers a light gel texture",
          watery: "prefers a watery texture",
          lotion: "prefers a lotion texture",
          cream: "prefers a cream texture"
        },
        finish: {
          fresh: "prefers a fresh finish",
          dewy: "prefers a dewy finish",
          matte: "prefers a matte finish"
        }
      }
    : {
        postWashFeeling: {
          tight: "세안 후 당김",
          comfortable: "세안 후 편안함",
          still_oily: "세안 직후에도 유분감"
        },
        afternoonSkinChange: {
          more_oily: "시간이 지나면 유분 증가",
          more_dry: "시간이 지나면 건조감 증가",
          red_or_irritated: "오후에 예민함 증가",
          mostly_same: "오후 변화가 크지 않음"
        },
        sensitivity: {
          high: "민감 반응 우려",
          medium: "중간 민감도",
          low: "민감도 낮음"
        },
        texture: {
          gel: "가벼운 젤 선호",
          watery: "워터 타입 선호",
          lotion: "로션 타입 선호",
          cream: "크림 타입 선호"
        },
        finish: {
          fresh: "산뜻한 마무리 선호",
          dewy: "촉촉한 마무리 선호",
          matte: "보송한 마무리 선호"
        }
      };

  const signals = [];
  const push = (value) => {
    const cleaned = normalizeCopy(value);
    if (cleaned) {
      signals.push(cleaned);
    }
  };

  const concernKeys = Array.isArray(form?.mainConcerns) && form.mainConcerns.length
    ? form.mainConcerns
    : form?.mainConcern
      ? [form.mainConcern]
      : [];
  const secondaryConcernKeys = Array.isArray(form?.secondaryConcerns) ? form.secondaryConcerns : [];
  const orderedConcernKeys = ["oiliness", "dehydration", "pores", "barrier", "sensitivity", "acne", "redness", "texture", "uneven_tone"];
  const currentConcernKeys = uniqueItems([...concernKeys, ...secondaryConcernKeys]);
  const prioritizedConcernKeys = [
    ...orderedConcernKeys.filter((key) => currentConcernKeys.includes(key)),
    ...currentConcernKeys.filter((key) => !orderedConcernKeys.includes(key))
  ];

  prioritizedConcernKeys.slice(0, 3).forEach((key) => {
    const label = display.mainConcern[key];
    if (label) {
      push(isEnglish ? `${label} concern` : `${label} 고민`);
    }
  });

  push(labels.postWashFeeling[form?.postWashFeeling]);
  push(labels.afternoonSkinChange[form?.afternoonSkinChange]);

  if (form?.sensitivity === "high" || form?.sensitivity === "medium") {
    push(labels.sensitivity[form.sensitivity]);
  }

  if (signals.length < 3) {
    push(labels.texture[form?.preferredTexture]);
  }

  if (signals.length < 3) {
    push(labels.finish[form?.preferredFinish]);
  }

  // TODO: replace these derived survey fallback lines with structured survey evidence if the API exposes it.
  if (!signals.length) {
    push(isEnglish ? "survey answers were limited" : "설문 신호가 제한적임");
  }

  return uniqueItems(signals).slice(0, 3);
}

function buildFreeResultV2PhotoEvidenceSignals(normalized = {}, form = {}, result = null, locale = "ko") {
  const isEnglish = locale === "en";
  const axis = getPrimaryConcernKey(result, form);
  const concerns = uniqueItems([
    axis,
    ...(Array.isArray(form?.mainConcerns) ? form.mainConcerns : []),
    ...(Array.isArray(form?.secondaryConcerns) ? form.secondaryConcerns : [])
  ]);
  const categorized = [];
  const add = (category, label) => {
    const cleaned = normalizeCopy(label);
    if (cleaned) {
      categorized.push({ category, label: cleaned });
    }
  };
  const contains = (text, pattern) => pattern.test(String(text || ""));

  (Array.isArray(normalized?.signals) ? normalized.signals : []).forEach((signal) => {
    const key = String(signal?.key || "").trim();
    const label = String(signal?.label || "").trim();
    const area = String(signal?.area || "").trim();
    const source = `${key} ${label} ${area}`;

    if (key === "oiliness" || contains(source, /oil|유분|번들/i)) {
      add("oil", isEnglish ? (area ? `${area} oiliness` : "T-zone oiliness") : (contains(area, /T존|티존|T-zone|이마|코/i) ? "T존 유분감" : `${area || "T존"} 유분감`));
      return;
    }

    if (key === "pores" || contains(source, /pore|모공/i)) {
      add("pores", isEnglish ? "Visible pores" : "모공 가시성");
      return;
    }

    if (key === "dehydration" || key === "barrier" || contains(source, /dry|dehyd|수분|건조|장벽/i)) {
      add("dry", isEnglish ? (area ? `Lower moisture around ${area}` : "Lower moisture feel") : `${area || "볼 주변"} 수분감 저하`);
      return;
    }

    add("other", buildPhotoObservationSignalTitle(signal));
  });

  const hasOilFlow =
    form?.skinType === "oily" ||
    form?.skinType === "combination" ||
    form?.afternoonSkinChange === "more_oily" ||
    concerns.some((item) => item === "oiliness" || item === "pores");
  const hasDehydrationFlow =
    form?.postWashFeeling === "tight" ||
    concerns.some((item) => item === "dehydration" || item === "barrier");
  const hasPoreFlow = concerns.includes("pores");

  if (hasOilFlow) {
    add("oil", isEnglish ? "T-zone oiliness" : "T존 유분감");
  }

  if (hasPoreFlow) {
    add("pores", isEnglish ? "Visible pores" : "모공 가시성");
  }

  if (hasDehydrationFlow) {
    add("dry", isEnglish ? "Lower moisture around cheeks" : "볼 주변 수분감 저하");
  }

  const order = { oil: 0, pores: 1, dry: 2, other: 3 };
  return categorized
    .sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9))
    .map((item) => item.label)
    .filter((label, index, list) => list.indexOf(label) === index)
    .slice(0, 3);
}

function buildFreeResultV2Interpretation(form = {}, result = null, photoSignals = [], surveySignals = [], locale = "ko") {
  const axis = getPrimaryConcernKey(result, form);
  const priorityLabel = getPriorityDisplay(result, form, locale);
  const secondaryConcerns = Array.isArray(form?.secondaryConcerns) ? form.secondaryConcerns : [];
  const concernHints = uniqueItems([
    axis,
    ...(Array.isArray(form?.mainConcerns) ? form.mainConcerns : []),
    ...secondaryConcerns
  ]);
  const hasOilFlow =
    form?.skinType === "oily" ||
    form?.skinType === "combination" ||
    form?.afternoonSkinChange === "more_oily" ||
    concernHints.some((item) => item === "oiliness" || item === "pores");
  const hasDehydrationFlow =
    form?.postWashFeeling === "tight" ||
    concernHints.some((item) => item === "dehydration" || item === "barrier");

  if (locale === "en") {
    if (form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) {
      return "The photo cues and survey answers point in the same direction, so this reads as a dehydrated combination pattern.";
    }

    return `The photo and survey cues both point toward ${priorityLabel.toLowerCase()}, so the free result keeps that as the first decision axis.`;
  }

  if (form?.skinType === "combination" && hasOilFlow && hasDehydrationFlow) {
    return "사진 신호와 설문 답변이 같은 방향을 가리켜,\n수분 부족형 복합성 패턴으로 판단했습니다.";
  }

  if (photoSignals.length && surveySignals.length) {
    return `사진 신호와 설문 답변이 모두 ${priorityLabel} 쪽으로 모여, 이 축을 먼저 정리하는 방향으로 판단했습니다.`;
  }

  return `${priorityLabel} 흐름을 우선 기준으로 보고, 부족한 사진 신호는 설문 답변으로 보완해 판단했습니다.`;
}

function buildFreeResultV2Evidence(form = {}, result = null, copy, locale = "ko") {
  const normalized = normalizePhotoObservationsForDisplay(result?.photoObservations, copy, locale);
  const photoSignals = buildFreeResultV2PhotoEvidenceSignals(normalized, form, result, locale);

  if (!photoSignals.length && normalized.summary && !normalized.isFallback) {
    photoSignals.push(normalized.summary);
  }

  // TODO: replace this display fallback once photo analysis always returns structured visible signals.
  if (!photoSignals.length) {
    photoSignals.push(locale === "en" ? "photo cues were limited" : "사진 신호는 제한적으로 확인됨");
  }

  const surveySignals = buildSurveyEvidenceSignals(form, locale);

  return {
    photoSignals,
    surveySignals,
    interpretation: buildFreeResultV2Interpretation(form, result, photoSignals, surveySignals, locale)
  };
}

function buildFreeResultV2TopPickUserReason(form = {}, result = null, locale = "ko") {
  const axis = getPrimaryConcernKey(result, form);

  if (locale === "en") {
    if (hasFreeResultV2DehydratedCombination(form, result)) {
      return "It fits a pattern where oil shows up, but the skin still needs a comfortable moisture feel.";
    }

    if (axis === "oiliness" || axis === "pores") {
      return "It fits a pattern where shine shows up easily, but the finish still needs to feel light.";
    }

    if (axis === "dehydration" || axis === "barrier") {
      return "It fits a pattern that needs moisture to feel comfortable for longer.";
    }

    return "It fits the condition your skin is showing most clearly right now.";
  }

  if (hasFreeResultV2DehydratedCombination(form, result)) {
    return "유분은 올라오지만, 수분감은 부족한 패턴에 맞는 후보입니다.";
  }

  if (axis === "oiliness" || axis === "pores") {
    return "번들거림과 모공 흐름을 가볍게 정리하기 좋은 후보입니다.";
  }

  if (axis === "dehydration" || axis === "barrier") {
    return "수분감이 오래 편안하게 이어지도록 돕는 후보입니다.";
  }

  return "지금 피부가 가장 먼저 필요로 하는 방향에 맞는 후보입니다.";
}

function buildFreeResultV2TopPick(product, form = {}, result = null, locale = "ko") {
  if (!product) {
    return null;
  }

  const reason =
    buildFreeResultV2TopPickUserReason(form, result, locale) ||
    getProductPreviewLines(product, 1, locale)[0] ||
    getTopPickSummary(product, form, result, locale) ||
    getTopPickReason(product) ||
    (locale === "en"
      ? "A candidate that fits the current skin direction."
      : "현재 피부 방향에 맞는 후보입니다.");
  const fitPoints = uniqueItems([
    ...buildTopPickDisplayTags(product, form, result, locale),
    ...getTopPickSignalLabels(product, locale),
    getTopPickCategoryReason(product, locale)
  ]).slice(0, 3);

  return {
    product,
    reason: compactTopPickReasonLine(reason, locale),
    fitPoints: fitPoints.length
      ? fitPoints
      : [locale === "en" ? "Current pattern fit" : "현재 피부 패턴 적합"]
  };
}

function buildFreeResultV2RoutinePreview(result = null, locale = "ko") {
  if (locale === "en") {
    return {
      morning: "Light reset → moisture hold → UV protection",
      night: "Gentle cleanse → moisture refill → barrier comfort",
      morningSteps: ["Light reset", "Moisture hold", "UV protection"],
      nightSteps: ["Gentle cleanse", "Moisture refill", "Barrier comfort"],
      morningNote: "A light flow that keeps the skin from feeling heavy.",
      nightNote: "A gentle flow that clears residue and supports comfort.",
      gateNote: "Detailed product order and usage frequency are available in the full report."
    };
  }

  return {
    morning: "가볍게 정돈 → 수분 유지 → 자외선 차단",
    night: "순한 세안 → 수분 보충 → 장벽 안정",
    morningSteps: ["가볍게 정돈", "수분 유지", "자외선 차단"],
    nightSteps: ["순한 세안", "수분 보충", "장벽 안정"],
    morningNote: "무겁게 덮기보다 가볍게 유지하는 흐름입니다.",
    nightNote: "잔여감을 순하게 정리하고 장벽을 안정시키는 흐름입니다.",
    gateNote: "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요."
  };
}

function buildFreeResultV2FaceLabPreview(faceLabPreview = null, locale = "ko") {
  if (faceLabPreview?.primary || faceLabPreview?.keywords?.length) {
    return {
      primary: faceLabPreview.primary || (locale === "en" ? "Mood preview" : "대표 무드"),
      keywords: (faceLabPreview.keywords || []).slice(0, 4)
    };
  }

  // TODO: replace this fallback after Face Lab free preview always includes a mood and style keywords.
  return {
    primary: locale === "en" ? "Mood preview pending" : "대표 무드 분석 준비 중",
    keywords: [locale === "en" ? "style keywords pending" : "스타일 키워드 준비 중"]
  };
}

function normalizeResultCategory(product = {}) {
  const category = String(product?.category || "").trim().toLowerCase();

  if (category === "toner_pad" || category === "toner_essence" || category === "essence") {
    return "toner_essence";
  }

  if (category === "serum" || category === "ampoule") {
    return "serum_ampoule";
  }

  return category;
}

function getProductStepLabel(product = {}, locale = "ko") {
  const normalized = normalizeResultCategory(product);
  const rawStep = String(product?.step || "").trim();
  const labels = locale === "en"
    ? {
        cleanser: "Cleanser",
        toner_essence: "Toner / Essence",
        serum_ampoule: "Serum",
        moisturizer: "Moisturizer",
        sunscreen: "Sunscreen"
      }
    : {
        cleanser: "클렌저",
        toner_essence: "토너 / 에센스",
        serum_ampoule: "세럼",
        moisturizer: "보습제",
        sunscreen: "선크림"
      };

  if (locale === "en" && hasKoreanText(rawStep)) {
    return labels[normalized] || "Product";
  }

  const normalizedStep = rawStep.toLowerCase();
  return labels[normalizedStep] || rawStep || labels[normalized] || (locale === "en" ? "Product" : "제품");
}

function getCategoryFamilyForDisplay(category) {
  const normalized = normalizeResultCategory({ category });

  if (normalized === "toner_essence") {
    return "toner";
  }

  if (normalized === "serum_ampoule") {
    return "serum_ampoule";
  }

  return normalized;
}

function getAlternativeStepTitle(topPick, alternative, locale = "ko") {
  const topFamily = getCategoryFamilyForDisplay(topPick?.category);
  const alternativeFamily = getCategoryFamilyForDisplay(alternative?.category);
  const sameFamily = topFamily && alternativeFamily && topFamily === alternativeFamily;

  if (locale === "en") {
    return sameFamily ? "Alternative for the same concern" : "Alternative from a different direction";
  }

  return sameFamily ? "같은 고민을 보는 대체 제품" : "다른 방향의 대안";
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

function getTopPickHeadline(form, decision = null, locale = "ko") {
  const map = topPickHeadlineMap[locale] || topPickHeadlineMap.ko;
  const copy = getResultCopy(locale);
  const concernKey = decision?.priority?.axis || form?.mainConcern;
  return map[concernKey] || copy.topPickFallback;
}

function getTopPickSummary(product, form, decision = null, locale = "ko") {
  const map = getDisplayMap(locale);
  const copy = getResultCopy(locale);
  const concernKey = decision?.priority?.axis || form?.mainConcern;
  const concern = getPriorityDisplay(decision, form, locale) || map.mainConcern[concernKey] || copy.currentConcern;
  const skinType = map.skinType[form?.skinType] || copy.currentSkin;
  const category = normalizeResultCategory(product);

  if (locale === "en") {
    if (category === "toner_essence" && (concernKey === "pores" || concernKey === "oiliness" || concernKey === "uneven_tone")) {
      return `When ${skinType.toLowerCase()} skin shows both ${concern.toLowerCase()} and surface shine, it helps to smooth the surface first instead of adding heavier coverage. This toner-type step is a steady way to start pore and texture care, and it is safer to begin in thin layers or only a few nights a week.`;
    }

    if (category === "sunscreen") {
      return `With UV pressure carrying the daytime result, the first job is full, comfortable protection that you will actually keep on. This sunscreen is easier to keep in the routine without a heavy finish, so use it as the last morning step and reapply on longer outdoor days.`;
    }

    if (category === "moisturizer") {
      return `When ${skinType.toLowerCase()} skin is losing hydration or barrier comfort, the first fix is holding water in instead of stacking stronger actives. This moisturizer supports a steadier recovery layer, so keep it thin after cleansing and let it do the sealing work.`;
    }

    if (category === "cleanser") {
      return `When oil, breakouts, or cleansing burden are climbing together, the better first move is removing residue cleanly without stripping the skin. This cleanser fits that reset role, especially on sunscreen or makeup days, and works best when you avoid over-scrubbing.`;
    }

    if (category === "serum_ampoule") {
      return `When ${concern.toLowerCase()} keeps repeating, it is usually safer to support the skin with one focused calming or hydration lane instead of stacking more correction. This serum step helps fill that gap, so start with a small amount after toner and keep the rest of the routine simple.`;
    }

    return `For your current ${concern.toLowerCase()} concern, this category helps solve the main bottleneck first instead of widening the routine too early. Keep it as the anchor step and adjust the surrounding layers only after the skin feels steadier.`;
  }

  if (category === "toner_essence" && (concernKey === "pores" || concernKey === "oiliness" || concernKey === "uneven_tone")) {
    return `${skinType} 피부에서 ${concern}과 번들거림이 함께 보이면, 먼저 피부 표면의 결을 정돈하는 쪽이 좋습니다. 이 제품은 과하게 무겁지 않게 모공·결 케어를 시작하기 좋은 선택이라 얇게 쓰거나 주 2~3회 간격으로 시작하는 편이 안전합니다.`;
  }

  if (category === "sunscreen") {
    return `자외선과 야외 노출 비중이 높은 지금은, 충분한 양을 편하게 바를 수 있는 보호 단계가 먼저입니다. 이 제품은 무겁게 남지 않는 선케어 쪽에 가까워 아침 루틴 끝에 넉넉히 바르고 외출이 길면 오후에 덧바르기 좋습니다.`;
  }

  if (category === "moisturizer") {
    return `${skinType} 피부에서 ${concern}이 올라오면, 기능을 더 얹기보다 수분이 빠지지 않게 붙잡는 보습제가 먼저입니다. 이 제품은 회복용 보습 축에 가까워 세안 후 얇게 깔고 예민한 날에도 단계를 늘리지 않은 채 마무리하기 좋습니다.`;
  }

  if (category === "cleanser") {
    return `${skinType} 피부에서 ${concern}과 세안 부담이 같이 걸리면, 세정력을 세게 올리기보다 남김 없이 지우되 벗겨내지 않는 쪽이 먼저입니다. 이 제품은 그런 초기 리셋용 클렌저에 가까워 선크림을 쓴 날 저녁에 특히 맞추기 좋습니다.`;
  }

  if (category === "serum_ampoule") {
    return `${skinType} 피부에서 ${concern}이 반복될 때는, 기능을 여러 개 겹치기보다 진정·수분 보조를 한 축으로 좁히는 편이 안정적입니다. 이 제품은 그 사이를 메우는 세럼 단계에 가까워 토너 다음에 소량만 두고 반응을 보는 쪽이 좋습니다.`;
  }

  return `${skinType} 피부에서 ${concern}이 핵심으로 올라온 지금은, 이 카테고리부터 맞춰 피부 흐름의 병목을 먼저 푸는 편이 좋습니다. 한 단계만 안정적으로 고정한 뒤 주변 제품을 늘리는 순서로 가져가세요.`;
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

function getProductReasonSentences(product, locale = "ko") {
  const fromReason = splitSentences(product?.reason);
  const fromPicked = Array.isArray(product?.why_picked)
    ? product.why_picked.flatMap((item) => splitSentences(item))
    : [];
  const caution = product?.caution_note ? splitSentences(product.caution_note) : [];

  const sentences = uniqueItems([...fromReason, ...fromPicked, ...caution]);
  return locale === "en" ? sentences.filter((item) => !hasKoreanText(item)) : sentences;
}

function compactTopPickReasonLine(line, locale = "ko") {
  const cleaned = normalizeCopy(line)
    .replace(/\s+/g, " ")
    .replace(/^이 제품은\s*/, "")
    .replace(/^추천 이유는\s*/, "")
    .replace(/^특히\s*/, "")
    .replace(/^This product\s+/i, "")
    .trim();

  if (!cleaned) {
    return "";
  }

  const maxLength = locale === "en" ? 86 : 38;
  const chars = Array.from(cleaned);

  if (chars.length <= maxLength) {
    return cleaned;
  }

  const breakpoints = locale === "en"
    ? [", ", "; ", " because ", " while ", " so "]
    : [" 때문에", "라서", "해서", "하며", "이고", ",", "，"];

  for (const point of breakpoints) {
    const index = cleaned.indexOf(point);
    if (index >= 12 && index <= maxLength) {
      return cleaned.slice(0, index).replace(/[,\s]+$/g, "").trim();
    }
  }

  return `${chars.slice(0, maxLength - 1).join("").trim()}…`;
}

function getTopPickCategoryReason(product, locale = "ko") {
  const category = normalizeResultCategory(product);

  if (locale === "en") {
    if (category === "cleanser") return "Keeps the cleansing step gentle and focused.";
    if (category === "toner_essence") return "Adds a light first layer before heavier care.";
    if (category === "serum_ampoule") return "Starts targeted care without widening the routine.";
    if (category === "moisturizer") return "Supports comfort at the final moisture step.";
    if (category === "sunscreen") return "Stabilizes the AM protection step.";
    return "Connects to the routine without feeling too heavy.";
  }

  if (category === "cleanser") return "세안 단계에서 자극 부담을 낮춤";
  if (category === "toner_essence") return "첫 보습 단계에서 결 정돈을 보조";
  if (category === "serum_ampoule") return "세럼 단계로 타깃 케어를 좁게 시작";
  if (category === "moisturizer") return "마무리 보습으로 편안함을 보조";
  if (category === "sunscreen") return "아침 보호 단계를 안정적으로 연결";
  return "기존 루틴에 무겁지 않게 연결";
}

function buildTopPickReasonBullets(product, form, decision = null, locale = "ko") {
  const productReasons = getProductReasonSentences(product, locale);
  const summaryReasons = splitSentences(getTopPickSummary(product, form, decision, locale));
  const especiallyGoodFor = getEspeciallyGoodFor(product, form, locale);
  const hasPhotoSignal = Array.isArray(decision?.photoObservations?.signals)
    && decision.photoObservations.signals.length > 0;
  const structuredReasons = locale === "en"
    ? [
        `Focuses on ${especiallyGoodFor}.`,
        getTopPickCategoryReason(product, locale),
        hasPhotoSignal
          ? "Matches both photo signals and survey priorities."
          : "Reflects the skin type and top concern together."
      ]
    : [
        `${especiallyGoodFor}에 초점을 맞춘 추천`,
        getTopPickCategoryReason(product, locale),
        hasPhotoSignal
          ? "사진 신호와 설문 고민이 함께 겹침"
          : "피부 타입과 우선 고민을 함께 반영"
      ];
  const fallback = locale === "en"
    ? `Fits ${especiallyGoodFor} without widening the routine too early.`
    : `${especiallyGoodFor}에 먼저 맞추기 좋은 선택입니다.`;

  return uniqueItems([...structuredReasons, ...productReasons, ...summaryReasons, fallback])
    .map((line) => compactTopPickReasonLine(line, locale))
    .filter(Boolean)
    .slice(0, 3);
}

function buildTopPickAITip(product, form, decision = null, locale = "ko") {
  const category = normalizeResultCategory(product);
  const concern = getPriorityDisplay(decision, form, locale);

  if (locale === "en") {
    if (category === "sunscreen") {
      return "Use it as the last AM step, then reapply on longer outdoor days.";
    }

    if (category === "cleanser") {
      return "Keep the cleanse short and gentle; more rubbing usually adds stress.";
    }

    if (category === "serum_ampoule") {
      return "Start with a small amount after toner and keep the next layer simple.";
    }

    if (category === "moisturizer") {
      return "Apply a thin layer first, then add more only where tightness remains.";
    }

    return `Keep this as the anchor step while ${concern.toLowerCase()} settles.`;
  }

  if (category === "sunscreen") {
    return "아침 마지막 단계에 충분히 바르고, 외출이 길면 오후에 가볍게 덧바르세요.";
  }

  if (category === "cleanser") {
    return "세안 시간은 짧게 두고, 문지르는 힘을 줄이는 쪽이 더 안정적입니다.";
  }

  if (category === "serum_ampoule") {
    return "토너 다음 소량부터 시작하고, 다음 단계는 단순하게 유지하세요.";
  }

  if (category === "moisturizer") {
    return "먼저 얇게 바른 뒤 당김이 남는 부위만 한 번 더 보충하세요.";
  }

  return `${concern} 흐름이 안정될 때까지 이 단계를 중심으로 루틴을 좁혀보세요.`;
}

function getProductPreviewLines(product, count = 1, locale = "ko") {
  const sentences = getProductReasonSentences(product, locale);
  return sentences.slice(0, count);
}

function clampGauge(value) {
  return Math.max(0, Math.min(5, Math.round(value)));
}

function clampPercent(value) {
  return Math.max(28, Math.min(99, Math.round(value)));
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

function buildSkinDashboardMetrics(result, form = {}, locale = "ko") {
  const priority = result?.priority?.axis || form?.mainConcern || "";
  const photoSignals = Array.isArray(result?.photoObservations?.signals)
    ? result.photoObservations.signals.map((signal) => String(signal?.key || "").trim()).filter(Boolean)
    : [];
  const hasPhotoSignal = (key) => photoSignals.includes(key);
  const isEnglish = locale === "en";
  const afternoonChange = form?.afternoonSkinChange || form?.afternoonChange || "";

  const hydrationAttention =
    (form?.skinType === "dry" ? 12 : 0) +
    (priority === "dehydration" || priority === "barrier" ? 20 : 0) +
    (form?.postWashFeeling === "tight" ? 14 : 0) +
    (hasPhotoSignal("dehydration") ? 12 : 0);
  const oilAttention =
    (form?.skinType === "oily" || form?.skinType === "combination" ? 12 : 0) +
    (priority === "oiliness" || priority === "pores" ? 18 : 0) +
    (afternoonChange === "more_oily" ? 14 : 0) +
    (hasPhotoSignal("oiliness") || hasPhotoSignal("pores") ? 10 : 0);
  const sensitivityAttention =
    (form?.sensitivity === "high" ? 26 : form?.sensitivity === "medium" ? 14 : 0) +
    (priority === "redness" || priority === "barrier" || priority === "acne" ? 20 : 0) +
    (afternoonChange === "red_or_irritated" ? 12 : 0) +
    (hasPhotoSignal("redness") || hasPhotoSignal("acne") ? 12 : 0);
  const barrierAttention =
    (priority === "barrier" || priority === "redness" || priority === "dehydration" ? 18 : 0) +
    (form?.skinType === "dry" ? 8 : 0) +
    (form?.postWashFeeling === "tight" ? 10 : 0) +
    (hasPhotoSignal("barrier") || hasPhotoSignal("dehydration") || hasPhotoSignal("redness") ? 10 : 0);
  const toneAttention =
    (priority === "uneven_tone" || priority === "uv" ? 20 : 0) +
    (hasPhotoSignal("uneven_tone") ? 14 : 0) +
    ((form?.environmentExposure || []).includes("outdoor") ? 10 : 0);

  const statusFor = (value) => {
    if (isEnglish) {
      if (value >= 78) return "Watch";
      if (value >= 62) return "High";
      if (value >= 44) return "Balanced";
      return "Low";
    }

    if (value >= 78) return "주의";
    if (value >= 62) return "높음";
    if (value >= 44) return "보통";
    return "낮음";
  };

  const metrics = isEnglish
    ? [
        {
          key: "hydration",
          label: "Hydration",
          value: clampPercent(46 + hydrationAttention),
          description: hydrationAttention >= 24 ? "Check moisture retention before adding stronger steps." : "Moisture looks moderate, but retention still matters.",
          color: "#e86b93"
        },
        {
          key: "oil",
          label: "Oil Balance",
          value: clampPercent(44 + oilAttention),
          description: oilAttention >= 24 ? "Keep shine and surface texture under control." : "Oil balance looks generally steady.",
          color: "#ff8769"
        },
        {
          key: "sensitivity",
          label: "Sensitivity",
          value: clampPercent(40 + sensitivityAttention),
          description: sensitivityAttention >= 24 ? "Lower-irritation choices should come first." : "Sensitivity pressure looks manageable.",
          color: "#9bd6bd"
        },
        {
          key: "barrier",
          label: "Barrier",
          value: clampPercent(46 + barrierAttention),
          description: barrierAttention >= 24 ? "Support comfort and moisture-holding power together." : "Barrier support is worth checking lightly.",
          color: "#8a5a70"
        },
        {
          key: "tone",
          label: "Tone",
          value: clampPercent(42 + toneAttention),
          description: toneAttention >= 24 ? "Keep daytime protection and tone-care steps consistent." : "Tone pressure looks secondary for now.",
          color: "#f6b6a8"
        }
      ]
    : [
        {
          key: "hydration",
          label: "보습감",
          value: clampPercent(46 + hydrationAttention),
          description: hydrationAttention >= 24 ? "수분 유지력을 먼저 확인합니다." : "보습은 무난하지만 유지력을 함께 봅니다.",
          color: "#e86b93"
        },
        {
          key: "oil",
          label: "유분 밸런스",
          value: clampPercent(44 + oilAttention),
          description: oilAttention >= 24 ? "번들거림과 표면 결을 함께 봅니다." : "유분감은 균형적으로 봅니다.",
          color: "#ff8769"
        },
        {
          key: "sensitivity",
          label: "민감도",
          value: clampPercent(40 + sensitivityAttention),
          description: sensitivityAttention >= 24 ? "자극 부담을 낮추는 쪽이 먼저입니다." : "민감 부담은 낮은 편입니다.",
          color: "#9bd6bd"
        },
        {
          key: "barrier",
          label: "장벽",
          value: clampPercent(46 + barrierAttention),
          description: barrierAttention >= 24 ? "장벽 보조와 편안함을 함께 봅니다." : "장벽 보조는 무난한 편입니다.",
          color: "#8a5a70"
        },
        {
          key: "tone",
          label: "톤",
          value: clampPercent(42 + toneAttention),
          description: toneAttention >= 24 ? "낮 시간 보호와 톤 케어를 꾸준히 봅니다." : "톤 부담은 보조 지표로만 봅니다.",
          color: "#f6b6a8"
        }
      ];

  return metrics.map((metric) => ({
    ...metric,
    status: statusFor(metric.value)
  }));
}

function getDirectionSummary(form, decision = null, locale = "ko") {
  const copy = getResultCopy(locale);
  const concernKey = decision?.priority?.axis || form?.mainConcern;

  if (concernKey === "barrier" || concernKey === "dehydration") {
    return copy.directionSummaryBarrier;
  }

  if (concernKey === "oiliness" || concernKey === "pores") {
    return copy.directionSummaryOil;
  }

  if (concernKey === "acne" || concernKey === "redness") {
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

function buildRoutineFlowSections(result = null, locale = "ko") {
  const structure = getRoutineStructureData(result, locale);
  const morningItems = Array.isArray(result?.morning) ? result.morning : [];
  const nightItems = Array.isArray(result?.night) ? result.night : [];
  const labels = locale === "en"
    ? {
        morning: "AM routine",
        night: "PM routine",
        morningMeta: "Light daytime setup",
        nightMeta: "Reset and support"
      }
    : {
        morning: "AM 루틴",
        night: "PM 루틴",
        morningMeta: "가볍게 시작",
        nightMeta: "정리와 회복"
      };

  const normalizeItems = (items, fallback) => {
    const normalized = items
      .map((item) => toRoutineAction(item, locale))
      .filter(Boolean)
      .slice(0, 4);

    return normalized.length ? normalized : fallback ? [fallback] : [];
  };

  return [
    {
      key: "morning",
      label: labels.morning,
      meta: labels.morningMeta,
      strategy: structure?.am?.strategyLine || "",
      items: normalizeItems(morningItems, structure?.am?.strategyLine)
    },
    {
      key: "night",
      label: labels.night,
      meta: labels.nightMeta,
      strategy: structure?.pm?.strategyLine || "",
      items: normalizeItems(nightItems, structure?.pm?.strategyLine)
    }
  ].filter((section) => section.items.length || section.strategy);
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

function getLocalizedRoutineWarnings(result = null, form = {}, locale = "ko") {
  const warnings = Array.isArray(result?.warnings) ? result.warnings.filter(Boolean).slice(0, 2) : [];

  if (locale !== "en") {
    return warnings;
  }

  const axis = result?.priority?.axis || form?.mainConcern || "";
  const warningMap = {
    uv: ["Do not replace sunscreen reapplication with a thicker morning base or heavier makeup."],
    oiliness: ["Do not over-cleanse just because shine rises through the day; keep the reset gentle."],
    pores: ["Avoid stacking exfoliating pads, pore care, and strong cleansing in the same routine."],
    dehydration: ["Do not make the routine heavier too quickly; cleanse gently and add hydration in thin layers."],
    acne: ["Do not stack spot care, exfoliation, and strong active serums on the same night."],
    uneven_tone: ["Do not add multiple tone-correction steps at once when the skin already feels unsettled."],
    redness: ["On red or reactive days, avoid hot water, strong rubbing, and strong cleansing in the same routine."],
    barrier: ["When the barrier feels unsettled, avoid exfoliating steps and high-friction cleansing in the same routine."]
  };

  return warnings.some(hasKoreanText) || !warnings.length
    ? warningMap[axis] || ["Keep the routine simple first, and avoid adding multiple corrective steps at the same time."]
    : warnings;
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

function buildTopPickDisplayTags(product, form = {}, decision = null, locale = "ko") {
  const isEnglish = locale === "en";
  const labels = isEnglish
    ? {
        hydration: "Hydration",
        barrier: "Barrier support",
        oil: "Oil balance",
        pores: "Pore care",
        calming: "Calming",
        lowIrritation: "Low irritation",
        texture: "Texture care",
        tone: "Tone care",
        uv: "UV protection",
        lightweight: "Light texture"
      }
    : {
        hydration: "보습",
        barrier: "장벽 강화",
        oil: "유분 밸런스",
        pores: "모공 케어",
        calming: "진정",
        lowIrritation: "저자극",
        texture: "결 정돈",
        tone: "톤 케어",
        uv: "자외선 보호",
        lightweight: "산뜻한 사용감"
      };
  const scores = new Map();
  const add = (key, value) => {
    scores.set(key, (scores.get(key) || 0) + value);
  };
  const category = normalizeResultCategory(product);
  const priority = decision?.priority?.axis || form?.mainConcern || "";
  const concerns = Array.isArray(form?.mainConcerns) && form.mainConcerns.length
    ? form.mainConcerns
    : priority
      ? [priority]
      : [];
  const matchedSignals = product?.matched_signals || {};
  const matchedConcerns = Array.isArray(matchedSignals.matched_concerns) ? matchedSignals.matched_concerns : [];
  const photoSignals = Array.isArray(decision?.photoObservations?.signals)
    ? decision.photoObservations.signals.map((signal) => String(signal?.key || "").trim()).filter(Boolean)
    : [];
  const textSource = [
    product?.name,
    product?.brand,
    product?.reason,
    product?.summary,
    product?.description,
    Array.isArray(product?.why_picked) ? product.why_picked.join(" ") : "",
    Array.isArray(product?.ingredients) ? product.ingredients.join(" ") : ""
  ].filter(Boolean).join(" ").toLowerCase();

  const applyConcern = (concern, value) => {
    if (concern === "dehydration") add("hydration", value);
    if (concern === "barrier") add("barrier", value);
    if (concern === "oiliness") add("oil", value);
    if (concern === "pores") add("pores", value);
    if (concern === "redness" || concern === "acne") add("calming", value);
    if (concern === "uneven_tone") add("tone", value);
    if (concern === "uv") add("uv", value);
  };

  concerns.forEach((concern) => applyConcern(concern, 3));
  matchedConcerns.forEach((concern) => applyConcern(concern, 3));
  photoSignals.forEach((signal) => applyConcern(signal, 2));

  if (form?.skinType === "dry") {
    add("hydration", 2);
    add("barrier", 1);
  }
  if (form?.skinType === "oily" || form?.skinType === "combination") {
    add("oil", 2);
    add("lightweight", 1);
  }
  if (form?.postWashFeeling === "tight") {
    add("hydration", 2);
    add("barrier", 1);
  }
  if (form?.sensitivity === "high" || form?.sensitivity === "medium" || matchedSignals.sensitivity_safe) {
    add("lowIrritation", 2);
    add("calming", 1);
  }
  if (category === "serum_ampoule") add("texture", 1);
  if (category === "toner_essence") add("texture", 2);
  if (category === "moisturizer") {
    add("hydration", 2);
    add("barrier", 1);
  }
  if (category === "sunscreen") add("uv", 3);

  if (/hyaluronic|히알루론|수분|moisture|hydrating|hydration/.test(textSource)) add("hydration", 3);
  if (/ceramide|세라마이드|panthenol|판테놀|barrier|장벽|repair/.test(textSource)) add("barrier", 3);
  if (/pore|모공/.test(textSource)) add("pores", 2);
  if (/oil|sebum|유분|피지|번들/.test(textSource)) add("oil", 2);
  if (/cica|시카|centella|진정|calming|redness/.test(textSource)) add("calming", 2);
  if (/niacinamide|나이아신|tone|톤|bright/.test(textSource)) add("tone", 2);

  return Array.from(scores.entries())
    .filter(([, score]) => score >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => labels[key])
    .filter(Boolean);
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

function getMyPath(locale = "ko") {
  return locale === "en" ? "/en/my" : "/my";
}

function getImageFallbackLabel(product) {
  return product?.brand ? `${product.brand} ${product?.name || ""}`.trim() : product?.name || "Product";
}

function SmallProductThumb({ product, height = "h-28", locale = "ko", elevated = false }) {
  const copy = getResultCopy(locale);
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = getResultCopy(locale);
  const [result, setResult] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [faceLabFull, setFaceLabFull] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [isReportSaved, setIsReportSaved] = useState(false);
  const [showSavedNudgeLabel, setShowSavedNudgeLabel] = useState(false);
  const [savedNudgeBounce, setSavedNudgeBounce] = useState(false);
  const [currentResultStep, setCurrentResultStep] = useState(0);
  const resultProgressRef = useRef(null);
  const didMountProgressScrollRef = useRef(false);
  const savedNudgeShownRef = useRef(false);
  const isEnglish = locale === "en";
  const error = searchParams.get("error");
  const homePath = getHomePath(locale);
  const myPath = getMyPath(locale);
  const localizedPath = getLocalePath(pathname, locale);
  const isSavedNudgeFinalStep = Boolean(result) && currentResultStep === 4;

  useEffect(() => {
    const saved = sessionStorage.getItem("skinTestResult");
    const savedSubmission = sessionStorage.getItem("skinTestSubmission");
    const savedFaceLabFull = sessionStorage.getItem("skinTestFaceLabFull");
    const pendingSaveReport = sessionStorage.getItem("pendingSaveReport");
    let pendingPayload = null;

    if (pendingSaveReport) {
      try {
        pendingPayload = JSON.parse(pendingSaveReport);
      } catch {
        pendingPayload = null;
      }
    }

    if (saved) {
      try {
        setResult(JSON.parse(saved));
      } catch {
        setResult(null);
      }
    } else if (pendingPayload?.freeResult) {
      setResult(pendingPayload.freeResult);
    }

    if (savedSubmission) {
      try {
        setSubmission(JSON.parse(savedSubmission));
      } catch {
        setSubmission(null);
      }
    } else if (pendingPayload?.surveySnapshot) {
      setSubmission(pendingPayload.surveySnapshot);
    }

    if (savedFaceLabFull) {
      try {
        setFaceLabFull(JSON.parse(savedFaceLabFull));
      } catch {
        setFaceLabFull(null);
      }
    } else if (pendingPayload?.faceLab) {
      setFaceLabFull(pendingPayload.faceLab);
    }

    setIsReady(true);
  }, []);

  useEffect(() => {
    setIsReportSaved(false);
    setShowSavedNudgeLabel(false);
    setSavedNudgeBounce(false);
    savedNudgeShownRef.current = false;
  }, [result, submission]);

  useEffect(() => {
    if (isReady && result) {
      trackEvent("view_result", {
        product_id: result.topPick?.id || null,
        feature_name: "skin_analysis",
        result_type: "result_page",
        is_top_pick: false,
        meta_json: {
          has_top_pick: Boolean(result.topPick),
          category_pick_count: result.alternative
            ? 1
            : Array.isArray(result.categoryPicks)
              ? result.categoryPicks.length
              : Array.isArray(result.altPicks)
                ? result.altPicks.length
                : 0
        }
      });
    }
  }, [isReady, result]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!didMountProgressScrollRef.current) {
      didMountProgressScrollRef.current = true;
      return;
    }

    const scrollToProgress = () => {
      const target = resultProgressRef.current;

      if (!target) {
        return;
      }

      const labelTarget = target.querySelector("[data-result-progress-label]");
      const targetNode = labelTarget || target;
      const rawTargetTop = targetNode.getBoundingClientRect().top + window.scrollY - 4;
      const maxScrollTop = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const targetTop = Math.min(Math.max(0, rawTargetTop), maxScrollTop);

      window.scrollTo({
        top: targetTop,
        behavior: "smooth"
      });
    };

    const frameId = window.requestAnimationFrame(scrollToProgress);
    const settledTimer = window.setTimeout(scrollToProgress, 320);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(settledTimer);
    };
  }, [currentResultStep]);

  useEffect(() => {
    if (!isReportSaved || isSavedNudgeFinalStep) {
      setShowSavedNudgeLabel(false);
      setSavedNudgeBounce(false);
      return;
    }

    if (savedNudgeShownRef.current) {
      return;
    }

    savedNudgeShownRef.current = true;
    setShowSavedNudgeLabel(true);
    setSavedNudgeBounce(true);

    const labelTimer = window.setTimeout(() => {
      setShowSavedNudgeLabel(false);
    }, 2800);
    const bounceTimer = window.setTimeout(() => {
      setSavedNudgeBounce(false);
    }, 1500);

    return () => {
      window.clearTimeout(labelTimer);
      window.clearTimeout(bounceTimer);
    };
  }, [isReportSaved, isSavedNudgeFinalStep]);

  useEffect(() => {
    if (typeof window === "undefined" || !result) {
      return;
    }

    const message = getResultLeaveMessage(locale);

    window.history.pushState({ resultGuard: true }, "", window.location.href);

    const handlePopState = () => {
      const shouldLeave = window.confirm(message);

      if (shouldLeave) {
        window.removeEventListener("popstate", handlePopState);
        window.history.back();
        return;
      }

      window.history.pushState({ resultGuard: true }, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [locale, result]);

  if (!isReady) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <LoadingSpinner label={copy.loading} />
      </main>
    );
  }

  if (error) {
    return (
      <ErrorState
        variant="analysis_failed"
        title={locale === "en" ? "We could not complete the analysis" : undefined}
        description={
          locale === "en"
            ? "Your photo and answers were received, but a temporary issue kept us from creating the result. Please try again in a moment."
            : undefined
        }
        primaryActionLabel={locale === "en" ? "Analyze again" : undefined}
        primaryActionHref={homePath}
        secondaryActionLabel={locale === "en" ? "Back to home" : undefined}
        secondaryActionHref={homePath}
      />
    );
  }

  if (!result) {
    return (
      <ErrorState
        variant="result_empty"
        title={locale === "en" ? "We could not find your result" : undefined}
        description={
          locale === "en"
            ? "Your previous result may have expired or may not have been saved. Start a new analysis to receive the report again."
            : undefined
        }
        primaryActionLabel={locale === "en" ? "Start a new analysis" : undefined}
        primaryActionHref={homePath}
        secondaryActionLabel=""
        secondaryActionHref=""
      />
    );
  }

  const photoUrl = submission?.imagePreviewDataUrl || submission?.imagePreview || "";
  const resultForm = submission?.form || {};
  const resultPhotoAlt = submission?.imageName || copy.resultPhotoFallback;
  const faceLabLaunch = buildFaceLabLaunchData(faceLabFull || result?.faceLab, locale);
  const faceLabProfilePreview = getFaceLabProfilePreview(faceLabLaunch, locale);
  const overviewMatchSummary = buildOverviewMatchSummary(resultForm, result, locale);
  const freeResultV2Diagnosis = buildFreeResultV2Diagnosis(resultForm, result, overviewMatchSummary, locale);
  const freeResultV2Evidence = buildFreeResultV2Evidence(resultForm, result, copy, locale);
  const freeResultV2TopPick = buildFreeResultV2TopPick(result?.topPick, resultForm, result, locale);
  const freeResultV2RoutinePreview = buildFreeResultV2RoutinePreview(result, locale);
  const freeResultV2FaceLabPreview = buildFreeResultV2FaceLabPreview(faceLabProfilePreview, locale);
  const finalReportPreviewSections = buildFinalReportPreviewSections(locale);
  const goToFullReport = () => {
    trackEvent("click_full_report_cta", {
      product_id: result?.topPick?.id || null,
      feature_name: "skin_analysis",
      result_type: "full_report_cta",
      is_top_pick: false,
      meta_json: {
        has_premium_session: true,
        has_face_lab_preview: Boolean(faceLabProfilePreview)
      }
    });
    router.push(locale === "en" ? "/en/result/full-report" : "/result/full-report");
  };
  const handleTryAgainClick = (event) => {
    if (result && !window.confirm(getResultLeaveMessage(locale))) {
      event.preventDefault();
    }
  };

  const resultSteps = [];

  if (result) {
    resultSteps.push({
      id: "diagnosis",
      content: (
        <FreeResultV2DiagnosisStep
          data={freeResultV2Diagnosis}
          photoUrl={photoUrl}
          photoAlt={resultPhotoAlt}
          photoFallback={copy.resultPhotoFallback}
          faceLabPreview={freeResultV2FaceLabPreview}
          locale={locale}
        />
      )
    });

    resultSteps.push({
      id: "evidence",
      content: (
        <FreeResultV2EvidenceStep
          evidence={freeResultV2Evidence}
          photoUrl={photoUrl}
          photoAlt={resultPhotoAlt}
          photoFallback={copy.resultPhotoFallback}
          locale={locale}
        />
      )
    });

    resultSteps.push({
      id: "recommendation-guide",
      content: (
        <FreeResultV2RecommendationGuideStep
          preview={freeResultV2TopPick}
          routinePreview={freeResultV2RoutinePreview}
          copy={copy}
          locale={locale}
        />
      )
    });

    resultSteps.push({
      id: "recommendation-validation",
      content: (
        <FreeResultV2RecommendationValidationStep locale={locale} />
      )
    });

    resultSteps.push({
      id: "premium-preview",
      content: (
        <section className="space-y-4">
          <ResultStepLead
            kicker={copy.premiumCardKicker}
            title={copy.premiumPreviewTitle}
            body={null}
          />

          <ResultPreviewMaskCard
            copy={copy}
            sections={finalReportPreviewSections}
            ctaLabel={copy.premiumCardButton}
            onCtaClick={goToFullReport}
          />
        </section>
      )
    });
  }

  const totalResultSteps = resultSteps.length;
  const activeResultStep = resultSteps[currentResultStep]?.content || null;
  const isFinalResultStep = Boolean(result) && currentResultStep === totalResultSteps - 1;
  const showBottomCta = Boolean(result) && totalResultSteps > 0 && !isFinalResultStep;
  const nextStepLabel = !isFinalResultStep
    ? getAdvanceLabelForStep(resultSteps[currentResultStep + 1]?.id, copy)
    : null;
  const secondaryActions = [];

  if (isFinalResultStep) {
    if (currentResultStep > 0) {
      secondaryActions.push({
        label: copy.previous,
        onClick: () => setCurrentResultStep((current) => Math.max(0, current - 1))
      });
    }

    secondaryActions.push({
      label: copy.revisitResult,
      onClick: () => setCurrentResultStep(0)
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fff7f2_0%,#f5e5e0_42%,#ead7cf_100%)] text-[#26101a] dark:bg-[radial-gradient(circle_at_top,#241720_0%,#1b1017_46%,#160d13_100%)] dark:text-[#fff8f3]">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-8 pt-4 sm:px-6 sm:pt-6">
        <div className="space-y-4 sm:space-y-5">
          <div className="flex items-center justify-between gap-3 px-1">
            <Link
              href={homePath}
              onClick={handleTryAgainClick}
              className="min-w-0 text-left"
            >
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7e5261] dark:text-[#c8aeb8]">
                AI Beauty Platform
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-[#26101a] dark:text-[#fff8f3]">
                {isEnglish ? "Skin result" : "피부 결과"}
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              <AuthNav locale={locale} showSignOut={false} />

              <AppHamburgerMenu
                locale={locale}
                languageOptions={[
                  { code: "ko", label: "한국어", href: getLocalePath(pathname, "ko") },
                  { code: "en", label: "English", href: getLocalePath(pathname, "en") }
                ]}
                actions={[
                  {
                    label: copy.tryAgain,
                    href: homePath,
                    onClick: handleTryAgainClick
                  }
                ]}
                openLabel={isEnglish ? "Open result menu" : "결과 메뉴 열기"}
                closeLabel={isEnglish ? "Close result menu" : "결과 메뉴 닫기"}
              />
            </div>
          </div>

          <header className="rounded-[1.65rem] border border-white/10 bg-white/[0.92] px-5 py-5 text-[#26101a] shadow-[0_24px_70px_rgba(0,0,0,0.22)] dark:border-[#4a303c] dark:bg-[#241720] dark:text-[#fff8f3] sm:rounded-[2rem] sm:p-5">
            <div className="flex items-start">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7e5261] dark:text-[#c8aeb8] sm:text-[11px] sm:tracking-[0.22em]">
                  AI Beauty Platform
                </p>
                <h1 className="mt-2 text-[26px] font-semibold leading-[1.18] tracking-tight text-[#26101a] dark:text-[#fff8f3] sm:text-2xl sm:leading-tight">
                  {copy.title}
                </h1>
              </div>
            </div>
          </header>

          {result ? (
            <div ref={resultProgressRef} className="scroll-mt-3 px-1">
              <ResultProgressDots
                currentStep={currentResultStep + 1}
                totalSteps={totalResultSteps}
                label={copy.resultProgressLabel}
              />
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

          {showBottomCta ? (
            <ResultBottomCTA
              fixed={false}
              label={isFinalResultStep ? copy.premiumCardButton : nextStepLabel}
              onClick={
                isFinalResultStep
                  ? goToFullReport
                  : () => setCurrentResultStep((current) => Math.min(totalResultSteps - 1, current + 1))
              }
              previousLabel={!isFinalResultStep && currentResultStep > 0 ? copy.previous : null}
              onPrevious={
                !isFinalResultStep && currentResultStep > 0
                  ? () => setCurrentResultStep((current) => Math.max(0, current - 1))
                  : null
              }
              secondaryActions={secondaryActions}
            />
          ) : null}

          {result && submission ? (
            <section
              hidden={!isFinalResultStep}
              className="px-1"
              aria-label={isEnglish ? "Save result" : "결과 저장"}
            >
              <SaveReportCTA
                result={result}
                submission={submission}
                faceLabFull={faceLabFull}
                locale={locale}
                onSaved={() => setIsReportSaved(true)}
                previousLabel={copy.previous}
                onPrevious={
                  isFinalResultStep && isReportSaved && currentResultStep > 0
                    ? () => setCurrentResultStep((current) => Math.max(0, current - 1))
                    : null
                }
              />
            </section>
          ) : null}

          {result && submission ? (
            <section className="border-t border-[#ead9d6]/80 pt-4 dark:border-[#4a303c]">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a6c78] dark:text-[#c8aeb8]">
                    {isEnglish ? "Share result" : "결과 공유"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-[#7a5360] dark:text-[#c8aeb8]">
                    {isEnglish ? "Copy, share, or save as an image." : "링크, 공유, 이미지 저장"}
                  </p>
                </div>
                <ResultShareActions
                  result={result}
                  submission={submission}
                  locale={locale}
                  variant="compact"
                />
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {isReportSaved && !isFinalResultStep ? (
        <motion.a
          href={myPath}
          aria-label={isEnglish ? "View saved result" : "저장된 결과 보러가기"}
          className="fixed bottom-5 right-4 z-40 flex items-center gap-2 sm:right-[calc(50%-18rem)]"
          animate={
            savedNudgeBounce
              ? { y: [0, -8, 0, -5, 0], scale: [1, 1.04, 1, 1.03, 1] }
              : { y: 0, scale: 1 }
          }
          transition={{ duration: 0.78, repeat: savedNudgeBounce ? 1 : 0, ease: "easeOut" }}
        >
          {showSavedNudgeLabel ? (
            <span className="rounded-full border border-[#ead9d6] bg-white/95 px-3 py-2 text-[11px] font-semibold text-[#5a2d3c] shadow-[0_12px_32px_rgba(52,20,35,0.14)] dark:border-[#5a3a48] dark:bg-[#241720]/95 dark:text-[#f4d7df]">
              {isEnglish ? "View saved result" : "\uc800\uc7a5\ub41c \uacb0\uacfc \ubcf4\ub7ec\uac00\uae30"}
            </span>
          ) : null}
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#ead9d6] bg-white/95 text-xs font-bold text-[#5a2d3c] shadow-[0_14px_34px_rgba(52,20,35,0.18)] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
            My
          </span>
        </motion.a>
      ) : null}
    </main>
  );
}

function ResultStepLead({ kicker, title, body }) {
  const sectionMeta = {
    [resultCopy.ko.topPickStepKicker]: { number: "03", eyebrow: "SKIN MATCH" },
    [resultCopy.ko.routineStepKicker]: { number: "04", eyebrow: "ROUTINE SUMMARY" },
    [resultCopy.ko.premiumCardKicker]: { number: "05", eyebrow: "PREMIUM REPORT" },
    [resultCopy.en.topPickStepKicker]: { number: "03", eyebrow: "SKIN MATCH" },
    [resultCopy.en.routineStepKicker]: { number: "04", eyebrow: "ROUTINE SUMMARY" },
    [resultCopy.en.premiumCardKicker]: { number: "05", eyebrow: "PREMIUM REPORT" }
  }[kicker] || { number: null, eyebrow: kicker };

  return (
    <section className="rounded-[2rem] border border-[#ead9d6] bg-transparent p-1 dark:border-[#4a303c]">
      <div className="flex items-start gap-4">
        {sectionMeta.number ? (
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.92] text-sm font-semibold text-[#2b101b] shadow-[0_14px_30px_rgba(0,0,0,0.18)] dark:bg-[#301f28] dark:text-[#fff7f2]">
            {sectionMeta.number}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff7f2] sm:text-[2rem]">{title}</h2>
        </div>
      </div>
      {body ? <p className="ui-text-secondary mt-2 text-sm leading-6">{body}</p> : null}
    </section>
  );
}

function FreeResultV2PhotoFrame({ photoUrl, photoAlt, fallback, showAnalysisOverlay = false, locale = "ko", className = "" }) {
  return (
    <div className={`relative mx-auto flex aspect-[4/5] min-h-[170px] w-full max-w-[230px] items-center justify-center overflow-hidden rounded-[1.35rem] border border-[#ead2cf] bg-white/68 dark:border-[#5a3a48] dark:bg-[#2a1b24] ${className}`}>
      {photoUrl ? (
        <>
          <img src={photoUrl} alt={photoAlt} className="h-full w-full object-cover object-center" />
          {showAnalysisOverlay ? <FreeResultV2AnalysisOverlay locale={locale} /> : null}
        </>
      ) : (
        <div className="px-4 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{fallback}</div>
      )}
    </div>
  );
}

function FreeResultV2AnalysisOverlay({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const labels = isEnglish
    ? {
        forehead: "T-zone",
        pore: "Pore area",
        dry: "Dryness cue",
        badge: "AI view"
      }
    : {
        forehead: "T존 관찰",
        pore: "모공 관찰",
        dry: "건조 의심",
        badge: "AI view"
      };

  return (
    <div className="pointer-events-none absolute inset-0 text-[10px] font-semibold tracking-normal text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(255,154,168,0.22),transparent_23%),radial-gradient(circle_at_34%_56%,rgba(255,255,255,0.16),transparent_19%),radial-gradient(circle_at_64%_52%,rgba(255,128,104,0.14),transparent_18%)]" />
      <span className="absolute left-3 top-3 rounded-full border border-white/38 bg-[#1b1118]/38 px-2 py-1 text-[9px] uppercase tracking-[0.14em] text-white/84 shadow-[0_0_18px_rgba(255,154,168,0.18)] backdrop-blur-sm">
        {labels.badge}
      </span>
      <span className="absolute left-[38%] top-[18%] h-[19%] w-[24%] rounded-[48%] border border-[#ff9aa8]/74 shadow-[0_0_20px_rgba(255,154,168,0.28)]" />
      <span className="absolute left-[49%] top-[28%] h-[21%] border-l border-[#ff9aa8]/70 shadow-[0_0_16px_rgba(255,154,168,0.3)]" />
      <span className="absolute left-[57%] top-[39%] h-2 w-2 rounded-full bg-[#ff9aa8] shadow-[0_0_16px_rgba(255,154,168,0.75)]" />
      <span className="absolute left-[59%] top-[41%] h-px w-[22%] origin-left rotate-[14deg] bg-[#ff9aa8]/75" />
      <span className="absolute right-3 top-[43%] rounded-full border border-white/34 bg-[#1b1118]/42 px-2 py-1 text-white/88 backdrop-blur-sm">
        {labels.pore}
      </span>
      <span className="absolute left-[25%] top-[53%] h-2 w-2 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.72)]" />
      <span className="absolute left-[16%] top-[56%] h-px w-[20%] origin-right -rotate-[20deg] bg-white/72" />
      <span className="absolute left-3 top-[60%] rounded-full border border-white/34 bg-[#1b1118]/42 px-2 py-1 text-white/88 backdrop-blur-sm">
        {labels.dry}
      </span>
      <span className="absolute left-[37%] top-[13%] rounded-full border border-[#ff9aa8]/58 bg-[#1b1118]/28 px-2 py-0.5 text-[#ffd7dd] backdrop-blur-sm">
        {labels.forehead}
      </span>
    </div>
  );
}

function FreeResultV2EvidencePhotoCallout({ title, body, tone = "pink", align = "left", isVisible = true, origin = "left", delay = 0 }) {
  const colorClass = tone === "blue"
    ? "border-[#9fb4ff]/60 bg-[#eef3ff]/90 text-[#465f9a] dark:border-[#9fb4ff]/40 dark:bg-[#2c2d45]/60 dark:text-[#d8e0ff]"
    : "border-[#ff9aa8]/60 bg-[#fff0f4]/90 text-[#9a3657] dark:border-[#ff9aa8]/40 dark:bg-[#3b2431]/60 dark:text-[#ffe4e8]";
  const hiddenX = origin === "left" ? 42 : -42;

  return (
    <motion.div
      className={`max-w-[6.75rem] ${align === "right" ? "text-left" : "text-right"}`}
      initial={false}
      animate={isVisible ? { opacity: 1, x: 0, y: 0, scale: 1, rotate: 0 } : { opacity: 0, x: hiddenX, y: 8, scale: 0.86, rotate: origin === "left" ? 4 : -4 }}
      transition={{
        type: "spring",
        stiffness: 430,
        damping: 23,
        mass: 0.8,
        delay
      }}
      style={{ pointerEvents: isVisible ? "auto" : "none" }}
      aria-hidden={!isVisible}
    >
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-[0_0_16px_rgba(255,154,168,0.12)] ${colorClass}`}>
        {title}
      </span>
      <p className="mt-2 text-[10px] leading-4 text-[#664250] dark:text-[#c8aeb8]">{body}</p>
    </motion.div>
  );
}

function FreeResultV2EvidencePhotoCard({ photoUrl, photoAlt, fallback, locale = "ko" }) {
  const isEnglish = locale === "en";
  const [isCalloutsOpen, setIsCalloutsOpen] = useState(false);
  const storageKey = "bejewely:free-result-v2:evidence-photo-callouts-open";
  const callouts = isEnglish
    ? {
        badge: "AI analysis view",
        reveal: "Tap to reveal",
        revealLabel: "Reveal photo analysis cues",
        oil: ["T-zone oiliness", "Forehead and nose shine"],
        pores: ["Visible pores", "Pore texture around cheeks"],
        dry: ["Lower moisture", "Cheek area looks dry"]
      }
    : {
        badge: "AI 분석 뷰",
        reveal: "눌러보세요!",
        revealLabel: "사진 분석 신호 보기",
        oil: ["T존 유분감", "이마와 코 주변 유분감 확인"],
        pores: ["모공 가시성", "볼 주변 모공이 보이는 편"],
        dry: ["수분감 저하", "볼 주변이 건조해 보임"]
      };
  const revealCallouts = () => {
    setIsCalloutsOpen(true);

    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(storageKey, "true");
      } catch {
        // Ignore storage failures; the reveal still works for the current view.
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      if (window.sessionStorage.getItem(storageKey) === "true") {
        setIsCalloutsOpen(true);
      }
    } catch {
      // Ignore storage failures; the default collapsed state is acceptable.
    }
  }, [storageKey]);

  return (
    <FreeResultV2Card className="overflow-hidden">
      <div className="relative">
        <span className="absolute left-0 top-0 z-20 rounded-full border border-[#e8c8d0] bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#321724] backdrop-blur-sm dark:border-[#5a3a48] dark:bg-[#2a1b24]/75 dark:text-[#f3e4df]">
          {callouts.badge}
        </span>
        <div className="grid min-h-[16rem] grid-cols-[minmax(3.6rem,0.8fr)_minmax(7.4rem,1.7fr)_minmax(3.6rem,0.8fr)] items-center gap-2 pt-8">
          <div className="flex h-full items-center justify-end">
            <FreeResultV2EvidencePhotoCallout
              title={callouts.dry[0]}
              body={callouts.dry[1]}
              tone="blue"
              isVisible={isCalloutsOpen}
              origin="left"
              delay={isCalloutsOpen ? 0.06 : 0}
            />
          </div>
          <button
            type="button"
            onClick={revealCallouts}
            className="relative mx-auto block aspect-[4/5] w-full max-w-[13rem] overflow-hidden rounded-[1.6rem] border border-[#ead2cf] bg-white/68 p-0 text-left outline-none transition hover:border-[#ff9aa8]/52 focus-visible:ring-2 focus-visible:ring-[#ff9aa8]/70 dark:border-[#5a3a48] dark:bg-[#2a1b24]"
            aria-label={callouts.revealLabel}
            aria-expanded={isCalloutsOpen}
          >
            {photoUrl ? (
              <img src={photoUrl} alt={photoAlt} className="h-full w-full object-cover object-center" />
            ) : (
              <div className="flex h-full items-center justify-center px-4 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{fallback}</div>
            )}
            <motion.div
              className="pointer-events-none absolute inset-0"
              initial={false}
              animate={isCalloutsOpen ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.94 }}
              transition={{
                type: "spring",
                stiffness: 430,
                damping: 24,
                mass: 0.8,
                delay: isCalloutsOpen ? 0.02 : 0
              }}
              aria-hidden={!isCalloutsOpen}
            >
              <span className="absolute left-[42%] top-[12%] flex h-[22%] w-[25%] items-center justify-center rounded-[48%] border border-dashed border-[#ff9aa8]/82 bg-[#ff9aa8]/10 text-[12px] font-semibold text-[#ffd9de] shadow-[0_0_18px_rgba(255,154,168,0.28)]">T</span>
              <span className="absolute left-[24%] top-[52%] h-[17%] w-[21%] rounded-full border border-dashed border-[#9fb4ff]/76 bg-[#9fb4ff]/12 shadow-[0_0_18px_rgba(159,180,255,0.24)]" />
              <span className="absolute right-[18%] top-[41%] h-[16%] w-[18%] rounded-full border border-dashed border-[#ff9a8a]/76 bg-[#ff9a8a]/12 shadow-[0_0_18px_rgba(255,154,168,0.24)]" />
            </motion.div>
            <AnimatePresence>
              {!isCalloutsOpen ? (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center bg-[linear-gradient(180deg,transparent_46%,rgba(26,13,21,0.42)_100%)] p-3"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.22 }}
                >
                  <motion.span
                    className="inline-flex items-center rounded-full border border-white/44 bg-[#241720]/78 px-3 py-1.5 text-[11px] font-semibold text-[#fff8f3] shadow-[0_12px_30px_rgba(20,10,16,0.28)] backdrop-blur-sm"
                    animate={{ y: [0, -4, 0], scale: [1, 1.04, 1] }}
                    transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
                  >
                    {callouts.reveal}
                  </motion.span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </button>
          <div className="flex h-full flex-col justify-center gap-8">
            <FreeResultV2EvidencePhotoCallout
              title={callouts.oil[0]}
              body={callouts.oil[1]}
              align="right"
              isVisible={isCalloutsOpen}
              origin="right"
              delay={isCalloutsOpen ? 0.14 : 0}
            />
            <FreeResultV2EvidencePhotoCallout
              title={callouts.pores[0]}
              body={callouts.pores[1]}
              align="right"
              isVisible={isCalloutsOpen}
              origin="right"
              delay={isCalloutsOpen ? 0.22 : 0}
            />
          </div>
        </div>
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2FaceLabPreviewPanel({ faceLabPreview = null, locale = "ko", className = "" }) {
  if (!faceLabPreview) {
    return null;
  }

  const isEnglish = locale === "en";

  return (
    <div className={`rounded-[2rem] border border-[#ead9d6] bg-[#fffaf6] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.14)] dark:border-[#4a303c] dark:bg-[#241720] ${className}`}>
      <p className="text-[13px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">Face Lab</p>
      <p className="mt-3 text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">
        {isEnglish ? "Representative mood: " : "대표 무드: "}
        <span className="font-semibold text-[#26101a] dark:text-[#fff8f3]">{faceLabPreview.primary}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {faceLabPreview.keywords.map((keyword) => (
          <FreeResultV2Pill key={keyword}>{keyword}</FreeResultV2Pill>
        ))}
      </div>
    </div>
  );
}

function getFreeResultV2FaceLabMoodGroups(faceLabPreview = null, locale = "ko") {
  if (!faceLabPreview) {
    return [];
  }

  const isEnglish = locale === "en";
  const fallbacks = isEnglish
    ? {
        mood: "Face mood in analysis",
        tone: "Natural color match",
        style: "Clean style direction"
      }
    : {
        mood: "분석 중인 얼굴 분위기",
        tone: "자연스러운 컬러 매치",
        style: "정돈된 스타일 방향"
      };
  const primary = String(faceLabPreview.primary || "").trim();
  const keywords = uniqueItems([
    ...(Array.isArray(faceLabPreview.keywords) ? faceLabPreview.keywords : [])
  ]).filter(Boolean).slice(0, 5);
  const colorPattern = isEnglish
    ? /peach|coral|pink|cool|warm|tone|color/i
    : /피치|코랄|핑크|쿨|웜|톤|컬러|색/;
  const colorKeywords = keywords.filter((keyword) => colorPattern.test(keyword)).slice(0, 3);
  const styleKeywords = keywords
    .filter((keyword) => keyword !== primary && !colorKeywords.includes(keyword))
    .slice(0, 3);

  return [
    {
      key: "mood",
      label: isEnglish ? "Representative mood" : "대표 무드",
      value: primary || fallbacks.mood
    },
    {
      key: "tone",
      label: isEnglish ? "Best-fit color" : "잘 맞는 컬러",
      value: colorKeywords.join(" · ") || fallbacks.tone
    },
    {
      key: "style",
      label: isEnglish ? "Style direction" : "스타일 방향",
      value: styleKeywords.join(" · ") || fallbacks.style
    }
  ];
}

function FreeResultV2FaceLabPhotoCarousel({ photoUrl, photoAlt, photoFallback, faceLabPreview = null, locale = "ko" }) {
  const isEnglish = locale === "en";
  const groups = getFreeResultV2FaceLabMoodGroups(faceLabPreview, locale);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasPlayedHint, setHasPlayedHint] = useState(false);
  const [valueTextNode, setValueTextNode] = useState(null);
  const touchStartXRef = useRef(null);
  const activeGroup = groups[activeIndex] || groups[0];

  useEffect(() => {
    const valueNode = valueTextNode;

    if (!valueNode) {
      return undefined;
    }

    const maxFontSize = 20.8;
    const minFontSize = 8.5;
    let frameId = null;
    let cancelled = false;

    const fitValueText = () => {
      if (typeof window === "undefined") {
        return;
      }

      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        if (cancelled) {
          return;
        }

        const currentNode = valueTextNode;
        const parentWidth = currentNode?.parentElement?.clientWidth ?? 0;

        if (!currentNode || parentWidth <= 0) {
          return;
        }

        currentNode.style.fontSize = `${maxFontSize}px`;

        const contentWidth = currentNode.scrollWidth;
        const nextFontSize = contentWidth > parentWidth
          ? Math.max(minFontSize, Math.min(maxFontSize, (maxFontSize * parentWidth) / contentWidth))
          : maxFontSize;

        currentNode.style.fontSize = `${Math.floor(nextFontSize * 10) / 10}px`;
      });
    };

    fitValueText();

    const parentNode = valueNode.parentElement;
    const observer = typeof ResizeObserver !== "undefined" && parentNode
      ? new ResizeObserver(fitValueText)
      : null;

    observer?.observe(parentNode);
    window.addEventListener("resize", fitValueText);

    const fontsReady = typeof document !== "undefined" ? document.fonts?.ready : null;
    fontsReady?.then(() => {
      if (!cancelled) {
        fitValueText();
      }
    });

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      observer?.disconnect();
      window.removeEventListener("resize", fitValueText);
    };
  }, [activeGroup?.value, valueTextNode]);

  if (!faceLabPreview || !activeGroup) {
    return (
      <FreeResultV2PhotoFrame
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        fallback={photoFallback}
        locale={locale}
        className="max-w-[14.2rem] min-h-[212px] sm:max-w-[16.2rem] sm:min-h-[243px]"
      />
    );
  }

  const goToIndex = (nextIndex) => {
    if (!groups.length) {
      return;
    }

    setActiveIndex(((nextIndex % groups.length) + groups.length) % groups.length);
  };

  const goNext = () => goToIndex(activeIndex + 1);
  const goPrevious = () => goToIndex(activeIndex - 1);

  const handleTouchStart = (event) => {
    touchStartXRef.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;

    if (typeof startX !== "number") {
      return;
    }

    const endX = event.changedTouches?.[0]?.clientX;
    if (typeof endX !== "number") {
      return;
    }

    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 32) {
      return;
    }

    if (deltaX < 0) {
      goNext();
    } else {
      goPrevious();
    }
  };

  return (
    <FreeResultV2Card
      className="touch-pan-y p-4 sm:p-5"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="relative">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold leading-5 text-[#d9416f] dark:text-[#ff9aa8]">
          Face Lab · 무드 요약
        </p>
      </div>
      {activeGroup ? (
        <>
          <div className="mx-auto flex max-w-[18rem] flex-col items-center">
            <FreeResultV2PhotoFrame
              photoUrl={photoUrl}
              photoAlt={photoAlt}
              fallback={photoFallback}
              locale={locale}
              className="max-w-[14.2rem] min-h-[212px] sm:max-w-[16.2rem] sm:min-h-[243px]"
            />
            <motion.div
              className="mt-3.5 min-h-[4.05rem] w-full px-1 text-center"
              initial={{ x: 0 }}
              animate={hasPlayedHint ? { x: 0 } : { x: [0, 7, -6, 0] }}
              transition={{ delay: 0.25, duration: 0.52, ease: "easeOut" }}
              onAnimationComplete={() => setHasPlayedHint(true)}
            >
              <div className="mx-auto flex max-w-[16rem] flex-col items-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={`${activeGroup.key}-label`}
                    className="block text-[14px] font-semibold leading-5 text-[#9b5a6d] dark:text-[#d8a1b0]"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                  >
                    {activeGroup.label}
                  </motion.span>
                </AnimatePresence>
                <div className="mt-1 flex min-h-[1.65rem] min-w-0 items-center justify-center" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      ref={setValueTextNode}
                      key={`${activeGroup.key}-value`}
                      className="block max-w-full min-w-0 whitespace-nowrap break-keep text-center text-[1.3rem] font-semibold leading-[1.18] text-[#26101a] dark:text-[#fff8f3]"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                    >
                      {activeGroup.value}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </div>
          <div className="mt-0.5 flex items-center justify-center gap-2" aria-label={isEnglish ? "Face Lab lens position" : "Face Lab 관점 위치"}>
              <button
                type="button"
                onClick={goPrevious}
                className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#ead9d6]/72 bg-white/20 text-[13px] font-semibold leading-none text-[#9b5a6d] transition hover:border-[#f2c4ca] hover:bg-white/34 sm:flex dark:border-[#5a3a48]/76 dark:bg-white/[0.032] dark:text-[#d8a1b0] dark:hover:border-[#ff9aa8]/30"
                aria-label={isEnglish ? "Previous Face Lab lens" : "이전 Face Lab 관점"}
              >
                ‹
              </button>
              <div className="flex items-center justify-center gap-1.5">
              {groups.map((group, index) => (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => goToIndex(index)}
                  className={`h-2 rounded-full transition ${index === activeIndex ? "w-4 bg-[#e6507a] dark:bg-[#ff8fa2]" : "w-2 bg-[#d9bdc6] dark:bg-[#6b4b59]"}`}
                  aria-label={isEnglish ? `Show Face Lab lens ${index + 1}` : `${index + 1}번째 Face Lab 관점 보기`}
                  aria-current={index === activeIndex}
                />
              ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#ead9d6]/72 bg-white/20 text-[13px] font-semibold leading-none text-[#9b5a6d] transition hover:border-[#f2c4ca] hover:bg-white/34 sm:flex dark:border-[#5a3a48]/76 dark:bg-white/[0.032] dark:text-[#d8a1b0] dark:hover:border-[#ff9aa8]/30"
                aria-label={isEnglish ? "Next Face Lab lens" : "다음 Face Lab 관점"}
              >
                ›
              </button>
            </div>
        </>
      ) : null}
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2LockRow({ label, subLabel = "", locked = true }) {
  return (
    <div className="flex items-center gap-3 rounded-[1.05rem] border border-[#ead9d6] bg-white/42 px-4 py-3 dark:border-[#5a3a48] dark:bg-[#2a1b24]/74">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#3a1824] dark:text-[#f3e4df]">{label}</p>
        {subLabel ? <p className="mt-0.5 text-xs leading-5 text-[#8b6370] dark:text-[#c8aeb8]">{subLabel}</p> : null}
      </div>
      {locked ? (
        <span className="shrink-0 text-[#9b7280] dark:text-[#9e7f8c]">
          <FreeResultV2LockIcon />
        </span>
      ) : null}
    </div>
  );
}

function FreeResultV2EvidenceSignalGroup({ title, signals = [], tone = "photo" }) {
  const isSurvey = tone === "survey";
  const dotClass = isSurvey ? "bg-[#9aaeff]" : "bg-[#e6507a] dark:bg-[#ff9aa8]";
  const iconBg = isSurvey
    ? "border-[#9aaeff]/30 bg-[#9aaeff]/14 text-[#b8c4ff]"
    : "border-[#ff9aa8]/32 bg-[#ff9aa8]/14 text-[#ff9aa8]";

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${iconBg}`}>
          <FreeResultV2EvidenceSourceIcon tone={tone} />
        </span>
        <p className={`text-sm font-semibold ${isSurvey ? "text-[#6f5ca8] dark:text-[#b8c4ff]" : "text-[#e6507a] dark:text-[#ff9aa8]"}`}>
          {title}
        </p>
      </div>
      <ul className="mt-4 space-y-3">
        {signals.map((signal, index) => (
          <li key={`${title}-${signal}-${index}`} className="flex items-start gap-2.5">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-6 text-[#3a1824] dark:text-[#f3e4df]">{signal}</span>
              <span className="block text-xs leading-5 text-[#8b6370] dark:text-[#c8aeb8]">{getFreeResultV2EvidenceSignalNote(signal, tone)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function getFreeResultV2EvidenceSignalNote(signal = "", tone = "photo") {
  const text = String(signal || "");

  if (tone === "survey") {
    if (/oil|유분/.test(text)) {
      return /[ㄱ-ㅎ가-힣]/.test(text) ? "유분이 쉽게 올라와요" : "Oil comes up easily";
    }
    if (/dry|건조|dehyd|tight/.test(text)) {
      return /[ㄱ-ㅎ가-힣]/.test(text) ? "속당김이 자주 느껴져요" : "Tightness is felt often";
    }
    if (/pore|모공/.test(text)) {
      return /[ㄱ-ㅎ가-힣]/.test(text) ? "모공이 눈에 띄어요" : "Pores stand out";
    }
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "설문 답변에서 확인됨" : "Confirmed in survey answers";
  }

  if (/T존|T-zone|oil|유분/.test(text)) {
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "이마와 코 주변 번들거림" : "Shine around forehead and nose";
  }
  if (/pore|모공/.test(text)) {
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "볼 주변 모공이 도드라짐" : "Pore texture around cheeks";
  }
  if (/dry|건조|수분|moisture/.test(text)) {
    return /[ㄱ-ㅎ가-힣]/.test(text) ? "볼 주변이 건조해 보임" : "Cheek area looks dry";
  }

  return /[ㄱ-ㅎ가-힣]/.test(text) ? "사진에서 확인된 신호" : "Visible cue in the photo";
}

function FreeResultV2EvidenceSignalFace({ source, isActive }) {
  return (
    <div
      className={`col-start-1 row-start-1 min-w-0 rounded-[1.35rem] border border-[#ead9d6] bg-white/28 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66 ${isActive ? "" : "pointer-events-none"}`}
      style={{
        backfaceVisibility: "hidden",
        transform: source.key === "survey" ? "rotateY(180deg)" : "rotateY(0deg)"
      }}
      aria-hidden={!isActive}
    >
      <FreeResultV2EvidenceSignalGroup title={source.title} signals={source.signals} tone={source.key} />
    </div>
  );
}

function FreeResultV2EvidenceSignalsCard({ photoSignals = [], surveySignals = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const [activeSource, setActiveSource] = useState("photo");
  const sources = [
    {
      key: "photo",
      tabLabel: isEnglish ? "Photo" : "사진 신호",
      title: isEnglish ? "Photo cues" : "사진에서 보인 신호",
      signals: photoSignals
    },
    {
      key: "survey",
      tabLabel: isEnglish ? "Survey" : "설문 신호",
      title: isEnglish ? "Survey overlap" : "설문에서 겹친 신호",
      signals: surveySignals
    }
  ];
  const activeSourceData = sources.find((source) => source.key === activeSource) || sources[0];
  const nextSourceData = activeSource === "photo" ? sources[1] : sources[0];
  const setSignalSource = (sourceKey) => {
    setActiveSource(sourceKey);
  };
  const toggleSignalSource = () => {
    setActiveSource((current) => (current === "photo" ? "survey" : "photo"));
  };
  const handleFlipKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleSignalSource();
    }
  };

  return (
    <FreeResultV2Card>
      <p className="text-[13px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">
        {isEnglish ? "Signals used for the decision" : "판단에 사용한 신호"}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 rounded-[1.15rem] border border-[#ead9d6] bg-white/28 p-1 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
        {sources.map((source) => {
          const isActive = source.key === activeSourceData.key;

          return (
            <button
              key={source.key}
              type="button"
              onClick={() => setSignalSource(source.key)}
              className={`inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[linear-gradient(135deg,#f45f88,#ff7b68)] text-white shadow-[0_14px_28px_rgba(230,80,122,0.22)]"
                  : "text-[#7a5360] hover:bg-white/40 dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
              }`}
              aria-pressed={isActive}
            >
              <FreeResultV2EvidenceSourceIcon tone={source.key} className="h-4 w-4" />
              {source.tabLabel}
            </button>
          );
        })}
      </div>

      <div
        className="mt-4 cursor-pointer outline-none"
        role="button"
        tabIndex={0}
        onClick={toggleSignalSource}
        onKeyDown={handleFlipKeyDown}
        aria-label={isEnglish ? `Show ${nextSourceData.tabLabel}` : `${nextSourceData.tabLabel} 보기`}
        style={{ perspective: 1200 }}
      >
        <motion.div
          className="grid"
          animate={{ rotateY: activeSourceData.key === "survey" ? 180 : 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          whileTap={{ scale: 0.985 }}
        >
          {sources.map((source) => (
            <FreeResultV2EvidenceSignalFace
              key={source.key}
              source={source}
              isActive={source.key === activeSourceData.key}
            />
          ))}
        </motion.div>
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2EvidenceBridge({ locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[#ead9d6]/55 bg-[linear-gradient(135deg,rgba(255,253,251,0.62),rgba(255,250,248,0.48))] px-4 py-2 shadow-none dark:border-[rgba(255,154,168,0.18)] dark:bg-[linear-gradient(135deg,rgba(244,95,136,0.13),rgba(166,122,255,0.075))] dark:shadow-[0_0_28px_rgba(244,95,136,0.055)]">
      <div className="flex min-h-12 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/24 bg-white/34 text-[#e6507a] dark:border-[#ff9aa8]/20 dark:bg-white/[0.04] dark:text-[#ff9aa8]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true">
            <path d="M12 3.8 13.6 8.4 18.2 10 13.6 11.6 12 16.2 10.4 11.6 5.8 10 10.4 8.4 12 3.8Z" fill="currentColor" opacity="0.9" />
            <path d="M18 14.5 18.7 16.3 20.5 17 18.7 17.7 18 19.5 17.3 17.7 15.5 17 17.3 16.3 18 14.5Z" fill="currentColor" opacity="0.58" />
          </svg>
        </span>
        <p className="min-w-0 break-keep text-left text-[13px] font-semibold leading-5 text-[#4d2635] dark:text-[#f1d9e2]">
          {isEnglish
            ? "Based on this analysis, we organized the best-fit product and how to use it."
            : "이 분석을 바탕으로 가장 적합한 제품과 활용 방법을 정리했습니다."}
        </p>
      </div>
    </div>
  );
}

function getFreeResultV2SkinRadarMetrics(data = {}, locale = "ko") {
  const isEnglish = locale === "en";
  const summaryText = [
    data?.coreLine,
    ...(Array.isArray(data?.priorities) ? data.priorities.flatMap((priority) => [priority.title, priority.body]) : []),
    ...(Array.isArray(data?.tags) ? data.tags.flatMap((tag) => [tag.label, tag.value]) : [])
  ].filter(Boolean).join(" ").toLowerCase();
  const includesAny = (terms) => terms.some((term) => summaryText.includes(term.toLowerCase()));
  const hasMoistureCue = includesAny(["수분", "건조", "moisture", "dry", "dehydrat"]);
  const hasOilCue = includesAny(["유분", "피지", "번들", "oil", "shine"]);
  const hasPoreCue = includesAny(["모공", "pore"]);
  const hasBarrierCue = includesAny(["장벽", "barrier"]);
  const hasSensitivityCue = includesAny(["민감", "예민", "자극", "붉", "트러블", "sensitive", "irritation", "redness", "breakout", "acne"]);

  return [
    { key: "moisture", label: isEnglish ? "Dryness" : "수분부족", value: hasMoistureCue ? 76 : 42 },
    { key: "oil", label: isEnglish ? "Oil" : "유분감", value: hasOilCue ? 78 : 44 },
    { key: "pores", label: isEnglish ? "Pores" : "모공", value: hasPoreCue ? 72 : 42 },
    { key: "barrier", label: isEnglish ? "Barrier" : "장벽", value: hasBarrierCue ? 68 : 40 },
    { key: "sensitivity", label: isEnglish ? "Sensitive" : "민감", value: hasSensitivityCue ? 64 : 36 }
  ];
}

function getFreeResultV2PentagonPoint(value, index, radius = 48, center = { x: 88, y: 88 }) {
  const angle = (-90 + index * 72) * (Math.PI / 180);
  const scale = Math.max(0, Math.min(100, Number(value) || 0)) / 100;

  return {
    x: center.x + Math.cos(angle) * radius * scale,
    y: center.y + Math.sin(angle) * radius * scale
  };
}

function getFreeResultV2PentagonPoints(values, radius = 48, center = { x: 88, y: 88 }) {
  return values
    .map((value, index) => {
      const point = getFreeResultV2PentagonPoint(value, index, radius, center);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
}

function getFreeResultV2RadarStatus(metric = {}, locale = "ko") {
  const value = Math.max(0, Math.min(100, Number(metric.value) || 0));
  const isEnglish = locale === "en";
  const copy = {
    high: { label: isEnglish ? "High" : "높음", rank: 4 },
    medium: { label: isEnglish ? "Medium" : "중간", rank: 3 },
    caution: { label: isEnglish ? "Watch" : "주의", rank: 2 },
    normal: { label: isEnglish ? "Stable" : "보통", rank: 1 }
  };

  if (value < 55) {
    return { tone: "normal", ...copy.normal };
  }

  if (metric.key === "moisture") {
    return { tone: value >= 70 ? "high" : "medium", ...(value >= 70 ? copy.high : copy.medium) };
  }

  if (metric.key === "oil") {
    return { tone: value >= 64 ? "medium" : "normal", ...(value >= 64 ? copy.medium : copy.normal) };
  }

  if (metric.key === "pores") {
    return { tone: value >= 64 ? "caution" : "normal", ...(value >= 64 ? copy.caution : copy.normal) };
  }

  return { tone: "normal", ...copy.normal };
}

function getFreeResultV2RadarChipClass(tone = "normal") {
  if (tone === "high") {
    return "border-[#f3bbc7] bg-[#fff4f6]/72 text-[#cf466b] dark:border-[#ff8fa2]/32 dark:bg-[#ff8fa2]/10 dark:text-[#ff9aa8]";
  }

  if (tone === "medium") {
    return "border-[#ead0e4] bg-[#fcf5ff]/68 text-[#865878] dark:border-[#d8a1d8]/25 dark:bg-[#d8a1d8]/10 dark:text-[#e8b5df]";
  }

  if (tone === "caution") {
    return "border-[#efcfac] bg-[#fff7ed]/72 text-[#94613b] dark:border-[#ffbf78]/25 dark:bg-[#ffbf78]/10 dark:text-[#ffd0a2]";
  }

  return "border-[#ead9d6] bg-white/38 text-[#7a5360] dark:border-[#5a3a48] dark:bg-[#2a1b24]/54 dark:text-[#c8aeb8]";
}

function FreeResultV2SkinRadarHelpModal({ isOpen, onClose, locale = "ko" }) {
  const isEnglish = locale === "en";
  const axisItems = isEnglish
    ? [
        ["Moisture lack", "How easily the skin loses hydration and starts to feel dry."],
        ["Oil feel", "How easily shine appears around the forehead and nose."],
        ["Pore visibility", "How noticeable pores or surface texture look."],
        ["Barrier burden", "How much the skin's basic moisture-holding comfort needs support."],
        ["Irritation response", "The chance of redness, stinging, or sensitivity showing up."]
      ]
    : [
        ["수분 부족", "피부가 수분을 오래 유지하지 못하고 쉽게 건조해지는 정도"],
        ["유분감", "이마와 코 주변 번들거림이 얼마나 쉽게 올라오는지"],
        ["모공 가시성", "모공이나 피부결이 눈에 얼마나 도드라져 보이는지"],
        ["장벽 부담", "수분을 붙잡고 자극을 버티는 피부 기본 컨디션"],
        ["자극 반응", "붉어짐·따가움·예민함 같은 자극 반응 가능성"]
      ];

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.button
            type="button"
            className="fixed inset-0 z-[80] bg-[#2a101b]/24 backdrop-blur-[1px] dark:bg-black/42"
            onClick={onClose}
            aria-label={isEnglish ? "Close skin summary help" : "피부 상태 요약 도움말 닫기"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="free-result-v2-skin-radar-help-title"
            className="fixed inset-x-4 top-[8vh] z-[81] mx-auto max-h-[84vh] w-auto max-w-[22rem] overflow-y-auto rounded-[1.35rem] border border-[#ead9d6] bg-[#fffaf6] p-4 text-left shadow-[0_28px_80px_rgba(35,16,25,0.28)] dark:border-[#5a3a48] dark:bg-[#241720] dark:shadow-[0_28px_80px_rgba(0,0,0,0.48)]"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 id="free-result-v2-skin-radar-help-title" className="text-[1rem] font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
                {isEnglish ? "What is the skin state summary?" : "피부 상태 요약이란?"}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-[#ead9d6] px-3 py-1 text-[12px] font-semibold text-[#7a5360] transition hover:bg-white dark:border-[#5a3a48] dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
              >
                {isEnglish ? "Close" : "닫기"}
              </button>
            </div>
            <div className="mt-3 space-y-2 break-keep text-[12px] leading-5 text-[#5f3a48] dark:text-[#d8c2c9]">
              <p>
                {isEnglish
                  ? "The pentagon compresses signals from the photo analysis and survey into five care axes."
                  : "오각형은 사진 분석과 설문 답변에서 확인된 신호를 5가지 관리 축으로 압축한 요약입니다."}
              </p>
              <p>
                {isEnglish
                  ? "The farther outward an axis is, the more that signal needs attention now. Recommendations reflect this flow together with the care priority."
                  : "바깥쪽으로 갈수록 현재 더 신경 써야 할 신호가 강하다는 의미이며, 추천 결과는 이 흐름과 관리 우선순위를 함께 반영합니다."}
              </p>
            </div>
            <dl className="mt-3 divide-y divide-[#ead9d6] overflow-hidden rounded-[1rem] border border-[#ead9d6] bg-white/38 dark:divide-[#4a303c] dark:border-[#4a303c] dark:bg-[#2a1b24]/70">
              {axisItems.map(([label, description]) => (
                <div key={label} className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-2 px-3 py-2.5">
                  <dt className="text-[12px] font-semibold leading-5 text-[#e6507a] dark:text-[#ff9aa8]">{label}</dt>
                  <dd className="break-keep text-[12px] leading-5 text-[#4d2635] dark:text-[#f1d9e2]">{description}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-[#ead9d6] pt-3 break-keep text-[11px] leading-5 text-[#7a5360] dark:border-[#4a303c] dark:text-[#c8aeb8]">
              {isEnglish
                ? "These are not medical measurements. They are a care-priority summary organized from photo and survey signals."
                : "이 수치는 의료적 측정값이 아니라, 사진과 설문 신호를 종합해 정리한 관리 우선순위 요약입니다."}
            </p>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}

function FreeResultV2SkinRadarSummary({ data, locale = "ko", size = "compact", showLegend = false }) {
  const isEnglish = locale === "en";
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const metrics = getFreeResultV2SkinRadarMetrics(data, locale);
  const metricsWithStatus = metrics.map((metric) => ({
    ...metric,
    status: getFreeResultV2RadarStatus(metric, locale)
  }));
  const preferredSignalKeys = ["moisture", "oil", "pores"];
  const topSignals = preferredSignalKeys
    .map((key) => metricsWithStatus.find((metric) => metric.key === key))
    .filter(Boolean);
  const isLarge = size === "large";
  const radarCenter = isLarge ? { x: 94, y: 92 } : { x: 88, y: 88 };
  const radarRadius = isLarge ? 54 : 48;
  const currentPoints = getFreeResultV2PentagonPoints(metrics.map((metric) => metric.value), radarRadius, radarCenter);
  const balancePoints = getFreeResultV2PentagonPoints([62, 62, 62, 62, 62], radarRadius, radarCenter);
  const guideLevels = [25, 50, 75, 100];
  const labelPositions = isLarge
    ? [
        { x: 94, y: 13, anchor: "middle" },
        { x: 167, y: 82, anchor: "middle" },
        { x: 137, y: 161, anchor: "middle" },
        { x: 51, y: 161, anchor: "middle" },
        { x: 21, y: 82, anchor: "middle" }
      ]
    : [
        { x: 88, y: 14, anchor: "middle" },
        { x: 154, y: 84, anchor: "middle" },
        { x: 128, y: 164, anchor: "middle" },
        { x: 48, y: 164, anchor: "middle" },
        { x: 22, y: 84, anchor: "middle" }
      ];

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[#3a1824] dark:text-[#fff8f3]">
          {isEnglish ? "Skin state summary" : "피부 상태 요약"}
        </p>
        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#f2a4b6] bg-[#fff0f4]/74 text-[11px] font-semibold text-[#d9416f] shadow-[0_0_0_3px_rgba(230,80,122,0.07)] transition hover:border-[#e6507a] hover:bg-[#ffe5eb] hover:text-[#c93362] hover:shadow-[0_0_0_4px_rgba(230,80,122,0.12)] active:scale-95 dark:border-[#ff9aa8]/48 dark:bg-[#ff9aa8]/10 dark:text-[#ff9aa8] dark:shadow-[0_0_0_3px_rgba(255,154,168,0.055)] dark:hover:border-[#ff9aa8] dark:hover:bg-[#ff9aa8]/14 dark:hover:shadow-[0_0_0_4px_rgba(255,154,168,0.1)]"
          title={isEnglish ? "View skin state summary help." : "피부 상태 요약 설명 보기"}
          aria-label={isEnglish ? "Skin state summary help" : "피부 상태 요약 도움말"}
          aria-haspopup="dialog"
          aria-expanded={isHelpOpen}
        >
          i
        </button>
      </div>
      {showLegend ? (
        <p className="mx-auto mt-3 max-w-[17rem] break-keep text-center text-[13px] font-medium leading-6 text-[#5f3a48] dark:text-[#d8c2c9]">
          {isEnglish ? (
            <>
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">Dryness</span> is the strongest signal,
              <br />
              with <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">oil feel</span> and{" "}
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">pores</span> needing care too.
            </>
          ) : (
            <>
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">수분 부족</span> 신호가 가장 강하고,
              <br />
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">유분감</span>과{" "}
              <span className="font-semibold text-[#e6507a] dark:text-[#ff8fa2]">모공</span>도 함께 관리가 필요해요.
            </>
          )}
        </p>
      ) : null}
      <div className="mt-2 flex justify-center">
        <svg
          viewBox={isLarge ? "0 0 188 184" : "0 0 176 176"}
          className={`w-full ${isLarge ? "aspect-[188/184] max-w-[15.45rem]" : "aspect-square max-w-[10.9rem]"}`}
          role="img"
          aria-label={isEnglish
            ? "Pentagon skin parameter summary: moisture lack, oil feel, pore visibility, barrier burden, irritation response"
            : "오각 피부 파라미터 요약: 수분 부족, 유분감, 모공 가시성, 장벽 부담, 자극 반응"}
        >
          {guideLevels.map((level) => (
            <polygon
              key={level}
              points={getFreeResultV2PentagonPoints([level, level, level, level, level], radarRadius, radarCenter)}
              fill="none"
              stroke="currentColor"
              strokeWidth="0.7"
              className="text-[#cbb4bc] opacity-[0.38] dark:text-[#63505a] dark:opacity-[0.55]"
            />
          ))}
          {Array.from({ length: 5 }).map((_, index) => {
            const endPoint = getFreeResultV2PentagonPoint(100, index, radarRadius, radarCenter);
            return (
              <line
                key={index}
                x1={radarCenter.x}
                y1={radarCenter.y}
                x2={endPoint.x.toFixed(1)}
                y2={endPoint.y.toFixed(1)}
                stroke="currentColor"
                strokeWidth="0.7"
                className="text-[#cbb4bc] opacity-[0.34] dark:text-[#63505a] dark:opacity-[0.48]"
              />
            );
          })}
          <polygon
            points={balancePoints}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="4 3"
            className="text-[#8f98a3] opacity-[0.42] dark:opacity-[0.46]"
          />
          <polygon points={currentPoints} fill="currentColor" className="text-[#e6507a] opacity-[0.28] dark:text-[#ff7f98] dark:opacity-[0.34]" />
          <polygon points={currentPoints} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" className="text-[#e6507a] dark:text-[#ff8fa2]" />
          {metrics.map((metric, index) => {
            const point = getFreeResultV2PentagonPoint(metric.value, index, radarRadius, radarCenter);
            return (
              <circle key={metric.key} cx={point.x.toFixed(1)} cy={point.y.toFixed(1)} r="3" fill="currentColor" className="text-[#e6507a] dark:text-[#ff8fa2]" />
            );
          })}
          {metrics.map((metric, index) => (
            <text
              key={metric.key}
              x={labelPositions[index].x}
              y={labelPositions[index].y}
              textAnchor={labelPositions[index].anchor}
              className={`fill-[#5f3a48] ${isLarge ? "text-[11px]" : "text-[10.5px]"} font-semibold dark:fill-[#d8c2c9]`}
            >
              {metric.label}
              {isLarge ? (
                <tspan
                  x={labelPositions[index].x}
                  dy="1.15em"
                  className="fill-[#9a6c78] text-[8.5px] font-medium dark:fill-[#b896a2]"
                >
                  {metricsWithStatus[index]?.status?.label}
                </tspan>
              ) : null}
            </text>
          ))}
        </svg>
      </div>
      {showLegend ? (
        <div className="mt-0.5">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10.5px] text-[#8b6873] dark:text-[#b896a2]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-5 rounded-full bg-[#e6507a] dark:bg-[#ff8fa2]" aria-hidden="true" />
              {isEnglish ? "My state" : "나의 상태"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-px w-5 border-t border-dashed border-[#8f98a3]" aria-hidden="true" />
              {isEnglish ? "Guide" : "관리 기준"}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {topSignals.map((metric) => (
              <span
                key={metric.key}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none shadow-none ${getFreeResultV2RadarChipClass(metric.status.tone)}`}
              >
                {metric.label}
                <span className="font-medium opacity-[0.82]">{metric.status.label}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <FreeResultV2SkinRadarHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} locale={locale} />
    </div>
  );
}

function FreeResultV2DiagnosisSummaryCard({ photoUrl, photoAlt, photoFallback, faceLabPreview = null, locale = "ko" }) {
  const hasFaceLab = Boolean(faceLabPreview);

  if (hasFaceLab) {
    return (
      <FreeResultV2FaceLabPhotoCarousel
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        photoFallback={photoFallback}
        faceLabPreview={faceLabPreview}
        locale={locale}
      />
    );
  }

  return (
    <FreeResultV2Card className="p-4 sm:p-5">
      <div className="flex justify-center">
        <FreeResultV2PhotoFrame
          photoUrl={photoUrl}
          photoAlt={photoAlt}
          fallback={photoFallback}
          locale={locale}
          className="max-w-[14.2rem] min-h-[212px] sm:max-w-[16.2rem] sm:min-h-[243px]"
        />
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2SkinRadarCard({ data, locale = "ko" }) {
  return (
    <FreeResultV2Card className="p-4 sm:p-5">
      <FreeResultV2SkinRadarSummary data={data} locale={locale} size="large" showLegend />
    </FreeResultV2Card>
  );
}

function FreeResultV2PriorityListCard({ priorities = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const [openRank, setOpenRank] = useState(null);
  const displayPriorities = Array.isArray(priorities) ? priorities.slice(0, 3) : [];

  if (!displayPriorities.length) {
    return null;
  }

  const getShortBody = (priority) => {
    const title = String(priority?.title || "");

    if (/oil|pore|유분|모공/i.test(title)) {
      return isEnglish ? "Start with light surface control." : "가벼운 표면 정돈부터 시작합니다.";
    }

    if (/moisture|hydration|수분/i.test(title)) {
      return isEnglish ? "Keep moisture from dropping too easily." : "수분감이 쉽게 떨어지지 않게 관리합니다.";
    }

    if (/barrier|장벽/i.test(title)) {
      return isEnglish ? "Keep the skin steady against outside irritation." : "외부 자극에 흔들리지 않게 지켜줍니다.";
    }

    if (/irritation|sensitivity|redness|자극|민감|붉/i.test(title)) {
      return isEnglish ? "Lower the irritation burden first." : "자극 부담을 먼저 낮춥니다.";
    }

    return priority?.body || (isEnglish ? "Check this step first." : "이 항목을 먼저 확인합니다.");
  };

  return (
    <FreeResultV2Card className="p-4 sm:p-5">
      <p className="break-keep text-[1.05rem] font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
        {isEnglish ? "Care Priority TOP 3" : "지금 관리 우선순위 TOP 3"}
      </p>
      <div className="mt-3 overflow-hidden rounded-[1.25rem] border border-[#ead9d6] bg-white/30 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
        {displayPriorities.map((priority, index) => (
          <div key={priority.rank} className={index ? "border-t border-[#ead9d6] dark:border-[#5a3a48]" : ""}>
            <button
              type="button"
              onClick={() => setOpenRank((current) => (current === priority.rank ? null : priority.rank))}
              className="grid w-full grid-cols-[2.05rem_1.25rem_minmax(0,1fr)_1rem] items-center gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-white/32 dark:hover:bg-[#301f28]/54"
              aria-expanded={openRank === priority.rank}
            >
              <span className="flex h-[1.7rem] w-[1.7rem] shrink-0 items-center justify-center rounded-full bg-[#ff7d9b] text-[13px] font-semibold text-white shadow-[0_10px_20px_rgba(230,80,122,0.18)] dark:bg-[#ff8fa2] dark:text-[#25131d]">
                {priority.rank}
              </span>
              <span className="flex h-6 w-6 items-center justify-center text-[#e6507a] dark:text-[#ff9aa8]">
                <FreeResultV2PriorityIcon rank={priority.rank} />
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <p className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{priority.title}</p>
                {index === 0 ? (
                  <span className="rounded-full bg-[#ffe3e8] px-2 py-0.5 text-[11px] font-semibold text-[#d9416f] dark:bg-[#553043] dark:text-[#ff9aa8]">
                    {isEnglish ? "Core" : "핵심"}
                  </span>
                ) : null}
              </div>
              <span className={`text-sm leading-none text-[#b3949f] transition-transform dark:text-[#8f7480] ${openRank === priority.rank ? "rotate-90" : ""}`} aria-hidden="true">›</span>
            </button>
            <AnimatePresence initial={false}>
              {openRank === priority.rank ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="overflow-hidden"
                >
                  <p className="px-3.5 pb-3 pl-[4.85rem] pr-7 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
                    {getShortBody(priority)}
                  </p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </FreeResultV2Card>
  );
}

function FreeResultV2DiagnosisStep({ data, photoUrl, photoAlt, photoFallback, faceLabPreview = null, locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <FreeResultV2StepFrame
      title={isEnglish ? "Core Diagnosis" : "핵심 진단"}
    >
      <FreeResultV2DiagnosisSummaryCard
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        photoFallback={photoFallback}
        faceLabPreview={faceLabPreview}
        locale={locale}
      />
      <FreeResultV2SkinRadarCard data={data} locale={locale} />
      <FreeResultV2PriorityListCard priorities={data.priorities} locale={locale} />
    </FreeResultV2StepFrame>
  );
}

function FreeResultV2EvidenceStep({ evidence, photoUrl, photoAlt, photoFallback, locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <FreeResultV2StepFrame
      eyebrow={isEnglish ? "Diagnosis evidence" : "진단 근거"}
      title={isEnglish ? "Why this diagnosis?" : "왜 이렇게 판단했을까?"}
      body={isEnglish ? "We used photo analysis and survey answers together." : "사진 분석과 설문 답변을 함께 참고했습니다."}
    >
      <FreeResultV2EvidencePhotoCard
        photoUrl={photoUrl}
        photoAlt={photoAlt}
        fallback={photoFallback}
        locale={locale}
      />

      <FreeResultV2EvidenceSignalsCard
        photoSignals={evidence.photoSignals}
        surveySignals={evidence.surveySignals}
        locale={locale}
      />

      <FreeResultV2EvidenceBridge locale={locale} />
    </FreeResultV2StepFrame>
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

function FreeResultV2RoleCard({ role }) {
  const isPrimary = Boolean(role?.primary);
  const containerClass = isPrimary
    ? "border-[#ff9aa8]/52 bg-[#ff9aa8]/10 px-3.5 py-3.5 shadow-[0_0_24px_rgba(255,154,168,0.09)]"
    : "border-[#ead9d6] bg-white/34 px-3 py-2.5 dark:border-[#5a3a48] dark:bg-[#2a1b24]/74";
  const iconClass = isPrimary
    ? "h-11 w-11 border-[#ff9aa8]/46 bg-[#ff9aa8]/16 text-[#ff9aa8]"
    : "h-9 w-9 border-[#ff9aa8]/24 bg-[#ff9aa8]/10 text-[#d8a2b0]";
  const titleClass = isPrimary
    ? "text-base leading-6 text-[#26101a] dark:text-[#fff8f3]"
    : "text-sm leading-5 text-[#26101a] dark:text-[#fff8f3]";

  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-[1.05rem] border dark:border-[#5a3a48] ${containerClass}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-full border ${iconClass}`}>
        <FreeResultV2RoleIcon type={role.key} />
      </span>
      <span className="min-w-0">
        <span className={`block font-semibold ${titleClass}`}>{role.title}</span>
        <span className="mt-0.5 block text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{role.body}</span>
      </span>
    </div>
  );
}

function FreeResultV2CompactRoutineFlow({ title, steps = [], tone = "morning" }) {
  const safeSteps = steps.slice(0, 3);

  return (
    <div className="rounded-[1.25rem] border border-[#ead9d6] bg-white/42 p-3.5 dark:border-[#5a3a48] dark:bg-[#2a1b24]/76">
      <div className="flex items-center gap-2.5">
        <FreeResultV2RoutineIcon tone={tone} />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#26101a] dark:text-[#fff8f3]">{title}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1">
        {safeSteps.map((step, index) => (
          <div key={`${title}-${step}`}>
            <div className="grid grid-cols-[1.7rem_minmax(0,1fr)] items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#f2c4ca] bg-[#fff8f3] text-[10px] font-semibold text-[#e6507a] dark:border-[#6a4353] dark:bg-[#241720] dark:text-[#ff9aa8]">
                {index + 1}
              </span>
              <span className="break-keep text-sm font-semibold leading-5 text-[#3a1824] dark:text-[#f3e4df]">{step}</span>
            </div>
            {index < safeSteps.length - 1 ? (
              <div className="grid grid-cols-[1.7rem_minmax(0,1fr)] gap-2 py-0.5" aria-hidden="true">
                <span className="text-center text-xs leading-4 text-[#b17888] dark:text-[#d6a1af]">↓</span>
                <span />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function FreeResultV2Step3LockCard({ title, subLabel = "" }) {
  return (
    <div className="rounded-[1.05rem] border border-[#ead9d6] bg-white/34 px-3.5 py-3 dark:border-[#5a3a48] dark:bg-[#241720]/82">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/32 bg-[#ff9aa8]/10 text-[#ff9aa8]">
          <FreeResultV2LockIcon />
        </span>
        <div className="min-w-0">
          <p className="break-keep text-sm font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">{title}</p>
          {subLabel ? <p className="mt-0.5 text-xs font-semibold leading-5 text-[#e6507a] dark:text-[#ff9aa8]">{subLabel} →</p> : null}
        </div>
      </div>
    </div>
  );
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

function FreeResultV2RecommendationGuideStep({ preview, routinePreview, copy, locale = "ko" }) {
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

function FreeResultV2RoutineFlow({ title, steps = [], note = "", tone = "morning" }) {
  const safeSteps = steps.length ? steps : [title].filter(Boolean);

  return (
    <div className="rounded-[1.35rem] border border-[#ead9d6] bg-white/42 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]/74">
      <div className="flex items-center gap-3">
        <FreeResultV2RoutineIcon tone={tone} />
        <p className="text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">{title}</p>
      </div>
      <div className="relative mt-4">
        {safeSteps.length > 1 ? (
          <span className="absolute left-[14%] right-[14%] top-3 h-px bg-[#e7c5bc] dark:bg-[#6a4353]" />
        ) : null}
        <div
          className="relative grid gap-2"
          style={{ gridTemplateColumns: `repeat(${Math.max(safeSteps.length, 1)}, minmax(0, 1fr))` }}
        >
          {safeSteps.map((step, index) => (
            <div key={`${title}-${step}`} className="min-w-0 text-center">
              <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border border-[#f2c4ca] bg-[#fff8f3] text-[11px] font-semibold text-[#e6507a] shadow-[0_0_16px_rgba(230,80,122,0.12)] dark:border-[#6a4353] dark:bg-[#301f28] dark:text-[#ff9aa8]">
                {index + 1}
              </span>
              <span className="mt-2 flex min-h-[2.65rem] items-center justify-center rounded-[0.95rem] border border-[#ead9d6] bg-white/56 px-2 py-2 text-center text-[12px] font-semibold leading-4 text-[#3a1824] dark:border-[#6a4353] dark:bg-[#301f28] dark:text-[#f3e4df]">
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
      {safeSteps.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-[#b17888] dark:text-[#d6a1af]" aria-hidden="true">
          {safeSteps.map((step, index) => (
            <span key={`${title}-arrow-${step}`} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {index < safeSteps.length - 1 ? <span>→</span> : null}
            </span>
          ))}
        </div>
      ) : null}
      {note ? (
        <p className="mt-3 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{note}</p>
      ) : null}
    </div>
  );
}

function FreeResultV2RoutineFaceLabStep({ routinePreview, diagnosis = null, faceLabPreview = null, locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <FreeResultV2StepFrame
      eyebrow={isEnglish ? "Next step" : "다음 단계"}
      title={isEnglish ? "Routine direction preview" : "루틴 방향 미리보기"}
    >
      <FreeResultV2Card>
        <p className="text-[13px] font-semibold text-[#b3949f] dark:text-[#c8aeb8]">AM / PM</p>
        <div className="mt-4 grid gap-3">
          <FreeResultV2RoutineFlow
            title={isEnglish ? "Morning direction" : "아침 방향"}
            steps={routinePreview.morningSteps}
            note={routinePreview.morningNote}
            tone="morning"
          />
          <FreeResultV2RoutineFlow
            title={isEnglish ? "Night direction" : "저녁 방향"}
            steps={routinePreview.nightSteps}
            note={routinePreview.nightNote}
            tone="night"
          />
        </div>
        <p className="mt-4 text-center text-xs leading-5 text-[#9b7280] dark:text-[#9e7f8c]">
          {routinePreview.gateNote || (isEnglish ? "Detailed order and product placement are in the full report." : "세부 제품 순서와 사용 빈도는 전체 리포트에서 확인할 수 있어요.")}
        </p>
      </FreeResultV2Card>

      {diagnosis ? (
        <FreeResultV2Card>
          <p className="text-[13px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">{isEnglish ? "Recommendation direction" : "추천 방향"}</p>
          <p className="mt-3 text-base leading-8 text-[#3a1824] dark:text-[#f3e4df]">{diagnosis.directionLine}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {diagnosis.directionTags.map((tag) => (
              <FreeResultV2Pill key={tag}>{tag}</FreeResultV2Pill>
            ))}
          </div>
        </FreeResultV2Card>
      ) : null}

      <FreeResultV2FaceLabPreviewPanel faceLabPreview={faceLabPreview} locale={locale} />

      <FreeResultV2Card>
        <p className="text-[13px] font-semibold text-[#b3949f] dark:text-[#c8aeb8]">{isEnglish ? "Unlocked in the full report" : "전체 리포트에서 열리는 항목"}</p>
        <div className="mt-3 grid gap-2">
          <FreeResultV2LockRow label={isEnglish ? "Product operation guide" : "제품 운용법"} />
          <FreeResultV2LockRow label={isEnglish ? "Combinations to watch" : "주의할 조합"} />
        </div>
      </FreeResultV2Card>
    </FreeResultV2StepFrame>
  );
}

function FreeResultV2RecommendationValidationStep({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const [activeSignalTab, setActiveSignalTab] = useState("fit");
  const signalGroups = isEnglish
    ? [
        {
          key: "fit",
          label: "Good signs",
          icon: "comfort",
          items: [
            { key: "oil", title: "Afternoon shine rises more slowly", body: "A sign that oil and moisture are balancing better.", icon: "oil" },
            { key: "comfort", title: "Tightness after cleansing feels lower", body: "A sign that moisture is holding for longer.", icon: "comfort" },
            { key: "dry", title: "Cheek dryness feels calmer", body: "A sign that the moisture step is fitting without burden.", icon: "moisture" }
          ]
        },
        {
          key: "adjust",
          label: "Adjustment signs",
          icon: "signal",
          items: [
            { key: "dry", title: "Dryness gets stronger", body: "The moisture step may be insufficient or the amount may be too much.", icon: "moisture" },
            { key: "red", title: "Stinging or redness appears", body: "Active products may be irritating, so pause them for a bit.", icon: "signal" },
            { key: "cleanse", title: "Stronger cleansing increases", body: "Trying to control shine can disrupt the balance further.", icon: "oil" }
          ]
        }
      ]
    : [
        {
          key: "fit",
          label: "잘 맞는 신호",
          icon: "comfort",
          items: [
            { key: "oil", title: "오후 번들거림이 덜 빨리 올라옴", body: "유분과 수분 균형이 안정되는 쪽으로 가고 있다는 신호예요.", icon: "oil" },
            { key: "comfort", title: "세안 후 당김이 줄어듦", body: "수분감이 더 오래 유지되고 있다는 뜻이에요.", icon: "comfort" },
            { key: "dry", title: "볼 주변 건조감이 편해짐", body: "수분 보강이 피부에 부담 없이 이어지고 있어요.", icon: "moisture" }
          ]
        },
        {
          key: "adjust",
          label: "조정 신호",
          icon: "signal",
          items: [
            { key: "dry", title: "건조함이 심해짐", body: "수분 단계가 부족하거나 사용량이 과할 수 있어요.", icon: "moisture" },
            { key: "red", title: "따가움·붉어짐 발생", body: "기능성 제품이 자극이 될 수 있어 잠시 쉬는 편이 좋아요.", icon: "signal" },
            { key: "cleanse", title: "강한 세안이 늘어남", body: "번들거림을 잡는 과정에서 균형이 무너질 수 있어요.", icon: "oil" }
          ]
        }
      ];
  const activeSignalGroup = signalGroups.find((group) => group.key === activeSignalTab) || signalGroups[0];
  const lockedItems = isEnglish
    ? ["Situation adjustments", "Frequency guide", "Combinations to avoid", "Matched alternatives"]
    : ["상황별 조정법", "사용 빈도 가이드", "피해야 할 조합", "맞춤 대체 제품"];

  return (
    <FreeResultV2StepFrame
      title={isEnglish ? "Check If the Recommendation Fits" : "추천이 맞는지 확인하기"}
      body={isEnglish ? "These signs show whether the current recommendation fits your skin." : "이 신호를 보면 지금 추천이 내 피부에 맞고 있는지 알 수 있어요."}
    >
      <FreeResultV2Card className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-[1.15rem] border border-[#ead9d6] bg-white/28 p-1 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
          {signalGroups.map((group) => {
            const isActive = group.key === activeSignalGroup.key;
            return (
              <button
                key={group.key}
                type="button"
                onClick={() => setActiveSignalTab(group.key)}
                className={`inline-flex min-h-[2.65rem] items-center justify-center gap-2 rounded-[0.95rem] px-3 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[linear-gradient(135deg,#f45f88,#ff7b68)] text-white shadow-[0_14px_28px_rgba(230,80,122,0.22)]"
                    : "text-[#7a5360] hover:bg-white/40 dark:text-[#c8aeb8] dark:hover:bg-[#301f28]"
                }`}
                aria-pressed={isActive}
              >
                <FreeResultV2ManagementIcon type={group.icon} />
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="overflow-hidden rounded-[1.35rem] border border-[#ead9d6] bg-white/28 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
          {activeSignalGroup.items.map((item, index) => (
            <div key={item.key} className={`flex items-start gap-3 px-3.5 py-3.5 ${index ? "border-t border-[#ead9d6]/80 dark:border-[#5a3a48]" : ""}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                activeSignalGroup.key === "fit"
                  ? "border-[#8bd9b2]/30 bg-[#8bd9b2]/14 text-[#8bd9b2]"
                  : "border-[#ff8fa3]/32 bg-[#ff8fa3]/14 text-[#ff8fa3]"
              }`}>
                <FreeResultV2ManagementIcon type={item.icon} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item.title}</span>
                <span className="mt-1 block break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{item.body}</span>
              </span>
            </div>
          ))}
        </div>
      </FreeResultV2Card>

      <FreeResultV2Card className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/32 bg-[#ff9aa8]/10 text-[#ff9aa8]">
            <FreeResultV2LockIcon />
          </span>
          <div className="min-w-0">
            <p className="break-keep text-base font-semibold leading-6 text-[#26101a] dark:text-[#fff8f3]">
              {isEnglish ? "Unlocked in the full report" : "전체 리포트에서 열리는 내용"}
            </p>
            <p className="mt-1 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
              {isEnglish ? "Continue with sensitive-day changes and product frequency." : "민감해진 날부터 제품 사용 빈도까지 이어서 확인할 수 있어요."}
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-[1.15rem] border border-[#ead9d6] bg-white/28 dark:border-[#5a3a48] dark:bg-[#2a1b24]/66">
          {lockedItems.map((item) => (
            <div key={item} className="flex items-center gap-3 border-t border-[#ead9d6]/80 px-3.5 py-3 first:border-t-0 dark:border-[#5a3a48]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/28 bg-[#ff9aa8]/10 text-[#ff9aa8]">
                <FreeResultV2LockIcon />
              </span>
              <span className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item}</span>
            </div>
          ))}
        </div>
      </FreeResultV2Card>
    </FreeResultV2StepFrame>
  );
}

function FreeResultV2ReportValueStrip({ items = [] }) {
  return (
    <div className="relative mt-4 -mx-4 sm:-mx-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-5 bg-[linear-gradient(90deg,#fffaf6_0%,rgba(255,250,246,0)_100%)] dark:bg-[linear-gradient(90deg,#241720_0%,rgba(36,23,32,0)_100%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-5 bg-[linear-gradient(270deg,#fffaf6_0%,rgba(255,250,246,0)_100%)] dark:bg-[linear-gradient(270deg,#241720_0%,rgba(36,23,32,0)_100%)]" aria-hidden="true" />
      <div className="overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:px-5">
        <div className="flex w-max gap-2.5 pr-2">
          {items.map((item) => (
            <article
              key={item.key}
              className="flex h-[7.45rem] w-[8.35rem] shrink-0 flex-col rounded-[1rem] border border-[#ead9d6]/82 bg-white/24 px-3 py-3 shadow-[0_10px_24px_rgba(35,16,25,0.06)] dark:border-[#5a3a48]/82 dark:bg-[#2a1b24]/58 dark:shadow-none"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/28 bg-[#ff9aa8]/9 text-[#ff9aa8]">
                <FreeResultV2ExecutionGuideIcon type={item.icon} />
              </span>
              <p className="mt-2 break-keep text-[13px] font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{item.title}</p>
              <p className="mt-1 break-keep text-[11px] leading-[1.45] text-[#7a5360] dark:text-[#c8aeb8]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function FreeResultV2BlurredRoutinePreview({ locale = "ko" }) {
  const isEnglish = locale === "en";
  const rows = isEnglish
    ? ["Morning routine order", "Night routine order"]
    : ["아침 루틴 순서", "저녁 루틴 순서"];

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-[#ead9d6] bg-white/26 p-3 dark:border-[#5a3a48] dark:bg-[#2a1b24]/72">
      <div className="space-y-2 blur-[2.5px]">
        {rows.map((row, index) => (
          <div key={row} className="grid grid-cols-[2.8rem_minmax(0,1fr)_auto] items-center gap-3 rounded-[1rem] border border-[#ead9d6] bg-white/34 px-3 py-3 dark:border-[#5a3a48] dark:bg-[#241720]/80">
            <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${
              index ? "border-[#cda7ff]/32 bg-[#3a2340]/40 text-[#d8b6ff]" : "border-[#ff9a8a]/36 bg-[#ff9a8a]/10 text-[#ff9a8a]"
            }`}>
              <FreeResultV2RoutineModeIcon tone={index ? "night" : "morning"} />
            </span>
            <span className="min-w-0 break-keep text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{row}</span>
            <span className="text-[#b17888] dark:text-[#d6a1af]" aria-hidden="true">›</span>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-[#fffaf6]/28 backdrop-blur-[1px] dark:bg-[#241720]/30">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#ff9aa8]/34 bg-[#241720]/82 px-4 py-2 text-xs font-semibold text-[#fff8f3] shadow-[0_16px_34px_rgba(18,10,16,0.28)]">
          <FreeResultV2LockIcon />
          {isEnglish ? "Organized in the full report" : "전체 리포트에서 확인할 수 있어요"}
        </span>
      </div>
    </div>
  );
}

function FreeResultV2FullReportCompletionStep({ locale = "ko", onCtaClick = null }) {
  const isEnglish = locale === "en";
  const reportValueItems = isEnglish
    ? [
        { key: "order", icon: "order", title: "Routine order", body: "Follow the morning and night order as-is." },
        { key: "alternative", icon: "alternative", title: "Alternatives", body: "Check what to switch to if it does not fit." },
        { key: "avoid", icon: "avoid", title: "Avoid pairings", body: "Reduce irritation risk before it starts." },
        { key: "flare", icon: "flare", title: "Skin SOS", body: "Adjust the routine on rough skin days." },
        { key: "style", icon: "style", title: "Style expansion", body: "See Face Lab-based direction too." }
      ]
    : [
        { key: "order", icon: "order", title: "루틴 순서", body: "아침·저녁 순서를 그대로 따라가요" },
        { key: "alternative", icon: "alternative", title: "대체 제품", body: "안 맞을 때 바꿀 후보를 확인해요" },
        { key: "avoid", icon: "avoid", title: "피해야 할 조합", body: "자극 리스크를 미리 줄여요" },
        { key: "flare", icon: "flare", title: "피부 응급 대응", body: "뒤집힌 날 조정법을 확인해요" },
        { key: "style", icon: "style", title: "스타일 확장", body: "Face Lab 기반 방향까지 봐요" }
      ];

  return (
    <FreeResultV2StepFrame
      title={isEnglish ? "Full Report Complete" : "전체 리포트 완성"}
      body={isEnglish ? "The free result showed the direction. Now get the execution guide you can follow." : "무료 결과는 방향을 알려드렸어요. 이제 그대로 따라 할 실행 가이드를 받아보세요."}
    >
      <FreeResultV2Card className="space-y-4 overflow-hidden">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#ff9aa8]/34 bg-[#ff9aa8]/10 text-[#ff9aa8]">
            <FreeResultV2ExecutionGuideIcon type="order" />
          </span>
          <div className="min-w-0">
            <p className="break-keep text-xl font-semibold leading-7 text-[#26101a] dark:text-[#fff8f3]">
              {isEnglish ? "Your routine is ready" : "이미 준비된 내 루틴"}
            </p>
            <p className="mt-2 break-keep text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
              {isEnglish ? "Morning, night, switch options, and caution points are organized into one guide." : "아침·저녁 순서와 조정 포인트를 하나의 실행 가이드로 정리합니다."}
            </p>
          </div>
        </div>
        <FreeResultV2BlurredRoutinePreview locale={locale} />
      </FreeResultV2Card>

      <FreeResultV2Card className="overflow-hidden px-4 py-4 sm:px-5">
        <div>
          <p className="text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">
            {isEnglish ? "Organized into the full report" : "전체 리포트로 정리되는 것"}
          </p>
          <p className="mt-1 break-keep text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
            {isEnglish ? "The direction becomes concrete actions you can follow from today." : "방향 확인에서 끝나지 않도록, 오늘부터 할 행동으로 이어집니다."}
          </p>
        </div>
        <FreeResultV2ReportValueStrip items={reportValueItems} />
      </FreeResultV2Card>

      <div className="space-y-3">
        <button
          type="button"
          onClick={onCtaClick}
          className="ui-button-primary min-h-14 w-full bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] px-5 text-sm font-semibold !text-white shadow-[0_16px_34px_rgba(232,96,116,0.28)] hover:opacity-95"
        >
          {isEnglish ? "Get tonight's routine guide" : "오늘 밤부터 그대로 따라 할 루틴 받기"}
        </button>
        <p className="break-keep px-1 text-center text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">
          {isEnglish ? "Routine order, switch options, and caution points are organized together." : "루틴 순서, 바꿀 후보, 피해야 할 조합까지 함께 정리됩니다."}
        </p>
      </div>
    </FreeResultV2StepFrame>
  );
}

function SkinDashboardCard({ metrics = [], locale = "ko" }) {
  const isEnglish = locale === "en";
  const items = Array.isArray(metrics) ? metrics.slice(0, 5) : [];
  const primaryMetric = [...items].sort((a, b) => b.value - a.value)[0] || null;
  const secondaryMetrics = primaryMetric
    ? items.filter((metric) => metric.key !== primaryMetric.key)
    : items;
  const darkMetricColors = {
    hydration: "#d85f78",
    oil: "#e0705e",
    sensitivity: "#77b799",
    barrier: "#7b5063",
    tone: "#d18b7f"
  };
  const primaryDarkColor = primaryMetric ? darkMetricColors[primaryMetric.key] || "#d96c69" : "#d96c69";

  return (
    <section className="rounded-[2rem] border border-[#ead9d2] bg-[#fffaf5] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.18)] dark:border-[#4a303c] dark:bg-[#241720] sm:p-6">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2b101b] shadow-[0_12px_26px_rgba(52,20,35,0.08)] dark:bg-[#301f28] dark:text-[#fff8f3]">
          02
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7e5261] dark:text-[#c8aeb8]">SKIN DASHBOARD</p>
          <h2 className="mt-1 text-[1.8rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff8f3] sm:text-[2rem]">
            {isEnglish ? "Skin Dashboard" : "피부 상태 대시보드"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
            {isEnglish
              ? "Before the Top Pick, check the main skin signals briefly."
              : "Top Pick 전에 주요 피부 신호만 짧게 확인합니다."}
          </p>
        </div>
      </div>

      {primaryMetric ? (
        <div className="mt-6 overflow-hidden rounded-[1.65rem] border border-[#efcfc9] bg-[linear-gradient(135deg,rgba(255,255,255,0.78),rgba(255,232,231,0.76))] p-4 shadow-[0_18px_42px_rgba(80,28,46,0.12)] dark:border-[#5a3a48] dark:bg-[linear-gradient(135deg,rgba(55,35,47,0.96),rgba(40,25,34,0.96))]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#c8aeb8]">
                  {isEnglish ? "Main signal" : "대표 지표"}
                </p>
                <span className="rounded-full border border-[#e7c5bc] bg-white/72 px-2.5 py-1 text-[11px] font-semibold text-[#8a4c5d] dark:border-[#6a4353] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {primaryMetric.status}
                </span>
              </div>
              <p className="mt-2 text-[1.55rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff8f3]">
                {primaryMetric.label}
              </p>
              <p className="mt-2 max-w-[26rem] text-sm leading-6 text-[#6f4a56] dark:text-[#d8c2c9]">{primaryMetric.description}</p>
            </div>
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center self-center rounded-full bg-[#fff7f2] shadow-inner dark:bg-[#301f28]">
              <span
                className="absolute inset-0 rounded-full dark:hidden"
                style={{ background: `conic-gradient(${primaryMetric.color} ${primaryMetric.value * 3.6}deg, rgba(234,217,210,0.75) 0deg)` }}
              />
              <span
                className="absolute inset-0 hidden rounded-full dark:block"
                style={{ background: `conic-gradient(${primaryDarkColor} ${primaryMetric.value * 3.6}deg, rgba(74,48,60,0.88) 0deg)` }}
              />
              <span className="relative flex h-[4.9rem] w-[4.9rem] flex-col items-center justify-center rounded-full bg-white text-[#26101a] dark:bg-[#241720]">
                <span className="text-2xl font-semibold leading-none dark:text-[#e87a68]">{primaryMetric.value}</span>
                <span className="mt-0.5 text-[10px] font-medium text-[#8b6370] dark:text-[#d59a91]">/100</span>
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2.5">
        {secondaryMetrics.map((metric) => (
          <div key={metric.key} className="rounded-[1.15rem] border border-[#ead9d2] bg-white/48 px-3.5 py-3 dark:border-[#5a3a48] dark:bg-[#2a1b24]/88">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: metric.color }} />
                  <p className="text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{metric.label}</p>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#7a5360] dark:text-[#c8aeb8]">{metric.description}</p>
              </div>
              <div className="flex min-w-[4.9rem] shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold leading-none text-[#26101a] dark:text-[#fff8f3]">{metric.value}</span>
                <span className="rounded-full border border-[#e7c5bc] bg-white/72 px-2.5 py-0.5 text-[10px] font-medium text-[#8a4c5d] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]">
                  {metric.status}
                </span>
              </div>
            </div>
            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e7dcda] dark:bg-[#3a2630]">
              <div
                className="h-full rounded-full"
                style={{ width: `${metric.value}%`, backgroundColor: metric.color }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
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

function RoutineFlowCard({ sections = [], directionCards = [], warnings = [], emptyText, warningsLabel, locale = "ko" }) {
  const isEnglish = locale === "en";
  const visibleSections = sections.length
    ? sections
    : directionCards.map((card) => ({
        key: card.key,
        label: card.label,
        meta: isEnglish ? "Routine direction" : "루틴 방향",
        strategy: card.body,
        items: [card.body].filter(Boolean)
      }));

  return (
    <section className="rounded-[2rem] border border-[#ead9d2] bg-[#fff8ef] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.16)] dark:border-[#4a303c] dark:bg-[#241720]">
      <div className="space-y-4">
        {visibleSections.length ? (
          <div className="grid gap-3">
            {visibleSections.map((section) => (
              <div key={`routine-flow-${section.key}`} className="rounded-[1.45rem] border border-[#ead9d2] bg-white/58 p-4 dark:border-[#5a3a48] dark:bg-[#2a1b24]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#e6507a] dark:text-[#ff9aa8]">{section.meta}</p>
                    <h3 className="mt-1 text-base font-semibold text-[#26101a] dark:text-[#fff8f3]">{section.label}</h3>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#ead9d2] bg-[#fff4f1] text-sm font-semibold text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#fff8f3]">
                    {section.key === "night" ? "PM" : "AM"}
                  </span>
                </div>

                <div className="mt-4 grid gap-2">
                  {section.items.map((item, index) => (
                    <div key={`${section.key}-${item}-${index}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-2 rounded-[1rem] border border-[#efc5bd] bg-[#fffaf6] px-3 py-2.5 shadow-[0_8px_20px_rgba(128,58,44,0.07)] dark:border-[#563746] dark:bg-[#301f28] dark:shadow-none">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#f0d2cb] bg-white text-[11px] font-semibold text-[#e6507a] shadow-[0_3px_10px_rgba(230,80,122,0.12)] dark:border-[#4a303c] dark:bg-[#241720] dark:text-[#ff9aa8] dark:shadow-none">
                        {index + 1}
                      </span>
                      <p className="text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">{item}</p>
                    </div>
                  ))}
                </div>

                {section.strategy && !section.items.includes(section.strategy) ? (
                  <p className="mt-3 rounded-[1rem] border border-[#ead9d2] bg-white/45 px-3 py-2 text-xs leading-5 text-[#7a5360] dark:border-[#5a3a48] dark:bg-[#251820] dark:text-[#c8aeb8]">
                    {section.strategy}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.4rem] bg-white/60 px-4 py-4 text-sm leading-6 text-[#69424f] dark:bg-[#2f202a] dark:text-[#c8aeb8]">
            {emptyText}
          </div>
        )}

        <div className="rounded-[1.45rem] border border-[#ead9d2] bg-white/58 p-4 dark:border-[#6a4a25] dark:bg-[#3a2818]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#f2c879]">
            {warningsLabel}
          </p>
          <div className="mt-3 space-y-2.5">
            {(warnings.length ? warnings : [
              isEnglish
                ? "Keep the routine simple first and add new steps one at a time."
                : "처음에는 루틴을 단순하게 두고 새 단계는 하나씩만 추가하세요."
            ]).map((warning, index) => (
              <p key={`routine-warning-${index}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">
                <span className="text-[#ff8068]">!</span>
                <span>{warning}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function PhotoObservationCard({ observations, copy, locale = "ko" }) {
  const normalized = normalizePhotoObservationsForDisplay(observations, copy, locale);
  const alignment = normalized.surveyAlignment;
  const showAlignmentNote = ["mixed", "conflict"].includes(alignment.status) && alignment.note;

  return (
    <section className="rounded-[2rem] border border-[#e9d9d3] bg-[#fffaf5] p-5 shadow-[0_24px_70px_rgba(35,16,25,0.18)] dark:border-[#4a303c] dark:bg-[#241720]">
      <div className="flex items-start gap-4">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-[#2b101b] shadow-[0_12px_26px_rgba(52,20,35,0.08)] dark:bg-[#301f28] dark:text-[#fff8f3]">
          02
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#7e5261] dark:text-[#c8aeb8]">SKIN DASHBOARD</p>
          <h2 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-tight text-[#26101a] dark:text-[#fff8f3]">
            {locale === "en" ? "Skin Dashboard" : "피부 상태 대시보드"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#69424f] dark:text-[#c8aeb8]">
            {normalized.summary || copy.photoObservationFallback}
          </p>
        </div>
      </div>

      {normalized.signals.length ? (
        <div className="mt-5 grid gap-3">
          {normalized.signals.map((signal, index) => {
            const title = buildPhotoObservationSignalTitle(signal);
            const isLowConfidence = signal.confidence === "low";

            return (
              <div
                key={`${signal.key || "photo"}-${title}-${index}`}
                className={`rounded-[1.15rem] border px-4 py-3 ${
                  isLowConfidence
                    ? "border-[#ead9d6] bg-white/50 text-[#8c6874] dark:border-[#5a3a48] dark:bg-[#2b1c26] dark:text-[#c8aeb8]"
                    : "border-[#e7cfc8] bg-white/80 text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f3e4df]"
                }`}
              >
                <p className="text-sm font-semibold leading-5 text-[#26101a] dark:text-[#fff8f3]">{title}</p>
                {signal.description ? (
                  <p className="mt-1.5 text-sm leading-6">{signal.description}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {showAlignmentNote ? (
        <p className="mt-4 rounded-[1rem] border border-[#ead9d6] bg-white/60 px-3 py-3 text-xs leading-5 text-[#69424f] dark:border-[#5a3a48] dark:bg-[#2f202a] dark:text-[#c8aeb8]">
          {alignment.note}
        </p>
      ) : null}
    </section>
  );
}

function ResultPreviewThumb({ type = "routine" }) {
  const baseClass = "relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.05rem] border border-[#ff9aa8]/32 bg-[#fff8f3]/76 shadow-[0_12px_28px_rgba(128,58,78,0.11)] dark:border-[#704557] dark:bg-[#301f28]";

  if (type === "variants") {
    return (
      <div className={baseClass} aria-hidden="true">
        <div className="absolute inset-2 grid grid-cols-2 gap-1.5">
          <span className="rounded-[0.55rem] border border-[#f0c9c8] bg-[#ffe9e4] dark:border-[#765065] dark:bg-[#3a2630]" />
          <span className="rounded-[0.55rem] border border-[#f0c9c8] bg-white/88 dark:border-[#765065] dark:bg-[#251820]" />
          <span className="rounded-[0.55rem] border border-[#f0c9c8] bg-white/88 dark:border-[#765065] dark:bg-[#251820]" />
          <span className="rounded-[0.55rem] border border-[#ff9aa8]/46 bg-[#ffe2eb] dark:border-[#ff9aa8]/30 dark:bg-[#442631]" />
        </div>
      </div>
    );
  }

  if (type === "compare") {
    return (
      <div className={baseClass} aria-hidden="true">
        <div className="absolute inset-x-2 top-2 grid grid-cols-2 gap-1.5">
          <span className="h-6 rounded-[0.6rem] bg-[#ffe2eb] dark:bg-[#442631]" />
          <span className="h-6 rounded-[0.6rem] bg-white/86 dark:bg-[#251820]" />
        </div>
        <span className="absolute bottom-5 left-2 right-2 h-1.5 rounded-full bg-[#ead9d6] dark:bg-[#4a303c]" />
        <span className="absolute bottom-5 left-2 h-1.5 w-8 rounded-full bg-[#ff9aa8]" />
        <span className="absolute bottom-2 left-2 right-2 h-1.5 rounded-full bg-[#ead9d6] dark:bg-[#4a303c]" />
        <span className="absolute bottom-2 left-2 h-1.5 w-11 rounded-full bg-[#ff8068]" />
      </div>
    );
  }

  if (type === "avoid") {
    return (
      <div className={baseClass} aria-hidden="true">
        <span className="absolute left-3 top-3 h-10 w-10 rounded-full border border-[#ff9aa8]/60" />
        <span className="absolute left-[18px] top-[31px] h-px w-9 rotate-45 bg-[#ff8068]" />
        <span className="absolute left-[18px] top-[31px] h-px w-9 -rotate-45 bg-[#ff8068]" />
        <span className="absolute bottom-3 left-3 h-1.5 w-7 rounded-full bg-[#ead9d6] dark:bg-[#4a303c]" />
        <span className="absolute bottom-3 right-3 h-1.5 w-3 rounded-full bg-[#ff9aa8]" />
      </div>
    );
  }

  if (type === "face-lab") {
    return (
      <div className={baseClass} aria-hidden="true">
        <span className="absolute left-1/2 top-2 h-9 w-8 -translate-x-1/2 rounded-[42%] border border-[#ff9aa8]/68 bg-[#ffeaf0]/42 dark:bg-[#3a2630]" />
        <span className="absolute left-[21px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
        <span className="absolute right-[21px] top-[18px] h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
        <span className="absolute bottom-4 left-4 right-4 h-px bg-[#ff9aa8]/68" />
        <span className="absolute bottom-2 left-6 right-6 h-px bg-[#ff8068]/64" />
      </div>
    );
  }

  return (
    <div className={baseClass} aria-hidden="true">
      <div className="absolute inset-2 flex flex-col justify-between">
        <div className="flex items-center gap-1.5">
          <span className="w-5 text-[8px] font-semibold text-[#e6507a] dark:text-[#ff9aa8]">AM</span>
          <span className="h-1.5 flex-1 rounded-full bg-[#ff9aa8]" />
          <span className="h-1.5 w-3 rounded-full bg-[#ffcabd]" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 text-[8px] font-semibold text-[#9b6bd8] dark:text-[#d8b6ff]">PM</span>
          <span className="h-1.5 flex-1 rounded-full bg-[#d8b6ff]" />
          <span className="h-1.5 w-4 rounded-full bg-[#f0c9ff]" />
        </div>
        <span className="h-5 rounded-[0.65rem] border border-[#ead9d6] bg-white/72 dark:border-[#5a3a48] dark:bg-[#251820]" />
      </div>
    </div>
  );
}

function ResultPreviewLargeVisual({ type = "routine" }) {
  if (type === "variants") {
    return (
      <div className="relative mt-4 h-28 overflow-hidden rounded-[1rem] border border-[#ff9aa8]/18 bg-[linear-gradient(180deg,rgba(255,154,168,0.12),rgba(36,23,32,0.18))]" aria-hidden="true">
        <div className="absolute left-5 right-5 top-4 flex items-center justify-center gap-3 text-[#ff9aa8]">
          <span className="text-base leading-none">≋</span>
          <span className="h-9 w-9 rounded-full border border-[#ff9aa8]/30 bg-[#ff9aa8]/16">
            <span className="mx-auto mt-3 block h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
            <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-[#ff9aa8]" />
          </span>
          <span className="h-9 w-9 rounded-full border border-[#c9b6ff]/26 bg-[#c9b6ff]/14">
            <span className="mx-auto mt-2.5 block h-4 w-3 rounded-b-full rounded-t-[60%] bg-[#c9b6ff]/70" />
          </span>
        </div>
        <div className="absolute bottom-3 left-6 right-6 flex items-end justify-center gap-4">
          <span className="h-12 w-6 rounded-t-[0.55rem] bg-white/62 dark:bg-white/48" />
          <span className="h-9 w-5 rounded-t-[0.45rem] bg-[#f3c9d2]/72" />
          <span className="h-11 w-5 rounded-t-[0.45rem] bg-white/56 dark:bg-white/40" />
          <span className="h-6 w-9 rounded-[0.35rem] bg-[#ffcabd]/62" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative mt-4 h-28 overflow-hidden rounded-[1rem] border border-[#ff9aa8]/18 bg-[linear-gradient(180deg,rgba(255,154,168,0.12),rgba(36,23,32,0.18))]" aria-hidden="true">
      <div className="absolute left-5 top-4 flex items-center gap-3">
        <span className="rounded-full bg-[#ff8068]/26 px-3 py-1 text-[11px] font-semibold text-[#ffd0ca]">AM</span>
        <span className="h-px w-7 border-t border-dashed border-[#ff9aa8]/45" />
        <span className="rounded-full bg-[#8d79ff]/22 px-3 py-1 text-[11px] font-semibold text-[#d8d1ff]">PM</span>
      </div>
      <div className="absolute bottom-3 left-5 right-5 flex items-end justify-between">
        <span className="h-12 w-6 rounded-t-[0.55rem] bg-white/60 dark:bg-white/46" />
        <span className="h-9 w-5 rounded-t-[0.45rem] bg-[#f3c9d2]/72" />
        <span className="h-16 w-7 rounded-t-[0.5rem] bg-white/78" />
        <span className="h-5 w-9 rounded-[0.35rem] bg-[#d8b6ff]/52" />
        <span className="h-8 w-6 rounded-t-[0.45rem] bg-white/60 dark:bg-white/44" />
        <span className="h-14 w-7 rounded-t-[0.55rem] bg-[#ffb49d]/70" />
      </div>
    </div>
  );
}

function ResultPreviewHighlightCard({ section, index, locale = "ko" }) {
  const isEnglish = locale === "en";
  const footnote = section.previewType === "variants"
    ? (isEnglish ? "Shows how to reduce the routine when needed." : "루틴을 어떻게 줄일지 정리됩니다.")
    : (isEnglish ? "Product order and frequency are organized together." : "제품 순서와 사용 빈도까지 정리됩니다.");

  return (
    <div className="rounded-[1.45rem] border border-[#ff9aa8]/34 bg-[#fbf2ee]/76 p-4 shadow-[0_18px_42px_rgba(128,58,78,0.11)] dark:border-[#8b4d63] dark:bg-[#321d2a]">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9b2c0]/58 text-sm font-semibold text-[#6a3344] dark:bg-[#ff9aa8]/18 dark:text-[#ffd0d8]">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{section.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#7a5360] dark:text-[#c8aeb8]">{section.body}</p>
        </div>
      </div>
      <ResultPreviewLargeVisual type={section.previewType || section.key} />
      <div className="mt-3 flex items-center justify-between gap-3 text-xs leading-5 text-[#7a5360] dark:text-[#d8c2c9]">
        <span>{footnote}</span>
        <span className="shrink-0 text-[#9b7280] dark:text-[#d6a1af]">
          <FreeResultV2LockIcon />
        </span>
      </div>
    </div>
  );
}

function ResultPreviewLockedRow({ section }) {
  return (
    <div className="rounded-[1.1rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/58 px-4 py-3 dark:border-[#704557] dark:bg-[#2a1823]">
      <div className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3">
        <ResultPreviewThumb type={section.previewType || section.key} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{section.title}</p>
          <p className="mt-1 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{section.body}</p>
        </div>
        <span className="shrink-0 text-[#9b7280] dark:text-[#d6a1af]">
          <FreeResultV2LockIcon />
        </span>
      </div>
    </div>
  );
}

function ResultPreviewMaskCard({ copy, sections = [], ctaLabel = "", onCtaClick = null }) {
  const visibleSections = Array.isArray(sections)
    ? sections
        .map((section) => ({
          ...section,
          body: String(section?.body || "").trim()
        }))
        .filter((section) => section.title && section.body)
    : [];

  if (!visibleSections.length) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-[rgba(120,70,70,0.14)] bg-[linear-gradient(145deg,#fff4ef_0%,#f6ece8_52%,#ffe1e5_100%)] p-5 text-[#28121b] shadow-[0_24px_70px_rgba(79,36,50,0.13)] dark:border-[#704557] dark:bg-[linear-gradient(135deg,#341f2c_0%,#2a1823_58%,#241720_100%)] dark:text-[#fff8f3] dark:shadow-[0_28px_80px_rgba(18,10,16,0.34)]">
      <div className="space-y-5">
        <div className="rounded-[1.6rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/70 p-5 text-center dark:border-[#704557] dark:bg-[#2a1823]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[#ff9aa8]/45 bg-white/58 text-2xl text-[#ff8068] shadow-[0_0_28px_rgba(255,128,104,0.22)] dark:bg-[#301f28]">
            ✓
          </div>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(120,70,70,0.18)] bg-[#fff8f3] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#6a3344] dark:border-[#704557] dark:bg-[#301f28] dark:text-[#f2c879]">
            Premium Report
          </span>
          <p className="mt-3 text-lg font-semibold tracking-tight text-[#28121b] dark:text-[#fff8f3]">{copy.routinePreviewTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[#7a5360] dark:text-[#c8aeb8]">
            {copy.premiumCardBody}
          </p>
        </div>

        <div className="grid gap-3">
          {visibleSections.map((section, index) => (
            <div
              key={section.key || section.title}
              className="rounded-[1.25rem] border border-[rgba(120,70,70,0.14)] bg-[#fbf2ee]/72 px-4 py-3.5 dark:border-[#704557] dark:bg-[#2a1823]"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.9rem] bg-[#ead0c8] text-[11px] font-semibold text-[#6a3344] dark:bg-white/10 dark:text-white/80">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#28121b] dark:text-[#fff8f3]">{section.title}</p>
                  <p className="mt-1.5 text-xs leading-5 text-[#6f4a56] dark:text-[#c8aeb8]">{section.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {ctaLabel && onCtaClick ? (
          <button
            type="button"
            onClick={onCtaClick}
            className="ui-button-primary min-h-14 w-full bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] px-5 text-sm font-semibold !text-white shadow-[0_16px_34px_rgba(232,96,116,0.28)] hover:opacity-95"
          >
            {ctaLabel}
          </button>
        ) : null}
      </div>
    </section>
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

function ProductDecisionCard({
  product,
  featured = false,
  form = null,
  decision = null,
  locale = "ko",
  detailItems = [],
  allowExpand = true,
  showDiagnostics = true
}) {
  const [expanded, setExpanded] = useState(false);
  const copy = getResultCopy(locale);

  if (featured) {
    const topPickHeadline = getTopPickHeadline(form, decision, locale);
    const topPickSummary = getTopPickSummary(product, form, decision, locale);
    const especiallyGoodFor = getEspeciallyGoodFor(product, form, locale);
    const purchaseLink = getPurchaseLinkInfo(product, locale);
    const priceLabel = getPriceLabel(product.price_range, locale);
    const topPickTags = buildTopPickDisplayTags(product, form, decision, locale);
    const detailLines = getProductReasonSentences(product, locale);
    const topPickBullets = buildTopPickReasonBullets(product, form, decision, locale);
    const aiTip = buildTopPickAITip(product, form, decision, locale);

    return (
      <div
        className="overflow-hidden rounded-[2.15rem] border border-[#eadbd7] bg-[linear-gradient(145deg,#fffaf7_0%,#fff6f1_58%,#fff1ee_100%)] shadow-[0_24px_70px_rgba(50,18,33,0.14)] dark:border-[#4a303c] dark:bg-[linear-gradient(145deg,#241720_0%,#261923_64%,#2a1b25_100%)]"
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
        <div className="px-5 py-6 sm:px-7 sm:py-7">
          <div className={showDiagnostics ? "grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start" : ""}>
            <div className="min-w-0">
              {topPickTags.length ? (
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {topPickTags.map((label) => (
                    <span
                      key={`${product.id}-top-tag-${label}`}
                      className="rounded-full border border-[#ead9d6] bg-white/42 px-2.5 py-1 text-[10px] font-medium text-[#6a4652] dark:border-[#4f3340] dark:bg-transparent dark:text-[#d8c2c9]"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-4 grid gap-4">
                <div className="min-w-0 space-y-3">
                  <p className="break-keep text-xs font-semibold uppercase tracking-[0.16em] text-[#d94f70] dark:text-[#ee8f9d]">{topPickHeadline}</p>
                  <h2 className="max-w-[21rem] break-keep text-[1.35rem] font-semibold leading-[1.2] tracking-tight text-[#26101a] dark:text-[#fff8f3] sm:text-[1.55rem]">
                    {product.name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#69424f] dark:text-[#c8aeb8]">
                    <span className="font-semibold">{product.brand}</span>
                    {priceLabel ? <span className="text-[#8b6370] dark:text-[#a98792]">{priceLabel}</span> : null}
                  </div>
                </div>
                <div className="mx-auto w-full max-w-[184px] opacity-95">
                  <SmallProductThumb product={product} height="h-36" locale={locale} elevated />
                </div>
              </div>

              <p className="mt-4 border-t border-[#ead9d6] pt-3 text-sm leading-6 text-[#3a1824] dark:border-[#4a303c] dark:text-[#f3e4df]">
                <span className="font-semibold text-[#8f4b5d] dark:text-[#e798a4]">{copy.especiallyGoodFor}</span>
                {" "}
                <span>{especiallyGoodFor}</span>
              </p>

              <div className="mt-4 border-t border-[#ead9d6] pt-3 dark:border-[#4a303c]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7e5261] dark:text-[#c8aeb8]">
                  {locale === "en" ? "Why this fits" : "추천 이유"}
                </p>
                <div className="mt-2.5 grid gap-2">
                  {topPickBullets.map((line) => (
                    <p key={`${product.id}-bullet-${line}`} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2 border-t border-[#f4e4df] py-2.5 text-sm leading-5 text-[#3a1824] first:border-t-0 first:pt-0 dark:border-[#35242e] dark:text-[#f3e4df]">
                      <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ffe4e7] text-[10px] font-semibold text-[#ef6387] dark:bg-[#4a2a37]">✓</span>
                      <span className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{line}</span>
                    </p>
                  ))}
                </div>
              </div>

              <div className="mt-3 border-t border-[#ead9d6] pt-3 dark:border-[#4a303c]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8b6370] dark:text-[#cf7b86]">AI Tip</p>
                <p className="mt-1.5 text-sm leading-5 text-[#4f2a36] dark:text-[#f0d6d1]">{aiTip}</p>
              </div>

              <div className="mt-5 border-t border-[#ead9d6] pt-4 dark:border-[#4a303c]">
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
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[#df9b97] bg-[linear-gradient(90deg,rgba(239,99,135,0.10),rgba(255,128,104,0.16))] px-5 text-sm font-semibold text-[#8f3d53] shadow-[0_10px_24px_rgba(185,72,88,0.10)] transition hover:border-[#d77f88] hover:shadow-[0_14px_30px_rgba(239,99,135,0.16)] dark:border-[#724757] dark:bg-[linear-gradient(90deg,rgba(239,99,135,0.13),rgba(255,128,104,0.11))] dark:text-[#f1a3ae] dark:shadow-[0_12px_30px_rgba(0,0,0,0.22)] dark:hover:border-[#875265] dark:hover:shadow-[0_14px_34px_rgba(239,99,135,0.12)]"
                >
                  {purchaseLink.label}
                </a>
              </div>

            {allowExpand ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((current) => !current);
                }}
                className="mt-4 text-sm font-medium text-[#5e3140] underline decoration-[#d9aaa2] underline-offset-4 dark:text-[#f4d7df] dark:decoration-[#8f596a]"
              >
                {expanded ? copy.less : copy.more}
              </button>
            ) : null}

            {allowExpand && expanded ? (
              <div className="mt-4 space-y-4 rounded-[1.4rem] border border-[#ead9d6] bg-white/70 p-4 dark:border-[#5a3a48] dark:bg-[#2f202a]">
                {detailItems.length ? (
                  <div className="flex flex-wrap gap-2">
                    {detailItems.map((item) => (
                      <span
                        key={`${product.id}-detail-item-${item}`}
                        className="rounded-full border border-[#e9d4cf] bg-white/70 px-3 py-1.5 text-[11px] font-medium text-[#3a1824] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
                <p className="text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">{topPickSummary}</p>
                {detailLines.length ? (
                  <div className="space-y-2">
                    {detailLines.map((line) => (
                      <p key={`${product.id}-detail-${line}`} className="text-sm leading-6 text-[#3a1824] dark:text-[#f3e4df]">
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
            </div>

            {showDiagnostics ? (
              <div className="ui-card-subtle p-3.5">
                <FitGaugeRows product={product} form={form} compact locale={locale} />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const purchaseLink = getPurchaseLinkInfo(product, locale);
  const priceLabel = getPriceLabel(product.price_range, locale);
  const productStepLabel = getProductStepLabel(product, locale);
  const cardTags = [productStepLabel, ...getTopPickSignalLabels(product, locale).slice(0, 1)].filter(Boolean).slice(0, 2);
  const previewLine = getProductPreviewLines(product, 1, locale)[0] || getEspeciallyGoodFor(product, form, locale);
  const detailLines = getProductReasonSentences(product, locale);

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
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{productStepLabel}</p>
          <p className="mt-2 break-words text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{product.name}</p>
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
            {allowExpand ? (
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
            ) : null}
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

      {allowExpand && expanded ? (
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
                <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{productStepLabel}</p>
                <h3 className="mt-2 break-words text-xl font-semibold leading-snug tracking-tight text-zinc-900 dark:text-zinc-100">{product.name}</h3>
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
                {showDiagnostics ? (
                  <div className="ui-card-subtle rounded-[1.1rem] p-3">
                    <FitGaugeRows product={product} form={form} compact locale={locale} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

