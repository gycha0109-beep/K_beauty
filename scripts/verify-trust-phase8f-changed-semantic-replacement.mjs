import assert from "node:assert/strict";
import fs from "node:fs";

const migrationPath = "supabase/migrations/20260922030633_trust_phase8f_changed_semantic_replacement_v1.sql";
const prepPath = "tests/fixtures/trust-phase8f-revalidation/prepare_trust_phase8f_changed_candidate.sql";
const runtimePath = "tests/fixtures/trust-phase8f-revalidation/verify_trust_phase8f_changed_semantic_runtime.sql";

const migration = fs.readFileSync(migrationPath, "utf8");
const prep = fs.readFileSync(prepPath, "utf8");
const runtime = fs.readFileSync(runtimePath, "utf8");

for (const token of [
  "SEMANTIC_CHANGE_REPLACEMENT",
  "trust_phase8f_build_replacement_fact_payload_v1",
  "admin_prepare_product_fact_revalidation_replacement_v1",
  "admin_confirm_product_fact_revalidation_replacement_v1",
  "ready_for_explicit_replacement_confirmation",
  "admin_preflight_product_fact_confirmation_v1",
  "admin_confirm_product_fact_v1",
  "supersedes_fact_instance_id",
  "delete from public.product_fact_current",
  "revalidation_superseded",
  "automatic_confirmation"
]) {
  assert.ok(migration.includes(token), `missing Phase 8F migration token: ${token}`);
}

for (const token of [
  "TRUST_PHASE8F_CHANGED_CANDIDATE_PREPARED",
  "'false'::jsonb",
  "canonical_evidence_digest"
]) {
  assert.ok(prep.includes(token), `missing Phase 8F candidate-prep token: ${token}`);
}

for (const token of [
  "TRUST_PHASE8F_CHANGED_SEMANTIC_REPLACEMENT_RUNTIME_VERIFIED",
  "phase8f_current_pointer_not_replaced",
  "phase8f_fact_supersession_link_missing",
  "phase8f_replacement_replay_not_idempotent"
]) {
  assert.ok(runtime.includes(token), `missing Phase 8F runtime token: ${token}`);
}

assert.match(
  migration,
  /v_confirmation := public\.admin_confirm_product_fact_v1\([\s\S]*update public\.product_fact_instances[\s\S]*delete from public\.product_fact_current[\s\S]*operational_state = 'superseded'/
);

assert.match(
  migration,
  /grant execute on function public\.admin_prepare_product_fact_revalidation_replacement_v1\([\s\S]*to service_role;/
);
assert.match(
  migration,
  /grant execute on function public\.admin_confirm_product_fact_revalidation_replacement_v1\([\s\S]*to service_role;/
);

assert.equal(
  /grant execute on function public\.trust_phase8f_build_replacement_fact_payload_v1[\s\S]*to service_role;/.test(migration),
  false,
  "Phase 8F internal replacement helper must not be exposed to service_role"
);

console.log(JSON.stringify({
  status: "PASS",
  phase: "TRUST_PHASE8F_CHANGED_SEMANTIC_REPLACEMENT",
  explicit_confirmation_required: true,
  automatic_confirmation: false,
  old_current_retired_atomically: true
}));
