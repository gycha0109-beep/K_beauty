#!/usr/bin/env node
// D8F-prep: exact connected-candidate DB R16I D4 reader replay, offline only.
// A frozen read-only prestate is NOT proof of deployed runtime DB identity,
// verified checkout, owner approval, or Production application authorization.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildR16IR4D4LiveReview,
  R16I_PRODUCT_ID,
  R16I_RETAIL_URL
} from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";

const evidence = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json",
  "utf8"
));
assert.equal(evidence.schema, "r16i-d8f-candidate-d4-readonly-prestate-20261013-v1");
assert.equal(evidence.provenance, "CONNECTED_SUPABASE_CANDIDATE_READONLY_SELECT");
assert.equal(evidence.serverDbIdentity, "UNATTESTED");
assert.equal(evidence.checkoutEvidence, "NOT_PROVIDED");
assert.equal(evidence.ownerApproval, "NOT_GRANTED");
assert.equal(evidence.productionMutationAuthority, false);
assert(Number.isFinite(Date.parse(evidence.captured_at)));

const baseline = evidence.snapshot;
assert.equal(baseline.observed_at, evidence.captured_at);
assert.equal(baseline.product?.id, R16I_PRODUCT_ID);
assert.equal(baseline.product?.buy_link, R16I_RETAIL_URL);
assert.equal(baseline.product?.size_ml, 160);
assert.equal(baseline.product?.price_min, 29900);
assert.equal(baseline.product?.price_max, 29900);
assert.equal(baseline.product?.unit_price_per_10ml, 1868.75);
assert.equal(baseline.bindings.length, 1);
assert.equal(baseline.intakes.length, 1);
for (const key of ["offers_by_product", "offers_by_listing", "offers_by_url", "subjects"]) {
  assert.deepEqual(baseline[key], []);
}
const result = buildR16IR4D4LiveReview(baseline);
assert.equal(result.decision, "REVIEW_REQUIRED");
assert.equal(result.live_read_verified, true);
assert.equal(result.revision_matches, true);
assert.equal(result.collision_free, true);
assert.equal(result.product_revision, baseline.product.updated_at);
assert.equal(result.product_anchor_reused, true);
assert.equal(result.single_presentation_ml, 80);
assert.equal(result.bundle_cream_ml, 160);
assert.equal(result.separate_serum_ml, 10);
assert.equal(result.reviewed_fields.length, 20);
assert(result.reviewed_fields.every(row =>
  row.after === null &&
  row.decision === "OPERATOR_REVIEW_REQUIRED" &&
  row.source_evidence_confirmed === false &&
  row.field_approved === false &&
  row.write_authorized === false
));
assert(result.missing_evidence.length >= 2);
assert.equal(result.proposed_offer?.price_amount, null);
assert.equal(result.proposed_offer?.insert_authorized, false);
for (const key of [
  "operator_decision", "approved_after_values", "write_set", "executable_sql",
  "rollback_sql", "current_live_checkout_price", "current_verified_review_count"
]) {
  assert.equal(result[key], null, key);
}
for (const key of [
  "release_ready", "production_writes_authorized", "offer_writes_authorized",
  "subject_writes_authorized", "ranking_writes_authorized"
]) {
  assert.equal(result[key], false, key);
}

