#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const artifactPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-direct-evidence-ingest-preflight-v1.json";
const r12Path =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-official-evidence-research-v1.json";
const r12aPath =
  "evidence/product-decision-axis-non-numeric-shadow-v2/barrier-support-p0-ready3-official-source-gap-recovery-v1.json";

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const r12 = JSON.parse(fs.readFileSync(r12Path, "utf8"));
const r12a = JSON.parse(fs.readFileSync(r12aPath, "utf8"));

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])])
    );
  }
  return value;
};

const sha256 = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(value)))
    .digest("hex");

const gitBlob = (path) =>
  execFileSync("git", ["hash-object", path], {
    encoding: "utf8"
  }).trim();

assert.equal(artifact.stage, "V2.1-8H-R12B");
assert.equal(
  artifact.decision,
  "BARRIER_SUPPORT_P0_READY3_DIRECT_EVIDENCE_INGEST_PREFLIGHT_PASS"
);

assert.equal(
  artifact.parent_authority.r12.path,
  r12Path
);
assert.equal(
  artifact.parent_authority.r12a.path,
  r12aPath
);
assert.equal(
  gitBlob(r12Path),
  artifact.parent_authority.r12.git_blob_sha
);
assert.equal(
  gitBlob(r12aPath),
  artifact.parent_authority.r12a.git_blob_sha
);
assert.equal(
  r12.terminal,
  artifact.parent_authority.r12.terminal
);
assert.equal(
  r12a.terminal,
  artifact.parent_authority.r12a.terminal
);

const taskId = "39449932-6c41-4762-bf39-e6848c9ad09a";
const productId = "b1f6b527-679f-48f3-9b58-5d28ec095f2f";
const subjectId = "84beae6f-72c8-424e-b561-c2c067fef9e0";
const semanticKey =
  "028945101121562f1f5470a44fd1a7974477a7c8a50cd6954102993fb087650d";
const formulationKey =
  "v21-8h-r10:a8a01568cf96737549c033542599a2d94e843367d0c876774262f0b409125327";

const parentTask = r12.task_results.find(
  (task) => task.task_id === taskId
);
assert.ok(parentTask);
assert.equal(parentTask.product_id, productId);
assert.equal(parentTask.subject_id, subjectId);
assert.equal(parentTask.fact_key, "primary_use_role");
assert.equal(parentTask.outcome, "DIRECT_EVIDENCE_FOUND");
assert.equal(parentTask.proposed_value, "multi_area");
assert.equal(parentTask.evidence_class, "usage_instruction");
assert.deepEqual(parentTask.source_ids, ["etude_bundle_kr"]);

const parentSource = r12.source_captures.find(
  (source) => source.source_id === "etude_bundle_kr"
);
assert.ok(parentSource);
assert.equal(parentSource.product_id, productId);
assert.equal(parentSource.subject_id, subjectId);
assert.equal(parentSource.market, "KR");
assert.equal(
  parentSource.canonical_capture_digest,
  "a7eb1b96d8551cc88727abedfda7a758e801d5a78eec4acee1de040d970846dc"
);

assert.equal(artifact.target.task_id, taskId);
assert.equal(artifact.target.product_id, productId);
assert.equal(artifact.target.subject_id, subjectId);
assert.equal(artifact.target.subject_semantic_key, semanticKey);
assert.equal(artifact.target.formulation_revision_key, formulationKey);
assert.equal(artifact.target.market, "KR");
assert.equal(artifact.target.identity_status, "resolved");
assert.equal(artifact.target.current_state, "current");
assert.equal(artifact.target.task_state, "RESEARCH_PENDING");
assert.equal(artifact.target.task_attempt_count, 0);
assert.equal(artifact.target.task_blocker_code, null);
assert.equal(artifact.target.proposed_value, "multi_area");
assert.equal(artifact.target.evidence_class, "usage_instruction");

assert.equal(
  artifact.runtime_contract.ingest_function_sha256,
  "c5bf2429801f3f5811c41d3c39fbddff3eca2914bccb59f100321f369264b481"
);
assert.equal(artifact.runtime_contract.anon_execute, false);
assert.equal(artifact.runtime_contract.authenticated_execute, false);
assert.equal(artifact.runtime_contract.service_role_execute, true);
assert.equal(
  artifact.runtime_contract.required_capability,
  "admin.products.review"
);

assert.equal(
  artifact.registry_contract.version,
  "product-fact-registry-cross-category-v1"
);
assert.equal(
  artifact.registry_contract.checksum,
  "79d41ac13de8080df5199543e31ad7bbc1c1763836ef776313613b7547b79575"
);
assert.equal(artifact.registry_contract.fact_key, "primary_use_role");
assert.equal(artifact.registry_contract.value_type, "enum");
assert.equal(artifact.registry_contract.allowed_value, "multi_area");
assert.equal(
  artifact.registry_contract.evidence_class,
  "usage_instruction"
);
assert.equal(artifact.registry_contract.deprecated, false);

const proposition = artifact.digest_contract.proposition;
assert.equal(
  proposition.version,
  "product-fact-proposition-pilot-v1"
);
assert.equal(
  sha256(proposition.material),
  proposition.proposition_key
);
assert.equal(
  proposition.proposition_key,
  "379a68e4b599cbcc5583b0a830b3718c3f5af0fc52ec62d4d823a728626834d2"
);

