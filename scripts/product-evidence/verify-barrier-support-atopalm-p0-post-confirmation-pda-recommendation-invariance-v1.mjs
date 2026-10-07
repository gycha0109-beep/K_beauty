#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-post-confirmation-pda-recommendation-invariance-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-final-product-fact-confirmation-closeout-v1.json";
const r7Path =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-shadow-consumption-evaluation-summary-v1.json";
const adapterPath="lib/barrier-support-non-numeric-pda-shadow-adapter.js";
const mapperPath="scripts/product-evidence/barrier-support-non-numeric-pda-contract-v1.mjs";

const artifact=JSON.parse(fs.readFileSync(artifactPath,"utf8"));
const parent=JSON.parse(fs.readFileSync(parentPath,"utf8"));
const r7=JSON.parse(fs.readFileSync(r7Path,"utf8"));
const gitBlob=(path)=>execFileSync("git",["hash-object",path],{encoding:"utf8"}).trim();

assert.equal(artifact.stage,"V2.1-8H-R13J");
assert.equal(artifact.decision,"BARRIER_SUPPORT_ATOPALM_P0_POST_CONFIRMATION_PDA_RECOMMENDATION_INVARIANCE_PASS");
assert.equal(artifact.parent_authority.r13i_path,parentPath);
assert.equal(gitBlob(parentPath),artifact.parent_authority.r13i_git_blob_sha);
assert.equal(parent.decision,artifact.parent_authority.r13i_decision);
assert.equal(parent.follow_up.stage,"V2.1-8H-R13J_ATOPALM_POST_CONFIRMATION_PDA_RECOMMENDATION_INVARIANCE");

assert.equal(gitBlob(r7Path),artifact.frozen_r7_authority.summary_git_blob_sha);
assert.equal(gitBlob(adapterPath),artifact.frozen_r7_authority.adapter_git_blob_sha);
assert.equal(gitBlob(mapperPath),artifact.frozen_r7_authority.mapper_git_blob_sha);
assert.equal(artifact.frozen_r7_authority.candidate_products,164);
assert.equal(artifact.frozen_r7_authority.user_scenarios,12);
assert.equal(artifact.frozen_r7_authority.relevant_scenarios,9);
assert.equal(artifact.frozen_r7_authority.candidate_scenario_evaluations,1968);
assert.equal(r7.frozen_evaluation_boundary.candidate_products,164);
assert.equal(r7.frozen_evaluation_boundary.candidate_scenario_evaluations,1968);

assert.equal(artifact.target.product_id,"418e2bc1-7d6c-4334-9058-7af7ce159c6c");
assert.equal(artifact.target.category,"moisturizer_balm");
assert.equal(artifact.target.barrier_support_claim_current,true);
assert.equal(artifact.target.primary_use_role_current,true);
assert.equal(artifact.target.primary_use_role_value,"multi_area");
assert.equal(artifact.target.frozen_candidate_member,true);

assert.deepEqual(artifact.exact_r13i_attribution.pre_r13i,{
  signal_state:"GOVERNED_BARRIER_CLAIM_UNKNOWN",
  coverage_state:"missing_fact",
  primary_use_role_state:"MISSING",
  primary_use_role_values:[]
});
assert.deepEqual(artifact.exact_r13i_attribution.post_r13i,{
  signal_state:"GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE",
  coverage_state:"claim_with_usage_role_context",
  primary_use_role_state:"ESTABLISHED",
  primary_use_role_values:["multi_area"]
});
assert.equal(artifact.exact_r13i_attribution.signal_state_changed,true);
assert.equal(artifact.exact_r13i_attribution.coverage_state_changed,true);
assert.equal(artifact.exact_r13i_attribution.role_context_changed,true);
assert.equal(artifact.exact_r13i_attribution.numeric_contribution_delta,0);
assert.equal(artifact.exact_r13i_attribution.rank_effect_delta,0);
assert.equal(artifact.exact_r13i_attribution.eligibility_effect_delta,0);

