#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const manifestPath =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-2-selection-v1.json";
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

assert.equal(manifest.version, "data-ai29c-protection-expansion-wave-2-selection-v1");
assert.equal(manifest.stage, "DATA-AI29C-C6");
assert.equal(manifest.mode, "PROTECTION_DISCRIMINATION_PROOF");
assert.equal(manifest.authority.candidate_source_authority, false);

assert.deepEqual(manifest.baseline, {
  sunscreenCount: 15,
  spfEligibleCount: 13,
  uvaEligibleCount: 11,
  waterEligibleCount: 0,
  spfDistinctScoringBuckets: 1,
  uvaDistinctScoringBuckets: 1,
  waterDistinctScoringBuckets: 0,
  spfCoverage: 0.8667,
  uvaCoverage: 0.7333,
  waterCoverage: 0,
  decision: "HOLD_NO_DISCRIMINATING_AXIS",
  productionCutoverAuthorized: false,
});

assert.equal(manifest.target_if_all_primary_confirm.sunscreenCount, 20);
assert.equal(manifest.target_if_all_primary_confirm.spfEligibleCount, 18);
assert.equal(manifest.target_if_all_primary_confirm.uvaEligibleCount, 16);
assert.equal(manifest.target_if_all_primary_confirm.spfCoverage, 0.9);
assert.equal(manifest.target_if_all_primary_confirm.uvaCoverage, 0.8);
assert.equal(manifest.target_if_all_primary_confirm.spfDistinctScoringBuckets, 3);
assert.equal(manifest.target_if_all_primary_confirm.uvaDistinctScoringBuckets, 3);
assert.equal(manifest.target_if_all_primary_confirm.expectedSpfGatePass, true);
assert.equal(manifest.target_if_all_primary_confirm.expectedUvaGatePass, true);
assert.equal(manifest.target_if_all_primary_confirm.expectedWaterGatePass, false);
assert.equal(manifest.target_if_all_primary_confirm.productionCutoverAuthorized, false);

assert.equal(manifest.selection_policy.active_wave_size, 5);
assert.equal(manifest.selection_policy.reserve_size, 2);
assert.equal(manifest.selection_policy.default_brand_cap, 1);
assert.equal(manifest.selection_policy.c6_active_brand_cap, 5);
assert.equal(manifest.selection_policy.brand_cap_override_scope, "DATA-AI29C-C6_ONLY");
assert.match(manifest.selection_policy.reserve_semantics, /not active simultaneously/i);
assert.match(manifest.selection_policy.post_promotion_failure_semantics, /do not add a reserve/i);

assert.equal(manifest.primary.length, 5);
assert.equal(manifest.reserve.length, 2);
assert.equal(new Set([...manifest.primary, ...manifest.reserve].map((x) => x.candidate_id)).size, 7);
assert.equal(new Set([...manifest.primary, ...manifest.reserve].map((x) => x.external_id)).size, 7);
assert.equal(new Set(manifest.primary.map((x) => x.brand)).size, 1);
assert.equal(manifest.primary[0].brand, "SIDMOOL");

const expectedPrimary = [
  ["1883342", 20, "PA++", "spf_15_29", "uva_pa2"],
  ["1801617", 35, "PA+++", "spf_30_49", "uva_pa3"],
  ["1802915", 35, "PA+++", "spf_30_49", "uva_pa3"],
  ["1790960", 40, "PA++", "spf_30_49", "uva_pa2"],
  ["1895004", 40, "PA++", "spf_30_49", "uva_pa2"],
];
assert.deepEqual(
  manifest.primary.map((x) => [
    x.external_id,
    x.target.spf_value,
    x.target.uva_label,
    x.target.spf_bucket,
    x.target.uva_bucket,
  ]),
  expectedPrimary,
);

for (const candidate of [...manifest.primary, ...manifest.reserve]) {
  assert.match(candidate.official_url, /^https:\/\/www\.sidmool\.com\/shop\/shopdetail\.html\?branduid=/);
  assert.equal(candidate.hwahae_url, `https://www.hwahae.com/en/products/${candidate.external_id}`);
}

for (const key of [
  "discovery_lead_is_product_fact",
  "hwahae_is_positive_product_fact_authority",
  "candidate_insert_may_write_product",
  "candidate_insert_may_write_product_fact",
  "candidate_insert_may_change_recommendation",
  "productionCutoverAuthorized",
  "outdoorRankableSignalAuthorized",
]) {
  assert.equal(manifest.authority_boundaries[key], false, `${key} must remain false`);
}
assert.equal(
  manifest.authority_boundaries.official_page_is_not_fact_until_governed_ingest_and_confirmation,
  true,
);

assert.equal(manifest.candidate_registration_readback.inserted_count, 7);
assert.equal(manifest.candidate_registration_readback.products_delta, 0);
assert.equal(manifest.candidate_registration_readback.product_fact_instances_delta, 0);
assert.equal(manifest.candidate_registration_readback.product_fact_current_delta, 0);
assert.equal(manifest.candidate_registration_readback.all_review_status, "new");
assert.equal(manifest.candidate_registration_readback.all_identity_resolution_state, "unresolved");
assert.equal(manifest.candidate_registration_readback.all_classification_state, "active_shadow");
assert.equal(manifest.candidate_registration_readback.all_product_write_allowed, false);
assert.equal(manifest.candidate_registration_readback.all_product_promotion_allowed, false);
assert.equal(manifest.candidate_registration_readback.all_recommendation_admission_allowed, false);

assert.equal(manifest.next_gate.phase, "C6-D");
assert.equal(manifest.next_gate.no_automatic_promotion, true);

console.log("DATA_AI29C_C6_DISCRIMINATION_WAVE2=PASS");
console.log("primary=5 reserve=2 target_spf_coverage=0.90 target_uva_coverage=0.80");
