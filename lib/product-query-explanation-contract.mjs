export const PRODUCT_QUERY_EXPLANATION_CONTRACT_VERSION =
  "product-query-explanation-v1";

export const PRODUCT_QUERY_EXPLANATION_CODES = Object.freeze([
  "sunscreen_white_cast_fit",
  "sunscreen_eye_sting_fit",
  "sunscreen_pilling_fit",
  "sunscreen_tone_up_fit",
  "sunscreen_no_tone_up_fit",
  "finish_match",
  "texture_exact_match",
  "texture_near_match",
  "primary_concern_match",
  "secondary_concern_match",
  "skin_type_match",
  "post_wash_tight_fit",
  "post_wash_oily_fit",
  "afternoon_oily_fit",
  "afternoon_dry_fit",
  "afternoon_irritation_fit",
  "sensitive_period_fit",
  "sensitivity_safe_fit"
]);

const CODE_SET = new Set(PRODUCT_QUERY_EXPLANATION_CODES);
const WHITE_CAST_LEVELS = new Set(["none", "low"]);
const FINISHES = new Set(["fresh", "natural", "dewy", "soft_matte"]);
const TEXTURES = new Set(["watery", "gel", "lotion", "cream"]);
const SKIN_TYPES = new Set(["oily", "dry", "combination", "sensitive", "not_sure"]);
const CONCERNS = new Set([
  "oiliness",
  "dehydration",
  "acne",
  "uneven_tone",
  "pores",
  "redness",
  "barrier"
]);

function freezeRef(code, params = {}) {
  return Object.freeze({
    code,
    params: Object.freeze({ ...params })
  });
}

function appendReason(refs, code, params = {}) {
  if (!CODE_SET.has(code) || refs.some((item) => item.code === code)) return;
  refs.push(freezeRef(code, params));
}

function normalizeEnum(value, allowed) {
  return allowed.has(value) ? value : null;
}

export function validateProductQueryExplanationRef(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (!CODE_SET.has(value.code)) return false;
  if (!value.params || typeof value.params !== "object" || Array.isArray(value.params)) {
    return false;
  }

  const keys = Object.keys(value.params).sort();
  const allowedByCode = {
    sunscreen_white_cast_fit: ["level"],
    sunscreen_eye_sting_fit: [],
    sunscreen_pilling_fit: [],
    sunscreen_tone_up_fit: [],
    sunscreen_no_tone_up_fit: [],
    finish_match: ["finish"],
    texture_exact_match: ["texture"],
    texture_near_match: ["texture"],
    primary_concern_match: ["concern"],
    secondary_concern_match: ["concern"],
    skin_type_match: ["skinType"],
    post_wash_tight_fit: [],
    post_wash_oily_fit: [],
    afternoon_oily_fit: [],
    afternoon_dry_fit: [],
    afternoon_irritation_fit: [],
    sensitive_period_fit: [],
    sensitivity_safe_fit: []
  };

  const expectedKeys = allowedByCode[value.code];
  if (JSON.stringify(keys) !== JSON.stringify([...expectedKeys].sort())) return false;

  if (value.code === "sunscreen_white_cast_fit") {
    return WHITE_CAST_LEVELS.has(value.params.level);
  }
  if (value.code === "finish_match") {
    return FINISHES.has(value.params.finish);
  }
  if (value.code === "texture_exact_match" || value.code === "texture_near_match") {
    return TEXTURES.has(value.params.texture);
  }
  if (value.code === "primary_concern_match" || value.code === "secondary_concern_match") {
    return CONCERNS.has(value.params.concern);
  }
  if (value.code === "skin_type_match") {
    return SKIN_TYPES.has(value.params.skinType);
  }

  return true;
}

