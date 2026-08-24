"use client";

import {
  CHECKIN_EVENT_TAG_ORDER,
  getSelectedCheckinEventKeys
} from "@/lib/my/checkin-events";
import { getMyCopy } from "@/lib/my/i18n";

const DETAIL_COPY = {
  ko: {
    kicker: "Diary Day",
    title: "이날의 기록",
    close: "닫기",
    loading: "기록을 불러오는 중...",
    unavailable: "이날의 상세 기록을 불러오지 못했습니다.",
    checkin: "피부 상태",
    events: "이날의 이벤트",
    memo: "메모",
    noMemo: "남긴 메모가 없습니다.",
    care: "저장 당시 케어",
    careBody: "이날 저장된 routine log를 그대로 보여줍니다. 현재 규칙으로 다시 계산하지 않습니다.",
    am: "AM 루틴",
    pm: "PM 루틴",
    keep: "유지",
    reduce: "줄이기",
    avoid: "피하기",
    warnings: "당시 주의",
    noRoutine: "이날 저장된 루틴이 없습니다.",
    source: "생성 방식"
  },
  en: {
    kicker: "Diary Day",
    title: "This day's record",
    close: "Close",
    loading: "Loading this record...",
    unavailable: "Unable to load this day's detail.",
    checkin: "Skin check-in",
    events: "Events that day",
    memo: "Memo",
    noMemo: "No memo was saved.",
    care: "Saved care snapshot",
    careBody: "This shows the routine log saved on that day without recalculating it with current rules.",
    am: "AM routine",
    pm: "PM routine",
    keep: "Keep",
    reduce: "Reduce",
    avoid: "Avoid",
    warnings: "Saved cautions",
    noRoutine: "No routine was saved for this day.",
    source: "Generation source"
  }
};

const METRICS = [
  { key: "dryness", field: "dryness_level" },
  { key: "oiliness", field: "oiliness_level" },
  { key: "redness", field: "redness_level" },
  { key: "breakout", field: "breakout_level" },
  { key: "irritation", field: "irritation_level" }
];

