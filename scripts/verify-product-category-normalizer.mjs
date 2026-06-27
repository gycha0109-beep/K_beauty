import assert from "node:assert/strict";
import {
  getProductFamily,
  getResultSection,
  getRoutineSlot,
  isSupportedCategory,
  normalizeProductCategory,
  resolveProductCategorySemantics
} from "../lib/product-category-normalizer.js";

const expectedPolicies = [
  ["treatment", "treatment", "serum_ampoule", "hydrate-functional", "serum_ampoule"],
  ["serum", "serum", "serum_ampoule", "hydrate-functional", "serum_ampoule"],
  ["ampoule", "ampoule", "serum_ampoule", "hydrate-functional", "serum_ampoule"],
  ["essence", "essence", "toner_essence", "prep", "toner_essence"],
  ["toner_pad", "toner_pad", "toner_essence", "prep", "toner_essence"],
  ["moisturizer_cream", "moisturizer_cream", "moisturizer", "moisturize", "moisturizer"],
  ["cleansing", "cleanser", "cleanser", "cleanse", "cleanser"],
  ["toner", "toner_essence", "toner_essence", "prep", "toner_essence"],
  ["cream", "moisturizer_cream", "moisturizer", "moisturize", "moisturizer"],
  ["lotion", "moisturizer_lotion_emulsion", "moisturizer", "moisturize", "moisturizer"],
  ["emulsion", "moisturizer_lotion_emulsion", "moisturizer", "moisturize", "moisturizer"],
  ["milk", "moisturizer_lotion_emulsion", "moisturizer", "moisturize", "moisturizer"],
  ["fluid", "moisturizer_lotion_emulsion", "moisturizer", "moisturize", "moisturizer"],
  ["gel", "moisturizer_gel", "moisturizer", "moisturize", "moisturizer"],
  ["balm", "moisturizer_balm", "moisturizer", "moisturize", "moisturizer"],
  ["sun", "sunscreen", "sunscreen", "protect", "sunscreen"]
];

for (const [raw, canonicalCategory, productFamily, routineSlot, resultSection] of expectedPolicies) {
  assert.deepEqual(normalizeProductCategory(raw), {
    rawCategory: raw,
    canonicalCategory,
    productFamily,
    routineSlot,
    resultSection,
    unsupported: false
  });
  assert.equal(isSupportedCategory(raw), true);
  assert.equal(getProductFamily(raw), productFamily);
  assert.equal(getRoutineSlot(raw), routineSlot);
  assert.equal(getResultSection(raw), resultSection);
}

assert.equal(getRoutineSlot("treatment", { mode: "am" }), "hydrate");
assert.equal(getRoutineSlot("treatment", { mode: "pm" }), "functional");

assert.deepEqual(normalizeProductCategory("unknown category"), {
  rawCategory: "unknown category",
  canonicalCategory: null,
  productFamily: null,
  routineSlot: null,
  resultSection: null,
  unsupported: true
});
assert.equal(isSupportedCategory("unknown category"), false);
assert.equal(getProductFamily("unknown category"), null);
assert.equal(getRoutineSlot("unknown category"), null);
assert.equal(getResultSection("unknown category"), null);

const expectedStrictSemantics = [
  [
    { category: "treatment", product_form: "serum" },
    {
      rawCategory: "treatment",
      rawProductForm: "serum",
      canonicalCategory: "treatment",
      productForm: "serum",
      productFamily: "serum_ampoule",
      routineSlot: "serum",
      resultSection: "serum_ampoule",
      unsupported: false,
      unresolved: false,
      unresolvedReason: null,
      authorizesRecommendationCategory: true
    }
  ],
  [
    { category: "treatment", product_form: "essence" },
    {
      rawCategory: "treatment",
      rawProductForm: "essence",
      canonicalCategory: "treatment",
      productForm: "essence",
      productFamily: "serum_ampoule",
      routineSlot: "serum",
      resultSection: "serum_ampoule",
      unsupported: false,
      unresolved: false,
      unresolvedReason: null,
      authorizesRecommendationCategory: true
    }
  ],
  [
    { category: "toner_essence", product_form: null },
    {
      rawCategory: "toner_essence",
      rawProductForm: null,
      canonicalCategory: "toner_essence",
      productForm: null,
      productFamily: "toner_essence",
      routineSlot: "prep",
      resultSection: "toner_essence",
      unsupported: false,
      unresolved: false,
      unresolvedReason: null,
      authorizesRecommendationCategory: true
    }
  ]
];

for (const [input, expected] of expectedStrictSemantics) {
  assert.deepEqual(resolveProductCategorySemantics(input), expected);
}

const unresolvedStrictCases = [
  [{ category: "essence", product_form: null }, "legacy_category"],
  [{ category: "essence", product_form: "essence" }, "legacy_category"],
  [{ category: "serum", product_form: null }, "legacy_category"],
  [{ category: "ampoule", product_form: null }, "legacy_category"],
  [{ category: "treatment", product_form: null }, "missing_product_form"],
  [{ category: "treatment", product_form: "unknown" }, "invalid_product_form"],
  [{ category: "toner_essence", product_form: "essence" }, "non_treatment_product_form"],
  [{ category: "unknown category", product_form: null }, "unknown_category"]
];

for (const [input, unresolvedReason] of unresolvedStrictCases) {
  assert.equal(resolveProductCategorySemantics(input).unresolved, true);
  assert.equal(resolveProductCategorySemantics(input).unresolvedReason, unresolvedReason);
  assert.equal(resolveProductCategorySemantics(input).authorizesRecommendationCategory, false);
}

assert.equal(normalizeProductCategory("essence").productFamily, "toner_essence");
assert.equal(resolveProductCategorySemantics({ category: "essence" }).authorizesRecommendationCategory, false);

console.log("product-category-normalizer verification passed");
