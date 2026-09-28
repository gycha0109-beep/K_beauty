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

function freezeCandidate(code, params, impact, ordinal) {
  return Object.freeze({
    ref: freezeRef(code, params),
    impact,
    ordinal,
    fingerprint: `${code}:${JSON.stringify(params)}`
  });
}

function appendCandidate(candidates, code, params, impact) {
  const numericImpact = Number(impact || 0);
  if (
    !CODE_SET.has(code) ||
    !Number.isFinite(numericImpact) ||
    numericImpact <= 0 ||
    candidates.some((item) => item.ref.code === code)
  ) {
    return;
  }

  const ref = freezeRef(code, params);
  if (!validateProductQueryExplanationRef(ref)) return;
  candidates.push(
    freezeCandidate(code, params, numericImpact, candidates.length)
  );
}

export function buildProductQueryExplanationCandidates(product, plan) {
  const candidates = [];
  const explicit = new Set(plan?.scoringContext?.explicitFields || []);
  const intent = plan?.intent || {};
  const signals = product?.matched_signals || {};
  const breakdown = product?.score_breakdown || {};
  const sunscreenBreakdown = product?.sunscreen_score_breakdown || {};
  const sunscreen = plan?.effectiveCategory === "sunscreen";

  if (
    sunscreen &&
    explicit.has("white_cast_hate") &&
    intent.white_cast_hate === true
  ) {
    const level = normalizeEnum(product?.white_cast, WHITE_CAST_LEVELS);
    if (level) {
      appendCandidate(
        candidates,
        "sunscreen_white_cast_fit",
        { level },
        sunscreenBreakdown.white_cast_adjustment
      );
    }
  }

  if (
    sunscreen &&
    explicit.has("eye_sensitive") &&
    intent.eye_sensitive === true &&
    product?.eye_sting === "low"
  ) {
    appendCandidate(
      candidates,
      "sunscreen_eye_sting_fit",
      {},
      sunscreenBreakdown.eye_sting_adjustment
    );
  }

  if (
    sunscreen &&
    explicit.has("makeup_use") &&
    intent.makeup_use === true &&
    product?.pilling_risk === "low"
  ) {
    appendCandidate(
      candidates,
      "sunscreen_pilling_fit",
      {},
      sunscreenBreakdown.pilling_adjustment
    );
  }

  if (
    sunscreen &&
    explicit.has("tone_up_wanted") &&
    intent.tone_up_wanted === true &&
    product?.tone_up === true
  ) {
    appendCandidate(
      candidates,
      "sunscreen_tone_up_fit",
      {},
      sunscreenBreakdown.tone_up_adjustment
    );
  }

  if (explicit.has("preferred_finish") && signals.finish_match === true) {
    const finish = normalizeEnum(product?.finish, FINISHES);
    const impact = sunscreen
      ? sunscreenBreakdown.finish_match
      : breakdown.finish_match;
    if (finish) appendCandidate(candidates, "finish_match", { finish }, impact);
  }

  if (explicit.has("texture")) {
    const texture = normalizeEnum(product?.texture, TEXTURES);
    if (texture && signals.texture_match === "exact") {
      appendCandidate(
        candidates,
        "texture_exact_match",
        { texture },
        breakdown.texture_match
      );
    } else if (texture && signals.texture_match === "near") {
      appendCandidate(
        candidates,
        "texture_near_match",
        { texture },
        breakdown.texture_match
      );
    }
  }

  if (signals.matched_primary_concern && intent.concerns?.[0]) {
    const concern = normalizeEnum(intent.concerns[0], CONCERNS);
    const impact = sunscreen
      ? sunscreenBreakdown.primary_concern_match
      : breakdown.primary_concern_match;
    if (concern) {
      appendCandidate(candidates, "primary_concern_match", { concern }, impact);
    }
  }

  if (signals.matched_secondary_concern && intent.concerns?.[1]) {
    const concern = normalizeEnum(intent.concerns[1], CONCERNS);
    const impact = sunscreen
      ? sunscreenBreakdown.secondary_concern_match
      : breakdown.secondary_concern_match;
    if (concern) {
      appendCandidate(candidates, "secondary_concern_match", { concern }, impact);
    }
  }

  if (Number(breakdown.post_cleanse_adjustment || 0) > 0) {
    if (intent.post_wash_feeling === "tight") {
      appendCandidate(
        candidates,
        "post_wash_tight_fit",
        {},
        breakdown.post_cleanse_adjustment
      );
    } else if (intent.post_wash_feeling === "still_oily") {
      appendCandidate(
        candidates,
        "post_wash_oily_fit",
        {},
        breakdown.post_cleanse_adjustment
      );
    }
  }

  if (Number(breakdown.afternoon_state_adjustment || 0) > 0) {
    if (intent.afternoon_skin_change === "more_oily") {
      appendCandidate(
        candidates,
        "afternoon_oily_fit",
        {},
        breakdown.afternoon_state_adjustment
      );
    } else if (intent.afternoon_skin_change === "more_dry") {
      appendCandidate(
        candidates,
        "afternoon_dry_fit",
        {},
        breakdown.afternoon_state_adjustment
      );
    } else if (intent.afternoon_skin_change === "red_or_irritated") {
      appendCandidate(
        candidates,
        "afternoon_irritation_fit",
        {},
        breakdown.afternoon_state_adjustment
      );
    }
  }

  if (
    explicit.has("very_sensitive_period") &&
    intent.very_sensitive_period === true &&
    Number(signals.very_sensitive_period_bonus || 0) > 0
  ) {
    appendCandidate(
      candidates,
      "sensitive_period_fit",
      {},
      sunscreen
        ? Math.max(0, Number(sunscreenBreakdown.sensitivity_safe_adjustment || 0))
        : breakdown.very_sensitive_period_bonus
    );
  }

  if (
    explicit.has("sensitivity") &&
    intent.sensitivity === "high" &&
    signals.sensitivity_safe === true
  ) {
    const genericSafetyImpact =
      Math.max(0, Number(breakdown.irritation_penalty || 0)) +
      Math.max(0, Number(breakdown.sensitivity_safe_bonus || 0));
    appendCandidate(
      candidates,
      "sensitivity_safe_fit",
      {},
      sunscreen
        ? sunscreenBreakdown.sensitivity_safe_adjustment
        : genericSafetyImpact
    );
  }

  if (explicit.has("skin_type") && signals.matched_skin_type) {
    const skinType = normalizeEnum(signals.matched_skin_type, SKIN_TYPES);
    const impact = sunscreen
      ? sunscreenBreakdown.skin_type_match
      : breakdown.skin_type_match;
    if (skinType) {
      appendCandidate(candidates, "skin_type_match", { skinType }, impact);
    }
  }

  return Object.freeze(
    candidates
      .slice()
      .sort((left, right) =>
        right.impact - left.impact || left.ordinal - right.ordinal
      )
  );
}

