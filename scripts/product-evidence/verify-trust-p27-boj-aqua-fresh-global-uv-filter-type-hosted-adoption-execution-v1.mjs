#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { classifyInitialAdmissionCategory } from "./initial-admission-grant-policy-v1.mjs";

const EXEC_PATH = "evidence/product-fact-adoption-v1/trust-p27-boj-aqua-fresh-global-uv-filter-type-hosted-adoption-execution-v1.json";
const PLAN_PATH = "evidence/product-fact-adoption-v1/trust-p27-boj-aqua-fresh-global-uv-filter-type-adoption-plan-v1.json";
const SCORING_PATH = "lib/recommendation-scoring.ts";

const EXPECTED = Object.freeze({
  version: "trust-p27-boj-aqua-fresh-global-uv-filter-type-hosted-adoption-execution-v1",
  sourceMain: "d5413c606e2f245fa357c3bbd802bc42f85922ae",
  productId: "765b3ca1-6927-49b0-bee6-4138d03dd915",
  subjectId: "1b735d5e-bc57-4808-9f48-b4bb82f3e8fa",
  proposition: "3a1e4f93a85a853f61bdbc6786d61c72cda504f1e5019f282d24cdbe0acf796d",
  sourceId: "a9d3f7fa-a44d-4e43-ba64-9c68acf6628e",
  bindingId: "ca3df22e-6239-4572-b21d-148f44053a56",
  evidenceId: "eba42d10-5769-421e-912e-879688190691",
  assignmentId: "f815e8a6-8c31-4763-afe0-b87ae5f23e48",
  factInstanceId: "fb75353a-1915-41c0-bd63-e251b99c0acd",
  confirmationId: "53e40483-62be-45ca-9730-0aa1fc92d319",
  fusionDigest: "7f29581a20013c44d32613b057f259d265c1ae43a6970b2bcf4483fc37aa5dbe",
  payloadDigest: "8ca2324ff621dc65675726c8487727abbc5c2ce3b8b350fc9f95a9839fa0ec02",
  prestateDigest: "9aabf9c6f8b999831490d6bc9aecdacea8a62e05e9f024ab46b4dd6f9756ce69",
  resultDigest: "bbbef5d8368f1ac6c9288030c47bc36e9786650b9b5fa960a11c19cd0c3d8806",
  executionDigest: "8e00fb14232a6dda9ed63a781789770d533e57400f94ef00846e6777ac2b8ed9",
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
function load(path) { return JSON.parse(fs.readFileSync(path, "utf8")); }

const execution = load(EXEC_PATH);
const plan = load(PLAN_PATH);
const scoring = fs.readFileSync(SCORING_PATH, "utf8");

assert.equal(execution.version, EXPECTED.version);
assert.equal(execution.stage, "TRUST-P27");
assert.equal(execution.phase, "B_CONTROLLED_PRODUCTION_EXECUTION_CLOSEOUT");
assert.equal(execution.status, "PRODUCTION_CONFIRMED");
assert.equal(execution.authority.execution_source_main_sha, EXPECTED.sourceMain);
assert.equal(execution.authority.plan_content_sha256, plan.plan_content_sha256);
assert.equal(plan.plan_content_sha256, "be917158b2a6774010e407a88f427e63a30c2c3990ce382845bcdfb1b93273da");

const hashInput = structuredClone(execution);
delete hashInput.execution_content_sha256;
assert.equal(digest(hashInput), EXPECTED.executionDigest);
assert.equal(execution.execution_content_sha256, EXPECTED.executionDigest);

assert.equal(execution.target.product_id, EXPECTED.productId);
assert.equal(execution.target.subject_id, EXPECTED.subjectId);
assert.equal(execution.target.fact_key, "uv_filter_type");
assert.equal(execution.target.value, "organic");
assert.equal(execution.target.proposition_key, EXPECTED.proposition);

assert.equal(execution.runtime.source_id, EXPECTED.sourceId);
assert.equal(execution.runtime.binding_id, EXPECTED.bindingId);
assert.equal(execution.runtime.evidence_id, EXPECTED.evidenceId);
assert.equal(execution.runtime.assignment_id, EXPECTED.assignmentId);
assert.equal(execution.runtime.fact_instance_id, EXPECTED.factInstanceId);
assert.equal(execution.runtime.confirmation_id, EXPECTED.confirmationId);
assert.equal(execution.runtime.fusion_input_digest, EXPECTED.fusionDigest);
assert.equal(execution.runtime.payload_digest, EXPECTED.payloadDigest);
assert.equal(execution.runtime.prestate_digest, EXPECTED.prestateDigest);
assert.equal(execution.runtime.result_digest, EXPECTED.resultDigest);
assert.equal(execution.runtime.semantic_status, "supported");
assert.equal(execution.runtime.authority_ceiling, "product_specific_primary");
assert.equal(execution.runtime.fused_confidence, "high");

assert.deepEqual(execution.counts.actual_delta, {
  subjects: 0,
  sources: 1,
  bindings: 1,
  evidence: 1,
  fact_instances: 1,
  evidence_links: 1,
  review_assignments: 1,
  confirmations: 1,
  current: 1,
});
assert.equal(execution.counts.poststate.current, 60);
assert.equal(execution.counts.poststate.sources, 27);
assert.equal(execution.counts.poststate.bindings, 27);
assert.equal(execution.counts.poststate.products, 165);
assert.equal(execution.counts.poststate.exact_confirmation_rows, 1);
assert.equal(execution.counts.poststate.target_current_rows, 1);
assert.equal(execution.legacy_business_invariance.product_count, 165);
assert.equal(execution.legacy_business_invariance.target_legacy_uv_filter_type, "organic");
assert.equal(execution.legacy_business_invariance.legacy_product_mutation, false);
assert.equal(execution.historical_current_invariance.all_unchanged, true);

const runtime = execution.post_write_runtime_verification;
assert.equal(runtime.deployment_sha, EXPECTED.sourceMain);
assert.equal(runtime.deployment_ref, "main");
assert.equal(runtime.runtime_authority_probe.result, "PASS");
assert.equal(runtime.runtime_authority_probe.raw_pf_select_denied, true);
assert.equal(runtime.runtime_authority_probe.authority_status, "AUTHORITY_RESOLVED");
assert.equal(runtime.runtime_authority_probe.secret_value_exposed, false);

const parity = runtime.recommendation_parity;
assert.equal(parity.result, "PASS");
assert.equal(parity.overlay_count, 165);
assert.equal(parity.recommendation_product_count, 164);
assert.equal(parity.overlay_only_count, 1);
assert.equal(parity.scenario_count, 8);
for (const key of ["missing_legacy_live_count","unexpected_live_count","duplicate_overlay_count","non_exact_overlay_count","invalid_taxonomy_state_count","unmatched_product_count","legacy_identity_mismatch_count","score_delta_count","slot_delta_count","full_order_delta_count","top1_delta_count","top3_delta_count"]) {
  assert.equal(parity[key], 0, key);
}
assert.equal(parity.recommendation_runtime_cutover, false);
assert.equal(parity.all_scenarios_full_order_top1_top3_equal, true);

assert.match(scoring, /product\.uv_filter_type === preferredFilterType \? 12 : 0/);
assert.match(scoring, /topPick\.uv_filter_type !== top2\.uv_filter_type/);
assert.equal(classifyInitialAdmissionCategory("sunscreen"), "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");

for (const [key, expected] of Object.entries({
  controlled_rpc_only: true,
  direct_table_dml: false,
  existing_subject_reused: true,
  new_source_inserted: true,
  new_binding_inserted: true,
  confirmation_preflight_ready: true,
  confirmation_retry_attempted: true,
  confirmation_retry_executed: false,
  request_uniqueness_verified: true,
  schema_or_rpc_mutation: false,
  registry_mutation: false,
  legacy_products_mutation: false,
  recommendation_or_ranking_change: false,
  recommendation_runtime_product_fact_cutover: false,
  initial_admission_grant_change: false,
  legacy_corpus_change: false,
  third_party_positive_fact_support: false,
  cross_product_inference: false,
  ingredient_class_inference: false,
})) assert.equal(execution.execution_policy[key], expected, key);
assert.equal(execution.execution_policy.confirmation_retry_block_reason, "connector_safety_preflight_blocked_duplicate_mutation_request");

assert.equal(execution.closure.planned_delta_matched, true);
assert.equal(execution.closure.target_current_supported, true);
assert.equal(execution.closure.target_value_matches_legacy_projection, true);
assert.equal(execution.closure.recommendation_invariance_passed, true);
assert.equal(execution.closure.initial_admission_unchanged, true);
assert.equal(execution.closure.request_uniqueness_verified, true);
assert.equal(execution.closure.result, "TRUST_P27_PRODUCTION_ADOPTION_CONFIRMED");

console.log("TRUST_P27_PRODUCTION_EXECUTION_VERIFIED");
console.log(JSON.stringify({
  product_id: EXPECTED.productId,
  fact_key: "uv_filter_type",
  value: "organic",
  evidence_id: EXPECTED.evidenceId,
  fact_instance_id: EXPECTED.factInstanceId,
  confirmation_id: EXPECTED.confirmationId,
  production_current: execution.counts.poststate.current,
  recommendation_products: parity.recommendation_product_count,
  scenario_count: parity.scenario_count,
  recommendation_delta_count: parity.score_delta_count + parity.slot_delta_count + parity.full_order_delta_count + parity.top1_delta_count + parity.top3_delta_count,
  execution_digest: EXPECTED.executionDigest,
}, null, 2));
