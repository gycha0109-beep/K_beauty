import assert from "node:assert/strict";
import {
  buildTopPickBundleFromProducts,
  matchesStrictTopPickCategory
} from "../lib/top-pick.ts";

function product(overrides = {}) {
  return {
    id: overrides.id || `${overrides.category || "product"}-${overrides.product_form || "none"}`,
    brand: "Synthetic",
    name: "Synthetic Product",
    category: "toner_essence",
    product_form: null,
    is_kbeauty: true,
    skin_types: ["combination"],
    concerns: ["oiliness"],
    texture: "watery",
    finish: "fresh",
    irritation_risk: "low",
    sensitivity_safe: true,
    ...overrides
  };
}

const treatmentEssence = product({
  id: "treatment-essence",
  category: "treatment",
  product_form: "essence"
});
const tonerEssence = product({
  id: "toner-essence",
  category: "toner_essence",
  product_form: null
});
const legacyEssence = product({
  id: "legacy-essence",
  category: "essence",
  product_form: null
});
const legacyEssenceWithForm = product({
  id: "legacy-essence-form",
  category: "essence",
  product_form: "essence"
});
const legacySerum = product({
  id: "legacy-serum",
  category: "serum",
  product_form: null
});
const legacyAmpoule = product({
  id: "legacy-ampoule",
  category: "ampoule",
  product_form: null
});
const invalidTreatment = product({
  id: "invalid-treatment",
  category: "treatment",
  product_form: null
});
const invalidNonTreatmentForm = product({
  id: "invalid-toner-form",
  category: "toner_essence",
  product_form: "essence"
});
const cleanser = product({
  id: "cleanser",
  category: "cleanser",
  product_form: null
});
const sunscreen = product({
  id: "sunscreen",
  category: "sunscreen",
  product_form: null,
  uv_filter_type: "organic",
  tone_up: false,
  white_cast: "none",
  eye_sting: "low",
  pilling_risk: "low"
});

assert.equal(matchesStrictTopPickCategory("serum", treatmentEssence), true);
assert.equal(matchesStrictTopPickCategory("toner_essence", tonerEssence), true);
assert.equal(matchesStrictTopPickCategory("toner_essence", legacyEssence), false);
assert.equal(matchesStrictTopPickCategory("serum", legacyEssence), false);

for (const unresolved of [
  legacyEssenceWithForm,
  legacySerum,
  legacyAmpoule,
  invalidTreatment,
  invalidNonTreatmentForm
]) {
  for (const category of ["cleanser", "toner_essence", "serum", "moisturizer", "sunscreen"]) {
    assert.equal(matchesStrictTopPickCategory(category, unresolved), false);
  }
}

assert.equal(matchesStrictTopPickCategory("cleanser", cleanser), true);
assert.equal(matchesStrictTopPickCategory("sunscreen", sunscreen), true);

const bundle = buildTopPickBundleFromProducts(
  {
    skinType: "combination",
    sensitivity: "low",
    mainConcern: "oiliness",
    mainConcerns: ["oiliness"],
    preferredTexture: "watery"
  },
  [
    treatmentEssence,
    tonerEssence,
    cleanser,
    sunscreen,
    legacyEssence,
    legacyEssenceWithForm,
    legacySerum,
    legacyAmpoule,
    invalidTreatment,
    invalidNonTreatmentForm
  ],
  { includeAlternative: true }
);

const emittedIds = new Set(bundle.products.map((item) => item.id));
assert.equal(bundle.topPick != null, true);
assert.equal(emittedIds.has("legacy-essence"), false);
assert.equal(emittedIds.has("legacy-essence-form"), false);
assert.equal(emittedIds.has("legacy-serum"), false);
assert.equal(emittedIds.has("legacy-ampoule"), false);
assert.equal(emittedIds.has("invalid-treatment"), false);
assert.equal(emittedIds.has("invalid-toner-form"), false);
assert.equal(
  ["treatment-essence", "toner-essence", "cleanser", "sunscreen"].some((id) => emittedIds.has(id)),
  true
);

console.log("top-pick strict semantics verification passed");
