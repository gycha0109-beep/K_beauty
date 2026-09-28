#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  TOP_PICK_SCORING_WEIGHTS,
  scoreCanonicalProduct,
  scoreSunscreenProduct
} from "../lib/recommendation-scoring.ts";
import {
  buildProductQueryExplanationCandidates,
  buildProductQueryExplanationRefs,
  selectProductQueryExplanationRefsForRankedProducts
} from "../lib/product-query-explanation-contract.mjs";
import {
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION
} from "../lib/product-query-intent-contract.mjs";
import {
  buildProductQueryExecutionPlan
} from "../lib/product-query-execution-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function product(overrides = {}) {
  return {
    id: overrides.id || "synthetic",
    brand: "Synthetic",
    name: overrides.name || "Synthetic Product",
    category: overrides.category || "cleanser",
    skin_types: ["combination"],
    concerns: [],
    texture: "lotion",
    finish: "natural",
    irritation_risk: "medium",
    sensitivity_safe: false,
    recommendation_tier: "Tier1",
    ...overrides
  };
}

function intent(overrides = {}) {
  return {
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: "cleanser",
    skin_type: null,
    concerns: [],
    sensitivity: null,
    texture: null,
    disliked_feel: null,
    preferred_finish: null,
    post_wash_feeling: null,
    afternoon_skin_change: null,
    very_sensitive_period: null,
    sunscreen_intent: null,
    white_cast_hate: null,
    tone_up_wanted: null,
    eye_sensitive: null,
    makeup_use: null,
    outdoor_exposure: null,
    unresolved_terms: [],
    confidence: "high",
    ...overrides
  };
}

check(
  TOP_PICK_SCORING_WEIGHTS.primaryConcernMatch >
    TOP_PICK_SCORING_WEIGHTS.finishMatch,
  "primary concern must remain stronger than explicit finish"
);
check(
  TOP_PICK_SCORING_WEIGHTS.exactTextureMatch >=
    TOP_PICK_SCORING_WEIGHTS.finishMatch,
  "exact texture must remain at least as strong as explicit finish"
);
check(
  TOP_PICK_SCORING_WEIGHTS.finishMatch >
    TOP_PICK_SCORING_WEIGHTS.skinTypeMatch,
  "explicit finish must be stronger than general skin-type affinity"
);
check(
  TOP_PICK_SCORING_WEIGHTS.finishMatch === 8,
  "DATA-AI29B explicit finish calibration must stay frozen at +8"
);

const finishAnswers = {
  skinType: "oily",
  sensitivity: "medium",
  preferredFinish: "fresh"
};
const explicitFinish = scoreCanonicalProduct(
  product({
    id: "finish",
    skin_types: ["dry"],
    finish: "fresh"
  }),
  finishAnswers
);
const genericSkinAffinity = scoreCanonicalProduct(
  product({
    id: "skin",
    skin_types: ["oily"],
    finish: "dewy"
  }),
  finishAnswers
);
check(
  explicitFinish.score > genericSkinAffinity.score,
  "explicit requested finish must outrank skin-type affinity when other evidence is equal"
);

const concernAnswers = {
  sensitivity: "medium",
  mainConcern: "acne",
  mainConcerns: ["acne"],
  preferredFinish: "fresh"
};
const finishOnly = scoreCanonicalProduct(
  product({ id: "finish-only", finish: "fresh", concerns: [] }),
  concernAnswers
);
const concernOnly = scoreCanonicalProduct(
  product({ id: "concern-only", finish: "dewy", concerns: ["acne"] }),
  concernAnswers
);
check(
  concernOnly.score > finishOnly.score,
  "primary concern must still outrank explicit finish"
);

const sensitiveAnswers = {
  sensitivity: "high",
  preferredFinish: "fresh"
};
const riskyFinish = scoreCanonicalProduct(
  product({
    id: "risky-finish",
    finish: "fresh",
    irritation_risk: "high",
    sensitivity_safe: false
  }),
  sensitiveAnswers
);
const safeNoFinish = scoreCanonicalProduct(
  product({
    id: "safe",
    finish: "dewy",
    irritation_risk: "low",
    sensitivity_safe: true
  }),
  sensitiveAnswers
);
check(
  safeNoFinish.score > riskyFinish.score,
  "high-sensitivity safety must remain stronger than finish preference"
);

