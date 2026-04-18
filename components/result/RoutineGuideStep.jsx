"use client";

import { useEffect, useState } from "react";

export default function RoutineGuideStep({ copy, locale, morning, night, toRoutineAction }) {
  const [activeTab, setActiveTab] = useState(morning.length ? "morning" : "night");

  useEffect(() => {
    if (activeTab === "morning" && !morning.length && night.length) {
      setActiveTab("night");
    }

    if (activeTab === "night" && !night.length && morning.length) {
      setActiveTab("morning");
    }
  }, [activeTab, morning, night]);

  const currentItems = activeTab === "night" ? night : morning;
  const tabs = [
    { key: "morning", label: locale === "en" ? "Morning" : "아침", available: morning.length },
    { key: "night", label: locale === "en" ? "Night" : "저녁", available: night.length }
  ];

  return (
    <section className="space-y-4">
      <div className="ui-card p-6">
        <p className="ui-kicker">{copy.routineStepKicker}</p>
        <h2 className="ui-title mt-2 text-[2rem]">{copy.routineStepTitle}</h2>
        <p className="ui-text-secondary mt-2 text-sm leading-6">{copy.routineSubtitle}</p>
      </div>

      <div className="ui-card p-5">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              disabled={!tab.available}
              className={`rounded-full px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "ui-choice-active"
                  : "ui-button-secondary"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {currentItems.map((item, index) => (
            <div
              key={`${activeTab}-${index}`}
              className="rounded-[1.5rem] bg-zinc-50 px-4 py-4 dark:bg-zinc-800/70"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {toRoutineAction(item, locale)}
                </p>
              </div>
            </div>
          ))}

          {!currentItems.length ? (
            <div className="rounded-[1.5rem] bg-zinc-50 px-4 py-4 text-sm leading-6 text-zinc-600 dark:bg-zinc-800/70 dark:text-zinc-400">
              {copy.routineStepEmpty}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
