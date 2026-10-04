#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d3-fation-category-authority-review-preflight-v1.json",
  "utf8"
));
const d2=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d2-production-migration-apply-v1.json",
  "utf8"
));
const migration=fs.readFileSync(
  "supabase/migrations/20261003160200_v21_admission_g4_f1_category_authority_v1.sql",
  "utf8"
);

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F1-D3");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F1_D3_FATION_CATEGORY_AUTHORITY_REVIEW_PREFLIGHT_PASS"
);
assert.equal(
  d2.next_gate,
  "V2.1-ADMISSION-G4-F1-D3_FATION_CATEGORY_AUTHORITY_REVIEW_PREFLIGHT"
);

assert.equal(evidence.reviewer_prestate.active_admin_memberships,1);
assert.equal(evidence.reviewer_prestate.eligible_product_review_actors,1);
assert.deepEqual(evidence.reviewer_prestate.eligible_roles,["admin_owner"]);
assert.equal(
  evidence.reviewer_prestate.required_capability,
  "admin.products.review"
);
assert.equal(
  evidence.reviewer_prestate.actor_uuid_persisted_in_repository,
  false
);

assert.equal(evidence.target.legacy_category,null);
assert.equal(evidence.target.category_term_id,"catalog-taxonomy-v1:category:treatment");
assert.equal(evidence.target.assignment_state,"shadow");
assert.equal(evidence.target.assignment_method,"source_classification");
assert.equal(evidence.target.legacy_projection_key,null);
assert.equal(
  evidence.target.candidate_id,
  "6a9627b6-a5da-458f-84f7-3a40f91453be"
);
assert.equal(
  evidence.target.source_rule_key,
  "catalog-taxonomy-v1:source:hwahae:treatment"
);
assert.equal(
  evidence.target.assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);
assert.equal(evidence.target.taxonomy_lifecycle_state,"shadow");
assert.equal(evidence.target.taxonomy_authority_mode,"shadow_only");

assert.equal(evidence.review_prestate.total_review_rows,0);
assert.equal(evidence.review_prestate.current_rows,0);
assert.equal(evidence.review_prestate.current_established_rows,0);
assert.equal(evidence.review_prestate.category_review_audit_events,0);
assert.equal(evidence.review_prestate.protected_reader_status,"NO_AUTHORITY");
assert.equal(
  evidence.review_prestate.protected_reader_reason,
  "CURRENT_CATEGORY_REVIEW_MISSING"
);

assert.equal(evidence.transport_prestate.writer_service_role_execute,true);
assert.equal(evidence.transport_prestate.reader_runtime_execute,true);
assert.equal(evidence.transport_prestate.direct_ledger_write_required,false);
assert.equal(evidence.transport_prestate.direct_ledger_write_forbidden,true);

const request=evidence.frozen_d4_request;
assert.equal(
  request.request_id,
  "v21-admission-g4-f1-d4-fation-category-authority-establish-v1"
);
assert.equal(request.actor_user_id,"RESOLVE_AT_EXECUTION_DO_NOT_PERSIST");
assert.deepEqual(Object.keys(request.payload).sort(),[
  "expected_assignment_snapshot_digest",
  "expected_category_term_id",
  "product_id",
  "review_state",
  "supersedes_review_id"
].sort());
assert.equal(request.payload.review_state,"established");
assert.equal(request.payload.supersedes_review_id,null);

for(const marker of [
  "admin_require_product_review_actor",
  "'admin.products.review'",
  "recommendation-category-authority-review-policy-v1",
  "recommendation_category_authority_supersedes_unexpected",
  "recommendation_category_authority_optimistic_lock_mismatch",
  "catalog-taxonomy-v1:category:treatment",
  "6a9627b6-a5da-458f-84f7-3a40f91453be",
  "catalog-taxonomy-v1:source:hwahae:treatment"
]){
  assert.ok(migration.includes(marker),marker);
}

assert.equal(
  evidence.d4_expected_writer_result.recommendation_admission_mutated,
  false
);
assert.equal(
  evidence.d4_expected_writer_result.production_cutover_authorized,
  false
);
assert.equal(
  evidence.d4_expected_poststate.protected_reader.status,
  "CATEGORY_AUTHORITY_RESOLVED"
);
assert.equal(
  evidence.d4_expected_poststate.recommendation_admission_unchanged,
  true
);

for(const value of Object.values(evidence.authority_boundary)){
  assert.equal(value,false);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F1-D4_FATION_CATEGORY_AUTHORITY_REVIEW_EXECUTION"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  eligibleReviewerCount:evidence.reviewer_prestate.eligible_product_review_actors,
  reviewRows:evidence.review_prestate.total_review_rows,
  frozenRequestId:evidence.frozen_d4_request.request_id,
  nextGate:evidence.next_gate
},null,2));
