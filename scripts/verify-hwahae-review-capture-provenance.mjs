import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  HWAHAE_REVIEW_CAPTURE_DIGEST_SCOPE,
  HWAHAE_REVIEW_CAPTURE_PROVENANCE_VERSION,
  buildHwahaeReviewCaptureEnvelope,
  validateHwahaeReviewCaptureEnvelope
} from "../lib/hwahae-review-capture-provenance.js";
import {
  buildReviewObservationReadiness,
  extractReviewCaptureProvenance
} from "../lib/product-evidence-review-observation-readiness.js";

const payload = {
  productId: "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
  review_raw: {
    positive: [["눈통증없는", 12]],
    negative: [["백탁있는", 5]]
  },
  market_raw: { review_count: 120, rating: 4.5 }
};

const envelope = buildHwahaeReviewCaptureEnvelope({
  productId: "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
  sourceIdentity: { source: "hwahae", source_type: "goods", source_id: "12345" },
  canonicalLocator: "https://www.hwahae.co.kr/goods/12345",
  observedAt: "2026-09-10T08:00:00Z",
  payload
});

assert.equal(envelope.contract_version, HWAHAE_REVIEW_CAPTURE_PROVENANCE_VERSION);
assert.equal(envelope.capture_source.publisher, "hwahae");
assert.equal(envelope.capture_source.source_kind, "product_review_aggregate");
assert.equal(envelope.capture_source.digest_algorithm, "sha256");
assert.equal(envelope.capture_source.digest_scope, HWAHAE_REVIEW_CAPTURE_DIGEST_SCOPE);
assert.match(envelope.capture_source.content_digest, /^[0-9a-f]{64}$/);
assert.deepEqual(validateHwahaeReviewCaptureEnvelope(envelope, { now: new Date("2026-09-10T09:00:00Z") }), {
  valid: true,
  errors: []
});

const readiness = buildReviewObservationReadiness(envelope, {
  subject: {
    subject_id: "10000000-0000-4000-8000-000000000001",
    identity_status: "resolved",
    current_state: "current"
  }
});
const readinessByFact = Object.fromEntries(readiness.targets.map((target) => [target.factKey, target]));
assert.equal(readinessByFact.eye_sting_observed.eligibleForGovernedEvidenceReview, true);
assert.equal(readinessByFact.eye_sting_observed.candidateValue, false);
assert.equal(readinessByFact.white_cast_observed.eligibleForGovernedEvidenceReview, true);
assert.equal(readinessByFact.white_cast_observed.candidateValue, true);
for (const target of readiness.targets) {
  assert.equal(target.prevalenceAuthorized, false);
  assert.equal(target.prevalenceDenominator, null);
  assert.equal(target.independentSupport, "unresolved");
  assert.equal(target.evidenceAuthorityCeiling, "review_observation");
}

const mutated = structuredClone(envelope);
mutated.raw.review_raw.positive[0][1] = 13;
const mutatedValidation = validateHwahaeReviewCaptureEnvelope(mutated, {
  now: new Date("2026-09-10T09:00:00Z")
});
assert.equal(mutatedValidation.valid, false);
assert(mutatedValidation.errors.includes("content_digest_mismatch"));

const missingLocator = structuredClone(envelope);
missingLocator.capture_source.canonical_locator = null;
const missingLocatorValidation = validateHwahaeReviewCaptureEnvelope(missingLocator, {
  now: new Date("2026-09-10T09:00:00Z")
});
assert.equal(missingLocatorValidation.valid, false);
assert(missingLocatorValidation.errors.includes("invalid_canonical_locator"));

const wrongPublisher = structuredClone(envelope);
wrongPublisher.capture_source.publisher = "unknown";
const wrongPublisherValidation = validateHwahaeReviewCaptureEnvelope(wrongPublisher, {
  now: new Date("2026-09-10T09:00:00Z")
});
assert.equal(wrongPublisherValidation.valid, false);
assert(wrongPublisherValidation.errors.includes("invalid_publisher"));

const wrongSourceKind = structuredClone(envelope);
wrongSourceKind.capture_source.source_kind = "review_page_guess";
const wrongSourceKindValidation = validateHwahaeReviewCaptureEnvelope(wrongSourceKind, {
  now: new Date("2026-09-10T09:00:00Z")
});
assert.equal(wrongSourceKindValidation.valid, false);
assert(wrongSourceKindValidation.errors.includes("invalid_source_kind"));

