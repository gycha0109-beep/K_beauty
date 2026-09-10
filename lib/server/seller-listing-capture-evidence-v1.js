import { createHash } from "node:crypto";

export const SELLER_LISTING_CAPTURE_EVIDENCE_VERSION = "seller-listing-capture-evidence-v1";

const CREATE_FIELDS = Object.freeze([
  "seller",
  "listing_url",
  "source_version",
  "observed_at",
  "content_type",
  "payload_bytes",
]);
const SERIALIZED_FIELDS = Object.freeze([
  "seller",
  "listing_url",
  "source_version",
  "observed_at",
  "content_type",
  "payload_sha256",
  "payload_base64",
]);
const OFFSET_AWARE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const SHA256_HEX = /^[0-9a-f]{64}$/;

export class SellerListingCaptureEvidenceError extends Error {
  constructor(code) {
    super(code);
    this.name = "SellerListingCaptureEvidenceError";
    this.code = code;
  }
}

function fail(code) {
  throw new SellerListingCaptureEvidenceError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactFields(value, expectedFields, scope) {
  if (!isPlainObject(value)) fail(`${scope}_not_object`);

  const expected = new Set(expectedFields);
  const missing = expectedFields.filter(
    (field) => !Object.prototype.hasOwnProperty.call(value, field),
  );
  if (missing.length) fail(`${scope}_missing_fields:${missing.sort().join(",")}`);

  const unexpected = Object.keys(value).filter((field) => !expected.has(field));
  if (unexpected.length) fail(`${scope}_unexpected_fields:${unexpected.sort().join(",")}`);
}

function requireTrimmedString(value, field, maxLength) {
  if (typeof value !== "string") fail(`seller_listing_capture_evidence_invalid_${field}`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    fail(`seller_listing_capture_evidence_invalid_${field}`);
  }
  return normalized;
}

function normalizeListingUrl(value) {
  const listingUrl = requireTrimmedString(value, "listing_url", 2048);
  let parsed;
  try {
    parsed = new URL(listingUrl);
  } catch {
    fail("seller_listing_capture_evidence_invalid_listing_url");
  }

  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    fail("seller_listing_capture_evidence_invalid_listing_url");
  }
  return listingUrl;
}

function normalizeObservedAt(value) {
  const observedAt = requireTrimmedString(value, "observed_at", 64);
  if (!OFFSET_AWARE_TIMESTAMP.test(observedAt) || !Number.isFinite(Date.parse(observedAt))) {
    fail("seller_listing_capture_evidence_invalid_observed_at");
  }
  return observedAt;
}

function normalizeContentType(value) {
  if (value === null) return null;
  return requireTrimmedString(value, "content_type", 256);
}

function normalizePayloadBytes(value) {
  if (value instanceof ArrayBuffer) return Buffer.from(new Uint8Array(value));
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }
  fail("seller_listing_capture_evidence_invalid_payload_bytes");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizeAuthority(input) {
  return {
    seller: requireTrimmedString(input.seller, "seller", 80),
    listing_url: normalizeListingUrl(input.listing_url),
    source_version: requireTrimmedString(input.source_version, "source_version", 128),
    observed_at: normalizeObservedAt(input.observed_at),
    content_type: normalizeContentType(input.content_type),
  };
}

export function createSellerListingCaptureEvidenceV1(input) {
  requireExactFields(input, CREATE_FIELDS, "seller_listing_capture_evidence_create");
  const authority = normalizeAuthority(input);
  const bytes = normalizePayloadBytes(input.payload_bytes);
  const payloadBase64 = bytes.toString("base64");

  return Object.freeze({
    ...authority,
    payload_sha256: sha256(bytes),
    payload_base64: payloadBase64,
  });
}

export function parseSellerListingCaptureEvidenceV1(input) {
  requireExactFields(input, SERIALIZED_FIELDS, "seller_listing_capture_evidence");
  const authority = normalizeAuthority(input);

  if (typeof input.payload_base64 !== "string") {
    fail("seller_listing_capture_evidence_invalid_payload_base64");
  }

  let bytes;
  try {
    bytes = Buffer.from(input.payload_base64, "base64");
  } catch {
    fail("seller_listing_capture_evidence_invalid_payload_base64");
  }

  if (bytes.toString("base64") !== input.payload_base64) {
    fail("seller_listing_capture_evidence_invalid_payload_base64");
  }

  if (typeof input.payload_sha256 !== "string" || !SHA256_HEX.test(input.payload_sha256)) {
    fail("seller_listing_capture_evidence_invalid_payload_sha256");
  }

  const computed = sha256(bytes);
  if (computed !== input.payload_sha256) {
    fail("seller_listing_capture_evidence_payload_digest_mismatch");
  }

  return Object.freeze({
    ...authority,
    payload_sha256: computed,
    payload_base64: input.payload_base64,
  });
}

export function decodeSellerListingCaptureEvidencePayloadV1(evidence) {
  const parsed = parseSellerListingCaptureEvidenceV1(evidence);
  return Buffer.from(parsed.payload_base64, "base64");
}
