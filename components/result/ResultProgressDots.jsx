export default function ResultProgressDots({ currentStep, totalSteps, label }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {label}
        </p>
        <p className="text-xs font-medium text-black/45">
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
                active ? "bg-[#1f1811]" : "bg-black/10"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
