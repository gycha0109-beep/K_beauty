"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserDateContext } from "@/lib/my/local-date";
import { getMyCopy } from "@/lib/my/i18n";

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

export default function DailyCheckInForm({ skinProfile, locale = "ko" }) {
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

    setForm((current) => ({
      ...current,
      checkinDate: current.checkinDate || dateContext.localDate,
      timezone: dateContext.timezone
    }));
  }, []);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

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

      <section className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="flex min-h-14 items-center gap-3 rounded-[1.1rem] border border-[#ead2ca] bg-white/60 px-4 dark:border-[#4a303c] dark:bg-[#301f28]">
          <input
            type="checkbox"
            checked={form.makeup_today}
            onChange={(event) => updateField("makeup_today", event.target.checked)}
            className="h-4 w-4 accent-[#e76b91]"
          />
          <span className="ui-text-primary text-sm font-semibold">{copy.checkInForm.makeupToday}</span>
        </label>
        <label className="flex min-h-14 items-center gap-3 rounded-[1.1rem] border border-[#ead2ca] bg-white/60 px-4 dark:border-[#4a303c] dark:bg-[#301f28]">
          <input
            type="checkbox"
            checked={form.outdoor_today}
            onChange={(event) => updateField("outdoor_today", event.target.checked)}
            className="h-4 w-4 accent-[#e76b91]"
          />
          <span className="ui-text-primary text-sm font-semibold">{copy.checkInForm.outdoorToday}</span>
        </label>
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
