"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import { buildFaceLabLaunchData } from "@/lib/face-lab-launch";
import { buildProductFitGauges } from "@/lib/product-fit-gauges";
import { buildRoutineSections } from "@/lib/routine-structure";
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
    avoid: "피하면 좋은 조합",
    budget: "예산 대안",
    faceLab: "Face Lab 확장 가이드",
    hairDirection: "헤어 방향",
    avoidStyles: "피할 스타일",
    colorPalette: "컬러 팔레트",
    vibeKeywords: "분위기 키워드",
    buyNow: "판매처 보기",
    empty: "표시할 내용이 아직 없습니다.",
    skinMatchTab: "Skin Match",
    faceLabTab: "Face Lab",
    fitSectionTitle: "제품 적합도",
    fitSectionBody: "이 점수는 제품의 사용감과 적합도를 요약한 참고 지표입니다."
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
    avoid: "Avoid Combinations",
    budget: "Budget Alternatives",
    faceLab: "Face Lab Extended Guidance",
    hairDirection: "Hair Direction",
    avoidStyles: "Avoid Styles",
    colorPalette: "Color Palette",
    vibeKeywords: "Vibe Keywords",
    buyNow: "View store",
    empty: "There is nothing to show yet.",
    skinMatchTab: "Skin Match",
    faceLabTab: "Face Lab",
    fitSectionTitle: "Product fit",
    fitSectionBody: "These scores are a compact reference for wear profile and fit."
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

function SupportingProductCard({ product, copy }) {
  if (!product) {
    return null;
  }

  return (
    <article className="ui-card-muted rounded-[1.35rem] p-4">
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

      {product.buy_link ? (
        <a
          href={product.buy_link}
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
                brand: product.brand || null
              }
            })
          }
          className="ui-button-secondary mt-4 inline-flex px-3.5 py-2 text-xs font-medium"
        >
          {copy.buyNow}
        </a>
      ) : null}
    </article>
  );
}

function FitGaugeSection({ fitData, copy }) {
  const gauges = Array.isArray(fitData?.gauges) ? fitData.gauges : [];

  if (!gauges.length) {
    return null;
  }

  return (
    <section className="ui-card p-6">
      <p className="ui-kicker">{copy.fitSectionTitle}</p>
      <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.fitSectionBody}</p>
      <div className="mt-4 space-y-3">
        {gauges.map((gauge) => (
          <div key={gauge.key} className="ui-card-subtle rounded-[1.2rem] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{gauge.label}</p>
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{gauge.score}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-zinc-900 transition-[width] dark:bg-zinc-100"
                style={{ width: `${gauge.score}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">{gauge.reason}</p>
          </div>
        ))}
      </div>
    </section>
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
      hairDirection: faceLabLaunch?.paid?.hairDirection || [],
      avoidStyles: faceLabLaunch?.paid?.avoidStyles || [],
      colorPalette: faceLabLaunch?.paid?.colorPalette || [],
      vibeKeywords: faceLabLaunch?.paid?.vibeKeywords || []
    },
    topPickFitGauges: buildProductFitGauges(result?.topPick || null, { locale }),
    routineStructure: premiumReport.routineStructure || result?.routineStructure || null
  };
}

function FaceLabSection({ report, copy }) {
  return (
    <section className="ui-card p-6">
      <p className="ui-kicker">{copy.faceLab}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="ui-card-subtle p-4">
          <p className="ui-kicker">{copy.hairDirection}</p>
          {renderList(report.faceLab?.hairDirection || []) || (
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
          )}
        </div>
        <div className="ui-card-subtle p-4">
          <p className="ui-kicker">{copy.avoidStyles}</p>
          {renderList(report.faceLab?.avoidStyles || []) || (
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
          )}
        </div>
        <div className="ui-card-subtle p-4">
          <p className="ui-kicker">{copy.colorPalette}</p>
          {renderList(report.faceLab?.colorPalette || []) || (
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
          )}
        </div>
        <div className="ui-card-subtle p-4">
          <p className="ui-kicker">{copy.vibeKeywords}</p>
          {renderList(report.faceLab?.vibeKeywords || []) || (
            <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
          )}
        </div>
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
              data.faceLab?.hairDirection?.length ||
                data.faceLab?.avoidStyles?.length ||
                data.faceLab?.colorPalette?.length ||
                data.faceLab?.vibeKeywords?.length
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

  const routineSections = buildRoutineSections({
    locale,
    routineStructure: report?.routineStructure || null,
    morningItems: report?.fullRoutine?.morning || [],
    nightItems: report?.fullRoutine?.night || [],
    labels: {
      morning: copy.morning,
      night: copy.night,
      core: copy.fullRoutine
    }
  });

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
              <section className="ui-card p-6">
                <p className="ui-kicker">{copy.topPickReason}</p>
                <h2 className="ui-title mt-2 text-[1.35rem] sm:text-[1.45rem]">
                  {freeResult?.topPick?.name || freeResult?.priority?.label || "Top Pick"}
                </h2>
                <p className="ui-text-secondary mt-1 text-sm">{freeResult?.topPick?.brand || ""}</p>
                <p className="mt-4 text-sm leading-7 text-zinc-700 dark:text-zinc-300">
                  {report.topPickDetailedReason || copy.empty}
                </p>
              </section>

              <FitGaugeSection fitData={report.topPickFitGauges} copy={copy} />

              <section className="ui-card p-6">
                <p className="ui-kicker">{copy.supportingProducts}</p>
                <div className="mt-4 grid gap-3">
                  {Array.isArray(report.supportingProducts) && report.supportingProducts.length ? (
                    report.supportingProducts.map((product) => (
                      <SupportingProductCard
                        key={product.id || `${product.brand}-${product.name}`}
                        product={product}
                        copy={copy}
                      />
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
                  )}
                </div>
              </section>

              <section className="ui-card p-6">
                <p className="ui-kicker">{copy.fullRoutine}</p>
                <div className={`mt-4 grid gap-3 ${routineSections.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {routineSections.length ? (
                    routineSections.map((section) => (
                      <div key={section.key} className="ui-card-subtle p-4">
                        <p className="ui-kicker">{section.label}</p>
                        {renderList(section.items || []) || (
                          <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
                  )}
                </div>
              </section>

              <section className="ui-card p-6">
                <p className="ui-kicker">{copy.avoid}</p>
                {renderList(report.avoidCombinations || []) || (
                  <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
                )}
              </section>

              <section className="ui-card p-6">
                <p className="ui-kicker">{copy.budget}</p>
                <div className="mt-4 grid gap-3">
                  {Array.isArray(report.budgetAlternatives) && report.budgetAlternatives.length ? (
                    report.budgetAlternatives.map((item) => (
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
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">{copy.empty}</p>
                  )}
                </div>
              </section>
            </>
          ) : (
            <FaceLabSection report={report} copy={copy} />
          )}
        </div>
      </div>
    </main>
  );
}
