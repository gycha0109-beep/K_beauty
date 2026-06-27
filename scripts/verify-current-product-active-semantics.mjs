import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CANONICAL_CURRENT_PRODUCT_CATEGORIES,
  buildCurrentProductRoutineSlots,
  isLegacyCurrentProductCategory,
  normalizeCanonicalCurrentProductCategory,
  resolveCurrentProductSemantics
} from "../lib/current-products.js";
import { resolveProductCategorySemantics } from "../lib/product-category-normalizer.js";

function selectedProduct(category, productForm = null) {
  return {
    category,
    status: "selected",
    productId: `${category}-${productForm || "none"}`,
    productSnapshot: {
      id: `${category}-${productForm || "none"}`,
      brand: "Test",
      name: "Synthetic",
      category,
      product_form: productForm || ""
    }
  };
}

function assertNoRoutinePlacement(selection, label) {
  const slots = buildCurrentProductRoutineSlots([selection], "en");

  assert.equal(slots.am.prep.length, 0, `${label}: no AM prep slot`);
  assert.equal(slots.pm.prep.length, 0, `${label}: no PM prep slot`);
  assert.equal(slots.am.hydrate.length, 0, `${label}: no AM treatment slot`);
  assert.equal(slots.pm.functional.length, 0, `${label}: no PM treatment slot`);
}

{
  const slots = buildCurrentProductRoutineSlots([selectedProduct("treatment", "essence")], "en");

  assert.equal(slots.am.hydrate.length, 1, "treatment essence fills AM treatment slot");
  assert.equal(slots.pm.functional.length, 1, "treatment essence fills PM treatment slot");
  assert.equal(slots.am.hydrate[0].category, "treatment");
}

{
  const slots = buildCurrentProductRoutineSlots([selectedProduct("toner_essence")], "en");

  assert.equal(slots.am.prep.length, 1, "toner_essence fills AM prep slot");
  assert.equal(slots.pm.prep.length, 1, "toner_essence fills PM prep slot");
  assert.equal(slots.am.prep[0].category, "toner_essence");
}

assertNoRoutinePlacement(selectedProduct("essence"), "legacy essence");
assertNoRoutinePlacement(selectedProduct("serum"), "legacy serum");
assertNoRoutinePlacement(selectedProduct("ampoule"), "legacy ampoule");
assertNoRoutinePlacement(selectedProduct("treatment"), "treatment without form");
assertNoRoutinePlacement(selectedProduct("toner_essence", "essence"), "non-treatment with form");

assert.equal(resolveCurrentProductSemantics(selectedProduct("treatment", "essence")).resultSection, "serum_ampoule");
assert.equal(resolveCurrentProductSemantics(selectedProduct("toner_essence")).resultSection, "toner_essence");
assert.equal(resolveCurrentProductSemantics(selectedProduct("essence")), null);

assert(CANONICAL_CURRENT_PRODUCT_CATEGORIES.includes("treatment"), "canonical treatment is available");
assert(CANONICAL_CURRENT_PRODUCT_CATEGORIES.includes("toner_essence"), "canonical toner_essence is available");
assert(!CANONICAL_CURRENT_PRODUCT_CATEGORIES.includes("essence"), "legacy essence is not canonical");
assert(!CANONICAL_CURRENT_PRODUCT_CATEGORIES.includes("serum"), "legacy serum is not canonical");
assert(!CANONICAL_CURRENT_PRODUCT_CATEGORIES.includes("ampoule"), "legacy ampoule is not canonical");

assert.equal(normalizeCanonicalCurrentProductCategory("treatment"), "treatment");
assert.equal(normalizeCanonicalCurrentProductCategory("toner_essence"), "toner_essence");
assert.equal(normalizeCanonicalCurrentProductCategory("essence"), "");
assert.equal(isLegacyCurrentProductCategory("essence"), true);
assert.equal(isLegacyCurrentProductCategory("serum"), true);
assert.equal(isLegacyCurrentProductCategory("ampoule"), true);

assert.equal(
  resolveProductCategorySemantics({ category: "treatment", product_form: "essence" }).resultSection,
  "serum_ampoule",
  "prompt semantics: treatment essence has serum/treatment family"
);
assert.equal(
  resolveProductCategorySemantics({ category: "toner_essence", product_form: null }).resultSection,
  "toner_essence",
  "prompt semantics: toner_essence has toner family"
);
assert.equal(
  resolveProductCategorySemantics({ category: "essence", product_form: null }).authorizesRecommendationCategory,
  false,
  "prompt semantics: legacy essence has no canonical family"
);
assert.equal(
  resolveProductCategorySemantics({ category: "serum", product_form: null }).authorizesRecommendationCategory,
  false,
  "prompt semantics: legacy serum has no canonical family"
);
assert.equal(
  resolveProductCategorySemantics({ category: "ampoule", product_form: null }).authorizesRecommendationCategory,
  false,
  "prompt semantics: legacy ampoule has no canonical family"
);
assert.equal(
  resolveProductCategorySemantics({ category: "treatment", product_form: null }).authorizesRecommendationCategory,
  false,
  "prompt semantics: treatment without form has no canonical family"
);
assert.equal(
  resolveProductCategorySemantics({ category: "toner_essence", product_form: "essence" }).authorizesRecommendationCategory,
  false,
  "prompt semantics: non-treatment with form has no canonical family"
);

const selectorSource = readFileSync("components/current-products/CurrentProductsSelector.jsx", "utf8");
assert(selectorSource.includes('legacyCategories: ["essence"]'), "selector preserves legacy saved essence mapping");
assert(selectorSource.includes('legacyCategories: ["serum", "ampoule"]'), "selector preserves legacy saved treatment mapping");
assert(!selectorSource.includes('categories: ["toner_essence", "toner_pad", "essence"]'), "selector does not offer legacy essence as canonical group category");
assert(!selectorSource.includes('categories: ["serum", "ampoule", "treatment"]'), "selector does not offer legacy serum/ampoule as canonical group categories");
assert(selectorSource.includes("resolveCurrentProductSemantics(product)?.canonicalCategory"), "selector groups product options through strict semantics");

const apiSource = readFileSync("app/api/current-products/products/route.js", "utf8");
assert(apiSource.includes("normalizeCanonicalCurrentProductCategory"), "API uses canonical category normalization");
assert(apiSource.includes("isLegacyCurrentProductCategory"), "API handles legacy category queries explicitly");
assert(apiSource.includes("products: []"), "API returns controlled empty products for legacy queries");

const analyzeSource = readFileSync("app/api/analyze/route.js", "utf8");
assert(analyzeSource.includes("resolveProductCategorySemantics"), "analyze route uses strict category semantics");
assert(analyzeSource.includes("product_form: product.product_form || product.productForm ||"), "analyze context carries product_form");
assert(!analyzeSource.includes("import { getResultSection }"), "analyze route does not import display category normalizer for prompt context");
assert(!analyzeSource.includes("getPromptCategoryFamily(product.category)"), "analyze prompt family is product-form aware");

console.log("current-product active strict semantics verified");
