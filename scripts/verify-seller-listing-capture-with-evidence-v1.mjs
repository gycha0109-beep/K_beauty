import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  SELLER_LISTING_CAPTURE_WITH_EVIDENCE_VERSION,
  SellerListingCaptureWithEvidenceError,
  captureSellerListingObservationWithEvidenceV1,
} from "../lib/server/seller-listing-capture-with-evidence-v1.js";
import { SellerListingCaptureAdapterError } from "../lib/server/seller-listing-capture-adapter-v1.js";
import { SellerListingCaptureEvidenceError } from "../lib/server/seller-listing-capture-evidence-v1.js";
import { SellerListingObservationContractError } from "../lib/seller-listing-observation-v1.js";

const URL = "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001";
const PAYLOAD = Buffer.from("<html><body>fixture</body></html>", "utf8");
const OBSERVED_AT = "2026-09-11T18:30:00+09:00";

function base(overrides = {}) {
  return {
    seller: " oliveyoung ",
    listing_url: ` ${URL} `,
    source_version: " oliveyoung-capture-fixture-v2 ",
    fetchListing: async () => ({
      payload_bytes: Buffer.from(PAYLOAD),
      content_type: " text/html; charset=utf-8 ",
    }),
    parseListing: async () => ({
      listing_id: "A000000200001",
      price: { amount: 18900, currency: "krw" },
      availability: "in_stock",
    }),
    now: () => OBSERVED_AT,
    ...overrides,
  };
}

assert.equal(
  SELLER_LISTING_CAPTURE_WITH_EVIDENCE_VERSION,
  "seller-listing-capture-with-evidence-v1",
);

{
  const order = [];
  let parserEvidence = null;
  const result = await captureSellerListingObservationWithEvidenceV1(
    base({
      fetchListing: async (url) => {
        order.push("fetch");
        assert.equal(url, URL);
        return {
          payload_bytes: Buffer.from(PAYLOAD),
          content_type: " text/html; charset=utf-8 ",
        };
      },
      now: () => {
        order.push("clock");
        return OBSERVED_AT;
      },
      parseListing: async (payload, evidence) => {
        order.push("parse");
        parserEvidence = evidence;
        assert.equal(Buffer.isBuffer(payload), true);
        assert.deepEqual(payload, PAYLOAD);
        assert.equal(Object.isFrozen(evidence), true);
        assert.equal(
          evidence.payload_sha256,
          createHash("sha256").update(PAYLOAD).digest("hex"),
        );
        return {
          listing_id: "A000000200001",
          price: { amount: 18900, currency: "krw" },
          availability: "in_stock",
        };
      },
    }),
  );

  assert.deepEqual(order, ["fetch", "clock", "parse"]);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.evidence), true);
  assert.equal(Object.isFrozen(result.observation), true);
  assert.equal(parserEvidence, result.evidence);
  assert.deepEqual(Object.keys(result).sort(), ["evidence", "observation"]);
  assert.deepEqual(Object.keys(result.evidence).sort(), [
    "content_type",
    "listing_url",
    "observed_at",
    "payload_base64",
    "payload_sha256",
    "seller",
    "source_version",
  ]);
  assert.deepEqual(result.observation, {
    seller: "oliveyoung",
    listing_id: "A000000200001",
    listing_url: URL,
    price: { amount: 18900, currency: "KRW" },
    availability: "in_stock",
    observed_at: OBSERVED_AT,
    source_version: "oliveyoung-capture-fixture-v2",
  });
  assert.equal(result.evidence.seller, result.observation.seller);
  assert.equal(result.evidence.listing_url, result.observation.listing_url);
  assert.equal(result.evidence.source_version, result.observation.source_version);
  assert.equal(result.evidence.observed_at, result.observation.observed_at);
  assert.equal(result.evidence.content_type, "text/html; charset=utf-8");
  for (const field of [
    "listing_id",
    "price",
    "availability",
    "product_id",
    "product_subject_id",
    "offer_id",
  ]) {
    assert.equal(Object.prototype.hasOwnProperty.call(result.evidence, field), false);
  }
}

{
  const binary = Buffer.from([0x00, 0xff, 0x7f, 0x80, 0x41]);
  let seen = null;
  const result = await captureSellerListingObservationWithEvidenceV1(
    base({
      fetchListing: async () => ({ payload_bytes: binary, content_type: null }),
      parseListing: async (payload) => {
        seen = Buffer.from(payload);
        return { listing_id: null, price: null, availability: "unknown" };
      },
    }),
  );
  assert.deepEqual(seen, binary);
  assert.equal(result.evidence.payload_base64, binary.toString("base64"));
  assert.equal(result.evidence.content_type, null);
  assert.equal(result.observation.listing_id, null);
}

{
  const arrayBuffer = Uint8Array.from([1, 2, 3, 4]).buffer;
  let seen = null;
  await captureSellerListingObservationWithEvidenceV1(
    base({
      fetchListing: async () => ({
        payload_bytes: arrayBuffer,
        content_type: "application/octet-stream",
      }),
      parseListing: async (payload) => {
        seen = Buffer.from(payload);
        return { listing_id: null, price: null, availability: "unknown" };
      },
    }),
  );
  assert.deepEqual(seen, Buffer.from([1, 2, 3, 4]));
}

