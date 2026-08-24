"use client";

import { useState } from "react";
import SkinDiaryDayDetail from "@/components/my/SkinDiaryDayDetail";
import {
  CHECKIN_EVENT_TAG_ORDER,
  getSelectedCheckinEventKeys
} from "@/lib/my/checkin-events";
import {
  addDiaryMonths,
  buildDiaryCalendar,
  isValidDiaryMonth
} from "@/lib/my/diary-month";
import { getMyCopy } from "@/lib/my/i18n";
import { isValidLocalDate } from "@/lib/my/local-date";

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

function formatShortDate(value, locale = "ko") {
  if (!value) {
    return "";
  }

  const dateLocale = getMyCopy(locale).dateLocale;

  try {
    const [year, month, day] = value.split("-").map(Number);

    return new Intl.DateTimeFormat(dateLocale, {
      month: "numeric",
      day: "numeric"
    }).format(new Date(year, month - 1, day));
  } catch {
    return "";
  }
}

function formatMonthLabel(value, locale = "ko") {
  if (!isValidDiaryMonth(value)) {
    return "";
  }

  const [year, month] = value.split("-").map(Number);
  const dateLocale = getMyCopy(locale).dateLocale;

  try {
    return new Intl.DateTimeFormat(dateLocale, {
      year: "numeric",
      month: "long"
    }).format(new Date(year, month - 1, 1));
  } catch {
    return value;
  }
}

