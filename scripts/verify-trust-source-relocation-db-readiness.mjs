import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const provenance = JSON.parse(await readFile(
  new URL("../docs/evidence/trust-phase8h-cli-migration-generation-v1.json", import.meta.url),
  "utf8",
));
const dryRun = JSON.parse(await readFile(
  new URL("../docs/evidence/trust-phase8h-db-dry-run-validation-v1.json", import.meta.url),
  "utf8",
));
const productionClosure = JSON.parse(await readFile(
  new URL("../docs/evidence/trust-phase8h-2b-production-closure-v1.json", import.meta.url),
  "utf8",
));

assert.equal(provenance.contract, "trust-phase8h-cli-migration-generation-v1");
assert.equal(provenance.supabase_cli_version, "2.117.0");
assert.equal(provenance.generation_authority, "SUPABASE_CLI_MIGRATION_NEW");
assert.equal(provenance.production_mutation, "NONE");
assert.equal(dryRun.contract, "trust-phase8h-db-dry-run-validation-v1");
assert.equal(dryRun.migration, provenance.generated_migration_filename);
assert.equal(dryRun.deployed_migration, provenance.production_migration_filename);
assert.equal(provenance.production_migration_version, "20260926074409");
assert.equal(provenance.production_apply_authority, "SUPABASE_MCP_APPLY_MIGRATION");
assert.equal(provenance.production_apply_result, "SUCCESS");
assert.equal(productionClosure.contract, "trust-phase8h-2b-production-closure-v1");
assert.equal(productionClosure.production_migration.version, provenance.production_migration_version);
assert.equal(productionClosure.production_migration.filename, provenance.production_migration_filename);
assert.equal(productionClosure.production_migration.source_cli_generated_filename, provenance.generated_migration_filename);
assert.equal(productionClosure.production_migration.result, "SUCCESS");
assert.equal(productionClosure.dermafactory_relocation.status, "confirmed");
assert.equal(productionClosure.dermafactory_relocation.old_binding_state, "retired");
assert.equal(productionClosure.dermafactory_relocation.replacement_binding_state, "resolved");
assert.equal(productionClosure.dermafactory_relocation.ledger_count, 1);
assert.equal(productionClosure.dermafactory_relocation.replacement_binding_count, 1);
assert.equal(productionClosure.dermafactory_relocation.replacement_review_count, 1);
assert.equal(productionClosure.dermafactory_relocation.audit_count, 1);
assert.equal(productionClosure.dermafactory_relocation.idempotent_replay, true);
assert.equal(productionClosure.dermafactory_relocation.immutable_update_rejected, true);
assert.equal(productionClosure.semantic_immutability.product_fact_instances_before, productionClosure.semantic_immutability.product_fact_instances_after);
assert.equal(productionClosure.semantic_immutability.product_fact_current_before, productionClosure.semantic_immutability.product_fact_current_after);
assert.equal(productionClosure.semantic_immutability.current_confirmations_before, productionClosure.semantic_immutability.current_confirmations_after);
assert.equal(productionClosure.semantic_immutability.revalidation_transitions_before, productionClosure.semantic_immutability.revalidation_transitions_after);
assert.equal(productionClosure.semantic_immutability.revalidation_bridges_before, productionClosure.semantic_immutability.revalidation_bridges_after);
assert.equal(productionClosure.semantic_immutability.recommendation_logs_before, productionClosure.semantic_immutability.recommendation_logs_after);
assert.equal(productionClosure.next_authority, "PHASE_8H_3_REVALIDATION_REQUIRED");
assert.equal(dryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(dryRun.migration_ddl_compile, "PASS");
assert.equal(dryRun.dependency_resolution, "PASS");
assert.equal(
  dryRun.canonical_digest_canary.prestate_digest,
  "70aae88369b09d87e9a9a7153ad04af662f7fc069445204f2eafee0b6d5a745b",
);
assert.equal(
  dryRun.canonical_digest_canary.relocation_plan_digest,
  "9cc3c864fdeea7dde6545b607f33a30654284e6d9fef86b958e07eb012805567",
);
assert.equal(dryRun.canonical_digest_canary.result, "PASS");
assert.equal(dryRun.admin_confirmation_canary.first_confirmation.status, "confirmed");
assert.equal(dryRun.admin_confirmation_canary.first_confirmation.idempotent, false);
assert.equal(dryRun.admin_confirmation_canary.replay_confirmation.status, "confirmed");
assert.equal(dryRun.admin_confirmation_canary.replay_confirmation.idempotent, true);
assert.deepEqual(dryRun.admin_confirmation_canary.in_transaction_sequential_readback, {
  ledger_count: 1,
  replacement_resolved_count: 1,
  old_binding_state: "retired",
  historical_locator_unchanged: true,
});
assert.equal(dryRun.fail_closed_canary.case, "BAD_EXPECTED_PRESTATE_DIGEST");
assert.equal(dryRun.fail_closed_canary.expected_sqlstate, "40001");
assert.equal(dryRun.fail_closed_canary.ledger_count, 0);
assert.equal(dryRun.fail_closed_canary.replacement_resolved_count, 0);
assert.equal(dryRun.fail_closed_canary.old_binding_state, "resolved");
assert.equal(dryRun.fail_closed_canary.result, "PASS");
assert.equal(dryRun.rollback_readback.relocation_ledger_exists, false);
assert.equal(dryRun.rollback_readback.admin_confirmation_rpc_exists, false);
assert.equal(dryRun.rollback_readback.canonical_helper_exists, false);
assert.equal(dryRun.rollback_readback.replacement_resolved_count, 0);
assert.equal(dryRun.rollback_readback.old_binding_state, "resolved");
assert.equal(dryRun.production_mutation, "NONE");
assert.match(
  provenance.generated_migration_filename,
  /^\d{14}_trust_phase8h_governed_official_source_relocation_v1\.sql$/,
);

const migrationFiles = (await readdir(new URL("../supabase/migrations/", import.meta.url)))
  .filter((name) => name.endsWith(".sql"));
const relocationMigrations = [];
for (const name of migrationFiles) {
  const sql = await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  if (
    sql.includes("admin_confirm_trust_official_source_relocation_v1")
    || sql.includes("trust_official_source_relocations")
  ) {
    relocationMigrations.push({ name, sql });
  }
}

assert.equal(relocationMigrations.length, 1, "expected exactly one Phase 8H-2B deployable migration");
assert.equal(relocationMigrations[0].name, provenance.production_migration_filename);
const sql = relocationMigrations[0].sql;
const lower = sql.toLowerCase();

for (const required of [
  "create table public.trust_official_source_relocations",
  "prestate_snapshot jsonb not null",
  "replacement_snapshot jsonb not null",
  "replacement_external_id text not null",
  "unique (old_binding_id)",
  "unique (relocation_plan_digest)",
  "before update or delete on public.trust_official_source_relocations",
  "alter table public.trust_official_source_relocations enable row level security",
  "revoke all on table public.trust_official_source_relocations",
  "grant select on table public.trust_official_source_relocations to service_role",
  "create or replace function public.trust_phase8h_canonical_json_text_v1",
  "immutable",
  "strict",
  "create or replace function public.admin_confirm_trust_official_source_relocation_v1",
  "security definer",
  "set search_path = ''",
  "public.admin_require_product_review_actor",
  "'admin.products.review'",
  "pg_advisory_xact_lock",
  "for update",
  "extensions.digest(convert_to(v_source_url, 'UTF8'), 'sha256')",
  "public.trust_phase8h_canonical_json_text_v1(v_prestate)",
  "public.trust_phase8h_canonical_json_text_v1(v_plan_preimage)",
  "insert into public.product_source_bindings",
  "insert into public.trust_official_source_binding_reviews",
  "set binding_state = 'retired'",
  "insert into public.trust_official_source_relocations",
  "public.record_admin_audit_event",
  "trust_official_source_relocation_idempotency_conflict",
  "trust_official_source_relocation_prestate_stale",
  "trust_official_source_relocation_plan_digest_mismatch",
  "revoke all on function public.admin_confirm_trust_official_source_relocation_v1",
  "grant execute on function public.admin_confirm_trust_official_source_relocation_v1",
]) {
  assert.equal(lower.includes(required.toLowerCase()), true, `missing migration invariant: ${required}`);
}

assert.equal(lower.includes("grant insert on table public.trust_official_source_relocations"), false);
assert.equal(lower.includes("admin_register_trust_official_source_binding_v1"), false);
assert.equal(/^\s*begin\s*;/i.test(sql), false, "migration must not add an explicit outer transaction");
assert.equal(/\n\s*commit\s*;/i.test(sql), false, "migration must not commit inside the CLI migration");

const mutationOrder = [
  "insert into public.product_source_bindings",
  "insert into public.trust_official_source_binding_reviews",
  "update public.product_source_bindings",
  "insert into public.trust_official_source_relocations",
  "public.record_admin_audit_event",
].map((needle) => lower.indexOf(needle));

assert.equal(mutationOrder.every((value) => value >= 0), true);
for (let index = 1; index < mutationOrder.length; index += 1) {
  assert.equal(
    mutationOrder[index] > mutationOrder[index - 1],
    true,
    `mutation order invalid: ${mutationOrder.join(",")}`,
  );
}

const retireBlock = lower.match(
  /update public\.product_source_bindings\s+set([\s\S]*?)where binding_id = v_old_binding_id/i,
)?.[1] ?? "";
assert.equal(retireBlock.includes("binding_state = 'retired'"), true);
assert.equal(retireBlock.includes("updated_at = now()"), true);
assert.equal(retireBlock.includes("last_observed_at"), false);
assert.equal(retireBlock.includes("source_url"), false);
assert.equal(retireBlock.includes("external_id"), false);

for (const forbidden of [
  "insert into public.product_evidence_sources",
  "update public.product_evidence_sources",
  "delete from public.product_evidence_sources",
  "insert into public.product_evidence_source_subject_bindings",
  "update public.product_evidence_source_subject_bindings",
  "delete from public.product_evidence_source_subject_bindings",
  "insert into public.product_fact_instances",
  "update public.product_fact_instances",
  "delete from public.product_fact_instances",
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "insert into public.product_fact_confirmations",
  "update public.product_fact_confirmations",
  "delete from public.product_fact_confirmations",
  "insert into public.recommendation_logs",
  "update public.recommendation_logs",
  "delete from public.recommendation_logs",
  "insert into public.product_fact_revalidation_transitions",
  "insert into public.product_fact_revalidation_research_bridges",
]) {
  assert.equal(lower.includes(forbidden), false, `forbidden Phase 8H-2B mutation: ${forbidden}`);
}

console.log(JSON.stringify({
  status: "PHASE_8H_2B_PRODUCTION_CONFIRMED",
  migration: provenance.production_migration_filename,
  supabaseCliVersion: provenance.supabase_cli_version,
  workflowRunId: provenance.workflow_run_id,
  dryRunValidation: dryRun.validation_mode,
  mutationOrder,
}, null, 2));
