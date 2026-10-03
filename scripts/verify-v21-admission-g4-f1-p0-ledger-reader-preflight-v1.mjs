#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const evidence=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f1-p0-ledger-reader-preflight-v1.json",
  "utf8"
));
const fixture=JSON.parse(fs.readFileSync(
  "fixtures/recommendation-governance/g4f1-p0-ledger-reader-scenarios-v1.json",
  "utf8"
));
const f0=JSON.parse(fs.readFileSync(
  "evidence/recommendation-governance/v21-admission-g4-f0-category-authority-shadow-contract-v1.json",
  "utf8"
));
const g3a=fs.readFileSync(
  "supabase/migrations/20260822083000_v21_admission_g3a_pf_authority_read_v1.sql",
  "utf8"
);
const d5c=fs.readFileSync(
  "supabase/migrations/20260930202522_data_ai29c_d5c_bounded_canary_authority_v1.sql",
  "utf8"
);
const sunscreenSemantic=fs.readFileSync(
  "supabase/migrations/20260930113000_data_ai29c_d1_sunscreen_recommendation_semantic_authority_v1.sql",
  "utf8"
);

assert.equal(evidence.stage,"V2.1-ADMISSION-G4-F1-P0");
assert.equal(
  evidence.decision,
  "V21_ADMISSION_G4_F1_P0_LEDGER_READER_PREFLIGHT_READY"
);
assert.equal(
  f0.next_gate,
  "V2.1-ADMISSION-G4-F1_CATEGORY_AUTHORITY_LEDGER_AND_PROTECTED_READER"
);

assert.equal(
  evidence.target.assignment_snapshot_digest,
  "eaed6cb9dd58b0f1e08bc5b35da817a72887b81ee497e0d144fcb5018b108d39"
);
assert.equal(evidence.target.category,"treatment");

assert.equal(
  evidence.current_security_baseline.runtime_role.role,
  "recommendation_admission_runtime"
);
assert.equal(evidence.current_security_baseline.runtime_role.inherit,false);
assert.equal(evidence.current_security_baseline.runtime_role.bypassrls,false);
assert.equal(evidence.current_security_baseline.reader_owner_role.login,false);
assert.equal(
  evidence.current_security_baseline.existing_taxonomy_reader_policy.replacement_forbidden,
  true
);

assert.ok(g3a.includes("recommendation_admission_reader_owner"));
assert.ok(g3a.includes("recommendation_admission_runtime"));
assert.ok(g3a.includes("read_recommendation_admission_authority_v1"));
assert.ok(g3a.includes("G3A_RUNTIME_RAW_PF_SELECT_FORBIDDEN"));

for(const id of [
  "a6994fcd-302f-4e63-acbe-91a3f17a5a65",
  "b90bf992-07ae-4f49-a3a4-d90ea6d4a858",
  "7fc45e7c-38aa-41a1-b1a1-c0e09fcd8c17"
]){
  assert.ok(d5c.includes(id));
}
assert.ok(d5c.includes("data_ai29c_d5c_admission_reader_taxonomy_select_v1"));
assert.ok(!d5c.includes("da5df70c-8cdd-4eb2-93b6-ede46c2f171d"));

assert.ok(
  sunscreenSemantic.includes("admin_require_product_review_actor")
);
assert.ok(
  sunscreenSemantic.includes("admin_product_review_sha256_json")
);
assert.ok(
  sunscreenSemantic.includes("record_admin_audit_event")
);
assert.ok(
  sunscreenSemantic.includes("request_id text not null unique")
);
assert.ok(
  sunscreenSemantic.includes("supersedes_review_id")
);

const ledger=evidence.proposed_ledger;
assert.equal(ledger.table,"public.recommendation_category_authority_reviews");
assert.equal(ledger.rls.enabled,true);
assert.equal(ledger.rls.service_role_direct_access,false);
assert.equal(ledger.rls.runtime_direct_access,false);
assert.equal(ledger.constraints.one_current_row_per_product,true);
assert.deepEqual(ledger.constraints.review_states,["established","revoked"]);

const writer=evidence.proposed_writer;
assert.equal(
  writer.function,
  "public.admin_register_recommendation_category_authority_review_v1(uuid,text,jsonb)"
);
assert.deepEqual(writer.executable_by,["service_role"]);
assert.equal(writer.establish_contract.supplied_digest_trusted,false);
assert.equal(writer.establish_contract.product_legacy_category_must_be_null,true);
assert.equal(writer.revoke_contract.current_assignment_validity_required,false);
assert.equal(writer.idempotency.request_id_unique,true);
assert.equal(writer.audit.recommendation_admission_mutated,false);

const reader=evidence.proposed_reader;
assert.equal(
  reader.function,
  "public.read_recommendation_category_authority_v1(uuid)"
);
assert.equal(
  reader.read_contract_version,
  "recommendation-category-authority-read-v1"
);
assert.equal(reader.owner,"recommendation_admission_reader_owner");
assert.deepEqual(reader.executable_by,["recommendation_admission_runtime"]);
assert.equal(reader.raw_runtime_select_forbidden,true);
assert.equal(reader.subject_dependency,false);
assert.equal(reader.resolved_output.category,"treatment");
assert.equal(reader.resolved_output.recommendation_admission_mutated,false);
assert.equal(reader.resolved_output.production_cutover_authorized,false);

assert.match(
  evidence.proposed_acl_changes.taxonomy_assignment_rls_policy,
  /FATION-only/
);
assert.equal(
  evidence.proposed_acl_changes.runtime_raw_selects.every(([,allowed])=>allowed===false),
  true
);

assert.equal(fixture.scenarios.length,10);
assert.equal(
  fixture.scenarios.find(x=>x.id==="F1").expected,
  "CATEGORY_AUTHORITY_RESOLVED"
);
assert.equal(
  fixture.scenarios.find(x=>x.id==="F10").expected,
  "PERMISSION_DENIED"
);

for(const value of Object.values(evidence.p0_authority_boundary)){
  assert.equal(value,false);
}
assert.equal(
  evidence.next_gate,
  "V2.1-ADMISSION-G4-F1_CATEGORY_AUTHORITY_LEDGER_AND_PROTECTED_READER_IMPLEMENTATION"
);

const treeSensitive=[
  "supabase/migrations",
  "public.recommendation_category_authority_reviews",
  "admin_register_recommendation_category_authority_review_v1",
  "read_recommendation_category_authority_v1"
];

const p0Files=[
  "evidence/recommendation-governance/v21-admission-g4-f1-p0-ledger-reader-preflight-v1.json",
  "docs/evidence/v21-admission-g4-f1-p0-ledger-reader-preflight-v1.md",
  "fixtures/recommendation-governance/g4f1-p0-ledger-reader-scenarios-v1.json",
  "scripts/verify-v21-admission-g4-f1-p0-ledger-reader-preflight-v1.mjs"
];
for(const p of p0Files) assert.ok(fs.existsSync(p));

console.log(JSON.stringify({
  status:"PASS",
  stage:evidence.stage,
  decision:evidence.decision,
  targetProduct:evidence.target.product_id,
  migrationAuthorized:evidence.p0_authority_boundary.database_migration_authorized,
  nextGate:evidence.next_gate
},null,2));
