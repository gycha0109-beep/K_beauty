#!/usr/bin/env node

import fs from "node:fs";

const migration = fs.readFileSync(
  "supabase/migrations/20260929180500_data_ai29c_c5b_subject_presentation_identity_correction_v1.sql",
  "utf8",
);
const architecture = fs.readFileSync(
  "docs/architecture/product-fact-subject-formulation-scope-v1.md",
  "utf8",
);

function check(condition, message) {
  if (!condition) throw new Error(message);
}

for (const token of [
  "different size\n!= automatically different Product Fact subject",
  "ordinary package size",
  "Size itself is not globally hard-coded as an identity dimension.",
  "A correction that changes semantic identity creates a new subject",
]) {
  check(architecture.includes(token), "PF-1 architecture token missing: " + token);
}

for (const token of [
  "admin_correct_product_fact_subject_presentation_variant_v1",
  "admin.products.review",
  "product-fact-subject-identity-v1",
  "admin_product_review_sha256_json",
  "product_fact_subject_presentation_correction_authority_already_attached",
  "product_fact_subject_presentation_correction_stale_predecessor",
  "product_fact_subject_presentation_correction_competing_current_subject",
  "set current_state = 'historical'",
  "'identity_correction'",
  "'subject_identity_corrected'",
  "'presentation_only_variant_correction'",
  "'successor_variant_key', null",
  "'product_fact_authority_mutated', false",
  "'recommendation_authority_mutated', false",
  "'idempotent', true",
  "to service_role;",
]) {
  check(migration.includes(token), "C5B migration token missing: " + token);
}

for (const table of [
  "product_evidence_source_subject_bindings",
  "product_evidence_records",
  "product_fact_instances",
  "product_fact_current",
  "product_fact_research_tasks",
]) {
  check(migration.includes("from public." + table), "precondition table missing: " + table);
}

check(
  migration.includes("insert into public.product_fact_subjects"),
  "successor Subject insertion missing",
);
check(
  !migration.includes("process_catalog_trust_product_v1("),
  "TRUST refresh must remain outside Subject correction transaction",
);
check(
  migration.includes(
    "revoke all on function public.admin_correct_product_fact_subject_presentation_variant_v1",
  ),
  "RPC revoke missing",
);
check(
  migration.includes(
    "grant execute on function public.admin_correct_product_fact_subject_presentation_variant_v1",
  ),
  "RPC service-role grant missing",
);

console.log(
  "DATA_AI29C_C5B_SUBJECT_PRESENTATION_IDENTITY_CORRECTION=PASS",
);
