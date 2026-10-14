#!/usr/bin/env node
// Bounded consumer contract regression: no Product price policy/DB writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => {
  throw new Error("R16I_D8H_PRICE_CONSUMER_EXTERNAL_NETWORK_FORBIDDEN");
};

const {
  normalizeKnownProductPrice,
  getKnownProductPriceRange,
  isKnownCheaperProductPrice
} = await import("../../lib/product-price-read-contract.mjs");
const { buildRecommendationProductFromSource } =
  await import("../../lib/product-source.js");

const unknown = [null, undefined, "", "  ", 0, "0", -5,
  "NaN", "Infinity", Infinity, -Infinity, NaN, false, true, [], [30000], {}];
for (const value of unknown) {
  assert.equal(normalizeKnownProductPrice(value), null, "invalid values do not create known price");
  assert.equal(getKnownProductPriceRange(value, null), "", "unknown price has no price band");
  assert.equal(getKnownProductPriceRange(null, value), "", "unknown upper price has no price band");
  assert.equal(isKnownCheaperProductPrice(value, 35000), false);
  assert.equal(isKnownCheaperProductPrice(19000, value), false);
}
const known = [
  [19999, "$"], [20000, "$$"], [24500, "$$"], [29900, "$$"],
  [39999, "$$"], [40000, "$$$"], [35000, "$$"], [45000, "$$$"]
];
for (const [value, expectedBand] of known) {
  assert.equal(normalizeKnownProductPrice(value), value);
  assert.equal(normalizeKnownProductPrice(String(value)), value);
  assert.equal(getKnownProductPriceRange(value, null), expectedBand);
  assert.equal(getKnownProductPriceRange(null, value), expectedBand);
}
assert.equal(getKnownProductPriceRange(24500, 35000), "$$");
assert.equal(getKnownProductPriceRange(24500, 40000), "$$$");
assert.equal(getKnownProductPriceRange(19900, -1), "$");
assert.equal(isKnownCheaperProductPrice(24500, 29900), true);
assert.equal(isKnownCheaperProductPrice(29900, 24500), false);
assert.equal(isKnownCheaperProductPrice(29900, 29900), false);
assert.equal(isKnownCheaperProductPrice(null, null), false);
assert.equal(isKnownCheaperProductPrice(0, 29900), false);
assert.equal(isKnownCheaperProductPrice(24500, null), false);

const catalog = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/products-v1.json", "utf8"
));
assert.equal(catalog.productCount, 164);
const target = catalog.products.find(p =>
  p.id === "b639c8b4-6a61-440e-b4db-fac7381593ff");
assert(target);
const legacy = buildRecommendationProductFromSource(target);
assert(legacy);
assert.equal(legacy.price_min, 29900);
assert.equal(legacy.price_max, 29900);
assert.equal(legacy.price_range, "$$");
const nullProduct = buildRecommendationProductFromSource({
  ...target, size_ml: 80, price_min: null, price_max: null,
  unit_price_per_10ml: null, buy_link: null
});
assert(nullProduct);
assert.equal(nullProduct.price_min, null);
assert.equal(nullProduct.price_max, null);
assert.equal(nullProduct.price_range, "");
assert.equal(nullProduct.buy_link, "");
const oneSidedPrice = buildRecommendationProductFromSource({
  ...target, price_min: null, price_max: 35000
});
assert.equal(oneSidedPrice.price_min, null);
assert.equal(oneSidedPrice.price_max, 35000);
assert.equal(oneSidedPrice.price_range, "$$");

// API field names are deliberately unchanged; serializer uses the same dynamic
// normalization contract. UI already hides absent price bands.
const api = readFileSync("app/api/analyze/route.js", "utf8");
const ui = readFileSync("app/result/page.js", "utf8");
const source = readFileSync("lib/product-source.js", "utf8");
const engine = readFileSync("lib/skin-match-decision-engine-core.js", "utf8");
assert.match(api, /price_min: normalizeKnownProductPrice\(item\?\.price_min\)/);
assert.match(api, /price_max: normalizeKnownProductPrice\(item\?\.price_max\)/);
assert.doesNotMatch(api, /Number\.isFinite\(Number\(item\?\.price_min\)\)/);
assert.match(ui, /function getPriceLabel\(priceRange, locale = "ko"\)/);
assert.match(ui, /if \(!displayRange\) \{\s*return null;/);
assert.match(source, /price_range: getKnownProductPriceRange\(priceMin, priceMax\)/);
assert.match(engine, /isKnownCheaperProductPrice\(\s*product.price_min, topPick\?\.price_min\s*\)/);

console.log(JSON.stringify({
  status: "PASS",
  stage: "R16I_D8H_PRICE_CONSUMER_CONTRACT",
  missingAndInvalidValues: unknown.length,
  knownPriceBoundaries: known.length,
  existingPriceBand: legacy.price_range,
  missingPriceBand: nullProduct.price_range,
  nullApiFieldsPreserved: true,
  budgetCheaperOnlyWhenComparable: true,
  noApiFieldRenames: true,
  productWrites: 0,
  offerWrites: 0,
  pricePolicyApproved: false,
  releaseAuthorized: false
}));
