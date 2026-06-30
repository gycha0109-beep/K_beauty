import { getMyCopy } from "@/lib/my/i18n";

function getMappedLabel(value, labels, fallback) {
  if (!value) {
    return fallback;
  }

  return labels?.[value] || value;
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
  copy = getMyCopy("ko")
}) {
  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#3a2630] dark:bg-[#2f202a] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ui-kicker">{copy.profile.kicker}</p>
          <h2 className="ui-title mt-1 text-xl">{copy.profile.title}</h2>
        </div>
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
    </section>
  );
}
