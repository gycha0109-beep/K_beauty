"use client";

import { useState } from "react";

const MESSAGES = {
  ko: {
    sections: {
      basic: "Step 1 of 2",
      optional: "Step 2 of 2 (선택 입력)"
    },
    helper: {
      basic: "기본 피부 상태를 알려주세요",
      optional: "더 정확한 추천을 위해 알려주세요",
      environmentToggle: "피부가 예민해질 수 있는 특수 환경이 있다면 추가하기",
      environmentDescription:
        "특정 환경은 피부 균형에 영향을 줄 수 있습니다. 해당되는 항목이 있다면 선택하세요."
    },
    placeholders: {
      skinType: "피부 타입 선택",
      sensitivity: "민감도 선택",
      mainConcern: "주요 고민 선택",
      cleansingFrequency: "세안 빈도 선택",
      preferredTexture: "선호 사용감 선택",
      postWashFeeling: "세안 직후 느낌 선택",
      afternoonSkinChange: "오후 피부 변화 선택",
      mostDislikedFeel: "가장 싫은 사용감 선택"
    },
    labels: {
      skinType: "피부 타입",
      sensitivity: "민감도",
      mainConcern: "주요 고민",
      cleansingFrequency: "세안 빈도",
      preferredTexture: "선호 사용감",
      postWashFeeling: "세안 직후 느낌",
      afternoonSkinChange: "오후 피부 변화",
      mostDislikedFeel: "가장 싫은 사용감",
      environmentExposure: "피부가 상할 수 있는 특수 환경"
    },
    skinTypes: [
      { value: "oily", label: "지성" },
      { value: "dry", label: "건성" },
      { value: "combination", label: "복합성" },
      { value: "not_sure", label: "잘 모르겠음" }
    ],
    sensitivities: [
      { value: "low", label: "낮음" },
      { value: "medium", label: "보통" },
      { value: "high", label: "높음" }
    ],
    concerns: [
      { value: "oiliness", label: "유분" },
      { value: "dehydration", label: "건조" },
      { value: "acne", label: "트러블" },
      { value: "uneven_tone", label: "톤 불균일" },
      { value: "pores", label: "모공" },
      { value: "redness", label: "붉은기" },
      { value: "barrier", label: "장벽 약화" }
    ],
    cleansingFrequencies: [
      { value: "once", label: "1회" },
      { value: "twice", label: "2회" },
      { value: "3_plus", label: "3회 이상" }
    ],
    textures: [
      { value: "gel", label: "젤" },
      { value: "watery", label: "워터리" },
      { value: "lotion", label: "로션" },
      { value: "cream", label: "크림" }
    ],
    postWashFeelings: [
      { value: "tight", label: "당김" },
      { value: "comfortable", label: "편안함" },
      { value: "still_oily", label: "세안 직후에도 번들거림" }
    ],
    afternoonSkinChanges: [
      { value: "more_oily", label: "더 번들거림" },
      { value: "more_dry", label: "더 건조해짐" },
      { value: "red_or_irritated", label: "붉어지거나 예민해짐" },
      { value: "mostly_same", label: "거의 비슷함" }
    ],
    dislikedFeels: [
      { value: "sticky", label: "끈적임" },
      { value: "greasy", label: "번들거림" },
      { value: "heavy", label: "무거움" },
      { value: "fragranced", label: "향이 강함" },
      { value: "pilling", label: "밀림" }
    ],
    environmentOptions: [
      { value: "heat", label: "더운 환경" },
      { value: "humidity", label: "습한 환경" },
      { value: "mask", label: "마스크" },
      { value: "kitchen", label: "주방 환경" },
      { value: "outdoor", label: "야외 활동" },
      { value: "aircon", label: "에어컨" }
    ]
  },
  en: {
    sections: {
      basic: "Step 1 of 2",
      optional: "Step 2 of 2 (Optional)"
    },
    helper: {
      basic: "Tell us the basics of your skin first.",
      optional: "Add these for a more precise recommendation.",
      environmentToggle: "Add special environments that may affect your skin",
      environmentDescription:
        "Some environments can shift your skin balance. Select any that apply."
    },
    placeholders: {
      skinType: "Select skin type",
      sensitivity: "Select sensitivity",
      mainConcern: "Select top concern",
      cleansingFrequency: "Select cleansing frequency",
      preferredTexture: "Select preferred texture",
      postWashFeeling: "Select post-wash feel",
      afternoonSkinChange: "Select afternoon change",
      mostDislikedFeel: "Select disliked feel"
    },
    labels: {
      skinType: "Skin type",
      sensitivity: "Sensitivity",
      mainConcern: "Top concern",
      cleansingFrequency: "Cleansing frequency",
      preferredTexture: "Preferred texture",
      postWashFeeling: "Post-wash feel",
      afternoonSkinChange: "Afternoon skin change",
      mostDislikedFeel: "Most disliked feel",
      environmentExposure: "Special environment exposure"
    },
    skinTypes: [
      { value: "oily", label: "Oily" },
      { value: "dry", label: "Dry" },
      { value: "combination", label: "Combination" },
      { value: "not_sure", label: "Not sure" }
    ],
    sensitivities: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" }
    ],
    concerns: [
      { value: "oiliness", label: "Oiliness" },
      { value: "dehydration", label: "Dehydration" },
      { value: "acne", label: "Breakouts" },
      { value: "uneven_tone", label: "Uneven tone" },
      { value: "pores", label: "Pores" },
      { value: "redness", label: "Redness" },
      { value: "barrier", label: "Barrier" }
    ],
    cleansingFrequencies: [
      { value: "once", label: "Once" },
      { value: "twice", label: "Twice" },
      { value: "3_plus", label: "3+ times" }
    ],
    textures: [
      { value: "gel", label: "Gel" },
      { value: "watery", label: "Watery" },
      { value: "lotion", label: "Lotion" },
      { value: "cream", label: "Cream" }
    ],
    postWashFeelings: [
      { value: "tight", label: "Tight" },
      { value: "comfortable", label: "Comfortable" },
      { value: "still_oily", label: "Still oily after cleansing" }
    ],
    afternoonSkinChanges: [
      { value: "more_oily", label: "More oily" },
      { value: "more_dry", label: "More dry" },
      { value: "red_or_irritated", label: "More red or reactive" },
      { value: "mostly_same", label: "Mostly the same" }
    ],
    dislikedFeels: [
      { value: "sticky", label: "Sticky" },
      { value: "greasy", label: "Greasy" },
      { value: "heavy", label: "Heavy" },
      { value: "fragranced", label: "Strong fragrance" },
      { value: "pilling", label: "Pilling" }
    ],
    environmentOptions: [
      { value: "heat", label: "Heat" },
      { value: "humidity", label: "Humidity" },
      { value: "mask", label: "Mask" },
      { value: "kitchen", label: "Kitchen" },
      { value: "outdoor", label: "Outdoor" },
      { value: "aircon", label: "Air conditioning" }
    ]
  }
};

