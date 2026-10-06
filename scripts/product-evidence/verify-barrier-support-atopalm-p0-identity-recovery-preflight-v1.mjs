#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";

const ROOT = "evidence/product-decision-axis-non-numeric-shadow-v2";
const ARTIFACT = `${ROOT}/barrier-support-atopalm-p0-identity-recovery-preflight-v1.json`;
const R12H = `${ROOT}/barrier-support-p0-ready3-post-confirmation-pda-recommendation-invariance-v1.json`;
const R9_RESEARCH = `${ROOT}/barrier-support-p0-official-identity-authority-research-v1.json`;
const R9_LEDGER = `${ROOT}/barrier-support-p0-official-identity-decision-ledger-v1.json`;

const artifact = JSON.parse(fs.readFileSync(ARTIFACT, "utf8"));
const r12h = JSON.parse(fs.readFileSync(R12H, "utf8"));
const r9Research = JSON.parse(fs.readFileSync(R9_RESEARCH, "utf8"));
const r9Ledger = JSON.parse(fs.readFileSync(R9_LEDGER, "utf8"));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stable(value[key])])
    );
  }
  return value;
}

function sha256Json(value) {
  return createHash("sha256")
    .update(JSON.stringify(stable(value)), "utf8")
    .digest("hex");
}

function gitBlob(path) {
  const buffer = fs.readFileSync(path);
  return createHash("sha1")
    .update(`blob ${buffer.length}\0`)
    .update(buffer)
    .digest("hex");
}

const PRODUCT_ID = "418e2bc1-7d6c-4334-9058-7af7ce159c6c";
const ZEROID_ID = "7a98b5e7-2c1f-441a-afee-dd1c592d95bc";
const CAPTURE_DIGEST =
  "50d690c76745f352907a9c1e22e47346de6bc95c5ad933871fc22c33c1dec4ac";
const FORMULATION_KEY = `v21-8h-r13a:${CAPTURE_DIGEST}`;
const SEMANTIC_KEY =
  "f6665f595558d93a4887f63ae5574db014020602e67c59097699d2a40402850b";

assert.equal(artifact.stage, "V2.1-8H-R13A");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_ATOPALM_P0_IDENTITY_RECOVERY_PREFLIGHT_PASS"
);

assert.equal(artifact.parent_authority.r12h_path, R12H);
assert.equal(
  gitBlob(R12H),
  artifact.parent_authority.r12h_git_blob_sha
);
assert.equal(
  r12h.decision,
  artifact.parent_authority.r12h_decision
);
assert.equal(
  gitBlob(R9_RESEARCH),
  artifact.parent_authority.r9_research_git_blob_sha
);
assert.equal(
  gitBlob(R9_LEDGER),
  artifact.parent_authority.r9_ledger_git_blob_sha
);
assert.equal(
  artifact.parent_authority.prior_atopalm_reason_code,
  "BUNDLE_PRESENTATION_SCOPE_UNRESOLVED"
);

const r9Atopalm = (r9Ledger.decisions ?? []).find(
  (item) => item.product_id === PRODUCT_ID
);
const r9Zeroid = (r9Ledger.decisions ?? []).find(
  (item) => item.product_id === ZEROID_ID
);
assert.ok(r9Atopalm);
assert.ok(r9Zeroid);
assert.equal(r9Atopalm.decision, "HOLD");
assert.equal(
  r9Atopalm.reason_code,
  "BUNDLE_PRESENTATION_SCOPE_UNRESOLVED"
);
assert.equal(r9Zeroid.decision, "HOLD");
assert.equal(
  r9Zeroid.reason_code,
  "FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED"
);

assert.equal(
  artifact.refresh_context.unresolved_ready3_official_evidence_gaps,
  5
);
assert.equal(
  artifact.refresh_context.newly_admissible_direct_evidence_from_refresh,
  0
);

assert.equal(artifact.target.product_id, PRODUCT_ID);
assert.equal(artifact.target.catalog_size_ml, 200);
assert.equal(artifact.target.catalog_external_source, "hwahae");
assert.equal(artifact.target.catalog_external_type, "goods");
assert.equal(artifact.target.catalog_external_id, "74373");

assert.equal(artifact.official_identity_recovery.decision, "READY");
assert.equal(
  artifact.official_identity_recovery.recovered_reason_code,
  "FIRST_PARTY_EXACT_BUNDLE_PRESENTATION_ESTABLISHED"
);
assert.equal(
  artifact.official_identity_recovery.prior_ambiguity_resolved,
  true
);
assert.equal(
  artifact.official_identity_recovery.single_unit.presentation,
  "100ml"
);
assert.equal(
  artifact.official_identity_recovery.bundle.presentation,
  "100ml ×2개 세트"
);
assert.equal(artifact.official_identity_recovery.bundle.total_ml, 200);
assert.equal(artifact.official_identity_recovery.bundle.unit_size_ml, 100);
assert.equal(artifact.official_identity_recovery.bundle.unit_count, 2);

