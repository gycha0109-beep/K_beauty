export const PRODUCT_QUERY_INTENT_SCHEMA_VERSION = "product-query-intent-v1";

export const PRODUCT_QUERY_CATEGORIES = Object.freeze([
  "cleanser",
  "toner_essence",
  "toner_pad",
  "treatment",
  "moisturizer_lotion_emulsion",
  "moisturizer_gel",
  "moisturizer_cream",
  "moisturizer_balm",
  "sunscreen"
]);

export const PRODUCT_QUERY_SKIN_TYPES = Object.freeze([
  "oily",
  "dry",
  "combination",
  "sensitive",
  "not_sure"
]);

export const PRODUCT_QUERY_CONCERNS = Object.freeze([
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier"
]);

export const PRODUCT_QUERY_SENSITIVITY = Object.freeze(["low", "medium", "high"]);
export const PRODUCT_QUERY_TEXTURES = Object.freeze(["watery", "gel", "lotion", "cream"]);
export const PRODUCT_QUERY_DISLIKED_FEELS = Object.freeze(["sticky", "greasy", "heavy", "drying"]);
export const PRODUCT_QUERY_CONFIDENCE = Object.freeze(["high", "medium", "low"]);

const EXACT_KEYS = Object.freeze([
  "schema_version",
  "category",
  "skin_type",
  "concerns",
  "sensitivity",
  "texture",
  "disliked_feel",
  "sunscreen_intent",
  "white_cast_hate",
  "tone_up_wanted",
  "eye_sensitive",
  "makeup_use",
  "outdoor_exposure",
  "unresolved_terms",
  "confidence"
]);

function nullableEnum(values) {
  return {
    type: ["string", "null"],
    enum: [null, ...values]
  };
}

function nullableBoolean() {
  return {
    type: ["boolean", "null"]
  };
}

export const PRODUCT_QUERY_INTENT_JSON_SCHEMA = Object.freeze({
  type: "object",
  properties: {
    schema_version: {
      type: "string",
      enum: [PRODUCT_QUERY_INTENT_SCHEMA_VERSION]
    },
    category: nullableEnum(PRODUCT_QUERY_CATEGORIES),
    skin_type: nullableEnum(PRODUCT_QUERY_SKIN_TYPES),
    concerns: {
      type: "array",
      items: {
        type: "string",
        enum: PRODUCT_QUERY_CONCERNS
      },
      maxItems: 2
    },
    sensitivity: nullableEnum(PRODUCT_QUERY_SENSITIVITY),
    texture: nullableEnum(PRODUCT_QUERY_TEXTURES),
    disliked_feel: nullableEnum(PRODUCT_QUERY_DISLIKED_FEELS),
    sunscreen_intent: nullableBoolean(),
    white_cast_hate: nullableBoolean(),
    tone_up_wanted: nullableBoolean(),
    eye_sensitive: nullableBoolean(),
    makeup_use: nullableBoolean(),
    outdoor_exposure: nullableBoolean(),
    unresolved_terms: {
      type: "array",
      items: {
        type: "string",
        maxLength: 80
      },
      maxItems: 6
    },
    confidence: {
      type: "string",
      enum: PRODUCT_QUERY_CONFIDENCE
    }
  },
  required: EXACT_KEYS,
  additionalProperties: false
});

function isNullableEnum(value, allowed) {
  return value === null || (typeof value === "string" && allowed.includes(value));
}

function isNullableBoolean(value) {
  return value === null || typeof value === "boolean";
}

function uniqueStrings(values) {
  return new Set(values).size === values.length;
}