export default function SurveyForm({ form, onChange, onCheckboxChange, locale = "ko" }) {
  const dict = MESSAGES[locale] || MESSAGES.ko;
  const [showEnvironmentExposure, setShowEnvironmentExposure] = useState(
    Array.isArray(form.environmentExposure) && form.environmentExposure.length > 0
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[1.4rem] border border-black/5 bg-white p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/38">{dict.sections.basic}</p>
          <p className="mt-2 text-sm text-black/58">{dict.helper.basic}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={dict.labels.skinType}
            name="skinType"
            value={form.skinType}
            onChange={onChange}
            options={dict.skinTypes}
            placeholder={dict.placeholders.skinType}
          />
          <SelectField
            label={dict.labels.sensitivity}
            name="sensitivity"
            value={form.sensitivity}
            onChange={onChange}
            options={dict.sensitivities}
            placeholder={dict.placeholders.sensitivity}
          />
          <div className="sm:col-span-2">
            <SelectField
              label={dict.labels.mainConcern}
              name="mainConcern"
              value={form.mainConcern}
              onChange={onChange}
              options={dict.concerns}
              placeholder={dict.placeholders.mainConcern}
            />
          </div>
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-black/5 bg-[#fcfaf6] p-4 sm:p-5">
        <div className="mb-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-black/38">{dict.sections.optional}</p>
          <p className="mt-2 text-sm text-black/58">{dict.helper.optional}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={dict.labels.preferredTexture}
            name="preferredTexture"
            value={form.preferredTexture}
            onChange={onChange}
            options={dict.textures}
            placeholder={dict.placeholders.preferredTexture}
          />
          <SelectField
            label={dict.labels.postWashFeeling}
            name="postWashFeeling"
            value={form.postWashFeeling}
            onChange={onChange}
            options={dict.postWashFeelings}
            placeholder={dict.placeholders.postWashFeeling}
          />
          <SelectField
            label={dict.labels.afternoonSkinChange}
            name="afternoonSkinChange"
            value={form.afternoonSkinChange}
            onChange={onChange}
            options={dict.afternoonSkinChanges}
            placeholder={dict.placeholders.afternoonSkinChange}
          />
          <SelectField
            label={dict.labels.mostDislikedFeel}
            name="mostDislikedFeel"
            value={form.mostDislikedFeel}
            onChange={onChange}
            options={dict.dislikedFeels}
            placeholder={dict.placeholders.mostDislikedFeel}
          />
          <div className="sm:col-span-2">
            <SelectField
              label={dict.labels.cleansingFrequency}
              name="cleansingFrequency"
              value={form.cleansingFrequency}
              onChange={onChange}
              options={dict.cleansingFrequencies}
              placeholder={dict.placeholders.cleansingFrequency}
            />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/70 p-3">
          <button
            type="button"
            onClick={() => setShowEnvironmentExposure((current) => !current)}
            className="flex w-full items-center justify-between text-left"
          >
            <span className="text-sm font-medium text-ink">{dict.helper.environmentToggle}</span>
            <span className="text-lg leading-none text-black/45">
              {showEnvironmentExposure ? "−" : "+"}
            </span>
          </button>

          {showEnvironmentExposure ? (
            <div className="mt-3">
              <p className="text-xs leading-5 text-black/50">{dict.helper.environmentDescription}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {dict.environmentOptions.map((option) => {
                  const checked = form.environmentExposure.includes(option.value);

                  return (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-sm transition ${
                        checked
                          ? "border-black/20 bg-[#f5efe6] text-ink"
                          : "border-black/10 bg-white text-black/65"
                      }`}
                    >
                      <span>{option.label}</span>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={checked}
                        onChange={() => onCheckboxChange(option.value)}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function SelectField({ label, name, value, onChange, options, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-ink" htmlFor={name}>
        {label}
      </label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-black/25"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
