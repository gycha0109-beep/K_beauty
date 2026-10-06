#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-post-confirmation-pda-recommendation-invariance-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-final-product-fact-confirmation-closeout-v1.json";
const r7Path =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-shadow-consumption-evaluation-summary-v1.json";
const adapterPath =
  "lib/barrier-support-non-numeric-pda-shadow-adapter.js";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));
const r7 = JSON.parse(fs.readFileSync(r7Path, "utf8"));

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

assert.equal(artifact.stage, "V2.1-8H-R12H");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_POST_CONFIRMATION_PDA_RECOMMENDATION_INVARIANCE_PASS"
);

assert.equal(artifact.parent_authority.r12g_path, parentPath);
assert.equal(gitBlob(parentPath), artifact.parent_authority.r12g_git_blob_sha);
assert.equal(parent.decision, artifact.parent_authority.r12g_decision);

assert.equal(artifact.frozen_r7_authority.summary_path, r7Path);
assert.equal(gitBlob(r7Path), artifact.frozen_r7_authority.summary_git_blob_sha);
assert.equal(gitBlob(adapterPath), artifact.frozen_r7_authority.adapter_git_blob_sha);
assert.equal(artifact.frozen_r7_authority.candidate_products, 164);
assert.equal(artifact.frozen_r7_authority.user_scenarios, 12);
assert.equal(artifact.frozen_r7_authority.candidate_scenario_evaluations, 1968);
assert.equal(artifact.frozen_r7_authority.historical_denominator_mutated, false);

assert.equal(r7.frozen_evaluation_boundary.candidate_products, 164);
assert.equal(r7.frozen_evaluation_boundary.user_scenarios, 12);
assert.equal(r7.frozen_evaluation_boundary.candidate_scenario_evaluations, 1968);

assert.equal(artifact.mapper_contract.usage_role_is_context_only, true);
assert.equal(artifact.mapper_contract.numeric_contribution, null);
assert.equal(artifact.mapper_contract.rank_effect, "NONE");
assert.equal(artifact.mapper_contract.eligibility_effect, "NONE");
assert.equal(artifact.mapper_contract.production_consumption, "NO");

assert.equal(
  artifact.target.product_id,
  "b1f6b527-679f-48f3-9b58-5d28ec095f2f"
);
assert.equal(
  artifact.target.subject_id,
  "84beae6f-72c8-424e-b561-c2c067fef9e0"
);
assert.equal(
  artifact.target.fact_instance_id,
  "3317cbd1-0d05-4342-ad75-d7acf49980d3"
);
assert.equal(
  artifact.target.confirmation_id,
  "9947fc0b-2a75-43a5-8569-156dedcba5e1"
);
assert.equal(artifact.target.barrier_support_claim_current, false);
assert.equal(artifact.target.primary_use_role_current, true);
assert.equal(artifact.target.primary_use_role_value, "multi_area");
assert.equal(artifact.target.frozen_candidate_member, true);

assert.deepEqual(artifact.exact_r12g_attribution.pre_r12g, {
  signal_state: "GOVERNED_BARRIER_CLAIM_UNKNOWN",
  coverage_state: "missing_fact",
  primary_use_role_state: "MISSING",
  primary_use_role_values: []
});
assert.deepEqual(artifact.exact_r12g_attribution.post_r12g, {
  signal_state: "GOVERNED_BARRIER_CLAIM_UNKNOWN",
  coverage_state: "missing_fact",
  primary_use_role_state: "ESTABLISHED",
  primary_use_role_values: ["multi_area"]
});
assert.equal(artifact.exact_r12g_attribution.signal_state_changed, false);
assert.equal(artifact.exact_r12g_attribution.coverage_state_changed, false);
assert.equal(artifact.exact_r12g_attribution.role_context_changed, true);
assert.equal(artifact.exact_r12g_attribution.numeric_contribution_delta, 0);
assert.equal(artifact.exact_r12g_attribution.rank_effect_delta, 0);
assert.equal(artifact.exact_r12g_attribution.eligibility_effect_delta, 0);

