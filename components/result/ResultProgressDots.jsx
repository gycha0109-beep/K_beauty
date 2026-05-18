export default function ResultProgressDots({ currentStep, totalSteps, label }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="ui-kicker" data-result-progress-label>
          {label}
        </p>
        <p className="text-xs font-medium text-[#7e5261] dark:text-[#c7aeb8]">
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
                  ? "bg-[#3a1824] dark:bg-[#fff7f2]"
                  : "bg-[#d8c2bc] dark:bg-[#3a2a33]"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
