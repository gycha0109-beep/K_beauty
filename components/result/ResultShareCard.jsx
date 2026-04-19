import { getConcernLabels, getShareCopy, getSkinTypeLabel } from "@/lib/analysis-results";

export default function ResultShareCard({
  locale = "ko",
  skinType = "",
  mainConcerns = [],
  summary = "",
  topPick = null,
  categoryPicks = [],
  routineAm = [],
  routinePm = [],
  compact = false
}) {
  const copy = getShareCopy(locale);
  const concerns = getConcernLabels(mainConcerns, locale);
  const visibleProducts = [topPick, ...categoryPicks].filter(Boolean).slice(0, compact ? 3 : 5);

  return (
    <div className="ui-card overflow-hidden p-0">
      <div className="bg-[linear-gradient(135deg,#f1dfc8_0%,#fff7ee_56%,#fffdf9_100%)] p-5 dark:bg-[linear-gradient(135deg,#24211b_0%,#141311_100%)]">
        <p className="ui-kicker">K-Beauty Result</p>
        <h2 className="ui-title mt-2 text-[1.6rem]">{copy.title}</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.skinTypeLabel}</p>
            <p className="ui-title mt-2 text-base">{getSkinTypeLabel(skinType, locale)}</p>
          </div>
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.concern}</p>
            <p className="ui-title mt-2 text-base">{concerns.length ? concerns.join(" · ") : "-"}</p>
          </div>
        </div>
        <div className="ui-panel-accent mt-3 p-4">
          <p className="ui-kicker">{copy.summary}</p>
          <p className="ui-text-primary mt-2 text-sm leading-6 whitespace-pre-line">{summary}</p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {topPick ? (
          <div className="ui-card-muted p-4">
            <p className="ui-kicker">{copy.topPick}</p>
            <p className="ui-title mt-2 text-lg">{topPick.name}</p>
            <p className="ui-text-secondary mt-1 text-sm">{topPick.brand}</p>
            {topPick.reason ? <p className="ui-text-primary mt-3 text-sm leading-6">{topPick.reason}</p> : null}
          </div>
        ) : null}

        {visibleProducts.length > 1 ? (
          <div className="ui-card-subtle p-4">
            <p className="ui-kicker">{copy.supporting}</p>
            <div className="mt-3 space-y-2.5">
              {visibleProducts.slice(topPick ? 1 : 0).map((product) => (
                <div key={`${product.id}-${product.name}`} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="ui-title text-sm">{product.name}</p>
                    <p className="ui-text-secondary mt-1 text-xs">{product.brand}</p>
                  </div>
                  {product.step ? <span className="ui-chip-compact shrink-0">{product.step}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!compact && (routineAm.length || routinePm.length) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="ui-card-subtle p-4">
              <p className="ui-kicker">{copy.routineAm}</p>
              <div className="mt-3 space-y-2">
                {routineAm.length ? (
                  routineAm.map((item, index) => (
                    <p key={`${item}-${index}`} className="ui-text-primary text-sm leading-6">
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="ui-text-secondary text-sm">-</p>
                )}
              </div>
            </div>
            <div className="ui-card-subtle p-4">
              <p className="ui-kicker">{copy.routinePm}</p>
              <div className="mt-3 space-y-2">
                {routinePm.length ? (
                  routinePm.map((item, index) => (
                    <p key={`${item}-${index}`} className="ui-text-primary text-sm leading-6">
                      {item}
                    </p>
                  ))
                ) : (
                  <p className="ui-text-secondary text-sm">-</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
