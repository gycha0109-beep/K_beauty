#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildTrustSubjectIdentityProposal,
} from "../lib/admin/trust-subject-identity.js";

const evidence = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r3-cosrx-subject-identity-authority-upgrade-implementation-v1.json",
    "utf8",
  ),
);
const r2 = JSON.parse(
  fs.readFileSync(
    "evidence/product-fact-catalog-expansion-v1/data-ai29c-d5e-d-r2-cosrx-subject-identity-authority-upgrade-contract-v1.json",
    "utf8",
  ),
);
const sql = fs.readFileSync(evidence.migrationPath, "utf8");

assert.equal(evidence.stage, "DATA-AI29C-D5E-D-R3");
assert.equal(
  evidence.decision,
  "D5E_D_R3_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_IMPLEMENTATION_READY_NOT_DEPLOYED",
);
assert.equal(
  r2.decision,
  "D5E_D_R2_SUBJECT_IDENTITY_AUTHORITY_UPGRADE_CONTRACT_READY_DESIGN_ONLY",
);

for (const signature of [
  "product_fact_subject_identity_authority_upgrade_plan_v1(",
  "admin_preflight_product_fact_subject_identity_authority_upgrade_v1(",
  "admin_upgrade_product_fact_subject_identity_authority_v1(",
]) {
  assert.ok(sql.includes(signature), signature);
}

assert.ok(sql.includes("security definer"));
assert.ok(sql.includes("admin_require_product_review_actor"));
assert.ok(sql.includes("'admin.products.review'"));
assert.ok(sql.includes("product_fact_controlled_sha256_json_v1"));
assert.ok(sql.includes("pg_advisory_xact_lock"));
assert.ok(sql.includes("for update"));
assert.ok(sql.includes("d5e_d_r3_subject_authority_upgrade_stale_preflight"));

assert.ok(
  sql.includes(
    "identity_resolution_version = 'trust-phase5-admin-subject-review-v1'",
  ),
);
assert.ok(
  sql.includes(
    "identity_resolution_version = 'gpt-catalog-machine-subject-v1'",
  ),
);

const updateMatch = sql.match(
  /update public\.product_fact_subjects\s+set([\s\S]*?)where subject_id = v_subject_id/i,
);
assert.ok(updateMatch, "Subject update block missing");
const updateBlock = updateMatch[1];
assert.ok(updateBlock.includes("identity_resolution_version"));
assert.ok(updateBlock.includes("updated_at"));
for (const forbiddenColumn of [
  "subject_semantic_key",
  "variant_key",
  "formulation_revision_key",
  "formulation_label",
  "identity_status",
  "current_state",
  "market_applicability",
  "region_applicability",
  "valid_from",
  "valid_to",
  "predecessor_subject_id",
  "supersession_kind",
]) {
  assert.equal(
    updateBlock.includes(forbiddenColumn),
    false,
    `forbidden Subject mutation: ${forbiddenColumn}`,
  );
}

assert.ok(sql.includes("insert into public.product_fact_review_events"));
assert.ok(sql.includes("record_admin_audit_event"));
assert.ok(sql.includes("subject_identity_authority_upgraded"));
assert.ok(sql.includes("controlled_identity_authority_upgrade"));

for (const forbiddenWrite of [
  "update public.product_fact_current",
  "insert into public.product_fact_current",
  "update public.product_fact_instances",
  "insert into public.product_fact_instances",
  "update public.product_evidence_records",
  "insert into public.product_evidence_records",
  "update public.product_evidence_source_subject_bindings",
  "insert into public.product_evidence_source_subject_bindings",
  "update public.product_fact_research_tasks",
  "insert into public.product_fact_research_tasks",
  "update public.sunscreen_recommendation_semantic_field_reviews",
  "insert into public.sunscreen_recommendation_semantic_field_reviews",
]) {
  assert.equal(sql.toLowerCase().includes(forbiddenWrite), false, forbiddenWrite);
}

