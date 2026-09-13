#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { classifyInitialAdmissionCategory } from "./initial-admission-grant-policy-v1.mjs";

const PLAN_PATH = "evidence/product-fact-adoption-v1/trust-p26-aestura-barrier-kr-uv-filter-type-adoption-plan-v1.json";
const P7_PATH = "evidence/product-fact-subject-coverage-v1/trust-p7-sunscreen-stage-b-identity-source-research-v1.json";
const P8_PATH = "evidence/product-fact-adoption-v1/trust-p8-sunscreen-hosted-adoption-plan-v1.json";
const SCORING_PATH = "lib/recommendation-scoring.ts";

const EXPECTED = Object.freeze({
  version: "trust-p26-aestura-barrier-kr-uv-filter-type-adoption-plan-v1",
  sourceMain: "affea214007964d52ea8bde7aaa2f368829b8756",
  productId: "2d3591f2-2216-4043-8493-a9492806ef8b",
  subjectId: "a340d9dc-a742-4ca3-9951-3bc7e6ec7655",
  subjectKey: "d166f4c1336cf52b3025111be6cbcc836756f5017772400f3a5054745b742160",
  variant: "DERMA_UV365_BARRIER_HYDRO_MINERAL_40ML_KR",
  revision: "trust-p7-aestura-barrier-hydro-mineral-current",
  registry: "product-fact-registry-cross-category-v1",
  definitionChecksum: "c6107f2924d443c80f1c61e7977f54f69a97ac5b5da21f8eb2be13891f1ec52c",
  propositionSerializer: "product-fact-proposition-pilot-v1",
  sourceId: "cdfc7792-cf0b-402e-a407-50a0bd9ba71b",
  bindingId: "ab398c78-5932-4952-b2b3-d57074da56a5",
  sourceDigest: "6bda698640f4c0cae2f7dbdf6a9da72980cab1f39ae972e8e7488351775bb3ab",
  proposition: "996c2b99f4519323d3f6a144395ae09da861419ec38559bf6f9c67a9ad88f004",
  evidenceDigest: "0fe3f0338e4b2c8177be762122e06e7925f8e8c9d8f58e99eb54bf56a326b74b",
  planDigest: "a6307b1f84b9391970f99902933af84a7275a42645f7d91ac9737e6943069c06",
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}
function canonical(value) {
  return JSON.stringify(stable(value));
}
function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : canonical(value)).digest("hex");
}
function load(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

const plan = load(PLAN_PATH);
const p7 = load(P7_PATH);
const p8 = load(P8_PATH);
const scoring = fs.readFileSync(SCORING_PATH, "utf8");

assert.equal(plan.version, EXPECTED.version);
assert.equal(plan.stage, "TRUST-P26");
assert.equal(plan.phase, "A_DETERMINISTIC_PLAN_FREEZE");
assert.equal(plan.source_main_sha, EXPECTED.sourceMain);

const hashInput = structuredClone(plan);
delete hashInput.plan_content_sha256;
assert.equal(digest(hashInput), EXPECTED.planDigest);
assert.equal(plan.plan_content_sha256, EXPECTED.planDigest);

assert.equal(plan.authority.registry_version, EXPECTED.registry);
assert.equal(plan.authority.fact_definition_checksum, EXPECTED.definitionChecksum);
assert.equal(plan.target.product_id, EXPECTED.productId);
assert.equal(plan.target.subject_id, EXPECTED.subjectId);
assert.equal(plan.target.subject_semantic_key, EXPECTED.subjectKey);
assert.equal(plan.target.variant_key, EXPECTED.variant);
assert.equal(plan.target.formulation_revision_key, EXPECTED.revision);
assert.equal(plan.target.market, "KR");
assert.equal(plan.target.legacy_uv_filter_type, "mineral");

const p7Target = p7.products.find((row) => row.product_id === EXPECTED.productId);
assert.ok(p7Target, "TRUST-P7 target missing");
assert.equal(p7Target.identity.status, "resolved");
assert.equal(p7Target.identity.variant_key_proposal, EXPECTED.variant);
assert.equal(p7Target.identity.formulation_revision_key_proposal, EXPECTED.revision);
assert.equal(p7Target.identity.market_applicability_proposal, "KR");

const observedClaims = p7Target.sources.flatMap((source) => source.observed_claims || []);
assert.ok(observedClaims.includes("더마UV365 장벽수분 무기자차 선크림"), "KR mineral claim missing");
assert.ok(observedClaims.includes("DERMA UV365 Barrier Hydro Mineral Sunscreen"), "first-party Mineral claim missing");

assert.ok(
  p8.exact_scope.eligible_product_ids.includes(EXPECTED.productId),
  "TRUST-P8 governed target missing",
);

assert.equal(plan.existing_lineage.source_id, EXPECTED.sourceId);
assert.equal(plan.existing_lineage.binding_id, EXPECTED.bindingId);
assert.equal(plan.existing_lineage.source_content_digest, EXPECTED.sourceDigest);
assert.equal(plan.existing_lineage.binding_state, "exact_subject_match");
assert.equal(plan.existing_lineage.scope_relation, "narrower");
assert.equal(plan.existing_lineage.source_reuse_required, true);
assert.equal(plan.existing_lineage.new_subject_required, false);
assert.equal(plan.existing_lineage.new_source_required, false);
assert.equal(plan.existing_lineage.new_binding_required, false);

const expectedScope = { market: "KR", variant: EXPECTED.variant };
const expectedQualifier = {};
const proposition = digest({
  serializer_version: EXPECTED.propositionSerializer,
  subject_semantic_key: EXPECTED.subjectKey,
  registry_version: EXPECTED.registry,
  fact_key: "uv_filter_type",
  value_identity: "mineral",
  scope: expectedScope,
  qualifier: expectedQualifier,
  parent_proposition_key: null,
});
assert.equal(proposition, EXPECTED.proposition);
assert.equal(plan.proposition.proposition_key, EXPECTED.proposition);

const evidenceDigest = digest({
  version: "trust-p26-canonical-evidence-v1",
  upstream_identity_artifact: "trust-p7-sunscreen-stage-b-identity-source-research-v1",
  product_id: EXPECTED.productId,
  subject_semantic_key: EXPECTED.subjectKey,
  source_ref: "trust-p8-source:2d3591f2-2216-4043-8493-a9492806ef8b",
  source_content_digest: EXPECTED.sourceDigest,
  fact_key: "uv_filter_type",
  raw_claim: "DERMA UV365 Barrier Hydro Mineral Sunscreen",
  proposition_key: EXPECTED.proposition,
  proposition_value_identity: "mineral",
  scope: expectedScope,
  qualifier: expectedQualifier,
  evidence_class: "product_claim",
  evidence_authority: "product_specific_primary",
  support_direction: "supports",
});
assert.equal(evidenceDigest, EXPECTED.evidenceDigest);
assert.equal(plan.proposition.canonical_evidence_digest, EXPECTED.evidenceDigest);

assert.equal(plan.registry_contract.fact_key, "uv_filter_type");
assert.deepEqual(plan.registry_contract.allowed_values, ["mineral", "organic", "hybrid"]);
assert.ok(plan.registry_contract.permitted_evidence_classes.includes("product_claim"));
assert.equal(plan.proposition.value, "mineral");
assert.equal(plan.proposition.evidence_authority, "product_specific_primary");
assert.equal(plan.proposition.fused_confidence, "high");

assert.match(scoring, /product\.uv_filter_type === preferredFilterType \? 12 : 0/);
assert.match(scoring, /topPick\.uv_filter_type !== top2\.uv_filter_type/);
assert.equal(plan.authority.recommendation_consumer.exact_filter_match_weight, 12);
assert.equal(plan.authority.recommendation_consumer.alternative_selection_uses_filter_type_diversity, true);
assert.equal(plan.authority.recommendation_consumer.runtime_product_fact_cutover, false);

assert.equal(classifyInitialAdmissionCategory("sunscreen"), "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
assert.equal(plan.authority.admission_boundary.classification, "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT");
assert.equal(plan.authority.admission_boundary.fact_grants_initial_admission, false);

assert.deepEqual(plan.phase_b_planned_delta, {
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
assert.equal(plan.phase_a_expected_writes, 0);
assert.equal(plan.phase_b_execution_authorized, false);
assert.equal(plan.hosted_prestate.target_uv_filter_current, 0);
assert.equal(plan.hosted_prestate.target_uv_filter_evidence, 0);
assert.equal(plan.hosted_prestate.evidence_digest_collision, 0);
assert.equal(plan.hosted_prestate.open_assignment_rows, 0);
assert.equal(plan.hosted_prestate.request_id_collisions, 0);

for (const [key, expected] of Object.entries({
  production_product_fact_writes_phase_a: 0,
  legacy_products_mutation: false,
  recommendation_or_ranking_change: false,
  recommendation_runtime_product_fact_cutover: false,
  initial_admission_grant_change: false,
  legacy_corpus_change: false,
  registry_mutation: false,
  schema_or_rpc_mutation: false,
  new_fact_kind: false,
  cross_product_inference: false,
  third_party_positive_fact_support: false,
})) {
  assert.equal(plan.invariants[key], expected, `invariant ${key}`);
}

assert.equal(plan.next_gate.status, "PHASE_A_FREEZE_ONLY");
assert.equal(plan.next_gate.requires_exact_head_ci, true);
assert.equal(plan.next_gate.requires_fresh_main_preflight, true);
assert.equal(plan.next_gate.requires_expected_head_merge, true);
assert.equal(plan.next_gate.requires_merged_main_ci, true);
assert.equal(plan.next_gate.requires_fresh_production_prestate, true);
assert.equal(plan.next_gate.requires_confirmation_preflight_ready, true);

console.log("TRUST_P26_PHASE_A_PLAN_VERIFIED");
console.log(JSON.stringify({
  plan: EXPECTED.version,
  product_id: EXPECTED.productId,
  subject_id: EXPECTED.subjectId,
  fact_key: "uv_filter_type",
  value: "mineral",
  proposition_key: EXPECTED.proposition,
  evidence_digest: EXPECTED.evidenceDigest,
  plan_digest: EXPECTED.planDigest,
  phase_a_writes: 0,
  sunscreen_initial_admission: "INITIAL_ADMISSION_AUTHORITY_INSUFFICIENT",
}, null, 2));
