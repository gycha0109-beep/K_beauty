#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath =
  "supabase/migrations/20261003160200_v21_admission_g4_f1_category_authority_v1.sql";
const migration=fs.readFileSync(migrationPath,"utf8");
const p0=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-p0-ledger-reader-preflight-v1.json",
  "utf8"
));
const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-category-authority-infrastructure-v1.json",
  "utf8"
));
const d5c=fs.readFileSync(
  "supabase/migrations/20260930202522_data_ai29c_d5c_bounded_canary_authority_v1.sql",
  "utf8"
);
const runtime=fs.readFileSync(
  "lib/server/recommendation-candidate-admission-runtime.js",
  "utf8"
);

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F1");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F1_REPOSITORY_IMPLEMENTATION_READY"
);
assert.equal(evidence.production_applied,false);
assert.equal(evidence.reviewed_grant_rows_created_by_migration,0);
assert.equal(
  p0.next_gate,
  "V2.1-ADMISSION-G4-F1_CATEGORY_AUTHORITY_LEDGER_AND_PROTECTED_READER_IMPLEMENTATION"
);

for(const marker of [
  "create table public.recommendation_category_authority_reviews",
  "alter table public.recommendation_category_authority_reviews\n  enable row level security",
  "admin_register_recommendation_category_authority_review_v1",
  "read_recommendation_category_authority_v1",
  "security definer",
  "set search_path = ''",
  "recommendation_admission_reader_owner",
  "recommendation_admission_runtime",
  "data_ai29c_d5c_admission_reader_taxonomy_select_v1",
  "g4_f1_admission_reader_category_review_select_v1",
  "g4_f1_admission_reader_taxonomy_version_select_v1",
  "G4_F1_RUNTIME_RAW_SELECT_FORBIDDEN",
  "G4_F1_SERVICE_ROLE_DIRECT_LEDGER_ACCESS_FORBIDDEN",
  "G4_F1_MIGRATION_MUST_NOT_CREATE_REVIEW_ROWS",
  "G4_F1_PRODUCTS_CATEGORY_MUTATION_FORBIDDEN",
  "G4_F1_GLOBAL_TAXONOMY_ACTIVATION_FORBIDDEN",
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39",
  "6a9627b6-a5da-458f-84f7-3a40f91453be",
  "catalog-taxonomy-v1:source:hwahae:treatment"
]){
  assert.ok(migration.includes(marker),`migration missing: ${marker}`);
}

assert.equal(
  (migration.match(/insert into public\.recommendation_category_authority_reviews/g)||[]).length,
  1,
  "migration must contain only the writer's ledger insert"
);

for(const forbidden of [
  /update\s+public\.products/i,
  /insert\s+into\s+public\.products/i,
  /update\s+public\.product_catalog_taxonomy_assignments/i,
  /insert\s+into\s+public\.product_catalog_taxonomy_assignments/i,
  /update\s+public\.catalog_taxonomy_versions/i,
  /insert\s+into\s+public\.product_fact_/i,
  /update\s+public\.product_fact_/i,
  /insert\s+into\s+public\.recommendations\b/i,
  /update\s+public\.recommendations\b/i,
  /insert\s+into\s+public\.recommendation_logs\b/i,
  /update\s+public\.recommendation_logs\b/i,
  /insert\s+into\s+public\.recommendation_shadow_evidence_daily_v1\b/i,
  /update\s+public\.recommendation_shadow_evidence_daily_v1\b/i,
]){
  assert.equal(forbidden.test(migration),false,`forbidden mutation: ${forbidden}`);
}

assert.ok(
  d5c.includes("data_ai29c_d5c_admission_reader_taxonomy_select_v1")
);
assert.ok(
  migration.includes(
    "drop policy if exists\n  data_ai29c_d5c_admission_reader_taxonomy_select_v1"
  )
);
for(const productId of [
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17",
  "da5df70c-8cdd-4eb2-93b6-ede46c2f171d"
]){
  assert.ok(migration.includes(productId));
}
assert.equal(
  migration.includes("g4_f1_admission_reader_fation_taxonomy_select_v1"),
  false
);

assert.ok(
  migration.includes(
    "grant execute on function\n  public.admin_register_recommendation_category_authority_review_v1"
  )
);
assert.ok(migration.includes("to service_role;"));
assert.ok(
  migration.includes(
    "grant execute on function\n  public.read_recommendation_category_authority_v1(uuid)"
  )
);
assert.ok(migration.includes("to recommendation_admission_runtime;"));

assert.equal(
  runtime.includes("read_recommendation_category_authority_v1"),
  false,
  "G4-F1 must not wire category authority into production G3 runtime"
);
assert.equal(
  runtime.includes("recommendation-category-authority"),
  false
);

assert.equal(evidence.security.existing_d5c_scope_preserved,true);
assert.equal(evidence.security.taxonomy_reader_policy_mode,"single_exact_union_4");
assert.equal(evidence.security.taxonomy_reader_product_ids.length,4);
assert.equal(evidence.security.postgres_reader_owner_membership_preserved,true);
assert.deepEqual(
  evidence.security.ledger_fk_indexes,
  ["product_id","candidate_id","supersedes_review_id","reviewed_by"]
);
assert.ok(
  migration.includes("grant recommendation_admission_reader_owner to postgres")
);
assert.ok(
  migration.includes("with inherit false, set true, admin false")
);
assert.ok(
  migration.includes("granted by current_user")
);
assert.ok(
  migration.includes("revoke recommendation_admission_reader_owner from postgres")
);
assert.ok(
  migration.includes("G4_F1_POSTGRES_READER_OWNER_BASE_MEMBERSHIP_DRIFT")
);
assert.ok(
  migration.includes("G4_F1_TEMP_SET_ROLE_GRANT_REQUIRED")
);
assert.ok(
  migration.includes("G4_F1_POSTGRES_READER_OWNER_BASE_MEMBERSHIP_MUST_PERSIST")
);
assert.ok(
  migration.includes("G4_F1_TEMP_ROLE_GRANT_RESIDUE_FORBIDDEN")
);
assert.ok(
  migration.includes("G4_F1_POSTGRES_SET_ROLE_MUST_RETURN_FALSE")
);
assert.equal(evidence.security.service_role_direct_ledger_access,false);
assert.equal(evidence.security.runtime_raw_ledger_select,false);
assert.equal(evidence.mutation_boundary.g3_runtime_wired,false);

for(const value of Object.values(evidence.deployment_boundary)){
  assert.equal(value,false);
}
assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F1-D1_PRODUCTION_MIGRATION_PREFLIGHT"
);

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  migration:migrationPath,
  productionApplied:evidence.production_applied,
  reviewedGrantRows:0,
  g3RuntimeWired:false,
  nextGate:evidence.next_gate
},null,2));