assert.equal(sha256Json(artifact.canonical_capture), CAPTURE_DIGEST);
assert.equal(artifact.capture_digest, CAPTURE_DIGEST);
assert.equal(
  artifact.semantic_identity.formulation_revision_key,
  FORMULATION_KEY
);
assert.equal(
  sha256Json(artifact.semantic_identity),
  SEMANTIC_KEY
);
assert.equal(artifact.subject_semantic_key, SEMANTIC_KEY);
assert.equal(artifact.semantic_identity.product_id, PRODUCT_ID);
assert.equal(artifact.semantic_identity.variant_key, null);
assert.equal(artifact.semantic_identity.market_applicability, "KR");
assert.equal(artifact.semantic_identity.region_applicability, null);
assert.equal(artifact.semantic_identity.valid_from, null);
assert.equal(artifact.semantic_identity.valid_to, null);

assert.deepEqual(artifact.reviewed_identity, {
  variantKey: null,
  variantKeyReviewedAsNull: true,
  formulationRevisionKey: FORMULATION_KEY,
  formulationLabel: "KR official identity — 릴렉싱 나이트 밤 100ml ×2개 세트",
  marketApplicability: "KR",
  regionApplicability: null,
  validFrom: null,
  validTo: null
});

assert.deepEqual(
  Object.keys(artifact.intake_identity_payload).sort(),
  [
    "expected_updated_at",
    "identity_resolution_version",
    "intake_id",
    "market",
    "official_source_locator",
    "resolution_reason",
    "source_content_digest"
  ]
);
assert.equal(
  artifact.intake_identity_payload.intake_id,
  "70486cba-1578-4a3a-a82e-70a0285ca94f"
);
assert.equal(artifact.intake_identity_payload.market, "KR");
assert.equal(
  artifact.intake_identity_payload.identity_resolution_version,
  "v21-8h-r13a-official-identity-v1"
);
assert.equal(
  artifact.intake_identity_payload.source_content_digest,
  CAPTURE_DIGEST
);
assert.equal(
  artifact.intake_identity_payload.expected_updated_at,
  "2026-09-21T00:53:50.755843+09:00"
);

assert.deepEqual(
  Object.keys(artifact.subject_registration_payload).sort(),
  [
    "current_state",
    "formulation_label",
    "formulation_revision_key",
    "identity_resolution_version",
    "identity_status",
    "market_applicability",
    "predecessor_subject_id",
    "product_id",
    "region_applicability",
    "subject_identity_serializer_version",
    "subject_semantic_key",
    "supersession_kind",
    "valid_from",
    "valid_to",
    "variant_key"
  ]
);
assert.equal(artifact.subject_registration_payload.product_id, PRODUCT_ID);
assert.equal(
  artifact.subject_registration_payload.subject_semantic_key,
  SEMANTIC_KEY
);
assert.equal(
  artifact.subject_registration_payload.subject_identity_serializer_version,
  "product-fact-subject-identity-v1"
);
assert.equal(
  artifact.subject_registration_payload.formulation_revision_key,
  FORMULATION_KEY
);
assert.equal(
  artifact.subject_registration_payload.identity_resolution_version,
  "trust-phase5-admin-subject-review-v1"
);
assert.equal(
  artifact.subject_registration_payload.identity_status,
  "resolved"
);
assert.equal(
  artifact.subject_registration_payload.current_state,
  "current"
);
assert.equal(
  artifact.subject_registration_payload.market_applicability,
  "KR"
);
assert.equal(artifact.subject_registration_payload.variant_key, null);
assert.equal(
  artifact.subject_registration_payload.predecessor_subject_id,
  null
);
assert.equal(
  artifact.subject_registration_payload.supersession_kind,
  null
);

