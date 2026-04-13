import { OPTION_SETS } from "@/components/onboarding/constants";

function ChoiceGroup({ label, name, value, options, optionLabels, onChange }) {
  return (
    <div className="space-y-3 rounded-[1.6rem] border border-black/5 bg-white/88 p-4 shadow-soft">
      <p className="text-sm font-semibold text-ink">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = value === option;

          return (
            <button
              key={`${name}-${option}`}
              type="button"
              onClick={() => onChange(name, option)}
              className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[#1f1811] text-white"
                  : "border border-black/10 bg-[#faf6f0] text-black/68 hover:border-black/20"
              }`}
            >
              {optionLabels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MultiChoiceGroup({ label, values = [], options, optionLabels, onToggle, helper }) {
  return (
    <div className="space-y-3 rounded-[1.6rem] border border-black/5 bg-white/88 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {helper ? <p className="text-xs font-medium text-[#7d5724]">{helper}</p> : null}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = values.includes(option);

          return (
            <button
              key={`multi-${option}`}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[#1f1811] text-white"
                  : "border border-black/10 bg-[#faf6f0] text-black/68 hover:border-black/20"
              }`}
            >
              {optionLabels[option]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BasicSurveyStep({ copy, form, onFieldChange, onMainConcernToggle, error }) {
  const labels = copy.optionLabels;

  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.basic.eyebrow}
        </p>
        <h2 className="text-[2rem] font-semibold tracking-tight text-ink">
          {copy.basic.title}
        </h2>
        <p className="text-sm leading-6 text-black/58">
          {copy.basic.description}
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <ChoiceGroup
          label={copy.basic.skinType}
          name="skinType"
          value={form.skinType}
          options={OPTION_SETS.skinType}
          optionLabels={labels.skinType}
          onChange={onFieldChange}
        />
        <ChoiceGroup
          label={copy.basic.sensitivity}
          name="sensitivity"
          value={form.sensitivity}
          options={OPTION_SETS.sensitivity}
          optionLabels={labels.sensitivity}
          onChange={onFieldChange}
        />
        <MultiChoiceGroup
          label={copy.basic.mainConcern}
          values={Array.isArray(form.mainConcerns) ? form.mainConcerns : []}
          options={OPTION_SETS.mainConcern}
          optionLabels={labels.mainConcern}
          onToggle={onMainConcernToggle}
          helper={copy.basic.multiSelectHint}
        />
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-[#9c4c2c]">{error}</p> : null}
    </section>
  );
}
