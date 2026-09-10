import assert from "node:assert/strict";
import {
  SELLER_LISTING_CAPTURE_EVIDENCE_VERSION,
  SellerListingCaptureEvidenceError,
  createSellerListingCaptureEvidenceV1,
  decodeSellerListingCaptureEvidencePayloadV1,
  parseSellerListingCaptureEvidenceV1,
} from "../lib/server/seller-listing-capture-evidence-v1.js";

const URL = "https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000200001";
const EXPECTED_ROOT_KEYS = [
  "seller",
  "listing_url",
  "source_version",
  "observed_at",
  "content_type",
  "payload_sha256",
  "payload_base64",
];

function createInput(overrides = {}) {
  return {
    seller: " oliveyoung ",
    listing_url: ` ${URL} `,
    source_version: " oliveyoung-transport-fixture-v1 ",
    observed_at: "2026-09-11T03:20:00+09:00",
    content_type: " text/html; charset=utf-8 ",
    payload_bytes: Buffer.from("abc", "utf8"),
    ...overrides,
  };
}

function expectEvidenceError(fn, code) {
  assert.throws(
    fn,
    (error) => error instanceof SellerListingCaptureEvidenceError && error.code === code,
  );
}

assert.equal(
  SELLER_LISTING_CAPTURE_EVIDENCE_VERSION,
  "seller-listing-capture-evidence-v1",
);

{
  const evidence = createSellerListingCaptureEvidenceV1(createInput());
  assert.deepEqual(Object.keys(evidence), EXPECTED_ROOT_KEYS);
  assert.deepEqual(evidence, {
    seller: "oliveyoung",
    listing_url: URL,
    source_version: "oliveyoung-transport-fixture-v1",
    observed_at: "2026-09-11T03:20:00+09:00",
    content_type: "text/html; charset=utf-8",
    payload_sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    payload_base64: "YWJj",
  });
  assert.equal(Object.isFrozen(evidence), true);
  assert.deepEqual(decodeSellerListingCaptureEvidencePayloadV1(evidence), Buffer.from("abc"));
  assert.deepEqual(parseSellerListingCaptureEvidenceV1(evidence), evidence);
}

{
  const bytes = Uint8Array.from([0, 255, 1, 2, 128]);
  const evidence = createSellerListingCaptureEvidenceV1(createInput({
    content_type: null,
    payload_bytes: bytes,
  }));
  assert.equal(evidence.content_type, null);
  assert.deepEqual([...decodeSellerListingCaptureEvidencePayloadV1(evidence)], [...bytes]);
}

{
  const arrayBuffer = Uint8Array.from([10, 20, 30]).buffer;
  const evidence = createSellerListingCaptureEvidenceV1(createInput({ payload_bytes: arrayBuffer }));
  assert.deepEqual([...decodeSellerListingCaptureEvidencePayloadV1(evidence)], [10, 20, 30]);
}

{
  const first = createSellerListingCaptureEvidenceV1(createInput());
  const second = createSellerListingCaptureEvidenceV1(createInput());
  const altered = createSellerListingCaptureEvidenceV1(createInput({
    payload_bytes: Buffer.from("abd", "utf8"),
  }));
  assert.equal(first.payload_sha256, second.payload_sha256);
  assert.notEqual(first.payload_sha256, altered.payload_sha256);
}

{
  const empty = createSellerListingCaptureEvidenceV1(createInput({ payload_bytes: new Uint8Array() }));
  assert.equal(empty.payload_base64, "");
  assert.equal(
    empty.payload_sha256,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
}

for (const field of [
  "product_id",
  "product_subject_id",
  "offer_id",
  "listing_id",
  "price",
  "availability",
  "payload_sha256",
  "payload_base64",
]) {
  expectEvidenceError(
    () => createSellerListingCaptureEvidenceV1({ ...createInput(), [field]: "forbidden" }),
    `seller_listing_capture_evidence_create_unexpected_fields:${field}`,
  );
}

expectEvidenceError(
  () => createSellerListingCaptureEvidenceV1({
    ...createInput(),
    listing_url: "http://example.com/item",
  }),
  "seller_listing_capture_evidence_invalid_listing_url",
);
expectEvidenceError(
  () => createSellerListingCaptureEvidenceV1({
    ...createInput(),
    listing_url: "https://user:pass@example.com/item",
  }),
  "seller_listing_capture_evidence_invalid_listing_url",
);
expectEvidenceError(
  () => createSellerListingCaptureEvidenceV1({
    ...createInput(),
    listing_url: "https://example.com/item#fragment",
  }),
  "seller_listing_capture_evidence_invalid_listing_url",
);
expectEvidenceError(
  () => createSellerListingCaptureEvidenceV1({
    ...createInput(),
    observed_at: "2026-09-11T03:20:00",
  }),
  "seller_listing_capture_evidence_invalid_observed_at",
);
expectEvidenceError(
  () => createSellerListingCaptureEvidenceV1({
    ...createInput(),
    payload_bytes: "abc",
  }),
  "seller_listing_capture_evidence_invalid_payload_bytes",
);
expectEvidenceError(
  () => createSellerListingCaptureEvidenceV1({
    ...createInput(),
    content_type: "   ",
  }),
  "seller_listing_capture_evidence_invalid_content_type",
);

{
  const evidence = createSellerListingCaptureEvidenceV1(createInput());
  expectEvidenceError(
    () => parseSellerListingCaptureEvidenceV1({ ...evidence, product_id: "forbidden" }),
    "seller_listing_capture_evidence_unexpected_fields:product_id",
  );
  expectEvidenceError(
    () => parseSellerListingCaptureEvidenceV1({
      ...evidence,
      payload_sha256: "0".repeat(64),
    }),
    "seller_listing_capture_evidence_payload_digest_mismatch",
  );
  expectEvidenceError(
    () => parseSellerListingCaptureEvidenceV1({
      ...evidence,
      payload_base64: Buffer.from("abd").toString("base64"),
    }),
    "seller_listing_capture_evidence_payload_digest_mismatch",
  );
  expectEvidenceError(
    () => parseSellerListingCaptureEvidenceV1({
      ...evidence,
      payload_base64: "YWJj==",
    }),
    "seller_listing_capture_evidence_invalid_payload_base64",
  );
  expectEvidenceError(
    () => parseSellerListingCaptureEvidenceV1({
      ...evidence,
      payload_base64: "!!!!",
    }),
    "seller_listing_capture_evidence_invalid_payload_base64",
  );
  expectEvidenceError(
    () => parseSellerListingCaptureEvidenceV1({
      ...evidence,
      payload_sha256: evidence.payload_sha256.toUpperCase(),
    }),
    "seller_listing_capture_evidence_invalid_payload_sha256",
  );
}

console.log("seller_listing_capture_evidence_v1: PASS");
