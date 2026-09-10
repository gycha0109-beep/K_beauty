import {
  SellerListingCaptureAdapterError,
  captureSellerListingObservationV1,
} from "./seller-listing-capture-adapter-v1.js";
import {
  createSellerListingCaptureEvidenceV1,
  decodeSellerListingCaptureEvidencePayloadV1,
  parseSellerListingCaptureEvidenceV1,
} from "./seller-listing-capture-evidence-v1.js";
import { parseSellerListingObservationV1 } from "../seller-listing-observation-v1.js";

export const SELLER_LISTING_CAPTURE_WITH_EVIDENCE_VERSION =
  "seller-listing-capture-with-evidence-v1";

const TRANSPORT_FIELDS = Object.freeze(["payload_bytes", "content_type"]);

export class SellerListingCaptureWithEvidenceError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = "SellerListingCaptureWithEvidenceError";
    this.code = code;
  }
}

function fail(code, cause) {
  throw new SellerListingCaptureWithEvidenceError(
    code,
    cause ? { cause } : undefined,
  );
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactTransportFields(value) {
  if (!isPlainObject(value)) {
    fail("seller_listing_capture_with_evidence_transport_result_not_object");
  }

  const expected = new Set(TRANSPORT_FIELDS);
  const missing = TRANSPORT_FIELDS.filter(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  if (missing.length) {
    fail(
      `seller_listing_capture_with_evidence_transport_missing_fields:${missing
        .sort()
        .join(",")}`,
    );
  }

  const unexpected = Object.keys(value).filter((field) => !expected.has(field));
  if (unexpected.length) {
    fail(
      `seller_listing_capture_with_evidence_transport_unexpected_fields:${unexpected
        .sort()
        .join(",")}`,
    );
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

function requireFunction(value, code) {
  if (typeof value !== "function") fail(code);
  return value;
}

export async function captureSellerListingObservationWithEvidenceV1(options = {}) {
  const authority = normalizeCaptureAuthority(options);
  const fetchListing = requireFunction(
    options.fetchListing,
    "seller_listing_capture_with_evidence_fetcher_required",
  );
  const parseListing = requireFunction(
    options.parseListing,
    "seller_listing_capture_with_evidence_parser_required",
  );
  const now = requireFunction(
    options.now,
    "seller_listing_capture_with_evidence_clock_required",
  );

  let transport;
  try {
    transport = requireExactTransportFields(
      await fetchListing(authority.listing_url),
    );
  } catch (error) {
    if (error instanceof SellerListingCaptureWithEvidenceError) throw error;
    fail("seller_listing_capture_with_evidence_transport_failed", error);
  }

  let observedAt;
  try {
    observedAt = now();
  } catch (error) {
    fail("seller_listing_capture_with_evidence_clock_failed", error);
  }

  const evidence = parseSellerListingCaptureEvidenceV1(
    createSellerListingCaptureEvidenceV1({
      seller: authority.seller,
      listing_url: authority.listing_url,
      source_version: authority.source_version,
      observed_at: observedAt,
      content_type: transport.content_type,
      payload_bytes: transport.payload_bytes,
    }),
  );
  const verifiedPayload = decodeSellerListingCaptureEvidencePayloadV1(evidence);

  const observation = await captureSellerListingObservationV1({
    seller: authority.seller,
    listing_url: authority.listing_url,
    source_version: authority.source_version,
    fetchListing: async () => Buffer.from(verifiedPayload),
    now: () => evidence.observed_at,
    parseListing: async (payload) => {
      const parserPayload = Buffer.from(payload);
      const parsed = await parseListing(parserPayload, evidence);
      const postParseEvidence = createSellerListingCaptureEvidenceV1({
        seller: authority.seller,
        listing_url: authority.listing_url,
        source_version: authority.source_version,
        observed_at: evidence.observed_at,
        content_type: evidence.content_type,
        payload_bytes: parserPayload,
      });

      if (postParseEvidence.payload_sha256 !== evidence.payload_sha256) {
        throw new SellerListingCaptureAdapterError(
          "seller_listing_capture_parser_mutated_payload",
        );
      }

      return parsed;
    },
  });

  return Object.freeze({ evidence, observation });
}
