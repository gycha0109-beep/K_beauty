const CONTRACT_VERSION = "survey-input-contract-v1";

const VALID_VALUES = {
  skinType: new Set(["oily", "dry", "combination", "not_sure"]),
  sensitivity: new Set(["low", "medium", "high"]),
  concerns: new Set(["oiliness", "dehydration", "acne", "pores", "redness", "barrier", "uneven_tone", "uv"]),
  postWashFeeling: new Set(["tight", "comfortable", "still_oily"]),
  afternoonSkinChange: new Set(["more_oily", "more_dry", "red_or_irritated", "mostly_same"]),
  cleansingFrequency: new Set(["once", "twice", "3_plus"]),
  environmentExposure: new Set(["heat", "humidity", "mask", "kitchen", "outdoor", "aircon"]),
  preferredTexture: new Set(["gel", "watery", "lotion", "cream"]),
  mostDislikedFeel: new Set(["sticky", "greasy", "heavy"]),
  genderPreference: new Set(["female", "male", "unspecified"]),
  sunscreenPreferenceState: new Set(["answered", "skipped", "unknown"])
};

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

  if (["yes", "no", "unknown"].includes(normalized)) {
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
      // Eligibility-only profile signal. Do not use this as a ranking score boost.
      genderPreference
    },
    metadata: {
      contractVersion: CONTRACT_VERSION,
      generatedAt,
      source,
      missingFields: [...new Set(missingFields)],
      warnings
    }
  };
}
