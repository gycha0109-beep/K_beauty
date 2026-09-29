#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20260930083000_data_ai29c_c6f_prospective_axis_readiness_v1.sql";
const artifactPath =
  "evidence/product-fact-catalog-expansion-v1/data-ai29c-protection-expansion-wave-2-execution-v1.json";

const migration = fs.readFileSync(migrationPath, "utf8");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

for (const token of [
  "read_data_ai29c_prospective_protection_axis_readiness_v1",
  "read_data_ai29c_protection_expansion_audit_v1",
  "SHADOW_SCORING_PARTIALLY_READY",
  "READY_FOR_SHADOW_SCORING",
  "HOLD_NO_DISCRIMINATING_AXIS",
  "productionRankingChanged",
  "productionCutoverAuthorized",
  "outdoorRankableSignalAuthorized",
  "recommendationAdmissionMutated",
  "publicActivation",
  "persistence",
  "to service_role;",
]) {
  assert.ok(migration.includes(token), "C6F migration token missing: " + token);
}

for (const forbidden of [
  "insert into public.",
  "update public.",
  "delete from public.",
  "truncate ",
]) {
  assert.ok(
    !migration.toLowerCase().includes(forbidden),
    "C6F readiness must remain read-only: " + forbidden,
  );
}

assert.equal(artifact.version, "data-ai29c-protection-expansion-wave-2-execution-v1");
assert.equal(artifact.stage, "DATA-AI29C-C6");
assert.equal(artifact.execution_summary.primary_candidate_count, 5);
assert.equal(artifact.execution_summary.reserve_candidate_count, 2);
assert.equal(artifact.execution_summary.promoted_primary_count, 5);
assert.equal(artifact.execution_summary.reserve_promoted_count, 0);
assert.equal(artifact.execution_summary.exact_current_subject_count, 5);
assert.equal(artifact.execution_summary.spf_confirmed_count, 5);
assert.equal(artifact.execution_summary.uva_confirmed_count, 5);
assert.equal(artifact.execution_summary.uv_filter_confirmed_count, 3);
assert.equal(artifact.execution_summary.uv_filter_insufficient_count, 2);
assert.equal(artifact.execution_summary.recommendation_authority_mutated, false);
assert.equal(artifact.execution_summary.production_cutover_authorized, false);

assert.equal(artifact.primary.length, 5);
assert.equal(artifact.reserves.length, 2);
assert.deepEqual(
  artifact.primary.map((x) => [x.external_id, x.spf_value, x.uva_label]),
  [
    ["1883342", 20, "PA++"],
    ["1801617", 35, "PA+++"],
    ["1802915", 35, "PA+++"],
    ["1790960", 40, "PA++"],
    ["1895004", 40, "PA++"],
  ],
);
assert.ok(artifact.primary.every((x) => x.variant_key === null));
assert.ok(artifact.reserves.every((x) => x.promoted === false));
assert.ok(artifact.reserves.every((x) => x.review_status === "new"));
assert.ok(artifact.reserves.every((x) => x.identity_resolution_state === "unresolved"));

const audit = artifact.authoritative_post_wave_audit;
assert.equal(audit.sunscreen_count, 20);
assert.equal(audit.exact_current_subject_count, 20);
assert.equal(audit.ambiguous_or_missing_subject_count, 0);
assert.equal(audit.spf.eligible_count, 18);
assert.equal(audit.spf.coverage, 0.9);
assert.equal(audit.spf.distinct_scoring_buckets, 3);
assert.equal(audit.spf.gate_pass, true);
assert.equal(audit.uva.eligible_count, 16);
assert.equal(audit.uva.coverage, 0.8);
assert.equal(audit.uva.distinct_scoring_buckets, 3);
assert.equal(audit.uva.gate_pass, true);
assert.equal(audit.waterResistance.eligible_count, 0);
assert.equal(audit.waterResistance.gate_pass, false);

const readiness = artifact.prospective_axis_readiness_expected;
assert.equal(
  readiness.contract_version,
  "data-ai29c-c6f-prospective-protection-axis-readiness-v1",
);
assert.deepEqual(readiness.ready_axes, ["spf", "uva"]);
assert.equal(readiness.overall_decision, "SHADOW_SCORING_PARTIALLY_READY");
assert.equal(readiness.prospective_corpus, true);
assert.equal(readiness.includes_catalog_taxonomy_shadow, true);
assert.ok(Object.values(readiness.limits).every((value) => value === false));

assert.equal(artifact.recommendation_boundary.primary_product_category, null);
assert.equal(artifact.recommendation_boundary.contains_active_current_count_per_primary, 0);
assert.equal(artifact.recommendation_boundary.recommendation_admission_authorized, false);
assert.equal(artifact.next_boundary.must_not_mutate_current_production_protection_shadow, true);
assert.equal(artifact.next_boundary.must_not_grant_recommendation_admission, true);
assert.equal(artifact.next_boundary.must_not_change_production_ranking, true);

console.log("DATA_AI29C_C6F_PROSPECTIVE_AXIS_READINESS=PASS");
console.log("ready_axes=spf,uva sunscreen=20 spf=18/20 uva=16/20 water=0/20");
