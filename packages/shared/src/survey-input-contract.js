export const SURVEY_INPUT_CONTRACT_VERSION = "survey-input-contract-v1";

export const SURVEY_VALUE_SETS = Object.freeze({
  skinType: ["oily", "dry", "combination", "not_sure"],
  sensitivity: ["low", "medium", "high"],
  concerns: ["oiliness", "dehydration", "acne", "pores", "redness", "barrier", "uneven_tone", "uv"],
  postWashFeeling: ["tight", "comfortable", "still_oily"],
  afternoonSkinChange: ["more_oily", "more_dry", "red_or_irritated", "mostly_same"],
  cleansingFrequency: ["once", "twice", "3_plus"],
  environmentExposure: ["heat", "humidity", "mask", "kitchen", "outdoor", "aircon"],
  preferredTexture: ["gel", "watery", "lotion", "cream"],
  mostDislikedFeel: ["sticky", "greasy", "heavy"],
  genderPreference: ["female", "male", "unspecified"],
  sunscreenPreferenceState: ["answered", "skipped", "unknown"],
  unknownFlag: ["yes", "no", "unknown"]
});

export const SURVEY_OPTION_SETS = Object.freeze({
  skinType: ["oily", "dry", "combination", "not_sure"],
  sensitivity: ["low", "medium", "high"],
  mainConcern: ["oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"],
  primaryConcern: ["oiliness", "dehydration", "acne", "uneven_tone", "pores", "redness", "barrier"],
  recentSkinChange: ["yes", "no", "unknown"],
  recentlyChangedProduct: ["yes", "no", "unknown"],
  preferredTexture: ["gel", "watery", "lotion", "cream"],
  postWashFeeling: ["tight", "comfortable", "still_oily"],
  afternoonSkinChange: ["more_oily", "more_dry", "red_or_irritated", "mostly_same"],
  mostDislikedFeel: ["sticky", "greasy", "heavy"],
  booleanChoice: ["true", "false"],
  sunscreenConsiderations: ["whiteCastHate", "toneUpWanted", "makeupUse", "eyeSensitive"],
  sunscreenPreferenceState: ["answered", "skipped", "unknown"],
  cleansingFrequency: ["once", "twice", "3_plus"],
  environmentExposure: ["heat", "humidity", "mask", "kitchen", "outdoor", "aircon"],
  genderPreference: ["female", "male", "unspecified"]
});

export const SURVEY_INITIAL_FORM = Object.freeze({
  skinType: "",
  sensitivity: "",
  mainConcern: "",
  mainConcerns: [],
  primaryConcern: "",
  recentSkinChange: "unknown",
  recentlyChangedProduct: "unknown",
  cleansingFrequency: "",
  preferredTexture: "",
  postWashFeeling: "",
  afternoonSkinChange: "",
  environmentExposure: [],
  mostDislikedFeel: "",
  genderPreference: "unspecified",
  whiteCastHate: false,
  toneUpWanted: false,
  makeupUse: false,
  eyeSensitive: false,
  sunscreenPreferenceState: "unknown"
});

export const SURVEY_OPTIONAL_DEFAULTS = Object.freeze({
  cleansingFrequency: "twice",
  preferredTexture: "lotion",
  postWashFeeling: "comfortable",
  afternoonSkinChange: "mostly_same",
  environmentExposure: [],
  mostDislikedFeel: "sticky",
  genderPreference: "unspecified"
});

export const SURVEY_FIELD_SCHEMA = Object.freeze({
  skinType: { kind: "enum", values: SURVEY_VALUE_SETS.skinType },
  sensitivity: { kind: "enum", values: SURVEY_VALUE_SETS.sensitivity },
  mainConcern: { kind: "enum", values: SURVEY_VALUE_SETS.concerns },
  mainConcerns: { kind: "enum_array", values: SURVEY_VALUE_SETS.concerns },
  primaryConcern: { kind: "enum", values: SURVEY_VALUE_SETS.concerns },
  recentSkinChange: { kind: "enum", values: SURVEY_VALUE_SETS.unknownFlag },
  recentlyChangedProduct: { kind: "enum", values: SURVEY_VALUE_SETS.unknownFlag },
  cleansingFrequency: { kind: "enum", values: SURVEY_VALUE_SETS.cleansingFrequency },
  preferredTexture: { kind: "enum", values: SURVEY_VALUE_SETS.preferredTexture },
  postWashFeeling: { kind: "enum", values: SURVEY_VALUE_SETS.postWashFeeling },
  afternoonSkinChange: { kind: "enum", values: SURVEY_VALUE_SETS.afternoonSkinChange },
  environmentExposure: { kind: "enum_array", values: SURVEY_VALUE_SETS.environmentExposure },
  mostDislikedFeel: { kind: "enum", values: SURVEY_VALUE_SETS.mostDislikedFeel },
  genderPreference: { kind: "enum", values: SURVEY_VALUE_SETS.genderPreference },
  whiteCastHate: { kind: "boolean" },
  toneUpWanted: { kind: "boolean" },
  makeupUse: { kind: "boolean" },
  eyeSensitive: { kind: "boolean" },
  sunscreenPreferenceState: { kind: "enum", values: SURVEY_VALUE_SETS.sunscreenPreferenceState }
});

