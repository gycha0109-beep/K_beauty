import { useState } from "react";
import { OPTION_SETS } from "@/components/onboarding/constants";

function CompactChoiceGroup({ label, name, value, options, optionLabels, onChange }) {
  return (
    <div className="space-y-3 rounded-[1.45rem] border border-black/5 bg-white/85 p-4">
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
                  : "border border-black/10 bg-[#faf6f0] text-black/65 hover:border-black/20"
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

  return (
    <section className="flex flex-1 flex-col pt-6">
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40">
          {copy.extra.eyebrow}
        </p>
        <h2 className="text-[2rem] font-semibold tracking-tight text-ink">
          {copy.extra.title}
        </h2>
        <p className="text-sm leading-6 text-black/58">
          {copy.extra.description}
        </p>
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

        <div className="rounded-[1.45rem] border border-dashed border-black/10 bg-white/80 p-4">
          <button
            type="button"
            onClick={() => setShowEnvironment((current) => !current)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-semibold text-ink">{copy.extra.environmentToggle}</span>
            <span className="text-lg leading-none text-black/45">{showEnvironment ? "−" : "+"}</span>
          </button>

          {showEnvironment ? (
            <div className="mt-4">
              <p className="text-xs leading-5 text-black/50">{copy.extra.environmentDescription}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {OPTION_SETS.environmentExposure.map((option) => {
                  const checked = form.environmentExposure.includes(option);

                  return (
                    <button
                      key={`env-${option}`}
                      type="button"
                      onClick={() => onEnvironmentToggle(option)}
                      className={`rounded-2xl px-3 py-3 text-sm font-medium transition ${
                        checked
                          ? "border border-[#1f1811] bg-[#f5efe6] text-ink"
                          : "border border-black/10 bg-[#faf6f0] text-black/65 hover:border-black/20"
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

      {error ? <p className="mt-4 text-sm font-medium text-[#9c4c2c]">{error}</p> : null}
    </section>
  );
}
