import assert from "node:assert/strict";
import fs from "node:fs";
import {
  compareRankedProducts,
  getProductCategoryPriority,
  getProductCategorySlot,
  scoreCanonicalProduct,
} from "../../lib/recommendation-scoring.ts";
import { resolveProductCategorySemantics } from "../../lib/product-category-normalizer.js";

const evidencePath = "evidence/catalog-taxonomy-v1/data-taxonomy4-recommendation-shadow-parity-v1.json";
const scoringPath = "lib/recommendation-scoring.ts";
const normalizerPath = "lib/product-category-normalizer.js";

for (const path of [evidencePath, scoringPath, normalizerPath]) {
  assert.ok(fs.existsSync(path), `missing DATA-TAXONOMY4 artifact: ${path}`);
}

const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const scoringSource = fs.readFileSync(scoringPath, "utf8");

assert.equal(evidence.schema_version, "data-taxonomy4-recommendation-shadow-parity-v1");
assert.equal(evidence.taxonomy_version, "catalog-taxonomy-v1");
assert.equal(evidence.taxonomy_lifecycle_state, "shadow");
assert.equal(evidence.taxonomy_authority_mode, "shadow_only");
assert.equal(evidence.recommendation_runtime_authority, "legacy_product_category_product_form");
assert.equal(evidence.recommendation_runtime_cutover, false);
assert.equal(evidence.product_count, 165);
assert.equal(evidence.equivalence_class_count, 11);
assert.equal(evidence.non_exact_count, 0);
assert.equal(evidence.classes.length, 11);
assert.equal(evidence.classes.reduce((sum, item) => sum + item.product_count, 0), 165);

for (const marker of [
  "resolveProductCategorySemantics({",
  "getProductCategorySlot(product)",
  "getProductCategoryPriority(product, answers.mainConcern)",
  "getOutdoorSunscreenBonus(answers, product)",
  "export function scoreCanonicalProduct(",
  "export function compareRankedProducts(",
]) {
  assert.ok(scoringSource.includes(marker), `Recommendation category-sensitive seam drifted: ${marker}`);
}

const comparableSemantics = (value) => ({
  canonicalCategory: value.canonicalCategory,
  productForm: value.productForm,
  productFamily: value.productFamily,
  routineSlot: value.routineSlot,
  resultSection: value.resultSection,
  unsupported: value.unsupported,
  unresolved: value.unresolved,
  unresolvedReason: value.unresolvedReason,
  authorizesRecommendationCategory: value.authorizesRecommendationCategory,
});

for (const item of evidence.classes) {
  assert.equal(item.all_exact_equivalent, true);
  assert.equal(item.legacy_category, item.projected_legacy_category);
  assert.equal(item.legacy_product_form, item.projected_legacy_product_form);
  assert.ok(Number.isInteger(item.product_count) && item.product_count > 0);

  const legacyInput = {
    category: item.legacy_category,
    product_form: item.legacy_product_form,
  };
  const projectedInput = {
    category: item.projected_legacy_category,
    product_form: item.projected_legacy_product_form,
  };
  const legacySemantics = resolveProductCategorySemantics(legacyInput);
  const projectedSemantics = resolveProductCategorySemantics(projectedInput);

  assert.equal(legacySemantics.authorizesRecommendationCategory, true, `legacy category rejected: ${JSON.stringify(legacyInput)}`);
  assert.equal(projectedSemantics.authorizesRecommendationCategory, true, `projected category rejected: ${JSON.stringify(projectedInput)}`);
  assert.deepEqual(comparableSemantics(projectedSemantics), comparableSemantics(legacySemantics));

  const legacySlot = getProductCategorySlot(legacyInput);
  const projectedSlot = getProductCategorySlot(projectedInput);
  assert.ok(legacySlot, `empty legacy slot: ${JSON.stringify(legacyInput)}`);
  assert.equal(projectedSlot, legacySlot);

  for (const concern of ["oiliness", "pores", "acne", "dehydration", "barrier", "redness", "uneven_tone", "uv"]) {
    assert.equal(
      getProductCategoryPriority(projectedInput, concern),
      getProductCategoryPriority(legacyInput, concern),
      `category-priority delta for ${concern}: ${JSON.stringify(item)}`,
    );
  }
}

const axes = ["oiliness", "pores", "acne", "dehydration", "barrier", "redness", "uneven_tone", "uv"];
const textures = ["watery", "gel", "lotion", "cream"];
const finishes = ["fresh", "natural", "dewy", "soft_matte"];
const skinTypes = ["oily", "combination", "dry", "sensitive", "normal"];

function buildReplayProducts(side) {
  const products = [];
  let ordinal = 0;

  for (let classIndex = 0; classIndex < evidence.classes.length; classIndex += 1) {
    const item = evidence.classes[classIndex];
    const category = side === "legacy" ? item.legacy_category : item.projected_legacy_category;
    const productForm = side === "legacy" ? item.legacy_product_form : item.projected_legacy_product_form;

    for (let rowIndex = 0; rowIndex < item.product_count; rowIndex += 1) {
      const primaryAxis = axes[ordinal % axes.length];
      const secondaryAxis = axes[(ordinal + 3) % axes.length];
      products.push({
        id: `taxonomy4-${classIndex}-${rowIndex}`,
        name: `T4 Replay ${String(ordinal).padStart(3, "0")}`,
        brand: "DATA-TAXONOMY4",
        category,
        product_form: productForm,
        skin_types: [skinTypes[ordinal % skinTypes.length], "combination"],
        concerns: [primaryAxis, secondaryAxis],
        texture: textures[ordinal % textures.length],
        finish: finishes[ordinal % finishes.length],
        irritation_risk: ordinal % 5 === 0 ? "medium" : "low",
        sensitivity_safe: ordinal % 3 !== 0,
        recommendation_tier: ordinal % 7 === 0 ? "Tier2" : "Tier1",
        is_mens: false,
      });
      ordinal += 1;
    }
  }

  assert.equal(products.length, 165);
  return products;
}

