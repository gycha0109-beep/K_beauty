export default function ProgressDots({ current = 1, total = 5, copy }) {
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/38">
        {copy.progress.stepLabel} {current} / {total}
      </p>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={`dot-${index}`}
            className={`h-2.5 flex-1 rounded-full transition ${
              index < current ? "bg-[#1f1811]" : "bg-black/10"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
