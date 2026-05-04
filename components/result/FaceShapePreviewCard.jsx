function hasTeaserLine(data) {
  return Boolean(data?.free?.teaserLine);
}

export default function FaceShapePreviewCard({ copy, launchData }) {
  const teaserBody = copy.faceLabTeaserBody || "";
  const teaserLine = launchData?.free?.teaserLine || "";

  if (!hasTeaserLine(launchData)) {
    return (
      <div className="ui-card p-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {copy.faceShapeEmpty}
      </div>
    );
  }

  return (
    <section className="ui-card p-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="ui-kicker">{copy.faceShapeFreeKicker}</p>
          <h3 className="ui-title text-[1.35rem] sm:text-[1.45rem]">{copy.faceLabTeaserTitle || copy.faceShapeFreeTitle}</h3>
          {teaserBody ? <p className="ui-text-secondary text-sm leading-6">{teaserBody}</p> : null}
        </div>

        <div className="rounded-[1.15rem] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
            {copy.faceShapeSummaryLabel || "Teaser"}
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{teaserLine}</p>
        </div>
      </div>
    </section>
  );
}
