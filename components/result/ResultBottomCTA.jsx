export default function ResultBottomCTA({
  label,
  onClick,
  disabled = false,
  previousLabel = null,
  onPrevious = null
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/6 bg-[rgba(255,252,247,0.92)] backdrop-blur">
      <div
        className="mx-auto w-full max-w-xl px-4 pt-3 sm:px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="flex items-center gap-3">
          {onPrevious && previousLabel ? (
            <button
              type="button"
              onClick={onPrevious}
              className="inline-flex shrink-0 items-center justify-center rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium text-black/68 transition hover:border-black/20 hover:bg-black/5"
            >
              {previousLabel}
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="inline-flex min-h-14 flex-1 items-center justify-center rounded-full bg-[#1f1811] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-black/20"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
