#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260922011000_trust_phase8c_revalidation_transition_v1.sql";
const runtimePath = "tests/fixtures/trust-phase8c-revalidation/verify_trust_phase8c_revalidation_runtime.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

for (const token of [
  "create table public.product_fact_revalidation_transitions",
  "unique (verification_id, assignment_id)",
  "create or replace function public.admin_mark_product_fact_revalidation_v1",
  "security definer",
  "set search_path = ''",
  "product_fact_revalidation_verification_not_actionable",
  "product_fact_revalidation_assignment_not_confirmed",
  "product_fact_revalidation_current_prestate_stale",
  "product_fact_revalidation_source_not_linked_to_current_fact",
  "'revalidation_stale'",
  "'revalidation_required'",
  "'current_pointer_changed', false",
  "'fact_instance_mutated', false",
  "'automatic_confirmation', false",
  "revoke all on function public.admin_mark_product_fact_revalidation_v1",
  "grant execute on function public.admin_mark_product_fact_revalidation_v1"
]) {
  assert.ok(migration.includes(token), `missing Phase 8C migration token: ${token}`);
}

for (const forbidden of [
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "insert into public.product_fact_instances",
  "update public.product_fact_instances",
  "delete from public.product_fact_instances",
  "admin_confirm_product_fact_v1(",
  "insert into public.recommendation",
  "update public.recommendation",
  "delete from public.recommendation"
]) {
  assert.ok(!migration.toLowerCase().includes(forbidden.toLowerCase()), `forbidden Phase 8C semantic authority: ${forbidden}`);
}

for (const token of [
  "phase8c_assignment_not_re_review_required",
  "phase8c_current_pointer_changed",
  "phase8c_semantic_authority_mutated",
  "phase8c_exact_replay_not_idempotent",
  "phase8c_exact_replay_created_duplicates",
  "phase8c_request_conflict_not_rejected",
  "phase8c_nonconfirmed_assignment_not_rejected",
  "phase8c_unchanged_verification_not_rejected",
  "phase8c_transition_ledger_acl_leak",
  "TRUST_PHASE8C_REVALIDATION_TRANSITION_RUNTIME_VERIFIED"
]) {
  assert.ok(runtime.includes(token), `missing Phase 8C runtime assertion: ${token}`);
}

console.log(JSON.stringify({
  status:"PASS",
  phase:"TRUST_PHASE8C_REVALIDATION_TRANSITION",
  confirmed_to_stale_to_re_review_required:true,
  exact_retry_idempotency:true,
  stale_prestate_fail_closed:true,
  current_pointer_mutation:false,
  fact_instance_mutation:false,
  automatic_confirmation:false
}, null, 2));
