"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PAGE_SIZE = 5;

const HISTORY_COPY = {
  ko: {
    kicker: "Analysis History",
    title: "내 분석 기록",
    body: "저장된 무료·프리미엄 분석을 최근 순서대로 다시 확인하세요.",
    free: "무료",
    premium: "프리미엄",
    latest: "최신",
    version: "버전",
    open: "리포트 열기",
    unavailable: "다시 열 수 없는 기록",
    fallbackFree: "무료 피부 분석",
    fallbackPremium: "프리미엄 스킨 리포트",
    empty: "아직 저장된 분석 기록이 없습니다.",
    error: "분석 기록을 불러오지 못했습니다.",
    retry: "다시 시도",
    loadMore: "이전 기록 더 보기",
    loading: "불러오는 중..."
  },
  en: {
    kicker: "Analysis History",
    title: "My Analysis History",
    body: "Reopen your saved free and premium analyses in reverse chronological order.",
    free: "Free",
    premium: "Premium",
    latest: "Latest",
    version: "Version",
    open: "Open report",
    unavailable: "This record cannot be reopened",
    fallbackFree: "Free Skin Analysis",
    fallbackPremium: "Premium Skin Report",
    empty: "No saved analysis history yet.",
    error: "Unable to load your analysis history.",
    retry: "Try again",
    loadMore: "Load older reports",
    loading: "Loading..."
  }
};

function getCopy(locale) {
  return locale === "en" ? HISTORY_COPY.en : HISTORY_COPY.ko;
}

function formatReportDate(value, locale) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function localizeReportHref(href, locale) {
  if (typeof href !== "string") {
    return null;
  }

  if (href.startsWith("/r/")) {
    return href;
  }

  if (href.startsWith("/result/full-report?")) {
    return locale === "en" ? `/en${href}` : href;
  }

  return null;
}

function mergeReports(current, incoming) {
  const seen = new Set(current.map((report) => report.id));
  return [
    ...current,
    ...incoming.filter((report) => report?.id && !seen.has(report.id))
  ];
}

export default function SavedReportHistory({ locale = "ko" }) {
  const copy = getCopy(locale);
  const [reports, setReports] = useState([]);
  const [nextOffset, setNextOffset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  async function fetchPage(offset, { append = false, active = () => true } = {}) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset)
    });
    const response = await fetch(`/api/my/saved-reports?${params.toString()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("saved_report_history_unavailable");
    }

    const payload = await response.json();

    if (!active()) {
      return;
    }

    const incoming = Array.isArray(payload.reports) ? payload.reports : [];
    setReports((current) => (append ? mergeReports(current, incoming) : incoming));
    setNextOffset(Number.isInteger(payload.nextOffset) ? payload.nextOffset : null);
  }

  useEffect(() => {
    let isActive = true;

    async function loadInitialHistory() {
      setLoading(true);
      setError(false);

      try {
        await fetchPage(0, { active: () => isActive });
      } catch {
        if (isActive) {
          setError(true);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadInitialHistory();

    return () => {
      isActive = false;
    };
  }, []);

  async function retry() {
    setLoading(true);
    setError(false);

    try {
      await fetchPage(0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!Number.isInteger(nextOffset) || loadingMore) {
      return;
    }

    setLoadingMore(true);
    setError(false);

    try {
      await fetchPage(nextOffset, { append: true });
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26] sm:p-5" aria-busy={loading || loadingMore}>
      <div>
        <p className="ui-kicker">{copy.kicker}</p>
        <h2 className="ui-title mt-1 text-xl">{copy.title}</h2>
        <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.body}</p>
      </div>

      {loading ? (
        <div className="mt-4 rounded-[1rem] border border-dashed border-[#ead2ca] p-4 dark:border-[#4a303c]">
          <p className="ui-text-secondary text-sm">{copy.loading}</p>
        </div>
      ) : error && reports.length === 0 ? (
        <div className="mt-4 rounded-[1rem] border border-dashed border-[#ead2ca] p-4 dark:border-[#4a303c]">
          <p className="ui-text-secondary text-sm leading-6">{copy.error}</p>
          <button type="button" onClick={retry} className="ui-button-secondary mt-3 min-h-10 w-full px-4 text-sm font-semibold sm:w-auto">
            {copy.retry}
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="mt-4 rounded-[1rem] border border-dashed border-[#ead2ca] p-4 dark:border-[#4a303c]">
          <p className="ui-text-secondary text-sm leading-6">{copy.empty}</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-[1rem] border border-[#ead2ca] dark:border-[#4a303c]">
          <div className="divide-y divide-[#ead2ca] dark:divide-[#4a303c]">
            {reports.map((report, index) => {
              const isPremium = report.reportType === "premium";
              const href = localizeReportHref(report.href, locale);
              const title = report.title || (isPremium ? copy.fallbackPremium : copy.fallbackFree);

              return (
                <article key={report.id} className="grid min-w-0 gap-3 bg-[#fffaf6] p-4 dark:bg-[#2f202a] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="ui-chip-compact">{isPremium ? copy.premium : copy.free}</span>
                      {index === 0 ? <span className="ui-chip-compact">{copy.latest}</span> : null}
                      {report.reportVersion ? (
                        <span className="ui-text-faint text-xs">{copy.version} {report.reportVersion}</span>
                      ) : null}
                    </div>
                    <h3 className="ui-text-primary mt-2 truncate text-sm font-semibold sm:text-base">{title}</h3>
                    <p className="ui-text-faint mt-1 text-xs">{formatReportDate(report.createdAt, locale)}</p>
                  </div>

                  {href ? (
                    <Link href={href} className="ui-button-secondary flex min-h-10 w-full items-center justify-center px-4 text-sm font-semibold sm:w-auto">
                      {copy.open}
                    </Link>
                  ) : (
                    <span className="ui-text-faint text-xs sm:max-w-36 sm:text-right">{copy.unavailable}</span>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {!loading && reports.length > 0 && Number.isInteger(nextOffset) ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={loadMore}
          className="ui-button-secondary mt-3 min-h-10 w-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {loadingMore ? copy.loading : copy.loadMore}
        </button>
      ) : null}

      {error && reports.length > 0 ? (
        <p className="ui-text-faint mt-3 text-xs">{copy.error}</p>
      ) : null}
    </section>
  );
}
