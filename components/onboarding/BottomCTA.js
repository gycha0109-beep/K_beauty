export default function BottomCTA({
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-white/92 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:px-2">
        {tertiaryLabel ? (
          <button
            type="button"
            onClick={onTertiary}
            className="text-sm font-medium text-black/48"
          >
            {tertiaryLabel}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="inline-flex w-full items-center justify-center rounded-full bg-[#1f1811] px-5 py-3.5 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {primaryLabel}
        </button>

        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            className="text-sm font-medium text-black/58"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
