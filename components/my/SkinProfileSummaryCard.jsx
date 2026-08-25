import Link from "next/link";
import { getMyCopy } from "@/lib/my/i18n";

const BASELINE_COPY = {
  ko: {
    title: "현재 기준 피부 프로필",
    body: "매일 체크인과 케어는 이 분석 기준선을 바탕으로 이어집니다.",
    current: "현재 기준",
    refresh: "새 분석으로 갱신",
    refreshNote: "새 분석을 저장하면 현재 기준선이 교체되고, 기존 분석 기록은 그대로 유지됩니다."
  },
  en: {
    title: "Current Skin Baseline",
    body: "Daily check-ins and care continue from this analysis baseline.",
    current: "Current baseline",
    refresh: "Refresh with a new analysis",
    refreshNote: "Saving a new analysis replaces the current baseline while keeping your previous analysis history."
  }
};

function getMappedLabel(value, labels, fallback) {
  if (!value) {
    return fallback;
  }

  return labels?.[value] || value;
}

function formatBaselineDate(value, locale) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function renderList(values, copy) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <p className="ui-text-faint text-xs font-semibold uppercase">{copy.profile.concerns}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.filter(Boolean).map((value) => (
          <span key={value} className="ui-chip-compact">
            {getMappedLabel(value, copy.profile.concernsMap, value)}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SkinProfileSummaryCard({
  profile,
  copy = getMyCopy("ko"),
  locale = "ko"
}) {
  const baselineCopy = locale === "en" ? BASELINE_COPY.en : BASELINE_COPY.ko;
  const analysisDate = formatBaselineDate(profile?.created_at, locale);

  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#3a2630] dark:bg-[#2f202a] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="ui-kicker">{copy.profile.kicker}</p>
            <span className="ui-chip-compact">{baselineCopy.current}</span>
          </div>
          <h2 className="ui-title mt-1 text-xl">{baselineCopy.title}</h2>
          <p className="ui-text-secondary mt-1 text-sm leading-6">{baselineCopy.body}</p>
          {analysisDate ? (
            <p className="ui-text-faint mt-2 text-xs">
              {copy.profile.analysisDate}: {analysisDate}
            </p>
          ) : null}
        </div>
        <Link
          href={copy.paths.home}
          className="ui-button-secondary flex min-h-10 w-full shrink-0 items-center justify-center px-4 text-sm font-semibold sm:w-auto"
        >
          {baselineCopy.refresh}
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[0.9rem] border border-[#ead2ca] bg-white/55 p-3 dark:border-[#4a303c] dark:bg-[#2b1c26]/70">
          <p className="ui-text-faint text-xs font-semibold uppercase">{copy.profile.skinType}</p>
          <p className="ui-text-primary mt-1 text-base font-semibold">
            {getMappedLabel(profile?.skin_type, copy.profile.skinTypes, copy.profile.unknown)}
          </p>
        </div>
        <div className="rounded-[0.9rem] border border-[#ead2ca] bg-white/55 p-3 dark:border-[#4a303c] dark:bg-[#2b1c26]/70">
          <p className="ui-text-faint text-xs font-semibold uppercase">{copy.profile.sensitivity}</p>
          <p className="ui-text-primary mt-1 text-base font-semibold">
            {getMappedLabel(profile?.sensitivity_level, copy.profile.sensitivities, copy.profile.unknown)}
          </p>
        </div>
      </div>

      {renderList(profile?.concerns, copy)}

      <p className="ui-text-faint mt-4 border-t border-[#ead2ca] pt-3 text-xs leading-5 dark:border-[#4a303c]">
        {baselineCopy.refreshNote}
      </p>
    </section>
  );
}
