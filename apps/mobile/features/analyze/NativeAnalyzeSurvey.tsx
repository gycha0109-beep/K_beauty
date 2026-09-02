import type { SupportedLocale } from "@bejewely/shared";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SurveyFormInput } from "../../lib/survey-contract";

type Palette = Readonly<{
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  accent: string;
  border: string;
}>;

type SurveyField = Readonly<{
  key: string;
  label: Record<SupportedLocale, string>;
  options: readonly Readonly<{
    value: string;
    label: Record<SupportedLocale, string>;
  }>[];
}>;

const FIELDS: readonly SurveyField[] = [
  {
    key: "skinType",
    label: { en: "Skin type", ko: "피부 타입" },
    options: [
      { value: "oily", label: { en: "Oily", ko: "지성" } },
      { value: "dry", label: { en: "Dry", ko: "건성" } },
      { value: "combination", label: { en: "Combination", ko: "복합성" } },
      { value: "not_sure", label: { en: "Not sure", ko: "잘 모르겠음" } }
    ]
  },
  {
    key: "sensitivity",
    label: { en: "Sensitivity", ko: "민감도" },
    options: [
      { value: "low", label: { en: "Low", ko: "낮음" } },
      { value: "medium", label: { en: "Medium", ko: "보통" } },
      { value: "high", label: { en: "High", ko: "높음" } }
    ]
  },
  {
    key: "mainConcern",
    label: { en: "Main concern", ko: "가장 큰 피부 고민" },
    options: [
      { value: "oiliness", label: { en: "Oiliness", ko: "유분" } },
      { value: "dehydration", label: { en: "Dehydration", ko: "속건조" } },
      { value: "acne", label: { en: "Breakouts", ko: "트러블" } },
      { value: "uneven_tone", label: { en: "Uneven tone", ko: "칙칙함·톤" } },
      { value: "pores", label: { en: "Pores", ko: "모공" } },
      { value: "redness", label: { en: "Redness", ko: "붉음" } },
      { value: "barrier", label: { en: "Barrier", ko: "장벽" } }
    ]
  },
  {
    key: "cleansingFrequency",
    label: { en: "Daily cleansing", ko: "하루 세안 횟수" },
    options: [
      { value: "once", label: { en: "Once", ko: "1회" } },
      { value: "twice", label: { en: "Twice", ko: "2회" } },
      { value: "3_plus", label: { en: "3+ times", ko: "3회 이상" } }
    ]
  },
  {
    key: "preferredTexture",
    label: { en: "Preferred texture", ko: "선호 제형" },
    options: [
      { value: "gel", label: { en: "Gel", ko: "젤" } },
      { value: "watery", label: { en: "Watery", ko: "워터리" } },
      { value: "lotion", label: { en: "Lotion", ko: "로션" } },
      { value: "cream", label: { en: "Cream", ko: "크림" } }
    ]
  },
  {
    key: "postWashFeeling",
    label: { en: "Right after cleansing", ko: "세안 직후 느낌" },
    options: [
      { value: "tight", label: { en: "Tight", ko: "당김" } },
      { value: "comfortable", label: { en: "Comfortable", ko: "편안함" } },
      { value: "still_oily", label: { en: "Still oily", ko: "유분이 남음" } }
    ]
  },
  {
    key: "afternoonSkinChange",
    label: { en: "By afternoon", ko: "오후 피부 변화" },
    options: [
      { value: "more_oily", label: { en: "More oily", ko: "유분 증가" } },
      { value: "more_dry", label: { en: "More dry", ko: "건조 증가" } },
      { value: "red_or_irritated", label: { en: "Red / irritated", ko: "붉거나 자극됨" } },
      { value: "mostly_same", label: { en: "Mostly same", ko: "큰 변화 없음" } }
    ]
  },
  {
    key: "mostDislikedFeel",
    label: { en: "Most disliked finish", ko: "가장 싫은 사용감" },
    options: [
      { value: "sticky", label: { en: "Sticky", ko: "끈적임" } },
      { value: "greasy", label: { en: "Greasy", ko: "번들거림" } },
      { value: "heavy", label: { en: "Heavy", ko: "답답함" } }
    ]
  }
];

export function NativeAnalyzeSurvey({
  form,
  locale,
  palette,
  disabled,
  onChange
}: {
  form: SurveyFormInput;
  locale: SupportedLocale;
  palette: Palette;
  disabled?: boolean;
  onChange: (next: SurveyFormInput) => void;
}) {
  return (
    <View
      testID="native-analyze-survey"
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}
    >
      <Text style={[styles.heading, { color: palette.text }]}> 
        {locale === "ko" ? "분석 전 피부 설문" : "Skin survey before analysis"}
      </Text>
      <Text style={[styles.description, { color: palette.textMuted }]}> 
        {locale === "ko"
          ? "답변은 피부 프로필과 맞춤 제품, 루틴을 더 정확하게 맞추는 데 사용됩니다."
          : "Your answers help match your skin profile, product picks, and routine more accurately."}
      </Text>

      {FIELDS.map((field) => (
        <View key={field.key} style={styles.field}>
          <Text style={[styles.label, { color: palette.text }]}>{field.label[locale]}</Text>
          <View style={styles.options}>
            {field.options.map((option) => {
              const selected = form[field.key] === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: Boolean(disabled) }}
                  disabled={disabled}
                  onPress={() => onChange({ ...form, [field.key]: option.value })}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? palette.surfaceMuted : palette.surface,
                      borderColor: selected ? palette.accent : palette.border,
                      opacity: disabled ? 0.5 : pressed ? 0.72 : 1
                    }
                  ]}
                >
                  <Text style={[styles.optionText, { color: selected ? palette.accent : palette.text }]}>
                    {option.label[locale]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 16
  },
  heading: {
    fontSize: 20,
    fontWeight: "800"
  },
  description: {
    fontSize: 14,
    lineHeight: 21
  },
  field: {
    gap: 9
  },
  label: {
    fontSize: 15,
    fontWeight: "700"
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  option: {
    minHeight: 40,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8
  },
  optionText: {
    fontSize: 14,
    fontWeight: "700"
  }
});
