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

              <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.52fr)]">
                <SkinProfileSummaryCard profile={latestSkinProfile} copy={copy} />
                <LatestSavedReport report={latestSavedReport} copy={copy} locale={locale} />
              </section>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
