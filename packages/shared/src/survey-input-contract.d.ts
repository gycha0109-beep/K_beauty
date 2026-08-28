export type SurveySkinType = "oily" | "dry" | "combination" | "not_sure";
export type SurveySensitivity = "low" | "medium" | "high";
export type SurveyConcern =
  | "oiliness"
  | "dehydration"
  | "acne"
  | "pores"
  | "redness"
  | "barrier"
  | "uneven_tone"
  | "uv";
export type SurveyPostWashFeeling = "tight" | "comfortable" | "still_oily";
export type SurveyAfternoonSkinChange = "more_oily" | "more_dry" | "red_or_irritated" | "mostly_same";
export type SurveyCleansingFrequency = "once" | "twice" | "3_plus";
export type SurveyEnvironmentExposure = "heat" | "humidity" | "mask" | "kitchen" | "outdoor" | "aircon";
export type SurveyPreferredTexture = "gel" | "watery" | "lotion" | "cream";
export type SurveyMostDislikedFeel = "sticky" | "greasy" | "heavy";
export type SurveyGenderPreference = "female" | "male" | "unspecified";
export type SurveySunscreenPreferenceState = "answered" | "skipped" | "unknown";
export type SurveyUnknownFlag = "yes" | "no" | "unknown";
export type SurveyRisk = "low" | "medium" | "high" | "unknown";

export interface SurveyFormInput extends Record<string, unknown> {
  skinType?: unknown;
  sensitivity?: unknown;
  mainConcern?: unknown;
  mainConcerns?: unknown;
  primaryConcern?: unknown;
  recentSkinChange?: unknown;
  recentlyChangedProduct?: unknown;
  cleansingFrequency?: unknown;
  preferredTexture?: unknown;
  postWashFeeling?: unknown;
  afternoonSkinChange?: unknown;
  environmentExposure?: unknown;
  mostDislikedFeel?: unknown;
  genderPreference?: unknown;
  whiteCastHate?: unknown;
  toneUpWanted?: unknown;
  makeupUse?: unknown;
  eyeSensitive?: unknown;
  sunscreenPreferenceState?: unknown;
}

export interface NormalizedSurveyAnswers extends Record<string, unknown> {
  mainConcern: unknown;
  mainConcerns: unknown[];
  primaryConcern: unknown;
  recentSkinChange: SurveyUnknownFlag;
  recentlyChangedProduct: SurveyUnknownFlag;
  cleansingFrequency: unknown;
  preferredTexture: unknown;
  postWashFeeling: unknown;
  afternoonSkinChange: unknown;
  mostDislikedFeel: unknown;
  genderPreference: SurveyGenderPreference;
  whiteCastHate: boolean;
  toneUpWanted: boolean;
  makeupUse: boolean;
  eyeSensitive: boolean;
  sunscreenPreferenceState: SurveySunscreenPreferenceState;
  environmentExposure: unknown[];
}

export interface SurveyInputContract {
  skinState: {
    skinType: SurveySkinType | "unknown";
    sensitivity: SurveySensitivity | "unknown";
    postWashFeeling: SurveyPostWashFeeling | "unknown";
    afternoonSkinChange: SurveyAfternoonSkinChange | "unknown";
  };
  goals: {
    primaryConcern: SurveyConcern | null;
    secondaryConcerns: SurveyConcern[];
    concernSource: "explicit" | "fallback_first_selected" | "missing";
    unresolvedPrimaryConcern: boolean;
  };
  safety: {
    recentSkinChange: SurveyUnknownFlag;
    recentlyChangedProduct: SurveyUnknownFlag;
    sensitivityRisk: SurveyRisk;
    drynessRisk: "low" | "high" | "unknown";
    rednessRisk: "low" | "high" | "unknown";
  };
  behavior: {
    cleansingFrequency: SurveyCleansingFrequency | "unknown";
    environmentExposure: SurveyEnvironmentExposure[];
  };
  preferences: {
    preferredTexture: SurveyPreferredTexture | "unknown";
    mostDislikedFeel: SurveyMostDislikedFeel | "unknown";
  };
  sunscreen: {
    whiteCastHate: boolean;
    toneUpWanted: boolean;
    makeupUse: boolean;
    eyeSensitive: boolean;
    sourceCompleteness: "answered" | "skipped" | "ambiguous_boolean_defaults";
  };
  profile: {
    genderPreference: SurveyGenderPreference | "unknown";
  };
  metadata: {
    contractVersion: typeof SURVEY_INPUT_CONTRACT_VERSION;
    generatedAt: string;
    source: string;
    missingFields: string[];
    warnings: string[];
  };
}

export interface SurveyInputContractOptions {
  source?: unknown;
  generatedAt?: string;
}

export const SURVEY_INPUT_CONTRACT_VERSION: "survey-input-contract-v1";

export const SURVEY_VALUE_SETS: Readonly<{
  skinType: readonly SurveySkinType[];
  sensitivity: readonly SurveySensitivity[];
  concerns: readonly SurveyConcern[];
  postWashFeeling: readonly SurveyPostWashFeeling[];
  afternoonSkinChange: readonly SurveyAfternoonSkinChange[];
  cleansingFrequency: readonly SurveyCleansingFrequency[];
  environmentExposure: readonly SurveyEnvironmentExposure[];
  preferredTexture: readonly SurveyPreferredTexture[];
  mostDislikedFeel: readonly SurveyMostDislikedFeel[];
  genderPreference: readonly SurveyGenderPreference[];
  sunscreenPreferenceState: readonly SurveySunscreenPreferenceState[];
  unknownFlag: readonly SurveyUnknownFlag[];
}>;

export const SURVEY_OPTION_SETS: Readonly<Record<string, readonly string[]>>;
export const SURVEY_INITIAL_FORM: Readonly<Record<string, unknown>>;
export const SURVEY_OPTIONAL_DEFAULTS: Readonly<Record<string, unknown>>;
export const SURVEY_FIELD_SCHEMA: Readonly<Record<string, Readonly<{
  kind: "enum" | "enum_array" | "boolean";
  values?: readonly string[];
}>>>;

export function normalizeSurveyAnswers(form?: SurveyFormInput): NormalizedSurveyAnswers;
export function buildSurveyInputContract(
  form?: SurveyFormInput,
  options?: SurveyInputContractOptions
): SurveyInputContract;
