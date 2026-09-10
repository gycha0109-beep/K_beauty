import assert from "node:assert/strict";
import {
  SELLER_LISTING_CAPTURE_ADAPTER_VERSION,
  SellerListingCaptureAdapterError,
  captureSellerListingObservationV1,
} from "../lib/server/seller-listing-capture-adapter-v1.js";
import { SellerListingObservationContractError } from "../lib/seller-listing-observation-v1.js";

const URL = "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001";

function base(overrides = {}) {
  return {
    seller: " oliveyoung ",
    listing_url: ` ${URL} `,
    source_version: " oliveyoung-capture-fixture-v1 ",
    fetchListing: async () => ({ fixture: true }),
    parseListing: async () => ({
      listing_id: "A000000200001",
      price: { amount: 18900, currency: "krw" },
      availability: "in_stock",
    }),
    now: () => "2026-09-11T18:00:00+09:00",
    ...overrides,
  };
}

assert.equal(SELLER_LISTING_CAPTURE_ADAPTER_VERSION, "seller-listing-capture-adapter-v1");

{
  let fetched = 0;
  let parsed = 0;
  let clocked = 0;
  let fetchedUrl = "";
  const observation = await captureSellerListingObservationV1(base({
    fetchListing: async (url) => {
      fetched += 1;
      fetchedUrl = url;
      return { fixture: true };
    },
    parseListing: async (payload) => {
      parsed += 1;
      assert.deepEqual(payload, { fixture: true });
      return { listing_id: "A000000200001", price: { amount: 18900, currency: "krw" }, availability: "in_stock" };
    },
    now: () => {
      clocked += 1;
      return "2026-09-11T18:00:00+09:00";
    },
  }));

  assert.equal(fetched, 1);
  assert.equal(parsed, 1);
  assert.equal(clocked, 1);
  assert.equal(fetchedUrl, URL);
  assert.deepEqual(observation, {
    seller: "oliveyoung",
    listing_id: "A000000200001",
    listing_url: URL,
    price: { amount: 18900, currency: "KRW" },
    availability: "in_stock",
    observed_at: "2026-09-11T18:00:00+09:00",
    source_version: "oliveyoung-capture-fixture-v1",
  });
  assert.equal(Object.isFrozen(observation), true);
}

{
  const observation = await captureSellerListingObservationV1(base({
    parseListing: async () => ({ listing_id: null, price: null, availability: "unknown" }),
  }));
  assert.equal(observation.listing_id, null);
  assert.equal(observation.price, null);
  assert.equal(observation.availability, "unknown");
}

for (const field of ["product_id", "product_subject_id", "offer_id", "seller", "listing_url", "observed_at", "source_version"]) {
  await assert.rejects(
    captureSellerListingObservationV1(base({
      parseListing: async () => ({ listing_id: null, price: null, availability: "unknown", [field]: "forbidden" }),
    })),
    (error) => error instanceof SellerListingCaptureAdapterError && error.code === `seller_listing_capture_parser_unexpected_fields:${field}`,
  );
}

await assert.rejects(
  captureSellerListingObservationV1(base({ parseListing: async () => ({ listing_id: null, price: null }) })),
  (error) => error instanceof SellerListingCaptureAdapterError && error.code === "seller_listing_capture_parser_missing_fields:availability",
);

{
  let fetched = false;
  await assert.rejects(
    captureSellerListingObservationV1(base({ listing_url: "http://example.com/item", fetchListing: async () => { fetched = true; } })),
    (error) => error instanceof SellerListingObservationContractError && error.code === "seller_listing_observation_invalid_listing_url",
  );
  assert.equal(fetched, false);
}

{
  let parsed = false;
  let clocked = false;
  await assert.rejects(
    captureSellerListingObservationV1(base({
      fetchListing: async () => { throw new Error("network"); },
      parseListing: async () => { parsed = true; },
      now: () => { clocked = true; return "2026-09-11T18:00:00+09:00"; },
    })),
    (error) => error instanceof SellerListingCaptureAdapterError && error.code === "seller_listing_capture_transport_failed",
  );
  assert.equal(parsed, false);
  assert.equal(clocked, false);
}

await assert.rejects(
  captureSellerListingObservationV1(base({ now: () => "2026-09-11T18:00:00" })),
  (error) => error instanceof SellerListingObservationContractError && error.code === "seller_listing_observation_invalid_observed_at",
);

await assert.rejects(
  captureSellerListingObservationV1(base({ parseListing: async () => ({ listing_id: null, price: null, availability: "available" }) })),
  (error) => error instanceof SellerListingObservationContractError && error.code === "seller_listing_observation_invalid_availability",
);

console.log("seller_listing_capture_adapter_v1: PASS");