const VALID_VALUES = {
  skinType: new Set(SURVEY_VALUE_SETS.skinType),
  sensitivity: new Set(SURVEY_VALUE_SETS.sensitivity),
  concerns: new Set(SURVEY_VALUE_SETS.concerns),
  postWashFeeling: new Set(SURVEY_VALUE_SETS.postWashFeeling),
  afternoonSkinChange: new Set(SURVEY_VALUE_SETS.afternoonSkinChange),
  cleansingFrequency: new Set(SURVEY_VALUE_SETS.cleansingFrequency),
  environmentExposure: new Set(SURVEY_VALUE_SETS.environmentExposure),
  preferredTexture: new Set(SURVEY_VALUE_SETS.preferredTexture),
  mostDislikedFeel: new Set(SURVEY_VALUE_SETS.mostDislikedFeel),
  genderPreference: new Set(SURVEY_VALUE_SETS.genderPreference),
  sunscreenPreferenceState: new Set(SURVEY_VALUE_SETS.sunscreenPreferenceState)
};

const UNKNOWN_FLAG_VALUES = new Set(SURVEY_VALUE_SETS.unknownFlag);
const GENDER_PREFERENCE_VALUES = new Set(SURVEY_VALUE_SETS.genderPreference);
const SUNSCREEN_PREFERENCE_STATE_VALUES = new Set(SURVEY_VALUE_SETS.sunscreenPreferenceState);

function pushUnique(list, value) {
  if (value && !list.includes(value)) {
    list.push(value);
  }
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function parseArrayLike(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [trimmed];
    }
  }

  return [trimmed];
}

function normalizeEnum(value, allowed, fieldName, warnings, missingFields, { nullable = false } = {}) {
  const normalized = normalizeString(value);

  if (!normalized) {
    missingFields.push(fieldName);
    return nullable ? null : "unknown";
  }

  if (!allowed.has(normalized)) {
    pushUnique(warnings, `${fieldName}_invalid_excluded`);
    missingFields.push(fieldName);
    return nullable ? null : "unknown";
  }

  return normalized;
}

function normalizeEnumArray(value, allowed, fieldName, warnings) {
  const output = [];
  const invalid = [];

  parseArrayLike(value).forEach((item) => {
    const normalized = normalizeString(item);

    if (!normalized) {
      return;
    }

    if (!allowed.has(normalized)) {
      invalid.push(normalized);
      return;
    }

    if (!output.includes(normalized)) {
      output.push(normalized);
    }
  });

  if (invalid.length) {
    pushUnique(warnings, `${fieldName}_invalid_values_excluded`);
  }

  return output;
}

function normalizeOptionalUnknownFlag(value) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return "unknown";
  }

  if (SURVEY_VALUE_SETS.unknownFlag.includes(normalized)) {
    return normalized;
  }

  if (["true", "1"].includes(normalized)) {
    return "yes";
  }

  if (["false", "0"].includes(normalized)) {
    return "no";
  }

  return "unknown";
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return Boolean(value);
}

