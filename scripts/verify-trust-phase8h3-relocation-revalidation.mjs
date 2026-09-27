import fs from "node:fs";
import assert from "node:assert/strict";
import { extractStrictFactCandidate } from "./trust-research-worker.mjs";

const migrationPath = "docs/evidence/trust-phase8h3-relocation-revalidation-db-blueprint-v1.sql";
const migration = fs.readFileSync(migrationPath, "utf8");
const relocationResolver = fs.readFileSync("docs/evidence/trust-phase8h3-relocation-aware-verification-db-blueprint-v1.sql", "utf8");
const sourceVerificationWorker = fs.readFileSync("scripts/trust-source-verification-worker.mjs", "utf8");
const materializedMigrationPath = "supabase/migrations/20260927094055_trust_phase8h3_relocation_revalidation_v1.sql";
const materializedMigration = fs.readFileSync(materializedMigrationPath, "utf8");
const worker = fs.readFileSync("scripts/trust-research-worker.mjs", "utf8");
const contract = fs.readFileSync("docs/evidence/trust-phase8h3-relocation-revalidation-contract-v1.md", "utf8");
const provenance = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-cli-migration-generation-v1.json", "utf8"));
const dryRun = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-db-dry-run-validation-v1.json", "utf8"));
const closure = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-production-closure-v1.json", "utf8"));
const relocationAwareDryRun = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-relocation-aware-verification-dry-run-v1.json", "utf8"));
const relocationSeedHardening = fs.readFileSync("docs/evidence/trust-phase8h3-relocation-research-seed-hardening-db-blueprint-v1.sql", "utf8");
const relocationResearchSecurityHardening = fs.readFileSync("docs/evidence/trust-phase8h3-research-result-security-hardening-db-blueprint-v1.sql", "utf8");
const relocationResearchSecurityDryRun = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-research-result-security-hardening-dry-run-v1.json", "utf8"));
const relationalCandidateHardening = fs.readFileSync("docs/evidence/trust-phase8h3-relational-candidate-persistence-hardening-db-blueprint-v1.sql", "utf8");
const relationshipScopeHardening = fs.readFileSync("docs/evidence/trust-phase8h3-8e-relationship-scope-hardening-db-blueprint-v1.sql", "utf8");
const phase8eSecurityHardening = fs.readFileSync("docs/evidence/trust-phase8h3-8e-security-hardening-db-blueprint-v1.sql", "utf8");
const relationalFullPathDryRun = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-relational-phase8e-fullpath-dry-run-v1.json", "utf8"));
const relocationSeedDryRun = JSON.parse(fs.readFileSync("docs/evidence/trust-phase8h3-relocation-research-seed-hardening-dry-run-v1.json", "utf8"));

for (const needle of [
  "add column relocation_id uuid",
  "admin_preflight_official_source_relocation_revalidation_v1",
  "admin_mark_official_source_relocation_revalidation_v1",
  "verification_result = 'unchanged'",
  "reason_code = 'source_relocated'",
  "baseline_kind <> 'fresh_recovery'",
  "comparability_state <> 'COMPARABLE'",
  "replacement_binding_id",
  "current_fact_context",
  "parent_propositions",
  "relationship-aware-value-v1",
  "same_proposition_value",
  "supersedes_fact_instance_id",
]) {
  assert.ok(migration.includes(needle), `migration missing contract token: ${needle}`);
}

assert.ok(!/update\s+public\.product_evidence_sources/i.test(migration), "historical Evidence Source must not be updated");
assert.ok(!/update\s+public\.product_evidence_records/i.test(migration), "historical Evidence must not be updated");
assert.ok(!/update\s+public\.product_fact_current/i.test(migration), "Phase 8H-3 must use controlled confirmation for Current writes");
assert.ok(!/replay_verified\s*=\s*true/i.test(migration), "synthetic replay verification is forbidden");
assert.ok(!/verification_result\s*=\s*'changed'.*source_relocated/is.test(migration), "relocation must not synthesize changed verification");
assert.ok(!/^\s*begin\s*;/i.test(migration), "deployable blueprint must not open an outer transaction");
assert.ok(!/\n\s*commit\s*;\s*$/i.test(migration), "deployable blueprint must not commit its caller transaction");

