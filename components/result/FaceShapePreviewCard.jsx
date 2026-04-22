function hasTeaserLines(data) {
  return Boolean(
    data?.free?.impressionLine ||
      data?.free?.shapeLine ||
      data?.free?.styleLine
  );
}

export default function FaceShapePreviewCard({ copy, launchData, onEngage }) {
  const teaserLines = [
    {
      label: copy.faceLabImpressionLabel || (copy.faceShapeSummaryLabel || "Impression"),
      value: launchData?.free?.impressionLine || ""
    },
    {
      label: copy.faceLabShapeLabel || copy.faceShapeLabel || "Shape",
      value: launchData?.free?.shapeLine || ""
    },
    {
      label: copy.faceLabStyleLabel || (copy.faceShapeTagsLabel || "Style"),
      value: launchData?.free?.styleLine || ""
    }
  ].filter((item) => item.value);

  if (!hasTeaserLines(launchData)) {
    return (
      <div className="ui-card p-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {copy.faceShapeEmpty}
      </div>
    );
  }

  return (
    <section
      className="ui-card p-6"
      onClick={onEngage}
      role={onEngage ? "button" : undefined}
      tabIndex={onEngage ? 0 : undefined}
      onKeyDown={
        onEngage
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEngage();
              }
            }
          : undefined
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="ui-kicker">{copy.faceShapeFreeKicker}</p>
          <h3 className="ui-title text-[1.35rem] sm:text-[1.45rem]">{copy.faceLabTeaserTitle || copy.faceShapeFreeTitle}</h3>
          <p className="ui-text-secondary text-sm leading-6">
            {copy.faceLabTeaserBody || copy.faceShapeEmpty}
          </p>
        </div>

        <div className="space-y-3">
          {teaserLines.map((item) => (
            <div key={item.label} className="rounded-[1.15rem] bg-zinc-50 px-4 py-4 dark:bg-zinc-900">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                {item.label}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{item.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
