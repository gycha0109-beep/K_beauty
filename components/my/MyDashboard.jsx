"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import MyDashboardMenu from "@/components/my/MyDashboardMenu";
import SkinProfileSummaryCard from "@/components/my/SkinProfileSummaryCard";
import TodayCheckInPrompt from "@/components/my/TodayCheckInPrompt";
import TodayRoutineCard from "@/components/my/TodayRoutineCard";
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
  { key: "redness", field: "redness_level" },
  { key: "irritation", field: "irritation_level" },
  { key: "breakout", field: "breakout_level" },
  { key: "dryness", field: "dryness_level" },
  { key: "oiliness", field: "oiliness_level" }
];

const DIARY_SIGNAL_METRICS = [
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

function chooseTrendMetric(checkins) {
  const latest = checkins[0];

  if (!latest) {
    return CHECKIN_METRICS[0];
  }

  return CHECKIN_METRICS.reduce((selected, metric) => {
    const selectedValue = getMetricValue(latest, selected.field);
    const metricValue = getMetricValue(latest, metric.field);

    return metricValue > selectedValue ? metric : selected;
  }, CHECKIN_METRICS[0]);
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

function getCheckinSummary(checkin, copy) {
  const values = CHECKIN_METRICS.map((metric) => getMetricValue(checkin, metric.field));
  const max = Math.max(...values);
  const highCount = values.filter((value) => value >= 3).length;

  if (max >= 4 || highCount >= 2) {
    return copy.diary.recovery;
  }

  if (max >= 2) {
    return copy.diary.mild;
  }

  return copy.diary.stable;
}

function getTopCheckinSignals(checkin, copy) {
  return DIARY_SIGNAL_METRICS.map((metric, priority) => ({
    key: metric.key,
    label: copy.trend.labels[metric.key],
    value: getMetricValue(checkin, metric.field),
    priority
  }))
    .filter((metric) => metric.value > 0)
    .sort((left, right) => {
      if (right.value !== left.value) {
        return right.value - left.value;
      }

      return left.priority - right.priority;
    })
    .slice(0, 2);
}

function getCheckinTags(checkin, copy) {
  const tags = [];

  if (checkin?.makeup_today) {
    tags.push(copy.diary.makeup);
  }

  if (checkin?.outdoor_today) {
    tags.push(copy.diary.outdoor);
  }

  return tags;
}

function LatestSavedReport({ report, copy, locale }) {
  if (!report) {
    return (
      <section className="rounded-[1.1rem] border border-[#ead2ca] bg-white/55 p-4 dark:border-[#3a2630] dark:bg-[#2f202a]/70">
        <p className="ui-kicker">{copy.savedReport.kicker}</p>
        <p className="ui-text-secondary mt-2 text-sm">{copy.savedReport.empty}</p>
        <p className="ui-text-faint mt-1 text-xs">{copy.savedReport.emptyBody}</p>
      </section>
    );
  }

  return (
    <section className="rounded-[1.1rem] border border-[#ead2ca] bg-white/55 p-4 dark:border-[#3a2630] dark:bg-[#2f202a]/70">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="ui-kicker">{copy.savedReport.kicker}</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="ui-chip-compact">{report.report_type || copy.savedReport.typeFallback}</span>
          {report.report_version ? (
            <span className="ui-chip-compact">{report.report_version}</span>
          ) : null}
        </div>
      </div>
      <p className="ui-text-primary mt-3 truncate text-sm font-semibold">
        {report.title || copy.savedReport.fallbackTitle}
      </p>
      {report.created_at ? (
        <p className="ui-text-faint mt-1 text-xs">
          {copy.savedReport.created}: {formatDate(report.created_at, locale)}
        </p>
      ) : null}
    </section>
  );
}

function SkinTrendPreview({ checkins, copy, locale }) {
  const recentCheckins = normalizeCheckins(checkins);
  const metric = chooseTrendMetric(recentCheckins);
  const points = buildSparklinePoints(recentCheckins, metric);
  const pointString = points.map((point) => `${point.x},${point.y}`).join(" ");
  const hasTrend = points.length >= 2;

  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26] sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ui-kicker">{copy.trend.kicker}</p>
          <h2 className="ui-title mt-1 text-xl">{copy.trend.title}</h2>
          <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.trend.body}</p>
        </div>
        <span className="ui-chip-compact w-fit">{copy.trend.labels[metric.key]}</span>
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

function SkinDiaryPreview({ checkins, copy, locale }) {
  const entries = normalizeCheckins(checkins).slice(0, 3);

  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26] sm:p-5">
      <div>
        <p className="ui-kicker">{copy.diary.kicker}</p>
        <h2 className="ui-title mt-1 text-xl">{copy.diary.title}</h2>
        <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.diary.body}</p>
      </div>

      {entries.length ? (
        <div className="mt-4 divide-y divide-[#ead2ca] overflow-hidden rounded-[1rem] border border-[#ead2ca] bg-[#fffaf6] dark:divide-[#4a303c] dark:border-[#3a2630] dark:bg-[#2f202a]">
          {entries.map((entry) => {
            const tags = getCheckinTags(entry, copy);
            const signals = getTopCheckinSignals(entry, copy);
            const memo = typeof entry.memo === "string" ? entry.memo.trim() : "";

            return (
              <article key={entry.id || entry.checkin_date} className="grid gap-3 p-3 sm:grid-cols-[5.5rem_minmax(0,1fr)]">
                <div className="min-w-0">
                  <p className="ui-text-primary text-sm font-semibold">{formatShortDate(entry.checkin_date, locale)}</p>
                  <p className="ui-text-faint mt-1 break-words text-xs">
                    <span>{getCheckinSummary(entry, copy)}</span>
                    {signals.map((signal) => (
                      <span key={signal.key}> · {signal.label} {signal.value}</span>
                    ))}
                  </p>
                </div>
                <div className="min-w-0">
                  {tags.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <span key={tag} className="ui-chip-compact">{tag}</span>
                      ))}
                    </div>
                  ) : null}
                  {memo ? (
                    <p className="ui-text-secondary mt-2 line-clamp-2 break-words text-sm leading-6">{memo}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 rounded-[1rem] border border-dashed border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#4a303c] dark:bg-[#2f202a]">
          <p className="ui-text-secondary text-sm leading-6">{copy.diary.empty}</p>
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

export default function MyDashboard({ dashboard, locale = "ko" }) {
  const copy = getMyCopy(locale);
  const [clientDashboard, setClientDashboard] = useState(null);
  // Server props are the initial fallback; browser-local dashboard data replaces them after refresh.
  const activeDashboard = clientDashboard || dashboard;

  useEffect(() => {
    const { localDate, timezone } = getBrowserDateContext();
    const params = new URLSearchParams({
      localDate,
      timezone
    });
    let isActive = true;

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

  const {
    latestSkinProfile,
    todayCheckin,
    recentCheckins,
    todayRoutine,
    latestSavedReport,
    hasProfile,
    needsCheckIn
  } = activeDashboard;

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
          <MyDashboardMenu locale={locale} />
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

              <SkinTrendPreview checkins={recentCheckins} copy={copy} locale={locale} />

              <SkinDiaryPreview checkins={recentCheckins} copy={copy} locale={locale} />

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.52fr)]">
                <SkinProfileSummaryCard
                  profile={latestSkinProfile}
                  copy={copy}
                  analysisDate={latestSavedReport?.created_at || latestSkinProfile?.created_at}
                  locale={locale}
                />
                <LatestSavedReport report={latestSavedReport} copy={copy} locale={locale} />
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