assert.deepEqual(
  {
    product_fact_subject_total:
      artifact.production_prestate.product_fact_subject_total,
    product_fact_current:
      artifact.production_prestate.product_fact_current,
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
assert.equal(artifact.production_prestate.existing_target_subjects, 0);
assert.equal(artifact.production_prestate.target_current_facts, 0);
assert.equal(artifact.production_prestate.target_fact_instances, 0);
assert.equal(artifact.production_prestate.semantic_key_collisions, 0);
assert.equal(artifact.production_prestate.formulation_key_collisions, 0);
assert.equal(
  artifact.production_prestate.competing_current_kr_subjects,
  0
);
assert.equal(artifact.production_prestate.target_source_candidates, 0);
assert.equal(
  artifact.production_prestate.intake.identity_state,
  "SUBJECT_CREATION_REQUIRED"
);
assert.equal(
  artifact.production_prestate.intake.trust_state,
  "REVIEW_REQUIRED"
);
assert.equal(artifact.production_prestate.intake.market, null);
assert.equal(artifact.production_prestate.intake.subject_id, null);
assert.equal(artifact.production_prestate.tasks.length, 2);
assert.deepEqual(
  new Set(artifact.production_prestate.tasks.map((task) => task.fact_key)),
  new Set(["barrier_support_claim", "primary_use_role"])
);
for (const task of artifact.production_prestate.tasks) {
  assert.equal(task.state, "REVIEW_REQUIRED");
  assert.equal(task.blocker_code, "SUBJECT_CREATION_REQUIRED");
  assert.equal(task.attempt_count, 0);
  assert.equal(task.subject_id, null);
  assert.equal(
    task.registry_version,
    "product-fact-registry-cross-category-v1"
  );
}

const expectedFunctions = {
  intake_identity: [
    "admin_resolve_catalog_trust_intake_identity_v1(uuid,text,jsonb)",
    "e4d3309d34b74beb1737297b727b3647991822628a1e31c199e1475982907d12"
  ],
  subject_registration: [
    "admin_register_product_fact_subject_v1(uuid,text,jsonb)",
    "379b9da9b8b1e521876b30f1a2d04d6da7a7f3bf6ab7e145875636c6eddf0418"
  ],
  post_registration_reprocess: [
    "process_catalog_trust_product_v3(uuid,text)",
    "2d4e9115e0a4f753c53bdfcff4aa29fbbeb0aa431c0d1b2a62efbd98caf3b12e"
  ]
};
for (const [key, [signature, hash]] of Object.entries(expectedFunctions)) {
  const fn = artifact.function_contracts[key];
  assert.equal(fn.signature, signature);
  assert.equal(fn.function_sha256, hash);
  assert.equal(fn.anon_execute, false);
  assert.equal(fn.authenticated_execute, false);
  assert.equal(fn.service_role_execute, true);
}
assert.equal(
  artifact.function_contracts.post_registration_reprocess
    .nested_identity_authority_preserved,
  true
);

assert.equal(artifact.catalog_link_drift.detected, true);
assert.equal(
  artifact.catalog_link_drift.generic_governed_product_buy_link_update_rpc_available,
  false
);
assert.equal(
  artifact.catalog_link_drift.direct_sql_update_authorized,
  false
);
assert.equal(
  artifact.catalog_link_drift.identity_authority_uses_catalog_buy_link,
  false
);
assert.equal(
  artifact.catalog_link_drift.disposition,
  "SEPARATE_CATALOG_LINK_CORRECTION_DEBT"
);

assert.equal(artifact.zeroid_hold.product_id, ZEROID_ID);
assert.equal(artifact.zeroid_hold.decision, "HOLD");
assert.equal(
  artifact.zeroid_hold.reason_code,
  "FIRST_PARTY_PRESENTATION_SIZE_UNCONFIRMED"
);
assert.equal(
  artifact.zeroid_hold.first_party_40ml_presentation_confirmed,
  false
);

for (const value of Object.values(artifact.preflight_checks)) {
  assert.equal(value, true);
}

assert.deepEqual(artifact.authority_boundary, {
  production_writes: 0,
  intake_mutation_authorized_in_r13a: false,
  subject_registration_authorized_in_r13a: false,
  task_mutation_authorized_in_r13a: false,
  evidence_ingest_authorized_in_r13a: false,
  product_fact_confirmation_authorized_in_r13a: false,
  recommendation_admission_authorized: false,
  recommendation_activation_authorized: false,
  public_activation: false,
  production_cutover_authorized: false
});

assert.equal(
  artifact.next_gate.stage,
  "V2.1-8H-R13B_ATOPALM_CONTROLLED_IDENTITY_AND_SUBJECT_REGISTRATION"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.equal(artifact.next_gate.target_product_id, PRODUCT_ID);
assert.deepEqual(artifact.next_gate.required_sequence, [
  "admin_resolve_catalog_trust_intake_identity_v1",
  "process_catalog_trust_product_v3",
  "controlled subject registration preflight",
  "admin_register_product_fact_subject_v1",
  "process_catalog_trust_product_v3",
  "production readback"
]);
assert.equal(
  artifact.next_gate.evidence_research_after_subject_registration_only,
  true
);

console.log(JSON.stringify({
  status: "PASS",
  stage: artifact.stage,
  decision: artifact.decision,
  productId: PRODUCT_ID,
  captureDigest: CAPTURE_DIGEST,
  subjectSemanticKey: SEMANTIC_KEY,
  zeroidHold: true,
  productionWrites: 0
}));
