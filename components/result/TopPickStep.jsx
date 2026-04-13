export default function TopPickStep({ copy, card }) {
  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-black/5 bg-white/88 p-6 shadow-soft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.topPickStepKicker}
        </p>
        <h2 className="mt-2 text-[2rem] font-semibold tracking-tight text-ink">
          {copy.topPickStepTitle}
        </h2>
        <p className="mt-2 text-sm leading-6 text-black/62">
          {copy.topPickStepBody}
        </p>
      </div>

      {card}
    </section>
  );
}