for (const needle of [
  "get_official_source_relocation_verification_target_v1",
  "v_old_binding.binding_state <> 'retired'",
  "v_replacement_binding.binding_state <> 'resolved'",
  "v_replacement_review.scope_relation <> 'equivalent'",
  "'canonical_baseline', v_profile.canonical_baseline",
]) {
  assert.ok(relocationResolver.includes(needle), `relocation resolver missing contract token: ${needle}`);
}
assert.ok(!/update\s+public\.product_evidence_sources/i.test(relocationResolver), "relocation resolver must not mutate historical source");
for (const needle of [
  "establishRelocationFreshBaseline",
  "verifyRelocatedSource",
  "SOURCE_RELOCATION_TARGET_DRIFT",
  "SOURCE_RELOCATION_PROFILE_TARGET_MISMATCH",
  'mode === "relocation-baseline"',
  'mode === "relocation-verify"',
]) {
  assert.ok(sourceVerificationWorker.includes(needle), `source verification worker missing relocation token: ${needle}`);
}

assert.equal(provenance.contract, "trust-phase8h3-cli-migration-generation-v1");
assert.equal(provenance.generation_authority, "SUPABASE_CLI_MIGRATION_NEW");
assert.equal(provenance.production_mutation, "APPLIED");
assert.equal(provenance.repository_materialization, "PRODUCTION_VERSION_MATERIALIZED");
assert.equal(provenance.production_migration_version, "20260927094055");
assert.equal(provenance.production_migration_filename, "20260927094055_trust_phase8h3_relocation_revalidation_v1.sql");
assert.equal(provenance.production_apply_authority, "SUPABASE_MCP_APPLY_MIGRATION");
assert.equal(provenance.production_apply_result, "SUCCESS");
assert.equal(dryRun.contract, "trust-phase8h3-db-dry-run-validation-v1");
assert.equal(dryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(dryRun.migration_ddl_compile, "PASS");
assert.equal(dryRun.dependency_resolution, "PASS");
assert.equal(dryRun.production_mutation, "NONE");
assert.equal(dryRun.deployed_migration, "20260927094055_trust_phase8h3_relocation_revalidation_v1.sql");
assert.equal(materializedMigration, migration, "materialized Production migration must equal the reviewed DB blueprint");

assert.equal(closure.contract, "trust-phase8h3-production-closure-v1");
assert.equal(closure.merged_main_sha, "062f2d20eb5fd62e7affa98215f6582db0c037b5");
assert.deepEqual(closure.production_migration, {
  version: "20260927094055",
  name: "trust_phase8h3_relocation_revalidation_v1",
  filename: "20260927094055_trust_phase8h3_relocation_revalidation_v1.sql",
  source_blueprint: migrationPath,
  source_blueprint_content_sha: "ff457e2041c6eb4f863ea80311590621a9943cae",
  apply_authority: "SUPABASE_MCP_APPLY_MIGRATION",
  result: "SUCCESS",
});
assert.deepEqual(closure.security_readback, {
  preflight_rpc_exists: true,
  mark_rpc_exists: true,
  relocation_column_exists: true,
  service_role_preflight_execute: true,
  authenticated_preflight_execute: false,
  service_role_mark_execute: true,
  authenticated_mark_execute: false,
});
assert.equal(closure.dermafactory_semantic_immutability?.revalidation_transition_count, 0);
assert.equal(closure.dermafactory_semantic_immutability?.contains_active?.operational_state, "confirmed");
assert.equal(closure.dermafactory_semantic_immutability?.active_concentration?.operational_state, "confirmed");
assert.equal(closure.advisors?.security_blocker_for_phase8h3_objects, false);
assert.equal(closure.next_authority, "PHASE_8H_3_RELOCATION_AWARE_VERIFICATION_REQUIRED");
assert.deepEqual(dryRun.in_transaction_readback, {
  preflight_exists: true,
  mark_exists: true,
  relocation_column_exists: true,
  service_role_execute: true,
  authenticated_execute: false,
});
assert.deepEqual(dryRun.rollback_readback, {
  preflight_rolled_back: true,
  mark_rolled_back: true,
  relocation_column_rolled_back: true,
});
assert.equal(relocationAwareDryRun.contract, "trust-phase8h3-relocation-aware-verification-dry-run-v1");
assert.equal(relocationAwareDryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(relocationAwareDryRun.production_mutation, "NONE");
assert.equal(relocationAwareDryRun.result, "PASS");
assert.deepEqual(relocationAwareDryRun.rollback_readback, {
  rpc_rolled_back: true,
  derma_profile_count: 0,
  derma_transition_count: 0,
});
assert.equal(relocationAwareDryRun.dry_run_readback.historical_source_id, "f5eb21f8-4829-4c9b-b927-ccdfb43cdd1b");
assert.equal(
  relocationAwareDryRun.dry_run_readback.historical_canonical_locator,
  "https://www.dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933"
);
assert.equal(
  relocationAwareDryRun.dry_run_readback.replacement_locator,
  "https://dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933"
);
assert.equal(relocationAwareDryRun.dry_run_readback.service_role_execute, true);
assert.equal(relocationAwareDryRun.dry_run_readback.authenticated_execute, false);

for (const needle of [
  "not exists (",
  "and psb.market_code is not distinct from i2.market",
  "r0.result = 'confirmed'",
  "r0.replacement_binding_id = psb.binding_id",
  "rv0.binding_id = psb.binding_id",
  "rv0.scope_relation = 'equivalent'",
]) {
  assert.ok(relocationSeedHardening.includes(needle), `relocation research seed hardening missing token: ${needle}`);
}
assert.ok(
  relocationSeedHardening.indexOf("and psb.market_code is not distinct from i2.market")
    < relocationSeedHardening.indexOf("or exists ("),
  "generic exact-market predicate must remain inside the non-relocation branch",
);
assert.equal(relocationSeedDryRun.contract, "trust-phase8h3-relocation-research-seed-hardening-dry-run-v1");
assert.equal(relocationSeedDryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(relocationSeedDryRun.expected_generic_behavior, "UNCHANGED_EXACT_MARKET_REQUIRED");
assert.equal(relocationSeedDryRun.production_mutation, "NONE");
assert.equal(relocationSeedDryRun.rollback, true);
assert.equal(relocationSeedDryRun.result, "PASS");
assert.equal(relocationSeedDryRun.dry_run.claimed_tasks.length, 2);
for (const task of relocationSeedDryRun.dry_run.claimed_tasks) {
  assert.equal(task.source_binding_id, "3d74a7bf-3a8d-407f-89c6-e2c398ddfc7f");
  assert.equal(task.canonical_locator, "https://dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933");
  assert.equal(task.source_market, "KR_US");
}
for (const needle of [
  "select b.* into v_binding",
  "b.market_code is not distinct from v_intake.market",
  "r0.replacement_binding_id = b.binding_id",
  "rv0.binding_id = b.binding_id",
  "rv0.scope_relation = 'equivalent'",
  "and rb.disposition = 'RESEARCH_REQUEUED'",
]) {
  assert.ok(relocationSeedHardening.includes(needle), `relocation research result hardening missing token: ${needle}`);
}
assert.equal(relocationSeedDryRun.record_result_hardening.generic_exact_market_behavior, "UNCHANGED");
assert.equal(
  relocationSeedDryRun.record_result_hardening.relocation_candidate_source_authority,
  "CONFIRMED_REPLACEMENT_BINDING_WITH_EQUIVALENT_REVIEW"
);
assert.equal(
  relocationSeedDryRun.record_result_hardening.production_definition_preserved,
  "PHASE_8D_REVALIDATION_EXCEPTION_PRESENT"
);
assert.equal(relocationSeedDryRun.record_result_hardening.dry_run_readback.candidates_ready, 2);
for (const task of relocationSeedDryRun.record_result_hardening.dry_run_readback.tasks) {
  assert.equal(task.state, "EVIDENCE_CANDIDATE");
  assert.equal(task.source_locator, "https://dermafactory.net/products/niacinamide-20-serum-30ml?variant=46478659616933");
  assert.equal(task.source_digest, "3bb471669b9bc1426edfb472827a37e7cf6d1382a3072a7d33bfdf5eeea87809");
}


assert.ok(
  relocationResearchSecurityHardening.includes("CREATE OR REPLACE FUNCTION public.record_trust_research_result_v1"),
  "research result security hardening must replace the governed result recorder",
);
assert.match(
  relocationResearchSecurityHardening,
  /SECURITY DEFINER\s+SET search_path = ''/i,
  "research result recorder must pin SECURITY DEFINER search_path to empty",
);
assert.ok(
  !relocationResearchSecurityHardening.includes("SET search_path TO 'public', 'pg_temp'"),
  "unsafe public/pg_temp search_path must not remain",
);
for (const needle of [
  "public.product_fact_research_tasks",
  "public.catalog_trust_intake",
  "public.product_fact_subjects",
  "public.product_fact_definition_snapshots",
  "public.product_fact_current",
  "public.product_fact_instances",
  "public.product_fact_revalidation_research_bridges",
  "public.product_fact_revalidation_transitions",
  "public.product_source_bindings",
  "public.trust_official_source_relocations",
  "public.trust_official_source_binding_reviews",
  "public.trust_source_observations",
  "public.trust_evidence_candidates",
  "extensions.digest",
  "revoke all on function public.record_trust_research_result_v1(uuid, jsonb)",
  "from public, anon, authenticated",
  "grant execute on function public.record_trust_research_result_v1(uuid, jsonb)",
  "to service_role",
]) {
  assert.ok(relocationResearchSecurityHardening.includes(needle), `research result security hardening missing token: ${needle}`);
}
assert.ok(
  !/update\s+public\.product_evidence_sources/i.test(relocationResearchSecurityHardening),
  "research result security hardening must not mutate historical Evidence Source",
);
assert.ok(
  !/update\s+public\.product_fact_current/i.test(relocationResearchSecurityHardening),
  "research result security hardening must not directly mutate Current",
);


for (const needle of [
  "v_parent_proposition_key text;",
  "trust_research_parent_proposition_required",
  "trust_research_parent_proposition_invalid",
  "trust_research_parent_scope_mismatch",
  "'parent_proposition_key', v_parent_proposition_key",
  "normalized_value, parent_proposition_key, evidence_class",
  "'relational_repair', v_relational_repair",
  "r0.replacement_binding_id = b.binding_id",
  "rv0.scope_relation = 'equivalent'",
  "SET search_path = ''",
]) {
  assert.ok(relationalCandidateHardening.includes(needle), `relational candidate hardening missing token: ${needle}`);
}
assert.ok(
  !/update\s+public\.product_evidence_sources/i.test(relationalCandidateHardening),
  "relational candidate hardening must not mutate historical Evidence Source",
);
assert.ok(
  !/update\s+public\.product_fact_current/i.test(relationalCandidateHardening),
  "relational candidate hardening must not directly mutate Current",
);

for (const needle of [
  "v_candidate.market is distinct from v_current_fact.market",
  "v_candidate.region is distinct from v_current_fact.region",
  "v_candidate.qualifier is distinct from v_current_fact.qualifier",
  "v_current_fact.valid_from is not null",
  "v_current_fact.valid_to is not null",
]) {
  assert.ok(relationshipScopeHardening.includes(needle), `relationship scope hardening missing token: ${needle}`);
}
assert.match(
  relationshipScopeHardening,
  /set search_path = ''/i,
  "relationship scope hardening must pin SECURITY DEFINER search_path to empty",
);
assert.ok(
  !relationshipScopeHardening.includes("v_candidate.locale is distinct from v_current_fact.locale"),
  "source/evidence locale must not be treated as relational Product Fact applicability",
);
assert.ok(
  !/update\s+public\.product_fact_current/i.test(relationshipScopeHardening),
  "relationship scope hardening must not directly mutate Current",
);

for (const fn of [
  "admin_preflight_product_fact_revalidation_resolution_v1",
  "admin_reaffirm_product_fact_revalidation_v1",
]) {
  assert.ok(phase8eSecurityHardening.includes(`alter function public.${fn}`), `Phase 8E security hardening missing ${fn}`);
}
assert.match(phase8eSecurityHardening, /set search_path = ''/i);
assert.ok(phase8eSecurityHardening.includes("from public, anon, authenticated, service_role"));
assert.ok(phase8eSecurityHardening.includes("to service_role"));

assert.equal(relationalFullPathDryRun.contract, "trust-phase8h3-relational-phase8e-fullpath-dry-run-v1");
assert.equal(relationalFullPathDryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(relationalFullPathDryRun.production_mutation, "NONE");
assert.equal(relationalFullPathDryRun.dry_run.contains_active.semantic_relation, "SAME_SEMANTIC");
assert.equal(relationalFullPathDryRun.dry_run.contains_active.reaffirmation, "PASS");
assert.equal(relationalFullPathDryRun.dry_run.active_concentration.semantic_relation, "SAME_SEMANTIC");
assert.equal(relationalFullPathDryRun.dry_run.active_concentration.reaffirmation, "PASS");
assert.equal(
  relationalFullPathDryRun.dry_run.active_concentration.parent_proposition_key,
  "89703d12e70171885f5a0db6edb1920bbd3e1ae3f2dc652c0511d93643bc1c55",
);
assert.equal(
  relationalFullPathDryRun.dry_run.active_concentration.corrected_candidate_digest,
  "8936d01a7778cfa399602186bb3993d4b0005f0bea6af5dcc1e8266d63194e14",
);
assert.equal(relationalFullPathDryRun.dry_run.current_pointer_mutation, false);
assert.equal(relationalFullPathDryRun.dry_run.historical_source.mutated, false);
assert.equal(relationalFullPathDryRun.rollback_readback.resolution_count, 0);
assert.equal(relationalFullPathDryRun.rollback_readback.corrected_digest_persisted, false);
assert.equal(relationalFullPathDryRun.rollback, true);
assert.equal(relationalFullPathDryRun.result, "PASS");

for (const needle of [
  "source_relocated",
  "fresh-recovery",
  "Missing claims",
  "same-proposition",
]) {
  assert.ok(contract.toLowerCase().includes(needle.toLowerCase()), `contract missing invariant: ${needle}`);
}

assert.ok(worker.includes("expected-entity-product-identity-v1"), "contains_active expected-entity extractor missing");
assert.ok(!worker.toLowerCase().includes("niacinamide"), "worker must not hard-code Derma active identity");

const currentFactContext = {
  proposition_key: "a".repeat(64),
  value_entity_identifier: "niacinamide",
};
const strongSurfaces = {
  document: {
    title: "Niacinamide 20% Serum 30ml",
    meta_title: null,
    og_title: null,
  },
  structured_product_names: [],
};
const positive = extractStrictFactCandidate(
  "contains_active",
  "body text is irrelevant",
  [],
  { currentFactContext, semanticSurfaces: strongSurfaces },
);
assert.equal(positive?.normalizedValue, "niacinamide");
assert.equal(positive?.evidenceClass, "composition_identity");
assert.equal(positive?.observedClaim?.extractor, "expected-entity-product-identity-v1");

const bodyOnly = extractStrictFactCandidate(
  "contains_active",
  "This footer mentions niacinamide but the product identity does not.",
  [],
  {
    currentFactContext,
    semanticSurfaces: {
      document: { title: "Generic Serum", meta_title: null, og_title: null },
      structured_product_names: [],
    },
  },
);
assert.equal(bodyOnly, null, "body-only active mention must not become positive Evidence");

const wrongEntity = extractStrictFactCandidate(
  "contains_active",
  "",
  [],
  {
    currentFactContext: {
      proposition_key: "b".repeat(64),
      value_entity_identifier: "retinol",
    },
    semanticSurfaces: strongSurfaces,
  },
);
assert.equal(wrongEntity, null, "identity surface must match the expected current entity");

const parent = {
  proposition_key: "c".repeat(64),
  value_entity_identifier: "niacinamide",
};
const concentration = extractStrictFactCandidate(
  "active_concentration",
  "Niacinamide 20% Serum",
  [parent],
);
assert.deepEqual(concentration?.normalizedValue, { amount: 20, unit: "percent" });
assert.equal(concentration?.parentPropositionKey, parent.proposition_key);


assert.equal(relocationResearchSecurityDryRun.contract, "trust-phase8h3-research-result-security-hardening-dry-run-v1");
assert.equal(relocationResearchSecurityDryRun.validation_mode, "PRODUCTION_SCHEMA_TRANSACTIONAL_DRY_RUN_ROLLED_BACK");
assert.equal(relocationResearchSecurityDryRun.production_mutation, "NONE");
assert.equal(relocationResearchSecurityDryRun.dry_run_readback.security_definer, true);
assert.equal(relocationResearchSecurityDryRun.dry_run_readback.search_path, "");
assert.equal(relocationResearchSecurityDryRun.dry_run_readback.service_role_execute, true);
assert.equal(relocationResearchSecurityDryRun.dry_run_readback.authenticated_execute, false);
assert.equal(relocationResearchSecurityDryRun.dry_run_readback.anon_execute, false);
assert.equal(relocationResearchSecurityDryRun.dry_run_readback.public_execute, false);
assert.equal(relocationResearchSecurityDryRun.rollback, true);
assert.equal(relocationResearchSecurityDryRun.result, "PASS");

console.log("TRUST_PHASE8H3_RELOCATION_REVALIDATION_STATIC_VERIFIED");