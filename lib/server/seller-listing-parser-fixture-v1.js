import {
  decodeSellerListingCaptureEvidencePayloadV1,
  parseSellerListingCaptureEvidenceV1,
} from "./seller-listing-capture-evidence-v1.js";

export const SELLER_LISTING_PARSER_FIXTURE_VERSION =
  "seller_listing_parser_fixture_v1";

const ROOT_FIELDS = Object.freeze([
  "schema_version",
  "provenance_class",
  "evidence",
]);
const PROVENANCE_CLASSES = new Set(["synthetic_test", "captured_source"]);

export class SellerListingParserFixtureError extends Error {
  constructor(code) {
    super(code);
    this.name = "SellerListingParserFixtureError";
    this.code = code;
  }
}

function fail(code) {
  throw new SellerListingParserFixtureError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactFields(value) {
  if (!isPlainObject(value)) fail("seller_listing_parser_fixture_not_object");

  const expected = new Set(ROOT_FIELDS);
  const missing = ROOT_FIELDS.filter(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  if (missing.length) {
    fail(`seller_listing_parser_fixture_missing_fields:${missing.sort().join(",")}`);
  }

  const unexpected = Object.keys(value).filter((field) => !expected.has(field));
  if (unexpected.length) {
    fail(
      `seller_listing_parser_fixture_unexpected_fields:${unexpected.sort().join(",")}`,
    );
  }
}

function normalizeProvenanceClass(value) {
  if (typeof value !== "string" || !PROVENANCE_CLASSES.has(value)) {
    fail("seller_listing_parser_fixture_invalid_provenance_class");
  }
  return value;
}

export function parseSellerListingParserFixtureV1(input) {
  requireExactFields(input);

  if (input.schema_version !== SELLER_LISTING_PARSER_FIXTURE_VERSION) {
    fail("seller_listing_parser_fixture_invalid_schema_version");
  }

  const provenanceClass = normalizeProvenanceClass(input.provenance_class);
  const evidence = parseSellerListingCaptureEvidenceV1(input.evidence);

  return Object.freeze({
    schema_version: SELLER_LISTING_PARSER_FIXTURE_VERSION,
    provenance_class: provenanceClass,
    evidence,
  });
}

export function admitSellerListingParserFixtureV1(input) {
  const fixture = parseSellerListingParserFixtureV1(input);

  if (fixture.provenance_class !== "captured_source") {
    fail("seller_listing_parser_fixture_not_captured_source");
  }

  const payload = decodeSellerListingCaptureEvidencePayloadV1(fixture.evidence);
  if (payload.byteLength === 0) {
    fail("seller_listing_parser_fixture_empty_payload");
  }

  return fixture;
}

export function decodeAdmittedSellerListingParserFixturePayloadV1(input) {
  const fixture = admitSellerListingParserFixtureV1(input);
  return decodeSellerListingCaptureEvidencePayloadV1(fixture.evidence);
}
