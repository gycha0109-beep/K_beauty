import assert from "node:assert/strict";
import { buildRecommendationProductFromSource } from "../lib/product-source.js";
import {
  getProductCategorySlot,
  scoreCanonicalProduct
} from "../lib/recommendation-scoring.ts";
import { resolveDecisionProductSlot } from "../lib/skin-match-decision-engine.js";

function sourceProduct(overrides = {}) {
  return {
    id: overrides.id || `${overrides.category || "product"}-${overrides.product_form || "none"}`,
    brand: "Synthetic",
    name: "Synthetic Product",
    category: "toner_essence",
    product_form: null,
    concerns: ["oiliness"],
    skin_types: ["combination"],
    texture: "watery",
    finish: "fresh",
    irritation_risk: "low",
    sensitivity_safe: true,
    ...overrides
  };
}

const treatmentEssence = buildRecommendationProductFromSource(sourceProduct({
  id: "treatment-essence",
  category: "treatment",
  product_form: "essence"
}));
assert.equal(treatmentEssence.category, "treatment");
assert.equal(treatmentEssence.product_form, "essence");
assert.equal(treatmentEssence.category_family, "serum_ampoule");
assert.equal(treatmentEssence.recommendation_slot, "serum");

const tonerEssence = buildRecommendationProductFromSource(sourceProduct({
  id: "toner-essence",
  category: "toner_essence",
  product_form: null
}));
assert.equal(tonerEssence.category, "toner_essence");
assert.equal(tonerEssence.product_form, null);
assert.equal(tonerEssence.category_family, "toner_essence");
assert.equal(tonerEssence.recommendation_slot, "prep");

assert.equal(buildRecommendationProductFromSource(sourceProduct({
  category: "essence",
  product_form: null
})), null);
assert.equal(buildRecommendationProductFromSource(sourceProduct({
  category: "essence",
  product_form: "essence"
})), null);
assert.equal(buildRecommendationProductFromSource(sourceProduct({
  category: "treatment",
  product_form: null
})), null);

const answers = {
  skinType: "combination",
  sensitivity: "low",
  mainConcern: "oiliness",
  mainConcerns: ["oiliness"],
  preferredTexture: "watery"
};
const treatmentSerum = sourceProduct({
  category: "treatment",
  product_form: "serum"
});
const legacyEssence = sourceProduct({
  category: "essence",
  product_form: null
});
const legacySerum = sourceProduct({
  category: "serum",
  product_form: null
});
const legacyAmpoule = sourceProduct({
  category: "ampoule",
  product_form: null
});

assert.equal(getProductCategorySlot(treatmentEssence), "serum");
assert.equal(getProductCategorySlot(treatmentSerum), "serum");
assert.equal(getProductCategorySlot(tonerEssence), "toner_essence");
assert.equal(getProductCategorySlot(legacyEssence), "");
assert.equal(getProductCategorySlot(legacySerum), "");
assert.equal(getProductCategorySlot(legacyAmpoule), "");

assert.equal(
  scoreCanonicalProduct(treatmentEssence, answers).matched_signals.category_priority,
  scoreCanonicalProduct(treatmentSerum, answers).matched_signals.category_priority
);
assert.equal(scoreCanonicalProduct(treatmentEssence, answers).matched_signals.category_priority, 4);
assert.equal(scoreCanonicalProduct(tonerEssence, answers).matched_signals.category_priority, 2);
assert.equal(scoreCanonicalProduct(legacyEssence, answers).matched_signals.category_priority, 0);
assert.equal(scoreCanonicalProduct(legacySerum, answers).matched_signals.category_priority, 0);
assert.equal(scoreCanonicalProduct(legacyAmpoule, answers).matched_signals.category_priority, 0);

assert.equal(resolveDecisionProductSlot(treatmentEssence), "serum");
assert.equal(resolveDecisionProductSlot(tonerEssence), "toner_essence");
assert.equal(resolveDecisionProductSlot(legacyEssence), "");
assert.equal(resolveDecisionProductSlot(sourceProduct({
  category: "treatment",
  product_form: "unknown"
})), "");

console.log("recommendation strict semantics verification passed");
