#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { classifyInitialAdmissionCategory } from "./initial-admission-grant-policy-v1.mjs";

const EXEC_PATH = "evidence/product-fact-adoption-v1/trust-p26-aestura-barrier-kr-uv-filter-type-hosted-adoption-execution-v1.json";
const PLAN_PATH = "evidence/product-fact-adoption-v1/trust-p26-aestura-barrier-kr-uv-filter-type-adoption-plan-v1.json";
const SCORING_PATH = "lib/recommendation-scoring.ts";

const EXPECTED = Object.freeze({
  version: "trust-p26-aestura-barrier-kr-uv-filter-type-hosted-adoption-execution-v1",
  sourceMain: "733164ef9030f0d6c02fb732efab249963487341",
  productId: "2d3591f2-2216-4043-8493-a9492806ef8b",
  subjectId: "a340d9dc-a742-4ca3-9951-3bc7e6ec7655",
  proposition: "996c2b99f4519323d3f6a144395ae09da861419ec38559bf6f9c67a9ad88f004",
  sourceId: "cdfc7792-cf0b-402e-a407-50a0bd9ba71b",
  bindingId: "ab398c78-5932-4952-b2b3-d57074da56a5",
  evidenceId: "46f09dd4-8d4f-4572-984f-ee3e0d531224",
  assignmentId: "a6c0ef48-b527-48fb-9b8e-de902098be3b",
  factInstanceId: "41a60fbe-8c72-4de0-9ebf-b36287b05477",
  confirmationId: "b98856c6-9983-4690-97c1-e7c126766f62",
  fusionDigest: "89d3f127bbf65ef625de2e5a54d6d00a034f6f6acada3021e598aebea796d412",
  payloadDigest: "e78c76d80c7afc09feb4366bdcd6f107e03b69d85e25c2e56271e328343a195c",
  prestateDigest: "6db84ed8b54f143ca046a6469b26c445460c5b4c418341123ed86a774aabc38e",
  resultDigest: "432c5b16e07373364c2af75bd5c8035a739ae3447605245bd8985e0e39085a9e",
  executionDigest: "b70737367c616506f79470192b17bde114e740ef56c3ecae645e0546969152be",
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
assert.equal(execution.stage, "TRUST-P26");
assert.equal(execution.phase, "B_CONTROLLED_PRODUCTION_EXECUTION_CLOSEOUT");
assert.equal(execution.status, "PRODUCTION_CONFIRMED");
assert.equal(execution.authority.execution_source_main_sha, EXPECTED.sourceMain);
assert.equal(execution.authority.plan_content_sha256, plan.plan_content_sha256);
assert.equal(plan.plan_content_sha256, "a6307b1f84b9391970f99902933af84a7275a42645f7d91ac9737e6943069c06");

const hashInput = structuredClone(execution);
delete hashInput.execution_content_sha256;
assert.equal(digest(hashInput), EXPECTED.executionDigest);
assert.equal(execution.execution_content_sha256, EXPECTED.executionDigest);

assert.equal(execution.target.product_id, EXPECTED.productId);
assert.equal(execution.target.subject_id, EXPECTED.subjectId);
assert.equal(execution.target.fact_key, "uv_filter_type");
assert.equal(execution.target.value, "mineral");
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
assert.equal(execution.runtime.confirmation_retry_idempotent, true);

assert.deepEqual(execution.counts.actual_delta, {
  subjects: 0,
  sources: 0,
  bindings: 0,
  evidence: 1,
  fact_instances: 1,
  evidence_links: 1,
  review_assignments: 1,
  confirmations: 1,
  current: 1,
});
assert.equal(execution.counts.poststate.current, 59);
assert.equal(execution.counts.poststate.products, 165);
assert.equal(execution.legacy_business_invariance.product_count, 165);
assert.equal(execution.legacy_business_invariance.target_legacy_uv_filter_type, "mineral");
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
  existing_source_reused: true,
  existing_binding_reused: true,
  confirmation_preflight_ready: true,
  exact_confirmation_retry_idempotent: true,
  schema_or_rpc_mutation: false,
  registry_mutation: false,
  legacy_products_mutation: false,
  recommendation_or_ranking_change: false,
  recommendation_runtime_product_fact_cutover: false,
  initial_admission_grant_change: false,
  legacy_corpus_change: false,
  third_party_positive_fact_support: false,
  cross_product_inference: false,
})) assert.equal(execution.execution_policy[key], expected, key);

assert.equal(execution.closure.planned_delta_matched, true);
assert.equal(execution.closure.target_current_supported, true);
assert.equal(execution.closure.target_value_matches_legacy_projection, true);
assert.equal(execution.closure.recommendation_invariance_passed, true);
assert.equal(execution.closure.initial_admission_unchanged, true);
assert.equal(execution.closure.result, "TRUST_P26_PRODUCTION_ADOPTION_CONFIRMED");

console.log("TRUST_P26_PRODUCTION_EXECUTION_VERIFIED");
console.log(JSON.stringify({
  product_id: EXPECTED.productId,
  fact_key: "uv_filter_type",
  value: "mineral",
  evidence_id: EXPECTED.evidenceId,
  fact_instance_id: EXPECTED.factInstanceId,
  confirmation_id: EXPECTED.confirmationId,
  production_current: execution.counts.poststate.current,
  recommendation_products: parity.recommendation_product_count,
  scenario_count: parity.scenario_count,
  recommendation_delta_count: parity.score_delta_count + parity.slot_delta_count + parity.full_order_delta_count + parity.top1_delta_count + parity.top3_delta_count,
  execution_digest: EXPECTED.executionDigest,
}, null, 2));
