export default function IntroStep({ copy }) {
  return (
    <section className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="w-full max-w-sm space-y-5">
        <div className="ui-chip px-3 py-1 text-[11px] uppercase tracking-[0.18em]">
          {copy.intro.badge}
        </div>
        <h1 className="ui-title text-[2.25rem] sm:text-[2.8rem]">
          {copy.intro.title}
        </h1>
        <p className="ui-text-secondary text-[15px] leading-7">
          {copy.intro.description}
        </p>
      </div>
    </section>
  );
}
