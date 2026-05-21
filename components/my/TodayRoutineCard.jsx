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

function TextList({ title, values }) {
  const items = normalizeTextList(values);

  return (
    <div className="rounded-[1.1rem] border border-[#ead2ca] bg-white/60 p-4 dark:border-[#4a303c] dark:bg-[#301f28]">
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
    <div className="rounded-[1.1rem] border border-[#ead2ca] bg-white/60 p-4 dark:border-[#4a303c] dark:bg-[#301f28]">
      <p className="ui-text-primary text-sm font-semibold">{title}</p>
      {steps.length ? (
        <ol className="mt-3 space-y-3">
          {steps.map((step, index) => (
            <li key={`${step.title}-${index}`} className="text-sm leading-6">
              <span className="font-semibold text-[#4a2834] dark:text-[#f3e4df]">
                {index + 1}. {step.title}
              </span>
              {step.note ? (
                <p className="ui-text-secondary mt-1">{step.note}</p>
              ) : null}
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
      <h2 className="ui-title mt-2 text-xl">오늘 루틴 카드</h2>

      <div className="mt-5 grid gap-3">
        <TextList title="오늘 유지할 것" values={routine.keep_items} />
        <TextList title="오늘 줄일 것" values={routine.reduce_items} />
        <TextList title="오늘 피할 것" values={routine.avoid_items} />
        <RoutineList title="AM 루틴" values={routine.am_routine} />
        <RoutineList title="PM 루틴" values={routine.pm_routine} />
      </div>
    </section>
  );
}