const clone = () => structuredClone(baseline);
const negatives = [
  ["PRODUCT_UPDATED_AT_STALE", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.updated_at = "2026-10-12T00:00:00Z";
  }],
  ["PRODUCT_VOLUME_DRIFT", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.size_ml = 80;
  }],
  ["PRODUCT_BUNDLE_PRICE_REASSIGNED", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.price_min = 24500;
  }],
  ["PRODUCT_UNIT_PRICE_MISMATCH", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.unit_price_per_10ml = 3737.5;
  }],
  ["PRODUCT_PURCHASE_SOURCE_CHANGED", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.buy_link = "https://www.snature.kr/product/detail.html?product_no=151";
  }],
  ["PRODUCT_REVIEW_POPULATION_CHANGED", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.market_signals.review_count += 1;
  }],
  // Publicly indexed seller displays are diagnostic only, never Product price/review authority.
  ["PUBLIC_OFFICIAL_SINGLE_LIST_PRICE_UNVERIFIED", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.price_min = 35000;
  }],
  ["PUBLIC_OFFICIAL_SINGLE_MEMBER_PRICE_UNVERIFIED", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.price_max = 24500;
  }],
  ["PUBLIC_RETAILER_REVIEW_COUNT_NOT_PRODUCT_AUTHORITY", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.market_signals.review_count = 43652;
  }],
  ["PRODUCT_IDENTITY_CHANGED", "PRODUCT_LEGACY_STATE_OR_REVISION_DRIFT", v => {
    v.product.id = "00000000-0000-4000-8000-000000000001";
  }],
  ["BINDING_SOURCE_DRIFT", "SOURCE_BINDING_DRIFT", v => {
    v.bindings[0].external_id = "35905";
  }],
  ["BINDING_REVISION_STALE", "SOURCE_BINDING_DRIFT", v => {
    v.bindings[0].updated_at = "2026-10-12T00:00:00Z";
  }],
  ["TRUST_INTAKE_UPGRADED", "TRUST_INTAKE_DRIFT", v => {
    v.intakes[0].trust_state = "APPROVED";
  }],
  ["TRUST_SUBJECT_PREMATURE", "TRUST_INTAKE_DRIFT", v => {
    v.intakes[0].subject_id = "00000000-0000-4000-8000-000000000001";
  }],
  ["OFFER_COLLISION", "OFFER_LISTING_OR_SUBJECT_COLLISION", v => {
    v.offers_by_listing.push({offer_id:"synthetic-collision"});
  }],
  ["OFFER_URL_COLLISION", "OFFER_LISTING_OR_SUBJECT_COLLISION", v => {
    v.offers_by_url.push({offer_id:"synthetic-url-collision"});
  }],
  ["SUBJECT_COLLISION", "OFFER_LISTING_OR_SUBJECT_COLLISION", v => {
    v.subjects.push({subject_id:"synthetic-subject"});
  }],
  ["INCOMPLETE_READ", "MISSING_TRUSTED_LIVE_READ", v => {
    delete v.intakes;
  }],
  ["INVALID_OBSERVED_AT", "MISSING_TRUSTED_LIVE_READ", v => {
    v.observed_at = "not-a-timestamp";
  }]
];
for (const [name, expectedReason, mutate] of negatives) {
  const input = clone();
  mutate(input);
  const denied = buildR16IR4D4LiveReview(input);
  assert.equal(denied.decision, "BLOCKED", name);
  assert(denied.reasons.includes(expectedReason), name);
  assert.equal(denied.release_ready, false, name);
  assert.equal(denied.production_writes_authorized, false, name);
  assert.equal(denied.offer_writes_authorized, false, name);
  assert.equal(denied.subject_writes_authorized, false, name);
  assert.equal(denied.ranking_writes_authorized, false, name);
  assert.equal(denied.write_set, null, name);
}

// Re-run D8C proof-selection and OWNER-decision fail-closed contract in the
// existing D8F offline CI job. This exercises no database connection or writes.
await import("./verify-barrier-support-p1-r16i-r4-d8c-correction-approval-v1.mjs");

console.log(JSON.stringify({
  status: "PASS",
  stage: "R16I_R4_D8F_CONNECTED_CANDIDATE_DB_PRESTATE_READONLY",
  capturedAt: evidence.captured_at,
  productId: R16I_PRODUCT_ID,
  baselineDecision: result.decision,
  verifiedBaselineFieldRows: result.reviewed_fields.length,
  verifiedNegativeCases: negatives.length,
  negativeCaseNames: negatives.map(([name]) => name),
  candidateDatabaseNotDeployedRuntimeAttestation: true,
  checkoutEvidence: "NOT_VERIFIED",
  ownerApproval: "NOT_GRANTED",
  releaseReady: false,
  productionProductWrites: 0,
  productionOfferWrites: 0,
  productionReleaseGateChanges: 0
}, null, 2));
