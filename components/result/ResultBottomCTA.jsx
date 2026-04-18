export default function ResultBottomCTA({
  label,
  onClick,
  disabled = false,
  previousLabel = null,
  onPrevious = null
}) {
  return (
    <div className="ui-bottom-bar fixed inset-x-0 bottom-0 z-40">
      <div
        className="mx-auto w-full max-w-xl px-4 pt-3 sm:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="flex items-center gap-3">
          {onPrevious && previousLabel ? (
            <button
              type="button"
              onClick={onPrevious}
              className="ui-button-secondary shrink-0 px-4 py-3 text-sm font-medium"
            >
              {previousLabel}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="ui-button-primary min-h-14 flex-1 px-5 text-sm font-semibold disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
