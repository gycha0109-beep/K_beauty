import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";

const provenance = JSON.parse(await readFile(
  new URL("../docs/evidence/trust-phase8h-cli-migration-generation-v1.json", import.meta.url),
  "utf8",
));

assert.equal(provenance.contract, "trust-phase8h-cli-migration-generation-v1");
assert.equal(provenance.supabase_cli_version, "2.117.0");
assert.equal(provenance.generation_authority, "SUPABASE_CLI_MIGRATION_NEW");
assert.equal(provenance.production_mutation, "NONE");
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
assert.equal(relocationMigrations[0].name, provenance.generated_migration_filename);
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
  status: "READY_FOR_DATABASE_VALIDATION",
  migration: provenance.generated_migration_filename,
  supabaseCliVersion: provenance.supabase_cli_version,
  workflowRunId: provenance.workflow_run_id,
  mutationOrder,
}, null, 2));
