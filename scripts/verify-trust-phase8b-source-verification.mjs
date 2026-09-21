#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260922010350_trust_phase8b_source_verification_ledger_v1.sql";
const runtimePath = "tests/fixtures/trust-phase8b-source-verification/verify_trust_phase8b_source_verification_runtime.sql";
const contractPath = "docs/evidence/trust-phase8a-product-fact-revalidation-contract-v1.md";

const migration = fs.readFileSync(migrationPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");
const contract = fs.readFileSync(contractPath, "utf8");

for (const token of [
  "create table public.product_evidence_source_verifications",
  "verification_result in ('unchanged', 'changed', 'unavailable', 'ambiguous')",
  "'subject_or_formulation_changed'",
  "'registry_changed'",
  "alter table public.product_evidence_source_verifications enable row level security",
  "revoke all on table public.product_evidence_source_verifications",
  "grant select on table public.product_evidence_source_verifications to service_role",
  "create or replace function public.record_product_evidence_source_verification_v1",
  "security definer",
  "set search_path = ''",
  "on conflict (request_id) do nothing",
  "product_evidence_source_verification_request_conflict",
  "'automatic_fact_mutation', false",
  "'automatic_confirmation', false",
  "revoke all on function public.record_product_evidence_source_verification_v1",
  "grant execute on function public.record_product_evidence_source_verification_v1"
]) {
  assert.ok(migration.includes(token), `missing Phase 8B migration token: ${token}`);
}

for (const forbidden of [
  "update public.product_fact_",
  "delete from public.product_fact_",
  "insert into public.product_fact_instances",
  "insert into public.product_fact_current",
  "admin_confirm_product_fact_v1(",
  "insert into public.recommendation",
  "update public.recommendation",
  "delete from public.recommendation"
]) {
  assert.ok(!migration.toLowerCase().includes(forbidden.toLowerCase()), `forbidden Phase 8B authority: ${forbidden}`);
}

for (const token of [
  "phase8b_exact_replay_not_idempotent",
  "phase8b_request_conflict_not_rejected",
  "phase8b_bad_unchanged_not_rejected",
  "phase8b_bad_changed_not_rejected",
  "phase8b_product_fact_state_mutated",
  "phase8b_direct_table_authority_leak",
  "phase8b_function_authority_mismatch",
  "TRUST_PHASE8B_SOURCE_VERIFICATION_RUNTIME_VERIFIED"
]) {
  assert.ok(runtime.includes(token), `missing Phase 8B runtime assertion: ${token}`);
}

assert.ok(contract.includes("NEXT = TRUST_PHASE8B_SOURCE_VERIFICATION_LEDGER"));
assert.ok(contract.includes("append-only source verification ledger"));

console.log(JSON.stringify({
  status: "PASS",
  phase: "TRUST_PHASE8B_SOURCE_VERIFICATION_LEDGER",
  append_only_verification: true,
  exact_retry_idempotency: true,
  automatic_fact_mutation: false,
  automatic_confirmation: false,
  recommendation_mutation: false
}, null, 2));