const textureAnswers = {
  sensitivity: "medium",
  preferredTexture: "lotion",
  preferredFinish: "fresh"
};
const exactTexture = scoreCanonicalProduct(
  product({ id: "texture", texture: "lotion", finish: "dewy" }),
  textureAnswers
);
const finishNoTexture = scoreCanonicalProduct(
  product({ id: "finish2", texture: "watery", finish: "fresh" }),
  textureAnswers
);
check(
  exactTexture.score >= finishNoTexture.score,
  "exact texture evidence must remain at least as influential as explicit finish"
);

const sunscreenIntent = intent({
  category: "sunscreen",
  skin_type: "oily",
  preferred_finish: "fresh",
  sunscreen_intent: true,
  white_cast_hate: true,
  tone_up_wanted: true,
  eye_sensitive: true,
  makeup_use: true
});
const sunscreenPlan = buildProductQueryExecutionPlan(sunscreenIntent);
const sunscreenRanked = scoreSunscreenProduct(
  product({
    id: "sun-all-fit",
    category: "sunscreen",
    skin_types: ["oily"],
    finish: "fresh",
    texture: "watery",
    uv_filter_type: "hybrid",
    tone_up: true,
    white_cast: "none",
    eye_sting: "low",
    pilling_risk: "low",
    sensitivity_safe: true,
    irritation_risk: "low"
  }),
  sunscreenPlan.recommendationAnswers
);

check(
  sunscreenRanked.sunscreen_score_breakdown?.total === sunscreenRanked.score,
  "sunscreen score breakdown must exactly reconstruct final sunscreen score"
);
check(
  sunscreenRanked.sunscreen_score_breakdown?.finish_match === 12 &&
    sunscreenRanked.sunscreen_score_breakdown?.tone_up_adjustment === 10 &&
    sunscreenRanked.sunscreen_score_breakdown?.white_cast_adjustment === 10 &&
    sunscreenRanked.sunscreen_score_breakdown?.eye_sting_adjustment === 8 &&
    sunscreenRanked.sunscreen_score_breakdown?.pilling_adjustment === 8,
  "sunscreen-specific positive score terms must remain explicit"
);

const sunscreenCandidates =
  buildProductQueryExplanationCandidates(sunscreenRanked, sunscreenPlan);
const sunscreenCandidateCodes = sunscreenCandidates.map((item) => item.ref.code);
check(
  [
    "sunscreen_white_cast_fit",
    "sunscreen_eye_sting_fit",
    "sunscreen_pilling_fit",
    "sunscreen_tone_up_fit",
    "finish_match",
    "skin_type_match"
  ].every((code) => sunscreenCandidateCodes.includes(code)),
  "all supported sunscreen explanation reasons must remain independently representable"
);
check(
  sunscreenCandidates.every((item) => item.impact > 0),
  "Product Query explanation candidates must come only from positive ranking evidence"
);
check(
  sunscreenCandidates.every(
    (item, index, list) => index === 0 || list[index - 1].impact >= item.impact
  ),
  "Product Query explanation candidates must be ordered by ranking impact"
);

const genericIntent = intent({
  skin_type: "oily",
  concerns: ["acne", "pores"],
  preferred_finish: "fresh"
});
const genericPlan = buildProductQueryExecutionPlan(genericIntent);
const first = scoreCanonicalProduct(
  product({
    id: "first",
    skin_types: ["oily"],
    concerns: ["acne"],
    finish: "fresh"
  }),
  genericPlan.recommendationAnswers
);
const second = scoreCanonicalProduct(
  product({
    id: "second",
    skin_types: ["oily"],
    concerns: ["acne", "pores"],
    finish: "fresh"
  }),
  genericPlan.recommendationAnswers
);

const selected = selectProductQueryExplanationRefsForRankedProducts(
  [first, second],
  genericPlan,
  { maxReasons: 3 }
);
check(
  selected[0].length === 3 && selected[1].length === 3,
  "ranked Product Query candidates should receive bounded explanation sets"
);
check(
  selected[1][0].code === "primary_concern_match" &&
    selected[1][1].code === "secondary_concern_match",
  "a real lower-impact differentiator must be preferred as an additional reason over repeated evidence"
);

const directRefs = buildProductQueryExplanationRefs(first, genericPlan);
check(
  directRefs.length > 0 &&
    directRefs.every((ref) => typeof ref.code === "string"),
  "single-product explanation projection must remain compatible"
);

console.log(
  `DATA-AI29B ranking/evidence verifier: PASS (${assertions} assertions)`
);
