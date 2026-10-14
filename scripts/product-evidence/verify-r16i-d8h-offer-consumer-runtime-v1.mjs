#!/usr/bin/env node
// R16I D8H OFFLINE consumer-contract shadow. Run with the repository alias loader.
// Synthetic in-memory rows only; never touches a DB, seller, or Production.
import assert from "node:assert/strict";
import {
  selectCurrentProductOffer,
  projectProductWithOfferAuthority,
  projectRecommendationDecisionWithOffers,
  applyProductOfferReadPath
} from "../../lib/product-offer-read-path.js";
import {
  getTrustedDirectPurchaseUrl,
  resolveProductPurchaseLink
} from "../../lib/product-purchase-link.js";

const id = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const officialUrl = "https://www.snature.kr/product/detail.html?product_no=151";
const kitUrl = "https://www.hwahae.co.kr/goods/45194";
const product = Object.freeze({
  id, brand: "에스네이처", name: "아쿠아 스쿠알란 수분크림",
  size_ml: 80, price_min: null, price_max: null,
  unit_price_per_10ml: null, price_range: "", buy_link: null
});
const observedAt = "2026-10-14T03:00:00.000Z";
const common = {
  product_id: id, market_code: "KR", currency_code: "KRW",
  offer_state: "current", availability_state: "unknown",
  product_scope_state: "product_subject_unresolved",
  link_health_state: "unchecked", last_observed_at: observedAt,
  created_at: observedAt
};
const offers = [
  { ...common, offer_id: "offline-official", seller_key: "snature",
    source_name: "official_single", listing_id: "151",
    listing_url: officialUrl, price_amount: 24500 },
  { ...common, offer_id: "offline-kit", seller_key: "hwahae",
    source_name: "hwahae_bundle", listing_id: "45194",
    listing_url: kitUrl, price_amount: 29900 }
];
assert.equal(selectCurrentProductOffer(product, offers), null);
const shadow = projectProductWithOfferAuthority(product, offers);
assert.equal(shadow.buy_link, "");
assert.equal(shadow.price_min, null);
assert.equal(shadow.price_max, null);
assert.equal(shadow.unit_price_per_10ml, null);
assert.equal(shadow.price_range, "");
assert.equal(shadow.size_ml, 80);
assert.deepEqual(offers.map(row => row.price_amount), [24500, 29900]);

// A higher availability flag cannot bootstrap a source/seller trust rule.
for (const override of [
  { availability_state: "in_stock", link_health_state: "healthy" },
  { product_scope_state: "product" },
  { price_amount: 1 },
  { listing_url: "https://www.hwahae.co.kr.evil.test/goods/45194" }
]) {
  const manipulated = offers.map(row => ({ ...row, ...override }));
  assert.equal(selectCurrentProductOffer(product, manipulated), null);
  assert.equal(projectProductWithOfferAuthority(product, manipulated).buy_link, "");
}
assert.equal(getTrustedDirectPurchaseUrl({
  buyLink: officialUrl, brand: product.brand, name: product.name
}), "");
assert.equal(resolveProductPurchaseLink({
  buyLink: officialUrl, brand: product.brand, name: product.name
}).kind, "fallback");
// Hwahae is permitted by the generic direct-URL resolver, not by this
// particular bundle's Product/Offer authority. Preserve that distinction.
assert.equal(resolveProductPurchaseLink({
  buyLink: kitUrl, brand: product.brand, name: product.name
}).kind, "direct");
assert.equal(resolveProductPurchaseLink({
  buyLink: null, brand: product.brand, name: product.name
}).kind, "fallback");

const untrustedLegacy = { ...product, price_min: 29900,
  price_max: 29900, buy_link: kitUrl };
const afterUntrustedOffers = projectProductWithOfferAuthority(untrustedLegacy, offers);
assert.equal(afterUntrustedOffers.buy_link, "");
assert.equal(afterUntrustedOffers.price_min, 29900); // Offers never derive Product price.
assert.equal(afterUntrustedOffers.price_max, 29900);
const decision = { topPick: product, categoryPicks: [product], diagnostics: { ranking: [id] } };
const projected = projectRecommendationDecisionWithOffers(decision, offers);
assert.equal(projected.topPick.price_min, null);
assert.equal(projected.topPick.buy_link, "");
assert.equal(projected.categoryPicks[0].price_max, null);
assert.deepEqual(projected.diagnostics.ranking, [id]);
assert.deepEqual(decision.topPick, product); // Pure projection does not mutate input.
const asynchronouslyProjected = await applyProductOfferReadPath(decision, async ids => {
  assert.deepEqual(ids, [id]);
  return offers;
});
assert.equal(asynchronouslyProjected.topPick.price_min, null);
assert.equal(asynchronouslyProjected.topPick.buy_link, "");
const readFailure = await applyProductOfferReadPath(decision, async () => {
  throw new Error("OFFLINE_SIMULATED_READ_FAILURE");
});
assert.strictEqual(readFailure, decision); // Existing fallback: original decision.
assert.equal(readFailure.topPick.buy_link, null); // Safe ONLY if upstream Product CTA is cleared.

// Known compatibility gaps remain HOLD: a fallback '$$' band may represent
// NULL Product price, and Number(null) can become 0 in premium API serialization.
// These are explicitly NOT claimed as tested or corrected by this shadow.
console.log(JSON.stringify({
  status: "PASS",
  stage: "R16I_D8H_OFFER_CONSUMER_RUNTIME_SHADOW",
  sellerOfferCandidates: offers.length, authorizedOfferSources: 0,
  canonicalPriceProjection: null, directPurchaseFromOffers: false,
  rankingChanged: false, productWrites: 0, offerWrites: 0,
  unresolved: ["NULL_PRICE_RANGE_FALLBACK", "PREMIUM_NULL_NUMERIC_COERCION",
    "READ_FAILURE_RETURNS_ORIGINAL_DECISION", "HWAHAE_GENERIC_URL_NOT_KIT_AUTHORITY"]
}));
