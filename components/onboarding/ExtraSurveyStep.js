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
  const sunscreenLabel = copy.extra.sunscreenConsiderations || (
    isEnglish ? "What do you consider when choosing sunscreen?" : "선크림을 고를 때 고려하는 사항"
  );
  const sunscreenOptionLabels = labels.sunscreenConsiderations || {
    whiteCastHate: isEnglish ? "No white cast" : "백탁 없음",
    toneUpWanted: isEnglish ? "Tone-up effect" : "톤업 가능",
    makeupUse: isEnglish ? "Works with makeup" : "메이크업과 함께 사용",
    eyeSensitive: isEnglish ? "Low eye sting" : "눈 시림 적음"
  };
  const sunscreenValues = OPTION_SETS.sunscreenConsiderations.filter((option) => Boolean(form[option]));
  const multiSelectHint = copy.extra.multiSelectHint || copy.basic.multiSelectHint || (
    isEnglish ? "Multiple selection allowed" : "복수 선택 가능"
  );

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
        <MultiChoiceGroup
          label={sunscreenLabel}
          values={sunscreenValues}
          options={OPTION_SETS.sunscreenConsiderations}
          optionLabels={sunscreenOptionLabels}
          onToggle={(fieldName) => onFieldChange(fieldName, !Boolean(form[fieldName]))}
          helper={multiSelectHint}
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
