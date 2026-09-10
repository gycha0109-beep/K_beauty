import { parseSellerListingObservationV1 } from "../seller-listing-observation-v1.js";

export const SELLER_LISTING_CAPTURE_ADAPTER_VERSION = "seller-listing-capture-adapter-v1";

const PARSER_FIELDS = Object.freeze(["listing_id", "price", "availability"]);

export class SellerListingCaptureAdapterError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = "SellerListingCaptureAdapterError";
    this.code = code;
  }
}

function fail(code, cause) {
  throw new SellerListingCaptureAdapterError(code, cause ? { cause } : undefined);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactParserFields(value) {
  if (!isPlainObject(value)) fail("seller_listing_capture_parser_result_not_object");

  const expected = new Set(PARSER_FIELDS);
  const missing = PARSER_FIELDS.filter(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  if (missing.length) {
    fail(`seller_listing_capture_parser_missing_fields:${missing.sort().join(",")}`);
  }

  const unexpected = Object.keys(value).filter((field) => !expected.has(field));
  if (unexpected.length) {
    fail(`seller_listing_capture_parser_unexpected_fields:${unexpected.sort().join(",")}`);
  }

  return value;
}

function normalizeCaptureAuthority({ seller, listing_url, source_version }) {
  const validated = parseSellerListingObservationV1({
    seller,
    listing_id: null,
    listing_url,
    price: null,
    availability: "unknown",
    observed_at: "2000-01-01T00:00:00Z",
    source_version,
  });

  return Object.freeze({
    seller: validated.seller,
    listing_url: validated.listing_url,
    source_version: validated.source_version,
  });
}

export async function captureSellerListingObservationV1(options = {}) {
  const authority = normalizeCaptureAuthority(options);
  const { fetchListing, parseListing, now } = options;

  if (typeof fetchListing !== "function") fail("seller_listing_capture_fetcher_required");
  if (typeof parseListing !== "function") fail("seller_listing_capture_parser_required");
  if (typeof now !== "function") fail("seller_listing_capture_clock_required");

  let payload;
  try {
    payload = await fetchListing(authority.listing_url);
  } catch (error) {
    fail("seller_listing_capture_transport_failed", error);
  }

  let observedAt;
  try {
    observedAt = now();
  } catch (error) {
    fail("seller_listing_capture_clock_failed", error);
  }

  let parsed;
  try {
    parsed = await parseListing(payload);
  } catch (error) {
    if (error instanceof SellerListingCaptureAdapterError) throw error;
    fail("seller_listing_capture_parser_failed", error);
  }

  const sellerValues = requireExactParserFields(parsed);

  return parseSellerListingObservationV1({
    seller: authority.seller,
    listing_id: sellerValues.listing_id,
    listing_url: authority.listing_url,
    price: sellerValues.price,
    availability: sellerValues.availability,
    observed_at: observedAt,
    source_version: authority.source_version,
  });
}
