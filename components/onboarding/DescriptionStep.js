export default function DescriptionStep({ copy }) {
  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.intro.badge}
        </p>
        <h2 className="text-[2rem] font-semibold tracking-tight text-ink">
          {copy.description.title}
        </h2>
        <p className="text-sm leading-6 text-black/58">
          {copy.description.description}
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {copy.description.points.map((item, index) => (
          <div
            key={item.title}
            className="rounded-[1.6rem] border border-black/5 bg-white/88 px-4 py-4 shadow-soft"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f4e6d5] text-sm font-semibold text-[#7d5724]">
                {index + 1}
              </span>
              <div>
                <p className="text-base font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-sm leading-6 text-black/62">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
