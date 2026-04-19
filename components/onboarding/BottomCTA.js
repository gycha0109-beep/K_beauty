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
    <div className="ui-bottom-bar fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 sm:px-2">
        {tertiaryLabel ? (
          <button
            type="button"
            onClick={onTertiary}
            className="ui-button-tertiary"
          >
            {tertiaryLabel}
          </button>
        ) : null}

        <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled}
          className="ui-button-primary w-full px-5 py-3.5 text-sm font-semibold"
        >
          {primaryLabel}
        </button>

        {secondaryLabel ? (
          <button
            type="button"
            onClick={onSecondary}
            className="ui-button-tertiary"
          >
            {secondaryLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
