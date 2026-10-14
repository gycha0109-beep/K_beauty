#!/usr/bin/env node
// D8K-1: all test rows synthetic; no DB, network, migrations, or API writes.
import assert from "node:assert/strict";
import { register } from "node:module";
register("../node-next-alias-loader.mjs", import.meta.url);
globalThis.fetch = async () => { throw new Error("D8K1_EXTERNAL_NETWORK_FORBIDDEN"); };
const { buildProductOfferComparison, PREFERRED_SELLER_CHANNELS } =
  await import("../../lib/commerce/product-offer-comparison-v1.mjs");

const id = "b639c8b4-6a61-440e-b4db-fac7381593ff";
const product = Object.freeze({ id, name: "Heartleaf Serum", brand: "Anua",
  price_min: null, price_max: null, buy_link: null, score: 91 });
const nowIso = "2026-10-14T08:00:00.000Z";
const observed = "2026-10-14T07:00:00.000Z";
const dateMs = 2 * 60 * 60 * 1000;
let cases = 0;
function run(offers, options = {}) {
  cases++;
  return buildProductOfferComparison({
    product, admissionState: "admitted", offers, nowIso, maxAgeMs: dateMs, ...options
  });
}
function uuid(n) { return "00000000-0000-4000-8000-" + String(n).padStart(12, "0"); }
function single(override = {}) {
  return {
    offer_id: uuid(1), product_id: id, market_code: "KR", currency_code: "KRW",
    seller_key: "anua", seller_name: "Anua Official", sellerChannel: "official",
    listing_id: "heartleaf", listing_url: "https://anua.com/products/heartleaf-serum",
    source_name: "official_store", offer_state: "current",
    availability_state: "in_stock", product_scope_state: "product",
    evidenceStatus: "verified", sellerIdentityVerified: true,
    optionIdentityVerified: true, compositionVerified: true, priceVerified: true,
    optionIdentity: "anua-serum-80ml-1x", variantId: "anua-serum-80",
    optionKind: "single",
    packComposition: { unitSize: 80, sizeUnit: "ml", quantity: 1, gifts: [] },
    price_amount: 24500, shippingAmount: 0, shippingVerified: true,
    last_observed_at: observed, ctaAuthority: "approved",
    link_health_state: "healthy",
    ...override
  };
}
const official = single();
const olive = single({
  offer_id: uuid(2), seller_key: "oliveyoung", seller_name: "Olive Young",
  sellerChannel: "oliveyoung", listing_id: "A123",
  listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A123",
  optionIdentity: "olive-80-1", price_amount: 22500,
  shippingAmount: 3500
});
const hwahae = single({
  offer_id: uuid(3), seller_key: "hwahae", seller_name: "Hwahae",
  sellerChannel: "hwahae", listing_id: "11111",
  listing_url: "https://www.hwahae.co.kr/goods/11111",
  optionIdentity: "hwahae-80-1", price_amount: 23500
});
const coupang = single({
  offer_id: uuid(4), seller_key: "coupang", seller_name: "Coupang",
  sellerChannel: "coupang", listing_id: "99999",
  listing_url: "https://www.coupang.com/vp/products/99999",
  optionIdentity: "coupang-80-1", price_amount: 22000,
  shippingAmount: null, shippingVerified: false
});
const four = run([official, olive, hwahae, coupang]);
assert.equal(four.status, "options_observed");
assert.deepEqual(PREFERRED_SELLER_CHANNELS, ["official","coupang","oliveyoung","hwahae"]);
assert.equal(four.groups.length, 1);
assert.equal(four.groups[0].offers.length, 4);
assert.equal(four.groups[0].sortBasis, "observed_option_price");
assert.equal(four.groups[0].cheapestBadgeAuthorized, false);
assert.deepEqual(four.groups[0].offers.map(x => x.sellerChannel),
  ["coupang", "oliveyoung", "hwahae", "official"]);
