"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MyDashboardMenu from "@/components/my/MyDashboardMenu";
import SkinProfileSummaryCard from "@/components/my/SkinProfileSummaryCard";
import TodayCheckInPrompt from "@/components/my/TodayCheckInPrompt";
import TodayRoutineCard from "@/components/my/TodayRoutineCard";
import {
  CHECKIN_EVENT_TAG_ORDER,
  getSelectedCheckinEventKeys
} from "@/lib/my/checkin-events";
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
  const selectedEvents = new Set(getSelectedCheckinEventKeys(checkin?.context));
  const allTags = CHECKIN_EVENT_TAG_ORDER.map((key) => {
    if (key === "makeup") {
      return checkin?.makeup_today ? copy.diary.makeup : null;
    }

    if (key === "outdoor") {
      return checkin?.outdoor_today ? copy.diary.outdoor : null;
    }

    return selectedEvents.has(key) ? copy.diary.events[key] : null;
  }).filter(Boolean);

  return {
    visible: allTags.slice(0, 3),
    hiddenCount: Math.max(0, allTags.length - 3)
  };
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

function getCalendarAnchor(entries) {
  const latestDate = entries[0]?.checkin_date;

  if (/^\d{4}-\d{2}-\d{2}$/.test(latestDate || "")) {
    const [year, month] = latestDate.split("-").map(Number);
    return { year, month };
  }

  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function buildDiaryCalendar(entries) {
  const { year, month } = getCalendarAnchor(entries);
  const firstDay = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0).getDate();
  const leadingEmpty = firstDay.getDay();
  const entriesByDate = new Map(entries.map((entry) => [entry.checkin_date, entry]));
  const cells = [];

  for (let index = 0; index < leadingEmpty; index += 1) {
    cells.push({ key: `empty-${index}`, empty: true });
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({
      key: dateKey,
      day,
      entry: entriesByDate.get(dateKey) || null
    });
  }

  return cells;
}

function SkinDiaryPreview({ checkins, copy, locale }) {
  const entries = normalizeCheckins(checkins);
  const calendarCells = buildDiaryCalendar(entries);
  const weekLabels = locale === "en"
    ? ["S", "M", "T", "W", "T", "F", "S"]
    : ["일", "월", "화", "수", "목", "금", "토"];

  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26] sm:p-5">
      <div>
        <p className="ui-kicker">{copy.diary.kicker}</p>
        <h2 className="ui-title mt-1 text-xl">{copy.diary.title}</h2>
        <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.diary.body}</p>
      </div>

      {entries.length ? (
        <div className="mt-4 rounded-[1rem] border border-[#ead2ca] bg-[#fffaf6] p-3 dark:border-[#3a2630] dark:bg-[#2f202a]">
          <div className="grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-[#9b7280] dark:text-[#cdb5bc]">
            {weekLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              if (cell.empty) {
                return <div key={cell.key} className="aspect-square" />;
              }

              const entry = cell.entry;
              const memo = typeof entry?.memo === "string" ? entry.memo.trim() : "";
              const tags = entry ? getCheckinTags(entry, copy) : { visible: [], hiddenCount: 0 };
              const signals = entry ? getTopCheckinSignals(entry, copy) : [];
              const summary = entry ? getCheckinSummary(entry, copy) : "";

              return (
                <div
                  key={cell.key}
                  title={memo || undefined}
                  className={`relative min-h-14 rounded-[0.85rem] border p-1.5 text-left ${
                    entry
                      ? "border-[#e6b9c7] bg-white text-[#3f2230] dark:border-[#6a4050] dark:bg-[#3a2530] dark:text-[#f7e6e2]"
                      : "border-transparent bg-transparent text-[#b79ca4] dark:text-[#80656d]"
                  }`}
                >
                  {memo ? (
                    <span className="absolute right-1 top-0 h-3 w-2 rounded-b-sm bg-[#e76b91]" aria-label={copy.diary.memoMarker} />
                  ) : null}
                  <p className="text-xs font-semibold leading-none">{cell.day}</p>
                  {entry ? (
                    <div className="mt-1 space-y-1">
                      <p className="truncate text-[0.62rem] text-[#8a5d69] dark:text-[#d9bcc5]">{summary}</p>
                      <div className="flex flex-wrap gap-0.5">
                        {tags.visible.slice(0, 1).map((tag) => (
                          <span key={tag} className="max-w-full truncate rounded-full border border-[#ead2ca] px-1 text-[0.58rem] text-[#7c3048] dark:border-[#5a3a45] dark:text-[#ffdce7]">
                            {tag}
                          </span>
                        ))}
                        {tags.hiddenCount || tags.visible.length > 1 ? (
                          <span className="rounded-full border border-[#ead2ca] px-1 text-[0.58rem] text-[#7c3048] dark:border-[#5a3a45] dark:text-[#ffdce7]">
                            +{tags.hiddenCount + Math.max(0, tags.visible.length - 1)}
                          </span>
                        ) : null}
                      </div>
                      {signals[0] ? (
                        <p className="truncate text-[0.58rem] text-[#9b7280] dark:text-[#cdb5bc]">
                          {signals[0].label} {signals[0].value}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 divide-y divide-[#ead2ca] overflow-hidden rounded-[0.9rem] border border-[#ead2ca] dark:divide-[#4a303c] dark:border-[#3a2630]">
            {entries.slice(0, 2).map((entry) => {
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
                  {tags.visible.length || tags.hiddenCount ? (
                    <div className="flex flex-wrap gap-1.5">
                      {tags.visible.map((tag) => (
                        <span key={tag} className="ui-chip-compact">{tag}</span>
                      ))}
                      {tags.hiddenCount ? (
                        <span className="ui-chip-compact">+{tags.hiddenCount}</span>
                      ) : null}
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

function getReportHref(path) {
  return typeof path === "string" && path.startsWith("/r/") ? path : null;
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
    latestSharePath,
    hasProfile,
    needsCheckIn
  } = activeDashboard;
  const latestReportHref = getReportHref(latestSharePath);

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

              <SkinTrendPreview checkins={recentCheckins} copy={copy} locale={locale} />

              <SkinDiaryPreview checkins={recentCheckins} copy={copy} locale={locale} />

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
