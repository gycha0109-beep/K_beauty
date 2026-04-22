import { useState } from "react";
import { OPTION_SETS } from "@/components/onboarding/constants";

function CompactChoiceGroup({ label, name, value, options, optionLabels, onChange }) {
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
                active ? "ui-choice-active" : "ui-choice-idle"
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

function BooleanChoiceGroup({ label, name, value, optionLabels, onChange }) {
  return (
    <CompactChoiceGroup
      label={label}
      name={name}
      value={String(Boolean(value))}
      options={OPTION_SETS.booleanChoice}
      optionLabels={optionLabels}
      onChange={(fieldName, nextValue) => onChange(fieldName, nextValue === "true")}
    />
  );
}

export default function ExtraSurveyStep({
  copy,
  form,
  onFieldChange,
  onEnvironmentToggle,
  error
}) {
  const [showEnvironment, setShowEnvironment] = useState(
    Array.isArray(form.environmentExposure) && form.environmentExposure.length > 0
  );
  const labels = copy.optionLabels;
  const isEnglish = copy.extra.environmentExposure === "Environment exposure";
  const extraLabels = {
    whiteCastHate: copy.extra.whiteCastHate || (isEnglish ? "Do you dislike white cast?" : "백탁이 싫나요?"),
    toneUpWanted: copy.extra.toneUpWanted || (isEnglish ? "Do you want tone-up?" : "톤업이 필요하나요?"),
    makeupUse: copy.extra.makeupUse || (isEnglish ? "Do you wear it with makeup?" : "메이크업과 같이 쓰나요?"),
    eyeSensitive: copy.extra.eyeSensitive || (isEnglish ? "Are your eyes sensitive to sting?" : "눈시림에 민감한가요?")
  };
  const booleanOptionLabels = labels.booleanChoice || {
    true: isEnglish ? "Yes" : "예",
    false: isEnglish ? "No" : "아니오"
  };

  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="ui-kicker">{copy.extra.eyebrow}</p>
        <h2 className="ui-title text-[2rem]">{copy.extra.title}</h2>
        <p className="ui-text-secondary text-sm leading-6">{copy.extra.description}</p>
      </div>

      <div className="mt-8 space-y-3">
        <CompactChoiceGroup
          label={copy.extra.preferredTexture}
          name="preferredTexture"
          value={form.preferredTexture}
          options={OPTION_SETS.preferredTexture}
          optionLabels={labels.preferredTexture}
          onChange={onFieldChange}
        />
        <CompactChoiceGroup
          label={copy.extra.postWashFeeling}
          name="postWashFeeling"
          value={form.postWashFeeling}
          options={OPTION_SETS.postWashFeeling}
          optionLabels={labels.postWashFeeling}
          onChange={onFieldChange}
        />
        <CompactChoiceGroup
          label={copy.extra.afternoonSkinChange}
          name="afternoonSkinChange"
          value={form.afternoonSkinChange}
          options={OPTION_SETS.afternoonSkinChange}
          optionLabels={labels.afternoonSkinChange}
          onChange={onFieldChange}
        />
        <CompactChoiceGroup
          label={copy.extra.mostDislikedFeel}
          name="mostDislikedFeel"
          value={form.mostDislikedFeel}
          options={OPTION_SETS.mostDislikedFeel}
          optionLabels={labels.mostDislikedFeel}
          onChange={onFieldChange}
        />
        <CompactChoiceGroup
          label={copy.extra.cleansingFrequency}
          name="cleansingFrequency"
          value={form.cleansingFrequency}
          options={OPTION_SETS.cleansingFrequency}
          optionLabels={labels.cleansingFrequency}
          onChange={onFieldChange}
        />
        <BooleanChoiceGroup
          label={extraLabels.whiteCastHate}
          name="whiteCastHate"
          value={form.whiteCastHate}
          optionLabels={booleanOptionLabels}
          onChange={onFieldChange}
        />
        <BooleanChoiceGroup
          label={extraLabels.toneUpWanted}
          name="toneUpWanted"
          value={form.toneUpWanted}
          optionLabels={booleanOptionLabels}
          onChange={onFieldChange}
        />
        <BooleanChoiceGroup
          label={extraLabels.makeupUse}
          name="makeupUse"
          value={form.makeupUse}
          optionLabels={booleanOptionLabels}
          onChange={onFieldChange}
        />
        <BooleanChoiceGroup
          label={extraLabels.eyeSensitive}
          name="eyeSensitive"
          value={form.eyeSensitive}
          optionLabels={booleanOptionLabels}
          onChange={onFieldChange}
        />

        <div className="ui-card-dashed p-4">
          <button
            type="button"
            onClick={() => setShowEnvironment((current) => !current)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="ui-title text-sm">{copy.extra.environmentToggle}</span>
            <span className="ui-text-faint text-lg leading-none">{showEnvironment ? "-" : "+"}</span>
          </button>

          {showEnvironment ? (
            <div className="mt-4">
              <p className="ui-text-secondary text-xs leading-5">{copy.extra.environmentDescription}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {OPTION_SETS.environmentExposure.map((option) => {
                  const checked = form.environmentExposure.includes(option);

                  return (
                    <button
                      key={`env-${option}`}
                      type="button"
                      onClick={() => onEnvironmentToggle(option)}
                      className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                        checked ? "ui-choice-active" : "ui-choice-idle"
                      }`}
                    >
                      {labels.environmentExposure[option]}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {error ? <p className="ui-text-danger mt-4 text-sm font-medium">{error}</p> : null}
    </section>
  );
}
