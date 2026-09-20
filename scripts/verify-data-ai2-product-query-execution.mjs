import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PRODUCT_QUERY_EXECUTION_CONTRACT_VERSION,
  buildProductQueryExecutionPlan,
  filterProductQueryCandidates,
  projectProductForQueryScoring
} from "../lib/product-query-execution-contract.mjs";
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

const products = [
  { id: "1", brand: "A", name: "Cream", category: "moisturizer_cream", finish: "dewy", irritation_risk: "low", sensitivity_safe: true, tone_up: true },
  { id: "2", brand: "B", name: "Gel", category: "moisturizer_gel", finish: "fresh", irritation_risk: "high", sensitivity_safe: false, tone_up: false },
  { id: "3", brand: "C", name: "Sun", category: "sunscreen", finish: "natural", irritation_risk: "low", sensitivity_safe: true, tone_up: true }
];

const creamPlan = buildProductQueryExecutionPlan(intent({
  category: "moisturizer_cream",
  texture: "cream"
}));
check(creamPlan.contractVersion === PRODUCT_QUERY_EXECUTION_CONTRACT_VERSION, "DATA-AI2 contract version must be fixed");
check(creamPlan.effectiveCategory === "moisturizer_cream", "specific category intent must be preserved");
check(creamPlan.rankingEligible, "explicit texture must make cream query rankable");
check(JSON.stringify(creamPlan.rankableSignals) === JSON.stringify(["texture"]), "only explicit rankable signal may drive sparse query");
const creamCandidates = filterProductQueryCandidates(products, creamPlan);
check(creamCandidates.length === 1 && creamCandidates[0].id === "1", "specific category filter must not widen to moisturizer family");

const sunscreenPlan = buildProductQueryExecutionPlan(intent({
  sunscreen_intent: true,
  white_cast_hate: true
}));
check(sunscreenPlan.effectiveCategory === "sunscreen", "explicit sunscreen intent must resolve sunscreen category");
check(sunscreenPlan.rankingEligible, "white-cast constraint must make sunscreen query rankable");
check(filterProductQueryCandidates(products, sunscreenPlan).length === 1, "sunscreen intent must filter exact sunscreen corpus");

const categoryOnly = buildProductQueryExecutionPlan(intent({ category: "cleanser" }));
check(!categoryOnly.rankingEligible, "category-only query must not invent ranking evidence");
check(categoryOnly.rankableSignals.length === 0, "category-only query must expose zero rankable signals");

const notSure = buildProductQueryExecutionPlan(intent({
  category: "moisturizer_gel",
  skin_type: "not_sure"
}));
check(!notSure.rankingEligible, "not_sure skin type must not become synthetic ranking evidence");

const unresolved = buildProductQueryExecutionPlan(intent({
  category: "treatment",
  concerns: ["acne"],
  unresolved_terms: ["pregnancy-safe"]
}));
check(unresolved.constraintStatus === "partial", "unresolved constraint must remain explicit partial coverage");
check(unresolved.unresolvedTerms[0] === "pregnancy-safe", "unresolved term must survive execution planning");

const neutralPlan = buildProductQueryExecutionPlan(intent({
  category: "moisturizer_cream",
  texture: "cream"
}));
const neutralProduct = projectProductForQueryScoring(products[0], neutralPlan);
check(neutralProduct.irritation_risk === "medium", "unstated sensitivity must neutralize irritation risk during query scoring");
check(neutralProduct.sensitivity_safe === false, "unstated sensitivity must neutralize sensitivity-safe bonus during query scoring");
check(neutralProduct.finish === products[0].finish, "explicit texture may retain finish because finish preference derives from texture");
check(neutralProduct.tone_up === products[0].tone_up, "non-sunscreen projection must not rewrite sunscreen-only fields");

const sunscreenNeutralTone = projectProductForQueryScoring(products[2], sunscreenPlan, { sunscreen: true });
check(sunscreenNeutralTone.tone_up === false, "unstated tone-up preference must not penalize or reward tone-up products");
check(sunscreenNeutralTone.irritation_risk === "medium", "unstated sunscreen safety intent must not inherit default medium-sensitivity scoring");

const sensitiveSunPlan = buildProductQueryExecutionPlan(intent({
  category: "sunscreen",
  skin_type: "sensitive",
  sunscreen_intent: true
}));
const sensitiveSun = projectProductForQueryScoring(products[2], sensitiveSunPlan, { sunscreen: true });
check(sensitiveSun.irritation_risk === "low" && sensitiveSun.sensitivity_safe === true,
  "explicit sensitive skin type may retain existing sunscreen safety metadata");

let conflictClosed = false;
try {
  buildProductQueryExecutionPlan(intent({ category: "cleanser", sunscreen_intent: true }));
} catch (error) {
  conflictClosed = error?.code === "PRODUCT_QUERY_EXECUTION_CATEGORY_CONFLICT";
}
check(conflictClosed, "cross-category sunscreen conflict must fail closed");

const runtime = fs.readFileSync("lib/product-query-recommendation.js", "utf8");
check(runtime.includes('from "@/lib/product-source"'), "runtime must consume existing admitted product source");
check(runtime.includes('from "@/lib/recommendation-scoring"'), "runtime must reuse existing deterministic scorer");
check(runtime.includes("filterSunscreenCandidates"), "runtime must reuse existing sunscreen hard-filter authority");
check(runtime.includes("scoreCanonicalProduct"), "runtime must reuse canonical scorer instead of creating weights");
check(!runtime.includes("TOP_PICK_SCORING_WEIGHTS"), "DATA-AI2 must not duplicate scoring weights");
check(!runtime.includes("supabase"), "DATA-AI2 runtime must not bypass product-source admission with direct Supabase reads");
check(!runtime.includes("product_fact_"), "DATA-AI2 runtime must not add direct Product Fact table reads");
check(!runtime.includes("skin_profile"), "DATA-AI2 runtime must not merge saved skin profile");
check(!runtime.includes("analysis_results"), "DATA-AI2 runtime must not merge analysis history");
check(!runtime.includes("OpenAI"), "deterministic execution runtime must not call AI");
check(runtime.includes('status: "insufficient_supported_intent"'), "insufficient sparse intent must fail closed without arbitrary ranking");

const source = fs.readFileSync("lib/product-source.js", "utf8");
check(source.includes("enumerateRecommendationProductsDeterministically"), "existing corpus must remain deterministic enumeration");
check(source.includes("admitRecommendationProducts"), "existing corpus must retain recommendation admission authority");
check(source.includes("projectAdmittedRecommendationProducts"), "only admitted products may reach DATA-AI2 corpus");

console.log(`DATA-AI2 structured product query verifier: PASS (${assertions} assertions)`);