assert.equal(four.groups[0].offers[0].totalPrice, null);
assert.equal(four.groups[0].offers[0].ctaHref, null);
assert.equal(four.groups[0].offers[0].ctaBlockedReason, "DIRECT_LINK_NOT_TRUSTED");
assert.equal(four.groups[0].offers[1].ctaEnabled, true);
assert.equal(four.groups[0].offers[2].ctaEnabled, true);
assert.equal(four.groups[0].offers[3].ctaEnabled, true);
assert.deepEqual(four.excluded, []);

const fullCheckout = run([official, olive, hwahae, {
  ...coupang, shippingAmount: 4000, shippingVerified: true
}]);
assert.equal(fullCheckout.groups[0].sortBasis, "known_total_checkout");
assert.deepEqual(fullCheckout.groups[0].offers.map(x => x.sellerKey),
  ["hwahae", "anua", "coupang", "oliveyoung"]);
assert.equal(fullCheckout.groups[0].offers[0].totalPrice, 23500);
assert.equal(fullCheckout.groups[0].cheapestBadgeAuthorized, false);

const giftKit = single({
  offer_id: uuid(5), seller_key: "hwahae", sellerChannel: "hwahae",
  seller_name: "Hwahae", listing_id: "kit555",
  listing_url: "https://www.hwahae.co.kr/goods/555",
  optionIdentity: "hwahae-kit", optionKind: "kit", price_amount: 29900,
  packComposition: {
    unitSize: 80, sizeUnit: "ml", quantity: 2,
    gifts: [{ skuId: "serum_10ml", quantity: 1 }]
  }
});
const multipack = single({
  offer_id: uuid(6), seller_key: "oliveyoung", sellerChannel: "oliveyoung",
  seller_name: "Olive Young", listing_id: "bundle777",
  listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=B777",
  optionIdentity: "olive-pack2", optionKind: "multipack", price_amount: 28700,
  packComposition: { unitSize: 80, sizeUnit: "ml", quantity: 2, gifts: [] }
});
const bundled = run([giftKit, single(), multipack]);
assert.deepEqual(bundled.groups.map(g => g.optionKind), ["single","multipack","kit"]);
assert(bundled.groups.every(g => g.offers.length === 1));
assert.notEqual(bundled.groups[1].comparisonGroup, bundled.groups[2].comparisonGroup);
assert.equal(bundled.groups[2].packComposition.gifts[0].skuId, "serum_10ml");
const other = run([single({
  offer_id: uuid(7), seller_key: "gmarket", seller_name: "Gmarket",
  sellerChannel: "other", optionIdentity: "gmarket-80-1",
  listing_id: "GM1", listing_url: "https://www.gmarket.co.kr/item?goodscode=1"
})]);
assert.equal(other.groups[0].offers[0].ctaEnabled, false);
assert.equal(other.groups[0].offers[0].ctaBlockedReason, "SELLER_LINK_POLICY_MISSING");

// Safety: no admittance, missing Product ID, no evidence => no offers or CTA.
assert.equal(run([official], { admissionState: "HOLD" }).status, "hold");
assert.equal(run([official], { admissionState: "UNKNOWN" }).groups.length, 0);
assert.equal(run([official], { product: { ...product, id: "" } }).status, "hold");
assert.equal(run([official], { product: { ...product, id: "fake-id" } }).status, "hold");
assert.equal(run([], {}).status, "checking");
assert.equal(run([official], { nowIso: "no-time" }).status, "hold");
assert.equal(run(Array(257).fill(official)).status, "hold");
assert.equal(run([single({ evidenceStatus: "pending" })]).groups.length, 0);
assert.equal(run([single({ product_id: uuid(99) })]).groups.length, 0);