export function validateProductQueryIntent(value) {
  const errors = [];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["intent_not_object"], value: null };
  }

  const keys = Object.keys(value).sort();
  const expectedKeys = [...EXACT_KEYS].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
    errors.push("intent_keys_mismatch");
  }

  if (value.schema_version !== PRODUCT_QUERY_INTENT_SCHEMA_VERSION) {
    errors.push("schema_version_invalid");
  }
  if (!isNullableEnum(value.category, PRODUCT_QUERY_CATEGORIES)) {
    errors.push("category_invalid");
  }
  if (!isNullableEnum(value.skin_type, PRODUCT_QUERY_SKIN_TYPES)) {
    errors.push("skin_type_invalid");
  }
  if (!Array.isArray(value.concerns) || value.concerns.length > 2 ||
      !value.concerns.every((item) => PRODUCT_QUERY_CONCERNS.includes(item)) ||
      !uniqueStrings(value.concerns)) {
    errors.push("concerns_invalid");
  }
  if (!isNullableEnum(value.sensitivity, PRODUCT_QUERY_SENSITIVITY)) {
    errors.push("sensitivity_invalid");
  }
  if (!isNullableEnum(value.texture, PRODUCT_QUERY_TEXTURES)) {
    errors.push("texture_invalid");
  }
  if (!isNullableEnum(value.disliked_feel, PRODUCT_QUERY_DISLIKED_FEELS)) {
    errors.push("disliked_feel_invalid");
  }

  for (const key of [
    "sunscreen_intent",
    "white_cast_hate",
    "tone_up_wanted",
    "eye_sensitive",
    "makeup_use",
    "outdoor_exposure"
  ]) {
    if (!isNullableBoolean(value[key])) {
      errors.push(`${key}_invalid`);
    }
  }

  if (!Array.isArray(value.unresolved_terms) || value.unresolved_terms.length > 6 ||
      !value.unresolved_terms.every((item) =>
        typeof item === "string" && item.trim().length > 0 && item.length <= 80
      ) || !uniqueStrings(value.unresolved_terms)) {
    errors.push("unresolved_terms_invalid");
  }

  if (!PRODUCT_QUERY_CONFIDENCE.includes(value.confidence)) {
    errors.push("confidence_invalid");
  }

  if (value.category === "sunscreen" && value.sunscreen_intent === false) {
    errors.push("sunscreen_intent_conflict");
  }

  return {
    ok: errors.length === 0,
    errors,
    value: errors.length === 0 ? Object.freeze({
      ...value,
      concerns: Object.freeze([...value.concerns]),
      unresolved_terms: Object.freeze(value.unresolved_terms.map((item) => item.trim()))
    }) : null
  };
}

export function buildRecommendationAnswersFromProductQueryIntent(intent) {
  const validation = validateProductQueryIntent(intent);
  if (!validation.ok) {
    const error = new Error("PRODUCT_QUERY_INTENT_INVALID");
    error.code = "PRODUCT_QUERY_INTENT_INVALID";
    error.details = validation.errors;
    throw error;
  }

  const value = validation.value;
  const answers = {
    genderPreference: "unspecified"
  };

  if (value.skin_type !== null) answers.skinType = value.skin_type;
  if (value.concerns.length > 0) {
    answers.mainConcerns = [...value.concerns];
    answers.mainConcern = value.concerns[0];
  }
  if (value.sensitivity !== null) answers.sensitivityLevel = value.sensitivity;
  if (value.texture !== null) answers.preferredTexture = value.texture;
  if (value.disliked_feel !== null) answers.mostDislikedFeel = value.disliked_feel;
  if (value.category !== null) answers.explicitCategoryIntent = value.category;

  const sunscreenIntent = value.sunscreen_intent === true || value.category === "sunscreen";
  if (sunscreenIntent) answers.sunscreenIntent = true;

  if (value.white_cast_hate !== null) answers.whiteCastHate = value.white_cast_hate;
  if (value.tone_up_wanted !== null) answers.toneUpWanted = value.tone_up_wanted;
  if (value.eye_sensitive !== null) answers.eyeSensitive = value.eye_sensitive;
  if (value.makeup_use !== null) answers.makeupUse = value.makeup_use;
  if (value.outdoor_exposure !== null) answers.outdoorExposure = value.outdoor_exposure;

  return Object.freeze({
    contractVersion: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    provenance: "query_only",
    categoryIntent: value.category,
    recommendationAnswers: Object.freeze(answers),
    unresolvedTerms: Object.freeze([...value.unresolved_terms]),
    confidence: value.confidence
  });
}