const scenarios = [
  { id: "oiliness", skinType: "oily", sensitivity: "medium", mainConcerns: ["oiliness", "pores"], preferredTexture: "gel", afternoonSkinChange: "more_oily" },
  { id: "pores", skinType: "combination", sensitivity: "medium", mainConcerns: ["pores", "oiliness"], preferredTexture: "watery", mostDislikedFeel: "heavy" },
  { id: "acne", skinType: "oily", sensitivity: "high", mainConcerns: ["acne", "redness"], preferredTexture: "watery", verySensitivePeriod: true },
  { id: "dehydration", skinType: "dry", sensitivity: "medium", mainConcerns: ["dehydration", "barrier"], preferredTexture: "cream", postWashFeeling: "tight" },
  { id: "barrier", skinType: "sensitive", sensitivity: "high", mainConcerns: ["barrier", "redness"], preferredTexture: "lotion", verySensitivePeriod: true },
  { id: "redness", skinType: "sensitive", sensitivity: "high", mainConcerns: ["redness", "barrier"], preferredTexture: "watery", afternoonSkinChange: "red_or_irritated" },
  { id: "uneven_tone", skinType: "normal", sensitivity: "low", mainConcerns: ["uneven_tone", "dehydration"], preferredTexture: "lotion" },
  { id: "uv-outdoor", skinType: "combination", sensitivity: "medium", mainConcerns: ["uv", "dehydration"], preferredTexture: "gel", outdoorExposure: true, sunscreenIntent: true, explicitCategoryIntent: "sunscreen" },
];

const legacyProducts = buildReplayProducts("legacy");
const projectedProducts = buildReplayProducts("projected");
const replaySummary = [];

for (const scenario of scenarios) {
  const legacyRanked = legacyProducts.map((product) => scoreCanonicalProduct(product, scenario)).sort(compareRankedProducts);
  const projectedRanked = projectedProducts.map((product) => scoreCanonicalProduct(product, scenario)).sort(compareRankedProducts);

  const legacyById = new Map(legacyRanked.map((product) => [product.id, product]));
  const projectedById = new Map(projectedRanked.map((product) => [product.id, product]));

  for (const [id, legacy] of legacyById) {
    const projected = projectedById.get(id);
    assert.ok(projected, `missing projected replay product: ${id}`);
    assert.equal(getProductCategorySlot(projected), getProductCategorySlot(legacy), `${scenario.id}: slot delta for ${id}`);
    assert.equal(projected.score, legacy.score, `${scenario.id}: score delta for ${id}`);
    assert.equal(projected.matched_signals.category_priority, legacy.matched_signals.category_priority, `${scenario.id}: category priority delta for ${id}`);
    assert.equal(projected.score_breakdown.category_priority, legacy.score_breakdown.category_priority, `${scenario.id}: weighted category priority delta for ${id}`);
    assert.equal(projected.score_breakdown.outdoor_sunscreen_bonus, legacy.score_breakdown.outdoor_sunscreen_bonus, `${scenario.id}: sunscreen bonus delta for ${id}`);
  }

  const legacyOrder = legacyRanked.map((product) => product.id);
  const projectedOrder = projectedRanked.map((product) => product.id);
  assert.deepEqual(projectedOrder, legacyOrder, `${scenario.id}: full Recommendation ordering delta`);
  assert.equal(projectedOrder[0], legacyOrder[0], `${scenario.id}: Top1 delta`);
  assert.deepEqual(projectedOrder.slice(0, 3), legacyOrder.slice(0, 3), `${scenario.id}: Top3 delta`);

  replaySummary.push({
    scenario: scenario.id,
    products: legacyOrder.length,
    top1: legacyOrder[0],
    top3: legacyOrder.slice(0, 3),
  });
}

assert.equal(evidence.replay_contract.uses_actual_category_resolver, true);
assert.equal(evidence.replay_contract.uses_actual_recommendation_scoring, true);
assert.equal(evidence.replay_contract.uses_actual_rank_comparator, true);
for (const [key, value] of Object.entries(evidence.replay_contract)) {
  if (key.startsWith("required_") && key.endsWith("_delta")) {
    assert.equal(value, 0, `non-zero required replay delta: ${key}`);
  }
}

assert.deepEqual(evidence.mutation_scope, {
  product: false,
  product_fact: false,
  offer: false,
  recommendation_runtime: false,
  production_business_data: false,
});

console.log(JSON.stringify({
  status: "PASS",
  product_count: evidence.product_count,
  equivalence_class_count: evidence.equivalence_class_count,
  scenarios: replaySummary,
  recommendation_runtime_cutover: evidence.recommendation_runtime_cutover,
}, null, 2));
console.log("DATA-TAXONOMY4 Recommendation shadow parity verified");
