#!/usr/bin/env node
// Pure non-executable D8I policy-A & dual-offer design boundary test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildR16ID8IDualOfferCutoverPreview,
  R16I_D8I_RECOMMENDED_PRICE_POLICY
} from "../../lib/product-intelligence/r16i-d8i-dual-offer-cutover-preview-v1.mjs";
import { buildR16IR4D4LiveReview } from "../../lib/product-offer-r16i-r4-d4-live-review.mjs";
import { buildR16IPriceScopeReview } from "../../lib/product-intelligence/r16i-price-scope-review-v1.mjs";

const fixture = JSON.parse(readFileSync(
  "fixtures/recommendation-metadata/r16i-d8f-candidate-d4-readonly-prestate-20261013.json",
  "utf8"
));
const liveView = buildR16IR4D4LiveReview(fixture.snapshot);
assert.equal(liveView.decision, "REVIEW_REQUIRED");
const evidence = [
  {
    evidenceId: "00000000-0000-4000-8000-000000000001",
    sourceKey: "official_single", selectedOption: "수분크림 80ml 1개",
    claimedCheckoutPrice: 24500, capturedAt: "2026-10-14T00:50:00.000Z"
  },
  {
    evidenceId: "00000000-0000-4000-8000-000000000002",
    sourceKey: "hwahae_bundle", selectedOption: "수분크림 80ml×2 + 세럼 10ml",
    claimedCheckoutPrice: 29900, capturedAt: "2026-10-14T00:50:00.000Z"
  }
];
const verdicts = evidence.map(row => ({
  evidenceId: row.evidenceId, verdict: "VERIFIED"
}));
const review = buildR16IPriceScopeReview({
  view: liveView, evidence, verdicts, nowIso: "2026-10-14T04:00:00.000Z"
});
assert.equal(review.status, "REVIEW_REQUIRED");

const args = { review, liveView };
const plan = buildR16ID8IDualOfferCutoverPreview(args);
assert.equal(plan.status, "DESIGN_READY_OWNER_AND_RELEASE_HOLD");
assert.equal(plan.recommendedPolicy, R16I_D8I_RECOMMENDED_PRICE_POLICY);
assert.equal(plan.policyChoiceRecordedForDesignOnly, null);
assert.equal(plan.expectedNewOfferCount, 2);
assert.equal(plan.productRevisionExpected, liveView.product_revision);
assert.deepEqual(plan.productBeforeExpected, {
  size_ml: 160, price_min: 29900, price_max: 29900,
  unit_price_per_10ml: 1868.75,
  buy_link: "https://www.hwahae.co.kr/goods/45194"
});
assert.deepEqual(plan.afterCandidate, {
  size_ml: 80, price_min: null, price_max: null,
  unit_price_per_10ml: null, buy_link: null
});
assert.deepEqual(plan.offersCandidate.map(row => row.seller_key), ["snature", "hwahae"]);
assert.deepEqual(plan.offersCandidate.map(row => row.source_name),
  ["official_single", "hwahae_bundle"]);
assert.deepEqual(plan.offersCandidate.map(row => row.listing_id), ["151", "45194"]);
assert.deepEqual(plan.offersCandidate.map(row => row.price_amount), [24500, 29900]);
assert.deepEqual(plan.offersCandidate.map(row => row.creamQuantity), [1, 2]);
assert.deepEqual(plan.offersCandidate.map(row => row.giftSerumMl), [0, 10]);
assert(plan.offersCandidate.every(row =>
  row.product_scope_state === "product_subject_unresolved" &&
  row.availability_state === "unknown" &&
  row.link_health_state === "unchecked" &&
  row.purchaseLinkTrusted === false &&
  row.offerInsertAuthorized === false &&
  row.immutableEvidenceBinding === "REQUIRED_NOT_IN_PRICE_REVIEW"
));
assert.equal(plan.reviewPopulationAction, "NO_CHANGE");
assert.equal(plan.sourceBindingsAction, "NO_CHANGE_PENDING_SEPARATE_DECISION");
assert.equal(plan.factSubjectsAction, "NO_CHANGE");
assert.equal(plan.recommendationRankingAction, "NO_CHANGE");
assert.equal(plan.consumerBudgetAlternativeU10, "KNOWN_ONE_SCENARIO_CHANGE");
assert.equal(plan.approvedWriteSet, null);
assert.equal(plan.executableSql, null);
assert.equal(plan.migrationAuthorized, false);
assert.equal(plan.ownerPricePolicyApproved, false);
assert.equal(plan.productionWritesAuthorized, false);
assert.equal(plan.releaseAuthorized, false);
assert.equal(plan.productWrites, 0);
assert.equal(plan.offerWrites, 0);
const designOnly = buildR16ID8IDualOfferCutoverPreview({
  ...args, policyChoice: R16I_D8I_RECOMMENDED_PRICE_POLICY
});
assert.equal(designOnly.status, "DESIGN_READY_OWNER_AND_RELEASE_HOLD");
assert.equal(designOnly.ownerPricePolicyApproved, false);
assert.equal(designOnly.productionWritesAuthorized, false);

