import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260922025843_trust_phase8e_revalidation_adjudication_v1.sql";
const runtimePath = "tests/fixtures/trust-phase8e-revalidation/verify_trust_phase8e_revalidation_adjudication_runtime.sql";

const migration = fs.readFileSync(migrationPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

for (const token of [
  "create table public.product_fact_revalidation_resolutions",
  "trust_phase8e_build_revalidation_plan_v1",
  "admin_preflight_product_fact_revalidation_resolution_v1",
  "admin_reaffirm_product_fact_revalidation_v1",
  "SAME_SEMANTIC_REAFFIRMATION",
  "same_semantic_reaffirmation_ready",
  "semantic_change_review_required",
  "admin_ingest_product_fact_evidence_v1",
  "revalidation_reaffirmed",
  "current_pointer_changed",
  "fact_instance_mutated",
  "automatic_confirmation"
]) {
  assert.ok(migration.includes(token), `missing Phase 8E migration token: ${token}`);
}

for (const token of [
  "TRUST_PHASE8E_REVALIDATION_ADJUDICATION_RUNTIME_VERIFIED",
  "phase8e_reaffirm_mutated_semantic_authority",
  "phase8e_reaffirm_replay_not_idempotent",
  "product_fact_revalidation_resolutions",
  "revalidation_reaffirmed"
]) {
  assert.ok(runtime.includes(token), `missing Phase 8E runtime token: ${token}`);
}

for (const forbidden of [
  "insert into public.product_fact_instances",
  "insert into public.product_fact_confirmations",
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "admin_confirm_product_fact_v1("
]) {
  assert.equal(
    migration.toLowerCase().includes(forbidden),
    false,
    `Phase 8E same-semantic reaffirmation must not mutate semantic authority: ${forbidden}`
  );
}

assert.match(
  migration,
  /revoke all on table public\.product_fact_revalidation_resolutions[\s\S]*from public, anon, authenticated, service_role;/
);
assert.match(
  migration,
  /grant select on table public\.product_fact_revalidation_resolutions to service_role;/
);
assert.match(
  migration,
  /grant execute on function public\.admin_preflight_product_fact_revalidation_resolution_v1\(uuid, text, uuid, uuid\)[\s\S]*to service_role;/
);
assert.match(
  migration,
  /grant execute on function public\.admin_reaffirm_product_fact_revalidation_v1\(uuid, text, uuid, uuid, text, text\)[\s\S]*to service_role;/
);

console.log(JSON.stringify({
  status: "PASS",
  phase: "TRUST_PHASE8E_REVALIDATION_ADJUDICATION",
  semantic_authority_mutation: false,
  automatic_confirmation: false
}));
