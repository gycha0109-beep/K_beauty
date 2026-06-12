import { getMyCopy } from "@/lib/my/i18n";

function renderList(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {values.filter(Boolean).map((value) => (
        <span key={value} className="ui-chip-compact">
          {value}
        </span>
      ))}
    </div>
  );
}

export default function SkinProfileSummaryCard({ profile, copy = getMyCopy("ko") }) {
  return (
    <section className="rounded-[1.25rem] border border-[#ead2ca] bg-[#fffaf6] p-4 dark:border-[#3a2630] dark:bg-[#2f202a] sm:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="ui-kicker">{copy.profile.kicker}</p>
          <h2 className="ui-title mt-1 text-xl">{copy.profile.title}</h2>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="border-b border-[#ead2ca] pb-3 dark:border-[#4a303c] sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4">
          <p className="ui-text-faint text-xs font-semibold uppercase">{copy.profile.skinType}</p>
          <p className="ui-text-primary mt-1 text-base font-semibold">
            {profile?.skin_type || copy.profile.unknown}
          </p>
        </div>
        <div className="sm:pl-1">
          <p className="ui-text-faint text-xs font-semibold uppercase">{copy.profile.sensitivity}</p>
          <p className="ui-text-primary mt-1 text-base font-semibold">
            {profile?.sensitivity_level || copy.profile.unknown}
          </p>
        </div>
      </div>

      {renderList(profile?.concerns)}

      {profile?.skin_summary ? (
        <p className="ui-text-primary mt-4 text-sm leading-6">{profile.skin_summary}</p>
      ) : null}

      {profile?.face_summary ? (
        <p className="ui-text-secondary mt-2 text-sm leading-6">{profile.face_summary}</p>
      ) : null}
    </section>
  );
}