const evidenceDigest = artifact.digest_contract.evidence;
assert.equal(evidenceDigest.version, "v21-8g3-evidence-v1");
assert.equal(
  sha256(evidenceDigest.material),
  evidenceDigest.canonical_evidence_digest
);
assert.equal(
  evidenceDigest.canonical_evidence_digest,
  "fee6031cbf1683f03de5792d3521dd25b5257deca9b64160656de3453f7ddab9"
);

const payload = artifact.planned_rpc.payload;
assert.equal(
  artifact.planned_rpc.request_id,
  "v21-8h-r12c-etude-role-ingest"
);
assert.equal(
  payload.source.canonical_locator,
  parentSource.source_locator
);
assert.equal(
  payload.source.content_digest,
  parentSource.canonical_capture_digest
);
assert.equal(payload.source.market, "KR");
assert.equal(
  payload.source.source_metadata.research_source_id,
  "etude_bundle_kr"
);
assert.match(
  payload.source.source_metadata.content_digest_basis,
  /canonical frozen R12 source capture/
);

assert.equal(payload.binding.product_id, productId);
assert.equal(payload.binding.subject_id, subjectId);
assert.equal(
  payload.binding.binding_state,
  "equivalent_presentation_match"
);
assert.equal(payload.binding.scope_relation, "equivalent");
assert.equal(
  payload.binding.presentation_metadata.subject_semantic_key,
  semanticKey
);
assert.equal(
  payload.binding.presentation_metadata.formulation_revision_key,
  formulationKey
);
assert.equal(
  payload.binding.presentation_metadata.bundle_units,
  2
);
assert.equal(
  payload.binding.identity_resolution_version,
  "v21-8h-r10-official-identity-v1"
);

assert.equal(
  payload.evidence.registry_version,
  artifact.registry_contract.version
);
assert.equal(payload.evidence.fact_key, "primary_use_role");
assert.equal(
  payload.evidence.proposition_key,
  proposition.proposition_key
);
assert.equal(
  payload.evidence.proposition_serializer_version,
  proposition.version
);
assert.equal(
  payload.evidence.proposition_value_identity,
  "multi_area"
);
assert.equal(payload.evidence.evidence_class, "usage_instruction");
assert.equal(
  payload.evidence.evidence_authority,
  "product_specific_primary"
);
assert.equal(payload.evidence.confidence, "high");
assert.equal(payload.evidence.support_direction, "supports");
assert.equal(
  payload.evidence.negative_admissibility,
  "not_applicable"
);
assert.equal(payload.evidence.market, "KR");
assert.deepEqual(payload.evidence.qualifier, {});
assert.equal(
  payload.evidence.canonical_evidence_digest,
  evidenceDigest.canonical_evidence_digest
);

assert.equal(artifact.production_prestate.target_source_rows, 0);
assert.equal(
  artifact.production_prestate.target_subject_binding_rows,
  0
);
assert.equal(
  artifact.production_prestate.target_proposition_evidence_rows,
  0
);
assert.equal(
  artifact.production_prestate.target_subject_fact_instances,
  0
);
assert.equal(
  artifact.production_prestate.target_subject_current_facts,
  0
);

assert.equal(artifact.rollback_probe.rpc_calls_attempted, 1);
assert.equal(artifact.rollback_probe.rpc_calls_accepted, 1);
assert.deepEqual(artifact.rollback_probe.in_transaction, {
  target_source_rows: 1,
  target_binding_rows: 1,
  target_evidence_rows: 1,
  target_subject_fact_instances: 0,
  target_subject_current_facts: 0
});
assert.deepEqual(artifact.rollback_probe.post_rollback, {
  target_source_rows: 0,
  target_binding_rows: 0,
  target_evidence_rows: 0,
  target_review_events: 0,
  target_audit_rows: 0,
  target_subject_fact_instances: 0,
  target_subject_current_facts: 0
});

for (const [key, expected] of Object.entries({
  committed_source_writes: 0,
  committed_binding_writes: 0,
  committed_evidence_writes: 0,
  committed_fact_instance_writes: 0,
  committed_confirmation_writes: 0,
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
  "V2.1-8H-R12C_READY3_CONTROLLED_EVIDENCE_INGEST"
);
assert.equal(artifact.next_gate.status, "NOT_EXECUTED");
assert.equal(artifact.next_gate.authorized_candidate_count, 1);
assert.deepEqual(
  artifact.next_gate.authorized_task_ids,
  [taskId]
);
assert.equal(
  artifact.next_gate.allowed_rpc,
  "admin_ingest_product_fact_evidence_v1"
);
assert.equal(artifact.next_gate.evidence_ingest_authorized, true);
assert.equal(
  artifact.next_gate.review_preparation_authorized,
  false
);
assert.equal(artifact.next_gate.confirmation_authorized, false);

console.log(
  JSON.stringify({
    status: "PASS",
    stage: artifact.stage,
    decision: artifact.decision,
    candidateTask: taskId,
    propositionKey: proposition.proposition_key,
    evidenceDigest: evidenceDigest.canonical_evidence_digest,
    rollbackResidue: 0
  })
);
