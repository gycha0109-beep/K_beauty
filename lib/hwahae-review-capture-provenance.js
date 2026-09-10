import { createHash } from "node:crypto";

export const HWAHAE_REVIEW_CAPTURE_PROVENANCE_VERSION =
  "hwahae-review-capture-provenance-v1";
export const HWAHAE_REVIEW_CAPTURE_PUBLISHER = "hwahae";
export const HWAHAE_REVIEW_CAPTURE_SOURCE_KIND = "product_review_aggregate";
export const HWAHAE_REVIEW_CAPTURE_DIGEST_ALGORITHM = "sha256";
export const HWAHAE_REVIEW_CAPTURE_DIGEST_SCOPE =
  "captured-review-signal-payload-v1";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canonicalValue(value) {
  if (value === null) return null;
  if (Array.isArray(value)) {
    return value.map((entry) => (entry === undefined ? null : canonicalValue(entry)));
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonicalValue(value[key])])
    );
  }
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  throw new TypeError("HWAHAE_REVIEW_CAPTURE_UNSUPPORTED_CANONICAL_VALUE");
}

export function canonicalizeHwahaeReviewCaptureValue(value) {
  return JSON.stringify(canonicalValue(value));
}

function normalizeLocator(value) {
  const locator = text(value);
  if (!locator) return null;
  try {
    const url = new URL(locator);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}

function normalizeObservedAt(value) {
  const observedAt = text(value);
  if (!observedAt) return null;
  if (!/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(observedAt)) return null;
  const timestamp = Date.parse(observedAt);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function normalizeSourceIdentity(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = text(value.source);
  const sourceType = text(value.source_type ?? value.sourceType);
  const sourceId = text(value.source_id ?? value.sourceId);
  if (source !== HWAHAE_REVIEW_CAPTURE_PUBLISHER || !sourceType || !sourceId) return null;
  return Object.freeze({ source, source_type: sourceType, source_id: sourceId });
}

function normalizeCaptureIdentity({ productId = null, sourceIdentity = null } = {}) {
  const normalizedProductId = text(productId);
  const normalizedSourceIdentity = normalizeSourceIdentity(sourceIdentity);
  const productIdValid = !normalizedProductId || UUID_RE.test(normalizedProductId);
  if (!productIdValid || (!normalizedProductId && !normalizedSourceIdentity)) return null;
  return Object.freeze({
    product_id: normalizedProductId,
    source_identity: normalizedSourceIdentity
  });
}

function payloadUsable(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.review_raw &&
      typeof payload.review_raw === "object" &&
      !Array.isArray(payload.review_raw)
  );
}

function digestMaterial({ captureIdentity, captureSource, payload }) {
  return {
    contract_version: HWAHAE_REVIEW_CAPTURE_PROVENANCE_VERSION,
    capture_identity: captureIdentity,
    capture_source: {
      publisher: captureSource.publisher,
      source_kind: captureSource.source_kind,
      canonical_locator: captureSource.canonical_locator,
      observed_at: captureSource.observed_at,
      digest_algorithm: captureSource.digest_algorithm,
      digest_scope: captureSource.digest_scope
    },
    payload
  };
}

export function computeHwahaeReviewCaptureDigest({ captureIdentity, captureSource, payload }) {
  return createHash("sha256")
    .update(canonicalizeHwahaeReviewCaptureValue(digestMaterial({ captureIdentity, captureSource, payload })))
    .digest("hex");
}

export function buildHwahaeReviewCaptureEnvelope({
  productId = null,
  sourceIdentity = null,
  canonicalLocator,
  observedAt,
  payload
}) {
  const captureIdentity = normalizeCaptureIdentity({ productId, sourceIdentity });
  if (!captureIdentity) throw new Error("HWAHAE_REVIEW_CAPTURE_EXPLICIT_IDENTITY_REQUIRED");
  if (!payloadUsable(payload)) throw new Error("HWAHAE_REVIEW_CAPTURE_REVIEW_SIGNAL_PAYLOAD_REQUIRED");

  const normalizedLocator = normalizeLocator(canonicalLocator);
  if (!normalizedLocator) throw new Error("HWAHAE_REVIEW_CAPTURE_HTTPS_LOCATOR_REQUIRED");
  const normalizedObservedAt = normalizeObservedAt(observedAt);
  if (!normalizedObservedAt) throw new Error("HWAHAE_REVIEW_CAPTURE_OFFSET_TIMESTAMP_REQUIRED");

  const captureSource = {
    publisher: HWAHAE_REVIEW_CAPTURE_PUBLISHER,
    source_kind: HWAHAE_REVIEW_CAPTURE_SOURCE_KIND,
    canonical_locator: normalizedLocator,
    observed_at: normalizedObservedAt,
    digest_algorithm: HWAHAE_REVIEW_CAPTURE_DIGEST_ALGORITHM,
    digest_scope: HWAHAE_REVIEW_CAPTURE_DIGEST_SCOPE
  };
  const contentDigest = computeHwahaeReviewCaptureDigest({
    captureIdentity,
    captureSource,
    payload
  });

  return Object.freeze({
    contract_version: HWAHAE_REVIEW_CAPTURE_PROVENANCE_VERSION,
    productId: captureIdentity.product_id,
    capture_identity: captureIdentity,
    capture_source: Object.freeze({ ...captureSource, content_digest: contentDigest }),
    raw: canonicalValue(payload)
  });
}

export function validateHwahaeReviewCaptureEnvelope(envelope, { now = new Date() } = {}) {
  const errors = [];
  if (envelope?.contract_version !== HWAHAE_REVIEW_CAPTURE_PROVENANCE_VERSION) {
    errors.push("invalid_contract_version");
  }

  const captureIdentity = normalizeCaptureIdentity({
    productId: envelope?.capture_identity?.product_id,
    sourceIdentity: envelope?.capture_identity?.source_identity
  });
  if (!captureIdentity) errors.push("missing_explicit_identity");
  if (text(envelope?.productId) !== captureIdentity?.product_id) {
    errors.push("product_id_identity_mismatch");
  }

  const source = envelope?.capture_source;
  const canonicalLocator = normalizeLocator(source?.canonical_locator);
  const observedAt = normalizeObservedAt(source?.observed_at);
  if (source?.publisher !== HWAHAE_REVIEW_CAPTURE_PUBLISHER) errors.push("invalid_publisher");
  if (source?.source_kind !== HWAHAE_REVIEW_CAPTURE_SOURCE_KIND) errors.push("invalid_source_kind");
  if (!canonicalLocator || canonicalLocator !== source?.canonical_locator) errors.push("invalid_canonical_locator");
  if (!observedAt || observedAt !== source?.observed_at) errors.push("invalid_observed_at");
  if (source?.digest_algorithm !== HWAHAE_REVIEW_CAPTURE_DIGEST_ALGORITHM) {
    errors.push("invalid_digest_algorithm");
  }
  if (source?.digest_scope !== HWAHAE_REVIEW_CAPTURE_DIGEST_SCOPE) errors.push("invalid_digest_scope");
  if (!SHA256_RE.test(text(source?.content_digest) ?? "")) errors.push("invalid_content_digest");
  if (!payloadUsable(envelope?.raw)) errors.push("invalid_review_signal_payload");

  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);
  const observedMs = observedAt ? Date.parse(observedAt) : NaN;
  if (!Number.isFinite(nowMs)) errors.push("invalid_validation_clock");
  else if (Number.isFinite(observedMs) && observedMs > nowMs) errors.push("future_observed_at");

  if (captureIdentity && canonicalLocator && observedAt && payloadUsable(envelope?.raw)) {
    const expectedDigest = computeHwahaeReviewCaptureDigest({
      captureIdentity,
      captureSource: {
        publisher: source?.publisher,
        source_kind: source?.source_kind,
        canonical_locator: canonicalLocator,
        observed_at: observedAt,
        digest_algorithm: source?.digest_algorithm,
        digest_scope: source?.digest_scope
      },
      payload: envelope.raw
    });
    if (text(source?.content_digest)?.toLowerCase() !== expectedDigest) errors.push("content_digest_mismatch");
  }

  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}
