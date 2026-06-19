"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ErrorState from "@/components/common/ErrorState";
import ResultBottomCTA from "@/components/result/ResultBottomCTA";
import TodayStartPlanStep from "@/components/full-report/TodayStartPlanStep";
import CurrentProductSlotNote from "@/components/result/premium/CurrentProductSlotNote";
import CurrentProductsSummaryCard from "@/components/result/premium/CurrentProductsSummaryCard";
import AuthNav from "@/components/auth/AuthNav";
import AppHamburgerMenu from "@/components/navigation/AppHamburgerMenu";
import PremiumReportLoadingPage from "./loading/page";
import {
  buildFaceLabLaunchData,
  formatFaceLabDisplayList,
  formatFaceLabDisplayText
} from "@/lib/face-lab-launch";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { buildCurrentProductRoutineSlots } from "@/lib/current-products";
import { getBrowserSupabaseAccessToken } from "@/lib/supabase/browser-client";
import { readWriteAccessToken } from "@/lib/write-access-client";

const TRACKING_SESSION_KEY = "skinTestTrackingSessionId";
const LAST_REPORT_URL_KEY = "lastReportUrl";
const LAST_VIEWED_AT_KEY = "lastViewedAt";
const FULL_REPORT_OPENED_AT_KEY = "fullReportOpenedAt";
const LAST_FULL_REPORT_TAB_KEY = "lastFullReportTab";
const SKIN_MATCH_SECTION_ORDER = [
  "today-start-hub",
  "morning-routine",
  "product-plan",
  "adjustment-guide",
  "avoid-list"
];
const IS_DEVELOPMENT = process.env.NODE_ENV === "development";
const PREMIUM_REPORT_ENABLED =
  IS_DEVELOPMENT || process.env.NEXT_PUBLIC_PREMIUM_REPORT_ENABLED === "true";
const PREMIUM_REPORT_COMING_SOON_COPY = {
  ko: {
    title: "Skin Match 유료 리포트 준비 중입니다",
    body: "아침·저녁 루틴, 기능성 판단, 컨디션 대응까지 한 번에 볼 수 있는 퍼스널 피부 상담 맵을 정리하고 있어요.",
    button: "무료 결과 다시 보기",
    eyebrow: "Premium Report"
  },
  en: {
    title: "Skin Match paid report is coming soon",
    body: "We are organizing a personal skin consultation map that brings morning and evening routine, active checks, and condition responses together.",
    button: "Back to free result",
    eyebrow: "Premium Report"
  }
};

function FullReportLightThemeStyles() {
  return (
    <style>{`
      html:not(.dark) .full-report-light-theme.ui-page {
        background:
          radial-gradient(circle at 50% 0%, rgba(255, 248, 243, 0.96) 0%, rgba(246, 236, 232, 0.96) 42%, rgba(236, 218, 211, 0.95) 100%);
        color: #2b1f26;
      }

      html:not(.dark) .full-report-light-theme .ui-card {
        background: linear-gradient(180deg, #fffaf7 0%, #fff4f1 100%);
        border-color: #ead8cf;
        color: #2b1f26;
        box-shadow: 0 18px 48px rgba(102, 54, 62, 0.08);
      }

      html:not(.dark) .full-report-light-theme .ui-card-subtle,
      html:not(.dark) .full-report-light-theme .ui-card-muted {
        background: #fff8f3;
        border-color: #ead8cf;
        color: #2b1f26;
      }

      html:not(.dark) .full-report-light-theme .ui-title {
        color: #2b1f26;
      }

      html:not(.dark) .full-report-light-theme .ui-text-secondary {
        color: #7a6268;
      }

      html:not(.dark) .full-report-light-theme .ui-kicker {
        color: #8a5260;
      }

      html:not(.dark) .full-report-light-theme .ui-chip-compact {
        background: rgba(255, 250, 247, 0.86);
        border-color: #e4c9bf;
        color: #6f3f4b;
      }

      html:not(.dark) .full-report-light-theme .ui-button-secondary {
        background: rgba(255, 250, 247, 0.86);
        border-color: #ddbfb5;
        color: #4a2b34;
      }

      html:not(.dark) .full-report-light-theme .ui-button-secondary:hover {
        background: rgba(255, 128, 104, 0.08);
        border-color: #d7aa9d;
      }

      html:not(.dark) .full-report-light-theme .ui-choice-active {
        background: linear-gradient(135deg, #ef6387 0%, #ff8068 100%);
        border-color: transparent;
        color: #fffaf7;
        box-shadow: 0 12px 28px rgba(239, 99, 135, 0.2);
      }

      html:not(.dark) .full-report-light-theme .ui-button-secondary.ui-choice-active,
      html:not(.dark) .full-report-light-theme .ui-button-secondary.ui-choice-active:hover,
      html:not(.dark) .full-report-light-theme .ui-button-secondary.ui-choice-active:focus,
      html:not(.dark) .full-report-light-theme .ui-button-secondary.ui-choice-active:active {
        background: linear-gradient(135deg, #ef6387 0%, #ff8068 100%);
        border-color: transparent;
        color: #fffaf7;
        box-shadow: 0 12px 28px rgba(239, 99, 135, 0.2);
      }

      html:not(.dark) .full-report-light-theme .full-report-tab-active,
      html:not(.dark) .full-report-light-theme .full-report-tab-active:hover {
        background: linear-gradient(135deg, #ec4f79 0%, #ff735d 100%);
        border-color: rgba(255, 250, 247, 0.7);
        color: #fffaf7;
        box-shadow:
          0 14px 30px rgba(239, 99, 135, 0.28),
          inset 0 0 0 1px rgba(255, 250, 247, 0.24);
      }

      html:not(.dark) .full-report-light-theme [class*="bg-white\\/5"] {
        background-color: #fff4f1;
      }

      html:not(.dark) .full-report-light-theme [class*="border-white\\/10"] {
        border-color: #ead8cf;
      }

      html:not(.dark) .full-report-light-theme [class*="text-zinc-900"],
      html:not(.dark) .full-report-light-theme [class*="text-zinc-950"] {
        color: #2b1f26;
      }

      html:not(.dark) .full-report-light-theme [class*="text-zinc-700"],
      html:not(.dark) .full-report-light-theme [class*="text-zinc-600"] {
        color: #4f363d;
      }

      html:not(.dark) .full-report-light-theme [class*="text-zinc-500"],
      html:not(.dark) .full-report-light-theme [class*="text-zinc-400"] {
        color: #7a6268;
      }

      html:not(.dark) .full-report-light-theme [class*="bg-zinc-900"] {
        background-color: #3a1f2a;
      }

      html:not(.dark) .full-report-light-theme [class*="bg-zinc-200"],
      html:not(.dark) .full-report-light-theme [class*="bg-zinc-800"] {
        background-color: #e6d2ca;
      }

      html:not(.dark) .full-report-light-theme [class*="bg-sky-500\\/10"] {
        background-color: #fff1ef;
      }

      html:not(.dark) .full-report-light-theme [class*="border-sky-300\\/20"] {
        border-color: #efcfc8;
      }

      html:not(.dark) .full-report-light-theme [class*="text-sky-700"] {
        color: #a24e5f;
      }

      html:not(.dark) .full-report-light-theme [class*="bg-amber-500\\/10"] {
        background-color: #fff2e6;
      }

      html:not(.dark) .full-report-light-theme [class*="border-amber-300\\/20"] {
        border-color: #f0c9a8;
      }

      html:not(.dark) .full-report-light-theme [class*="text-amber-700"] {
        color: #a35b43;
      }

      html:not(.dark) .full-report-light-theme [class*="bg-emerald-500\\/10"] {
        background-color: #eff8f1;
      }

      html:not(.dark) .full-report-light-theme [class*="border-emerald-300\\/20"] {
        border-color: #c9dfce;
      }

      html:not(.dark) .full-report-light-theme [class*="text-emerald-700"] {
        color: #4f7657;
      }

      .full-report-light-theme .full-report-step-cta > div {
        margin-top: 1.125rem;
      }

      .full-report-light-theme .full-report-step-cta .ui-button-secondary {
        min-height: 3rem;
        padding-left: 1.1rem;
        padding-right: 1.1rem;
      }

      .full-report-light-theme .full-report-step-cta .ui-button-primary {
        min-height: 3.25rem;
        color: #ffffff;
        text-shadow: 0 1px 1px rgba(70, 32, 42, 0.18);
      }

      html:not(.dark) .full-report-light-theme .full-report-locale-link:not(.ui-choice-active) {
        background: rgba(255, 250, 247, 0.9);
        border: 1px solid #ddbfb5;
        color: #5f3844;
      }

      html:not(.dark) .full-report-light-theme .full-report-locale-link:not(.ui-choice-active):hover {
        background: rgba(255, 128, 104, 0.08);
        color: #3a1f2a;
      }

      html.dark .full-report-light-theme.ui-page {
        background:
          radial-gradient(circle at 50% 0%, rgba(36, 23, 32, 0.92) 0%, rgba(27, 16, 23, 0.96) 44%, #160d13 100%);
        color: #fff8f3;
      }

      html.dark .full-report-light-theme .ui-card {
        background: linear-gradient(180deg, #241720 0%, #21151d 100%);
        border-color: #4a303c;
        color: #fff8f3;
        box-shadow: 0 24px 70px rgba(18, 10, 16, 0.32);
      }

      html.dark .full-report-light-theme .ui-card-subtle,
      html.dark .full-report-light-theme .ui-card-muted {
        background: #2b1c26;
        border-color: #4a303c;
        color: #f3e4df;
      }

      html.dark .full-report-light-theme .ui-title {
        color: #fff8f3;
      }

      html.dark .full-report-light-theme .ui-text-secondary {
        color: #c8aeb8;
      }

      html.dark .full-report-light-theme .ui-kicker {
        color: #c8aeb8;
      }

      html.dark .full-report-light-theme .ui-chip-compact,
      html.dark .full-report-light-theme .ui-chip {
        background: #301f28;
        border-color: #5a3a48;
        color: #f4d7df;
      }

      html.dark .full-report-light-theme .ui-button-secondary {
        background: #301f28;
        border-color: #5a3a48;
        color: #f4d7df;
      }

      html.dark .full-report-light-theme .ui-button-secondary:hover {
        background: #352430;
        border-color: #6a4050;
      }

      html.dark .full-report-light-theme .ui-choice-active {
        background: linear-gradient(135deg, #ef6387 0%, #ff8068 100%);
        border-color: transparent;
        color: #fffaf7;
        box-shadow: 0 12px 26px rgba(239, 99, 135, 0.18);
      }

      html.dark .full-report-light-theme .ui-button-secondary.ui-choice-active,
      html.dark .full-report-light-theme .ui-button-secondary.ui-choice-active:hover,
      html.dark .full-report-light-theme .ui-button-secondary.ui-choice-active:focus,
      html.dark .full-report-light-theme .ui-button-secondary.ui-choice-active:active {
        background: linear-gradient(135deg, #ef6387 0%, #ff8068 100%);
        border-color: transparent;
        color: #fffaf7;
        box-shadow: 0 12px 26px rgba(239, 99, 135, 0.18);
      }

      html.dark .full-report-light-theme .full-report-tab-active,
      html.dark .full-report-light-theme .full-report-tab-active:hover {
        background: linear-gradient(135deg, #ff6b92 0%, #ff876f 100%);
        border-color: rgba(255, 226, 219, 0.42);
        color: #fffaf7;
        box-shadow:
          0 16px 34px rgba(255, 106, 134, 0.34),
          inset 0 0 0 1px rgba(255, 226, 219, 0.18);
      }

      html.dark .full-report-light-theme [class*="bg-white\\/5"],
      html.dark .full-report-light-theme [class*="bg-zinc-950\\/35"],
      html.dark .full-report-light-theme [class*="bg-zinc-900\\/50"] {
        background-color: #2f202a;
      }

      html.dark .full-report-light-theme [class*="border-white\\/10"],
      html.dark .full-report-light-theme [class*="border-zinc-800"] {
        border-color: #4a303c;
      }

      html.dark .full-report-light-theme [class*="text-zinc-100"],
      html.dark .full-report-light-theme [class*="text-zinc-200"] {
        color: #fff8f3;
      }

      html.dark .full-report-light-theme [class*="text-zinc-300"] {
        color: #f3e4df;
      }

      html.dark .full-report-light-theme [class*="text-zinc-400"],
      html.dark .full-report-light-theme [class*="text-zinc-500"] {
        color: #c8aeb8;
      }

      html.dark .full-report-light-theme [class*="bg-zinc-100"] {
        background-color: #fff8f3;
      }

      html.dark .full-report-light-theme [class*="bg-zinc-800"],
      html.dark .full-report-light-theme [class*="bg-zinc-700"] {
        background-color: #3a2630;
      }

      html.dark .full-report-light-theme [class*="bg-sky-500\\/10"] {
        background-color: #1d2b35;
      }

      html.dark .full-report-light-theme [class*="border-sky-300\\/20"] {
        border-color: #315061;
      }

      html.dark .full-report-light-theme [class*="text-sky-200"] {
        color: #c9e7f0;
      }

      html.dark .full-report-light-theme [class*="bg-amber-500\\/10"] {
        background-color: #3a2818;
      }

      html.dark .full-report-light-theme [class*="border-amber-300\\/20"] {
        border-color: #6a4a25;
      }

      html.dark .full-report-light-theme [class*="text-amber-200"],
      html.dark .full-report-light-theme [class*="text-amber-300"] {
        color: #f2c879;
      }

      html.dark .full-report-light-theme .ui-image-surface {
        background: linear-gradient(180deg, #2f202a 0%, #21151d 100%);
        border-color: #5a3a48;
      }
    `}</style>
  );
}

function FullReportLoadingBridge({ locale = "ko", onOpen, canOpen = true }) {
  return <PremiumReportLoadingPage forcedLocale={locale} onOpen={onOpen} canOpen={canOpen} />;
}

