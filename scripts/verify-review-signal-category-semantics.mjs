import assert from "node:assert/strict";
import {
  getReviewSignalCategoryFamily,
  resolveReviewSignalCategoryFamilyForProduct
} from "../lib/review-signals.js";

const expectedFamilies = [
  [{ category: "treatment", product_form: "serum" }, "serum_ampoule"],
  [{ category: "treatment", product_form: "essence" }, "serum_ampoule"],
  [{ category: "toner_essence", product_form: null }, "toner"]
];

for (const [input, expectedFamily] of expectedFamilies) {
  assert.equal(resolveReviewSignalCategoryFamilyForProduct(input), expectedFamily);
  assert.equal(
    getReviewSignalCategoryFamily(input.category, { product_form: input.product_form }),
    expectedFamily
  );
}

const unresolvedFamilies = [
  { category: "essence", product_form: null },
  { category: "essence", product_form: "essence" },
  { category: "serum", product_form: null },
  { category: "ampoule", product_form: null },
  { category: "treatment", product_form: null },
  { category: "treatment", product_form: "unknown" },
  { category: "toner_essence", product_form: "essence" },
  { category: "unknown category", product_form: null }
];

for (const input of unresolvedFamilies) {
  assert.equal(resolveReviewSignalCategoryFamilyForProduct(input), null);
  assert.equal(
    getReviewSignalCategoryFamily(input.category, { product_form: input.product_form }),
    null
  );
}

console.log("review-signal category semantics verification passed");
