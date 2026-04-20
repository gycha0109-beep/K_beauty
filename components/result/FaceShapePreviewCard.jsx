function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getFeatureTags(faceLab) {
  const items = [
    ...((Array.isArray(faceLab?.base_data?.landmarks) ? faceLab.base_data.landmarks : [])),
    ...((Array.isArray(faceLab?.base_data?.embedding) ? faceLab.base_data.embedding : []))
  ]
    .map((item) => cleanText(item))
    .filter(Boolean);

  return [...new Set(items)].slice(0, 4);
}

export default function FaceShapePreviewCard({ copy, faceLab }) {
  const faceShape = cleanText(faceLab?.base_data?.face_shape);
  const summary = cleanText(faceLab?.features?.face_shape_hairstyle?.summary);
  const featureTags = getFeatureTags(faceLab);

  if (!faceShape && !summary) {
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
          <h3 className="ui-title text-[1.6rem]">{copy.faceShapeFreeTitle}</h3>
        </div>

        {faceShape ? (
          <div className="ui-card-muted p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {copy.faceShapeLabel}
            </p>
            <p className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{faceShape}</p>
          </div>
        ) : null}

        {summary ? (
          <div className="ui-panel-accent p-5 shadow-soft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {copy.faceShapeSummaryLabel}
            </p>
            <p className="mt-2.5 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{summary}</p>
          </div>
        ) : null}

        {featureTags.length ? (
          <div className="space-y-2">
            <p className="ui-kicker">{copy.faceShapeTagsLabel}</p>
            <div className="flex flex-wrap gap-2">
              {featureTags.map((tag) => (
                <span key={tag} className="ui-chip px-3 py-1.5 text-xs font-medium">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
