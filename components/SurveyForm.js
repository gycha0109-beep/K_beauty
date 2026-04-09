const skinTypes = [
  { value: "oily", label: "지성" },
  { value: "dry", label: "건성" },
  { value: "combination", label: "복합성" },
  { value: "not_sure", label: "잘 모르겠음" }
];

const sensitivities = [
  { value: "low", label: "낮음" },
  { value: "medium", label: "보통" },
  { value: "high", label: "높음" }
];

const concerns = [
  { value: "oiliness", label: "유분" },
  { value: "dehydration", label: "건조" },
  { value: "acne", label: "트러블" },
  { value: "uneven_tone", label: "톤 불균일" },
  { value: "pores", label: "모공" },
  { value: "redness", label: "붉은기" },
  { value: "barrier", label: "장벽 약화" }
];

const cleansingFrequencies = [
  { value: "once", label: "1회" },
  { value: "twice", label: "2회" },
  { value: "3_plus", label: "3회 이상" }
];

const textures = [
  { value: "gel", label: "젤" },
  { value: "watery", label: "워터리" },
  { value: "lotion", label: "로션" },
  { value: "cream", label: "크림" }
];

const postWashFeelings = [
  { value: "tight", label: "당김" },
  { value: "comfortable", label: "편안함" },
  { value: "still_oily", label: "세안 직후에도 번들거림" }
];

const afternoonSkinChanges = [
  { value: "more_oily", label: "더 번들거림" },
  { value: "more_dry", label: "더 건조해짐" },
  { value: "red_or_irritated", label: "붉어지거나 예민해짐" },
  { value: "mostly_same", label: "거의 비슷함" }
];

const dislikedFeels = [
  { value: "sticky", label: "끈적임" },
  { value: "greasy", label: "번들거림" },
  { value: "heavy", label: "무거움" },
  { value: "fragranced", label: "향이 강함" },
  { value: "pilling", label: "밀림" }
];

const environmentOptions = [
  { value: "heat", label: "더운 환경" },
  { value: "humidity", label: "습한 환경" },
  { value: "mask", label: "마스크" },
  { value: "kitchen", label: "주방 환경" },
  { value: "outdoor", label: "야외 활동" },
  { value: "aircon", label: "에어컨" }
];

export default function SurveyForm({ form, onChange, onCheckboxChange }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="피부 타입" name="skinType" value={form.skinType} onChange={onChange} options={skinTypes} />
        <SelectField label="민감도" name="sensitivity" value={form.sensitivity} onChange={onChange} options={sensitivities} />
        <SelectField label="주요 고민" name="mainConcern" value={form.mainConcern} onChange={onChange} options={concerns} />
        <SelectField label="세안 빈도" name="cleansingFrequency" value={form.cleansingFrequency} onChange={onChange} options={cleansingFrequencies} />
        <SelectField label="선호 제형" name="preferredTexture" value={form.preferredTexture} onChange={onChange} options={textures} />
        <SelectField label="세안 후 느낌" name="postWashFeeling" value={form.postWashFeeling} onChange={onChange} options={postWashFeelings} />
        <SelectField label="오후 피부 변화" name="afternoonSkinChange" value={form.afternoonSkinChange} onChange={onChange} options={afternoonSkinChanges} />
        <SelectField label="가장 싫어하는 사용감" name="mostDislikedFeel" value={form.mostDislikedFeel} onChange={onChange} options={dislikedFeels} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-ink">환경 노출</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {environmentOptions.map((option) => {
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
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }) {
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
        <option value="">선택해 주세요</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