assert.deepEqual(
  artifact.live_176_reconciliation.pre_r12g.state_counts,
  artifact.live_176_reconciliation.post_r12g.state_counts
);
assert.deepEqual(
  artifact.live_176_reconciliation.pre_r12g.coverage_counts,
  artifact.live_176_reconciliation.post_r12g.coverage_counts
);
assert.equal(
  artifact.live_176_reconciliation.exact_r12g_state_count_delta,
  0
);
assert.equal(
  artifact.live_176_reconciliation.exact_r12g_coverage_count_delta,
  0
);

assert.deepEqual(
  artifact.frozen_164_reconciliation.historical_r7.state_counts,
  r7.candidate_product_fact_coverage.state_counts
);
assert.deepEqual(
  artifact.frozen_164_reconciliation.historical_r7.coverage_counts,
  r7.candidate_product_fact_coverage.coverage_counts
);
assert.deepEqual(
  artifact.frozen_164_reconciliation.historical_r7.aggregate_annotation_state_counts,
  r7.aggregate_shadow_output.annotation_state_counts
);

assert.deepEqual(
  artifact.frozen_164_reconciliation.current_pre_r12g.state_counts,
  artifact.frozen_164_reconciliation.current_post_r12g.state_counts
);
assert.deepEqual(
  artifact.frozen_164_reconciliation.current_pre_r12g.coverage_counts,
  artifact.frozen_164_reconciliation.current_post_r12g.coverage_counts
);
assert.deepEqual(
  artifact.frozen_164_reconciliation.current_pre_r12g.aggregate_annotation_state_counts,
  artifact.frozen_164_reconciliation.current_post_r12g.aggregate_annotation_state_counts
);

assert.deepEqual(
  artifact.frozen_164_reconciliation.r7_to_current_cumulative_delta,
  {
    blocked_candidates: -3,
    unknown_candidates: 3,
    note:
      "cumulative coverage recovery between R7 and R12G; not attributable to the R12G confirmation alone"
  }
);

for (const [key, expected] of Object.entries({
  state_counts_changed: false,
  coverage_counts_changed: false,
  annotation_counts_changed: false,
  positive_claim_context_rows_delta: 0,
  held_unknown_product_fact_rows_delta: 0,
  blocked_rows_delta: 0,
  not_relevant_rows_delta: 0,
  not_applicable_rows_delta: 0,
  candidate_scenario_evaluation_delta: 0
})) {
  assert.equal(
    artifact.frozen_164_reconciliation.exact_r12g_delta[key],
    expected,
    key
  );
}

assert.equal(artifact.recommendation_invariance.ranking_outputs_recomputed, false);
assert.equal(
  artifact.recommendation_invariance.top1_top3_product_ids_available_in_frozen_artifact,
  false
);
assert.equal(artifact.recommendation_invariance.numeric_contribution_units_delta, 0);
assert.equal(artifact.recommendation_invariance.rank_effect_units_delta, 0);
assert.equal(artifact.recommendation_invariance.eligibility_effect_units_delta, 0);
assert.equal(artifact.recommendation_invariance.candidate_policy_authority_changed, false);
assert.equal(artifact.recommendation_invariance.scoring_authority_changed, false);
assert.equal(artifact.recommendation_invariance.recommendation_admission_authorized, false);
assert.equal(artifact.recommendation_invariance.recommendation_activation_authorized, false);
assert.equal(artifact.recommendation_invariance.public_activation, false);
assert.equal(artifact.recommendation_invariance.production_cutover_authorized, false);

assert.deepEqual(artifact.hosted_writes, {
  product_fact_writes: 0,
  pda_writes: 0,
  recommendation_writes: 0,
  registry_writes: 0
});

assert.equal(artifact.follow_up.ready3_task_rows_pending_in_db, 6);
assert.equal(artifact.follow_up.unresolved_official_evidence_gaps, 5);
assert.equal(
  artifact.follow_up.confirmed_etude_role_task_still_pending_by_design,
  true
);
assert.equal(
  artifact.follow_up.recommendation_activation_still_requires_separate_authority,
  true
);

console.log(JSON.stringify({
  status: "PASS",
  stage: artifact.stage,
  decision: artifact.decision,
  frozenCandidates: artifact.frozen_r7_authority.candidate_products,
  frozenEvaluations: artifact.frozen_r7_authority.candidate_scenario_evaluations,
  exactR12GSignalDelta: 0,
  exactR12GRankDelta: 0,
  exactR12GEligibilityDelta: 0,
  recommendationActivation: false
}));
