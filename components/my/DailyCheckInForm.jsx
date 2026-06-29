"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserDateContext } from "@/lib/my/local-date";
import { getMyCopy } from "@/lib/my/i18n";
import {
  CHECKIN_EVENT_KEYS,
  normalizeCheckinEvents
} from "@/lib/my/checkin-events";

const FIELD_EVENT_KEYS = ["makeup_today", "outdoor_today"];

function RangeField({ field, value, onChange }) {
  return (
    <label className="block rounded-[1.1rem] border border-[#ead2ca] bg-white/60 p-4 dark:border-[#4a303c] dark:bg-[#301f28]">
      <div className="flex items-center justify-between gap-4">
        <span className="ui-text-primary text-sm font-semibold">{field.label}</span>
        <span className="ui-chip-compact">{value} / 4</span>
      </div>
      <input
        type="range"
        min="0"
        max="4"
        step="1"
        value={value}
        onChange={(event) => onChange(field.key, Number(event.target.value))}
        className="mt-4 w-full accent-[#e76b91]"
      />
      <div className="ui-text-faint mt-2 flex justify-between text-xs">
        <span>{field.low}</span>
        <span>{field.high}</span>
      </div>
    </label>
  );
}

function EventToggle({ label, checked, onChange }) {
  return (
    <label
      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
        checked
          ? "border-[#e76b91] bg-[#ffe8ef] text-[#7c3048] dark:border-[#ef6387] dark:bg-[#4a2533] dark:text-[#ffdce7]"
          : "border-[#ead2ca] bg-white/60 text-[#5b3744] dark:border-[#4a303c] dark:bg-[#301f28] dark:text-[#f3e4df]"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 shrink-0 accent-[#e76b91]"
      />
      <span className="min-w-0 break-keep text-left leading-5">{label}</span>
    </label>
  );
}

function applyCheckinToForm(current, checkin) {
  if (!checkin) {
    return current;
  }

  return {
    ...current,
    checkinDate: checkin.checkin_date || current.checkinDate,
    dryness_level: Number.isInteger(checkin.dryness_level) ? checkin.dryness_level : current.dryness_level,
    oiliness_level: Number.isInteger(checkin.oiliness_level) ? checkin.oiliness_level : current.oiliness_level,
    redness_level: Number.isInteger(checkin.redness_level) ? checkin.redness_level : current.redness_level,
    breakout_level: Number.isInteger(checkin.breakout_level) ? checkin.breakout_level : current.breakout_level,
    irritation_level: Number.isInteger(checkin.irritation_level) ? checkin.irritation_level : current.irritation_level,
    makeup_today: checkin.makeup_today === true,
    outdoor_today: checkin.outdoor_today === true,
    checkinEvents: normalizeCheckinEvents(checkin.context),
    memo: typeof checkin.memo === "string" ? checkin.memo : current.memo
  };
}

export default function DailyCheckInForm({ skinProfile, initialCheckin = null, locale = "ko" }) {
  const copy = getMyCopy(locale);
  const router = useRouter();
  const [form, setForm] = useState({
    checkinDate: "",
    timezone: "unknown",
    dryness_level: 0,
    oiliness_level: 0,
    redness_level: 0,
    breakout_level: 0,
    irritation_level: 0,
    makeup_today: false,
    outdoor_today: false,
    checkinEvents: normalizeCheckinEvents(null),
    memo: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const concernLabel = useMemo(() => {
    if (!Array.isArray(skinProfile?.concerns) || skinProfile.concerns.length === 0) {
      return copy.checkInForm.noConcerns;
    }

    return skinProfile.concerns.filter(Boolean).slice(0, 3).join(", ");
  }, [copy.checkInForm.noConcerns, skinProfile]);

  useEffect(() => {
    const dateContext = getBrowserDateContext();

    setForm((current) => {
      const next = {
        ...current,
        checkinDate: current.checkinDate || dateContext.localDate,
        timezone: dateContext.timezone
      };

      return initialCheckin?.checkin_date === next.checkinDate
        ? applyCheckinToForm(next, initialCheckin)
        : next;
    });
  }, [initialCheckin]);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateEvent(key, value) {
    setForm((current) => ({
      ...current,
      checkinEvents: {
        ...current.checkinEvents,
        [key]: value
      }
    }));
  }

  function updateCheckinEvent(key, value) {
    if (FIELD_EVENT_KEYS.includes(key)) {
      updateField(key, value);
      return;
    }

    updateEvent(key, value);
  }

  const checkinEventOptions = [
    {
      key: "makeup_today",
      label: copy.checkInForm.makeupToday,
      checked: form.makeup_today
    },
    {
      key: "outdoor_today",
      label: copy.checkInForm.outdoorToday,
      checked: form.outdoor_today
    },
    ...CHECKIN_EVENT_KEYS.map((key) => ({
      key,
      label: copy.checkInForm.events[key],
      checked: form.checkinEvents[key] === true
    }))
  ];

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const dateContext = getBrowserDateContext();
      const requestBody = {
        ...form,
        checkinDate: form.checkinDate || dateContext.localDate,
        timezone: dateContext.timezone
      };

      const response = await fetch("/api/my/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "checkin_failed");
      }

      router.push(copy.paths.my);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error?.message === "skin_profile_required"
          ? copy.checkInForm.profileRequired
          : copy.checkInForm.saveError
      );
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ui-card p-5 sm:p-6">
      <section className="border-b border-[#ead2ca] pb-5 dark:border-[#4a303c]">
        <p className="ui-kicker">{copy.checkInForm.activeProfile}</p>
        <h2 className="ui-title mt-2 text-xl">
          {skinProfile?.skin_type || copy.checkInForm.unknownSkinType}
        </h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{concernLabel}</p>
      </section>

      <section className="mt-5">
        <label className="block">
          <span className="ui-text-primary text-sm font-semibold">{copy.checkInForm.date}</span>
          <input
            type="date"
            value={form.checkinDate}
            onChange={(event) => updateField("checkinDate", event.target.value)}
            className="mt-2 min-h-11 w-full rounded-[0.9rem] border border-[#ead2ca] bg-white/70 px-3 text-sm text-[#4a2834] outline-none transition focus:border-[#e76b91] dark:border-[#4a303c] dark:bg-[#301f28] dark:text-[#f3e4df]"
            required
          />
        </label>
      </section>

      <section className="mt-5 grid gap-3">
        {copy.checkInForm.levels.map((field) => (
          <RangeField
            key={field.key}
            field={field}
            value={form[field.key]}
            onChange={updateField}
          />
        ))}
      </section>

      <section className="mt-5">
        <div>
          <p className="ui-text-primary text-sm font-semibold">{copy.checkInForm.eventsTitle}</p>
          <p className="ui-text-secondary mt-1 text-xs leading-5">{copy.checkInForm.eventsBody}</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {checkinEventOptions.map((eventOption) => (
            <EventToggle
              key={eventOption.key}
              label={eventOption.label}
              checked={eventOption.checked}
              onChange={(value) => updateCheckinEvent(eventOption.key, value)}
            />
          ))}
        </div>
      </section>

      <section className="mt-5">
        <label className="block">
          <span className="ui-text-primary text-sm font-semibold">{copy.checkInForm.memo}</span>
          <textarea
            value={form.memo}
            onChange={(event) => updateField("memo", event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder={copy.checkInForm.memoPlaceholder}
            className="mt-2 w-full resize-none rounded-[1.1rem] border border-[#ead2ca] bg-white/70 px-3 py-3 text-sm leading-6 text-[#4a2834] outline-none transition placeholder:text-[#9b7280] focus:border-[#e76b91] dark:border-[#4a303c] dark:bg-[#301f28] dark:text-[#f3e4df] dark:placeholder:text-[#9e7f8c]"
          />
        </label>
      </section>

      {errorMessage ? (
        <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{errorMessage}</p>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={isSubmitting}
          className="ui-button-primary min-h-11 px-5 text-sm font-semibold disabled:opacity-50"
        >
          {isSubmitting ? copy.checkInForm.saving : copy.checkInForm.submit}
        </button>
        <button
          type="button"
          onClick={() => router.push(copy.paths.my)}
          className="ui-button-secondary min-h-11 px-5 text-sm font-semibold"
        >
          {copy.checkInForm.cancel}
        </button>
      </div>
    </form>
  );
}
