import { OPTION_SETS } from "@/components/onboarding/constants";

function ChoiceGroup({ label, name, value, options, optionLabels, onChange }) {
  return (
    <div className="ui-card space-y-3 p-4">
      <p className="ui-title text-sm">{label}</p>
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
                  ? "ui-choice-active"
                  : "ui-choice-idle"
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
    <div className="ui-card space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="ui-title text-sm">{label}</p>
        {helper ? <p className="ui-text-faint text-xs font-medium">{helper}</p> : null}
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
                  ? "ui-choice-active"
                  : "ui-choice-idle"
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
  const genderLabel = copy.basic.genderPreference || "성별 (선택)";
  const genderOptionLabels = labels.genderPreference || {
    female: "여성",
    male: "남성",
    unspecified: "선택 안 함"
  };

  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="ui-kicker">
          {copy.basic.eyebrow}
        </p>
        <h2 className="ui-title text-[2rem]">
          {copy.basic.title}
        </h2>
        <p className="ui-text-secondary text-sm leading-6">
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
        <ChoiceGroup
          label={genderLabel}
          name="genderPreference"
          value={form.genderPreference || "unspecified"}
          options={OPTION_SETS.genderPreference}
          optionLabels={genderOptionLabels}
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

      {error ? <p className="ui-text-danger mt-4 text-sm font-medium">{error}</p> : null}
    </section>
  );
}
