export default function IntroStep({ copy }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="w-full max-w-sm space-y-5">
        <div className="inline-flex rounded-full border border-black/10 bg-white/85 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-black/55">
          {copy.intro.badge}
        </div>
        <h1 className="text-[2.25rem] font-semibold tracking-tight text-ink sm:text-[2.8rem]">
          {copy.intro.title}
        </h1>
        <p className="text-[15px] leading-7 text-black/62">
          {copy.intro.description}
        </p>
      </div>
    </section>
  );
}