export function buildProductQueryExplanationRefs(product, plan) {
  return Object.freeze(
    buildProductQueryExplanationCandidates(product, plan)
      .slice(0, 4)
      .map((item) => item.ref)
  );
}

export function selectProductQueryExplanationRefsForRankedProducts(
  products,
  plan,
  options = {}
) {
  const maxReasons = Math.max(
    1,
    Math.min(4, Number.isInteger(options.maxReasons) ? options.maxReasons : 3)
  );
  const seenFingerprints = new Set();

  return Object.freeze(
    (Array.isArray(products) ? products : []).map((product) => {
      const candidates = [...buildProductQueryExplanationCandidates(product, plan)];
      if (candidates.length === 0) return Object.freeze([]);

      const selected = [candidates[0]];
      const rest = candidates.slice(1).sort((left, right) => {
        const leftSeen = seenFingerprints.has(left.fingerprint) ? 1 : 0;
        const rightSeen = seenFingerprints.has(right.fingerprint) ? 1 : 0;
        return (
          leftSeen - rightSeen ||
          right.impact - left.impact ||
          left.ordinal - right.ordinal
        );
      });

      for (const candidate of rest) {
        if (selected.length >= maxReasons) break;
        selected.push(candidate);
      }

      for (const candidate of selected) {
        seenFingerprints.add(candidate.fingerprint);
      }

      return Object.freeze(selected.map((candidate) => candidate.ref));
    })
  );
}
