export default function DescriptionStep({ copy }) {
  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="ui-kicker">
          {copy.intro.badge}
        </p>
        <h2 className="ui-title text-[2rem]">
          {copy.description.title}
        </h2>
        <p className="ui-text-secondary text-sm leading-6">
          {copy.description.description}
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {copy.description.points.map((item, index) => (
          <div
            key={item.title}
            className="ui-card px-4 py-4"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {index + 1}
              </span>
              <div>
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.title}</p>
                <p className="ui-text-secondary mt-1 text-sm leading-6">{item.body}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