const COPY = {
  ko: {
    loading: "전체 리포트를 불러오는 중입니다...",
    title: "Skin Match 플랜",
    body: "지금 피부 기준으로, 오늘 유지할 것과 줄일 것을 먼저 정리했어요.",
    backResult: "무료 결과로 돌아가기",
    restart: "다시 테스트하기",
    errorTitle: "전체 리포트를 불러오지 못했습니다.",
    errorBody: "분석 세션이 만료되었거나 필요한 데이터가 없습니다. 무료 결과로 돌아가 다시 이어가 주세요.",
    topPickReason: "1순위 제품 상세 이유",
    supportingProducts: "함께 쓰기 좋은 제품",
    fullRoutine: "실제 사용 루틴",
    morning: "아침",
    night: "저녁",
    situationVariants: "안 맞을 때 조정법",
    avoid: "피해야 할 것",
    budget: "대체 제품 · 예산 플랜",
    budgetLowerBurden: "대체 제품 · 예산 플랜",
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
    mainHubButton: "메인 허브로 이동",
    fitSectionTitle: "제품 적합도",
    fitSectionBody: "이 점수는 제품의 사용감과 적합도를 요약한 참고 지표입니다.",
    alternativesTitle: "대체 제품 · 예산 플랜",
    alternativesBody: "부담스럽거나 맞지 않을 때 갈 수 있는 안전한 우회로만 정리했습니다.",
    previousCard: "이전",
    nextCard: "다음",
    recommendedForThisStep: "이 단계에 쓸 제품",
    noImage: "이미지 없음",
    faceLabReadyTitle: "Face Lab 리포트도 준비됐어요",
    faceLabReadyBody: "Skin Match 플랜을 확인했다면, 이제 얼굴형에 맞는 스타일 방향도 확인해보세요. 피하는 게 좋은 스타일까지 함께 정리했습니다.",
    faceLabReadyButton: "Face Lab 리포트 확인하기"
  },
  en: {
    loading: "Loading your full report...",
    title: "Skin Match Plan",
    body: "Based on your skin right now, this organizes what to keep and what to reduce today.",
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
    mainHubButton: "Go to main hub",
    fitSectionTitle: "Product fit",
    fitSectionBody: "These scores are a compact reference for wear profile and fit.",
    alternativesTitle: "Alternative Products · Budget Plan",
    alternativesBody: "A tighter set of safer routes when the first product feels too expensive, too strong, or the wrong texture.",
    previousCard: "Previous",
    nextCard: "Next",
    recommendedForThisStep: "Suggested for this step",
    noImage: "No image",
    faceLabReadyTitle: "Your Face Lab report is ready too",
    faceLabReadyBody: "Once the Skin Match plan is clear, check the style direction that fits your face shape, including styles to avoid.",
    faceLabReadyButton: "Check Face Lab report"
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

function getMyPath(locale = "ko") {
  return locale === "en" ? "/en/my" : "/my";
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

function PremiumReportComingSoonGate({ locale = "ko" }) {
  const copy = PREMIUM_REPORT_COMING_SOON_COPY[locale] || PREMIUM_REPORT_COMING_SOON_COPY.ko;

  return (
    <main className="full-report-light-theme ui-page ui-page-shell min-h-screen">
      <FullReportLightThemeStyles />
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
        <section className="ui-card px-5 py-6 text-center sm:p-7">
          <span className="mx-auto inline-flex rounded-full border border-[#e79582]/35 bg-[#e87662]/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a55349] dark:text-[#f0b7a7]">
            {copy.eyebrow}
          </span>
          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full border border-[#e79582]/35 bg-white/10 text-2xl text-[#e87662] shadow-[0_0_32px_rgba(232,118,98,0.16)]">
            ✦
          </div>
          <h1 className="ui-title mt-5 text-2xl leading-tight">{copy.title}</h1>
          <p className="ui-text-secondary mx-auto mt-3 max-w-sm text-sm leading-6">{copy.body}</p>
          <Link
            href={getResultPath(locale)}
            className="ui-button-primary mt-6 min-h-12 w-full justify-center px-5 text-sm font-semibold"
          >
            {copy.button}
          </Link>
        </section>
      </div>
    </main>
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
  if (value == null) {
    return "";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).replace(/\s+/g, " ").trim();
  }

  if (Array.isArray(value)) {
    return value.map((item) => compactText(item)).filter(Boolean).join(" ");
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "text",
      "body",
      "summary",
      "note",
      "description",
      "reason",
      "label",
      "title",
      "value",
      "content",
      "en",
      "ko"
    ];

    for (const key of preferredKeys) {
      const text = compactText(value[key]);

      if (text) {
        return text;
      }
    }

    return "";
  }

  return "";
}

function compactLocalizedText(value, locale = "ko") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return compactText(value);
  }

  const preferredKeys = [
    locale,
    locale === "en" ? "english" : "korean",
    "text",
    "body",
    "summary",
    "note",
    "description",
    "reason",
    "label",
    "title",
    "value",
    "content",
    locale === "en" ? "ko" : "en"
  ];

  for (const key of preferredKeys) {
    const text = compactText(value[key]);

    if (text) {
      return text;
    }
  }

  return compactText(value);
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

  if (category === "toner_pad" || category === "toner_essence") {
    return "toner_essence";
  }
  if (category === "serum" || category === "ampoule" || category === "essence" || category === "treatment") {
    return "serum_ampoule";
  }

  return category;
}

function normalizeDisplayStepKey(value) {
  const key = String(value || "").trim().toLowerCase();

  if (!key) {
    return "";
  }
  if (key === "serum" || key === "ampoule" || key === "essence" || key === "treatment" || key === "serum_ampoule") {
    return "serum_ampoule";
  }
  if (key === "toner_pad") {
    return "toner_pad";
  }
  if (key === "toner_essence") {
    return "toner_essence";
  }
  if (["cleanser", "sunscreen", "moisturizer"].includes(key)) {
    return key;
  }

  return "";
}

function getTreatmentFormStepLabel(product = {}, locale = "ko") {
  const form = String(product?.product_form || product?.productForm || "").trim().toLowerCase();
  const labels = locale === "en"
    ? {
        serum: "Serum",
        ampoule: "Ampoule",
        essence: "Essence",
        booster: "Booster",
        peeling_solution: "Peeling Solution",
        unknown: "Treatment"
      }
    : {
        serum: "세럼",
        ampoule: "앰플",
        essence: "에센스",
        booster: "부스터",
        peeling_solution: "필링 솔루션",
        unknown: "트리트먼트"
      };

  return labels[form] || "";
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

  if (displayKey === "serum_ampoule") {
    const formLabel = getTreatmentFormStepLabel(product, locale);
    if (formLabel) {
      return formLabel;
    }
  }

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

function getConcernCopy(result = {}, locale = "ko") {
  const axis = getReportPriorityAxis(result);
  const ko = {
    uv: {
      main: "자외선",
      priority: "보호 우선순위",
      condition: "야외 노출 흐름",
      reaction: "보호 단계"
    },
    oiliness: {
      main: "유분",
      priority: "산뜻한 마무리",
      condition: "오후 컨디션",
      reaction: "피지감"
    },
    pores: {
      main: "모공",
      priority: "표면 정돈",
      condition: "피지 흐름",
      reaction: "결 정리"
    },
    dehydration: {
      main: "속건조",
      priority: "수분 밸런스",
      condition: "건조한 컨디션",
      reaction: "당김"
    },
    acne: {
      main: "트러블",
      priority: "국소 케어",
      condition: "흔들리는 컨디션",
      reaction: "올라온 부위"
    },
    uneven_tone: {
      main: "톤 불균형",
      priority: "피부톤 정돈",
      condition: "균일하지 않은 인상",
      reaction: "칙칙함"
    },
    redness: {
      main: "붉은기",
      priority: "진정 우선순위",
      condition: "예민한 컨디션",
      reaction: "피부 반응"
    },
    barrier: {
      main: "장벽",
      priority: "보습 유지력",
      condition: "예민해진 흐름",
      reaction: "피부 컨디션"
    }
  };
  const en = {
    uv: {
      main: "UV pressure",
      priority: "protection priority",
      condition: "outdoor exposure flow",
      reaction: "protection step"
    },
    oiliness: {
      main: "oiliness",
      priority: "fresh finish",
      condition: "afternoon condition",
      reaction: "sebum feel"
    },
    pores: {
      main: "pores",
      priority: "surface refinement",
      condition: "sebum flow",
      reaction: "texture control"
    },
    dehydration: {
      main: "dehydration",
      priority: "hydration balance",
      condition: "dry condition",
      reaction: "tightness"
    },
    acne: {
      main: "breakouts",
      priority: "local care priority",
      condition: "unstable condition",
      reaction: "reactive spots"
    },
    uneven_tone: {
      main: "uneven tone",
      priority: "tone refinement",
      condition: "uneven impression",
      reaction: "dullness"
    },
    redness: {
      main: "redness",
      priority: "calming priority",
      condition: "reactive condition",
      reaction: "skin response"
    },
    barrier: {
      main: "barrier support",
      priority: "moisture retention",
      condition: "reactive flow",
      reaction: "skin condition"
    }
  };
  const dictionary = locale === "en" ? en : ko;

  return dictionary[axis] || dictionary.dehydration;
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

function getReportPhotoSignalLabel(signal = {}, locale = "ko") {
  const key = String(signal?.key || "").trim();
  const label = compactLocalizedText(signal?.label, locale);

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

function getReportPhotoSignalArea(area, locale = "ko") {
  const text = compactLocalizedText(area, locale);

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

function buildReportPhotoSummary(result = {}, locale = "ko") {
  const rawSummary = compactLocalizedText(result?.photoObservations?.summary || result?.premiumReport?.photoObservations?.summary, locale);
  const signals = Array.isArray(result?.photoObservations?.signals)
    ? result.photoObservations.signals
    : Array.isArray(result?.premiumReport?.photoObservations?.signals)
      ? result.premiumReport.photoObservations.signals
      : [];

  if (locale !== "en") {
    return rawSummary;
  }

  if (rawSummary && !hasKoreanText(rawSummary)) {
    return rawSummary;
  }

  const cues = signals
    .slice(0, 2)
    .map((signal) => {
      const label = getReportPhotoSignalLabel(signal, locale);
      const area = getReportPhotoSignalArea(signal?.area, locale);
      return area ? `${label} around the ${area}` : label;
    })
    .filter(Boolean);

  return cues.length
    ? `The photo shows ${cues.join(" and ")} as supporting skin cues.`
    : "";
}

function buildTopPickEvidenceText(result = {}, locale = "ko") {
  const photoSummary = buildReportPhotoSummary(result, locale);
  const signals = Array.isArray(result?.photoObservations?.signals)
    ? result.photoObservations.signals
    : Array.isArray(result?.premiumReport?.photoObservations?.signals)
      ? result.premiumReport.photoObservations.signals
      : [];
  const firstSignal = signals.find((signal) => getReportPhotoSignalLabel(signal, locale) || getReportPhotoSignalArea(signal?.area, locale));
  const alignment = result?.photoObservations?.surveyAlignment || result?.premiumReport?.photoObservations?.surveyAlignment || null;
  const hasMixedPhotoSurvey = ["mixed", "conflict"].includes(String(alignment?.status || ""));

  if (photoSummary && !/제한|limited/i.test(photoSummary)) {
    if (hasMixedPhotoSurvey && alignment?.note && (locale !== "en" || !hasKoreanText(alignment.note))) {
      return compactLocalizedText(alignment.note, locale);
    }

    return locale === "en"
      ? `The photo read is used as supporting context: ${photoSummary}`
      : `사진 기준으로 ${photoSummary} 이 흐름을 1순위 제품 설명의 보조 근거로 함께 반영했습니다.`;
  }

  if (firstSignal) {
    const label = getReportPhotoSignalLabel(firstSignal, locale);
    const area = getReportPhotoSignalArea(firstSignal.area, locale);

    return locale === "en"
      ? `The photo shows a ${label || "skin"} tendency${area ? ` around ${area}` : ""}, so the routine keeps that read as supporting context.`
      : `사진 기준으로 ${area ? `${area} 쪽 ` : ""}${label || "피부"} 경향이 함께 보여, 이 흐름을 루틴 방향에 보조로 반영했습니다.`;
  }

  const evidenceSources = [
    ...(Array.isArray(result?.surveyEvidence) ? result.surveyEvidence : []),
    ...(Array.isArray(result?.photoEvidence) ? result.photoEvidence : []),
    ...(Array.isArray(result?.evidenceLines) ? result.evidenceLines : [])
  ];
  const evidenceLines = uniqueDisplayTexts(evidenceSources.map((item) => compactLocalizedText(item, locale))).filter((item) => locale !== "en" || !hasKoreanText(item));

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

function buildFullReportHeaderBody(copy, result = {}, locale = "ko") {
  const photoSummary = compactLocalizedText(result?.photoObservations?.summary || result?.premiumReport?.photoObservations?.summary, locale);
  const alignment = result?.photoObservations?.surveyAlignment || result?.premiumReport?.photoObservations?.surveyAlignment || null;

  if (["mixed", "conflict"].includes(String(alignment?.status || "")) && compactLocalizedText(alignment?.note, locale)) {
    return locale === "en"
      ? `Using the same first product as the free result, this report organizes the survey answer and photo read into AM/PM steps, situation variants, and combinations to avoid.`
      : `${copy.body} ${compactLocalizedText(alignment.note, locale)}`;
  }
  if (photoSummary && !/제한|limited/i.test(photoSummary)) {
    return locale === "en"
      ? `Using the same first product as the free result, this report turns the photo-based read and survey answers into AM/PM steps, situation variants, and combinations to avoid.`
      : `무료 결과의 1순위 제품을 기준으로, 사진에서 보인 피부 흐름과 설문 답변을 AM/PM 실행 루틴, 상황별 조정, 피해야 할 조합으로 정리했습니다.`;
  }

  return copy.body;
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
          label: labels[block?.key] || compactLocalizedText(block?.label, locale) || compactLocalizedText(block?.key, locale),
          body: compactLocalizedText(block?.body, locale)
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

  const detailedReason = [
    report?.topPickDetailedReason,
    product?.reason,
    product?.explanation,
    result?.directionSummary
  ].map((item) => compactLocalizedText(item, locale)).find(Boolean) || "";
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

function getTopPickOperationLabels(locale = "ko") {
  return locale === "en"
    ? {
        kicker: "Primary product manual",
        fit: "Primary-use fit",
        role: "Role in the routine",
        reasons: "Why it fits",
        caution: "Watch point",
        action: "Start today"
      }
    : {
        kicker: "1순위 제품 운용법",
        fit: "1순위 운용 적합도",
        role: "역할 요약",
        reasons: "잘 맞는 이유",
        caution: "주의할 점",
        action: "오늘부터 쓰는 법"
      };
}

function getNumericTopPickScore(product = {}, report = {}) {
  const candidates = [
    product?.fitPercent,
    product?.fit_percent,
    product?.matchPercent,
    product?.match_percent,
    product?.decision_meta?.fitPercent,
    product?.decision_meta?.fit_percent,
    product?.decisionMeta?.fitPercent,
    report?.topPickFitPercent,
    report?.topPickMatchPercent
  ];

  const score = candidates
    .map((item) => Number(item))
    .find((item) => Number.isFinite(item) && item > 0);

  if (!Number.isFinite(score)) {
    return null;
  }

  const normalizedScore = score > 0 && score <= 1 ? score * 100 : score;
  return Math.round(Math.max(0, Math.min(100, normalizedScore)));
}

function clampDisplayFitScore(score) {
  return Math.max(76, Math.min(94, Math.round(score)));
}

function getTopPickConcernAliases(axis = "") {
  const aliases = {
    uv: ["uv", "sun", "sunscreen", "spf", "자외선", "선케어", "선크림"],
    oiliness: ["oiliness", "oil", "sebum", "shine", "fresh", "유분", "피지", "번들", "산뜻"],
    pores: ["pores", "pore", "texture", "모공", "결"],
    dehydration: ["dehydration", "hydration", "moist", "dry", "barrier", "수분", "보습", "건조", "장벽"],
    acne: ["acne", "breakout", "trouble", "blemish", "트러블", "여드름", "블레미쉬"],
    uneven_tone: ["uneven", "tone", "bright", "dark spot", "톤", "잡티", "칙칙", "브라이트"],
    redness: ["redness", "red", "calm", "cica", "centella", "sensitive", "붉은", "진정", "시카", "센텔라", "민감"],
    barrier: ["barrier", "sensitive", "calm", "repair", "cica", "centella", "장벽", "민감", "진정", "회복", "시카", "센텔라"]
  };

  return aliases[axis] || [];
}

function getResultSecondaryConcernAxes(result = {}) {
  const primaryAxis = getReportPriorityAxis(result);
  const candidates = [
    result?.secondaryConcern,
    result?.priority?.secondary,
    result?.form?.secondaryConcern,
    result?.form?.subConcern,
    result?.form?.skinConcern,
    result?.form?.skinConcerns,
    result?.concerns,
    result?.selectedConcerns
  ];
  const normalized = candidates
    .flatMap((item) => Array.isArray(item) ? item : [item])
    .map((item) => String(item || "").trim())
    .filter((item) => item && item !== primaryAxis);

  return Array.from(new Set(normalized)).slice(0, 3);
}

function getProductIrritationRisk(product = {}) {
  const rawRisk = compactText(
    product?.irritation_risk ||
    product?.irritationRisk ||
    product?.decision_meta?.irritation_risk ||
    product?.decision_meta?.irritationRisk ||
    product?.decisionMeta?.irritationRisk ||
    product?.safety?.irritation_risk
  ).toLowerCase();

  if (/high|높|강/.test(rawRisk)) {
    return "high";
  }
  if (/medium|mid|보통|중/.test(rawRisk)) {
    return "medium";
  }
  if (/low|낮|약/.test(rawRisk) || productTextHas(product, ["low irritation", "저자극", "순한", "마일드"])) {
    return "low";
  }

  return "";
}

function isUserSensitiveLeaning(result = {}) {
  const axis = getReportPriorityAxis(result);
  const formText = buildProductTextIndex({
    concerns: [
      result?.form?.sensitivity,
      result?.form?.skinSensitivity,
      result?.form?.mainConcern,
      result?.form?.skinConcerns,
      result?.form?.selectedConcerns,
      result?.concerns
    ]
  });

  return ["redness", "barrier", "acne"].includes(axis) || /(sensitive|redness|irritation|민감|예민|붉|자극|트러블)/i.test(formText);
}

function isProductSensitivitySafe(product = {}) {
  return Boolean(
    product?.sensitivity_safe ||
    product?.sensitivitySafe ||
    product?.decision_meta?.sensitivity_safe ||
    product?.decisionMeta?.sensitivitySafe ||
    productTextHas(product, ["sensitive safe", "low irritation", "calm", "cica", "centella", "저자극", "진정", "민감", "센텔라"])
  );
}

function isProductSkinTypeMatch(product = {}, result = {}) {
  const skinType = compactText(result?.skinType || result?.skin_type || result?.form?.skinType || result?.form?.skin_type).toLowerCase();

  if (!skinType) {
    return false;
  }

  const productText = buildProductTextIndex(product);
  const aliases = {
    dry: ["dry", "dehydration", "moist", "hydration", "건성", "건조", "수분", "보습"],
    oily: ["oily", "oil", "sebum", "fresh", "matte", "지성", "유분", "피지", "산뜻", "매트"],
    combination: ["combination", "balanced", "복합", "밸런스"],
    sensitive: ["sensitive", "calm", "low irritation", "민감", "진정", "저자극"]
  };
  const normalizedSkinType = /건성|dry/.test(skinType)
    ? "dry"
    : /지성|oily/.test(skinType)
      ? "oily"
      : /복합|combination/.test(skinType)
        ? "combination"
        : /민감|sensitive/.test(skinType)
          ? "sensitive"
          : "";

  return Boolean(normalizedSkinType && aliases[normalizedSkinType]?.some((token) => productText.includes(token)));
}

function isTopPickCategoryRoleMatch(product = {}) {
  return Boolean(normalizeReportCategory(product));
}

function calculateTopPickDisplayFitScore(product = {}, report = {}, result = {}) {
  const explicitScore = getNumericTopPickScore(product, report);

  if (explicitScore != null) {
    return clampDisplayFitScore(explicitScore);
  }

  const axis = getReportPriorityAxis(result);
  const aliases = getTopPickConcernAliases(axis);
  const primaryConcernMatch = aliases.length ? productTextHas(product, aliases) : false;
  const secondaryConcernMatch = getResultSecondaryConcernAxes(result).some((secondaryAxis) =>
    productTextHas(product, getTopPickConcernAliases(secondaryAxis))
  );
  const categoryMatch = isTopPickCategoryRoleMatch(product);

  if (!product?.name || (!primaryConcernMatch && !categoryMatch)) {
    return null;
  }

  const sensitiveLeaning = isUserSensitiveLeaning(result);
  const sensitivitySafe = isProductSensitivitySafe(product);
  const irritationRisk = getProductIrritationRisk(product);
  let score = 86;

  if (isProductSkinTypeMatch(product, result)) {
    score += 3;
  }
  if (primaryConcernMatch) {
    score += 4;
  }
  if (secondaryConcernMatch) {
    score += 2;
  }
  if (sensitiveLeaning && sensitivitySafe) {
    score += 3;
  }
  if (irritationRisk === "low") {
    score += 2;
  } else if (irritationRisk === "medium") {
    score -= 3;
  } else if (irritationRisk === "high") {
    score -= 8;
  }
  if (categoryMatch) {
    score += 3;
  }
  if (irritationRisk === "medium" || irritationRisk === "high" || ["redness", "barrier", "acne"].includes(axis)) {
    score -= 2;
  }

  return clampDisplayFitScore(score);
}

function buildTopPickFitBasis(product = {}, result = {}, locale = "ko") {
  const concernCopy = getConcernCopy(result, locale);
  const stepLabel = getReportStepLabel(product, locale);

  return locale === "en"
    ? `${concernCopy.priority} and the ${stepLabel.toLowerCase()} role align, so it is easy to keep the routine simple.`
    : `${concernCopy.priority}와 ${stepLabel} 역할이 맞고, 루틴을 단순하게 유지하기 쉬운 조합입니다.`;
}

function buildTopPickFitSummary(product = {}, report = {}, result = {}, locale = "ko") {
  const score = calculateTopPickDisplayFitScore(product, report, result);

  if (score == null) {
    return {
      score: null,
      title: locale === "en"
        ? "Stable choice for the current condition"
        : "현재 조건에서 안정적인 선택",
      body: locale === "en"
        ? "There is not enough structured fit data to show a numeric operating fit."
        : "표시용 점수를 계산할 구조화 데이터가 부족해 정성 기준으로 표시합니다."
    };
  }

  return {
    score,
    title: locale === "en" ? `Primary-use fit ${score}%` : `1순위 운용 적합도 ${score}%`,
    basis: buildTopPickFitBasis(product, result, locale)
  };
}

function buildTopPickRoleSummary(product = {}, result = {}, locale = "ko") {
  const axis = getReportPriorityAxis(result);
  const concernCopy = getConcernCopy(result, locale);
  const stepLabel = getReportStepLabel(product, locale);

  if (locale === "en") {
    if (axis === "redness" || axis === "barrier") {
      return `A ${stepLabel.toLowerCase()} lane that lowers reactive burden before adding more steps.`;
    }
    if (axis === "dehydration") {
      return `A ${stepLabel.toLowerCase()} lane for adding hydration without making the routine heavy.`;
    }
    if (axis === "oiliness" || axis === "pores") {
      return `A ${stepLabel.toLowerCase()} lane that keeps oiliness and texture easier to manage.`;
    }
    if (axis === "acne") {
      return `A ${stepLabel.toLowerCase()} lane that keeps breakout-day care narrow and repeatable.`;
    }
    if (axis === "uneven_tone") {
      return `A ${stepLabel.toLowerCase()} lane for texture and tone support without overcorrecting.`;
    }

    return `A ${stepLabel.toLowerCase()} lane that keeps the ${concernCopy.priority} simple.`;
  }

  if (axis === "redness" || axis === "barrier") {
    return `${concernCopy.condition}을 먼저 낮추는 ${stepLabel} 축`;
  }
  if (axis === "dehydration") {
    return `수분감을 보완하면서 단계 부담을 줄이는 ${stepLabel}`;
  }
  if (axis === "oiliness" || axis === "pores") {
    return `유분과 결 부담을 가볍게 정리하는 ${stepLabel}`;
  }
  if (axis === "acne") {
    return `트러블이 올라온 날에도 루틴을 단순하게 잡는 ${stepLabel}`;
  }
  if (axis === "uneven_tone") {
    return `톤과 결 보완을 과하지 않게 가져가는 ${stepLabel}`;
  }

  return `${concernCopy.priority}를 단순하게 받쳐주는 ${stepLabel}`;
}

function getTopPickCategoryReason(product = {}, locale = "ko") {
  const category = normalizeReportCategory(product);

  if (locale === "en") {
    if (category === "sunscreen") {
      return "Fits as the final morning protection step";
    }
    if (category === "cleanser") {
      return "Resets residue without making cleansing stronger";
    }
    if (category === "toner_pad" || category === "toner_essence") {
      return "Works as a thin first layer before heavier steps";
    }
    if (category === "serum_ampoule") {
      return "Keeps active care focused in one lane";
    }
    if (category === "moisturizer") {
      return "Holds the sealing role without adding more correction";
    }

    return "Keeps the surrounding routine easier to repeat";
  }

  if (category === "sunscreen") {
    return "아침 보호 단계에 바로 배치 가능";
  }
  if (category === "cleanser") {
    return "세안 강도를 높이지 않고 잔여감 정리";
  }
  if (category === "toner_pad" || category === "toner_essence") {
    return "무거운 단계 전 얇은 첫 레이어로 사용";
  }
  if (category === "serum_ampoule") {
    return "기능을 한 방향으로 좁혀 사용";
  }
  if (category === "moisturizer") {
    return "마무리 보습 축을 안정적으로 확보";
  }

  return "주변 루틴을 단순하게 유지";
}

function buildTopPickReasonChecklist(product = {}, result = {}, reasonBlocks = [], locale = "ko") {
  const concernCopy = getConcernCopy(result, locale);
  const hasEvidence = reasonBlocks.some((block) => block?.key === "evidence" && compactLocalizedText(block.body, locale));
  const hasReview = Boolean(buildReviewSignalText(product, locale));
  const items = locale === "en"
    ? [
        `${concernCopy.reaction} and product role align`,
        getTopPickCategoryReason(product, locale),
        hasEvidence
          ? "Photo and survey read are used only as supporting context"
          : hasReview
            ? "Review signals are checked as a light support signal"
            : "Easy to keep other steps simple"
      ]
    : [
        `${concernCopy.reaction}과 역할이 맞음`,
        getTopPickCategoryReason(product, locale),
        hasEvidence
          ? "사진·설문 흐름을 보조 근거로 확인"
          : hasReview
            ? "리뷰 반응을 보조 근거로 확인"
            : "다른 단계와 겹침을 줄이기 쉬움"
      ];

  return uniqueDisplayTexts(items).slice(0, 3);
}

function buildTopPickCaution(product = {}, locale = "ko") {
  const category = normalizeReportCategory(product);

  if (locale === "en") {
    if (category === "sunscreen") {
      return "Reapply on long outdoor days, and cleanse the residue gently at night.";
    }
    if (category === "cleanser") {
      return "Avoid cleansing until the skin feels squeaky or stripped.";
    }
    if (category === "toner_pad" || category === "toner_essence") {
      return "Do not stack several pad or toner layers on the same routine.";
    }
    if (category === "serum_ampoule") {
      return "On reactive days, do not layer it with several active products in the same night.";
    }
    if (category === "moisturizer") {
      return "If the finish feels heavy, reduce the amount and focus on dry areas.";
    }

    return "Use less on reactive days and keep the surrounding steps simple.";
  }

  if (category === "sunscreen") {
    return "야외 시간이 길면 덧바르고, 저녁에는 잔여감을 부드럽게 정리하세요.";
  }
  if (category === "cleanser") {
    return "뽀득하게 오래 문지르는 세안은 피하세요.";
  }
  if (category === "toner_pad" || category === "toner_essence") {
    return "패드나 토너를 여러 장 겹치지 마세요.";
  }
  if (category === "serum_ampoule") {
    return "예민한 날에는 다른 활성 제품과 같은 밤에 겹치지 마세요.";
  }
  if (category === "moisturizer") {
    return "답답하게 느껴지면 양을 줄이고 건조한 부위 중심으로 둡니다.";
  }

  return "반응이 예민한 날에는 사용량을 줄이고 주변 단계를 단순하게 유지하세요.";
}

function buildTopPickStartAction(product = {}, locale = "ko") {
  const category = normalizeReportCategory(product);

  if (locale === "en") {
    if (category === "sunscreen") {
      return "Use enough as the final morning step, then reapply when exposure is long.";
    }
    if (category === "cleanser") {
      return "Use it briefly at the cleansing step, then move straight into hydration.";
    }
    if (category === "toner_pad") {
      return "After cleansing, use one pad lightly or press it where the skin feels dry.";
    }
    if (category === "toner_essence") {
      return "Apply a thin first layer right after cleansing before heavier products.";
    }
    if (category === "serum_ampoule") {
      return "Start with a small amount after toner and watch how the skin responds.";
    }
    if (category === "moisturizer") {
      return "Finish with a thin layer after serum, then add a little more only on dry areas.";
    }

    return "Use it as the anchor step and keep the rest of the routine light.";
  }

  if (category === "sunscreen") {
    return "아침 마지막 단계에서 충분히 바르고, 긴 외출 전에는 덧바름을 기준으로 보세요.";
  }
  if (category === "cleanser") {
    return "세안 단계에서 짧게 사용하고 바로 보습 단계로 이어가세요.";
  }
  if (category === "toner_pad") {
    return "세안 직후 한 장으로 짧게 닦거나 필요한 부위에 가볍게 눌러 주세요.";
  }
  if (category === "toner_essence") {
    return "세안 직후 얇게 먼저 올리고 다음 단계는 가볍게 이어가세요.";
  }
  if (category === "serum_ampoule") {
    return "토너 다음 단계에서 소량만 먼저 사용하세요.";
  }
  if (category === "moisturizer") {
    return "세럼 다음 단계에서 얇게 마무리하고 건조 부위만 한 번 더 보완하세요.";
  }

  return "기준 단계로 소량만 먼저 쓰고, 주변 루틴은 가볍게 유지하세요.";
}

function buildTopPickOperationManual({ product = {}, report = {}, result = {}, reasonBlocks = [], locale = "ko" } = {}) {
  return {
    fitSummary: buildTopPickFitSummary(product, report, result, locale),
    roleSummary: buildTopPickRoleSummary(product, result, locale),
    reasons: buildTopPickReasonChecklist(product, result, reasonBlocks, locale),
    caution: buildTopPickCaution(product, locale),
    action: buildTopPickStartAction(product, locale)
  };
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
    : "Use the evening step to reset and lower burden without adding unnecessary layers.";
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
    : "저녁에는 잔여감을 정리하고 부담을 낮추는 쪽으로 마무리합니다.";
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
    return "두껍게 한 번 올리는 방식으로 덧바름을 대신하지 마세요.";
  }
  if (category === "cleanser") {
    return "번들거림이 보여도 문지르는 힘부터 올리지는 마세요.";
  }
  if (axis === "redness" || axis === "barrier") {
    return "마찰 큰 단계와 강한 기능성은 같은 날 한쪽만 남깁니다.";
  }
  if (slot === "night") {
    return "보정 제품은 한 번에 여러 개 묶지 마세요.";
  }

  return "피부가 안정될 때까지 주변 단계는 단순하게 둡니다.";
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
      items: ["세안은 짧게 끝내고 손 마찰을 줄입니다.", "각질 패드나 고기능 제품은 하루 쉬어갑니다.", "1순위 제품만 중심 단계에 두고 나머지는 가볍게 둡니다."]
    },
    {
      key: "breakout_day",
      label: "트러블 올라온 날",
      items: ["새 스팟 케어를 여러 개 더하기보다 기존 루틴에서 답답한 단계를 하나 뺍니다.", `루틴 중심은 ${concern} 축으로 잡습니다.`, "무거운 크림이나 두꺼운 베이스는 얇게 조정합니다."]
    },
    {
      key: "outdoor_day",
      label: "야외활동 많은 날",
      items: ["아침에는 보호 단계를 먼저 고정합니다.", "노출이 길면 덧바름 시간을 기준으로 봅니다.", "저녁에는 선크림과 표면 잔여감만 부드럽게 지웁니다."]
    },
    {
      key: "makeup_day",
      label: "메이크업하는 날",
      items: ["베이스 전 단계는 얇게 남깁니다.", "밀리는 조합은 같은 날 제외합니다.", "밤에는 메이크업과 선크림 잔여감을 먼저 풀어냅니다."]
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
      night: ["Use the evening routine to reset residue and lower burden without stacking too much."],
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
  const manualLabels = getTopPickOperationLabels(locale);
  const manual = buildTopPickOperationManual({
    product,
    report,
    result,
    reasonBlocks: topPickReasonBlocks,
    locale
  });

  return (
    <section className="ui-card p-6">
      <div className="grid grid-cols-[1fr_96px] gap-4 sm:grid-cols-[1fr_120px] sm:gap-5">
        <div className="min-w-0">
          <p className="ui-kicker">{manualLabels.kicker}</p>
          <h2 className="ui-title mt-2 break-words text-[1.35rem] sm:text-[1.45rem]">{product.name || "Top Pick"}</h2>
          <p className="ui-text-secondary mt-1 text-sm">{product.brand || ""}</p>

          <div className="mt-4 grid gap-3">
            {manual.fitSummary ? (
              <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {manualLabels.fit}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{manual.fitSummary.title}</p>
                {manual.fitSummary.body ? (
                  <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{manual.fitSummary.body}</p>
                ) : null}
                {manual.fitSummary.basis ? (
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{manual.fitSummary.basis}</p>
                ) : null}
              </div>
            ) : null}

            {manual.roleSummary ? (
              <div className="rounded-[1.15rem] border border-sky-300/20 bg-sky-500/10 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-700 dark:text-sky-200">
                  {manualLabels.role}
                </p>
                <p className="mt-2 text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{manual.roleSummary}</p>
              </div>
            ) : null}

            {manual.reasons.length ? (
              <div className="rounded-[1rem] bg-white/5 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                  {manualLabels.reasons}
                </p>
                <ul className="mt-2 space-y-2">
                  {manual.reasons.map((reason, index) => (
                    <li key={`${reason}-${index}`} className="flex gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      <span className="mt-0.5 text-xs font-semibold text-sky-700 dark:text-sky-200">✓</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {manual.caution ? (
                <div className="rounded-[1rem] border border-amber-300/20 bg-amber-500/10 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">
                    {manualLabels.caution}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{manual.caution}</p>
                </div>
              ) : null}
              {manual.action ? (
                <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                    {manualLabels.action}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{manual.action}</p>
                </div>
              ) : null}
            </div>
          </div>
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
              <h3
                className="ui-title mt-2 break-words text-base leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden"
                }}
              >
                {product.name}
              </h3>
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

function normalizeSituationVariantLabel(label) {
  const text = String(label || "").trim();

  if (text === "야외 노출이 긴 날") {
    return "야외 외출이 긴 날";
  }

  return text;
}

function getSituationVariantButtonLabel(label) {
  const text = normalizeSituationVariantLabel(label);
  const lineBreakLabels = {
    "야외 외출이 긴 날": "야외 외출이\n긴 날",
    "트러블이 올라온 날": "트러블이\n올라온 날",
    "메이크업 하는 날": "메이크업\n하는 날"
  };

  return lineBreakLabels[text] || text;
}

function getSituationPresetKey(variant = {}) {
  const key = String(variant?.key || "").trim().toLowerCase();
  const label = normalizeSituationVariantLabel(variant?.label);

  if (key.includes("outdoor") || /야외|외출|노출/i.test(label)) {
    return "outdoor_day";
  }
  if (key.includes("sensitive") || /민감|예민/i.test(label)) {
    return "sensitive_day";
  }
  if (key.includes("breakout") || key.includes("acne") || /트러블|여드름/i.test(label)) {
    return "breakout_day";
  }
  if (key.includes("makeup") || /메이크업|베이스/i.test(label)) {
    return "makeup_day";
  }

  return "default";
}

function getSituationPrescriptionLabels(locale = "ko") {
  return locale === "en"
    ? {
        today: "Today",
        reduce: "Reduce",
        keep: "Keep",
        keepDecision: "Keep",
        reduceDecision: "Reduce",
        add: "Add",
        usage: "How to use",
        avoid: "Avoid",
        commonAvoid: "Common watch-outs"
      }
    : {
        today: "오늘의 방향",
        reduce: "줄이기",
        keep: "유지하기",
        keepDecision: "남길 것",
        reduceDecision: "줄일 것",
        add: "더하기",
        usage: "사용법",
        avoid: "피하기",
        commonAvoid: "공통 주의"
      };
}

function getSituationPrescriptionFallback(key = "default", locale = "ko") {
  const ko = {
    outdoor_day: {
      today: "야외 시간이 길면 덧바르기까지 포함합니다.",
      reduce: ["앞단 보습/보조 제품"],
      keep: ["선크림 충분량", "진정 세럼"],
      usage: "아침 베이스는 두껍게 만들지 않습니다.",
      avoid: "보호를 위해 루틴을 과하게 겹치지 않습니다."
    },
    sensitive_day: {
      today: "기능성 단계보다 진정과 보습을 먼저 봅니다.",
      reduce: ["각질 케어", "고기능 활성 제품"],
      keep: ["진정 세럼", "보습 크림"],
      usage: "새 제품을 추가하지 말고 사용량을 줄입니다.",
      avoid: "패드, 강한 세안제, 여러 활성 제품을 겹치지 않습니다."
    },
    breakout_day: {
      today: "올라온 부위만 가볍게 봅니다.",
      reduce: ["리치한 보습", "두꺼운 베이스"],
      keep: ["진정 세럼", "가벼운 보습"],
      usage: "트러블 케어는 국소 부위 중심으로만 사용합니다.",
      avoid: "각질 케어, 스팟 케어, 강한 세럼을 같은 밤에 겹치지 않습니다."
    },
    makeup_day: {
      today: "밀림을 줄이도록 단계를 얇게 가져갑니다.",
      reduce: ["미끌거리는 세럼", "리치한 크림"],
      keep: ["가벼운 보습", "선크림"],
      usage: "선크림이 자리 잡은 뒤 베이스를 올립니다.",
      avoid: "세럼 + 리치 크림 + 선크림 + 베이스를 바로 겹치지 않습니다."
    },
    default: {
      today: "오늘 상태에 맞춰 루틴을 단순하게 조정합니다.",
      reduce: ["불필요한 보조 단계"],
      keep: ["1순위 제품", "기본 보습"],
      usage: "새 단계보다 부담 요소를 먼저 줄입니다.",
      avoid: "강한 세안, 마찰 큰 패드, 여러 활성 제품을 한 루틴에 겹치지 않습니다."
    }
  };
  const en = {
    outdoor_day: {
      today: "Prioritize sunscreen staying power and easy reapplication.",
      reduce: ["extra early hydration/support steps"],
      keep: ["enough sunscreen", "calming serum"],
      usage: "Keep the morning base thin and leave only the necessary steps.",
      avoid: "Do not stack the routine just because UV exposure is longer."
    },
    sensitive_day: {
      today: "Prioritize calming and moisture over functional correction.",
      reduce: ["exfoliation", "high-active products"],
      keep: ["calming serum", "moisturizer"],
      usage: "Do not add a new product; reduce the amount instead.",
      avoid: "Avoid pads, strong cleansers, and multiple active products together."
    },
    breakout_day: {
      today: "Do not push the whole face aggressively; keep care local and light.",
      reduce: ["rich moisturizer", "thick base makeup"],
      keep: ["calming serum", "light moisturizer"],
      usage: "Use breakout care only on local areas.",
      avoid: "Do not layer exfoliation, spot care, and strong serum on the same night."
    },
    makeup_day: {
      today: "Keep skincare layers thin to reduce pilling.",
      reduce: ["slippery serum", "rich cream"],
      keep: ["light moisture", "sunscreen"],
      usage: "Apply base makeup after sunscreen has settled.",
      avoid: "Do not stack serum + rich cream + sunscreen + base without pause."
    },
    default: {
      today: "Adjust the routine lightly around today's condition.",
      reduce: ["unnecessary support steps"],
      keep: ["primary product", "basic moisture"],
      usage: "Reduce burden in the existing routine before adding new steps.",
      avoid: "Avoid strong cleansing, high-friction pads, and several active products together."
    }
  };

  return (locale === "en" ? en : ko)[key] || (locale === "en" ? en.default : ko.default);
}

function normalizePrescriptionList(value) {
  return (Array.isArray(value) ? value : [value])
    .map(compactText)
    .filter(Boolean)
    .slice(0, 2);
}

function buildSituationPrescription(variant = {}, locale = "ko") {
  const preset = getSituationPrescriptionFallback(getSituationPresetKey(variant), locale);
  const items = Array.isArray(variant?.items) ? variant.items.map(compactText).filter(Boolean) : [];
  const source = {
    today: compactLocalizedText(variant?.today || variant?.summary || variant?.direction, locale),
    reduce: normalizePrescriptionList(variant?.reduce || variant?.reduceItems),
    keep: normalizePrescriptionList(variant?.keep || variant?.keepItems || variant?.maintain),
    add: normalizePrescriptionList(variant?.add || variant?.addItems),
    usage: compactLocalizedText(variant?.usage || variant?.howToUse || variant?.instruction, locale),
    avoid: compactLocalizedText(variant?.avoid || variant?.warning || variant?.caution, locale)
  };

  return {
    today: source.today || items[0] || preset.today,
    reduce: source.reduce.length ? source.reduce : preset.reduce,
    keep: source.keep.length ? source.keep : preset.keep,
    add: source.add,
    usage: source.usage || items[1] || preset.usage,
    avoid: source.avoid || items[2] || preset.avoid
  };
}

function SituationPrescriptionBlock({ label, body, items, tone = "default", compact = false }) {
  const displayItems = normalizePrescriptionList(items);
  const displayBody = compactText(body);

  if (!displayBody && !displayItems.length) {
    return null;
  }

  const toneClass = tone === "avoid"
    ? "border-amber-300/20 bg-amber-500/10"
    : tone === "keep"
      ? "border-sky-300/20 bg-sky-500/10"
      : "border-white/10 bg-white/5";

  return (
    <div className={`rounded-[1rem] border px-3 ${compact ? "py-2" : "py-3"} ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      {displayBody ? <p className={`${compact ? "mt-1" : "mt-2"} text-sm leading-6 text-zinc-700 dark:text-zinc-300`}>{displayBody}</p> : null}
      {displayItems.length ? (
        <div className={`${compact ? "mt-1.5" : "mt-2"} flex flex-wrap gap-1.5`}>
          {displayItems.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
              {item}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SituationDecisionCard({ label, items = [], guide, tone = "default" }) {
  const displayItems = normalizePrescriptionList(items);
  const displayGuide = compactText(guide);

  if (!displayItems.length && !displayGuide) {
    return null;
  }

  const toneClass = tone === "reduce"
    ? "border-amber-300/20 bg-amber-500/10"
    : "border-sky-300/20 bg-sky-500/10";

  return (
    <div className={`rounded-[1rem] border px-3 py-3 ${toneClass}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
        tone === "reduce" ? "text-amber-700 dark:text-amber-200" : "text-sky-700 dark:text-sky-200"
      }`}>
        {label}
      </p>
      {displayItems.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {displayItems.map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      {displayGuide ? (
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{displayGuide}</p>
      ) : null}
    </div>
  );
}

function CompactWarningBar({ label, body }) {
  const displayBody = compactText(body);

  if (!displayBody) {
    return null;
  }

  return (
    <div className="rounded-[1rem] border border-amber-300/20 bg-amber-500/10 px-3 py-2.5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
        <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 dark:text-amber-200">{label}</p>
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{displayBody}</p>
      </div>
    </div>
  );
}

function AvoidCombinationList({ items = [], label, limit = 3 }) {
  const displayItems = uniqueDisplayTexts(items).slice(0, limit);

  if (!displayItems.length) {
    return null;
  }

  return (
    <div className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{label}</p>
      <ul className="mt-2 space-y-1.5">
        {displayItems.map((item) => (
          <li key={item} className="flex gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function getFullReportFeedbackStorageKey(productId) {
  if (typeof window === "undefined") {
    return "";
  }

  const sessionId = getOrCreateTrackingSessionId();
  return `skinTestFullReportFeedback:${sessionId || "session"}:${productId || "unknown"}`;
}

function getCurrentReportUrl() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.href;
}

function copyTextWithFallback(text) {
  if (typeof window === "undefined" || !text) {
    return Promise.reject(new Error("No text to copy."));
  }

  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => copyTextWithLegacyFallback(text));
  }

  return copyTextWithLegacyFallback(text);
}

function copyTextWithLegacyFallback(text) {
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      textarea.style.top = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (ok) {
        resolve();
        return;
      }

      reject(new Error("Copy command was rejected."));
    } catch (error) {
      reject(error);
    }
  });
}

function FullReportSavedCard({ locale = "ko" }) {
  const [status, setStatus] = useState("idle");
  const copy = locale === "en"
    ? {
        kicker: "SAVED REPORT",
        title: "Report saved",
        body: "The full report itself stays on the server. This browser only keeps a shortcut to reopen it.",
        button: "Copy report link",
        copied: "Link copied.",
        failed: "Could not copy automatically. Please copy the address from the browser."
      }
    : {
        kicker: "REPORT SAVED",
        title: "리포트 저장됨",
        body: "리포트 본문은 서버에 저장됩니다. 이 브라우저에는 다시 열기용 링크와 최근 열람 시간만 남깁니다.",
        button: "리포트 링크 복사",
        copied: "링크를 복사했습니다.",
        failed: "자동 복사가 제한되었습니다. 브라우저 주소를 직접 복사해 주세요."
      };

  const handleCopy = async () => {
    setStatus("idle");

    try {
      await copyTextWithFallback(getCurrentReportUrl());
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <section className="ui-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="ui-kicker">{copy.kicker}</p>
          <h3 className="ui-title mt-2 text-lg">{copy.title}</h3>
          <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.body}</p>
          {status !== "idle" ? (
            <p
              className={`mt-2 text-xs font-semibold ${
                status === "copied"
                  ? "text-emerald-600 dark:text-emerald-300"
                  : "text-amber-600 dark:text-amber-300"
              }`}
            >
              {status === "copied" ? copy.copied : copy.failed}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="ui-button-secondary shrink-0 px-4 py-3 text-sm font-semibold"
        >
          {copy.button}
        </button>
      </div>
    </section>
  );
}

function FullReportFeedbackCard({ locale = "ko", productId = null }) {
  const [mode, setMode] = useState("checking");
  const [customComment, setCustomComment] = useState("");
  const [storageKey, setStorageKey] = useState("");

  const copy = locale === "en"
    ? {
        title: "Was this result helpful?",
        helpful: "Helpful",
        notHelpful: "Could be better",
        thanks: "Thanks. We will use this to improve future recommendations.",
        reasonTitle: "What felt off?",
        otherPlaceholder: "Leave a short note",
        submit: "Submit",
        reasons: [
          { value: "product_mismatch", label: "Product fit feels off" },
          { value: "repetitive_text", label: "Explanations feel repetitive" },
          { value: "face_lab_unclear", label: "Face Lab feels unclear" },
          { value: "not_enough_detail", label: "Report feels too thin" },
          { value: "other", label: "Other" }
        ]
      }
    : {
        title: "결과가 도움이 되었나요?",
        helpful: "도움 됨",
        notHelpful: "아쉬움 있음",
        thanks: "감사합니다. 더 나은 추천에 반영할게요.",
        reasonTitle: "어떤 점이 아쉬웠나요?",
        otherPlaceholder: "짧게 남겨주세요",
        submit: "보내기",
        reasons: [
          { value: "product_mismatch", label: "추천 제품이 안 맞아요" },
          { value: "repetitive_text", label: "설명이 반복돼요" },
          { value: "face_lab_unclear", label: "Face Lab이 애매해요" },
          { value: "not_enough_detail", label: "내용이 부족해요" },
          { value: "other", label: "기타" }
        ]
      };

  useEffect(() => {
    const nextStorageKey = getFullReportFeedbackStorageKey(productId);
    setStorageKey(nextStorageKey);

    if (nextStorageKey && sessionStorage.getItem(nextStorageKey)) {
      setMode("submitted");
      return;
    }

    setMode("idle");
  }, [productId]);

  const submitFeedback = ({ rating, reason = null, comment = null }) => {
    if (mode === "submitted") {
      return;
    }

    if (storageKey) {
      sessionStorage.setItem(storageKey, JSON.stringify({
        rating,
        reason,
        submitted_at: new Date().toISOString()
      }));
    }

    trackEvent("feedback_response", {
      product_id: productId,
      feature_name: "skin_analysis",
      result_type: "full_report",
      question_id: "full_report_feedback",
      answer: rating,
      meta_json: {
        report_type: "full_report",
        rating,
        reason,
        comment
      }
    });
    setMode("submitted");
  };

  if (mode === "checking") {
    return null;
  }

  if (mode === "submitted") {
    return (
      <section className="ui-card p-5">
        <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{copy.thanks}</p>
      </section>
    );
  }

  return (
    <section className="ui-card p-5">
      <p className="ui-kicker">FEEDBACK</p>
      <h3 className="ui-title mt-2 text-lg">{copy.title}</h3>

      {mode === "idle" ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => submitFeedback({ rating: "helpful" })}
            className="ui-button-secondary px-4 py-3 text-sm font-medium"
          >
            {copy.helpful}
          </button>
          <button
            type="button"
            onClick={() => setMode("not_helpful")}
            className="ui-button-secondary px-4 py-3 text-sm font-medium"
          >
            {copy.notHelpful}
          </button>
        </div>
      ) : null}

      {mode === "not_helpful" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{copy.reasonTitle}</p>
          <div className="grid gap-2">
            {copy.reasons.map((reason) => (
              <button
                key={reason.value}
                type="button"
                onClick={() => {
                  if (reason.value === "other") {
                    setMode("other");
                    return;
                  }

                  submitFeedback({
                    rating: "not_helpful",
                    reason: reason.value
                  });
                }}
                className="ui-button-secondary justify-start px-4 py-3 text-left text-sm font-medium"
              >
                {reason.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {mode === "other" ? (
        <div className="mt-4 space-y-3">
          <textarea
            value={customComment}
            onChange={(event) => setCustomComment(event.target.value.slice(0, 400))}
            placeholder={copy.otherPlaceholder}
            className="min-h-24 w-full rounded-[1rem] border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
          <button
            type="button"
            onClick={() => submitFeedback({
              rating: "not_helpful",
              reason: "other",
              comment: customComment.trim() || null
            })}
            className="ui-button-primary min-h-12 w-full px-4 text-sm font-semibold"
          >
            {copy.submit}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function SituationVariantsSelector({ variants = [], avoidItems = [], locale = "ko" }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const labels = getSituationPrescriptionLabels(locale);

  useEffect(() => {
    setActiveIndex(0);
  }, [variants.length]);

  if (!variants.length) {
    return null;
  }

  const activeVariant = variants[Math.min(activeIndex, variants.length - 1)];
  const prescription = buildSituationPrescription(activeVariant, locale);

  return (
    <div className="mt-3 space-y-2.5">
      {variants.length > 1 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {variants.map((variant, index) => {
            const active = index === activeIndex;
            const buttonLabel = getSituationVariantButtonLabel(variant.label);

            return (
              <button
                key={variant.key || variant.label}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`ui-button-secondary min-h-12 whitespace-pre-line px-3 py-2.5 text-xs font-medium leading-tight ${active ? "ui-choice-active" : ""}`}
              >
                {buttonLabel}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="ui-card-subtle p-3">
        <p className="ui-kicker">{normalizeSituationVariantLabel(activeVariant.label)}</p>
        <div className="mt-2.5">
          <SituationPrescriptionBlock label={labels.today} body={prescription.today} compact />
        </div>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <SituationDecisionCard label={labels.keepDecision} items={prescription.keep} guide={prescription.usage} tone="keep" />
          <SituationDecisionCard label={labels.reduceDecision} items={prescription.reduce} guide={prescription.avoid} tone="reduce" />
          {prescription.add?.length ? <SituationPrescriptionBlock label={labels.add} items={prescription.add} compact /> : null}
        </div>
        <div className="mt-2.5">
          <AvoidCombinationList items={avoidItems} label={labels.commonAvoid} />
        </div>
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
              <p
                className="ui-title break-words text-sm leading-snug"
                style={{
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden"
                }}
              >
                {item.name}
              </p>
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

function SituationAdjustmentStep({ variants = [], avoidItems = [], copy, locale = "ko" }) {
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
          <SituationVariantsSelector variants={variants} avoidItems={avoidItems} locale={locale} />
        </section>
      ) : null}

      {!hasVariants && hasAvoidItems ? (
        <section className="ui-card p-6">
          <AvoidCombinationList items={avoidItems} label={copy.avoid} />
        </section>
      ) : null}
    </div>
  );
}

function buildStepAdvanceLabel(step, locale = "ko") {
  const label = String(step?.label || "").trim();

  if (!label) {
    return locale === "en" ? "See next section" : "다음 항목 보기";
  }

  return locale === "en" ? `See ${label}` : `${label} 보기`;
}

function getTodaySkinBaseline(result = {}, locale = "ko") {
  const axis = getReportPriorityAxis(result);

  if (locale === "en") {
    const summary = ["oiliness", "pores"].includes(axis)
      ? "Oil can rise through the T-zone, while the overall routine still needs steady, lightweight moisture."
      : "Moisture retention looks lower, and the skin may react more easily when the routine gets crowded.";

    return {
      title: "Current skin baseline",
      summary,
      chips: ["Moisture gap", "Barrier stress", "Oil balance"],
      cards: [
        { title: "Moisture gap", body: "Moisture does not stay long enough." },
        { title: "Barrier stress", body: "The skin may react to heavier routines." },
        { title: "Oil balance", body: "Oil can rise while moisture is still low." }
      ]
    };
  }

  const summary = ["oiliness", "pores"].includes(axis)
    ? "T존 유분은 올라오지만 전체적으로는 안정적인 보습 유지가 필요합니다."
    : "수분 유지력이 낮고, 자극에 쉽게 반응할 수 있는 상태입니다.";

  return {
    title: "현재 피부 기준",
    summary,
    chips: ["수분 부족", "장벽 스트레스", "유분 밸런스"],
    cards: [
      { title: "수분 부족", body: "수분 유지력이 낮음" },
      { title: "장벽 스트레스", body: "자극에 민감한 상태" },
      { title: "유분 밸런스", body: "T존 유분은 있으나 전체적 수분 부족" }
    ]
  };
}

function getPlanAnchorReasons(product = {}, result = {}, locale = "ko") {
  const category = normalizeReportCategory(product);
  const axis = getReportPriorityAxis(result);

  if (locale === "en") {
    if (category === "sunscreen") {
      return ["Simple UV finish", "Low routine conflict", "Easy morning anchor"];
    }
    if (["redness", "barrier"].includes(axis)) {
      return ["Lower irritation burden", "Moisture support", "Low routine conflict"];
    }
    return ["Hydration focus", "Lower irritation burden", "Low routine conflict"];
  }

  if (category === "sunscreen") {
    return ["아침 보호 연결", "자극 부담 낮음", "현재 루틴과 충돌 적음"];
  }
  if (["redness", "barrier"].includes(axis)) {
    return ["자극 부담 낮음", "수분 유지 보조", "현재 루틴과 충돌 적음"];
  }
  return ["수분 집중", "자극 부담 낮음", "현재 루틴과 충돌 적음"];
}

function getTodayAiJudgement(result = {}, locale = "ko") {
  const concern = getReportPriorityLabel(result, locale);

  if (locale === "en") {
    return {
      title: "AI judgment",
      body: `Because ${concern} is the current priority, it is better to reduce routine burden and keep moisture steady before adding more active steps.`,
      sub: "Keep the routine simple while checking whether the skin feels comfortable."
    };
  }

  return {
    title: "AI 판단",
    body: `지금은 ${concern} 흐름을 기준으로, 기능성을 늘리기보다 자극을 줄이고 수분을 유지하는 쪽이 우선입니다.`,
    sub: "피부가 편안하게 반응하는지 확인하면서 루틴을 단순하게 가져갑니다."
  };
}

function getPriorityActionItems(locale = "ko") {
  if (locale === "en") {
    return [
      {
        key: "pause-actives",
        badge: "Priority 1",
        title: "Pause new active steps",
        body: "Temporarily reduce retinol, exfoliation, vitamin C, and other steps that can add irritation.",
        detail: "Why it matters"
      },
      {
        key: "soft-cleanse",
        badge: "Priority 2",
        title: "Lower cleansing intensity",
        body: "Use enough foam or slip, then cleanse gently with less rubbing.",
        detail: "Details"
      },
      {
        key: "simple-morning",
        badge: "Priority 3",
        title: "Connect tomorrow morning to sunscreen",
        body: "Keep skincare minimal and finish the morning routine lightly with sunscreen.",
        detail: "Details"
      }
    ];
  }

  return [
    {
      key: "pause-actives",
      badge: "우선 1",
      title: "기능성 추가 멈추기",
      body: "레티놀, 각질제거, 비타민C 등 자극이 될 수 있는 기능성은 잠시 줄입니다.",
      detail: "왜 중요한가요?"
    },
    {
      key: "soft-cleanse",
      badge: "우선 2",
      title: "세안 강도 낮추기",
      body: "거품은 충분히 내고, 마찰을 줄여 부드럽게 세안합니다.",
      detail: "자세히"
    },
    {
      key: "simple-morning",
      badge: "우선 3",
      title: "내일 아침, 선크림까지 단순 연결",
      body: "스킨케어는 최소 단계로, 아침에는 선크림까지 가볍게 마무리합니다.",
      detail: "자세히"
    }
  ];
}

function getTodayCheckPoints(locale = "ko") {
  if (locale === "en") {
    return {
      title: "Watch points",
      body: "Lightly check daily skin reactions and separate comfortable signs from mismatch signs.",
      note: "Use the next 2 weeks as a reference window, not as a promised change period.",
      items: ["Dryness", "Stinging", "Afternoon oil", "Breakouts", "Makeup pilling"]
    };
  }

  return {
    title: "조심할 포인트",
    body: "피부 반응을 가볍게 확인하면서, 편한 신호와 안 맞는 신호를 나눠 봅니다.",
    note: "앞으로 참고할 체크 기준입니다.",
    items: ["건조감", "따가움", "오후 유분", "트러블", "화장 밀림"]
  };
}

function TodaySectionTitle({ number, title, body }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:gap-4">
      <h4 className="text-xl font-bold leading-tight text-[#ad6255] dark:text-[#f0b7a7]">
        <span>{number}. </span>{title}
      </h4>
      {body ? (
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
      ) : null}
    </div>
  );
}

function PriorityActionCard({ item }) {
  return (
    <article className="rounded-[1rem] border border-[#d7b6aa]/35 bg-white/5 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:border-[#7a4f4a]/40">
      <div className="flex h-full flex-col">
        <div className="flex items-start gap-3">
          <span className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[#f0b7a7] px-2 text-sm font-bold text-[#2a171b] shadow-[0_0_16px_rgba(240,183,167,0.18)]">
            {item.badge}
          </span>
          <h4 className="min-w-0 text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{item.title}</h4>
        </div>
        <p className="mt-3 flex-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.body}</p>
        <div className="mt-4">
          <span className="inline-flex min-h-9 items-center rounded-[0.75rem] border border-[#c99084]/45 px-4 text-xs font-semibold text-[#9f5b50] dark:text-[#f0b7a7]">
            {item.detail}
          </span>
        </div>
      </div>
    </article>
  );
}

function getSkinMatchHubActions(locale = "ko") {
  if (locale === "en") {
    return [
      {
        id: "routine",
        title: "Routine Consult",
        description: "AM and PM basic order",
        target: "morning-routine",
        icon: "☼"
      },
      {
        id: "functional",
        title: "Active Check",
        description: "What to add or wait on",
        target: "product-plan",
        icon: "⌁"
      },
      {
        id: "condition",
        title: "Condition Response",
        description: "Rules for unstable days",
        target: "adjustment-guide",
        icon: "!"
      },
      {
        id: "face-lab",
        title: "Face Lab",
        description: "Style direction connected to skin",
        target: "face-lab",
        icon: "✧"
      }
    ];
  }

  return [
    {
      id: "routine",
      title: "루틴 상담",
      description: "아침·저녁 기본 순서",
      target: "morning-routine",
      icon: "☼"
    },
    {
      id: "functional",
      title: "기능성 판단",
      description: "더할 것과 미룰 것",
      target: "product-plan",
      icon: "⌁"
    },
    {
      id: "condition",
      title: "컨디션 대응",
      description: "흔들릴 때 바꾸는 기준",
      target: "adjustment-guide",
      icon: "!"
    },
    {
      id: "face-lab",
      title: "Face Lab",
      description: "피부와 이어지는 스타일 방향",
      target: "face-lab",
      icon: "✧"
    }
  ];
}

function getDailyRoutineGuideIntro(locale = "ko") {
  return locale === "en"
    ? {
        kicker: "DAILY ROUTINE GUIDE",
        title: "Keep morning light and evening less burdensome.",
        body: "Morning is for a thin finish that works with sunscreen. Evening is for reducing friction and keeping the routine readable."
      }
    : {
        kicker: "하루 루틴 가이드",
        title: "아침은 밀리지 않게 가볍게, 저녁은 부담이 덜하게 정리합니다.",
        body: "제품을 더 많이 바르는 페이지가 아니라, 어느 순서로 얼마나 가볍게 쓸지 정리하는 기준입니다."
      };
}

function getRoutineGuideSteps(mode = "morning", freeResult = {}, steps = [], locale = "ko") {
  const sourceSteps = steps.length ? steps : buildRoutineFallbackSteps(mode, freeResult, locale);
  const title = mode === "morning"
    ? locale === "en" ? "AM" : "AM 루틴"
    : locale === "en" ? "PM" : "PM 루틴";

  return sourceSteps
    .map((step, index) => ({
      ...step,
      order: Number.isFinite(Number(step.order)) ? Number(step.order) : index + 1,
      routineMode: mode,
      stepName: normalizeRoutineStepTitle({ ...step, routineMode: mode }, title, sourceSteps.length, locale)
    }))
    .slice(0, 4);
}

function RoutineGuideStepCard({ step, copy, locale = "ko" }) {
  const action = getRoutineStepActionText(step, locale);
  const caution = getRoutineStepCautionText(step, locale);
  const product = step.product || null;
  const frequency = compactText(step.frequency);

  return (
    <article className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-[#f0b7a7]/90 px-2 text-xs font-bold text-[#2a171b]">
          {step.order}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{step.stepName}</p>
          <p className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{action}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {product ? (
          <div className="rounded-[0.85rem] border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              {locale === "en" ? "Product" : "사용할 제품"}
            </p>
            <p className="mt-1 break-words text-xs font-semibold leading-5 text-zinc-700 dark:text-zinc-300">
              {product.brand ? `${product.brand} · ` : ""}{product.name}
            </p>
          </div>
        ) : null}
        {frequency ? (
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {locale === "en" ? "Frequency" : "빈도"} · {frequency}
          </p>
        ) : null}
        {caution ? (
          <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {locale === "en" ? "Watch" : "주의"} · {caution}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function DailyRoutineGuideStep({ freeResult, morningSteps = [], nightSteps = [], copy, locale = "ko" }) {
  const intro = getDailyRoutineGuideIntro(locale);
  const amSteps = getRoutineGuideSteps("morning", freeResult, morningSteps, locale);
  const pmSteps = getRoutineGuideSteps("night", freeResult, nightSteps, locale);
  const groups = [
    {
      key: "am",
      title: locale === "en" ? "AM routine" : "AM 루틴",
      summary: locale === "en" ? "Thin layers, sunscreen finish." : "얇은 단계, 선크림 마무리",
      steps: amSteps
    },
    {
      key: "pm",
      title: locale === "en" ? "PM routine" : "PM 루틴",
      summary: locale === "en" ? "Gentle cleanse, simple finish." : "부드러운 세안, 단순한 마무리",
      steps: pmSteps
    }
  ];

  return (
    <div className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{intro.kicker}</p>
        <h3 className="ui-title mt-2 text-xl leading-tight">{intro.title}</h3>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{intro.body}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.key} className="ui-card p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-kicker">{group.title}</p>
                <h4 className="ui-title mt-2 text-lg leading-tight">{group.summary}</h4>
              </div>
              <span className="ui-chip-compact shrink-0">{group.steps.length}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {group.steps.map((step, index) => (
                <RoutineGuideStepCard
                  key={`${group.key}-${step.order}-${step.stepName}-${index}`}
                  step={step}
                  copy={copy}
                  locale={locale}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function collectUsageGuideProducts({ freeResult, report, alternativeItems = [], displayBudgetAlternatives = [] }) {
  const seen = new Set();
  const sourceItems = [
    freeResult?.topPick || null,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    ...alternativeItems,
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : []),
    ...displayBudgetAlternatives
  ];

  return sourceItems
    .map(unwrapSupportingProductItem)
    .filter(Boolean)
    .filter((product) => {
      const key = product.id || `${product.brand || ""}-${product.name || ""}`;

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 4);
}

function getProductUsageMeta(product = {}, result = {}, locale = "ko") {
  const category = normalizeReportCategory(product);
  const concern = getReportPriorityLabel(result, locale);
  const isEnglish = locale === "en";

  if (isEnglish) {
    if (category === "sunscreen") {
      return {
        role: "Morning protection finish",
        position: "Last AM skincare step",
        amount: "Use enough to cover the face evenly",
        frequency: "Every morning",
        pair: "Works after light moisture",
        reduce: "Reduce the previous moisturizer if it pills",
        caution: "Reapply on longer outdoor days"
      };
    }
    if (category === "cleanser") {
      return {
        role: "Routine reset step",
        position: "First PM step",
        amount: "Enough foam or slip to reduce rubbing",
        frequency: "Evening, and morning only when needed",
        pair: "Follow with the core product",
        reduce: "Shorten cleansing time if tightness appears",
        caution: "Avoid chasing a squeaky-clean finish"
      };
    }
    if (category === "moisturizer") {
      return {
        role: "Moisture finish",
        position: "After the core product",
        amount: "Thin layer first, add only if tight",
        frequency: "AM/PM as needed",
        pair: "Works with a simple serum or toner layer",
        reduce: "Reduce AM amount before makeup",
        caution: "If it feels heavy, reduce amount before switching products"
      };
    }

    return {
      role: `Core support for ${concern}`,
      position: "After cleansing, before heavier finish",
      amount: "Thin, even layer",
      frequency: "Start once daily or as guided",
      pair: "Pair with simple moisture and sunscreen in the morning",
      reduce: "Reduce frequency if stinging or breakouts appear",
      caution: "Do not stack with several strong active steps"
    };
  }

  if (category === "sunscreen") {
    return {
      role: "아침 보호 마무리",
      position: "AM 마지막 스킨케어 단계",
      amount: "얼굴 전체에 고르게 닿을 만큼",
      frequency: "매일 아침",
      pair: "가벼운 보습 다음에 연결",
      reduce: "밀리면 직전 보습량을 먼저 줄이기",
      caution: "야외 시간이 길면 덧바름 고려"
    };
  }
  if (category === "cleanser") {
    return {
      role: "루틴 정리 단계",
      position: "PM 첫 단계",
      amount: "마찰이 줄 만큼 충분한 거품/미끄러짐",
      frequency: "저녁 중심, 아침은 필요할 때만",
      pair: "세안 뒤 핵심 제품으로 연결",
      reduce: "당김이 있으면 세안 시간부터 줄이기",
      caution: "뽀득한 마무리를 목표로 하지 않기"
    };
  }
  if (category === "moisturizer") {
    return {
      role: "보습 마무리",
      position: "핵심 제품 다음",
      amount: "얇게 먼저, 당기면 소량 추가",
      frequency: "AM/PM 필요 기준",
      pair: "단순한 세럼/토너 단계와 연결",
      reduce: "아침 화장 전에는 양을 먼저 줄이기",
      caution: "답답하면 제품 교체보다 사용량부터 조정"
    };
  }

  return {
    role: `${concern} 기준 핵심 보조`,
    position: "세안 뒤, 무거운 마무리 전",
    amount: "얇고 고르게 한 번",
    frequency: "하루 1회부터 맞춰보기",
    pair: "단순 보습, 아침 선크림과 연결",
    reduce: "따가움이나 트러블이 보이면 빈도 줄이기",
    caution: "강한 기능성 여러 개와 겹치지 않기"
  };
}

function ProductUsageCard({ product, result, copy, locale = "ko", isPrimary = false }) {
  const meta = getProductUsageMeta(product, result, locale);
  const purchaseLink = getPurchaseLinkInfo(product, copy, locale);

  return (
    <article className={`rounded-[1.15rem] border p-4 ${
      isPrimary
        ? "border-[#d99a8e]/60 bg-[#efb09f]/10"
        : "border-white/10 bg-white/5"
    }`}>
      <div className="flex items-start gap-3">
        <ProductThumb product={product} copy={copy} sizeClass="h-20 w-16" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {isPrimary ? locale === "en" ? "Core product" : "중심 제품" : meta.role}
          </p>
          <p className="mt-1 break-words text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{product.name}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{product.brand}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {[
          [locale === "en" ? "Role" : "역할", meta.role],
          [locale === "en" ? "Position" : "사용 위치", meta.position],
          [locale === "en" ? "Amount" : "사용량", meta.amount],
          [locale === "en" ? "Frequency" : "빈도", meta.frequency],
          [locale === "en" ? "Pair with" : "같이 쓰기", meta.pair],
          [locale === "en" ? "Reduce when" : "줄일 때", meta.reduce],
          [locale === "en" ? "Watch" : "조심할 상황", meta.caution]
        ].map(([label, body]) => (
          <div key={label} className="grid grid-cols-[72px_minmax(0,1fr)] gap-2 text-sm leading-6">
            <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{label}</span>
            <span className="text-zinc-700 dark:text-zinc-300">{body}</span>
          </div>
        ))}
      </div>

      <a
        href={purchaseLink.href}
        target="_blank"
        rel="noreferrer"
        onClick={() =>
          trackEvent("click_buy_link", {
            product_id: product.id || null,
            feature_name: "skin_analysis",
            result_type: "full_report_product_usage",
            is_top_pick: isPrimary,
            meta_json: {
              button_label: purchaseLink.label,
              fallback_link: purchaseLink.isFallback
            }
          })
        }
        className="mt-4 inline-flex text-xs font-semibold text-zinc-500 underline decoration-zinc-400 underline-offset-4 transition hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
      >
        {purchaseLink.label}
      </a>
    </article>
  );
}

function ProductUsageGuideStep({ freeResult, report, alternativeItems = [], displayBudgetAlternatives = [], copy, locale = "ko" }) {
  const products = collectUsageGuideProducts({ freeResult, report, alternativeItems, displayBudgetAlternatives });

  return (
    <div className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{locale === "en" ? "PRODUCT USE GUIDE" : "제품별 사용 가이드"}</p>
        <h3 className="ui-title mt-2 text-xl leading-tight">
          {locale === "en" ? "Use each product by role, not by shopping appeal." : "추천 이유보다, 어떻게 써야 덜 헷갈리는지를 봅니다."}
        </h3>
        <p className="ui-text-secondary mt-2 text-sm leading-6">
          {locale === "en"
            ? "Each card focuses on position, amount, frequency, and when to reduce."
            : "각 제품은 사용 위치, 사용량, 빈도, 줄일 기준이 먼저 보이도록 정리했습니다."}
        </p>
      </section>

      <div className="grid gap-3">
        {products.map((product, index) => (
          <ProductUsageCard
            key={product.id || `${product.brand}-${product.name}-${index}`}
            product={product}
            result={freeResult}
            copy={copy}
            locale={locale}
            isPrimary={index === 0}
          />
        ))}
      </div>

      {!products.length ? <EmptyPlanCard locale={locale} /> : null}
    </div>
  );
}

function getRoutineAdjustmentCases(locale = "ko") {
  if (locale === "en") {
    return [
      { situation: "When it stings", reduce: "New active or exfoliating step", keep: "Gentle cleanse and simple moisture", watch: "Pause and seek professional advice if irritation is severe or persistent" },
      { situation: "When it feels dry", reduce: "Cleansing time and active frequency", keep: "Moisture finish", watch: "Do not add several products at once" },
      { situation: "When oil rises quickly", reduce: "Heavy AM moisturizer amount", keep: "Sunscreen", watch: "Avoid removing all moisture" },
      { situation: "When makeup pills", reduce: "Previous moisturizer or serum amount", keep: "Sunscreen", watch: "Check whether the step before sunscreen is too heavy" },
      { situation: "When breakouts appear", reduce: "Most recently added product", keep: "Simple calming routine", watch: "Avoid pushing the whole face aggressively" },
      { situation: "When sunscreen pills", reduce: "AM layers before sunscreen", keep: "Enough sunscreen", watch: "Give the previous step time to settle" }
    ];
  }

  return [
    { situation: "따가울 때", reduce: "새 기능성 또는 각질 단계", keep: "부드러운 세안과 단순 보습", watch: "자극이 심하거나 지속되면 중단하고 상담이 필요합니다" },
    { situation: "건조할 때", reduce: "세안 시간과 기능성 빈도", keep: "보습 마무리", watch: "제품을 여러 개 한 번에 더하지 않습니다" },
    { situation: "유분이 빨리 올라올 때", reduce: "아침 보습량", keep: "선크림", watch: "수분 단계를 전부 빼지는 않습니다" },
    { situation: "화장이 밀릴 때", reduce: "직전 보습제나 세럼 양", keep: "선크림", watch: "선크림 직전 단계가 너무 무거운지 확인합니다" },
    { situation: "트러블이 올라올 때", reduce: "가장 최근 추가한 제품", keep: "단순 진정 루틴", watch: "얼굴 전체를 강하게 관리하지 않습니다" },
    { situation: "선크림이 밀릴 때", reduce: "선크림 전 아침 단계 수", keep: "선크림 충분량", watch: "직전 단계가 자리 잡을 시간을 둡니다" }
  ];
}

function RoutineAdjustmentGuideStep({ variants = [], avoidItems = [], locale = "ko" }) {
  const cases = getRoutineAdjustmentCases(locale);
  const guardItems = uniqueDisplayTexts([
    ...(locale === "en"
      ? ["Reduce steps before adding products", "Keep sunscreen in the morning", "Add new products one at a time"]
      : ["제품을 더하기 전에 단계를 먼저 줄이기", "아침 선크림은 유지하기", "새 제품은 하나씩만 추가하기"]),
    ...avoidItems
  ]).slice(0, 4);
  const variantNotes = (Array.isArray(variants) ? variants : [])
    .map((variant) => normalizeSituationVariantLabel(variant?.label))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{locale === "en" ? "ADJUSTMENT GUIDE" : "상황별 조정법"}</p>
        <h3 className="ui-title mt-2 text-xl leading-tight">
          {locale === "en"
            ? "If the skin feels uncomfortable, reduce steps before adding products."
            : "피부가 불편하면 제품을 더하지 말고, 먼저 단계를 줄이는 쪽이 안전합니다."}
        </h3>
        <p className="ui-text-secondary mt-2 text-sm leading-6">
          {locale === "en"
            ? "Use the situation cards as small adjustment rules, not as fixed instructions."
            : "상황 카드는 고정 지시가 아니라, 루틴을 덜 헷갈리게 조정하는 기준입니다."}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {cases.map((item) => (
          <article key={item.situation} className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.situation}</p>
            <div className="mt-3 space-y-2 text-sm leading-6">
              <p className="text-zinc-700 dark:text-zinc-300"><span className="font-semibold text-zinc-900 dark:text-zinc-100">{locale === "en" ? "Reduce" : "먼저 줄일 것"} · </span>{item.reduce}</p>
              <p className="text-zinc-700 dark:text-zinc-300"><span className="font-semibold text-zinc-900 dark:text-zinc-100">{locale === "en" ? "Keep" : "유지할 것"} · </span>{item.keep}</p>
              <p className="text-zinc-700 dark:text-zinc-300"><span className="font-semibold text-zinc-900 dark:text-zinc-100">{locale === "en" ? "Watch" : "조심할 것"} · </span>{item.watch}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{locale === "en" ? "COMMON GUARDRAILS" : "공통 조정 기준"}</p>
        <div className="mt-3 grid gap-2">
          {guardItems.map((item) => (
            <p key={item} className="rounded-[0.9rem] border border-white/10 bg-white/5 px-3 py-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {item}
            </p>
          ))}
        </div>
        {variantNotes.length ? (
          <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {locale === "en" ? "Also referenced: " : "함께 참고: "}{variantNotes.join(" / ")}
          </p>
        ) : null}
      </section>
    </div>
  );
}

function RoutineSummaryStep({ freeResult, morningSteps = [], nightSteps = [], copy, locale = "ko" }) {
  const checkPoints = getTodayCheckPoints(locale);
  const amSteps = getRoutineGuideSteps("morning", freeResult, morningSteps, locale).slice(0, 4);
  const pmSteps = getRoutineGuideSteps("night", freeResult, nightSteps, locale).slice(0, 4);
  const isEnglish = locale === "en";
  const summaryGroups = isEnglish
    ? [
        { title: "Do today", items: ["Use the core product thinly", "Finish AM with sunscreen", "Keep PM simple"] },
        { title: "Reduce", items: ["New active stacking", "Strong cleansing and rubbing", "Heavy AM finish"] },
        { title: "Watch", items: ["Stinging", "Dryness", "Breakouts or pilling"] }
      ]
    : [
        { title: "오늘 할 것", items: ["핵심 제품은 얇게 사용", "아침은 선크림까지 마무리", "저녁은 단순하게 정리"] },
        { title: "줄일 것", items: ["새 기능성 중복", "강한 세안과 마찰", "무거운 아침 마무리"] },
        { title: "조심할 것", items: ["따가움", "건조감", "트러블 또는 밀림"] }
      ];
  const safetyText = isEnglish
    ? "This report is a skincare reference guide based on your inputs and product characteristics. If you have a skin disease, severe irritation, or persistent breakouts, professional consultation is needed."
    : "본 리포트는 입력한 정보와 제품 특성을 바탕으로 한 스킨케어 참고 가이드입니다. 피부질환, 심한 자극, 지속적인 트러블이 있다면 전문가 상담이 필요합니다.";

  return (
    <div className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{isEnglish ? "FINAL SUMMARY" : "최종 요약"}</p>
        <h3 className="ui-title mt-2 text-xl leading-tight">
          {isEnglish ? "Save the small rules, not a long plan." : "긴 설명보다, 다시 볼 기준만 남깁니다."}
        </h3>
        <p className="ui-text-secondary mt-2 text-sm leading-6">
          {isEnglish
            ? "Use this page as the quick version when you revisit the routine."
            : "나중에 다시 볼 때는 이 페이지의 체크리스트만 확인해도 흐름을 잡을 수 있습니다."}
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        {summaryGroups.map((group) => (
          <section key={group.title} className="ui-card p-4">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{group.title}</p>
            <div className="mt-3 space-y-2">
              {group.items.map((item) => (
                <p key={item} className="flex gap-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#d98272]" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{isEnglish ? "AM / PM SUMMARY" : "AM / PM 최종 루틴 요약"}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            [isEnglish ? "AM" : "AM 루틴", amSteps],
            [isEnglish ? "PM" : "PM 루틴", pmSteps]
          ].map(([title, steps]) => (
            <div key={title} className="rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
              <div className="mt-3 space-y-2">
                {steps.map((step) => (
                  <p key={`${title}-${step.order}-${step.stepName}`} className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                    {step.order}. {getRoutineStepActionText(step, locale)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="ui-card p-5 sm:p-6">
        <p className="ui-kicker">{isEnglish ? "SIGNALS TO CHECK" : "체크할 신호"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {checkPoints.items.map((item) => (
            <span key={item} className="ui-chip-compact px-3 py-1.5">{item}</span>
          ))}
        </div>
        <p className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {safetyText}
        </p>
      </section>
    </div>
  );
}

function buildRoutineFallbackSteps(mode = "morning", freeResult = {}, locale = "ko") {
  const product = freeResult?.topPick || null;
  const isMorning = mode === "morning";

  if (locale === "en") {
    return [
      {
        order: 1,
        stepName: isMorning ? "Light reset" : "Gentle cleanse",
        productRole: "",
        product: null,
        instruction: isMorning ? "Start with water cleansing or a gentle cleanse. Do not strip the skin to feel clean." : "Remove sunscreen and residue without extending rubbing time.",
        frequency: isMorning ? "Every morning" : "Every night",
        caution: isMorning ? "Skip strong exfoliating steps in the morning." : "Do not make cleansing stronger to compensate for a heavy routine."
      },
      {
        order: 2,
        stepName: isMorning ? "Core product" : "Recovery center",
        productRole: "",
        product,
        instruction: isMorning ? "Use the core product thinly enough that sunscreen can sit well on top." : "Keep the routine centered on the core product and avoid stacking actives.",
        frequency: isMorning ? "Every morning" : "Every night",
        caution: isMorning ? "If it pills, reduce the previous layer." : "If the skin stings, pause new products first."
      },
      {
        order: 3,
        stepName: isMorning ? "Sunscreen finish" : "Moisture finish",
        productRole: "",
        product: null,
        instruction: isMorning ? "Finish with enough sunscreen and let it settle before makeup." : "Close with moisture so the skin can feel comfortable overnight.",
        frequency: isMorning ? "Every morning" : "Every night",
        caution: isMorning ? "Do not replace sunscreen with heavier base makeup." : "Do not add another active step just because the routine feels short."
      }
    ];
  }

  return [
    {
      order: 1,
      stepName: isMorning ? "가벼운 정돈" : "부드러운 세안",
      productRole: "",
      product: null,
      instruction: isMorning ? "수분감이 끊기지 않게 얇게 압축합니다." : "뽀득하게 벗기기보다 잔여감만 부드럽게 정리합니다.",
      frequency: isMorning ? "매일 아침" : "매일 저녁",
      caution: isMorning ? "아침에는 강한 각질 단계를 쉬어갑니다." : "무거운 루틴을 보완하려고 세안을 더 강하게 하지 않습니다."
    },
    {
      order: 2,
      stepName: isMorning ? "핵심 제품" : "핵심 정리 단계",
      productRole: "",
      product,
      instruction: isMorning ? "다음 단계가 밀리지 않게 얇게 둡니다." : "세안 → 핵심 제품 → 보습 마무리 순서로 단순하게 갑니다.",
      frequency: isMorning ? "매일 아침" : "매일 저녁",
      caution: isMorning ? "밀리면 앞 단계 사용량부터 줄입니다." : "따가우면 새로 추가한 제품부터 멈춥니다."
    },
    {
      order: 3,
      stepName: isMorning ? "선크림 마무리" : "보습 마무리",
      productRole: "",
      product: null,
      instruction: isMorning ? "아침 마무리는 선크림을 충분량으로 끝냅니다." : "따가움이나 당김이 있으면 편한 보습만 남깁니다.",
      frequency: isMorning ? "매일 아침" : "매일 저녁",
      caution: isMorning ? "밀리면 보습량을 줄이고 흡수 시간을 둡니다." : "기능성은 한 번에 하나만, 매일 겹치지 않습니다."
    }
  ];
}

function getRoutineConsultMeta(mode = "morning", locale = "ko") {
  const isMorning = mode === "morning";

  if (locale === "en") {
    return {
      title: isMorning
        ? "Keep the morning thin and connect it to sunscreen."
        : "Evening is for lowering burden, not adding more.",
      body: isMorning
        ? "Instead of adding many layers, keep the order thin enough that it does not pill and can reach the protection step."
        : "After cleansing, keep the order simple enough for the skin to feel comfortable, and do not stack several active steps at once.",
      chips: isMorning
        ? ["Thin layers", "Sunscreen fixed", "Adjust moisture"]
        : ["Gentle cleanse", "No active stacking", "Moisture finish"]
    };
  }

  return {
    title: isMorning
      ? "아침은 얇게, 선크림까지 이어지게 씁니다."
      : "저녁은 더 넣는 시간이 아니라, 부담을 줄이는 시간입니다.",
    body: isMorning
      ? "제품을 많이 바르기보다, 밀리지 않게 얇게 정리하고 보호 단계까지 연결합니다."
      : "세안 후 피부가 편하게 받아들이는 순서로 단순하게 정리하고, 기능성은 한 번에 여러 개 겹치지 않습니다.",
    chips: isMorning
      ? ["얇게 쌓기", "선크림 고정", "보습량 조절"]
      : ["부드러운 세안", "기능성 중복 금지", "보습 마무리"]
  };
}

function getRoutineConsultTemplates(mode = "morning", locale = "ko") {
  const isMorning = mode === "morning";

  if (locale === "en") {
    return isMorning
      ? [
          {
            order: 1,
            slot: "prep",
            title: "Light reset",
            status: "Keep",
            action: "Keep hydration from breaking by resetting lightly.",
            adjustment: "If it feels tight, press it in instead of wiping.",
            roles: ["toner_essence", "serum_ampoule"]
          },
          {
            order: 2,
            slot: "hydrate",
            title: "Moisture support",
            status: "As needed",
            action: "Keep this layer thin so the next step does not pill.",
            adjustment: "If makeup pills, reduce this amount first.",
            roles: ["serum_ampoule", "moisturizer"]
          },
          {
            order: 3,
            slot: "protect",
            title: "Protection finish",
            status: "Fixed",
            action: "Finish the morning with sunscreen.",
            adjustment: "Let the previous step settle, then spread it thinly.",
            roles: ["sunscreen"]
          }
        ]
      : [
          {
            order: 1,
            slot: "cleanse",
            title: "Cleanse",
            status: "Keep",
            action: "Gently remove residue instead of chasing a stripped finish.",
            adjustment: "If tightness is strong, lower cleansing intensity.",
            roles: ["cleanser"]
          },
          {
            order: 2,
            slot: "prep",
            title: "Texture reset",
            status: "Skippable",
            action: "Lightly reset after cleansing so moisture can follow.",
            adjustment: "If it stings or feels tight, skip this step.",
            roles: ["toner_essence", "serum_ampoule"]
          },
          {
            order: 3,
            slot: "moisturize",
            title: "Moisture finish",
            status: "Fixed",
            action: "If it stings or feels tight, leave only comfortable moisture.",
            adjustment: "On dry days, reinforce only this step with a small amount.",
            roles: ["moisturizer"]
          }
        ];
  }

  return isMorning
    ? [
        {
          order: 1,
          slot: "prep",
          title: "가벼운 정리",
          status: "유지",
          action: "수분감이 끊기지 않게 가볍게 정리합니다.",
          adjustment: "당김이 있으면 닦아내기보다 흡수시키는 방식으로 씁니다.",
          roles: ["toner_essence", "serum_ampoule"]
        },
        {
          order: 2,
          slot: "hydrate",
          title: "수분 보완",
          status: "필요 시",
          action: "다음 단계가 밀리지 않게 얇게 둡니다.",
          adjustment: "화장이 밀리면 이 단계의 양을 먼저 줄입니다.",
          roles: ["serum_ampoule", "moisturizer"]
        },
        {
          order: 3,
          slot: "protect",
          title: "보호 마무리",
          status: "고정",
          action: "아침 마지막은 선크림으로 마무리합니다.",
          adjustment: "직전 단계가 충분히 흡수된 뒤 얇게 펴 바릅니다.",
          roles: ["sunscreen"]
        }
      ]
    : [
        {
          order: 1,
          slot: "cleanse",
          title: "세안",
          status: "유지",
          action: "뽀득하게 벗기기보다 잔여감만 부드럽게 정리합니다.",
          adjustment: "당김이 심하면 세안 강도를 낮추는 쪽으로 봅니다.",
          roles: ["cleanser"]
        },
        {
          order: 2,
          slot: "prep",
          title: "결 정리",
          status: "생략 가능",
          action: "세안 후 보습이 이어지도록 가볍게 정돈합니다.",
          adjustment: "따가움이나 당김이 있으면 이 단계는 쉬어갑니다.",
          roles: ["toner_essence", "serum_ampoule"]
        },
        {
          order: 3,
          slot: "moisturize",
          title: "보습 마무리",
          status: "고정",
          action: "따가움이나 당김이 있으면 편한 보습만 남깁니다.",
          adjustment: "건조한 날은 이 단계만 소량 보강합니다.",
          roles: ["moisturizer"]
        }
      ];
}

function getRoutineProductKey(product) {
  return product?.id || `${product?.brand || ""}-${product?.name || ""}`;
}

function collectRoutineConsultProducts({ freeResult, report, morningSteps = [], nightSteps = [] }) {
  const seen = new Set();
  const sourceItems = [
    ...morningSteps.map((step) => step?.product || null),
    ...nightSteps.map((step) => step?.product || null),
    freeResult?.topPick || null,
    ...(Array.isArray(report?.supportingProducts) ? report.supportingProducts : []),
    freeResult?.alternative || null,
    ...(Array.isArray(freeResult?.altPicks) ? freeResult.altPicks : [])
  ];

  return sourceItems
    .map(unwrapSupportingProductItem)
    .filter(Boolean)
    .filter((product) => {
      const key = getRoutineProductKey(product);

      if (!key || seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

function pickRoutineConsultProduct(candidates, roles = [], fallbackProduct = null, usedKeys = new Set()) {
  const matchesRole = (product) => roles.includes(normalizeReportCategory(product));
  const matched = candidates.find((product) => {
    const key = getRoutineProductKey(product);
    return key && !usedKeys.has(key) && matchesRole(product);
  });
  const fallbackKey = getRoutineProductKey(fallbackProduct);
  const fallback = fallbackKey && !usedKeys.has(fallbackKey) && matchesRole(fallbackProduct) ? fallbackProduct : null;
  const product = matched || fallback;
  const key = getRoutineProductKey(product);

  if (key) {
    usedKeys.add(key);
  }

  return product;
}

function buildRoutineConsultSteps({
  mode = "morning",
  freeResult,
  report,
  morningSteps = [],
  nightSteps = [],
  locale = "ko",
  currentProductSlots = null
}) {
  const sourceSteps = mode === "morning"
    ? (morningSteps.length ? morningSteps : buildRoutineFallbackSteps("morning", freeResult, locale))
    : (nightSteps.length ? nightSteps : buildRoutineFallbackSteps("night", freeResult, locale));
  const candidates = collectRoutineConsultProducts({ freeResult, report, morningSteps, nightSteps });
  const usedKeys = new Set();
  const slotMode = mode === "morning" ? "am" : "pm";

  return getRoutineConsultTemplates(mode, locale).map((template, index) => ({
    ...template,
    product: pickRoutineConsultProduct(candidates, template.roles, sourceSteps[index]?.product || null, usedKeys),
    currentProducts: Array.isArray(currentProductSlots?.[slotMode]?.[template.slot])
      ? currentProductSlots[slotMode][template.slot]
      : []
  }));
}

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
        <ProductThumb product={product} copy={copy} sizeClass="h-12 w-10" />
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

function RoutineConsultStepCard({ step, direction = "left", locale = "ko", copy }) {
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
          <CurrentProductSlotNote items={step.currentProducts} />
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

function RoutineExecutionStep({ freeResult, report, morningSteps = [], nightSteps = [], copy, locale = "ko", onNavigate }) {
  const [activeMode, setActiveMode] = useState("morning");
  const routineTopRef = useRef(null);
  const meta = getRoutineConsultMeta(activeMode, locale);
  const currentProductSlots = buildCurrentProductRoutineSlots(report?.currentProducts, locale);
  const displaySteps = buildRoutineConsultSteps({
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
                onClick={() => switchToMode(modeKey)}
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

        <div key={activeMode} className="grid gap-4 overflow-hidden py-1">
          {displaySteps.map((step, index) => (
            <RoutineConsultStepCard
              key={`${activeMode}-${step.order}-${step.title}`}
              step={step}
              direction={index % 2 === 1 ? "right" : "left"}
              copy={copy}
              locale={locale}
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
                ? "Check these in the active judgment section rather than adding them to the routine here."
                : "여기서 루틴을 늘리기보다 별도 기능성 판단에서 확인합니다."}
            </p>
            <CurrentProductSlotNote items={functionalCurrentProducts} compact />
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
            : locale === "en" ? "See active check" : "기능성 판단 보기"}
        </button>
      </div>
    </section>
  );
}

function getAvoidPlanCards(avoidItems = [], locale = "ko") {
  const avoid = uniqueDisplayTexts(avoidItems);

  if (locale === "en") {
    return [
      {
        label: "Avoid this first",
        body: "Do not add two or more new products at the same time.",
        items: ["Add one product at a time", "Watch the skin before adding another step"],
        priority: true
      },
      {
        label: "Wasteful combination",
        body: "Buying several new active products at once makes it harder to know what is helping.",
        items: ["Add only one new product at a time", "Do not duplicate products with the same role"]
      },
      {
        label: "Can make skin more reactive",
        body: avoid[0] || "Strong cleansing, high-friction pads, and active serum in one routine can push the skin too far.",
        items: ["Reduce friction first", "Pause strong exfoliating steps on reactive days"]
      },
      {
        label: "Reduce today",
        body: "Start by reducing cleansing time, extra functional steps, and heavy finish layers.",
        items: ["Cleansing intensity", "Extra actives", "Thick finish"]
      }
    ];
  }

  return [
    {
      label: "가장 먼저 피할 것",
      body: "새 제품을 한 번에 2개 이상 추가하지 마세요.",
      items: ["하나씩 추가하기", "피부 반응 보고 다음 단계로 가기"],
      priority: true
    },
    {
      label: "돈 버리는 조합",
      body: "새 기능성 제품을 한꺼번에 늘리면 무엇이 맞는지 알기 어렵고, 결국 루틴만 복잡해집니다.",
      items: ["새 제품은 한 번에 하나만", "같은 역할 제품 중복 구매 줄이기"]
    },
    {
      label: "피부를 더 예민하게 만들 수 있는 조합",
      body: avoid[0] || "강한 세안, 마찰 큰 패드, 고기능 세럼을 한 루틴에 겹치면 피부가 버거울 수 있습니다.",
      items: ["마찰 먼저 줄이기", "예민한 날 강한 각질 단계 쉬기"]
    },
    {
      label: "오늘 줄일 것",
      body: "세안 시간, 기능성 추가 단계, 무거운 마감 제품부터 줄입니다.",
      items: ["세안 강도", "추가 기능성", "두꺼운 마무리"]
    }
  ];
}

function AvoidListStep({ avoidItems = [], locale = "ko" }) {
  const cards = getAvoidPlanCards(avoidItems, locale);

  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">{locale === "en" ? "AVOID FIRST" : "먼저 피할 것"}</p>
      <h3 className="ui-title mt-2 text-xl leading-tight">
        {locale === "en" ? "Reduce trial-and-error before adding more products." : "더 사기 전에, 먼저 겹치지 않게 줄입니다."}
      </h3>
      <p className="ui-text-secondary mt-2 text-sm leading-6">
        {locale === "en"
          ? "This is a practical guardrail, not a scare list. It keeps the routine easier to read."
          : "공포 마케팅이 아니라 시행착오와 낭비를 줄이는 실전 회피 가이드입니다."}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`rounded-[1rem] border px-3 py-3 ${
              card.priority
                ? "border-amber-300/40 bg-amber-500/15 sm:col-span-2"
                : "border-amber-300/20 bg-amber-500/10"
            }`}
          >
            <p className={`${card.priority ? "text-[12px]" : "text-[11px]"} font-semibold text-amber-700 dark:text-amber-200`}>
              {card.label}
            </p>
            <p className={`${card.priority ? "mt-2 text-[15px] font-semibold" : "mt-2 text-sm"} leading-6 text-zinc-700 dark:text-zinc-300`}>
              {card.body}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {card.items.map((item) => (
                <span key={item} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getAdjustmentSymptomPlans(locale = "ko") {
  if (locale === "en") {
    return [
      {
        key: "dry",
        label: "Dry",
        title: "If it feels dry",
        body: "Do not add more actives. Lower cleansing burden and strengthen the finish.",
        steps: ["Lower cleansing intensity", "Strengthen the moisture finish", "Reduce active frequency"]
      },
      {
        key: "stinging",
        label: "Stinging",
        title: "If it stings",
        body: "Pause what changed most recently and simplify toward calming and barrier comfort.",
        steps: ["Stop newly added products", "Keep calming and barrier support only", "Pause exfoliation, retinol, and vitamin C"]
      },
      {
        key: "oily",
        label: "Oily",
        title: "If it gets shiny",
        body: "Do not simply remove all moisture. Adjust texture and shorten the morning stack.",
        steps: ["Change texture before cutting moisture entirely", "Reduce morning steps", "Check sunscreen finish"]
      },
      {
        key: "breakout",
        label: "Breakout",
        title: "If breakouts appear",
        body: "Suspect the newest addition first and observe with a calming routine for a few days.",
        steps: ["Check the most recently added product", "Pause heavier oily-finish products", "Observe with calming care for 3 to 5 days"]
      }
    ];
  }

  return [
    {
      key: "dry",
      label: "건조",
      title: "건조하면",
      body: "기능성을 더 넣기보다 세안 부담과 마무리 보습부터 조정합니다.",
      steps: ["세안 강도 낮추기", "보습 마무리 강화", "기능성 빈도 줄이기"]
    },
    {
      key: "stinging",
      label: "따가움",
      title: "따가우면",
      body: "최근 추가한 것부터 멈추고 진정, 장벽 위주로 단순화합니다.",
      steps: ["새 제품 중단", "진정/장벽 위주로 단순화", "각질/레티놀/비타민C 계열 보류"]
    },
    {
      key: "oily",
      label: "번들거림",
      title: "번들거리면",
      body: "보습량을 무조건 줄이기보다 제형과 아침 단계 수를 먼저 조정합니다.",
      steps: ["보습량보다 제형 먼저 조정", "아침 루틴 단계 축소", "선크림 피니시 확인"]
    },
    {
      key: "breakout",
      label: "트러블",
      title: "트러블이 올라오면",
      body: "최근 추가 제품부터 의심하고 3~5일은 진정 루틴으로 관찰합니다.",
      steps: ["최근 추가 제품부터 의심", "유분감 높은 제품 일시 중단", "진정 루틴으로 3~5일 관찰"]
    }
  ];
}

function getAdjustmentSafetyItems(locale = "ko") {
  return locale === "en"
    ? [
        "Add new products one at a time.",
        "If it stings, lower irritation burden before actives.",
        "If breakouts appear, pause the most recently added product first.",
        "If dryness is severe, adjust cleansing intensity and moisture finish first."
      ]
    : [
        "새 제품은 하나씩만 추가합니다.",
        "따가움이 있으면 기능성보다 부담을 낮추는 기준을 먼저 봅니다.",
        "트러블이 올라오면 최근 추가한 제품부터 멈춥니다.",
        "건조함이 심하면 세안 강도와 마무리 보습부터 조정합니다."
      ];
}

function AdjustmentGuideStep({ variants = [], avoidItems = [], locale = "ko" }) {
  const plans = getAdjustmentSymptomPlans(locale);
  const [activeKey, setActiveKey] = useState(plans[0]?.key || "dry");
  const activePlan = plans.find((plan) => plan.key === activeKey) || plans[0];
  const variantNotes = (Array.isArray(variants) ? variants : [])
    .map((variant) => ({
      label: normalizeSituationVariantLabel(variant?.label),
      items: uniqueDisplayTexts(variant?.items || []).slice(0, 2)
    }))
    .filter((variant) => variant.label && variant.items.length)
    .slice(0, 2);

  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">{locale === "en" ? "IF THEN GUIDE" : "IF-THEN 조정법"}</p>
      <h3 className="ui-title mt-2 text-xl leading-tight">
        {locale === "en" ? "When it does not fit, adjust one lever at a time." : "안 맞을 때는 하나씩 줄이고 바꿉니다."}
      </h3>
      <p className="ui-text-secondary mt-2 text-sm leading-6">
        {locale === "en"
          ? "Use the tabs by symptom. The point is to keep the plan moving without guessing."
          : "증상별 탭으로 바로 조정합니다. 새 제품을 더하기보다 원인을 좁히는 방식입니다."}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {plans.map((plan) => {
          const active = plan.key === activePlan.key;

          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => setActiveKey(plan.key)}
              className={`ui-button-secondary min-h-11 px-3 py-2 text-xs font-semibold ${active ? "ui-choice-active" : ""}`}
            >
              {plan.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
        <p className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">{activePlan.title}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{activePlan.body}</p>
        <div className="mt-3 space-y-2">
          {activePlan.steps.map((step, index) => (
            <div key={step} className="flex gap-2 rounded-[0.9rem] bg-white/5 px-3 py-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {variantNotes.length ? (
        <div className="mt-3 rounded-[1rem] border border-white/10 bg-white/5 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
            {locale === "en" ? "Extra daily variables" : "상황별 추가 변수"}
          </p>
          <div className="mt-2 space-y-2">
            {variantNotes.map((variant) => (
              <div key={variant.label}>
                <p className="text-sm font-semibold leading-6 text-zinc-900 dark:text-zinc-100">{variant.label}</p>
                <p className="text-sm leading-6 text-zinc-700 dark:text-zinc-300">{variant.items.join(" / ")}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <AvoidCombinationList
          items={getAdjustmentSafetyItems(locale)}
          label={locale === "en" ? "Common safe boundary" : "공통 안전선"}
          limit={4}
        />
      </div>
    </section>
  );
}

function EmptyPlanCard({ locale = "ko" }) {
  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">{locale === "en" ? "PLAN NOTE" : "플랜 메모"}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        {locale === "en"
          ? "There are no additional products to show, so keep the current routine simple and follow the morning and evening order first."
          : "추가 제품 후보가 없어서, 현재 루틴을 단순하게 유지하고 아침/저녁 순서부터 먼저 따라가면 됩니다."}
      </p>
    </section>
  );
}

function StoreLinksSummaryCta({ locale = "ko" }) {
  const isEnglish = locale === "en";

  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">{isEnglish ? "STORE LINKS" : "구매 동선 정리"}</p>
      <h3 className="ui-title mt-2 text-lg leading-tight">
        {isEnglish ? "See the routine products together." : "내 루틴 제품 한 번에 보기"}
      </h3>
      <p className="ui-text-secondary mt-2 text-sm leading-6">
        {isEnglish
          ? "Routine steps keep store links light. Product and alternative links are gathered here."
          : "루틴 중간에서는 판매처 링크를 가볍게 두고, 제품과 대체 후보는 이 섹션에서 모아봅니다."}
      </p>
      <button
        type="button"
        onClick={() => {
          if (typeof document === "undefined") {
            return;
          }

          document.getElementById("skin-match-store-links")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
          });
        }}
        className="ui-button-secondary mt-4 min-h-11 w-full justify-center px-4 text-sm font-semibold"
      >
        {isEnglish ? "View product links" : "추천 제품 모아보기"}
      </button>
    </section>
  );
}

function AlternativeBudgetPlanStep({ alternativeItems = [], displayBudgetAlternatives = [], budgetSectionTitle, copy, locale = "ko" }) {
  const hasAlternatives = alternativeItems.length > 0;
  const hasBudget = displayBudgetAlternatives.length > 0;
  const hasStoreLinks = hasAlternatives || hasBudget;

  return (
    <div className="space-y-4">
      <section className="ui-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-kicker">{locale === "en" ? "SAFE ROUTES" : "안전한 우회로"}</p>
            <h3 className="ui-title mt-2 text-xl leading-tight">{copy.alternativesTitle}</h3>
            <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.alternativesBody}</p>
          </div>
          <span className="ui-chip-compact shrink-0">{alternativeItems.length + displayBudgetAlternatives.length}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(locale === "en"
            ? ["Lower price", "Gentler", "Texture swap", "Role swap"]
            : ["더 저렴하게", "더 순하게", "제형 바꾸기", "역할별 대체"]
          ).map((item) => (
            <span key={item} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {item}
            </span>
          ))}
        </div>
      </section>

      {hasStoreLinks ? (
        <div id="skin-match-store-links" className="space-y-4 scroll-mt-4">
          {hasAlternatives ? (
            <AlternativeCarousel items={alternativeItems} copy={copy} locale={locale} />
          ) : null}

          {hasBudget ? (
            <BudgetAlternativesStep
              items={displayBudgetAlternatives}
              title={budgetSectionTitle || copy.budget}
              copy={copy}
              locale={locale}
            />
          ) : null}
        </div>
      ) : null}

      {hasStoreLinks ? <StoreLinksSummaryCta locale={locale} /> : null}

      {!hasAlternatives && !hasBudget ? <EmptyPlanCard locale={locale} /> : null}
    </div>
  );
}

function FaceLabReadyCard({ copy, locale = "ko", onOpenFaceLab }) {
  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">FACE LAB</p>
      <h3 className="ui-title mt-2 text-lg leading-tight">{copy.faceLabReadyTitle}</h3>
      <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.faceLabReadyBody}</p>
      <button
        type="button"
        onClick={onOpenFaceLab}
        className="ui-button-secondary mt-4 min-h-11 w-full justify-center px-4 text-sm font-semibold"
      >
        {copy.faceLabReadyButton || (locale === "en" ? "Check Face Lab" : "Face Lab 확인하기")}
      </button>
    </section>
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
  budgetSectionTitle,
  hubNavigationRequest = 0,
  onOpenFaceLab
}) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const hasMountedStepRef = useRef(false);
  const skinMatchStepHeaderRef = useRef(null);
  const router = useRouter();
  const labels = locale === "en"
    ? {
        stepKicker: "SKIN MATCH ROUTINE REPORT",
        hub: "Start Today",
        morning: "Routine Consult",
        evening: "Evening Routine",
        avoid: "Caution",
        adjustment: "Adjustment Guide",
        product: "Active Check",
        summary: "Final Summary",
        previous: "Previous",
        next: "Next",
        finalCta: "Save my routine"
      }
    : {
        stepKicker: "SKIN MATCH 루틴 리포트",
        hub: "오늘 시작",
        morning: "루틴 상담",
        evening: "저녁 실행 루틴",
        avoid: "주의",
        adjustment: "조정",
        product: "기능성 판단",
        summary: "최종 요약",
        previous: "이전",
        next: "다음",
        finalCta: "내 루틴 저장하기"
      };
  function moveToStepKey(stepKey) {
    if (stepKey === "face-lab") {
      onOpenFaceLab?.();
      return;
    }

    const targetIndex = SKIN_MATCH_SECTION_ORDER.indexOf(stepKey);

    if (targetIndex >= 0) {
      moveToStep(targetIndex);
    }
  }

  const stepMap = {
    "today-start-hub": {
      key: "today-start-hub",
      label: labels.hub,
      content: (
        <div className="space-y-4">
          <TodayStartPlanStep
            baseline={getTodaySkinBaseline(freeResult, locale)}
            actionItems={getPriorityActionItems(locale)}
            hubActions={getSkinMatchHubActions(locale)}
            locale={locale}
            onNavigate={moveToStepKey}
          />
          <CurrentProductsSummaryCard
            currentProducts={report?.currentProducts}
            locale={locale}
          />
        </div>
      )
    },
    "morning-routine": {
      key: "morning-routine",
      label: labels.morning,
      content: (
        <RoutineExecutionStep
          freeResult={freeResult}
          report={report}
          morningSteps={morningSteps}
          nightSteps={nightSteps}
          copy={copy}
          locale={locale}
          onNavigate={moveToStepKey}
        />
      )
    },
    "avoid-list": {
      key: "avoid-list",
      label: labels.avoid,
      content: (
        <AvoidListStep
          avoidItems={displayAvoidCombinations}
          locale={locale}
        />
      )
    },
    "adjustment-guide": {
      key: "adjustment-guide",
      label: labels.adjustment,
      content: (
        <AdjustmentGuideStep
          variants={displayRoutineVariants}
          avoidItems={displayAvoidCombinations}
          locale={locale}
        />
      )
    },
    "product-plan": {
      key: "product-plan",
      label: labels.product,
      content: (
        <ProductUsageGuideStep
          freeResult={freeResult}
          report={report}
          alternativeItems={alternativeItems}
          displayBudgetAlternatives={displayBudgetAlternatives}
          copy={copy}
          locale={locale}
        />
      )
    }
  };
  const steps = SKIN_MATCH_SECTION_ORDER.map((key) => stepMap[key]).filter(Boolean);
  const maxStepIndex = Math.max(steps.length - 1, 0);
  const currentStepIndex = Math.min(activeStepIndex, maxStepIndex);
  const activeStep = steps[currentStepIndex];
  const nextStep = currentStepIndex < maxStepIndex ? steps[currentStepIndex + 1] : null;
  const primaryLabel = nextStep ? buildStepAdvanceLabel(nextStep, locale) : labels.finalCta;
  const isHubStep = activeStep?.key === "today-start-hub";
  const isRoutineStep = activeStep?.key === "morning-routine";
  const hideStepHeader = isHubStep || isRoutineStep;
  const moveToStep = (nextIndex) => {
    const boundedIndex = Math.max(0, Math.min(maxStepIndex, nextIndex));

    if (boundedIndex === currentStepIndex) {
      return;
    }

    setActiveStepIndex(boundedIndex);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const target = skinMatchStepHeaderRef.current;

          if (!target) {
            return;
          }

          const rawTargetTop = target.getBoundingClientRect().top + window.scrollY - 8;
          const maxScrollTop = Math.max(
            0,
            document.documentElement.scrollHeight - window.innerHeight
          );
          const targetTop = Math.min(Math.max(0, rawTargetTop), maxScrollTop);

          window.scrollTo({
            top: targetTop,
            behavior: "smooth"
          });
      });
      });
    }
  };

  useEffect(() => {
    if (activeStepIndex > maxStepIndex) {
      setActiveStepIndex(maxStepIndex);
    }
  }, [activeStepIndex, maxStepIndex]);

  useEffect(() => {
    hasMountedStepRef.current = true;
  }, []);

  useEffect(() => {
    if (!hubNavigationRequest) {
      return;
    }

    setActiveStepIndex(0);

    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  }, [hubNavigationRequest]);

  if (!activeStep) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div ref={skinMatchStepHeaderRef} className={hideStepHeader ? "sr-only" : "ui-card p-5 sm:p-6"}>
        {hideStepHeader ? (
          <span>{activeStep.label}</span>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="ui-kicker">{labels.stepKicker}</p>
                <h2 className="ui-title mt-1.5 text-xl">{activeStep.label}</h2>
              </div>
              <span className="ui-chip-compact shrink-0">{currentStepIndex + 1}/{steps.length}</span>
            </div>

            <div
              className="mt-3 grid gap-2"
              style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
            >
              {steps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => moveToStep(index)}
                  className={`h-2 rounded-full transition ${
                    index === currentStepIndex
                      ? "bg-zinc-900 dark:bg-zinc-100"
                      : "bg-zinc-200 dark:bg-zinc-800"
                  }`}
                  aria-label={`${step.label} ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <motion.div
        key={activeStep.key}
        initial={hasMountedStepRef.current ? { opacity: 0, y: 18 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        {activeStep.content}
      </motion.div>

      {currentStepIndex === maxStepIndex ? (
        <>
          {typeof onOpenFaceLab === "function" ? (
            <FaceLabReadyCard
              copy={copy}
              locale={locale}
              onOpenFaceLab={onOpenFaceLab}
            />
          ) : null}
          <FullReportFeedbackCard
            locale={locale}
            productId={freeResult?.topPick?.id || null}
          />
          <FullReportSavedCard locale={locale} />
        </>
      ) : null}

      {!isHubStep && !isRoutineStep ? (
        <div className="full-report-step-cta">
          <ResultBottomCTA
            fixed={false}
            label={primaryLabel}
            onClick={() => {
              if (currentStepIndex === maxStepIndex) {
                router.push(getMyPath(locale));
                return;
              }

              moveToStep(currentStepIndex + 1);
            }}
            previousLabel={currentStepIndex > 0 ? labels.previous : null}
            onPrevious={
              currentStepIndex > 0
                ? () => moveToStep(currentStepIndex - 1)
                : null
            }
          />
        </div>
      ) : null}
    </section>
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

function getRoutineStepActionText(step = {}, locale = "ko") {
  const mode = step.routineMode;
  const titleIndex = `${step.stepName || ""} ${step.productRole || ""}`.toLowerCase();
  const category = normalizeReportCategory(step.product || {});
  const original = compactText(step.instruction);

  if (!mode) {
    return original;
  }

  if (locale === "en") {
    if (mode === "morning") {
      if (category === "sunscreen" || /sun|spf|sunscreen/.test(titleIndex)) {
        return "Finish the morning with enough sunscreen.";
      }
      if (Number(step.order) <= 1) {
        return "Keep the layer thin so hydration does not break.";
      }
      return "Apply thinly so the next step does not pill.";
    }

    if (category === "cleanser" || /clean|wash|cleans/.test(titleIndex)) {
      return "Remove residue gently without chasing a stripped finish.";
    }
    if (category === "moisturizer" || /cream|moist|finish/.test(titleIndex) || Number(step.order) >= 3) {
      return "If it stings or feels tight, leave only comfortable moisture.";
    }
    return "Keep the evening order simple: cleanse, core product, moisture.";
  }

  if (mode === "morning") {
    if (category === "sunscreen" || /선|자외선/.test(titleIndex)) {
      return "아침 마무리는 선크림을 충분량으로 끝냅니다.";
    }
    if (Number(step.order) <= 1) {
      return "수분감이 끊기지 않게 얇게 압축합니다.";
    }
    return "다음 단계가 밀리지 않게 얇게 둡니다.";
  }

  if (category === "cleanser" || /세안|클렌/.test(titleIndex)) {
    return "뽀득하게 벗기기보다 잔여감만 부드럽게 정리합니다.";
  }
  if (category === "moisturizer" || /보습|크림|로션|마무리/.test(titleIndex) || Number(step.order) >= 3) {
    return "따가움이나 당김이 있으면 편한 보습만 남깁니다.";
  }
  return "세안 → 핵심 제품 → 보습 마무리 순서로 단순하게 갑니다.";
}

function getRoutineStepCautionText(step = {}, locale = "ko") {
  const mode = step.routineMode;
  const titleIndex = `${step.stepName || ""} ${step.productRole || ""}`.toLowerCase();
  const category = normalizeReportCategory(step.product || {});
  const original = compactText(step.caution);

  if (!mode) {
    return original;
  }

  if (locale === "en") {
    if (mode === "morning") {
      return category === "sunscreen" || /sun|spf|sunscreen/.test(titleIndex)
        ? "If it pills, reduce moisture amount and wait before makeup."
        : "Keep the morning stack light.";
    }

    return "Use only one active lane at a time.";
  }

  if (mode === "morning") {
    return category === "sunscreen" || /선|자외선/.test(titleIndex)
      ? "밀리면 보습량을 줄이고 흡수 시간을 둡니다."
      : "아침 단계는 가볍게 유지합니다.";
  }

  return "기능성은 한 번에 하나만, 매일 겹치지 않습니다.";
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
    routineStructure: premiumReport.routineStructure || result?.routineStructure || null,
    currentProducts: premiumReport.currentProducts || null
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

function cleanFaceLabText(value, locale = "ko") {
  return formatFaceLabDisplayText(cleanReportText(value), locale);
}

function compactReportList(values, limit = 10) {
  return Array.isArray(values)
    ? values.map((item) => cleanReportText(item)).filter(Boolean).slice(0, limit)
    : [];
}

function compactFaceLabReportList(values, locale = "ko", limit = 10) {
  return formatFaceLabDisplayList(Array.isArray(values) ? values : [], locale, limit);
}

function uniqueReportList(values, limit = 10) {
  return [...new Set(values.map((item) => cleanReportText(item)).filter(Boolean))].slice(0, limit);
}

function uniqueFaceLabReportList(values, locale = "ko", limit = 10) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((item) => cleanFaceLabText(item, locale))
    .filter(Boolean))]
    .slice(0, limit);
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
  const label = id === "mood" ? ui.labels.mood : cleanFaceLabText(section?.label || section?.title, locale) || ui.labels[id] || id;

  return {
    ...section,
    id,
    label,
    title: id === "mood" ? ui.labels.mood : cleanFaceLabText(section?.title, locale) || label
  };
}

function sanitizeFaceLabSectionForDisplay(section, locale = "ko") {
  if (!section) {
    return section;
  }

  return {
    ...section,
    label: cleanFaceLabText(section.label, locale),
    title: cleanFaceLabText(section.title, locale),
    content: compactFaceLabReportList(section.content, locale, 8),
    recommended: compactFaceLabReportList(section.recommended, locale, 6),
    avoid: compactFaceLabReportList(section.avoid, locale, 6),
    baseSetup: compactFaceLabReportList(section.baseSetup, locale, 4),
    keywords: compactFaceLabReportList(section.keywords, locale, 10),
    cards: Array.isArray(section.cards)
      ? section.cards.map((card) => ({
          ...card,
          label: cleanFaceLabText(card?.label, locale),
          body: cleanFaceLabText(card?.body, locale)
        })).filter((card) => card.label || card.body)
      : []
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
    .map((section) => sanitizeFaceLabSectionForDisplay(section, locale))
    .filter((section) => {
      if (section.id === "structure") {
        return compactFaceLabReportList(section.content, locale, 4).length;
      }
      if (section.id === "direction") {
        return compactFaceLabReportList(section.recommended, locale, 4).length || compactFaceLabReportList(section.avoid, locale, 4).length;
      }
      if (section.id === "guide") {
        return compactFaceLabReportList(section.baseSetup, locale, 3).length || (Array.isArray(section.cards) && section.cards.length);
      }
      if (section.id === "mood") {
        return compactFaceLabReportList(section.content, locale, 4).length || compactFaceLabReportList(section.keywords, locale, 8).length;
      }

      return true;
    })
    .sort((a, b) => FACE_LAB_SECTION_ORDER.indexOf(a.id) - FACE_LAB_SECTION_ORDER.indexOf(b.id));
}

function getFaceLabMood(faceLab, sections, locale = "ko") {
  const ui = getFaceLabUi(locale);
  const mood = faceLab?.faceMood || {};
  const moodSection = sections.find((section) => section.id === "mood") || {};
  const legacyKeywords = compactFaceLabReportList(faceLab?.styleKeywords, locale, 8);
  const moodKeywords = compactFaceLabReportList(mood.keywords, locale, 8);
  const sectionKeywords = compactFaceLabReportList(moodSection.keywords, locale, 8);

  return {
    primary: cleanFaceLabText(mood.primary, locale) || ui.moodFallback.primary,
    secondary: compactFaceLabReportList(mood.secondary, locale, 3).length ? compactFaceLabReportList(mood.secondary, locale, 3) : ui.moodFallback.secondary,
    keywords: uniqueFaceLabReportList([...moodKeywords, ...sectionKeywords, ...legacyKeywords, ...ui.moodFallback.keywords], locale, 8),
    impression: cleanFaceLabText(mood.impression, locale) || ui.moodFallback.impression
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
  const summaryLabel = locale === "en" ? "Summary" : "요약";

  return (
    <section className="ui-card-subtle overflow-hidden p-5">
      <div>
        <div>
          <p className="ui-kicker">{ui.moodTitle}</p>
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">{ui.moodLabels.primary}</p>
            <h3 className="ui-title mt-1 text-2xl sm:text-[1.75rem]">{mood.primary || ui.moodFallback.primary}</h3>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-zinc-200 bg-zinc-50/80 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/35">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
          {summaryLabel}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {mood.impression || ui.moodFallback.impression}
        </p>
      </div>

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
              className={`ui-button-secondary min-h-14 w-full justify-center px-3 py-3 text-center text-sm font-semibold ${
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

function FullReportPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const copy = getCopy(locale);
  const isEnglish = locale === "en";
  const isTestFullReport = pathname.includes("/test-full-report");
  const [freeResult, setFreeResult] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isReportOpened, setIsReportOpened] = useState(false);
  const [hasPreviousReportOpen, setHasPreviousReportOpen] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.localStorage.getItem(FULL_REPORT_OPENED_AT_KEY));
  });
  const [activeTab, setActiveTab] = useState("skin_match");
  const [hubNavigationRequest, setHubNavigationRequest] = useState(0);
  const [submissionImageUrl, setSubmissionImageUrl] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !report || error) {
      return;
    }

    localStorage.setItem(LAST_REPORT_URL_KEY, window.location.href);
    localStorage.setItem(LAST_VIEWED_AT_KEY, new Date().toISOString());
  }, [error, report]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeTab === "skin_match" || activeTab === "face_lab") {
      localStorage.setItem(LAST_FULL_REPORT_TAB_KEY, activeTab);
    }
  }, [activeTab]);

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

    let parsedResult = null;

    try {
      parsedResult = storedResult ? JSON.parse(storedResult) : null;

      if (parsedResult) {
        setFreeResult(parsedResult);
        setError("");
      }
    } catch {
      parsedResult = null;
    }

    async function loadFullReport() {
      const storedFaceLab = sessionStorage.getItem("skinTestFaceLabFull");
      let parsedFaceLab = null;

      try {
        parsedFaceLab = storedFaceLab ? JSON.parse(storedFaceLab) : null;
      } catch {
        parsedFaceLab = null;
      }

      const developmentFallbackReport =
        process.env.NODE_ENV !== "production"
          ? buildDevelopmentReport(parsedResult, parsedFaceLab, locale)
          : null;

      if (isTestFullReport && developmentFallbackReport) {
        setFreeResult(parsedResult);
        setReport(developmentFallbackReport);
        setError("");
        setIsReady(true);
        return;
      }

      try {
        const supabaseAccessToken = await getFullReportAccessToken();
        const response = await fetch("/api/full-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(supabaseAccessToken ? { Authorization: `Bearer ${supabaseAccessToken}` } : {})
          },
          body: JSON.stringify({
            locale,
            faceLab: parsedFaceLab,
            topPick: parsedResult?.topPick || null
          })
        });
        const data = await response.json().catch(() => null);

        if (response.status === 401) {
          if (developmentFallbackReport) {
            setReport(developmentFallbackReport);
          } else {
            setReport(null);
            setError(copy.errorBody);
          }
          return;
        }

        if (!response.ok || !data) {
          throw new Error(data?.error || copy.errorBody);
        }

        const baseResult =
          parsedResult ||
          (data?.freeResult && typeof data.freeResult === "object" ? data.freeResult : null);

        if (!baseResult) {
          throw new Error(copy.errorBody);
        }

        setFreeResult(baseResult);
        const localizedData = localizeFullReportForLocale(data, baseResult, locale);
        setReport(localizedData);
        trackEvent("view_full_report", {
          product_id: baseResult?.topPick?.id || null,
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
          setReport(developmentFallbackReport);
        } else {
          console.error("[full-report] failed to load report", requestError);
          setReport(null);
          setError(copy.errorBody);
        }
      } finally {
        setIsReady(true);
      }
    }

    void loadFullReport();
  }, [copy.errorBody, isTestFullReport, locale]);

  const openFullReportContent = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(FULL_REPORT_OPENED_AT_KEY, new Date().toISOString());
    }

    setHasPreviousReportOpen(true);
    setIsReportOpened(true);
  };

  if (!isReady) {
    return (
      <FullReportLoadingBridge
        locale={locale}
        canOpen={false}
        onOpen={openFullReportContent}
      />
    );
  }

  if (error || !freeResult || !report) {
    return (
      <ErrorState
        variant="result_empty"
        title={locale === "en" ? copy.errorTitle : undefined}
        description={locale === "en" ? copy.errorBody : undefined}
        primaryActionLabel={locale === "en" ? copy.restart : undefined}
        primaryActionHref={getHomePath(locale)}
        secondaryActionLabel={copy.backResult}
        secondaryActionHref={getResultPath(locale)}
      />
    );
  }

  if (!isReportOpened && !hasPreviousReportOpen) {
    return (
      <FullReportLoadingBridge
        locale={locale}
        canOpen
        onOpen={openFullReportContent}
      />
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
  const goToMainHub = () => {
    setActiveTab("skin_match");
    setHubNavigationRequest((value) => value + 1);
  };

  return (
    <main className="full-report-light-theme ui-page ui-page-shell min-h-screen">
      <FullReportLightThemeStyles />
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-36 pt-4 sm:px-6 sm:pt-6 md:max-w-[980px] xl:max-w-[1120px]">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 px-1">
            <Link href={getResultPath(locale)} className="min-w-0 text-left">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8a5260] dark:text-[#c8aeb8]">
                FULL REPORT
              </span>
              <span className="mt-0.5 block truncate text-sm font-semibold text-[#2b1f26] dark:text-[#fff8f3]">
                {isEnglish ? "Full report" : "\ud480 \ub9ac\ud3ec\ud2b8"}
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
                    label: copy.backResult,
                    onClick: () => router.push(getResultPath(locale))
                  },
                  {
                    label: copy.restart,
                    href: getHomePath(locale)
                  }
                ]}
                openLabel={isEnglish ? "Open full report menu" : "풀 리포트 메뉴 열기"}
                closeLabel={isEnglish ? "Close full report menu" : "풀 리포트 메뉴 닫기"}
              />
            </div>
          </div>

          <header className="ui-card px-5 py-5 sm:p-6">
            <div className="flex items-start">
              <div className="min-w-0">
                <p className="ui-kicker">FULL REPORT</p>
                <h1 className="ui-title mt-2 text-[26px] leading-[1.18] sm:text-2xl sm:leading-tight">{copy.title}</h1>
                <p className="ui-text-secondary mt-3 text-sm leading-6">{copy.body}</p>
                {locale === "ko" ? (
                  <p className="ui-text-secondary mt-1 text-xs font-medium leading-5">Full Report</p>
                ) : null}
              </div>
            </div>
          </header>

          <button
            type="button"
            onClick={goToMainHub}
            className="ui-button-secondary min-h-11 w-full justify-center px-4 py-3 text-sm font-semibold"
          >
            {copy.mainHubButton}
          </button>

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
              hubNavigationRequest={hubNavigationRequest}
              onOpenFaceLab={() => {
                setActiveTab("face_lab");
                if (typeof window !== "undefined") {
                  window.requestAnimationFrame(() => {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  });
                }
              }}
            />
          ) : (
            <FaceLabSection report={report} photoUrl={submissionImageUrl} locale={locale} />
          )}
        </div>
      </div>
    </main>
  );
}

export default function FullReportPage() {
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);

  if (!PREMIUM_REPORT_ENABLED) {
    return <PremiumReportComingSoonGate locale={locale} />;
  }

  return <FullReportPageContent />;
}
