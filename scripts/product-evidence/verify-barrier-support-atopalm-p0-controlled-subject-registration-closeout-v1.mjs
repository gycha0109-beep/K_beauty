#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-controlled-subject-registration-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-atopalm-p0-identity-recovery-preflight-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

const PRODUCT_ID = "418e2bc1-7d6c-4334-9058-7af7ce159c6c";
const SUBJECT_ID = "c7e19978-5678-466b-ba69-f5936aeca5cc";
const SEMANTIC_KEY =
  "f6665f595558d93a4887f63ae5574db014020602e67c59097699d2a40402850b";
const DIGEST =
  "50d690c76745f352907a9c1e22e47346de6bc95c5ad933871fc22c33c1dec4ac";
const FORMULATION_KEY = `v21-8h-r13a:${DIGEST}`;

assert.equal(artifact.stage, "V2.1-8H-R13B");
assert.equal(
  artifact.primary_terminal_outcome,
  "BARRIER_SUPPORT_ATOPALM_P0_CONTROLLED_SUBJECT_REGISTRATION_PASS"
);
assert.equal(artifact.target.product_id, PRODUCT_ID);
assert.equal(artifact.target.subject_id, SUBJECT_ID);

assert.equal(
  parent.next_gate.stage,
  "V2.1-8H-R13B_ATOPALM_CONTROLLED_IDENTITY_AND_SUBJECT_REGISTRATION"
);
assert.equal(parent.next_gate.target_product_id, PRODUCT_ID);
assert.equal(
  parent.subject_semantic_key,
  artifact.frozen_identity.subject_semantic_key
);
assert.equal(
  parent.reviewed_identity.formulationRevisionKey,
  artifact.frozen_identity.formulation_revision_key
);
assert.equal(parent.capture_digest, artifact.frozen_identity.source_content_digest);

assert.equal(artifact.frozen_identity.subject_semantic_key, SEMANTIC_KEY);
assert.equal(artifact.frozen_identity.formulation_revision_key, FORMULATION_KEY);
assert.equal(artifact.frozen_identity.source_content_digest, DIGEST);
assert.equal(artifact.frozen_identity.variant_key, null);
assert.equal(artifact.frozen_identity.market_applicability, "KR");
assert.match(artifact.frozen_identity.official_source_locator, /product_no=3324/);

assert.equal(artifact.execution.sequence_completed, true);
assert.deepEqual(artifact.execution.required_sequence, [
  "admin_resolve_catalog_trust_intake_identity_v1",
  "process_catalog_trust_product_v3",
  "controlled subject registration preflight",
  "admin_register_product_fact_subject_v1",
  "process_catalog_trust_product_v3",
  "production readback"
]);

const expectedFunctions = {
  intake_identity:
    "e4d3309d34b74beb1737297b727b3647991822628a1e31c199e1475982907d12",
  subject_registration:
    "379b9da9b8b1e521876b30f1a2d04d6da7a7f3bf6ab7e145875636c6eddf0418",
  post_registration_reprocess:
    "2d4e9115e0a4f753c53bdfcff4aa29fbbeb0aa431c0d1b2a62efbd98caf3b12e"
};
for (const [key, hash] of Object.entries(expectedFunctions)) {
  assert.equal(artifact.function_contracts[key].function_sha256, hash);
  assert.equal(artifact.function_contracts[key].anon_execute, false);
  assert.equal(artifact.function_contracts[key].authenticated_execute, false);
  assert.equal(artifact.function_contracts[key].service_role_execute, true);
}

assert.deepEqual(
  {
    product_fact_subject_total: artifact.production_prestate.product_fact_subject_total,
    product_fact_current: artifact.production_prestate.product_fact_current,
    fact_instances: artifact.production_prestate.fact_instances,
    confirmations: artifact.production_prestate.confirmations,
    evidence_records: artifact.production_prestate.evidence_records
  },
  {
    product_fact_subject_total: 50,
    product_fact_current: 105,
    fact_instances: 106,
    confirmations: 106,
    evidence_records: 108
  }
);

assert.deepEqual(
  {
    product_fact_subject_total: artifact.production_poststate.product_fact_subject_total,
    product_fact_current: artifact.production_poststate.product_fact_current,
    fact_instances: artifact.production_poststate.fact_instances,
    confirmations: artifact.production_poststate.confirmations,
    evidence_records: artifact.production_poststate.evidence_records
  },
  {
    product_fact_subject_total: 51,
    product_fact_current: 105,
    fact_instances: 106,
    confirmations: 106,
    evidence_records: 108
  }
);

assert.equal(
  artifact.production_poststate.product_fact_subject_total -
    artifact.production_prestate.product_fact_subject_total,
  1
);
for (const key of [
  "product_fact_current",
  "fact_instances",
  "confirmations",
  "evidence_records"
]) {
  assert.equal(
    artifact.production_poststate[key],
    artifact.production_prestate[key],
    `${key} must remain unchanged`
  );
}

