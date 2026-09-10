import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  REVIEW_OBSERVATION_TARGETS,
  buildReviewObservationReadiness,
  summarizeReviewObservationReadiness
} from "../lib/product-evidence-review-observation-readiness.js";

const resolvedSubject = {
  subject_id: "subject-1",
  identity_status: "resolved",
  current_state: "current"
};

const completeSource = {
  canonical_locator: "https://example.test/product/1/reviews",
  publisher: "Example Reviews",
  source_kind: "review_aggregate_snapshot",
  content_digest: "a".repeat(64),
  observed_at: "2026-09-10T00:00:00Z"
};

const item = (reviewRaw, overrides = {}) => ({
  productId: "00000000-0000-4000-8000-000000000001",
  productName: "Example Sunscreen",
  category: "sunscreen",
  review_raw: reviewRaw,
  ...overrides
});

assert.deepEqual(Object.keys(REVIEW_OBSERVATION_TARGETS), [
  "eye_sting_observed",
  "white_cast_observed"
]);

const eyeOccurrence = buildReviewObservationReadiness(
  item(
    { positive: [], negative: [["눈통증있는", 3]] },
    { capture_source: completeSource }
  ),
  { subject: resolvedSubject }
);
const eyeOccurrenceTarget = eyeOccurrence.targets.find((target) => target.factKey === "eye_sting_observed");
assert.equal(eyeOccurrenceTarget.candidateValue, true);
assert.equal(eyeOccurrenceTarget.eligibleForGovernedEvidenceReview, true);
assert.equal(eyeOccurrenceTarget.evidenceAuthorityCeiling, "review_observation");
assert.equal(eyeOccurrenceTarget.prevalenceAuthorized, false);
assert.equal(eyeOccurrenceTarget.prevalenceDenominator, null);
assert.equal(eyeOccurrenceTarget.independentSupport, "unresolved");

const eyeAbsence = buildReviewObservationReadiness(
  item(
    { positive: [["눈통증없는", 65]], negative: [] },
    { capture_source: completeSource }
  ),
  { subject: resolvedSubject }
);
assert.equal(
  eyeAbsence.targets.find((target) => target.factKey === "eye_sting_observed").candidateValue,
  false
);

const whiteCastAbsence = buildReviewObservationReadiness(
  item(
    { positive: [["백탁없는", 104]], negative: [] },
    { capture_source: completeSource }
  ),
  { subject: resolvedSubject }
);
assert.equal(
  whiteCastAbsence.targets.find((target) => target.factKey === "white_cast_observed").candidateValue,
  false
);

const nonspecificSting = buildReviewObservationReadiness(
  item(
    { positive: [], negative: [["따가운", 20]] },
    { capture_source: completeSource }
  ),
  { subject: resolvedSubject }
);
assert.equal(
  nonspecificSting.targets.find((target) => target.factKey === "eye_sting_observed").directObservationPresent,
  false
);
assert(
  nonspecificSting.targets
    .find((target) => target.factKey === "eye_sting_observed")
    .blockers.includes("blocked_missing_direct_observation_label")
);

const conflict = buildReviewObservationReadiness(
  item(
    { positive: [["눈통증없는", 10]], negative: [["눈통증있는", 2]] },
    { capture_source: completeSource }
  ),
  { subject: resolvedSubject }
);
const conflictTarget = conflict.targets.find((target) => target.factKey === "eye_sting_observed");
assert.equal(conflictTarget.candidateValue, null);
assert.equal(conflictTarget.eligibleForGovernedEvidenceReview, false);
assert(conflictTarget.blockers.includes("blocked_conflicting_direct_observation_labels"));