function getCheckinSummary(checkin, copy) {
  const values = DIARY_SIGNAL_METRICS.map((metric) => getMetricValue(checkin, metric.field));
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

export default function SkinDiaryCalendar({
  checkins,
  copy,
  locale = "ko",
  diaryMonth,
  currentDiaryMonth,
  loading = false,
  onMonthChange
}) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);
  const [dayDetailError, setDayDetailError] = useState(false);
  const entries = normalizeCheckins(checkins);
  const calendarCells = buildDiaryCalendar(entries, diaryMonth);
  const weekLabels = locale === "en"
    ? ["S", "M", "T", "W", "T", "F", "S"]
    : ["일", "월", "화", "수", "목", "금", "토"];
  const previousMonth = addDiaryMonths(diaryMonth, -1);
  const nextMonth = addDiaryMonths(diaryMonth, 1);
  const canGoNext = isValidDiaryMonth(currentDiaryMonth) && diaryMonth < currentDiaryMonth;
  const isCurrentMonth = diaryMonth === currentDiaryMonth;

  async function openDayDetail(date) {
    if (!isValidLocalDate(date)) {
      return;
    }

    setSelectedDate(date);
    setDayDetail(null);
    setDayDetailError(false);
    setDayDetailLoading(true);

    try {
      const params = new URLSearchParams({ date });
      const response = await fetch(`/api/my/diary-day?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        setDayDetailError(true);
        return;
      }

      const payload = await response.json();
      setDayDetail(payload);
    } catch {
      setDayDetailError(true);
    } finally {
      setDayDetailLoading(false);
    }
  }

  function closeDayDetail() {
    setSelectedDate(null);
    setDayDetail(null);
    setDayDetailError(false);
    setDayDetailLoading(false);
  }

  return (
    <>
      <section className="rounded-[1.25rem] border border-[#ead2ca] bg-white/65 p-4 dark:border-[#4a303c] dark:bg-[#2b1c26] sm:p-5">
        <div>
          <p className="ui-kicker">{copy.diary.kicker}</p>
          <h2 className="ui-title mt-1 text-xl">{copy.diary.title}</h2>
          <p className="ui-text-secondary mt-1 text-sm leading-6">{copy.diary.body}</p>
        </div>

        <div className="mt-4 rounded-[1rem] border border-[#ead2ca] bg-[#fffaf6] p-3 dark:border-[#3a2630] dark:bg-[#2f202a]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={copy.diary.previousMonth}
              title={copy.diary.previousMonth}
              disabled={loading}
              onClick={() => onMonthChange?.(previousMonth)}
              className="ui-button-secondary flex min-h-10 min-w-10 items-center justify-center px-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              ‹
            </button>
            <p className="ui-text-primary min-w-0 flex-1 text-center text-sm font-semibold sm:text-base">
              {formatMonthLabel(diaryMonth, locale)}
            </p>
            <button
              type="button"
              aria-label={copy.diary.nextMonth}
              title={copy.diary.nextMonth}
              disabled={loading || !canGoNext}
              onClick={() => onMonthChange?.(nextMonth)}
              className="ui-button-secondary flex min-h-10 min-w-10 items-center justify-center px-3 text-lg disabled:cursor-not-allowed disabled:opacity-50"
            >
              ›
            </button>
            <button
              type="button"
              disabled={loading || isCurrentMonth}
              onClick={() => onMonthChange?.(currentDiaryMonth)}
              className="ui-button-secondary min-h-10 w-full px-3 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {loading ? copy.diary.loading : copy.diary.currentMonth}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[0.68rem] font-semibold text-[#9b7280] dark:text-[#cdb5bc]">
            {weekLabels.map((label, index) => (
              <span key={`${label}-${index}`}>{label}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1 overflow-hidden">
            {calendarCells.map((cell) => {
              if (cell.empty) {
                return <div key={cell.key} className="aspect-square min-w-0" />;
              }

              const entry = cell.entry;
              const memo = typeof entry?.memo === "string" ? entry.memo.trim() : "";
              const tags = entry ? getCheckinTags(entry, copy) : { visible: [], hiddenCount: 0 };
              const signals = entry ? getTopCheckinSignals(entry, copy) : [];
              const summary = entry ? getCheckinSummary(entry, copy) : "";
              const cellClassName = `relative min-h-14 min-w-0 rounded-[0.85rem] border p-1.5 text-left ${
                entry
                  ? "border-[#e6b9c7] bg-white text-[#3f2230] transition hover:border-[#e76b91] hover:bg-[#fff5f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e76b91] dark:border-[#6a4050] dark:bg-[#3a2530] dark:text-[#f7e6e2] dark:hover:bg-[#432934]"
                  : "border-transparent bg-transparent text-[#b79ca4] dark:text-[#80656d]"
              }`;
              const content = (
                <>
                  {memo ? (
                    <span className="absolute right-1 top-0 h-3 w-2 rounded-b-sm bg-[#e76b91]" aria-label={copy.diary.memoMarker} />
                  ) : null}
                  <p className="text-xs font-semibold leading-none">{cell.day}</p>
                  {entry ? (
                    <div className="mt-1 min-w-0 space-y-1">
                      <p className="truncate text-[0.62rem] text-[#8a5d69] dark:text-[#d9bcc5]">{summary}</p>
                      <div className="flex min-w-0 flex-wrap gap-0.5">
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
                </>
              );

              if (!entry) {
                return (
                  <div key={cell.key} className={cellClassName}>
                    {content}
                  </div>
                );
              }

              return (
                <button
                  key={cell.key}
                  type="button"
                  title={memo || undefined}
                  aria-label={`${cell.key} ${summary}`}
                  onClick={() => openDayDetail(entry.checkin_date)}
                  className={cellClassName}
                >
                  {content}
                </button>
              );
            })}
          </div>

          {entries.length ? (
            <div className="mt-3 divide-y divide-[#ead2ca] overflow-hidden rounded-[0.9rem] border border-[#ead2ca] dark:divide-[#4a303c] dark:border-[#3a2630]">
              {entries.slice(0, 2).map((entry) => {
                const tags = getCheckinTags(entry, copy);
                const signals = getTopCheckinSignals(entry, copy);
                const memo = typeof entry.memo === "string" ? entry.memo.trim() : "";

                return (
                  <button
                    key={entry.id || entry.checkin_date}
                    type="button"
                    onClick={() => openDayDetail(entry.checkin_date)}
                    className="grid w-full gap-3 p-3 text-left transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e76b91] dark:hover:bg-[#38242e] sm:grid-cols-[5.5rem_minmax(0,1fr)]"
                  >
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
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 rounded-[0.9rem] border border-dashed border-[#ead2ca] p-3 dark:border-[#4a303c]">
              <p className="ui-text-secondary text-sm leading-6">{copy.diary.empty}</p>
            </div>
          )}
        </div>
      </section>

      <SkinDiaryDayDetail
        selectedDate={selectedDate}
        detail={dayDetail}
        locale={locale}
        loading={dayDetailLoading}
        error={dayDetailError}
        onClose={closeDayDetail}
      />
    </>
  );
}