const negative = [
  ["offer_state", "retired", "OFFER_NOT_CURRENT"],
  ["market_code", "US", "MARKET_OR_CURRENCY_UNSUPPORTED"],
  ["currency_code", "USD", "MARKET_OR_CURRENCY_UNSUPPORTED"],
  ["product_scope_state", "product_subject_unresolved", "PRODUCT_SCOPE_UNRESOLVED"],
  ["evidenceStatus", "unverified", "SELLER_OPTION_PRICE_EVIDENCE_MISSING"],
  ["sellerIdentityVerified", false, "SELLER_OPTION_PRICE_EVIDENCE_MISSING"],
  ["optionIdentityVerified", false, "SELLER_OPTION_PRICE_EVIDENCE_MISSING"],
  ["compositionVerified", false, "SELLER_OPTION_PRICE_EVIDENCE_MISSING"],
  ["priceVerified", false, "SELLER_OPTION_PRICE_EVIDENCE_MISSING"],
  ["optionIdentity", "", "OPTION_IDENTITY_INCOMPLETE"],
  ["variantId", null, "OPTION_IDENTITY_INCOMPLETE"],
  ["sellerChannel", "unknown", "OPTION_IDENTITY_INCOMPLETE"],
  ["listing_id", null, "OPTION_IDENTITY_INCOMPLETE"],
  ["price_amount", null, "PRICE_UNVERIFIED_OR_INVALID"],
  ["price_amount", 0, "PRICE_UNVERIFIED_OR_INVALID"],
  ["price_amount", -100, "PRICE_UNVERIFIED_OR_INVALID"],
  ["price_amount", "24500", "PRICE_UNVERIFIED_OR_INVALID"],
  ["price_amount", Infinity, "PRICE_UNVERIFIED_OR_INVALID"],
  ["last_observed_at", "invalid", "PRICE_TIME_INVALID"],
  ["last_observed_at", "2026-10-15T10:00:00Z", "PRICE_TIME_INVALID"],
  ["last_observed_at", "2026-10-10T10:00:00Z", "PRICE_OBSERVATION_STALE"],
  ["shippingAmount", -1, "SHIPPING_AMOUNT_INVALID"],
  ["shippingVerified", false, "SHIPPING_EVIDENCE_MISSING"]
];
for (const [field, bad, reason] of negative) {
  const output = run([single({ [field]: bad })]);
  assert.equal(output.groups.length, 0, field);
  assert.equal(output.excluded[0]?.reason, reason, field);
}
for (const [optionKind, packComposition] of [
  ["single", { unitSize: 80, sizeUnit: "ml", quantity: 2, gifts: [] }],
  ["multipack", { unitSize: 80, sizeUnit: "ml", quantity: 1, gifts: [] }],
  ["kit", { unitSize: 80, sizeUnit: "ml", quantity: 2, gifts: [] }]
]) {
  const output = run([single({ optionKind, packComposition })]);
  assert.equal(output.excluded[0].reason, "PACKAGE_KIND_CONFLICT");
}
for (const packComposition of [
  { unitSize: 80, sizeUnit: "ml", quantity: 1 },
  { unitSize: 80, sizeUnit: "ml", quantity: 1, gifts: [{ skuId: "unknown", quantity: 0 }] },
  { unitSize: 80, sizeUnit: "ml", quantity: 1, gifts: [{ skuId: "x", quantity: 1 },{ skuId: "x", quantity: 1 }] },
  { unitSize: 80, sizeUnit: "invalid", quantity: 1, gifts: [] }
]) {
  const output = run([single({ packComposition })]);
  assert.equal(output.excluded[0].reason, "OPTION_IDENTITY_INCOMPLETE");
}
// Prices may be shown only as observed evidence, even when links aren't clickable.
for (const [override, reason] of [
  [{ ctaAuthority: "proposed" }, "CTA_NOT_APPROVED"],
  [{ link_health_state: "unchecked" }, "LINK_HEALTH_NOT_VERIFIED"],
  [{ availability_state: "unknown" }, "STOCK_NOT_VERIFIED"],
  [{ availability_state: "out_of_stock" }, "STOCK_NOT_VERIFIED"],
  [{ listing_url: "javascript:alert(1)" }, "DIRECT_LINK_NOT_TRUSTED"],
  [{ listing_url: "https://anua.com.evil.test/products/fake" }, "DIRECT_LINK_NOT_TRUSTED"],
  [{ listing_url: "https://user@anua.com/products/fake" }, "DIRECT_LINK_NOT_TRUSTED"],
  [{ listing_url: "http://anua.com/products/fake" }, "DIRECT_LINK_NOT_TRUSTED"],
  [{ seller_key: "fakeofficial" }, "DIRECT_LINK_NOT_TRUSTED"]
]) {
  const output = run([single(override)]);
  assert.equal(output.groups[0].offers[0].ctaHref, null);
  assert.equal(output.groups[0].offers[0].ctaBlockedReason, reason);
}
// Older source prices remain date-labelled; no arbitrary freshness claim.
const historical = run([single({ last_observed_at: "2026-01-01T00:00:00Z" })],
  { maxAgeMs: null });
