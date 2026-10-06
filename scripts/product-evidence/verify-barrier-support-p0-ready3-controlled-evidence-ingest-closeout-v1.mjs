#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-controlled-evidence-ingest-closeout-v1.json";
const parentPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-direct-evidence-ingest-preflight-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const parent = JSON.parse(fs.readFileSync(parentPath, "utf8"));

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], { encoding: "utf8" }).trim();

const taskId = "39449932-6c41-4762-bf39-e6848c9ad09a";
const subjectId = "84beae6f-72c8-424e-b561-c2c067fef9e0";
const propositionKey =
  "379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2";
const evidenceDigest =
  "fee6031cbf1683f03de5792d3521dd25b5257deca9b64160656de3453f7ddab9";

assert.equal(artifact.stage, "V2.1-8H-R12C");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_CONTROLLED_EVIDENCE_INGEST_PASS"
);

assert.equal(artifact.parent_authority.r12b_path, parentPath);
assert.equal(
  gitBlob(parentPath),
  artifact.parent_authority.r12b_git_blob_sha
);
assert.equal(
  parent.decision,
  artifact.parent_authority.r12b_decision
);
assert.equal(
  parent.next_gate.stage,
  "V2.1-8H-R12C_READY3_CONTROLLED_EVIDENCE_INGEST"
);
assert.equal(parent.next_gate.evidence_ingest_authorized, true);
assert.deepEqual(parent.next_gate.authorized_task_ids, [taskId]);
assert.equal(parent.next_gate.review_preparation_authorized, false);
assert.equal(parent.next_gate.confirmation_authorized, false);

assert.equal(artifact.execution.request_id, parent.planned_rpc.request_id);
assert.equal(
  artifact.execution.rpc,
  "admin_ingest_product_fact_evidence_v1(uuid,text,jsonb)"
);
assert.equal(artifact.execution.rpc_result_status, "evidence_recorded");
assert.equal(artifact.execution.source_inserted, true);
assert.equal(artifact.execution.binding_inserted, true);
assert.equal(artifact.execution.evidence_inserted, true);

assert.equal(artifact.target.task_id, taskId);
assert.equal(artifact.target.subject_id, subjectId);
assert.equal(
  artifact.target.subject_semantic_key,
  parent.target.subject_semantic_key
);
assert.equal(
  artifact.target.formulation_revision_key,
  parent.target.formulation_revision_key
);
assert.equal(artifact.target.fact_key, "primary_use_role");
assert.equal(artifact.target.value, "multi_area");
assert.equal(artifact.target.evidence_class, "usage_instruction");
assert.equal(artifact.target.proposition_key, propositionKey);
assert.equal(
  artifact.target.canonical_evidence_digest,
  evidenceDigest
);

assert.equal(
  artifact.production_readback.source.canonical_locator,
  parent.planned_rpc.payload.source.canonical_locator
);
assert.equal(
  artifact.production_readback.source.content_digest,
  parent.planned_rpc.payload.source.content_digest
);
assert.equal(artifact.production_readback.source.market, "KR");

assert.equal(
  artifact.production_readback.binding.binding_state,
  "equivalent_presentation_match"
);
assert.equal(
  artifact.production_readback.binding.scope_relation,
  "equivalent"
);
assert.equal(artifact.production_readback.binding.bundle_units, 2);
assert.equal(
  artifact.production_readback.binding.identity_resolution_version,
  "v21-8h-r10-official-identity-v1"
);

assert.equal(
  artifact.production_readback.evidence.registry_version,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  artifact.production_readback.evidence.proposition_serializer_version,
  "product-fact-proposition-pilot-v1"
);
assert.equal(
  artifact.production_readback.evidence.proposition_value_identity,
  "multi_area"
);
assert.equal(
  artifact.production_readback.evidence.evidence_authority,
  "product_specific_primary"
);
assert.equal(artifact.production_readback.evidence.confidence, "high");
assert.equal(
  artifact.production_readback.evidence.support_direction,
  "supports"
);
assert.equal(
  artifact.production_readback.evidence.negative_admissibility,
  "not_applicable"
);
assert.equal(artifact.production_readback.evidence.market, "KR");
assert.deepEqual(artifact.production_readback.evidence.qualifier, {});
assert.equal(
  artifact.production_readback.evidence.supersedes_evidence_id,
  null
);

