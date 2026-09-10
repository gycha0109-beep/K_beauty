import assert from "node:assert/strict";
import {
  SELLER_LISTING_OBSERVATION_PERSISTENCE_VERSION,
  buildSellerListingObservationInsertV1
} from "../lib/server/seller-listing-observation-persistence-v1.js";
import { SellerListingObservationContractError } from "../lib/seller-listing-observation-v1.js";

const VALID = Object.freeze({
  seller: "oliveyoung",
  listing_id: "A000000200001",
  listing_url: "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001",
  price: Object.freeze({ amount: 18900, currency: "krw" }),
  availability: "in_stock",
  observed_at: "2026-09-11T17:30:00+09:00",
  source_version: "oliveyoung-listing-capture-v1"
});

function expectContractFailure(overrides, codePrefix) {
  assert.throws(
    () => buildSellerListingObservationInsertV1({ ...VALID, ...overrides }),
    (error) =>
      error instanceof SellerListingObservationContractError &&
      error.code.startsWith(codePrefix)
  );
}

assert.equal(
  SELLER_LISTING_OBSERVATION_PERSISTENCE_VERSION,
  "seller-listing-observation-persistence-v1"
);

{
  const row = buildSellerListingObservationInsertV1(VALID);
  assert.deepEqual(row, {
    seller: "oliveyoung",
    listing_id: "A000000200001",
    listing_url: VALID.listing_url,
    price_amount: 18900,
    price_currency: "KRW",
    availability: "in_stock",
    observed_at: "2026-09-11T17:30:00+09:00",
    source_version: "oliveyoung-listing-capture-v1"
  });
  assert.equal(Object.isFrozen(row), true);
  assert.deepEqual(Object.keys(row), [
    "seller",
    "listing_id",
    "listing_url",
    "price_amount",
    "price_currency",
    "availability",
    "observed_at",
    "source_version"
  ]);
  assert.equal(Object.hasOwn(row, "product_id"), false);
  assert.equal(Object.hasOwn(row, "product_subject_id"), false);
  assert.equal(Object.hasOwn(row, "offer_id"), false);
  assert.equal(Object.hasOwn(row, "observation_id"), false);
  assert.equal(Object.hasOwn(row, "created_at"), false);
}

{
  const row = buildSellerListingObservationInsertV1({
    ...VALID,
    listing_id: null,
    price: null,
    availability: "unknown"
  });
  assert.equal(row.listing_id, null);
  assert.equal(row.price_amount, null);
  assert.equal(row.price_currency, null);
  assert.equal(row.availability, "unknown");
}

for (const availability of ["unknown", "in_stock", "out_of_stock", "discontinued"]) {
  assert.equal(
    buildSellerListingObservationInsertV1({ ...VALID, availability }).availability,
    availability
  );
}

for (const forbiddenIdentity of ["product_id", "product_subject_id", "offer_id"]) {
  expectContractFailure(
    { [forbiddenIdentity]: "forbidden" },
    `seller_listing_observation_unexpected_fields:${forbiddenIdentity}`
  );
}

expectContractFailure(
  { observed_at: "2026-09-11T17:30:00" },
  "seller_listing_observation_invalid_observed_at"
);
expectContractFailure(
  { listing_url: "http://www.oliveyoung.co.kr/product/A000000200001" },
  "seller_listing_observation_invalid_listing_url"
);
expectContractFailure(
  { price: { amount: -1, currency: "KRW" } },
  "seller_listing_observation_invalid_price_amount"
);
expectContractFailure(
  { price: { amount: 18900, currency: "WON" } },
  "seller_listing_observation_invalid_price_currency"
);

console.log("seller_listing_observation_persistence_v1: PASS");