assert.ok(
  sql.includes(
    "revoke all on function public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1",
  ),
);
assert.ok(
  sql.includes(
    "grant execute on function public.admin_preflight_product_fact_subject_identity_authority_upgrade_v1",
  ),
);
assert.ok(
  sql.includes(
    "grant execute on function public.admin_upgrade_product_fact_subject_identity_authority_v1",
  ),
);
assert.ok(
  sql.includes(
    "d5e_d_r3_subject_authority_upgrade_direct_subject_update_exposed",
  ),
);

assert.deepEqual(evidence.successWriteSet.product_fact_subjects, {
  rows: 1,
  columns: ["identity_resolution_version", "updated_at"],
});
for (const key of [
  "ProductFact",
  "Evidence",
  "SourceBinding",
  "ResearchTask",
  "SemanticReview",
  "Taxonomy",
  "Recommendation",
]) {
  assert.equal(evidence.successWriteSet[key], 0, key);
}

const target = evidence.currentProductionExpectedPrestate;
const snapshot = {
  task: {
    id: "e5b6276b-f16a-4441-9a61-f7f9767064eb",
    intake_id: "f78e9366-6709-4c3e-8c36-4c643c805b56",
    product_id: target.productId,
    subject_id: target.subjectId,
    fact_key: "spf_value",
    registry_version: "product-fact-registry-cross-category-v1",
    state: "EVIDENCE_CANDIDATE",
    blocker_code: null,
    updated_at: "2026-10-02T20:19:48.245101+09:00",
  },
  intake: {
    id: "f78e9366-6709-4c3e-8c36-4c643c805b56",
    product_id: target.productId,
    source_candidate_id: target.sourceCandidateId,
    market: "KR",
    subject_id: target.subjectId,
    identity_state: "EXACT_SUBJECT_FOUND",
    trust_state: "RESEARCH_PENDING",
    updated_at: "2026-10-02T19:23:59.869316+09:00",
  },
  product: {
    id: target.productId,
    brand: "COSRX",
    name: "Ultra-Light Invisible Sunscreen SPF50 PA++++",
    category: null,
    product_form: null,
  },
  candidate: {
    id: target.sourceCandidateId,
    matched_product_id: target.productId,
    review_status: "promoted",
    identity_resolution_state: "resolved",
    identity_resolution_version: "crawler-identity-resolution-v1",
    identity_resolution_evidence: {
      authority_boundary: { product_fact_write_allowed: false },
    },
    promotion_payload: {
      recommendation_admission_allowed: false,
      product_fact_confirmation_allowed: false,
    },
    updated_at: "2026-10-02T19:23:59.869316+09:00",
  },
  tasks: [],
};
const proposal = buildTrustSubjectIdentityProposal(
  snapshot,
  r2.reviewedIdentity,
  { requireInitialReviewState: false },
);
assert.equal(proposal.payload.subject_semantic_key, target.subjectSemanticKey);
assert.equal(
  proposal.payload.identity_resolution_version,
  evidence.allowedTransition.to,
);

assert.equal(evidence.deploymentBoundary.productionMigrationApplied, false);
assert.equal(evidence.deploymentBoundary.productionPreflightExecuted, false);
assert.equal(evidence.deploymentBoundary.productionAuthorityUpgraded, false);
assert.equal(evidence.deploymentBoundary.admissionReevaluated, false);
assert.equal(evidence.deploymentBoundary.mixedShadowExecuted, false);

assert.equal(
  evidence.nextGate,
  "DATA-AI29C-D5E-D-R3-P_COSRX_PRODUCTION_PREFLIGHT",
);

console.log(JSON.stringify({
  status: "PASS",
  stage: evidence.stage,
  decision: evidence.decision,
  migration: evidence.migrationPath,
  onlyMutableSubjectColumn:
    evidence.allowedTransition.onlyMutableSubjectColumn,
  productionMigrationApplied:
    evidence.deploymentBoundary.productionMigrationApplied,
  productionAuthorityUpgraded:
    evidence.deploymentBoundary.productionAuthorityUpgraded,
  nextGate: evidence.nextGate,
}, null, 2));