function normalizeConcerns(form, warnings, missingFields) {
  const mainConcerns = normalizeEnumArray(form?.mainConcerns, VALID_VALUES.concerns, "mainConcerns", warnings);
  const explicitPrimary = normalizeString(form?.primaryConcern);
  const explicitPrimaryAllowed = !mainConcerns.length || mainConcerns.includes(explicitPrimary);
  let primaryConcern = null;
  let concernSource = "missing";
  let unresolvedPrimaryConcern = true;

  if (explicitPrimary) {
    if (VALID_VALUES.concerns.has(explicitPrimary) && explicitPrimaryAllowed) {
      primaryConcern = explicitPrimary;
      concernSource = "explicit";
      unresolvedPrimaryConcern = false;
    } else {
      pushUnique(warnings, "primaryConcern_invalid_excluded");
    }
  }

  if (!primaryConcern && mainConcerns.length) {
    primaryConcern = mainConcerns[0];
    concernSource = "fallback_first_selected";
    unresolvedPrimaryConcern = true;
    pushUnique(warnings, "primaryConcern_missing_fallback_used");
  }

  if (!primaryConcern) {
    missingFields.push("primaryConcern");
    pushUnique(warnings, "primaryConcern_missing");
  }

  const secondaryConcerns = mainConcerns.filter((concern) => concern !== primaryConcern);

  return {
    primaryConcern,
    secondaryConcerns,
    concernSource,
    unresolvedPrimaryConcern
  };
}

function getSensitivityRisk(sensitivity) {
  if (["high", "medium", "low"].includes(sensitivity)) {
    return sensitivity;
  }

  return "unknown";
}

function getDrynessRisk({ postWashFeeling, afternoonSkinChange }) {
  if (postWashFeeling === "unknown" && afternoonSkinChange === "unknown") {
    return "unknown";
  }

  if (postWashFeeling === "tight" || afternoonSkinChange === "more_dry") {
    return "high";
  }

  if (postWashFeeling === "unknown" || afternoonSkinChange === "unknown") {
    return "unknown";
  }

  return "low";
}

function getRednessRisk({ concerns, afternoonSkinChange, sensitivity }) {
  const hasKnownSignal =
    concerns.length > 0 ||
    afternoonSkinChange !== "unknown" ||
    sensitivity !== "unknown";

  if (concerns.includes("redness") || afternoonSkinChange === "red_or_irritated") {
    return "high";
  }

  if (sensitivity === "high" && (concerns.includes("barrier") || afternoonSkinChange === "unknown")) {
    return "high";
  }

  return hasKnownSignal ? "low" : "unknown";
}

function normalizeSunscreen(form, warnings) {
  const sunscreenKeys = ["whiteCastHate", "toneUpWanted", "makeupUse", "eyeSensitive"];
  const sunscreenPreferenceState = normalizeEnum(
    form?.sunscreenPreferenceState,
    VALID_VALUES.sunscreenPreferenceState,
    "sunscreenPreferenceState",
    warnings,
    [],
    { nullable: true }
  ) || "unknown";
  const sourceCompleteness = sunscreenPreferenceState === "answered"
    ? "answered"
    : sunscreenPreferenceState === "skipped"
      ? "skipped"
      : "ambiguous_boolean_defaults";
  const sunscreen = {
    whiteCastHate: normalizeBoolean(form?.whiteCastHate),
    toneUpWanted: normalizeBoolean(form?.toneUpWanted),
    makeupUse: normalizeBoolean(form?.makeupUse),
    eyeSensitive: normalizeBoolean(form?.eyeSensitive),
    sourceCompleteness
  };

  if (sunscreenPreferenceState === "skipped") {
    pushUnique(warnings, "sunscreen_preference_skipped");
  }

  if (sunscreenPreferenceState === "unknown" && sunscreenKeys.some((key) => sunscreen[key] === false)) {
    pushUnique(warnings, "sunscreen_boolean_false_ambiguous");
  }

  return sunscreen;
}

export function normalizeSurveyAnswers(form = {}) {
  const mainConcerns = Array.isArray(form.mainConcerns)
    ? form.mainConcerns.filter(Boolean)
    : form.mainConcern
      ? [form.mainConcern]
      : [];

  return {
    ...form,
    mainConcern: form.mainConcern || mainConcerns[0] || "",
    mainConcerns,
    primaryConcern: mainConcerns.includes(form.primaryConcern) ? form.primaryConcern : "",
    recentSkinChange: UNKNOWN_FLAG_VALUES.has(form.recentSkinChange) ? form.recentSkinChange : "unknown",
    recentlyChangedProduct: UNKNOWN_FLAG_VALUES.has(form.recentlyChangedProduct)
      ? form.recentlyChangedProduct
      : "unknown",
    cleansingFrequency: form.cleansingFrequency || SURVEY_OPTIONAL_DEFAULTS.cleansingFrequency,
    preferredTexture: form.preferredTexture || SURVEY_OPTIONAL_DEFAULTS.preferredTexture,
    postWashFeeling: form.postWashFeeling || SURVEY_OPTIONAL_DEFAULTS.postWashFeeling,
    afternoonSkinChange: form.afternoonSkinChange || SURVEY_OPTIONAL_DEFAULTS.afternoonSkinChange,
    mostDislikedFeel: form.mostDislikedFeel || SURVEY_OPTIONAL_DEFAULTS.mostDislikedFeel,
    genderPreference: GENDER_PREFERENCE_VALUES.has(form.genderPreference)
      ? form.genderPreference
      : SURVEY_OPTIONAL_DEFAULTS.genderPreference,
    whiteCastHate: Boolean(form.whiteCastHate),
    toneUpWanted: Boolean(form.toneUpWanted),
    makeupUse: Boolean(form.makeupUse),
    eyeSensitive: Boolean(form.eyeSensitive),
    sunscreenPreferenceState: SUNSCREEN_PREFERENCE_STATE_VALUES.has(form.sunscreenPreferenceState)
      ? form.sunscreenPreferenceState
      : "unknown",
    environmentExposure: Array.isArray(form.environmentExposure)
      ? form.environmentExposure
      : SURVEY_OPTIONAL_DEFAULTS.environmentExposure
  };
}

