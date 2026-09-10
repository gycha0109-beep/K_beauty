import assert from "node:assert/strict";
import {
  SELLER_LISTING_PARSER_FIXTURE_VERSION,
  SellerListingParserFixtureError,
  admitSellerListingParserFixtureV1,
  decodeAdmittedSellerListingParserFixturePayloadV1,
  parseSellerListingParserFixtureV1,
} from "../lib/server/seller-listing-parser-fixture-v1.js";
import {
  SellerListingCaptureEvidenceError,
  createSellerListingCaptureEvidenceV1,
} from "../lib/server/seller-listing-capture-evidence-v1.js";

const URL = "https://example.com/listing/fixture";
const PAYLOAD = Buffer.from("mechanical fixture bytes", "utf8");
const OBSERVED_AT = "2026-09-11T19:30:00+09:00";

function evidence(payload = PAYLOAD) {
  return createSellerListingCaptureEvidenceV1({
    seller: "fixture_seller",
    listing_url: URL,
    source_version: "contract-mechanical-fixture/1",
    observed_at: OBSERVED_AT,
    content_type: "application/octet-stream",
    payload_bytes: payload,
  });
}

function fixture(provenanceClass, overrides = {}) {
  return {
    schema_version: SELLER_LISTING_PARSER_FIXTURE_VERSION,
    provenance_class: provenanceClass,
    evidence: evidence(),
    ...overrides,
  };
}

assert.equal(
  SELLER_LISTING_PARSER_FIXTURE_VERSION,
  "seller_listing_parser_fixture_v1",
);

{
  const parsed = parseSellerListingParserFixtureV1(fixture("synthetic_test"));
  assert.equal(parsed.provenance_class, "synthetic_test");
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.evidence), true);
  await assert.rejects(
    async () => admitSellerListingParserFixtureV1(parsed),
    (error) =>
      error instanceof SellerListingParserFixtureError &&
      error.code === "seller_listing_parser_fixture_not_captured_source",
  );
}

{
  const admitted = admitSellerListingParserFixtureV1(fixture("captured_source"));
  assert.equal(admitted.provenance_class, "captured_source");
  assert.equal(admitted.evidence.seller, "fixture_seller");
  assert.equal(admitted.evidence.listing_url, URL);
  assert.equal(admitted.evidence.observed_at, OBSERVED_AT);
  assert.deepEqual(
    decodeAdmittedSellerListingParserFixturePayloadV1(admitted),
    PAYLOAD,
  );
  assert.deepEqual(Object.keys(admitted).sort(), [
    "evidence",
    "provenance_class",
    "schema_version",
  ]);
}

for (const value of ["synthetic", "live", "captured", "", null, 1]) {
  assert.throws(
    () => parseSellerListingParserFixtureV1(fixture(value)),
    (error) =>
      error instanceof SellerListingParserFixtureError &&
      error.code === "seller_listing_parser_fixture_invalid_provenance_class",
  );
}

assert.throws(
  () =>
    parseSellerListingParserFixtureV1(
      fixture("synthetic_test", { schema_version: "v2" }),
    ),
  (error) =>
    error instanceof SellerListingParserFixtureError &&
    error.code === "seller_listing_parser_fixture_invalid_schema_version",
);

for (const field of ["product_id", "product_subject_id", "offer_id", "price", "availability"]) {
  assert.throws(
    () =>
      parseSellerListingParserFixtureV1({
        ...fixture("synthetic_test"),
        [field]: "forbidden",
      }),
    (error) =>
      error instanceof SellerListingParserFixtureError &&
      error.code === `seller_listing_parser_fixture_unexpected_fields:${field}`,
  );
}

assert.throws(
  () =>
    parseSellerListingParserFixtureV1({
      schema_version: SELLER_LISTING_PARSER_FIXTURE_VERSION,
      provenance_class: "synthetic_test",
    }),
  (error) =>
    error instanceof SellerListingParserFixtureError &&
    error.code === "seller_listing_parser_fixture_missing_fields:evidence",
);

{
  const tampered = evidence();
  const badEvidence = {
    ...tampered,
    payload_sha256: "0".repeat(64),
  };
  assert.throws(
    () =>
      parseSellerListingParserFixtureV1(
        fixture("captured_source", { evidence: badEvidence }),
      ),
    (error) =>
      error instanceof SellerListingCaptureEvidenceError &&
      error.code === "seller_listing_capture_evidence_payload_digest_mismatch",
  );
}

{
  const emptyEvidence = evidence(Buffer.alloc(0));
  assert.throws(
    () =>
      admitSellerListingParserFixtureV1(
        fixture("captured_source", { evidence: emptyEvidence }),
      ),
    (error) =>
      error instanceof SellerListingParserFixtureError &&
      error.code === "seller_listing_parser_fixture_empty_payload",
  );
}

{
  const invalidEvidence = {
    ...evidence(),
    product_id: "forbidden",
  };
  assert.throws(
    () =>
      parseSellerListingParserFixtureV1(
        fixture("captured_source", { evidence: invalidEvidence }),
      ),
    (error) =>
      error instanceof SellerListingCaptureEvidenceError &&
      error.code === "seller_listing_capture_evidence_unexpected_fields:product_id",
  );
}

console.log("seller_listing_parser_fixture_v1: PASS");
