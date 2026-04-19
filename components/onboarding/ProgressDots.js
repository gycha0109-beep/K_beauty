export default function ProgressDots({ current = 1, total = 5, copy }) {
  return (
    <div className="space-y-3">
      <p className="ui-kicker">
        {copy.progress.stepLabel} {current} / {total}
      </p>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={`dot-${index}`}
            className={`h-2.5 flex-1 rounded-full transition ${
              index < current ? "ui-progress-active" : "ui-progress-inactive"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
