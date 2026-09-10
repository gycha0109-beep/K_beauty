import assert from "node:assert/strict";
import {
  SELLER_LISTING_OBSERVATION_VERSION,
  SellerListingObservationContractError,
  parseSellerListingObservationV1
} from "../lib/seller-listing-observation-v1.js";

const VALID = Object.freeze({
  seller: "oliveyoung",
  listing_id: "A000000200001",
  listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001",
  price: Object.freeze({ amount: 18900, currency: "KRW" }),
  availability: "in_stock",
  observed_at: "2026-09-11T01:45:30+09:00",
  source_version: "oliveyoung-detail-observer/1.0.0"
});

function expectReject(overrides, code) {
  assert.throws(
    () => parseSellerListingObservationV1({ ...VALID, ...overrides }),
    (error) => error instanceof SellerListingObservationContractError && error.code === code
  );
}

assert.equal(SELLER_LISTING_OBSERVATION_VERSION, "seller_listing_observation_v1");

{
  const parsed = parseSellerListingObservationV1(VALID);
  assert.deepEqual(parsed, VALID);
  assert.ok(Object.isFrozen(parsed));
  assert.ok(Object.isFrozen(parsed.price));
  assert.deepEqual(Object.keys(parsed), [
    "seller",
    "listing_id",
    "listing_url",
    "price",
    "availability",
    "observed_at",
    "source_version"
  ]);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "product_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "product_subject_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "offer_id"), false);
}

{
  const parsed = parseSellerListingObservationV1({
    ...VALID,
    price: null,
    availability: "unknown"
  });
  assert.equal(parsed.price, null);
  assert.equal(parsed.availability, "unknown");
}

{
  const parsed = parseSellerListingObservationV1({
    ...VALID,
    listing_id: null
  });
  assert.equal(parsed.listing_id, null);
}

for (const availability of ["unknown", "in_stock", "out_of_stock", "discontinued"]) {
  assert.equal(parseSellerListingObservationV1({ ...VALID, availability }).availability, availability);
}

assert.throws(
  () => parseSellerListingObservationV1({ ...VALID, product_id: "product-a" }),
  (error) =>
    error instanceof SellerListingObservationContractError &&
    error.code === "seller_listing_observation_unexpected_fields:product_id"
);
assert.throws(
  () => parseSellerListingObservationV1({ ...VALID, product_subject_id: "subject-a" }),
  (error) =>
    error instanceof SellerListingObservationContractError &&
    error.code === "seller_listing_observation_unexpected_fields:product_subject_id"
);
assert.throws(
  () => parseSellerListingObservationV1({ ...VALID, offer_id: "offer-a" }),
  (error) =>
    error instanceof SellerListingObservationContractError &&
    error.code === "seller_listing_observation_unexpected_fields:offer_id"
);
assert.throws(
  () => {
    const { observed_at: _removed, ...missingObservedAt } = VALID;
    parseSellerListingObservationV1(missingObservedAt);
  },
  (error) =>
    error instanceof SellerListingObservationContractError &&
    error.code === "seller_listing_observation_missing_fields:observed_at"
);

expectReject({ listing_url: "http://www.oliveyoung.co.kr/item" }, "seller_listing_observation_invalid_listing_url");
expectReject({ listing_url: "https://user:pass@example.com/item" }, "seller_listing_observation_invalid_listing_url");
expectReject({ listing_url: "https://example.com/item#reviews" }, "seller_listing_observation_invalid_listing_url");
expectReject({ observed_at: "2026-09-11T01:45:30" }, "seller_listing_observation_invalid_observed_at");
expectReject({ observed_at: "not-a-date" }, "seller_listing_observation_invalid_observed_at");
expectReject({ availability: "available" }, "seller_listing_observation_invalid_availability");
expectReject({ price: { amount: -1, currency: "KRW" } }, "seller_listing_observation_invalid_price_amount");
expectReject({ price: { amount: 18900, currency: "KR" } }, "seller_listing_observation_invalid_price_currency");
expectReject({ price: { amount: 18900, currency: "KRW", product_id: "product-a" } }, "seller_listing_observation_price_unexpected_fields:product_id");
expectReject({ source_version: " " }, "seller_listing_observation_invalid_source_version");

console.log("seller_listing_observation_v1: PASS");
