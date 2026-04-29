export default function ResultBottomCTA({
  label,
  onClick,
  disabled = false,
  previousLabel = null,
  onPrevious = null,
  secondaryActions = []
}) {
  return (
    <div className="ui-bottom-bar fixed inset-x-0 bottom-0 z-40">
      <div
        className="mx-auto w-full max-w-xl px-4 pt-3 sm:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="space-y-3">
          {onPrevious && previousLabel && !secondaryActions.length ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrevious}
                className="ui-button-secondary shrink-0 px-4 py-3 text-sm font-medium"
              >
                {previousLabel}
              </button>

              <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className="ui-button-primary min-h-14 flex-1 px-5 text-sm font-semibold disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
              >
                {label}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              className="ui-button-primary min-h-14 w-full px-5 text-sm font-semibold disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
            >
              {label}
            </button>
          )}

          {secondaryActions.length ? (
            <div className={`grid gap-3 ${secondaryActions.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {secondaryActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="ui-button-secondary min-h-12 px-4 text-sm font-medium"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