assert.deepEqual(artifact.live_176_reconciliation.pre_r13i.state_counts,{
  GOVERNED_BARRIER_CLAIM_BLOCKED:47,
  GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE:6,
  GOVERNED_BARRIER_CLAIM_UNKNOWN:18,
  NOT_APPLICABLE:105
});
assert.deepEqual(artifact.live_176_reconciliation.post_r13i.state_counts,{
  GOVERNED_BARRIER_CLAIM_BLOCKED:47,
  GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE:7,
  GOVERNED_BARRIER_CLAIM_UNKNOWN:17,
  NOT_APPLICABLE:105
});
assert.equal(artifact.live_176_reconciliation.exact_r13i_delta.established_true_candidates,1);
assert.equal(artifact.live_176_reconciliation.exact_r13i_delta.unknown_candidates,-1);
assert.equal(artifact.live_176_reconciliation.exact_r13i_delta.claim_with_usage_role_context,1);
assert.equal(artifact.live_176_reconciliation.exact_r13i_delta.missing_fact,-1);

assert.deepEqual(artifact.frozen_164_reconciliation.historical_r7.state_counts,r7.candidate_product_fact_coverage.state_counts);
assert.deepEqual(artifact.frozen_164_reconciliation.historical_r7.coverage_counts,r7.candidate_product_fact_coverage.coverage_counts);
assert.deepEqual(artifact.frozen_164_reconciliation.historical_r7.aggregate_annotation_state_counts,r7.aggregate_shadow_output.annotation_state_counts);

assert.deepEqual(artifact.frozen_164_reconciliation.current_pre_r13i.state_counts,{
  GOVERNED_BARRIER_CLAIM_BLOCKED:47,
  GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE:6,
  GOVERNED_BARRIER_CLAIM_UNKNOWN:8,
  NOT_APPLICABLE:103
});
assert.deepEqual(artifact.frozen_164_reconciliation.current_post_r13i.state_counts,{
  GOVERNED_BARRIER_CLAIM_BLOCKED:47,
  GOVERNED_BARRIER_CLAIM_ESTABLISHED_TRUE:7,
  GOVERNED_BARRIER_CLAIM_UNKNOWN:7,
  NOT_APPLICABLE:103
});
assert.deepEqual(artifact.frozen_164_reconciliation.current_pre_r13i.aggregate_annotation_state_counts,{
  blocked:564,
  held_unknown_product_fact:72,
  not_applicable:1236,
  not_relevant:42,
  positive_claim_context_available:54
});
assert.deepEqual(artifact.frozen_164_reconciliation.current_post_r13i.aggregate_annotation_state_counts,{
  blocked:564,
  held_unknown_product_fact:63,
  not_applicable:1236,
  not_relevant:42,
  positive_claim_context_available:63
});
assert.deepEqual(artifact.frozen_164_reconciliation.current_pre_r13i.positive_claim_role_counts,{
  full_face:9,local_area:9,multi_area:36
});
assert.deepEqual(artifact.frozen_164_reconciliation.current_post_r13i.positive_claim_role_counts,{
  full_face:9,local_area:9,multi_area:45
});
assert.equal(Object.values(artifact.frozen_164_reconciliation.current_pre_r13i.aggregate_annotation_state_counts).reduce((a,b)=>a+b,0),1968);
assert.equal(Object.values(artifact.frozen_164_reconciliation.current_post_r13i.aggregate_annotation_state_counts).reduce((a,b)=>a+b,0),1968);

assert.equal(artifact.recommendation_invariance.adapter_contract_unchanged,true);
assert.equal(artifact.recommendation_invariance.numeric_contribution_units_delta,0);
assert.equal(artifact.recommendation_invariance.rank_effect_units_delta,0);
assert.equal(artifact.recommendation_invariance.eligibility_effect_units_delta,0);
assert.equal(artifact.recommendation_invariance.candidate_policy_authority_changed,false);
assert.equal(artifact.recommendation_invariance.scoring_authority_changed,false);
assert.equal(artifact.recommendation_invariance.recommendation_admission_authorized,false);
assert.equal(artifact.recommendation_invariance.recommendation_activation_authorized,false);
assert.equal(artifact.recommendation_invariance.public_activation,false);
assert.equal(artifact.recommendation_invariance.production_cutover_authorized,false);

assert.deepEqual(artifact.hosted_writes,{
  product_fact_writes:0,
  pda_writes:0,
  recommendation_writes:0,
  registry_writes:0
});
assert.equal(artifact.follow_up.atopalm_product_fact_confirmation_complete,true);
assert.equal(artifact.follow_up.recommendation_activation_still_requires_separate_authority,true);

console.log(JSON.stringify({
  status:"PASS",
  stage:artifact.stage,
  decision:artifact.decision,
  exactSignalDelta:{unknown:-1,establishedTrue:1},
  frozenPositiveRowsDelta:9,
  numericDelta:0,
  rankDelta:0,
  eligibilityDelta:0,
  recommendationActivation:false
}));
