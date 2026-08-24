"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MyDashboardMenu from "@/components/my/MyDashboardMenu";
import SkinDiaryCalendar from "@/components/my/SkinDiaryCalendar";
import SkinProfileSummaryCard from "@/components/my/SkinProfileSummaryCard";
import TodayCheckInPrompt from "@/components/my/TodayCheckInPrompt";
import TodayRoutineCard from "@/components/my/TodayRoutineCard";
import { isValidDiaryMonth } from "@/lib/my/diary-month";
import { getBrowserDateContext } from "@/lib/my/local-date";
import { getMyCopy } from "@/lib/my/i18n";

function formatDate(value, locale = "ko") {
  if (!value) {
    return "";
  }

  const dateLocale = getMyCopy(locale).dateLocale;

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);

      return new Intl.DateTimeFormat(dateLocale, {
        year: "numeric",
        month: "long",
        day: "numeric"
      }).format(new Date(year, month - 1, day));
    }

    return new Intl.DateTimeFormat(dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function formatShortDate(value, locale = "ko") {
  if (!value) {
    return "";
  }

  const dateLocale = getMyCopy(locale).dateLocale;

  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split("-").map(Number);

      return new Intl.DateTimeFormat(dateLocale, {
        month: "numeric",
        day: "numeric"
      }).format(new Date(year, month - 1, day));
    }

    return new Intl.DateTimeFormat(dateLocale, {
      month: "numeric",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

const CHECKIN_METRICS = [
  { key: "irritation", field: "irritation_level" },
  { key: "redness", field: "redness_level" },
  { key: "breakout", field: "breakout_level" },
  { key: "dryness", field: "dryness_level" },
  { key: "oiliness", field: "oiliness_level" }
];

function normalizeCheckins(values) {
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function getMetricValue(checkin, field) {
  const value = Number(checkin?.[field]);

  return Number.isFinite(value) ? Math.max(0, Math.min(4, value)) : 0;
}

function getTrendMetricStats(checkins) {
  return CHECKIN_METRICS.map((metric) => {
    return {
      metric,
      total: checkins.reduce((sum, checkin) => sum + getMetricValue(checkin, metric.field), 0)
    };
  });
}

function chooseTrendMetric(checkins) {
  if (!checkins.length) {
    return CHECKIN_METRICS.find((metric) => metric.key === "redness") || CHECKIN_METRICS[0];
  }

  const metricStats = getTrendMetricStats(checkins);

  if (metricStats.every((entry) => entry.total === 0)) {
    return CHECKIN_METRICS.find((metric) => metric.key === "redness") || CHECKIN_METRICS[0];
  }

  return metricStats.reduce((selected, entry) => {
    return entry.total > selected.total ? entry : selected;
  }, metricStats[0]).metric;
}

function buildSparklinePoints(checkins, metric) {
  const ordered = [...checkins].reverse();
  const width = 220;
  const height = 72;
  const xStep = ordered.length > 1 ? width / (ordered.length - 1) : 0;

  return ordered.map((checkin, index) => {
    const value = getMetricValue(checkin, metric.field);
    const x = index * xStep;
    const y = height - (value / 4) * (height - 8) - 4;

    return {
      checkin,
      value,
      x,
      y
    };
  });
}

function SkinTrendPreview({ checkins, copy, locale }) {
  const recentCheckins = normalizeCheckins(checkins);
  const defaultMetric = useMemo(() => chooseTrendMetric(recentCheckins), [recentCheckins]);
  const [selectedMetricKey, setSelectedMetricKey] = useState(defaultMetric.key);
  const metric = CHECKIN_METRICS.find((item) => item.key === selectedMetricKey) || defaultMetric;
  const points = buildSparklinePoints(recentCheckins, metric);
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const hasTrend = points.length >= 2;

  useEffect(() => {
    setSelectedMetricKey(defaultMetric.key);
  }, [defaultMetric.key]);

  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ui-kicker">{copy.trend.kicker}</p>
          <h2 className="ui-title mt-1 text-xl">{copy.trend.title}</h2>
          <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.trend.body}</p>
        </div>
        <div className="flex max-w-full flex-wrap gap-1.5">
          {CHECKIN_METRICS.map((item) => {
            const isSelected = item.key === metric.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedMetricKey(item.key)}
                className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition ${
                  isSelected
                    ? "border-[#e76b91] bg-[#ffe8ef] text-[#7c3048] dark:border-[#ef6387] dark:bg-[#4a2533] dark:text-[#ffdce7]"
                    : "border-[#ead2ca] bg-white/60 text-[#6f4d58] dark:border-[#4a303c] dark:bg-[#301f28] dark:text-[#e8d5d0]"
                }`}
              >
                {copy.trend.labels[item.key]}
              </button>
            );
          })}
        </div>
      </div>

      {hasTrend ? (
        <div className="mt-4 overflow-hidden rounded-[1rem] border border-[#ead2ca] bg-[#fffaf6] p-3 dark:border-[#3a2630] dark:bg-[#2f202a]">
          <svg viewBox="0 0 220 80" role="img" aria-label={`${copy.trend.labels[metric.key]} trend`} className="h-24 w-full">
            <polyline
              points={pointString}
              fill="none"
              stroke="#ef6387"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {points.map((point) => (
              <circle key={`${point.checkin.checkin_date}-${point.x}`} cx={point.x} cy={point.y} r="3.5" fill="#ef6387" />
            ))}
          </svg>
          <div className="mt-2 grid grid-cols-4 gap-1 text-[0.68rem] text-[#8a6d74] dark:text-[#cdb5bc] sm:grid-cols-7">
            {points.map((point) => (
              <span key={point.checkin.checkin_date} className="truncate">
                {formatShortDate(point.checkin.checkin_date, locale)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[1rem] border border-dashed border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#4a303c] dark:bg-[#2f202a]">
          <p className="ui-text-secondary text-sm leading-6">{copy.trend.empty}</p>
          <Link href={copy.paths.checkIn} className="ui-button-secondary mt-3 inline-flex min-h-10 w-full items-center justify-center px-4 text-sm font-semibold sm:w-auto">
            {copy.trend.cta}
          </Link>
        </div>
      )}
    </section>
  );
}

function EmptyProfileState({ copy }) {
  return (
    <section className="ui-card mx-auto w-full max-w-2xl p-6 text-center sm:p-8">
      <p className="ui-kicker">{copy.emptyProfile.kicker}</p>
      <h1 className="ui-title mt-3 text-2xl sm:text-3xl">
        {copy.emptyProfile.title}
      </h1>
      <p className="ui-text-secondary mt-3 text-sm leading-6">
        {copy.emptyProfile.body}
      </p>
      <Link href={copy.paths.home} className="ui-button-primary mt-6 min-h-11 w-full px-5 text-sm font-semibold sm:w-auto">
        {copy.emptyProfile.cta}
      </Link>
    </section>
  );
}

function TodayCheckInDone({ checkin, copy, locale }) {
  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="ui-kicker">{copy.checkInDone.kicker}</p>
          <h2 className="ui-title mt-1 text-lg">{copy.checkInDone.title}</h2>
          {checkin?.checkin_date ? (
            <p className="ui-text-faint mt-1 text-xs">{formatDate(checkin.checkin_date, locale)}</p>
          ) : null}
        </div>
        <Link href={copy.paths.checkIn} className="ui-button-secondary min-h-10 w-full px-4 text-sm font-semibold sm:w-auto">
          {copy.checkInDone.cta}
        </Link>
      </div>
    </section>
  );
}

function RoutinePendingNotice({ copy }) {
  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26]">
      <p className="ui-kicker">{copy.routinePending.kicker}</p>
      <h2 className="ui-title mt-1 text-lg">{copy.routinePending.title}</h2>
      <p className="ui-text-secondary mt-2 text-sm leading-6">
        {copy.routinePending.body}
      </p>
    </section>
  );
}

function getReportHref(path, locale = "ko") {
  if (typeof path !== "string") {
    return null;
  }

  if (path.startsWith("/r/")) {
    return path;
  }

  if (path.startsWith("/result/full-report?")) {
    return locale === "en" ? `/en${path}` : path;
  }

  return null;
}

export default function MyDashboard({ dashboard, locale = "ko" }) {
  const copy = getMyCopy(locale);
  const [clientDashboard, setClientDashboard] = useState(null);
  const [isDiaryLoading, setIsDiaryLoading] = useState(false);
  const browserDateContextRef = useRef(null);
  // Server props are the initial fallback; browser-local dashboard data replaces them after refresh.
  const activeDashboard = clientDashboard || dashboard;

  useEffect(() => {
    const context = getBrowserDateContext();
    const diaryMonth = context.localDate.slice(0, 7);
    const params = new URLSearchParams({
      localDate: context.localDate,
      timezone: context.timezone,
      diaryMonth
    });
    let isActive = true;

    browserDateContextRef.current = context;

    async function refreshDashboard() {
      try {
        const response = await fetch(`/api/my/dashboard?${params.toString()}`, {
          cache: "no-store"
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (isActive) {
          setClientDashboard(data);
        }
      } catch {
        // Keep the server fallback payload when the client refresh is unavailable.
      }
    }

    refreshDashboard();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleDiaryMonthChange(nextMonth) {
    if (!isValidDiaryMonth(nextMonth) || isDiaryLoading) {
      return;
    }

    const context = browserDateContextRef.current || getBrowserDateContext();
    const currentMonth = activeDashboard.currentDiaryMonth || context.localDate.slice(0, 7);

    if (nextMonth > currentMonth) {
      return;
    }

    const params = new URLSearchParams({
      localDate: context.localDate,
      timezone: context.timezone,
      diaryMonth: nextMonth
    });

    setIsDiaryLoading(true);

    try {
      const response = await fetch(`/api/my/dashboard?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setClientDashboard(data);
    } catch {
      // Keep the current month visible when a month refresh is unavailable.
    } finally {
      setIsDiaryLoading(false);
    }
  }

  const {
    latestSkinProfile,
    todayCheckin,
    recentTrendCheckins,
    recentCheckins,
    monthlyDiaryCheckins,
    diaryMonth,
    currentDiaryMonth,
    todayRoutine,
    latestSharePath,
    hasProfile,
    needsCheckIn
  } = activeDashboard;
  const latestReportHref = getReportHref(latestSharePath, locale);
  const trendCheckins = recentTrendCheckins || recentCheckins || [];

  return (
    <main className="ui-page-shell min-h-screen px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="ui-kicker">{copy.dashboard.kicker}</p>
            <h1 className="ui-title mt-2 text-3xl sm:text-4xl">{copy.dashboard.title}</h1>
            <p className="ui-text-secondary mt-2 text-sm leading-6">
              {copy.dashboard.body}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {latestReportHref ? (
              <Link href={latestReportHref} className="ui-button-secondary min-h-10 px-4 text-sm font-semibold">
                {copy.savedReport.cta}
              </Link>
            ) : null}
            <MyDashboardMenu locale={locale} />
          </div>
        </header>

        <div className="mt-6 sm:mt-8">
          {!hasProfile ? (
            <EmptyProfileState copy={copy} />
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {needsCheckIn ? (
                <TodayCheckInPrompt copy={copy} />
              ) : (
                <TodayCheckInDone checkin={todayCheckin} copy={copy} locale={locale} />
              )}

              {todayRoutine ? (
                <TodayRoutineCard routine={todayRoutine} copy={copy} />
              ) : todayCheckin ? (
                <RoutinePendingNotice copy={copy} />
              ) : null}

              <SkinTrendPreview checkins={trendCheckins} copy={copy} locale={locale} />

              <SkinDiaryCalendar
                checkins={monthlyDiaryCheckins}
                copy={copy}
                locale={locale}
                diaryMonth={diaryMonth}
                currentDiaryMonth={currentDiaryMonth}
                loading={isDiaryLoading}
                onMonthChange={handleDiaryMonthChange}
              />

              <SkinProfileSummaryCard
                profile={latestSkinProfile}
                copy={copy}
                locale={locale}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
