function normalizeTextList(values) {
  return Array.isArray(values) ? values.filter(Boolean).map(String) : [];
}

function normalizeRoutineSteps(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          title: item,
          note: ""
        };
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      return {
        title:
          item.name ||
          item.label ||
          item.product ||
          item.step ||
          `Step ${index + 1}`,
        note: item.note || item.reason || item.instruction || item.description || ""
      };
    })
    .filter(Boolean);
}

function TextList({ title, values, tone = "neutral" }) {
  const items = normalizeTextList(values);
  const toneClassName = {
    keep: "border-[#d9c4a8] bg-[#fff8ef] dark:border-[#6a4a25] dark:bg-[#332314]",
    reduce: "border-[#ead2ca] bg-white/70 dark:border-[#4a303c] dark:bg-[#2f202a]",
    avoid: "border-[#e0b9b0] bg-[#fff3ee] dark:border-[#6a4050] dark:bg-[#351f28]",
    neutral: "border-[#ead2ca] bg-white/70 dark:border-[#4a303c] dark:bg-[#2f202a]"
  }[tone];

  return (
    <div className={`rounded-[1rem] border p-4 ${toneClassName}`}>
      <p className="ui-text-primary text-sm font-semibold">{title}</p>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm leading-6 ui-text-secondary">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="ui-text-faint mt-3 text-sm">아직 항목이 없습니다.</p>
      )}
    </div>
  );
}

function RoutineList({ title, values }) {
  const steps = normalizeRoutineSteps(values);

  return (
    <div className="border-t border-[#ead2ca] pt-4 dark:border-[#4a303c]">
      <p className="ui-text-primary text-sm font-semibold">{title}</p>
      {steps.length ? (
        <ol className="mt-3 space-y-3">
          {steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2 text-sm leading-6">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#5a2d3c] text-xs font-semibold text-white dark:bg-[#ef6387]">
                {index + 1}
              </span>
              <span>
                <span className="font-semibold text-[#4a2834] dark:text-[#f3e4df]">
                  {step.title}
                </span>
                {step.note ? (
                  <span className="ui-text-secondary mt-1 block">{step.note}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ui-text-faint mt-3 text-sm">아직 루틴이 없습니다.</p>
      )}
    </div>
  );
}

export default function TodayRoutineCard({ routine }) {
  return (
    <section className="ui-card p-5 sm:p-6">
      <p className="ui-kicker">Today Routine</p>
      <h2 className="ui-title mt-2 text-2xl sm:text-3xl">오늘 루틴</h2>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <TextList title="유지할 것" values={routine.keep_items} tone="keep" />
        <TextList title="줄일 것" values={routine.reduce_items} tone="reduce" />
        <TextList title="피할 것" values={routine.avoid_items} tone="avoid" />
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <RoutineList title="AM 루틴" values={routine.am_routine} />
        <RoutineList title="PM 루틴" values={routine.pm_routine} />
      </div>
    </section>
  );
}