function formatDate(value, locale) {
  if (!value) return "";

  try {
    const [year, month, day] = value.split("-").map(Number);
    return new Intl.DateTimeFormat(getMyCopy(locale).dateLocale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(new Date(year, month - 1, day));
  } catch {
    return value;
  }
}

function normalizeTextList(values) {
  return Array.isArray(values) ? values.filter(Boolean).map(String) : [];
}

function normalizeSteps(values) {
  return Array.isArray(values) ? values.filter((value) => value && typeof value === "object") : [];
}

function normalizeWarnings(values) {
  return Array.isArray(values) ? values.filter((value) => value && typeof value === "object") : [];
}

function getEventLabels(checkin, copy) {
  const selectedEvents = new Set(getSelectedCheckinEventKeys(checkin?.context));

  return CHECKIN_EVENT_TAG_ORDER.map((key) => {
    if (key === "makeup") return checkin?.makeup_today ? copy.diary.makeup : null;
    if (key === "outdoor") return checkin?.outdoor_today ? copy.diary.outdoor : null;
    return selectedEvents.has(key) ? copy.diary.events[key] : null;
  }).filter(Boolean);
}

function RoutineSteps({ title, steps }) {
  if (!steps.length) return null;

  return (
    <div className="rounded-[1rem] border border-[#ead2ca] bg-white/70 p-3 dark:border-[#4a303c] dark:bg-[#2f202a]">
      <p className="ui-text-primary text-sm font-semibold">{title}</p>
      <ol className="mt-2 space-y-2">
        {steps.map((step, index) => (
          <li key={`${step.step || step.name || "step"}-${index}`} className="min-w-0">
            <p className="ui-text-primary break-words text-sm font-medium">{step.name || step.step || `${index + 1}`}</p>
            {step.instruction ? (
              <p className="ui-text-secondary mt-0.5 break-words text-xs leading-5">{String(step.instruction)}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function StoredList({ title, items }) {
  if (!items.length) return null;

  return (
    <div className="rounded-[1rem] border border-[#ead2ca] bg-white/70 p-3 dark:border-[#4a303c] dark:bg-[#2f202a]">
      <p className="ui-text-primary text-sm font-semibold">{title}</p>
      <ul className="ui-text-secondary mt-2 space-y-1 text-sm leading-5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="break-words">{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function SkinDiaryDayDetail({
  selectedDate,
  detail,
  locale = "ko",
  loading = false,
  error = false,
  onClose
}) {
  if (!selectedDate) return null;

  const copy = getMyCopy(locale);
  const text = DETAIL_COPY[locale === "en" ? "en" : "ko"];
  const checkin = detail?.checkin || null;
  const routine = detail?.routine || null;
  const eventLabels = getEventLabels(checkin, copy);
  const memo = typeof checkin?.memo === "string" ? checkin.memo.trim() : "";
  const amRoutine = normalizeSteps(routine?.am_routine);
  const pmRoutine = normalizeSteps(routine?.pm_routine);
  const keepItems = normalizeTextList(routine?.keep_items);
  const reduceItems = normalizeTextList(routine?.reduce_items);
  const avoidItems = normalizeTextList(routine?.avoid_items);
  const warnings = normalizeWarnings(routine?.warnings);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 p-0 sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`${text.title} ${formatDate(selectedDate, locale)}`}
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-[1.5rem] border border-[#ead2ca] bg-[#fffaf6] p-4 shadow-2xl dark:border-[#4a303c] dark:bg-[#241820] sm:rounded-[1.5rem] sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="ui-kicker">{text.kicker}</p>
            <h2 className="ui-title mt-1 text-2xl">{text.title}</h2>
            <p className="ui-text-faint mt-1 text-xs">{formatDate(selectedDate, locale)}</p>
          </div>
          <button type="button" onClick={onClose} className="ui-button-secondary min-h-10 shrink-0 px-3 text-sm font-semibold">
            {text.close}
          </button>
        </div>

        {loading ? (
          <div className="mt-5 rounded-[1rem] border border-dashed border-[#ead2ca] p-4 dark:border-[#4a303c]">
            <p className="ui-text-secondary text-sm">{text.loading}</p>
          </div>
        ) : error || !checkin ? (
          <div className="mt-5 rounded-[1rem] border border-dashed border-[#ead2ca] p-4 dark:border-[#4a303c]">
            <p className="ui-text-secondary text-sm">{text.unavailable}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <section>
              <h3 className="ui-text-primary text-sm font-semibold">{text.checkin}</h3>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {METRICS.map((metric) => (
                  <div key={metric.key} className="rounded-[0.9rem] border border-[#ead2ca] bg-white/70 p-2.5 text-center dark:border-[#4a303c] dark:bg-[#2f202a]">
                    <p className="ui-text-faint text-[0.68rem]">{copy.trend.labels[metric.key]}</p>
                    <p className="ui-text-primary mt-1 text-lg font-semibold">{Number(checkin[metric.field] || 0)}</p>
                  </div>
                ))}
              </div>
            </section>

            {eventLabels.length ? (
              <section>
                <h3 className="ui-text-primary text-sm font-semibold">{text.events}</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {eventLabels.map((label) => <span key={label} className="ui-chip-compact">{label}</span>)}
                </div>
              </section>
            ) : null}

            <section>
              <h3 className="ui-text-primary text-sm font-semibold">{text.memo}</h3>
              <p className="ui-text-secondary mt-2 whitespace-pre-wrap break-words rounded-[1rem] border border-[#ead2ca] bg-white/70 p-3 text-sm leading-6 dark:border-[#4a303c] dark:bg-[#2f202a]">
                {memo || text.noMemo}
              </p>
            </section>

            <section className="rounded-[1.15rem] border border-[#e6b9c7] bg-[#fff4f7] p-3 dark:border-[#6a4050] dark:bg-[#321f29]">
              <h3 className="ui-text-primary text-sm font-semibold">{text.care}</h3>
              <p className="ui-text-secondary mt-1 text-xs leading-5">{text.careBody}</p>

              {routine ? (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <RoutineSteps title={text.am} steps={amRoutine} />
                    <RoutineSteps title={text.pm} steps={pmRoutine} />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <StoredList title={text.keep} items={keepItems} />
                    <StoredList title={text.reduce} items={reduceItems} />
                    <StoredList title={text.avoid} items={avoidItems} />
                  </div>
                  {warnings.length ? (
                    <div className="rounded-[1rem] border border-[#e0b9b0] bg-[#fff3ee] p-3 dark:border-[#6a4050] dark:bg-[#351f28]">
                      <p className="ui-text-primary text-sm font-semibold">{text.warnings}</p>
                      <ul className="ui-text-secondary mt-2 space-y-1 text-sm leading-5">
                        {warnings.map((warning, index) => (
                          <li key={`${warning.type || "warning"}-${index}`} className="break-words">
                            {String(warning.message || warning.type || "")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {routine.generation_source ? (
                    <p className="ui-text-faint text-xs">{text.source}: {String(routine.generation_source)}</p>
                  ) : null}
                </div>
              ) : (
                <p className="ui-text-secondary mt-3 text-sm">{text.noRoutine}</p>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
