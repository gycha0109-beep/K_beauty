#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import {
  canonicalizeProductQuerySemanticOwnership
} from "../lib/product-query-intent-semantic-ownership.mjs";
import {
  PRODUCT_QUERY_EXPLANATION_CONTRACT_VERSION,
  buildProductQueryExplanationRefs,
  validateProductQueryExplanationRef
} from "../lib/product-query-explanation-contract.mjs";
import { PRODUCT_QUERY_INTENT_SCHEMA_VERSION } from "../lib/product-query-intent-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function intent(overrides = {}) {
  return {
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: null,
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

const independentAxes = canonicalizeProductQuerySemanticOwnership(
  "백탁은 싫은데 얼굴은 밝아 보였으면 좋겠어. 선크림 추천해줘",
  intent({
    category: "sunscreen",
    sunscreen_intent: true,
    white_cast_hate: false,
    tone_up_wanted: false,
    unresolved_terms: ["tone-up preference conflict"],
    confidence: "low"
  })
);
check(independentAxes.white_cast_hate === true,
  "white-cast avoidance must be canonicalized independently");
check(independentAxes.tone_up_wanted === true,
  "brighter-looking request must remain positive tone-up evidence");
check(independentAxes.unresolved_terms.length === 0,
  "independent white-cast and tone-up axes must not retain a conflict");

const trueConflict = canonicalizeProductQuerySemanticOwnership(
  "톤업은 싫은데 확실하게 톤업되는 선크림 찾아줘",
  intent({
    category: "sunscreen",
    sunscreen_intent: true,
    tone_up_wanted: true
  })
);
check(trueConflict.tone_up_wanted === null,
  "real same-axis tone-up conflict must neutralize ranking evidence");
check(trueConflict.unresolved_terms.includes("tone-up preference conflict"),
  "real same-axis tone-up conflict must remain visible");

check(PRODUCT_QUERY_EXPLANATION_CONTRACT_VERSION === "product-query-explanation-v1",
  "explanation contract version must be frozen");

const plan = {
  effectiveCategory: "sunscreen",
  intent: {
    skin_type: "oily",
    concerns: [],
    sensitivity: null,
    preferred_finish: "fresh",
    post_wash_feeling: null,
    afternoon_skin_change: null,
    very_sensitive_period: null,
    white_cast_hate: true,
    tone_up_wanted: true,
    eye_sensitive: true,
    makeup_use: true
  },
  scoringContext: {
    explicitFields: [
      "skin_type",
      "preferred_finish",
      "white_cast_hate",
      "tone_up_wanted",
      "eye_sensitive",
      "makeup_use"
    ]
  }
};

const product = {
  white_cast: "none",
  tone_up: true,
  eye_sting: "low",
  pilling_risk: "low",
  finish: "fresh",
  texture: "watery",
  matched_signals: {
    matched_skin_type: "oily",
    matched_primary_concern: false,
    matched_secondary_concern: false,
    texture_match: "none",
    finish_match: true,
    sensitivity_safe: true,
    very_sensitive_period_bonus: 0
  },
  score_breakdown: {
    post_cleanse_adjustment: 0,
    afternoon_state_adjustment: 0,
    finish_match: 8,
    skin_type_match: 4
  },
  sunscreen_score_breakdown: {
    skin_type_match: 24,
    primary_concern_match: 0,
    secondary_concern_match: 0,
    finish_match: 12,
    filter_type_match: 0,
    sensitivity_safe_adjustment: 0,
    tone_up_adjustment: 10,
    white_cast_adjustment: 10,
    eye_sting_adjustment: 8,
    pilling_adjustment: 8,
    strong_penalty_adjustment: 0,
    total: 72
  }
};

const refs = buildProductQueryExplanationRefs(product, plan);
const codes = refs.map((item) => item.code);
check(refs.length === 4,
  "multi-condition sunscreen reasons must remain independently representable");
check(codes.includes("sunscreen_white_cast_fit"),
  "white-cast match must produce its own reason");
check(codes.includes("sunscreen_eye_sting_fit"),
  "eye-sting match must produce its own reason");
check(codes.includes("sunscreen_pilling_fit"),
  "pilling match must produce its own reason");
check(codes.includes("sunscreen_tone_up_fit"),
  "tone-up match must produce its own reason");
check(refs.every(validateProductQueryExplanationRef),
  "all projected reason refs must satisfy the bounded explanation schema");
check(!JSON.stringify(refs).includes("백탁") && !JSON.stringify(refs).includes("White cast"),
  "structured explanation refs must be language-neutral");

const component = fs.readFileSync("components/my/ProductQueryBetaCard.jsx", "utf8");
const copy = fs.readFileSync("lib/my/i18n.js", "utf8");
const recommendation = fs.readFileSync("lib/product-query-recommendation.js", "utf8");
const preview = fs.readFileSync("lib/server/product-query-preview-service.js", "utf8");
const service = fs.readFileSync("lib/server/product-query-intent-service.js", "utf8");

check(component.includes("formatExplanationRef") && component.includes("product.explanationRefs"),
  "Product Query UI must render bounded explanation refs");
check(!component.includes("product.whyPicked.slice"),
  "Product Query UI must not render scorer-language legacy whyPicked strings");
check(copy.includes('sunscreen_white_cast_fit: "백탁이 적은 편이라') &&
      copy.includes('sunscreen_white_cast_fit: "Lower white-cast risk'),
  "KO and EN explanation copies must both exist");
check(recommendation.includes("selectProductQueryExplanationRefsForRankedProducts"),
  "deterministic recommendation runtime must project score-grounded explanation refs");
check(preview.includes("explanationRefs"),
  "authenticated preview must preserve structured explanation refs");
check(service.includes("White-cast avoidance and tone-up preference are independent dimensions."),
  "provider instructions must state independent sunscreen semantic ownership");
check(service.includes("const DEFAULT_MAX_OUTPUT_TOKENS = 600;"),
  "DATA-AI28 stable output budget must remain unchanged");
check(service.includes('const DEFAULT_MODEL = "gpt-5.6-luna";'),
  "provider/model authority must remain unchanged");

console.log(`DATA-AI29A semantic/explanation verifier: PASS (${assertions} assertions)`);