const cases = [
  ["MISSING_REVIEW", { ...args, review: null }, "UNVERIFIED_PRICE_SCOPE_REVIEW"],
  ["PRICE_DECISION_SPOOF", { ...args, review: { ...review, status: "APPROVED" } }, "UNVERIFIED_PRICE_SCOPE_REVIEW"],
  ["PRICE_OWNER_SPOOF", { ...args, review: { ...review, ownerPricePolicyApproved: true } }, "UNVERIFIED_PRICE_SCOPE_REVIEW"],
  ["PRICE_APPLY_SPOOF", { ...args, review: { ...review, productionWritesAuthorized: true } }, "UNVERIFIED_PRICE_SCOPE_REVIEW"],
  ["SQL_SPOOF", { ...args, review: { ...review, executableSql: "UPDATE products" } }, "UNVERIFIED_PRICE_SCOPE_REVIEW"],
  ["WRONG_PRODUCT", { ...args, review: { ...review, product: { ...review.product, id: "other" } } }, "UNVERIFIED_PRICE_SCOPE_REVIEW"],
  ["REVISION_DRIFT", { ...args, liveView: { ...liveView, revision_matches: false } }, "UNVERIFIED_OR_STALE_PRODUCT_PRESTATE"],
  ["IDENTITY_DRIFT", { ...args, liveView: { ...liveView, product_id: "other" } }, "UNVERIFIED_OR_STALE_PRODUCT_PRESTATE"],
  ["MISSING_REVISION", { ...args, liveView: { ...liveView, product_revision: null } }, "UNVERIFIED_OR_STALE_PRODUCT_PRESTATE"],
  ["PRICE_PRESTATE_DRIFT", { ...args, liveView: { ...liveView, reviewed_fields: liveView.reviewed_fields.map(row =>
    row.entity === "products" && row.field === "price_min" ? { ...row, before: 24500 } : row
  ) } }, "PRODUCT_PRESTATE_DRIFT"],
  ["SINGLE_SELLER", { ...args, review: { ...review, offerCandidates: review.offerCandidates.slice(0, 1) } }, "EXACT_TWO_DISTINCT_SELLER_OPTIONS_REQUIRED"],
  ["DUPLICATE_SELLER", { ...args, review: { ...review, offerCandidates: [review.offerCandidates[0], review.offerCandidates[0]] } }, "EXACT_TWO_DISTINCT_SELLER_OPTIONS_REQUIRED"],
  ["WRONG_LISTING", { ...args, review: { ...review, offerCandidates: [
    { ...review.offerCandidates[0], listingUrl: "https://snature.kr.evil.example/151" },
    review.offerCandidates[1]
  ] } }, "SELLER_OPTION_OR_CHECKOUT_SCOPE_DRIFT"],
  ["WRONG_SELECTED_OPTION", { ...args, review: { ...review, offerCandidates: [
    review.offerCandidates[0], { ...review.offerCandidates[1], creamQuantity: 1 }
  ] } }, "SELLER_OPTION_OR_CHECKOUT_SCOPE_DRIFT"],
  ["WRONG_OFFICIAL_AMOUNT", { ...args, review: { ...review, offerCandidates: [
    { ...review.offerCandidates[0], offerPriceCandidateKrW: 35000, checkoutAmountKrW: 35000 },
    review.offerCandidates[1]
  ] } }, "PRICE_OBSERVATIONS_DIFFER_FROM_FROZEN_REVIEW"],
  ["UNTRUSTED_TO_TRUSTED", { ...args, review: { ...review, offerCandidates: [
    { ...review.offerCandidates[0], purchaseLinkTrusted: true },
    review.offerCandidates[1]
  ] } }, "SELLER_OPTION_OR_CHECKOUT_SCOPE_DRIFT"],
  ["INSERT_PROMOTION", { ...args, review: { ...review, offerCandidates: [
    { ...review.offerCandidates[0], offerInsertAuthorized: true },
    review.offerCandidates[1]
  ] } }, "SELLER_OPTION_OR_CHECKOUT_SCOPE_DRIFT"],
  ["SRC_ATTESTATION_FABRICATION", { ...args, review: { ...review, sourceUrlReattestedInThisModel: true } }, "UNATTESTED_SOURCE_OR_PRODUCT_SCOPE_PROMOTION"],
  ["B_POLICY", { ...args, policyChoice: "B_OFFER_DERIVED_PRODUCT_PRICE" }, "UNSUPPORTED_OR_UNAPPROVED_CANONICAL_PRICE_POLICY"],
  ["C_POLICY", { ...args, policyChoice: "C_PRODUCT_REFERENCE_PRICE" }, "UNSUPPORTED_OR_UNAPPROVED_CANONICAL_PRICE_POLICY"]
];
for (const [name, input, reason] of cases) {
  const denied = buildR16ID8IDualOfferCutoverPreview(input);
  assert.equal(denied.status, "BLOCKED", name);
  assert.equal(denied.reason, reason, name);
  assert.equal(denied.executableSql, null, name);
  assert.equal(denied.ownerPricePolicyApproved, false, name);
  assert.equal(denied.productionWritesAuthorized, false, name);
  assert.equal(denied.offerWrites, 0, name);
}
// Existing D8D SQL cannot be repurposed as the dual-seller contract.
const legacySql = readFileSync(
  "supabase/migrations/20261012181320_taxonomy_ai_r16i_d8d_transactional_apply_v1.sql",
  "utf8"
);
assert.match(legacySql, /intended_min<>official\.checkout_price_krw/);
assert.match(legacySql, /created_offer\.price_amount<>seller\.checkout_price_krw/);
assert.match(legacySql, /'offerWrites',1/);
assert.match(legacySql, /offer_id uuid NOT NULL UNIQUE/);

console.log(JSON.stringify({
  status: "PASS",
  stage: "R16I_D8I_DUAL_OFFER_CUTOVER_DESIGN_SHADOW",
  pricePolicy: plan.recommendedPolicy,
  offerCandidates: plan.expectedNewOfferCount,
  negativeControls: cases.length,
  approvedWriteSet: null,
  ownerPricePolicyApproved: false,
  sellerCtaAuthority: false,
  productWrites: 0, offerWrites: 0,
  productionReleaseAuthorized: false
}));
