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

export default function SkinProfileSummaryCard({ profile }) {
  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">Skin Profile</p>
      <h2 className="ui-title mt-2 text-2xl">최근 피부 프로필 요약</h2>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[1.1rem] border border-[#ead2ca] bg-white/60 p-4 dark:border-[#4a303c] dark:bg-[#301f28]">
          <p className="ui-text-faint text-xs font-semibold uppercase">Skin Type</p>
          <p className="ui-text-primary mt-1 text-base font-semibold">
            {profile?.skin_type || "미정"}
          </p>
        </div>
        <div className="rounded-[1.1rem] border border-[#ead2ca] bg-white/60 p-4 dark:border-[#4a303c] dark:bg-[#301f28]">
          <p className="ui-text-faint text-xs font-semibold uppercase">Sensitivity</p>
          <p className="ui-text-primary mt-1 text-base font-semibold">
            {profile?.sensitivity_level || "미정"}
          </p>
        </div>
      </div>

      {renderList(profile?.concerns)}

      {profile?.skin_summary ? (
        <p className="ui-text-primary mt-5 text-sm leading-6">{profile.skin_summary}</p>
      ) : null}

      {profile?.face_summary ? (
        <p className="ui-text-secondary mt-3 text-sm leading-6">{profile.face_summary}</p>
      ) : null}
    </section>
  );
}
