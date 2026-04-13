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
      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.routineStepKicker}
        </p>
        <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-ink">
          {copy.routineStepTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-black/62">
          {copy.routineSubtitle}
        </p>
      </div>

      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-5 shadow-soft">
        <div className="grid grid-cols-2 gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              disabled={!tab.available}
              className={`rounded-full px-4 py-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-[#1f1811] text-white"
                  : "border border-black/10 bg-white text-black/65 hover:border-black/20"
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
              className="rounded-[1.5rem] bg-[#faf6f0] px-4 py-4"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-black/60">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-black/76">
                  {toRoutineAction(item, locale)}
                </p>
              </div>
            </div>
          ))}

          {!currentItems.length ? (
            <div className="rounded-[1.5rem] bg-[#faf6f0] px-4 py-4 text-sm leading-6 text-black/60">
              {copy.routineStepEmpty}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
