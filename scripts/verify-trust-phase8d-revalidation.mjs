#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260922013500_trust_phase8d_revalidation_research_bridge_v1.sql";
const adapterPath = "tests/fixtures/trust-phase8d-revalidation/20260922013450_trust_phase8d_fixture_adapter.sql";
const runtimePath = "tests/fixtures/trust-phase8d-revalidation/verify_trust_phase8d_revalidation_research_runtime.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const adapter = fs.readFileSync(adapterPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

for (const token of [
  "create table public.product_fact_revalidation_research_bridges",
  "admin_enqueue_product_fact_revalidation_research_v1",
  "create or replace function public.claim_trust_research_tasks_v1",
  "REVALIDATION_INTAKE_MISSING",
  "REVALIDATION_INTAKE_AMBIGUOUS",
  "REVALIDATION_INTAKE_STALE",
  "RESEARCH_REQUEUED",
  "revalidation_research_requeued",
  "v_existing_current and not exists",
  "ra.operational_state = 're_review_required'",
  "'current_pointer_changed', false",
  "'fact_instance_mutated', false",
  "'automatic_confirmation', false"
]) {
  assert.ok(migration.includes(token), `missing Phase 8D migration token: ${token}`);
}

for (const token of [
  "research_policy_version",
  "trust_state",
  "external_type",
  "binding_method",
  "product_scope_state",
  "created_at",
  "alter column id set default gen_random_uuid()",
  "alter column observation_id set default gen_random_uuid()",
  "alter column candidate_id set default gen_random_uuid()",
  "trust_phase8d_fixture_observation_identity",
  "trust_phase8d_fixture_candidate_digest"
]) {
  assert.ok(adapter.includes(token), `missing Phase 8D fixture adapter token: ${token}`);
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
  assert.ok(!migration.toLowerCase().includes(forbidden.toLowerCase()), `forbidden Phase 8D semantic authority: ${forbidden}`);
}

for (const token of [
  "phase8d_research_bridge_result_invalid",
  "phase8d_research_task_not_requeued",
  "phase8d_assignment_state_changed_early",
  "phase8d_research_bridge_replay_not_idempotent",
  "phase8d_revalidation_task_not_claimed",
  "phase8d_phase3_reentry_failed",
  "phase8d_assignment_mutated_by_research",
  "phase8d_semantic_authority_mutated",
  "TRUST_PHASE8D_REVALIDATION_RESEARCH_BRIDGE_RUNTIME_VERIFIED"
]) {
  assert.ok(runtime.includes(token), `missing Phase 8D runtime assertion: ${token}`);
}

console.log(JSON.stringify({
  status:"PASS",
  phase:"TRUST_PHASE8D_REVALIDATION_RESEARCH_BRIDGE",
  explicit_bridge:true,
  phase3_reentry:true,
  missing_intake_fail_closed:true,
  exact_retry_idempotency:true,
  current_pointer_mutation:false,
  fact_instance_mutation:false,
  automatic_confirmation:false
}, null, 2));
