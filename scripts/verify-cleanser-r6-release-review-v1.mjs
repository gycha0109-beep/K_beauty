#!/usr/bin/env node
import assert from "node:assert/strict";
import {evaluateCleanserR6ReleaseReviewV1 as review}
  from "../lib/trust/cleanser-r6-release-review-v1.mjs";
const nothing=review();
assert.equal(nothing.decision,"RELEASE_REVIEW_HOLD");
assert.equal(nothing.checks_supplied,0);
assert.equal(nothing.checks_required,12);
assert.equal(nothing.missing.length,12);
assert.equal(nothing.deployment_authorized,false);
assert.equal(nothing.production_grant_authorized,false);
assert.equal(nothing.canary_activated,false);
assert.equal(nothing.database_writes,0);
// Prior work: R0 preserved, R1 tests, and R5 164x12 pass;
// real official authority / R4 full v1/v2 live / goldset/canary pending.
const current=review({evidence:{
  exact_ten_existing_product_ids_preserved:true,
  frozen_164_by_12_semantics_verified:true,
  physical_unit_and_bundle_goldset_reviewed:false,
  official_source_snapshots_and_sku_reviewed:false,
  subject_identity_and_cross_size_formulation_reviewed:false,
  facts_and_recommendation_metadata_governed:false,
  v1_v2_exact_live_ten_product_diff_reviewed:false,
  independent_goldset_no_false_subject_or_offer_links:false,
  database_rls_api_security_review_approved:false,
  canary_cohort_and_stop_switch_tested:false,
  rollback_replay_and_observability_tested:false,
  explicit_protected_g2_governance_approval:false
}});
assert.equal(current.decision,"RELEASE_REVIEW_HOLD");
assert.equal(current.checks_supplied,2);
assert.equal(current.missing.length,10);
for(const key of ["R2_OFFICIAL_SKU_SOURCE","R4_LIVE_PREFLIGHT_DIFF",
  "R6_CANARY_KILL_SWITCH","R6_G2_GOVERNANCE_APPROVAL"])
  assert.ok(current.missing.includes(key));
// Even an idealized all-true checklist is NOT a grant.
const all=Object.fromEntries([
  "exact_ten_existing_product_ids_preserved",
  "physical_unit_and_bundle_goldset_reviewed",
  "official_source_snapshots_and_sku_reviewed",
  "subject_identity_and_cross_size_formulation_reviewed",
  "facts_and_recommendation_metadata_governed",
  "v1_v2_exact_live_ten_product_diff_reviewed",
  "frozen_164_by_12_semantics_verified",
  "independent_goldset_no_false_subject_or_offer_links",
  "database_rls_api_security_review_approved",
  "canary_cohort_and_stop_switch_tested",
  "rollback_replay_and_observability_tested",
  "explicit_protected_g2_governance_approval"
].map(k=>[k,true]));
const complete=review({evidence:all});
assert.equal(complete.decision,"INDEPENDENT_PROTECTED_REVIEW_REQUIRED");
assert.equal(complete.checks_supplied,12);
assert.equal(complete.production_grant_authorized,false);
assert.equal(complete.deployment_authorized,false);
assert.equal(complete.canary_activated,false);
for(const change of [
  x=>x.evidence.official_source_snapshots_and_sku_reviewed=false,
  x=>delete x.evidence.canary_cohort_and_stop_switch_tested,
  x=>x.evidence.independent_goldset_no_false_subject_or_offer_links=false
]){
  const x={evidence:{...all}};change(x);
  assert.equal(review(x).decision,"RELEASE_REVIEW_HOLD");
}
assert.throws(()=>review({evidence:{canary_cohort_and_stop_switch_tested:"yes"}}),TypeError);
assert.throws(()=>review({evidence:{},cohort_size:9}),TypeError);
assert.throws(()=>review({evidence:[]}),TypeError);
console.log("R6 cleanser release review: PASS (12 protected checks, no activation, no DB writes)");
