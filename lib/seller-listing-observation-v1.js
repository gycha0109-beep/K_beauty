export const SELLER_LISTING_OBSERVATION_VERSION = "seller_listing_observation_v1";

const ROOT_FIELDS = Object.freeze([
  "seller",
  "listing_id",
  "listing_url",
  "price",
  "availability",
  "observed_at",
  "source_version"
]);
const PRICE_FIELDS = Object.freeze(["amount", "currency"]);
const AVAILABILITY_STATES = new Set([
  "unknown",
  "in_stock",
  "out_of_stock",
  "discontinued"
]);
const OFFSET_AWARE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

export class SellerListingObservationContractError extends Error {
  constructor(code) {
    super(code);
    this.name = "SellerListingObservationContractError";
    this.code = code;
  }
}

function fail(code) {
  throw new SellerListingObservationContractError(code);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireExactFields(value, expectedFields, scope) {
  if (!isPlainObject(value)) {
    fail(`${scope}_not_object`);
  }

  const expected = new Set(expectedFields);
  const missing = expectedFields.filter((field) => !Object.prototype.hasOwnProperty.call(value, field));
  if (missing.length) {
    fail(`${scope}_missing_fields:${missing.sort().join(",")}`);
  }

  const unexpected = Object.keys(value).filter((field) => !expected.has(field));
  if (unexpected.length) {
    fail(`${scope}_unexpected_fields:${unexpected.sort().join(",")}`);
  }
}

function requireTrimmedString(value, field, maxLength) {
  if (typeof value !== "string") {
    fail(`seller_listing_observation_invalid_${field}`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    fail(`seller_listing_observation_invalid_${field}`);
  }

  return normalized;
}

function normalizeListingId(value) {
  if (value === null) {
    return null;
  }
  return requireTrimmedString(value, "listing_id", 256);
}

function normalizeListingUrl(value) {
  const listingUrl = requireTrimmedString(value, "listing_url", 2048);
  let parsed;

  try {
    parsed = new URL(listingUrl);
  } catch {
    fail("seller_listing_observation_invalid_listing_url");
  }

  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) {
    fail("seller_listing_observation_invalid_listing_url");
  }

  return listingUrl;
}

function normalizePrice(value) {
  if (value === null) {
    return null;
  }

  requireExactFields(value, PRICE_FIELDS, "seller_listing_observation_price");

  if (typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount < 0) {
    fail("seller_listing_observation_invalid_price_amount");
  }

  const currency = requireTrimmedString(value.currency, "price_currency", 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    fail("seller_listing_observation_invalid_price_currency");
  }

  return Object.freeze({
    amount: value.amount,
    currency
  });
}

function normalizeAvailability(value) {
  const availability = requireTrimmedString(value, "availability", 32);
  if (!AVAILABILITY_STATES.has(availability)) {
    fail("seller_listing_observation_invalid_availability");
  }
  return availability;
}

function normalizeObservedAt(value) {
  const observedAt = requireTrimmedString(value, "observed_at", 64);
  if (!OFFSET_AWARE_TIMESTAMP.test(observedAt) || !Number.isFinite(Date.parse(observedAt))) {
    fail("seller_listing_observation_invalid_observed_at");
  }
  return observedAt;
}

export function parseSellerListingObservationV1(input) {
  requireExactFields(input, ROOT_FIELDS, "seller_listing_observation");

  return Object.freeze({
    seller: requireTrimmedString(input.seller, "seller", 80),
    listing_id: normalizeListingId(input.listing_id),
    listing_url: normalizeListingUrl(input.listing_url),
    price: normalizePrice(input.price),
    availability: normalizeAvailability(input.availability),
    observed_at: normalizeObservedAt(input.observed_at),
    source_version: requireTrimmedString(input.source_version, "source_version", 128)
  });
}
