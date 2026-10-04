#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migration=fs.readFileSync(
  "supabase/migrations/20261003160200_v21_admission_g4_f1_category_authority_v1.sql",
  "utf8"
);
const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-d1-production-migration-preflight-v1.json",
  "utf8"
));
const f1=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-category-authority-infrastructure-v1.json",
  "utf8"
));

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F1-D1");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F1_D1_PRODUCTION_MIGRATION_PREFLIGHT_PASS"
);
assert.equal(evidence.mode,"READ_ONLY_PRODUCTION_PREFLIGHT");
assert.equal(evidence.production_write_count,0);
assert.equal(evidence.migration.production_history_present,false);
assert.equal(evidence.migration.production_apply_executed,false);
assert.equal(
  f1.next_gate,
  "V2.1-ADMISSION-G4-F1-D1_PRODUCTION_MIGRATION_PREFLIGHT"
);

assert.equal(evidence.production_object_absence.ledger_table,false);
assert.equal(evidence.production_object_absence.admin_writer,false);
assert.equal(evidence.production_object_absence.protected_reader,false);
assert.equal(evidence.production_object_absence.g4_f1_policies,0);

assert.equal(evidence.target_prestate.legacy_category,null);
assert.equal(evidence.target_prestate.assignment_state,"shadow");
assert.equal(evidence.target_prestate.assignment_method,"source_classification");
assert.equal(evidence.target_prestate.legacy_projection_key,null);
assert.equal(
  evidence.target_prestate.assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);
assert.equal(evidence.target_prestate.taxonomy_lifecycle_state,"shadow");
assert.equal(evidence.target_prestate.taxonomy_authority_mode,"shadow_only");

assert.equal(
  evidence.role_prestate.postgres_reader_owner_membership.member,
  true
);
assert.equal(
  evidence.role_prestate.postgres_reader_owner_membership.admin_option,
  true
);
assert.equal(
  evidence.role_prestate.recommendation_admission_runtime.raw_taxonomy_select,
  false
);
assert.equal(
  evidence.role_prestate.recommendation_admission_runtime.raw_taxonomy_version_select,
  false
);

assert.equal(
  evidence.existing_authority_prestate.d5c_taxonomy_policy.exact_product_ids.length,
  3
);
assert.equal(evidence.database_compatibility.postgres_version,"17.6");
assert.equal(evidence.database_compatibility.gen_random_uuid_available,true);
assert.equal(evidence.database_compatibility.hashtextextended_available,true);

assert.equal(evidence.d1_corrections.length,3);

assert.ok(
  migration.includes("G4_F1_POSTGRES_READER_OWNER_MEMBERSHIP_REQUIRED")
);

assert.ok(
  migration.includes("do $g4_f1_membership$")
);
assert.ok(
  migration.includes("$g4_f1_membership$;")
);
assert.equal(
  /(^|\n)do \$(?:\n|\r\n)/.test(migration),
  false,
  "malformed anonymous DO delimiter must not be committed"
);
assert.ok(
  migration.includes("G4_F1_POSTGRES_READER_OWNER_MEMBERSHIP_MUST_PERSIST")
);
assert.equal(
  migration.includes("grant recommendation_admission_reader_owner to postgres"),
  false
);
assert.equal(
  migration.includes("revoke recommendation_admission_reader_owner from postgres"),
  false
);

assert.ok(
  migration.includes(
    "drop policy if exists\n  data_ai29c_d5c_admission_reader_taxonomy_select_v1"
  )
);
assert.equal(
  migration.includes("g4_f1_admission_reader_fation_taxonomy_select_v1"),
  false
);
for(const id of [
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d"
]){
  assert.ok(migration.includes(id));
}
assert.ok(
  migration.includes("G4_F1_TAXONOMY_READER_POLICY_CARDINALITY_INVALID")
);

for(const index of [
  "recommendation_category_authority_product_idx",
  "recommendation_category_authority_candidate_idx",
  "recommendation_category_authority_supersedes_idx",
  "recommendation_category_authority_reviewer_idx"
]){
  assert.ok(migration.includes(index),`missing FK index: ${index}`);
}

assert.equal(
  evidence.expected_post_apply.category_reader_initial_result.status,
  "NO_AUTHORITY"
);
assert.equal(
  evidence.expected_post_apply.category_reader_initial_result.reason,
  "CURRENT_CATEGORY_REVIEW_MISSING"
);
assert.equal(evidence.expected_post_apply.reviewed_grant_rows,0);
assert.equal(evidence.expected_post_apply.g3_runtime_wired,false);
assert.equal(
  evidence.expected_post_apply.recommendation_admission_mutated,
  false
);

assert.equal(
  evidence.expected_post_apply.performance_advisor
    .new_multiple_permissive_policy_for_taxonomy_reader,
  false
);
assert.equal(
  evidence.expected_post_apply.performance_advisor
    .new_unindexed_foreign_key_for_ledger,
  false
);
assert.equal(
  evidence.expected_post_apply.security_advisor
    .authenticated_security_definer_delta,
  0
);

for(const value of Object.values(evidence.authority_boundary)){
  assert.equal(value,false);
}
assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F1-D2_PRODUCTION_MIGRATION_APPLY"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  productionWrites:evidence.production_write_count,
  migrationApplied:false,
  correctedTopology:"single_exact_union_4",
  nextGate:evidence.next_gate
},null,2));