const badDigest = structuredClone(envelope);
badDigest.capture_source.content_digest = "a".repeat(64);
const badDigestValidation = validateHwahaeReviewCaptureEnvelope(badDigest, {
  now: new Date("2026-09-10T09:00:00Z")
});
assert.equal(badDigestValidation.valid, false);
assert(badDigestValidation.errors.includes("content_digest_mismatch"));

const future = structuredClone(envelope);
future.capture_source.observed_at = "2026-09-10T10:00:00.000Z";
const futureValidation = validateHwahaeReviewCaptureEnvelope(future, {
  now: new Date("2026-09-10T09:00:00Z")
});
assert.equal(futureValidation.valid, false);
assert(futureValidation.errors.includes("future_observed_at"));

const sourceIdentityOnly = buildHwahaeReviewCaptureEnvelope({
  sourceIdentity: { source: "hwahae", source_type: "products", source_id: "source-only-1" },
  canonicalLocator: "https://www.hwahae.co.kr/products/source-only-1",
  observedAt: "2026-09-10T08:00:00Z",
  payload
});
assert.equal(sourceIdentityOnly.productId, null);
assert.equal(
  validateHwahaeReviewCaptureEnvelope(sourceIdentityOnly, { now: new Date("2026-09-10T09:00:00Z") }).valid,
  true
);

assert.throws(
  () =>
    buildHwahaeReviewCaptureEnvelope({
      canonicalLocator: "https://www.hwahae.co.kr/goods/12345",
      observedAt: "2026-09-10T08:00:00Z",
      payload
    }),
  /EXPLICIT_IDENTITY_REQUIRED/
);
assert.throws(
  () =>
    buildHwahaeReviewCaptureEnvelope({
      productId: "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
      canonicalLocator: "http://www.hwahae.co.kr/goods/12345",
      observedAt: "2026-09-10T08:00:00Z",
      payload
    }),
  /HTTPS_LOCATOR_REQUIRED/
);
assert.throws(
  () =>
    buildHwahaeReviewCaptureEnvelope({
      productId: "0bb742d2-df6b-49a7-8e29-8f76ae62ac0d",
      canonicalLocator: "https://www.hwahae.co.kr/goods/12345",
      observedAt: "2026-05-10T13:48:32",
      payload
    }),
  /OFFSET_TIMESTAMP_REQUIRED/
);

const historicalBatch = JSON.parse(
  await readFile(
    new URL(
      "../data/hwahae-review-signals/categories/sunscreen/hwahae-sunscreen-review-signals.batch.json",
      import.meta.url
    ),
    "utf8"
  )
);
assert.equal(historicalBatch.item_count, 11);
for (const item of historicalBatch.items) {
  assert.equal(item.capture_source, undefined);
  const provenance = extractReviewCaptureProvenance(item);
  assert.equal(provenance.canonicalLocator, null);
  assert.equal(provenance.contentDigest, null);
  assert.equal(provenance.observedAt, null);
}

const helperSource = await readFile(
  new URL("../lib/hwahae-review-capture-provenance.js", import.meta.url),
  "utf8"
);
const readinessSource = await readFile(
  new URL("../lib/product-evidence-review-observation-readiness.js", import.meta.url),
  "utf8"
);
for (const forbidden of ["products.hwahae_url", "review_count /", "confidenceScore", "trustScore"]) {
  assert.equal(helperSource.includes(forbidden), false, `forbidden capture shortcut: ${forbidden}`);
  assert.equal(readinessSource.includes(forbidden), false, `forbidden readiness shortcut: ${forbidden}`);
}
for (const forbiddenDbAccess of ["@supabase", "createClient(", ".from(", ".insert(", ".upsert(", ".delete("]) {
  assert.equal(
    helperSource.includes(forbiddenDbAccess),
    false,
    `capture helper must not access database authority: ${forbiddenDbAccess}`
  );
}
assert(readinessSource.includes('prevalenceAuthorized: false'));
assert(readinessSource.includes('independentSupport: "unresolved"'));

for (const scorerPath of ["../lib/recommendation-scoring.ts", "../lib/skin-match-decision-engine.js"]) {
  const scorerSource = await readFile(new URL(scorerPath, import.meta.url), "utf8");
  assert.equal(
    scorerSource.includes("hwahae-review-capture-provenance"),
    false,
    `${scorerPath}: capture provenance must not enter recommendation semantics`
  );
}

console.log(
  "verify-hwahae-review-capture-provenance: PASS " +
    "capture_contract=1 historical_backfill=0 locator_fallback=0 prevalence_claim=0 " +
    "ranking_integration=0 writes=0"
);