export function buildProductQueryExplanationRefs(product, plan) {
  const refs = [];
  const explicit = new Set(plan?.scoringContext?.explicitFields || []);
  const intent = plan?.intent || {};
  const signals = product?.matched_signals || {};
  const breakdown = product?.score_breakdown || {};
  const sunscreen = plan?.effectiveCategory === "sunscreen";

  if (
    sunscreen &&
    explicit.has("white_cast_hate") &&
    intent.white_cast_hate === true
  ) {
    const level = normalizeEnum(product?.white_cast, WHITE_CAST_LEVELS);
    if (level) appendReason(refs, "sunscreen_white_cast_fit", { level });
  }

  if (
    sunscreen &&
    explicit.has("eye_sensitive") &&
    intent.eye_sensitive === true &&
    product?.eye_sting === "low"
  ) {
    appendReason(refs, "sunscreen_eye_sting_fit");
  }

  if (
    sunscreen &&
    explicit.has("makeup_use") &&
    intent.makeup_use === true &&
    product?.pilling_risk === "low"
  ) {
    appendReason(refs, "sunscreen_pilling_fit");
  }

  if (sunscreen && explicit.has("tone_up_wanted")) {
    if (intent.tone_up_wanted === true && product?.tone_up === true) {
      appendReason(refs, "sunscreen_tone_up_fit");
    } else if (intent.tone_up_wanted === false && product?.tone_up === false) {
      appendReason(refs, "sunscreen_no_tone_up_fit");
    }
  }

  if (
    explicit.has("preferred_finish") &&
    signals.finish_match === true
  ) {
    const finish = normalizeEnum(product?.finish, FINISHES);
    if (finish) appendReason(refs, "finish_match", { finish });
  }

  if (explicit.has("texture")) {
    const texture = normalizeEnum(product?.texture, TEXTURES);
    if (texture && signals.texture_match === "exact") {
      appendReason(refs, "texture_exact_match", { texture });
    } else if (texture && signals.texture_match === "near") {
      appendReason(refs, "texture_near_match", { texture });
    }
  }

  if (signals.matched_primary_concern && intent.concerns?.[0]) {
    const concern = normalizeEnum(intent.concerns[0], CONCERNS);
    if (concern) appendReason(refs, "primary_concern_match", { concern });
  }

  if (signals.matched_secondary_concern && intent.concerns?.[1]) {
    const concern = normalizeEnum(intent.concerns[1], CONCERNS);
    if (concern) appendReason(refs, "secondary_concern_match", { concern });
  }

  if (Number(breakdown.post_cleanse_adjustment || 0) > 0) {
    if (intent.post_wash_feeling === "tight") {
      appendReason(refs, "post_wash_tight_fit");
    } else if (intent.post_wash_feeling === "still_oily") {
      appendReason(refs, "post_wash_oily_fit");
    }
  }

  if (Number(breakdown.afternoon_state_adjustment || 0) > 0) {
    if (intent.afternoon_skin_change === "more_oily") {
      appendReason(refs, "afternoon_oily_fit");
    } else if (intent.afternoon_skin_change === "more_dry") {
      appendReason(refs, "afternoon_dry_fit");
    } else if (intent.afternoon_skin_change === "red_or_irritated") {
      appendReason(refs, "afternoon_irritation_fit");
    }
  }

  if (
    explicit.has("very_sensitive_period") &&
    intent.very_sensitive_period === true &&
    Number(signals.very_sensitive_period_bonus || 0) > 0
  ) {
    appendReason(refs, "sensitive_period_fit");
  }

  if (
    explicit.has("sensitivity") &&
    intent.sensitivity === "high" &&
    signals.sensitivity_safe === true
  ) {
    appendReason(refs, "sensitivity_safe_fit");
  }

  if (
    explicit.has("skin_type") &&
    signals.matched_skin_type
  ) {
    const skinType = normalizeEnum(signals.matched_skin_type, SKIN_TYPES);
    if (skinType) appendReason(refs, "skin_type_match", { skinType });
  }

  return Object.freeze(
    refs.filter(validateProductQueryExplanationRef).slice(0, 4)
  );
}
