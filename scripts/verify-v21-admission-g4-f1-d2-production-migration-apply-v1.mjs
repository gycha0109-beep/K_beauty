#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d2-production-migration-apply-v1.json",
  "utf8"
));
const migration=fs.readFileSync(
  "supabase/migrations/20261003160200_v21_admission_g4_f1_category_authority_v1.sql",
  "utf8"
);
const d1=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d1-production-migration-preflight-v1.json",
  "utf8"
));

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F1-D2");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F1_D2_PRODUCTION_MIGRATION_APPLIED_PASS"
);
assert.equal(evidence.migration.applied,true);
assert.equal(
  evidence.migration.production_history_name,
  "v21_admission_g4_f1_category_authority_v1"
);

assert.equal(evidence.production_poststate.reviewed_grant_rows,0);
assert.equal(evidence.production_poststate.fation_legacy_category,null);
assert.equal(evidence.production_poststate.taxonomy_mode,"shadow/shadow_only");
assert.equal(
  evidence.production_poststate.assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);
assert.deepEqual(
  evidence.production_poststate.category_reader_runtime_result,
  {
    read_contract_version:"recommendation-category-authority-read-v1",
    status:"NO_AUTHORITY",
    reason:"CURRENT_CATEGORY_REVIEW_MISSING"
  }
);

for(const key of [
  "runtime_raw_ledger_select",
  "runtime_raw_taxonomy_select",
  "runtime_raw_taxonomy_version_select",
  "service_direct_ledger_select",
  "service_direct_ledger_insert",
  "runtime_writer_execute",
  "service_reader_execute",
  "postgres_reader_execute",
  "reader_owner_public_schema_create"
]){
  assert.equal(evidence.acl_poststate[key],false,key);
}
assert.equal(evidence.acl_poststate.service_writer_execute,true);
assert.equal(evidence.acl_poststate.runtime_reader_execute,true);

assert.equal(evidence.function_poststate.writer_owner,"postgres");
assert.equal(evidence.function_poststate.reader_owner,"recommendation_admission_reader_owner");
assert.equal(evidence.function_poststate.writer_security_definer,true);
assert.equal(evidence.function_poststate.reader_security_definer,true);
for(const key of [
  "writer_public_execute",
  "writer_anon_execute",
  "writer_authenticated_execute",
  "reader_public_execute",
  "reader_anon_execute",
  "reader_authenticated_execute"
]){
  assert.equal(evidence.function_poststate[key],false,key);
}

assert.equal(evidence.rls_poststate.ledger_rls_enabled,true);
assert.equal(evidence.rls_poststate.taxonomy_policy_exact_product_count,4);

assert.equal(evidence.owner_transfer_poststate.postgres_set_role_after,false);
assert.equal(evidence.owner_transfer_poststate.temporary_postgres_grant_residue,0);
assert.equal(evidence.owner_transfer_poststate.base_supabase_admin_membership_count,1);
assert.equal(evidence.owner_transfer_poststate.base_membership.admin_option,true);
assert.equal(evidence.owner_transfer_poststate.base_membership.inherit_option,false);
assert.equal(evidence.owner_transfer_poststate.base_membership.set_option,false);

assert.deepEqual(
  evidence.advisor_delta.security.authenticated_security_definer_function_executable,
  {before:2,after:2}
);
assert.equal(evidence.advisor_delta.security.g4_specific_new_warnings,0);
assert.deepEqual(
  evidence.advisor_delta.performance.unindexed_foreign_keys,
  {before:104,after:104}
);
assert.deepEqual(
  evidence.advisor_delta.performance.multiple_permissive_policies,
  {before:1,after:1}
);

assert.equal(evidence.failed_apply_history.length,3);
for(const x of evidence.failed_apply_history){
  assert.equal(x.residue_after_rollback,0);
}

for(const [key,value] of Object.entries(evidence.mutation_boundary)){
  assert.equal(value,false,key);
}

assert.equal(
  d1.next_gate,
  "V2.1-ADMISSION-G4-F1-D2_PRODUCTION_MIGRATION_APPLY"
);

for(const marker of [
  "recommendation_category_authority_reviews",
  "admin_register_recommendation_category_authority_review_v1",
  "read_recommendation_category_authority_v1",
  "with inherit false, set true, admin false",
  "'SET'",
  "G4_F1_TEMP_ROLE_GRANT_RESIDUE_FORBIDDEN"
]){
  assert.ok(migration.includes(marker),marker);
}

assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F1-D3_FATION_CATEGORY_AUTHORITY_REVIEW_PREFLIGHT"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  productionApplied:true,
  reviewedCategoryGrantRows:0,
  runtimeReaderStatus:
    evidence.production_poststate.category_reader_runtime_result.status,
  nextGate:evidence.next_gate
},null,2));
