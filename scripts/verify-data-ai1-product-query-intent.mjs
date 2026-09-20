import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PRODUCT_QUERY_INTENT_JSON_SCHEMA,
  PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
  buildRecommendationAnswersFromProductQueryIntent,
  validateProductQueryIntent
} from "../lib/product-query-intent-contract.mjs";

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}

function validIntent(overrides = {}) {
  return {
    schema_version: PRODUCT_QUERY_INTENT_SCHEMA_VERSION,
    category: null,
    skin_type: null,
    concerns: [],
    sensitivity: null,
    texture: null,
    disliked_feel: null,
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

const schemaKeys = Object.keys(PRODUCT_QUERY_INTENT_JSON_SCHEMA.properties).sort();
const requiredKeys = [...PRODUCT_QUERY_INTENT_JSON_SCHEMA.required].sort();
check(PRODUCT_QUERY_INTENT_JSON_SCHEMA.type === "object", "root schema must be object");
check(PRODUCT_QUERY_INTENT_JSON_SCHEMA.additionalProperties === false, "schema must reject extra keys");
check(JSON.stringify(schemaKeys) === JSON.stringify(requiredKeys), "all Structured Output fields must be required");

const korean = validIntent({
  category: "sunscreen",
  skin_type: "oily",
  concerns: ["oiliness"],
  texture: "watery",
  disliked_feel: "greasy",
  sunscreen_intent: true,
  white_cast_hate: true,
  tone_up_wanted: false,
  eye_sensitive: true,
  makeup_use: true,
  outdoor_exposure: true
});
const koreanValidation = validateProductQueryIntent(korean);
check(koreanValidation.ok, "Korean sunscreen-shaped intent must validate");
const koreanAdapter = buildRecommendationAnswersFromProductQueryIntent(korean);
check(koreanAdapter.provenance === "query_only", "adapter provenance must remain query_only");
check(koreanAdapter.categoryIntent === "sunscreen", "category intent must be preserved");
check(koreanAdapter.recommendationAnswers.explicitCategoryIntent === "sunscreen", "category must map into existing vocabulary");
check(koreanAdapter.recommendationAnswers.sunscreenIntent === true, "sunscreen intent must be explicit");
check(koreanAdapter.recommendationAnswers.whiteCastHate === true, "white cast preference must map");
check(koreanAdapter.recommendationAnswers.genderPreference === "unspecified", "query adapter must not infer gender");

const english = validIntent({
  category: "moisturizer_cream",
  skin_type: "dry",
  concerns: ["dehydration", "barrier"],
  sensitivity: "high",
  texture: "cream",
  outdoor_exposure: false,
  confidence: "medium"
});
const englishValidation = validateProductQueryIntent(english);
check(englishValidation.ok, "English moisturizer-shaped intent must validate");
const englishAdapter = buildRecommendationAnswersFromProductQueryIntent(english);
check(englishAdapter.recommendationAnswers.mainConcern === "dehydration", "primary concern order must be preserved");
check(JSON.stringify(englishAdapter.recommendationAnswers.mainConcerns) === JSON.stringify(["dehydration", "barrier"]), "two concerns must map without expansion");
check(englishAdapter.recommendationAnswers.sensitivityLevel === "high", "explicit sensitivity must map");
check(!("sunscreenIntent" in englishAdapter.recommendationAnswers), "non-sunscreen query must not invent sunscreen intent");

const unresolved = validIntent({
  category: "treatment",
  concerns: ["acne"],
  unresolved_terms: ["pregnancy-safe", "fungal acne safe"],
  confidence: "low"
});
const unresolvedValidation = validateProductQueryIntent(unresolved);
check(unresolvedValidation.ok, "unsupported concepts must remain representable as unresolved terms");
const unresolvedAdapter = buildRecommendationAnswersFromProductQueryIntent(unresolved);
check(unresolvedAdapter.unresolvedTerms.length === 2, "unresolved terms must survive adapter");
check(!("pregnancySafe" in unresolvedAdapter.recommendationAnswers), "unsupported concept must not become invented field");

const extraKey = { ...validIntent(), product_ids: ["forbidden"] };
check(!validateProductQueryIntent(extraKey).ok, "model output must not be able to return product IDs");

const rankingKey = { ...validIntent(), ranking: ["forbidden"] };
check(!validateProductQueryIntent(rankingKey).ok, "model output must not be able to return rankings");

check(!validateProductQueryIntent(validIntent({ category: "sunscreen", sunscreen_intent: false })).ok,
  "sunscreen category/intention conflict must fail closed");
check(!validateProductQueryIntent(validIntent({ concerns: ["acne", "barrier", "redness"] })).ok,
  "more than two concerns must fail closed");
check(!validateProductQueryIntent(validIntent({ concerns: ["acne", "acne"] })).ok,
  "duplicate concerns must fail closed");
check(!validateProductQueryIntent(validIntent({ category: "serum" })).ok,
  "legacy/unsupported category must fail closed");
check(!validateProductQueryIntent(validIntent({ skin_type: "normal" })).ok,
  "unsupported skin type must fail closed");
check(!validateProductQueryIntent(validIntent({ unresolved_terms: ["x".repeat(81)] })).ok,
  "oversized unresolved term must fail closed");

const nullOnly = validIntent({ confidence: "low" });
const nullAdapter = buildRecommendationAnswersFromProductQueryIntent(nullOnly);
check(Object.keys(nullAdapter.recommendationAnswers).length === 1, "unstated fields must not be invented");
check(nullAdapter.recommendationAnswers.genderPreference === "unspecified", "only neutral legacy-required gender field may be supplied");

const service = fs.readFileSync("lib/server/product-query-intent-service.js", "utf8");
check(service.includes('import "server-only"'), "provider service must be server-only");
check(service.includes("https://api.openai.com/v1/responses"), "provider must use Responses API");
check(service.includes("store: false"), "query response persistence must be disabled");
check(service.includes('type: "json_schema"'), "Structured Outputs JSON schema must be used");
check(service.includes("strict: true"), "Structured Outputs must be strict");
check(service.includes("PRODUCT_QUERY_AI_RESPONSE_INCOMPLETE"), "incomplete provider response must fail closed");
check(service.includes("PRODUCT_QUERY_AI_REFUSED"), "provider refusal must fail closed");
check(service.includes("PRODUCT_QUERY_AI_SCHEMA_REJECTED"), "application schema rejection must fail closed");
check(service.includes('provenance: "query_only"'), "provider result provenance must be query_only");
check(!service.includes("@/lib/product-source"), "AI extractor must not read products");
check(!service.includes("@/lib/recommendation-scoring"), "AI extractor must not rank products");
check(!service.includes("@/lib/skin-profile"), "AI extractor must not read skin profile");
check(!service.includes("supabase"), "AI extractor must not access hosted data");
check(!service.includes("product_id"), "AI extractor must not request or emit product IDs");
check(!service.includes("recommendation_logs"), "AI extractor must not persist recommendation evidence");

console.log(`DATA-AI1 product query intent verifier: PASS (${assertions} assertions)`);
