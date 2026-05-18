export default function ResultBottomCTA({
  label,
  onClick,
  disabled = false,
  previousLabel = null,
  onPrevious = null,
  secondaryActions = [],
  fixed = true
}) {
  const shellClass = fixed
    ? "ui-bottom-bar fixed inset-x-0 bottom-0 z-40"
    : "mt-4";
  const innerClass = fixed
    ? "mx-auto w-full max-w-xl px-4 pt-3 sm:px-6"
    : "w-full";
  const innerStyle = fixed
    ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }
    : undefined;
  const primaryButtonClass = fixed
    ? "ui-button-primary"
    : "ui-button-primary bg-[linear-gradient(90deg,#e96b93_0%,#ff8769_100%)] !text-white shadow-[0_16px_34px_rgba(232,96,116,0.28)] hover:opacity-95";
  const secondaryButtonClass = fixed
    ? "ui-button-secondary"
    : "ui-button-secondary border-[rgba(90,50,50,0.18)] bg-white/[0.36] text-[#5a2d3c] hover:bg-[rgba(255,120,120,0.06)] dark:border-[#5a3a48] dark:bg-[#301f28] dark:text-[#f4d7df] dark:hover:bg-[#382430]";

  return (
    <div className={shellClass}>
      <div
        className={innerClass}
        style={innerStyle}
      >
        <div className="space-y-3">
          {onPrevious && previousLabel && !secondaryActions.length ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onPrevious}
                className={`${secondaryButtonClass} shrink-0 px-4 py-3 text-sm font-medium`}
              >
                {previousLabel}
              </button>

              <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={`${primaryButtonClass} min-h-14 flex-1 px-5 text-sm font-semibold disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400`}
              >
                {label}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClick}
              disabled={disabled}
              className={`${primaryButtonClass} min-h-14 w-full px-5 text-sm font-semibold disabled:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400`}
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
                  className={`${secondaryButtonClass} min-h-12 px-4 text-sm font-medium`}
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
