import fs from "node:fs";
import assert from "node:assert/strict";

const blueprintPath =
  "docs/evidence/trust-phase8i1-fair-detector-runtime-db-blueprint-v1.sql";
const migrationPath =
  "supabase/migrations/20260928072013_trust_phase8i1_fair_detector_runtime_v1.sql";
const blueprint = fs.readFileSync(blueprintPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");
const productionClosure = JSON.parse(
  fs.readFileSync(
    "docs/evidence/trust-phase8i1-fair-detector-runtime-production-closure-v1.json",
    "utf8",
  ),
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

assert.equal(
  migration,
  blueprint,
  "materialized Production migration must exactly match reviewed blueprint",
);

assert.equal(
  productionClosure.contract,
  "trust-phase8i1-fair-detector-runtime-production-closure-v1",
);
assert.equal(productionClosure.result, "PASS");
assert.equal(productionClosure.production_migration.version, "20260928072013");
assert.equal(
  productionClosure.production_migration.name,
  "trust_phase8i1_fair_detector_runtime_v1",
);
assert.equal(productionClosure.production_prestate.intake_count, 165);
assert.equal(productionClosure.production_prestate.checkpoint_count, 669);
assert.equal(productionClosure.production_prestate.event_count, 2);
assert.equal(productionClosure.production_prestate.product_fact_current_count, 71);
assert.equal(productionClosure.production_prestate.evidence_source_count, 40);

assert.deepEqual(
  productionClosure.cycle_1.batch_runs.map((run) => run.intakes_scanned),
  [5, 5, 100, 55],
);
assert.deepEqual(
  productionClosure.cycle_1.batch_runs.map((run) => run.remaining_in_cycle),
  [160, 155, 55, 0],
);
assert.equal(productionClosure.cycle_1.coverage.scanned_count, 165);
assert.equal(productionClosure.cycle_1.coverage.distinct_scanned, 165);
assert.equal(productionClosure.cycle_1.coverage.expected_count, 165);
assert.equal(productionClosure.cycle_1.coverage.missing_count, 0);
assert.equal(productionClosure.cycle_1.coverage.unexpected_count, 0);
assert.equal(productionClosure.cycle_1.runtime_state_reset, true);

const catchUp = productionClosure.cycle_1.catch_up_drift;
assert.equal(catchUp.event_id, "fad169e8-d462-4c74-8ffe-6bcc46ddfb15");
assert.equal(catchUp.event_type, "SOURCE_CHANGED");
assert.equal(catchUp.detector_key, "OFFICIAL_SOURCE_SET");
assert.equal(catchUp.previous_binding_id, "fd3ddecc-c09a-4b12-bc96-6e6ef2b2e97c");
assert.equal(catchUp.current_binding_id, "3d74a7bf-3a8d-407f-89c6-e2c398ddfc7f");
assert.equal(catchUp.disposition, "REVIEW_REQUIRED");
assert.equal(catchUp.authority_mutation, false);
assert.equal(catchUp.current_invalidated, false);
assert.equal(
  catchUp.interpretation,
  "EXPECTED_CATCH_UP_AFTER_GOVERNED_8H3_RELOCATION",
);
assert.equal(
  productionClosure.cycle_1.new_source_observation_digest_baselines.length,
  2,
);

const replay = productionClosure.cycle_2_idempotency;
assert.equal(replay.intakes_scanned, 165);
assert.equal(replay.remaining_in_cycle, 0);
assert.equal(replay.events_emitted, 0);
assert.equal(replay.signals_baselined, 0);
assert.equal(replay.signals_unchanged, 671);
assert.equal(replay.event_count_before, 3);
assert.equal(replay.event_count_after, 3);
assert.equal(replay.checkpoint_count_before, 671);
assert.equal(replay.checkpoint_count_after, 671);
assert.equal(replay.runtime_state_reset, true);

assert.equal(
  productionClosure.final_authority_invariants.product_fact_current_count,
  71,
);
assert.equal(
  productionClosure.final_authority_invariants.evidence_source_count,
  40,
);
assert.equal(
  productionClosure.final_authority_invariants.derma_historical_source_unchanged,
  true,
);
assert.equal(
  productionClosure.final_authority_invariants.derma_contains_current_unchanged,
  true,
);
assert.equal(
  productionClosure.final_authority_invariants.derma_concentration_current_unchanged,
  true,
);
assert.equal(
  productionClosure.final_authority_invariants.automatic_relocation_confirmation,
  false,
);
assert.equal(
  productionClosure.final_authority_invariants.automatic_product_fact_mutation,
  false,
);

assert.equal(productionClosure.security.v1_runner_preserved, true);
assert.equal(productionClosure.security.v2_search_path, "");
assert.deepEqual(productionClosure.security.v2_execute, {
  service_role: true,
  authenticated: false,
  anon: false,
  public: false,
});
assert.equal(productionClosure.security.runtime_state_direct_role_grants, 0);
assert.equal(productionClosure.security.new_authenticated_security_definer_findings, 0);

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