assert.deepEqual(artifact.production_ids, {
  source_id: "e6b24da7-5f48-43a1-a2ba-f46fad063cf2",
  binding_id: "15bf791d-a36a-4214-b7ce-f1b38559ae11",
  evidence_id: "45b57536-0637-44e0-b427-bb55923c4812",
  audit_id: "f92570f5-d00e-4f49-b1dd-21db1a28cd1f"
});

assert.equal(
  artifact.production_readback.review_event.event_kind,
  "evidence_ingested"
);
assert.equal(
  artifact.production_readback.review_event.reason_code,
  "controlled_ingest"
);
assert.equal(
  artifact.production_readback.review_event.request_id,
  "v21-8h-r12c-etude-role-ingest"
);

assert.equal(
  artifact.production_readback.audit.required_capability,
  "admin.products.review"
);
assert.equal(
  artifact.production_readback.audit.action,
  "admin.product_fact.evidence_ingested"
);
assert.equal(
  artifact.production_readback.audit.target_type,
  "product_evidence_record"
);
assert.equal(
  artifact.production_readback.audit.target_id,
  artifact.production_ids.evidence_id
);
assert.equal(
  artifact.production_readback.audit.request_id,
  "v21-8h-r12c-etude-role-ingest"
);

assert.deepEqual(artifact.production_readback.task, {
  state: "RESEARCH_PENDING",
  blocker_code: null,
  attempt_count: 0,
  registry_version: "product-fact-registry-cross-category-v1"
});

assert.equal(artifact.production_counts.evidence_records_before, 107);
assert.equal(artifact.production_counts.evidence_records_after, 108);
assert.equal(
  artifact.production_counts.evidence_records_after -
    artifact.production_counts.evidence_records_before,
  1
);
assert.equal(artifact.production_counts.product_fact_subjects, 50);
assert.equal(artifact.production_counts.target_subject_fact_instances, 0);
assert.equal(artifact.production_counts.target_subject_current_facts, 0);
assert.equal(artifact.production_counts.target_evidence_links, 0);

for (const [key, expected] of Object.entries({
  committed_source_writes: 1,
  committed_binding_writes: 1,
  committed_evidence_writes: 1,
  committed_review_events: 1,
  committed_audit_rows: 1,
  committed_fact_instance_writes: 0,
  committed_product_fact_current_writes: 0,
  committed_confirmation_writes: 0,
  committed_evidence_links: 0,
  committed_recommendation_writes: 0,
  review_preparation_authorized: false,
  confirmation_preflight_authorized: false,
  confirmation_authorized: false,
  recommendation_activation_authorized: false,
  public_activation: false
})) {
  assert.equal(artifact.authority_boundary[key], expected, key);
}

assert.equal(
  artifact.next_gate.stage,
  "V2.1-8H-R12D_READY3_REVIEW_PREPARATION_PREFLIGHT"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.deepEqual(
  artifact.next_gate.candidate_evidence_ids,
  [artifact.production_ids.evidence_id]
);
assert.equal(artifact.next_gate.review_preparation_authorized, false);
assert.equal(
  artifact.next_gate.confirmation_preflight_authorized,
  false
);
assert.equal(artifact.next_gate.confirmation_authorized, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: artifact.stage,
    decision: artifact.decision,
    evidenceId: artifact.production_ids.evidence_id,
    evidenceDelta:
      artifact.production_counts.evidence_records_after -
      artifact.production_counts.evidence_records_before,
    targetFactInstances: artifact.production_counts.target_subject_fact_instances,
    targetCurrentFacts: artifact.production_counts.target_subject_current_facts
  })
);