{
  let parsed = false;
  await assert.rejects(
    captureSellerListingObservationWithEvidenceV1(
      base({
        fetchListing: async () => ({
          payload_bytes: Buffer.from(PAYLOAD),
          content_type: "text/html",
          price: { amount: 1, currency: "KRW" },
        }),
        parseListing: async () => {
          parsed = true;
          return { listing_id: null, price: null, availability: "unknown" };
        },
      }),
    ),
    (error) =>
      error instanceof SellerListingCaptureWithEvidenceError &&
      error.code ===
        "seller_listing_capture_with_evidence_transport_unexpected_fields:price",
  );
  assert.equal(parsed, false);
}

await assert.rejects(
  captureSellerListingObservationWithEvidenceV1(
    base({ fetchListing: async () => Buffer.from(PAYLOAD) }),
  ),
  (error) =>
    error instanceof SellerListingCaptureWithEvidenceError &&
    error.code === "seller_listing_capture_with_evidence_transport_result_not_object",
);

await assert.rejects(
  captureSellerListingObservationWithEvidenceV1(
    base({
      fetchListing: async () => ({ payload_bytes: Buffer.from(PAYLOAD) }),
    }),
  ),
  (error) =>
    error instanceof SellerListingCaptureWithEvidenceError &&
    error.code ===
      "seller_listing_capture_with_evidence_transport_missing_fields:content_type",
);

{
  let parsed = false;
  await assert.rejects(
    captureSellerListingObservationWithEvidenceV1(
      base({
        fetchListing: async () => ({ payload_bytes: "html", content_type: "text/html" }),
        parseListing: async () => {
          parsed = true;
          return { listing_id: null, price: null, availability: "unknown" };
        },
      }),
    ),
    (error) =>
      error instanceof SellerListingCaptureEvidenceError &&
      error.code === "seller_listing_capture_evidence_invalid_payload_bytes",
  );
  assert.equal(parsed, false);
}

{
  let fetched = false;
  await assert.rejects(
    captureSellerListingObservationWithEvidenceV1(
      base({
        listing_url: "http://example.com/item",
        fetchListing: async () => {
          fetched = true;
          return { payload_bytes: Buffer.from(PAYLOAD), content_type: "text/html" };
        },
      }),
    ),
    (error) =>
      error instanceof SellerListingObservationContractError &&
      error.code === "seller_listing_observation_invalid_listing_url",
  );
  assert.equal(fetched, false);
}

await assert.rejects(
  captureSellerListingObservationWithEvidenceV1(
    base({ fetchListing: async () => { throw new Error("network"); } }),
  ),
  (error) =>
    error instanceof SellerListingCaptureWithEvidenceError &&
    error.code === "seller_listing_capture_with_evidence_transport_failed" &&
    error.cause instanceof Error &&
    error.cause.message === "network",
);

{
  let parsed = false;
  await assert.rejects(
    captureSellerListingObservationWithEvidenceV1(
      base({
        now: () => { throw new Error("clock"); },
        parseListing: async () => {
          parsed = true;
          return { listing_id: null, price: null, availability: "unknown" };
        },
      }),
    ),
    (error) =>
      error instanceof SellerListingCaptureWithEvidenceError &&
      error.code === "seller_listing_capture_with_evidence_clock_failed" &&
      error.cause instanceof Error &&
      error.cause.message === "clock",
  );
  assert.equal(parsed, false);
}

{
  let parsed = false;
  await assert.rejects(
    captureSellerListingObservationWithEvidenceV1(
      base({
        now: () => "2026-09-11T18:30:00",
        parseListing: async () => {
          parsed = true;
          return { listing_id: null, price: null, availability: "unknown" };
        },
      }),
    ),
    (error) =>
      error instanceof SellerListingCaptureEvidenceError &&
      error.code === "seller_listing_capture_evidence_invalid_observed_at",
  );
  assert.equal(parsed, false);
}

await assert.rejects(
  captureSellerListingObservationWithEvidenceV1(
    base({ parseListing: async () => { throw new Error("parse"); } }),
  ),
  (error) =>
    error instanceof SellerListingCaptureAdapterError &&
    error.code === "seller_listing_capture_parser_failed" &&
    error.cause instanceof Error &&
    error.cause.message === "parse",
);

await assert.rejects(
  captureSellerListingObservationWithEvidenceV1(
    base({
      parseListing: async () => ({
        listing_id: null,
        price: null,
        availability: "unknown",
        product_id: "forbidden",
      }),
    }),
  ),
  (error) =>
    error instanceof SellerListingCaptureAdapterError &&
    error.code === "seller_listing_capture_parser_unexpected_fields:product_id",
);

await assert.rejects(
  captureSellerListingObservationWithEvidenceV1(
    base({
      parseListing: async (payload) => {
        payload[0] = payload[0] ^ 0xff;
        return { listing_id: null, price: null, availability: "unknown" };
      },
    }),
  ),
  (error) =>
    error instanceof SellerListingCaptureAdapterError &&
    error.code === "seller_listing_capture_parser_mutated_payload",
);

for (const [field, value, code] of [
  ["fetchListing", null, "seller_listing_capture_with_evidence_fetcher_required"],
  ["parseListing", null, "seller_listing_capture_with_evidence_parser_required"],
  ["now", null, "seller_listing_capture_with_evidence_clock_required"],
]) {
  await assert.rejects(
    captureSellerListingObservationWithEvidenceV1(base({ [field]: value })),
    (error) =>
      error instanceof SellerListingCaptureWithEvidenceError && error.code === code,
  );
}

console.log("seller_listing_capture_with_evidence_v1: PASS");
