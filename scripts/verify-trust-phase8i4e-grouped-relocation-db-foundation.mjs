import assert from "node:assert/strict";
import fs from "node:fs";

const sqlPath =
  "docs/evidence/trust-phase8i4e-grouped-relocation-db-migration-candidate-v1.sql";
const evidencePath =
  "docs/evidence/trust-phase8i4e-db-foundation-validation-v1.json";
const sql = fs.readFileSync(sqlPath, "utf8");
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));

for (const required of [
  "create table public.trust_official_source_relocation_groups",
  "create table public.trust_official_source_relocation_group_sources",
  "create table public.trust_official_source_relocation_group_incidents",
  "enable row level security",
  "revoke all on table",
  "grant select on table",
  "reject_trust_phase8i4_grouped_relocation_mutation_v1",
  "admin_preflight_trust_official_source_grouped_relocation_v1",
  "admin_confirm_trust_official_source_grouped_relocation_v1",
  "get_trust_official_source_grouped_relocation_lineage_v1",
  "admin_require_product_review_actor",
  "EVALUATION_NOT_LATEST",
  "EVALUATION_NOT_READY_FOR_8I4",
  "QUALIFIED_EXACT_PAYLOAD_REQUIRED",
  "GROUPED_SOURCE_COUNT_REQUIRES_MULTIPLE",
  "PREFLIGHT_ONLY_REQUIRES_EXPLICIT_ADMIN_GROUPED_CONFIRMATION",
  "READ_ONLY_GROUPED_PREFLIGHT_NO_PRODUCTION_WRITE",
  "admin_confirm_trust_official_source_relocation_v1(",
  "trust-official-source-grouped-relocation-v1",
  "EXPLICIT_ADMIN_GROUPED_RELOCATION_CONFIRMATION",
  "READ_ONLY_GROUPED_RELOCATION_LINEAGE",
]) {
  assert.ok(sql.includes(required), "8I-4E DB candidate missing: " + required);
}

for (const required of [
  "revoke all on function public.admin_preflight_trust_official_source_grouped_relocation_v1",
  "revoke all on function public.admin_confirm_trust_official_source_grouped_relocation_v1",
  "revoke all on function public.get_trust_official_source_grouped_relocation_lineage_v1",
  "grant execute on function public.admin_preflight_trust_official_source_grouped_relocation_v1",
  "grant execute on function public.admin_confirm_trust_official_source_grouped_relocation_v1",
  "grant execute on function public.get_trust_official_source_grouped_relocation_lineage_v1",
]) {
  assert.ok(sql.includes(required), "8I-4E privilege contract missing: " + required);
}

for (const forbidden of [
  "insert into public.product_evidence_sources",
  "update public.product_evidence_sources",
  "delete from public.product_evidence_sources",
  "insert into public.product_fact_current",
  "update public.product_fact_current",
  "delete from public.product_fact_current",
  "insert into public.product_fact_instances",
  "update public.product_fact_instances",
  "delete from public.product_fact_instances",
  "insert into public.product_fact_confirmations",
  "update public.product_fact_confirmations",
  "delete from public.product_fact_confirmations",
  "insert into public.trust_official_source_relocations(",
  "update public.trust_official_source_relocations",
  "delete from public.trust_official_source_relocations",
  "alter table public.trust_official_source_relocations drop",
]) {
  assert.equal(
    sql.toLowerCase().includes(forbidden.toLowerCase()),
    false,
    "8I-4E candidate contains forbidden direct authority mutation: " +
      forbidden,
  );
}

assert.equal(
  evidence.contract,
  "trust-phase8i4e-db-foundation-validation-v1",
);
assert.equal(
  evidence.validation_mode,
  "ROLLBACK_ONLY_NO_PERSISTENT_SCHEMA_OR_DATA_MUTATION",
);
assert.equal(evidence.production_gate.ready_for_8i4_count, 0);
assert.equal(
  evidence.production_gate.production_grouped_confirmation_executed,
  false,
);
assert.equal(
  evidence.checks.candidate_ddl_transaction_rollback,
  "PASS",
);
assert.equal(
  evidence.checks.synthetic_atomic_grouped_confirmation_in_rollback,
  "PASS",
);
assert.equal(evidence.checks.synthetic_group_source_count, 3);
assert.equal(evidence.checks.synthetic_group_incident_count, 3);
assert.equal(
  evidence.checks.evidence_source_count_unchanged_inside_synthetic_confirmation,
  true,
);
assert.equal(
  evidence.checks.product_fact_current_count_unchanged_inside_synthetic_confirmation,
  true,
);

for (const authority of [
  "READY_FOR_8I4_IS_HANDOFF_ONLY",
  "EXPLICIT_ADMIN_CONFIRMATION_REQUIRED",
  "PHASE8H_RELOCATION_RPC_IS_SOLE_BINDING_MUTATION_PRIMITIVE",
  "NO_PRODUCT_FACT_CURRENT_MUTATION",
  "NO_HISTORICAL_EVIDENCE_SOURCE_MUTATION",
  "NO_SEMANTIC_SAME_CHANGED_RESOLUTION",
]) {
  assert.ok(
    evidence.authority_invariants.includes(authority),
    "8I-4E evidence missing authority invariant: " + authority,
  );
}

console.log(
  JSON.stringify(
    {
      contract: "trust-phase8i4e-db-foundation-verification-v1",
      result: "PASS",
      synthetic_source_count:
        evidence.checks.synthetic_group_source_count,
      synthetic_incident_count:
        evidence.checks.synthetic_group_incident_count,
      production_ready_for_8i4_count:
        evidence.production_gate.ready_for_8i4_count,
      production_confirmation_executed:
        evidence.production_gate.production_grouped_confirmation_executed,
    },
    null,
    2,
  ),
);
