import fs from "node:fs";
import assert from "node:assert/strict";

const blueprint = fs.readFileSync(
  "docs/evidence/trust-phase8i1-fair-detector-runtime-db-blueprint-v1.sql",
  "utf8",
);
const dryRun = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i1-fair-detector-runtime-dry-run-v1.json",
    "utf8",
  ),
);
const runtimeTest = fs.readFileSync(
  "tests/fixtures/trust-phase8i1-reentry/verify_trust_phase8i1_runtime.sql",
  "utf8",
);
const v1Migration = fs.readFileSync(
  "supabase/migrations/20260920200010_trust_phase6b_reentry_detectors_v1.sql",
  "utf8",
);

assert.ok(blueprint.includes("create table public.trust_reentry_detector_runtime_state"));
assert.ok(blueprint.includes("alter table public.trust_reentry_detector_runtime_state enable row level security"));
assert.ok(
  blueprint.includes(
    "revoke all on table public.trust_reentry_detector_runtime_state\n  from public, anon, authenticated, service_role;",
  ),
);

assert.ok(blueprint.includes("create index catalog_trust_intake_reentry_scan_idx"));
assert.ok(blueprint.includes("on public.catalog_trust_intake(created_at,id)"));
assert.ok(blueprint.includes("public.run_trust_reentry_detectors_v2("));
assert.ok(!blueprint.includes("create or replace function public.run_trust_reentry_detectors_v1("));
assert.ok(blueprint.includes("security definer"));
assert.ok(blueprint.includes("set search_path = ''"));
assert.ok(blueprint.includes("for update;"));
assert.ok(blueprint.includes("(created_at,id) >"));
assert.ok(blueprint.includes("(created_at,id) <="));
assert.ok(blueprint.includes("cycle_upper_created_at"));
assert.ok(blueprint.includes("cycle_upper_intake_id"));
assert.ok(blueprint.includes("scanned_intake_ids"));
assert.ok(blueprint.includes("'remaining_in_cycle',v_remaining_in_cycle"));

for (const detector of [
  "'OFFICIAL_SOURCE_SET'",
  "'IDENTITY_SCOPE'",
  "'REQUIRED_FACT_POLICY'",
  "'PRODUCT_FACT_REGISTRY'",
  "'SOURCE_OBSERVATION_DIGEST'",
]) {
  assert.ok(blueprint.includes(detector), `v2 lost detector semantics: ${detector}`);
  assert.ok(v1Migration.includes(detector), `v1 detector baseline missing: ${detector}`);
}

for (const eventType of [
  "'SOURCE_CHANGED'",
  "'FORMULATION_CHANGED'",
  "'POLICY_CHANGED'",
  "'REGISTRY_CHANGED'",
]) {
  assert.ok(blueprint.includes(eventType), `v2 lost event mapping: ${eventType}`);
}

assert.ok(
  blueprint.includes(
    "grant execute on function public.run_trust_reentry_detectors_v2(integer)\n  to service_role;",
  ),
);
assert.ok(
  blueprint.includes(
    "revoke all on function public.run_trust_reentry_detectors_v2(integer)\n  from public, anon, authenticated, service_role;",
  ),
);

for (const forbidden of [
  "update public.product_fact_current",
  "insert into public.product_fact_current",
  "delete from public.product_fact_current",
  "update public.product_evidence_sources",
  "delete from public.product_evidence_sources",
  "admin_confirm_trust_official_source_relocation_v1",
  "admin_reaffirm_product_fact_revalidation_v1",
]) {
  assert.ok(!blueprint.toLowerCase().includes(forbidden.toLowerCase()));
}

assert.equal(dryRun.contract, "trust-phase8i1-fair-detector-runtime-dry-run-v1");
assert.equal(dryRun.result, "PASS");
assert.equal(dryRun.production_transaction_rolled_back, true);
assert.equal(dryRun.observed.intakes_scanned, 1);
assert.equal(dryRun.observed.events_emitted, 0);
assert.equal(dryRun.observed.remaining_in_cycle, 164);
assert.equal(dryRun.observed.v1_runner_preserved, true);
assert.deepEqual(dryRun.observed.v2_acl, {
  service_role: true,
  authenticated: false,
  anon: false,
  public: false,
});
assert.equal(dryRun.rollback_readback.runtime_table_persisted, false);
assert.equal(dryRun.rollback_readback.v2_function_persisted, false);
assert.equal(dryRun.rollback_readback.checkpoint_count, 669);
assert.equal(dryRun.rollback_readback.event_count, 2);

assert.ok(runtimeTest.includes("generate_series(1,205)"));
assert.ok(runtimeTest.includes("phase8i1_batch1_invalid"));
assert.ok(runtimeTest.includes("phase8i1_batch2_invalid"));
assert.ok(runtimeTest.includes("phase8i1_batch3_invalid"));
assert.ok(runtimeTest.includes("phase8i1_frozen_cycle_coverage_invalid"));
assert.ok(runtimeTest.includes("phase8i1_next_cycle_eventual_coverage_invalid"));
assert.ok(runtimeTest.includes("phase8i1_v1_v2_semantic_parity_invalid"));

console.log("TRUST_PHASE8I1_FAIR_DETECTOR_STATIC_VERIFIED");