const noCaptureProvenance = buildReviewObservationReadiness(
  item({ positive: [["백탁없는", 20]], negative: [] }),
  { subject: resolvedSubject }
);
const noCaptureTarget = noCaptureProvenance.targets.find(
  (target) => target.factKey === "white_cast_observed"
);
assert.equal(noCaptureTarget.eligibleForGovernedEvidenceReview, false);
for (const blocker of [
  "blocked_missing_capture_locator",
  "blocked_missing_capture_publisher",
  "blocked_missing_capture_source_kind",
  "blocked_missing_capture_digest",
  "blocked_missing_capture_timestamp"
]) {
  assert(noCaptureTarget.blockers.includes(blocker));
}

const unresolvedSubject = buildReviewObservationReadiness(
  item(
    { positive: [["백탁없는", 20]], negative: [] },
    { capture_source: completeSource }
  ),
  { subject: null }
);
assert(
  unresolvedSubject.targets
    .find((target) => target.factKey === "white_cast_observed")
    .blockers.includes("blocked_unresolved_current_subject")
);

const batch = JSON.parse(
  await readFile(
    new URL(
      "../data/hwahae-review-signals/categories/sunscreen/hwahae-sunscreen-review-signals.batch.json",
      import.meta.url
    ),
    "utf8"
  )
);
assert.equal(batch.item_count, 11);
assert.equal(batch.items.length, 11);

const currentDatasetRows = batch.items.map((currentItem) =>
  buildReviewObservationReadiness(currentItem, { subject: resolvedSubject })
);
const currentDatasetSummary = summarizeReviewObservationReadiness(currentDatasetRows);
assert.equal(currentDatasetSummary.products, 11);
assert.equal(currentDatasetSummary.eligibleTargets, 0);
assert(currentDatasetSummary.directObservationTargets > 0);
assert.equal(
  currentDatasetSummary.blockerCounts.blocked_missing_capture_locator,
  currentDatasetSummary.targets
);
assert.equal(
  currentDatasetSummary.blockerCounts.blocked_missing_capture_digest,
  currentDatasetSummary.targets
);
assert.equal(
  currentDatasetSummary.blockerCounts.blocked_missing_capture_timestamp,
  currentDatasetSummary.targets
);

const moduleSource = await readFile(
  new URL("../lib/product-evidence-review-observation-readiness.js", import.meta.url),
  "utf8"
);
const auditSource = await readFile(
  new URL("./audit-product-evidence-review-observation-readiness.mjs", import.meta.url),
  "utf8"
);

for (const forbiddenToken of [
  "confidence_level",
  "estimated_sunscreen_profile",
  "inferred_signal_flags",
  "admin_ingest_product_fact_evidence_v1",
  "admin_confirm_product_fact_current_v1"
]) {
  assert.equal(moduleSource.includes(forbiddenToken), false, `module forbidden token: ${forbiddenToken}`);
  assert.equal(auditSource.includes(forbiddenToken), false, `audit forbidden token: ${forbiddenToken}`);
}

assert.equal(moduleSource.includes('"따가운"'), false);
assert.equal(moduleSource.includes('independentSupport: "multiple"'), false);
assert(moduleSource.includes('independentSupport: "unresolved"'));
assert(moduleSource.includes('prevalenceAuthorized: false'));
assert(auditSource.includes("currentProductHwahaeUrlContextOnly"));
assert.equal(auditSource.includes("captureLocator: product?.hwahae_url"), false);
assert.equal(auditSource.includes("prevalenceDenominator: product"), false);
assert.equal(auditSource.includes(".insert("), false);
assert.equal(auditSource.includes(".update("), false);
assert.equal(auditSource.includes(".upsert("), false);
assert.equal(auditSource.includes(".delete("), false);

console.log(
  "verify-product-evidence-review-observation-readiness: PASS " +
    `dataset_products=${currentDatasetSummary.products} ` +
    `direct_targets=${currentDatasetSummary.directObservationTargets} ` +
    `eligible_targets=${currentDatasetSummary.eligibleTargets} ` +
    "capture_locator_fallback=0 prevalence_claim=0 writes=0"
);