assert.equal(historical.groups[0].offers[0].priceFreshness, "not_assessed");
assert.equal(historical.groups[0].cheapestBadgeAuthorized, false);
assert.equal(run([official], { maxAgeMs: 0 }).status, "hold");
// Duplicate listing/option, duplicated offer IDs and URL collisions all deny all.
for (const dup of [
  [single(), single({ offer_id: uuid(8) })],
  [single(), single({ listing_id: "different", optionIdentity: "new", listing_url: official.listing_url, offer_id: uuid(9) })],
  [single(), single({ listing_id: "different", optionIdentity: "new", listing_url: "https://anua.com/products/alternate", offer_id: uuid(1) })]
]) {
  const result = run(dup);
  assert.equal(result.groups.length, 0);
  assert.deepEqual(result.excluded.map(x => x.reason),
    ["DUPLICATE_LISTING_OR_OPTION","DUPLICATE_LISTING_OR_OPTION"]);
}
const original = JSON.stringify([product, official, olive, hwahae, coupang]);
run([official, olive, hwahae, coupang]);
assert.equal(JSON.stringify([product, official, olive, hwahae, coupang]), original);
const reverse = run([coupang, hwahae, olive, official]);
assert.deepEqual(reverse.groups, four.groups);
assert.equal(four.rankingChanged, false);
assert.equal(four.productWrites, 0);
assert.equal(four.offerWrites, 0);
assert.equal(four.productionReleaseAuthorized, false);
// Actual legacy rows have NO option/shipping/source verification fields.
// They MUST NOT bypass the new Evidence-to-Offer authority step.
const oldDbShape = run([{
  offer_id: uuid(21), product_id: id, seller_key: "hwahae",
  seller_name: "Hwahae", source_name: "hwahae_bundle",
  listing_id: "45194", listing_url: "https://www.hwahae.co.kr/goods/45194",
  price_amount: 29900, currency_code: "KRW", market_code: "KR",
  availability_state: "unknown", offer_state: "current",
  product_scope_state: "product_subject_unresolved",
  last_observed_at: observed
}]);
assert.equal(oldDbShape.groups.length, 0);
assert.equal(oldDbShape.excluded[0].reason, "PRODUCT_SCOPE_UNRESOLVED");

console.log(JSON.stringify({
  status: "PASS", stage: "D8K1_FOUR_SELLER_OPTION_COMPARISON_SHADOW",
  cases, channels: PREFERRED_SELLER_CHANNELS,
  comparableFourSellerCount: four.groups[0].offers.length,
  kitVsSingleSeparated: true, priceMissingDoesNotBecomeZero: true,
  duplicateListingsFailClosed: true, untrustedLinksBlocked: true,
  cheapestBadgeAuthorized: false, actualSellerDataAttested: false,
  sourceDbMigrationNeededForOptions: true,
  changedApiFields: false, rankingChanged: false,
  productWrites: 0, offerWrites: 0, productionReleaseAuthorized: false
}));
