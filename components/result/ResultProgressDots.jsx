export default function ResultProgressDots({ currentStep, totalSteps, label }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="ui-kicker">
          {label}
        </p>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {currentStep} / {totalSteps}
        </p>
      </div>

      <div className="flex gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const active = index < currentStep;

          return (
            <span
              key={`result-dot-${index}`}
              className={`h-2 flex-1 rounded-full transition ${
                active
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : "bg-zinc-200 dark:bg-zinc-800"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
