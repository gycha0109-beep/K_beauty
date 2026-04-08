export default function ResultSection({ title, subtitle, children }) {
  return (
    <section className="rounded-3xl border border-black/5 bg-white/85 p-6 shadow-soft backdrop-blur">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {subtitle ? <p className="text-sm leading-6 text-black/55">{subtitle}</p> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
