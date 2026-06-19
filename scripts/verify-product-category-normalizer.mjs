import assert from "node:assert/strict";
import {
  getProductFamily,
  getResultSection,
  getRoutineSlot,
  isSupportedCategory,
  normalizeProductCategory
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

console.log("product-category-normalizer verification passed");