assert.equal(artifact.production_poststate.target_subject_count, 1);
assert.equal(artifact.production_poststate.target_current_facts, 0);
assert.equal(artifact.production_poststate.target_fact_instances, 0);
assert.equal(artifact.production_poststate.target_evidence_records, 0);

assert.deepEqual(
  {
    subject_id: artifact.subject_readback.subject_id,
    identity_status: artifact.subject_readback.identity_status,
    current_state: artifact.subject_readback.current_state,
    market_applicability: artifact.subject_readback.market_applicability,
    region_applicability: artifact.subject_readback.region_applicability,
    variant_key: artifact.subject_readback.variant_key,
    subject_semantic_key: artifact.subject_readback.subject_semantic_key,
    formulation_revision_key: artifact.subject_readback.formulation_revision_key
  },
  {
    subject_id: SUBJECT_ID,
    identity_status: "resolved",
    current_state: "current",
    market_applicability: "KR",
    region_applicability: null,
    variant_key: null,
    subject_semantic_key: SEMANTIC_KEY,
    formulation_revision_key: FORMULATION_KEY
  }
);

assert.equal(artifact.intake_readback.subject_id, SUBJECT_ID);
assert.equal(artifact.intake_readback.identity_state, "EXACT_SUBJECT_FOUND");
assert.equal(artifact.intake_readback.trust_state, "RESEARCH_PENDING");
assert.equal(artifact.intake_readback.presentation_relation_proven, true);
assert.equal(
  artifact.intake_readback.identity_authority.authority_kind,
  "admin_identity_authority"
);
assert.equal(
  artifact.intake_readback.identity_authority.source_content_digest,
  DIGEST
);
assert.equal(
  artifact.intake_readback.identity_authority.authority_resolution_version,
  "v21-8h-r13a-official-identity-v1"
);
assert.match(
  artifact.intake_readback.identity_authority.official_source_locator,
  /product_no=3324/
);

const expectedTasks = new Map([
  ["b1430a7d-79bb-43a5-bfea-a19599441811", "barrier_support_claim"],
  ["cbdad075-35a1-476e-b3ac-6279b676e73e", "primary_use_role"]
]);
assert.equal(artifact.tasks.length, 2);
for (const task of artifact.tasks) {
  assert.equal(task.fact_key, expectedTasks.get(task.id));
  assert.equal(task.state, "RESEARCH_PENDING");
  assert.equal(task.blocker_code, null);
  assert.equal(task.attempt_count, 0);
  assert.equal(task.subject_id, SUBJECT_ID);
  assert.equal(task.registry_version, "product-fact-registry-cross-category-v1");
}

assert.deepEqual(
  artifact.product_guard_fields.after,
  artifact.product_guard_fields.before
);
assert.equal(artifact.product_guard_fields.after.size_ml, 200);
assert.equal(artifact.product_guard_fields.after.recommendation_tier, "Tier1");
assert.match(artifact.product_guard_fields.after.buy_link, /product_no=3323/);

assert.equal(artifact.catalog_link_drift.detected, true);
assert.equal(
  artifact.catalog_link_drift.generic_governed_product_buy_link_update_rpc_available,
  false
);
assert.equal(artifact.catalog_link_drift.direct_sql_update_authorized, false);
assert.equal(
  artifact.catalog_link_drift.disposition,
  "SEPARATE_CATALOG_LINK_CORRECTION_DEBT"
);

assert.equal(
  artifact.zeroid_hold.product_id,
  "7a98b5e7-2c1f-441a-afee-dd1c592d95bc"
);
assert.equal(artifact.zeroid_hold.decision, "HOLD");
assert.equal(
  artifact.zeroid_hold.reason_code,
  "FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED"
);
assert.equal(artifact.zeroid_hold.subject_count, 0);
assert.equal(artifact.zeroid_hold.touched_in_r13b, false);

assert.deepEqual(artifact.authority_boundary, {
  subject_writes_observed: 1,
  evidence_writes_observed: 0,
  product_fact_instance_writes_observed: 0,
  product_fact_current_writes_observed: 0,
  confirmation_writes_observed: 0,
  automatic_evidence_adoption: false,
  automatic_fact_confirmation: false,
  recommendation_mutation: false,
  catalog_product_mutation: false,
  public_activation: false,
  production_cutover_authorized: false
});

assert.equal(
  artifact.next_gate.stage,
  "V2.1-8H-R13C_ATOPALM_OFFICIAL_EVIDENCE_RESEARCH"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.deepEqual(
  new Set(artifact.next_gate.required_fact_keys),
  new Set(["barrier_support_claim", "primary_use_role"])
);
assert.equal(artifact.next_gate.recommendation_activation_authorized, false);

console.log(JSON.stringify({
  status: "PASS",
  stage: artifact.stage,
  terminal: artifact.primary_terminal_outcome,
  productId: PRODUCT_ID,
  subjectId: SUBJECT_ID,
  subjectDelta: 1,
  factDelta: 0,
  evidenceDelta: 0
}));