export function buildSurveyInputContract(form = {}, options = {}) {
  const warnings = [];
  const missingFields = [];
  const source = normalizeString(options.source) || "survey_form";
  const generatedAt = options.generatedAt || new Date().toISOString();

  const skinType = normalizeEnum(form?.skinType, VALID_VALUES.skinType, "skinType", warnings, missingFields);
  const sensitivity = normalizeEnum(form?.sensitivity, VALID_VALUES.sensitivity, "sensitivity", warnings, missingFields);
  const postWashFeeling = normalizeEnum(
    form?.postWashFeeling,
    VALID_VALUES.postWashFeeling,
    "postWashFeeling",
    warnings,
    missingFields
  );
  const afternoonSkinChange = normalizeEnum(
    form?.afternoonSkinChange,
    VALID_VALUES.afternoonSkinChange,
    "afternoonSkinChange",
    warnings,
    missingFields
  );
  const goals = normalizeConcerns(form, warnings, missingFields);
  const environmentExposure = normalizeEnumArray(
    form?.environmentExposure,
    VALID_VALUES.environmentExposure,
    "environmentExposure",
    warnings
  );
  const cleansingFrequency = normalizeEnum(
    form?.cleansingFrequency,
    VALID_VALUES.cleansingFrequency,
    "cleansingFrequency",
    warnings,
    missingFields
  );
  const preferredTexture = normalizeEnum(
    form?.preferredTexture,
    VALID_VALUES.preferredTexture,
    "preferredTexture",
    warnings,
    missingFields
  );
  const mostDislikedFeel = normalizeEnum(
    form?.mostDislikedFeel,
    VALID_VALUES.mostDislikedFeel,
    "mostDislikedFeel",
    warnings,
    missingFields
  );
  const genderPreference = normalizeEnum(
    form?.genderPreference,
    VALID_VALUES.genderPreference,
    "genderPreference",
    warnings,
    missingFields
  );
  const recentSkinChange = normalizeOptionalUnknownFlag(form?.recentSkinChange);
  const recentlyChangedProduct = normalizeOptionalUnknownFlag(form?.recentlyChangedProduct);
  const allConcerns = [
    ...(goals.primaryConcern ? [goals.primaryConcern] : []),
    ...goals.secondaryConcerns
  ];

  if (!normalizeString(form?.recentSkinChange)) {
    missingFields.push("recentSkinChange");
  }

  if (!normalizeString(form?.recentlyChangedProduct)) {
    missingFields.push("recentlyChangedProduct");
  }

  return {
    skinState: {
      skinType,
      sensitivity,
      postWashFeeling,
      afternoonSkinChange
    },
    goals,
    safety: {
      recentSkinChange,
      recentlyChangedProduct,
      sensitivityRisk: getSensitivityRisk(sensitivity),
      drynessRisk: getDrynessRisk({ postWashFeeling, afternoonSkinChange }),
      rednessRisk: getRednessRisk({
        concerns: allConcerns,
        afternoonSkinChange,
        sensitivity
      })
    },
    behavior: {
      cleansingFrequency,
      environmentExposure
    },
    preferences: {
      preferredTexture,
      mostDislikedFeel
    },
    sunscreen: normalizeSunscreen(form, warnings),
    profile: {
      genderPreference
    },
    metadata: {
      contractVersion: SURVEY_INPUT_CONTRACT_VERSION,
      generatedAt,
      source,
      missingFields: [...new Set(missingFields)],
      warnings
    }
  };
}
